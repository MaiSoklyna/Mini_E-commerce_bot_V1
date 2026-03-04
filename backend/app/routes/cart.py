"""
Cart API — customer endpoints
Tables: cart (id, user_id, merchant_id), cart_items (id, cart_id, product_id, ...)
"""
from fastapi import APIRouter, HTTPException, Depends
from app.models.cart import CartItemAdd, CartItemUpdate
from app.database import execute_query
from app.utils.security import get_current_user

router = APIRouter(prefix="/cart", tags=["Cart"])


def _get_or_create_cart(user_id: int, merchant_id: int) -> int:
    """Return cart.id for user+merchant, creating it if needed."""
    cart = execute_query(
        "SELECT id FROM cart WHERE user_id = %s AND merchant_id = %s",
        (user_id, merchant_id), fetch_one=True,
    )
    if cart:
        return cart["id"]
    cart_id = execute_query(
        "INSERT INTO cart (user_id, merchant_id) VALUES (%s, %s)",
        (user_id, merchant_id), commit=True,
    )
    return cart_id


def _cart_summary(user_id: int) -> dict:
    row = execute_query(
        "SELECT COUNT(ci.id) AS item_count, "
        "COALESCE(SUM(ci.unit_price * ci.quantity), 0) AS subtotal "
        "FROM cart_items ci "
        "JOIN cart c ON ci.cart_id = c.id "
        "WHERE c.user_id = %s",
        (user_id,), fetch_one=True,
    )
    return {
        "item_count": row["item_count"] if row else 0,
        "subtotal": float(row["subtotal"]) if row else 0.0,
    }


@router.get("/")
async def get_cart(user: dict = Depends(get_current_user)):
    """Return all cart items for the current user (across merchants)."""
    items = execute_query(
        "SELECT ci.id, ci.cart_id, ci.product_id, ci.quantity, "
        "ci.selected_variants, ci.unit_price, "
        "ci.unit_price * ci.quantity AS line_total, "
        "ci.created_at, "
        "p.name AS product_name, p.icon_emoji, p.stock, "
        "c.merchant_id, m.name AS merchant_name, "
        "(SELECT pi.url FROM product_images pi "
        " WHERE pi.product_id = p.id ORDER BY pi.sort_order LIMIT 1) AS primary_image "
        "FROM cart_items ci "
        "JOIN cart c ON ci.cart_id = c.id "
        "JOIN products p ON ci.product_id = p.id "
        "JOIN merchants m ON c.merchant_id = m.id "
        "WHERE c.user_id = %s "
        "ORDER BY ci.created_at DESC",
        (user["id"],), fetch_all=True,
    ) or []

    for item in items:
        item["line_total"] = float(item["line_total"])
        item["unit_price"] = float(item["unit_price"])

    summary = _cart_summary(user["id"])
    return {"success": True, "data": {"items": items, **summary}}


@router.post("/items")
async def add_to_cart(body: CartItemAdd, user: dict = Depends(get_current_user)):
    """Add product (with optional variants) to cart."""
    product = execute_query(
        "SELECT id, merchant_id, name, base_price, stock, is_active "
        "FROM products WHERE id = %s",
        (body.product_id,), fetch_one=True,
    )
    if not product or not product["is_active"]:
        raise HTTPException(status_code=404, detail="Product not found or unavailable")
    if body.quantity > product["stock"]:
        raise HTTPException(status_code=422, detail="STOCK_INSUFFICIENT")

    # Calculate price with variant adjustments
    unit_price = float(product["base_price"])
    selected = []
    if body.selected_variants:
        for sv in body.selected_variants:
            opt = execute_query(
                "SELECT price_adjust FROM product_variant_options WHERE id = %s AND is_active = TRUE",
                (sv.option_id,), fetch_one=True,
            )
            if opt:
                unit_price += float(opt["price_adjust"])
            selected.append(sv.model_dump())

    cart_id = _get_or_create_cart(user["id"], product["merchant_id"])

    # Check if same product+variants already in cart
    existing = execute_query(
        "SELECT id, quantity FROM cart_items WHERE cart_id = %s AND product_id = %s",
        (cart_id, body.product_id), fetch_one=True,
    )
    if existing:
        new_qty = existing["quantity"] + body.quantity
        execute_query(
            "UPDATE cart_items SET quantity = %s, unit_price = %s WHERE id = %s",
            (new_qty, unit_price, existing["id"]), commit=True,
        )
        cart_item_id = existing["id"]
    else:
        import json
        cart_item_id = execute_query(
            "INSERT INTO cart_items (cart_id, product_id, quantity, selected_variants, unit_price) "
            "VALUES (%s, %s, %s, %s, %s)",
            (cart_id, body.product_id, body.quantity,
             json.dumps(selected) if selected else None, unit_price),
            commit=True,
        )

    summary = _cart_summary(user["id"])
    variant_label = " · ".join(sv["label"] for sv in selected) if selected else ""
    return {
        "success": True,
        "data": {
            "cart_item_id": cart_item_id,
            "product_name": product["name"],
            "variant_label": variant_label,
            "unit_price": unit_price,
            "quantity": body.quantity,
            "line_total": unit_price * body.quantity,
            "cart_summary": summary,
        },
    }


@router.patch("/items/{item_id}")
async def update_cart_item(item_id: int, body: CartItemUpdate, user: dict = Depends(get_current_user)):
    item = execute_query(
        "SELECT ci.id, ci.quantity, p.stock FROM cart_items ci "
        "JOIN cart c ON ci.cart_id = c.id "
        "JOIN products p ON ci.product_id = p.id "
        "WHERE ci.id = %s AND c.user_id = %s",
        (item_id, user["id"]), fetch_one=True,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")

    if body.quantity <= 0:
        execute_query("DELETE FROM cart_items WHERE id = %s", (item_id,), commit=True)
        return {"success": True, "message": "Item removed from cart"}

    if body.quantity > item["stock"]:
        raise HTTPException(status_code=422, detail="STOCK_INSUFFICIENT")

    execute_query(
        "UPDATE cart_items SET quantity = %s WHERE id = %s",
        (body.quantity, item_id), commit=True,
    )
    return {"success": True, "message": "Cart updated", "quantity": body.quantity}


@router.delete("/items/{item_id}")
async def remove_cart_item(item_id: int, user: dict = Depends(get_current_user)):
    item = execute_query(
        "SELECT ci.id FROM cart_items ci JOIN cart c ON ci.cart_id = c.id "
        "WHERE ci.id = %s AND c.user_id = %s",
        (item_id, user["id"]), fetch_one=True,
    )
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    execute_query("DELETE FROM cart_items WHERE id = %s", (item_id,), commit=True)
    return {"success": True, "message": "Item removed"}


@router.delete("/")
async def clear_cart(user: dict = Depends(get_current_user)):
    execute_query(
        "DELETE ci FROM cart_items ci JOIN cart c ON ci.cart_id = c.id WHERE c.user_id = %s",
        (user["id"],), commit=True,
    )
    return {"success": True, "message": "Cart cleared"}


@router.post("/validate-promo")
async def validate_promo(body: dict, user: dict = Depends(get_current_user)):
    """Validate a promo code against a cart total."""
    code = (body.get("code") or "").strip().upper()
    merchant_id = body.get("merchant_id")
    cart_total = float(body.get("cart_total", 0))

    if not code or not merchant_id:
        raise HTTPException(status_code=400, detail="code and merchant_id required")

    promo = execute_query(
        "SELECT id, type, value, min_order, max_uses, used_count, expires_at, is_active "
        "FROM promo_codes WHERE code = %s AND merchant_id = %s",
        (code, merchant_id), fetch_one=True,
    )
    if not promo:
        raise HTTPException(status_code=404, detail="PROMO_NOT_FOUND")
    if not promo["is_active"]:
        raise HTTPException(status_code=422, detail="PROMO_EXPIRED")
    if promo["expires_at"] and str(promo["expires_at"]) < str(__import__("datetime").date.today()):
        raise HTTPException(status_code=422, detail="PROMO_EXPIRED")
    if promo["max_uses"] and promo["used_count"] >= promo["max_uses"]:
        raise HTTPException(status_code=422, detail="PROMO_EXHAUSTED")
    if cart_total < float(promo["min_order"]):
        raise HTTPException(status_code=422, detail="PROMO_MIN_ORDER")

    if promo["type"] == "percent":
        discount = round(cart_total * float(promo["value"]) / 100, 2)
    else:
        discount = min(float(promo["value"]), cart_total)

    return {
        "success": True,
        "data": {
            "promo_id": promo["id"],
            "code": code,
            "type": promo["type"],
            "value": float(promo["value"]),
            "discount_amount": discount,
            "final_total": round(cart_total - discount, 2),
        },
    }

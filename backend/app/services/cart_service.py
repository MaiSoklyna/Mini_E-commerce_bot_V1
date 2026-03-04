"""
Cart service — handles shopping cart operations.
Used by both API routes and Telegram bot handlers.
"""
from typing import List, Optional
from app.database import execute_query
import logging

logger = logging.getLogger(__name__)


def get_cart_items(user_id: int) -> List[dict]:
    """Get all cart items for a user with product and merchant details."""
    return execute_query(
        """SELECT sc.*, p.product_name, p.stock_quantity as available_stock,
                  m.merchant_name,
                  (SELECT pi.image_url FROM product_images pi
                   WHERE pi.product_id = sc.product_id AND pi.is_primary = TRUE LIMIT 1) as image_url
           FROM shopping_cart sc
           JOIN products p ON sc.product_id = p.product_id
           JOIN merchants m ON sc.shop_id = m.merchant_id
           WHERE sc.user_id = %s
           ORDER BY sc.added_date DESC""",
        (user_id,), fetch_all=True
    ) or []


def get_cart_summary(user_id: int) -> dict:
    """Get cart item count and total price."""
    result = execute_query(
        "SELECT COUNT(*) as count, COALESCE(SUM(final_price), 0) as total FROM shopping_cart WHERE user_id = %s",
        (user_id,), fetch_one=True
    )
    return {"count": result["count"], "total": float(result["total"])}


def add_to_cart(user_id: int, product_id: int, quantity: int = 1) -> dict:
    """
    Add a product to the user's cart.
    If the product is already in the cart, increase the quantity.
    Returns: {"success": bool, "message": str, "quantity": int}
    """
    # Verify product exists and is active
    product = execute_query(
        "SELECT * FROM products WHERE product_id = %s AND is_active = TRUE AND deleted_date IS NULL",
        (product_id,), fetch_one=True
    )
    if not product:
        return {"success": False, "message": "Product not found or unavailable"}

    if quantity > product["stock_quantity"]:
        return {"success": False, "message": f"Only {product['stock_quantity']} items in stock"}

    unit_price = float(product["price"])

    # Check if already in cart
    existing = execute_query(
        "SELECT * FROM shopping_cart WHERE user_id = %s AND product_id = %s",
        (user_id, product_id), fetch_one=True
    )

    if existing:
        new_qty = existing["quantity"] + quantity
        if new_qty > product["stock_quantity"]:
            return {"success": False, "message": f"Only {product['stock_quantity']} in stock (you have {existing['quantity']} in cart)"}
        new_final = unit_price * new_qty
        execute_query(
            "UPDATE shopping_cart SET quantity = %s, final_price = %s WHERE cart_id = %s",
            (new_qty, new_final, existing["cart_id"]), commit=True
        )
        return {"success": True, "message": "Cart updated", "quantity": new_qty}
    else:
        final_price = unit_price * quantity
        execute_query(
            """INSERT INTO shopping_cart (user_id, shop_id, product_id, quantity, unit_price, final_price)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (user_id, product["merchant_id"], product_id, quantity, unit_price, final_price),
            commit=True
        )
        return {"success": True, "message": "Added to cart", "quantity": quantity}


def update_cart_quantity(user_id: int, cart_id: int, quantity: int) -> dict:
    """Update quantity of a cart item."""
    item = execute_query(
        """SELECT sc.*, p.price, p.stock_quantity
           FROM shopping_cart sc
           JOIN products p ON sc.product_id = p.product_id
           WHERE sc.cart_id = %s AND sc.user_id = %s""",
        (cart_id, user_id), fetch_one=True
    )
    if not item:
        return {"success": False, "message": "Cart item not found"}

    if quantity <= 0:
        execute_query("DELETE FROM shopping_cart WHERE cart_id = %s", (cart_id,), commit=True)
        return {"success": True, "message": "Item removed from cart"}

    if quantity > item["stock_quantity"]:
        return {"success": False, "message": f"Only {item['stock_quantity']} in stock"}

    final_price = float(item["price"]) * quantity
    execute_query(
        "UPDATE shopping_cart SET quantity = %s, unit_price = %s, final_price = %s WHERE cart_id = %s",
        (quantity, float(item["price"]), final_price, cart_id), commit=True
    )
    return {"success": True, "message": "Cart updated"}


def remove_from_cart(user_id: int, cart_id: int) -> bool:
    """Remove a single item from the cart."""
    result = execute_query(
        "SELECT cart_id FROM shopping_cart WHERE cart_id = %s AND user_id = %s",
        (cart_id, user_id), fetch_one=True
    )
    if not result:
        return False
    execute_query("DELETE FROM shopping_cart WHERE cart_id = %s", (cart_id,), commit=True)
    return True


def clear_cart(user_id: int) -> int:
    """Clear all items from a user's cart. Returns number of items removed."""
    count = get_cart_summary(user_id)["count"]
    execute_query("DELETE FROM shopping_cart WHERE user_id = %s", (user_id,), commit=True)
    return count


def get_cart_grouped_by_merchant(user_id: int) -> dict:
    """
    Get cart items grouped by merchant.
    Returns: {merchant_id: {"merchant_name": str, "items": list, "subtotal": float}}
    """
    items = get_cart_items(user_id)
    groups = {}
    for item in items:
        mid = item["shop_id"]
        if mid not in groups:
            groups[mid] = {
                "merchant_id": mid,
                "merchant_name": item["merchant_name"],
                "items": [],
                "subtotal": 0.0,
            }
        groups[mid]["items"].append(item)
        groups[mid]["subtotal"] += float(item["final_price"])
    return groups
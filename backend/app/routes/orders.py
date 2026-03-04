"""
Orders API — customer endpoints
Tables: orders, order_items, promo_codes, promo_usages, cart, cart_items
"""
import json
import uuid
import asyncio
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from typing import Optional
from app.models.order import OrderCreate, OrderStatusUpdate
from app.database import execute_query
from app.utils.security import get_current_user, get_current_merchant_admin
from app.utils.khqr import generate_khqr, generate_payment_deeplink
from app.utils.bot_manager import get_bot
from bot.SendingReceipt import send_receipt_to_customer
import logging

router = APIRouter(prefix="/orders", tags=["Orders"])
logger = logging.getLogger(__name__)


def _generate_order_code() -> str:
    return f"ORD-{uuid.uuid4().hex[:6].upper()}"


def _attach_items(order: dict) -> None:
    items = execute_query(
        "SELECT id, product_id, product_name, product_sku, selected_variants, "
        "quantity, unit_price, subtotal "
        "FROM order_items WHERE order_id = %s",
        (order["id"],), fetch_all=True,
    ) or []
    for item in items:
        item["unit_price"] = float(item["unit_price"])
        item["subtotal"] = float(item["subtotal"])
    order["items"] = items


# ── Customer: place order ─────────────────────────────────────────

@router.post("/")
async def place_order(body: OrderCreate, user: dict = Depends(get_current_user)):
    """Checkout: create order from current cart for a specific merchant."""
    user_id = user["id"]
    merchant_id = body.merchant_id

    # Get cart for this user + merchant
    cart = execute_query(
        "SELECT id FROM cart WHERE user_id = %s AND merchant_id = %s",
        (user_id, merchant_id), fetch_one=True,
    )
    if not cart:
        raise HTTPException(status_code=422, detail="CART_EMPTY")

    cart_items = execute_query(
        "SELECT ci.id, ci.product_id, ci.quantity, ci.unit_price, ci.selected_variants, "
        "p.name AS product_name, p.sku AS product_sku, p.stock "
        "FROM cart_items ci JOIN products p ON ci.product_id = p.id "
        "WHERE ci.cart_id = %s",
        (cart["id"],), fetch_all=True,
    ) or []
    if not cart_items:
        raise HTTPException(status_code=422, detail="CART_EMPTY")

    # Validate stock
    for item in cart_items:
        if item["quantity"] > item["stock"]:
            raise HTTPException(
                status_code=422,
                detail=f"STOCK_INSUFFICIENT: {item['product_name']} only has {item['stock']} left",
            )

    subtotal = sum(float(i["unit_price"]) * i["quantity"] for i in cart_items)
    discount_amount = 0.0
    promo_code_id = None

    # Apply promo code
    if body.promo_code:
        code = body.promo_code.strip().upper()
        promo = execute_query(
            "SELECT id, type, value, min_order, max_uses, used_count, expires_at, is_active "
            "FROM promo_codes WHERE code = %s AND merchant_id = %s",
            (code, merchant_id), fetch_one=True,
        )
        if not promo or not promo["is_active"]:
            raise HTTPException(status_code=422, detail="PROMO_NOT_FOUND")
        if promo["expires_at"] and str(promo["expires_at"]) < str(__import__("datetime").date.today()):
            raise HTTPException(status_code=422, detail="PROMO_EXPIRED")
        if promo["max_uses"] and promo["used_count"] >= promo["max_uses"]:
            raise HTTPException(status_code=422, detail="PROMO_EXHAUSTED")
        if subtotal < float(promo["min_order"]):
            raise HTTPException(status_code=422, detail="PROMO_MIN_ORDER")

        if promo["type"] == "percent":
            discount_amount = round(subtotal * float(promo["value"]) / 100, 2)
        else:
            discount_amount = min(float(promo["value"]), subtotal)
        promo_code_id = promo["id"]

    total = round(subtotal - discount_amount, 2)
    order_code = _generate_order_code()

    # Create order
    order_id = execute_query(
        "INSERT INTO orders (order_code, user_id, merchant_id, promo_code_id, "
        "subtotal, discount_amount, delivery_fee, total, payment_method, "
        "delivery_address, delivery_province, customer_note) "
        "VALUES (%s, %s, %s, %s, %s, %s, 0, %s, %s, %s, %s, %s)",
        (order_code, user_id, merchant_id, promo_code_id,
         subtotal, discount_amount, total, body.payment_method,
         body.delivery_address, body.delivery_province, body.customer_note),
        commit=True,
    )

    # Create order items (snapshot) and reduce stock
    for item in cart_items:
        item_subtotal = float(item["unit_price"]) * item["quantity"]
        execute_query(
            "INSERT INTO order_items (order_id, product_id, product_name, product_sku, "
            "selected_variants, quantity, unit_price, subtotal) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (order_id, item["product_id"], item["product_name"], item.get("product_sku"),
             item["selected_variants"], item["quantity"],
             float(item["unit_price"]), item_subtotal),
            commit=True,
        )
        execute_query(
            "UPDATE products SET stock = stock - %s WHERE id = %s",
            (item["quantity"], item["product_id"]), commit=True,
        )

    # Record promo usage and increment counter
    if promo_code_id:
        execute_query(
            "INSERT INTO promo_usages (promo_code_id, user_id, order_id, discount_applied) "
            "VALUES (%s, %s, %s, %s)",
            (promo_code_id, user_id, order_id, discount_amount), commit=True,
        )
        execute_query(
            "UPDATE promo_codes SET used_count = used_count + 1 WHERE id = %s",
            (promo_code_id,), commit=True,
        )

    # Also update cached rating counts on products (just a trigger-less update)
    # Clear cart
    execute_query("DELETE FROM cart_items WHERE cart_id = %s", (cart["id"],), commit=True)

    return {
        "success": True,
        "data": {
            "order_id": order_id,
            "order_code": order_code,
            "status": "pending",
            "subtotal": subtotal,
            "discount_amount": discount_amount,
            "delivery_fee": 0.0,
            "total": total,
            "payment_method": body.payment_method,
            "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        },
    }


# ── Customer: view own orders ─────────────────────────────────────

@router.get("/")
async def list_my_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    total_row = execute_query(
        "SELECT COUNT(*) AS total FROM orders WHERE user_id = %s", (user["id"],), fetch_one=True
    )
    total = total_row["total"] if total_row else 0

    rows = execute_query(
        "SELECT o.id, o.order_code, o.merchant_id, m.name AS merchant_name, "
        "o.subtotal, o.discount_amount, o.delivery_fee, o.total, "
        "o.status, o.payment_method, o.payment_status, o.delivery_address, "
        "o.created_at "
        "FROM orders o JOIN merchants m ON o.merchant_id = m.id "
        "WHERE o.user_id = %s ORDER BY o.created_at DESC LIMIT %s OFFSET %s",
        (user["id"], limit, (page - 1) * limit), fetch_all=True,
    ) or []

    for o in rows:
        _attach_items(o)

    return {
        "success": True,
        "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit if total else 0},
    }


@router.get("/{order_id}")
async def get_order(order_id: int, user: dict = Depends(get_current_user)):
    order = execute_query(
        "SELECT o.id, o.order_code, o.merchant_id, m.name AS merchant_name, "
        "o.subtotal, o.discount_amount, o.delivery_fee, o.total, "
        "o.status, o.payment_method, o.payment_status, "
        "o.delivery_address, o.delivery_province, o.customer_note, "
        "o.created_at, o.updated_at "
        "FROM orders o JOIN merchants m ON o.merchant_id = m.id "
        "WHERE o.id = %s AND o.user_id = %s",
        (order_id, user["id"]), fetch_one=True,
    )
    if not order:
        raise HTTPException(status_code=404, detail="ORDER_NOT_FOUND")
    _attach_items(order)
    return {"success": True, "data": order}


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: int, user: dict = Depends(get_current_user)):
    order = execute_query(
        "SELECT id, status FROM orders WHERE id = %s AND user_id = %s",
        (order_id, user["id"]), fetch_one=True,
    )
    if not order:
        raise HTTPException(status_code=404, detail="ORDER_NOT_FOUND")
    if order["status"] != "pending":
        raise HTTPException(status_code=422, detail="ORDER_CANCEL_DENIED")

    # Restore stock
    items = execute_query(
        "SELECT product_id, quantity FROM order_items WHERE order_id = %s",
        (order_id,), fetch_all=True,
    ) or []
    for item in items:
        execute_query(
            "UPDATE products SET stock = stock + %s WHERE id = %s",
            (item["quantity"], item["product_id"]), commit=True,
        )

    execute_query(
        "UPDATE orders SET status = 'cancelled', payment_status = 'refunded' WHERE id = %s",
        (order_id,), commit=True,
    )
    return {"success": True, "message": "Order cancelled"}


@router.get("/{order_id}/tracking")
async def get_tracking(order_id: int, user: dict = Depends(get_current_user)):
    order = execute_query(
        "SELECT id, order_code, status, payment_status, updated_at "
        "FROM orders WHERE id = %s AND user_id = %s",
        (order_id, user["id"]), fetch_one=True,
    )
    if not order:
        raise HTTPException(status_code=404, detail="ORDER_NOT_FOUND")
    return {"success": True, "data": order}


@router.get("/{order_id}/khqr")
async def get_khqr_payment(order_id: int, user: dict = Depends(get_current_user)):
    """Generate KHQR QR code for order payment"""
    order = execute_query(
        "SELECT o.id, o.order_code, o.merchant_id, o.total, o.payment_method, "
        "o.payment_status, o.status "
        "FROM orders o "
        "WHERE o.id = %s AND o.user_id = %s",
        (order_id, user["id"]), fetch_one=True,
    )

    if not order:
        raise HTTPException(status_code=404, detail="ORDER_NOT_FOUND")

    # Check if payment method is KHQR
    if order["payment_method"] != "khqr":
        raise HTTPException(
            status_code=422,
            detail="PAYMENT_METHOD_NOT_KHQR"
        )

    # Check if already paid
    if order["payment_status"] == "paid":
        raise HTTPException(
            status_code=422,
            detail="ORDER_ALREADY_PAID"
        )

    # Check if order is cancelled
    if order["status"] == "cancelled":
        raise HTTPException(
            status_code=422,
            detail="ORDER_CANCELLED"
        )

    try:
        # Generate KHQR QR code
        qr_code = generate_khqr(
            amount=float(order["total"]),
            order_id=order["order_code"],
            merchant_id=order["merchant_id"]
        )

        # Generate Bakong app deep link
        deeplink = generate_payment_deeplink(
            amount=float(order["total"]),
            order_id=order["order_code"],
            merchant_id=order["merchant_id"]
        )

        return {
            "success": True,
            "data": {
                "order_id": order["id"],
                "order_code": order["order_code"],
                "amount": float(order["total"]),
                "qr_code": qr_code,  # Base64 encoded QR code image
                "deeplink": deeplink,  # Bakong app deep link
                "expires_in": 900,  # 15 minutes in seconds
                "instructions": {
                    "step1": "Scan this QR code with Bakong app",
                    "step2": "Verify the amount and merchant name",
                    "step3": "Complete the payment in your Bakong app",
                    "step4": "Your order will be confirmed automatically",
                    "note": "Payment QR code expires in 15 minutes"
                }
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"KHQR_GENERATION_FAILED: {str(e)}"
        )


@router.post("/{order_id}/confirm-payment")
async def confirm_khqr_payment(
    order_id: int,
    user: dict = Depends(get_current_user),
):
    """
    Confirm KHQR payment (MVP: manual confirmation)
    In production, this would be called by BAKONG webhook or after API verification
    """
    order = execute_query(
        "SELECT o.id, o.order_code, o.payment_method, o.payment_status, o.status "
        "FROM orders o "
        "WHERE o.id = %s AND o.user_id = %s",
        (order_id, user["id"]), fetch_one=True,
    )

    if not order:
        raise HTTPException(status_code=404, detail="ORDER_NOT_FOUND")

    if order["payment_method"] != "khqr":
        raise HTTPException(status_code=422, detail="PAYMENT_METHOD_NOT_KHQR")

    if order["payment_status"] == "paid":
        raise HTTPException(status_code=422, detail="ALREADY_PAID")

    if order["status"] == "cancelled":
        raise HTTPException(status_code=422, detail="ORDER_CANCELLED")

    # Update payment status
    execute_query(
        "UPDATE orders SET payment_status = 'paid', status = 'confirmed', "
        "updated_at = NOW() WHERE id = %s",
        (order_id,), commit=True,
    )

    return {
        "success": True,
        "message": "Payment confirmed successfully",
        "data": {
            "order_id": order["id"],
            "order_code": order["order_code"],
            "payment_status": "paid",
            "status": "confirmed"
        }
    }


# ── Merchant: update order status ─────────────────────────────────

@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(get_current_merchant_admin),
):
    order = execute_query(
        "SELECT id, status, merchant_id FROM orders WHERE id = %s",
        (order_id,), fetch_one=True,
    )
    if not order:
        raise HTTPException(status_code=404, detail="ORDER_NOT_FOUND")
    if order["merchant_id"] != admin["merchant_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if order["status"] == "cancelled":
        raise HTTPException(status_code=422, detail="Cannot update a cancelled order")

    old_status = order["status"]
    new_status = body.status

    fields = ["status = %s", "updated_at = NOW()"]
    params: list = [body.status]

    if body.admin_note:
        fields.append("admin_note = %s")
        params.append(body.admin_note)
    if body.payment_status:
        fields.append("payment_status = %s")
        params.append(body.payment_status)

    params.append(order_id)
    execute_query(
        f"UPDATE orders SET {', '.join(fields)} WHERE id = %s",
        tuple(params), commit=True,
    )

    # Send receipt to customer if order is marked as delivered
    if new_status == "delivered" and old_status != "delivered":
        try:
            bot = get_bot()
            # Schedule receipt sending as background task
            background_tasks.add_task(send_receipt_to_customer, bot, order_id)
            logger.info(f"Scheduled receipt sending for order {order_id}")
        except Exception as e:
            # Log error but don't fail the status update
            logger.error(f"Failed to schedule receipt for order {order_id}: {str(e)}")

    return {"success": True, "message": f"Order status updated to {body.status}"}

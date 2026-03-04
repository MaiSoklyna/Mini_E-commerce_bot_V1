"""
Order service — handles checkout, order management, and status updates.
Used by both API routes and Telegram bot handlers.
"""
from typing import Optional, List
from app.database import execute_query
from app.utils.helpers import generate_order_number
from app.services.cart_service import get_cart_items, clear_cart
import logging

logger = logging.getLogger(__name__)


# ==================== CHECKOUT ====================

def create_orders_from_cart(user_id: int, delivery_address: str, delivery_city: str,
                            payment_method: str = "cod") -> dict:
    """
    Create order(s) from cart items. Groups items by merchant.
    Returns: {"success": bool, "orders": list, "message": str}
    """
    cart_items = get_cart_items(user_id)
    if not cart_items:
        return {"success": False, "orders": [], "message": "Cart is empty"}

    # Group items by merchant
    merchant_groups = {}
    for item in cart_items:
        mid = item["shop_id"]
        if mid not in merchant_groups:
            merchant_groups[mid] = []
        merchant_groups[mid].append(item)

    created_orders = []

    for merchant_id, items in merchant_groups.items():
        total_amount = sum(float(item["final_price"]) for item in items)
        order_number = generate_order_number()

        # Create order
        order_id = execute_query(
            """INSERT INTO orders (order_number, merchant_id, user_id, total_amount,
                   discount_amount, final_amount, delivery_address, delivery_city, payment_method)
               VALUES (%s, %s, %s, %s, 0, %s, %s, %s, %s)""",
            (order_number, merchant_id, user_id, total_amount, total_amount,
             delivery_address, delivery_city, payment_method),
            commit=True
        )

        # Create order items + decrease stock
        for item in items:
            execute_query(
                """INSERT INTO order_items (order_id, product_id, quantity, unit_price, final_price)
                   VALUES (%s, %s, %s, %s, %s)""",
                (order_id, item["product_id"], item["quantity"],
                 float(item["unit_price"]), float(item["final_price"])),
                commit=True
            )
            execute_query(
                "UPDATE products SET stock_quantity = stock_quantity - %s WHERE product_id = %s",
                (item["quantity"], item["product_id"]), commit=True
            )

        # Create payment record
        execute_query(
            """INSERT INTO payments (shop_id, user_id, order_id, amount, payment_method)
               VALUES (%s, %s, %s, %s, %s)""",
            (merchant_id, user_id, order_id, total_amount, payment_method),
            commit=True
        )

        created_orders.append({
            "order_id": order_id,
            "order_number": order_number,
            "merchant_id": merchant_id,
            "total": total_amount,
            "items_count": len(items),
        })

        logger.info(f"Order created: {order_number} for user {user_id}, merchant {merchant_id}, total ${total_amount}")

    # Clear cart after successful checkout
    clear_cart(user_id)

    return {
        "success": True,
        "orders": created_orders,
        "message": f"Created {len(created_orders)} order(s)",
    }


# ==================== ORDER QUERIES ====================

def get_user_orders(user_id: int, limit: int = 20) -> List[dict]:
    """Get all orders for a customer."""
    orders = execute_query(
        """SELECT o.*, m.merchant_name
           FROM orders o
           JOIN merchants m ON o.merchant_id = m.merchant_id
           WHERE o.user_id = %s
           ORDER BY o.created_date DESC
           LIMIT %s""",
        (user_id, limit), fetch_all=True
    )
    for order in orders:
        order["items"] = get_order_items(order["order_id"])
    return orders


def get_merchant_orders(merchant_id: int, status: str = None, limit: int = 50) -> List[dict]:
    """Get all orders for a merchant's shop."""
    query = """
        SELECT o.*, u.username as customer_name, u.phone_number as customer_phone
        FROM orders o
        JOIN users u ON o.user_id = u.user_id
        WHERE o.merchant_id = %s
    """
    params = [merchant_id]

    if status:
        query += " AND o.status = %s"
        params.append(status)

    query += " ORDER BY o.created_date DESC LIMIT %s"
    params.append(limit)

    orders = execute_query(query, tuple(params), fetch_all=True)
    for order in orders:
        order["items"] = get_order_items(order["order_id"])
    return orders


def get_order_by_id(order_id: int) -> Optional[dict]:
    """Get a single order with full details."""
    order = execute_query(
        """SELECT o.*, m.merchant_name, u.username as customer_name, u.phone_number as customer_phone
           FROM orders o
           JOIN merchants m ON o.merchant_id = m.merchant_id
           JOIN users u ON o.user_id = u.user_id
           WHERE o.order_id = %s""",
        (order_id,), fetch_one=True
    )
    if order:
        order["items"] = get_order_items(order_id)
    return order


def get_order_by_number(order_number: str) -> Optional[dict]:
    """Get order by order number (e.g., ORD-ABCD1234)."""
    order = execute_query(
        """SELECT o.*, m.merchant_name
           FROM orders o
           JOIN merchants m ON o.merchant_id = m.merchant_id
           WHERE o.order_number = %s""",
        (order_number,), fetch_one=True
    )
    if order:
        order["items"] = get_order_items(order["order_id"])
    return order


def get_order_items(order_id: int) -> List[dict]:
    """Get all items in an order."""
    return execute_query(
        """SELECT oi.*, p.product_name
           FROM order_items oi
           JOIN products p ON oi.product_id = p.product_id
           WHERE oi.order_id = %s""",
        (order_id,), fetch_all=True
    ) or []


# ==================== STATUS MANAGEMENT ====================

def update_order_status(order_id: int, new_status: str,
                        shipper_name: str = None, shipper_phone: str = None) -> dict:
    """
    Update order status with validation.
    Valid transitions: pending → confirmed → preparing → shipped → delivered
    """
    valid_transitions = {
        "pending": ["confirmed", "cancelled"],
        "confirmed": ["preparing", "cancelled"],
        "preparing": ["shipped", "cancelled"],
        "shipped": ["delivered"],
        "delivered": [],
        "cancelled": [],
    }

    order = execute_query("SELECT * FROM orders WHERE order_id = %s", (order_id,), fetch_one=True)
    if not order:
        return {"success": False, "message": "Order not found"}

    current = order["status"]
    allowed = valid_transitions.get(current, [])

    if new_status not in allowed:
        return {"success": False, "message": f"Cannot change from '{current}' to '{new_status}'. Allowed: {allowed}"}

    # Build update query
    timestamp_field = {
        "confirmed": "confirmed_date",
        "shipped": "shipped_date",
        "delivered": "delivered_date",
    }.get(new_status)

    update_query = "UPDATE orders SET status = %s"
    params = [new_status]

    if timestamp_field:
        update_query += f", {timestamp_field} = NOW()"

    if shipper_name:
        update_query += ", shipper_name = %s"
        params.append(shipper_name)
    if shipper_phone:
        update_query += ", shipper_phone = %s"
        params.append(shipper_phone)

    # Auto-complete COD payment on delivery
    if new_status == "delivered" and order["payment_method"] == "cod":
        update_query += ", payment_status = 'completed', payment_collected_date = NOW()"

    update_query += " WHERE order_id = %s"
    params.append(order_id)

    execute_query(update_query, tuple(params), commit=True)
    logger.info(f"Order {order['order_number']} status: {current} → {new_status}")

    return {"success": True, "message": f"Status updated to {new_status}"}


def cancel_order(order_id: int, user_id: int) -> dict:
    """Cancel an order (customer only, if still pending). Restores stock."""
    order = execute_query(
        "SELECT * FROM orders WHERE order_id = %s AND user_id = %s",
        (order_id, user_id), fetch_one=True
    )
    if not order:
        return {"success": False, "message": "Order not found"}
    if order["status"] != "pending":
        return {"success": False, "message": "Can only cancel pending orders"}

    # Restore stock
    items = get_order_items(order_id)
    for item in items:
        execute_query(
            "UPDATE products SET stock_quantity = stock_quantity + %s WHERE product_id = %s",
            (item["quantity"], item["product_id"]), commit=True
        )

    execute_query(
        "UPDATE orders SET status = 'cancelled', payment_status = 'failed' WHERE order_id = %s",
        (order_id,), commit=True
    )

    logger.info(f"Order {order['order_number']} cancelled by user {user_id}")
    return {"success": True, "message": "Order cancelled, stock restored"}


# ==================== STATISTICS ====================

def get_merchant_stats(merchant_id: int) -> dict:
    """Get dashboard statistics for a merchant."""
    return {
        "total_products": execute_query(
            "SELECT COUNT(*) as c FROM products WHERE merchant_id = %s AND is_active = TRUE AND deleted_date IS NULL",
            (merchant_id,), fetch_one=True
        )["c"],
        "total_orders": execute_query(
            "SELECT COUNT(*) as c FROM orders WHERE merchant_id = %s",
            (merchant_id,), fetch_one=True
        )["c"],
        "pending_orders": execute_query(
            "SELECT COUNT(*) as c FROM orders WHERE merchant_id = %s AND status = 'pending'",
            (merchant_id,), fetch_one=True
        )["c"],
        "confirmed_orders": execute_query(
            "SELECT COUNT(*) as c FROM orders WHERE merchant_id = %s AND status = 'confirmed'",
            (merchant_id,), fetch_one=True
        )["c"],
        "total_revenue": float(execute_query(
            "SELECT COALESCE(SUM(final_amount), 0) as t FROM orders WHERE merchant_id = %s AND status = 'delivered'",
            (merchant_id,), fetch_one=True
        )["t"]),
        "today_orders": execute_query(
            "SELECT COUNT(*) as c FROM orders WHERE merchant_id = %s AND DATE(created_date) = CURDATE()",
            (merchant_id,), fetch_one=True
        )["c"],
    }


def get_platform_stats() -> dict:
    """Get platform-wide statistics for super admin."""
    return {
        "total_users": execute_query("SELECT COUNT(*) as c FROM users", fetch_one=True)["c"],
        "total_merchants": execute_query("SELECT COUNT(*) as c FROM merchants", fetch_one=True)["c"],
        "active_merchants": execute_query("SELECT COUNT(*) as c FROM merchants WHERE status = 'active'", fetch_one=True)["c"],
        "pending_merchants": execute_query("SELECT COUNT(*) as c FROM merchants WHERE status = 'pending'", fetch_one=True)["c"],
        "total_products": execute_query("SELECT COUNT(*) as c FROM products WHERE is_active = TRUE", fetch_one=True)["c"],
        "total_orders": execute_query("SELECT COUNT(*) as c FROM orders", fetch_one=True)["c"],
        "total_revenue": float(execute_query(
            "SELECT COALESCE(SUM(final_amount), 0) as t FROM orders WHERE status = 'delivered'",
            fetch_one=True
        )["t"]),
        "today_orders": execute_query(
            "SELECT COUNT(*) as c FROM orders WHERE DATE(created_date) = CURDATE()",
            fetch_one=True
        )["c"],
    }
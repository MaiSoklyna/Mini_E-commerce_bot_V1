from telegram import Update
from telegram.ext import ContextTypes
from app.database import execute_query
from bot.keyboards.inline import order_list_keyboard, order_detail_keyboard, back_to_menu_keyboard
import logging

logger = logging.getLogger(__name__)


async def my_orders(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show user's order history."""
    query = update.callback_query
    await query.answer()

    telegram_id = update.effective_user.id
    user = execute_query("SELECT id FROM users WHERE telegram_id = %s", (telegram_id,), fetch_one=True)
    if not user:
        await query.edit_message_text("Please /start first.", reply_markup=back_to_menu_keyboard())
        return

    orders = execute_query(
        """SELECT o.id, o.order_code, o.status, o.total, o.created_at, m.name AS merchant_name
           FROM orders o
           JOIN merchants m ON o.merchant_id = m.id
           WHERE o.user_id = %s
           ORDER BY o.created_at DESC
           LIMIT 20""",
        (user["id"],), fetch_all=True
    )

    if not orders:
        await query.edit_message_text(
            "📦 No orders yet!\n\nStart shopping to see your orders here.",
            reply_markup=back_to_menu_keyboard()
        )
        return

    await query.edit_message_text(
        "📦 **Your Orders**\nTap an order to see details:",
        parse_mode="Markdown",
        reply_markup=order_list_keyboard(orders)
    )


async def view_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show order details."""
    query = update.callback_query
    await query.answer()

    order_id = int(query.data.split("_")[1])

    order = execute_query(
        """SELECT o.id, o.order_code, o.status, o.payment_method, o.payment_status,
                  o.delivery_address, o.total, o.created_at, m.name AS merchant_name
           FROM orders o
           JOIN merchants m ON o.merchant_id = m.id
           WHERE o.id = %s""",
        (order_id,), fetch_one=True
    )

    if not order:
        await query.edit_message_text("Order not found.", reply_markup=back_to_menu_keyboard())
        return

    items = execute_query(
        """SELECT oi.product_name, oi.quantity, oi.subtotal
           FROM order_items oi
           WHERE oi.order_id = %s""",
        (order_id,), fetch_all=True
    )

    status_emoji = {
        "pending": "⏳ Pending",
        "confirmed": "✅ Confirmed",
        "preparing": "👨‍🍳 Preparing",
        "shipped": "🚚 Shipped",
        "delivered": "📦 Delivered",
        "cancelled": "❌ Cancelled"
    }.get(order["status"], order["status"])

    text = f"📦 **Order {order['order_code']}**\n\n"
    text += f"🏪 {order['merchant_name']}\n"
    text += f"📊 Status: {status_emoji}\n"
    text += f"💳 Payment: {order['payment_method'].upper()} ({order['payment_status']})\n"
    text += f"📍 Delivery: {order.get('delivery_address', 'N/A')}\n\n"

    text += "**Items:**\n"
    for item in items:
        text += f"• {item['product_name']} x{item['quantity']} — ${float(item['subtotal']):.2f}\n"

    text += f"\n💰 **Total: ${float(order['total']):.2f}**\n"
    text += f"📅 Ordered: {order['created_at'].strftime('%Y-%m-%d %H:%M') if order.get('created_at') else 'N/A'}"

    await query.edit_message_text(
        text,
        parse_mode="Markdown",
        reply_markup=order_detail_keyboard(order_id, order["status"])
    )


async def cancel_order(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel a pending order."""
    query = update.callback_query
    await query.answer()

    order_id = int(query.data.split("_")[2])

    order = execute_query("SELECT id, order_code, status FROM orders WHERE id = %s", (order_id,), fetch_one=True)
    if not order:
        await query.answer("Order not found!", show_alert=True)
        return
    if order["status"] != "pending":
        await query.answer("Can only cancel pending orders!", show_alert=True)
        return

    # Restore stock
    items = execute_query("SELECT product_id, quantity FROM order_items WHERE order_id = %s", (order_id,), fetch_all=True)
    for item in items:
        execute_query(
            "UPDATE products SET stock = stock + %s WHERE id = %s",
            (item["quantity"], item["product_id"]), commit=True
        )

    execute_query(
        "UPDATE orders SET status = 'cancelled', payment_status = 'refunded' WHERE id = %s",
        (order_id,), commit=True
    )

    await query.edit_message_text(
        f"❌ **Order {order['order_code']} Cancelled**\n\nStock has been restored.",
        parse_mode="Markdown",
        reply_markup=back_to_menu_keyboard()
    )
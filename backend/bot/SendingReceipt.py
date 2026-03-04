"""
Telegram Receipt Sender
Sends formatted order receipts to customers via Telegram when orders are delivered.
"""

import logging
from datetime import datetime
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from app.database import execute_query
from app.config import settings

logger = logging.getLogger(__name__)


async def send_receipt_to_customer(bot, order_id: int):
    """
    Fetch order details and send formatted receipt via Telegram.
    Called after order status changes to 'delivered'.

    Args:
        bot: Telegram bot instance
        order_id: Order ID to send receipt for
    """
    try:
        # Fetch order with user and merchant details
        order_query = """
            SELECT
                o.id, o.order_code, o.subtotal, o.discount_amount, o.delivery_fee, o.total,
                o.payment_method, o.payment_status,
                o.delivery_address, o.delivery_name, o.delivery_phone, o.delivery_province,
                o.created_at, o.updated_at,
                u.telegram_id, u.name as customer_name, u.username as customer_username,
                m.name as merchant_name, m.phone as merchant_phone
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN merchants m ON o.merchant_id = m.id
            WHERE o.id = %s
        """

        order = execute_query(order_query, (order_id,), fetch_one=True)

        if not order:
            logger.error(f"Order {order_id} not found for receipt")
            return False

        if not order['telegram_id']:
            logger.warning(f"Order {order_id} has no Telegram ID for customer")
            return False

        # Fetch order items
        items_query = """
            SELECT
                oi.quantity, oi.unit_price, oi.subtotal,
                oi.product_name, oi.selected_variants
            FROM order_items oi
            WHERE oi.order_id = %s
            ORDER BY oi.id
        """

        items = execute_query(items_query, (order_id,), fetch_all=True) or []

        if not items:
            logger.warning(f"Order {order_id} has no items")
            return False

        # Build items text
        items_text = []
        for item in items:
            variant_text = ""
            if item['selected_variants']:
                try:
                    import json
                    variants = json.loads(item['selected_variants']) if isinstance(item['selected_variants'], str) else item['selected_variants']
                    if variants:
                        variant_text = f" ({', '.join([f'{k}: {v}' for k, v in variants.items()])})"
                except:
                    pass

            items_text.append(
                f"  • {item['product_name']}{variant_text}\n"
                f"    {item['quantity']} x ${float(item['unit_price']):.2f} = ${float(item['subtotal']):.2f}"
            )

        items_section = "\n".join(items_text)

        # Format dates
        order_date = order['created_at']
        if isinstance(order_date, str):
            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
        date_str = order_date.strftime('%b %d, %Y at %I:%M %p')

        # Build receipt message
        receipt = f"""
🧾 **DELIVERY RECEIPT / វិក្កយបត្រ**
━━━━━━━━━━━━━━━━━━━━━

📋 **Order:** {order['order_code'] or f"#{order['id']:04d}"}
🏪 **Shop:** {order['merchant_name']}
📅 **Date:** {date_str}

**Items:**
{items_section}

━━━━━━━━━━━━━━━━━━━━━
**Order Summary:**
  Subtotal: ${float(order['subtotal']):.2f}
"""

        if order['discount_amount'] and float(order['discount_amount']) > 0:
            receipt += f"  Discount: -${float(order['discount_amount']):.2f}\n"

        if order['delivery_fee'] and float(order['delivery_fee']) > 0:
            receipt += f"  Delivery: ${float(order['delivery_fee']):.2f}\n"
        else:
            receipt += "  Delivery: FREE\n"

        receipt += f"""
━━━━━━━━━━━━━━━━━━━━━
💰 **TOTAL: ${float(order['total']):.2f}**
💳 Payment: {order['payment_method'].upper()}
📦 Status: {order['payment_status'].upper()}

**Delivered to:**
👤 {order['delivery_name']}
📞 {order['delivery_phone']}
📍 {order['delivery_address']}
{f"   {order['delivery_province']}" if order.get('delivery_province') else ""}

━━━━━━━━━━━━━━━━━━━━━
✅ **Order Delivered Successfully!**

Thank you for shopping with us! 🛍️
We hope you enjoyed your purchase.
"""

        # Create inline keyboard with review button
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton(
                    "⭐ Write a Review",
                    url=f"{settings.WEB_APP_URL}/order/{order['id']}"
                )
            ],
            [
                InlineKeyboardButton(
                    "🛍️ Shop Again",
                    url=f"{settings.WEB_APP_URL}"
                )
            ],
            [
                InlineKeyboardButton(
                    "💬 Contact Support",
                    callback_data="support"
                )
            ]
        ])

        # Send receipt to customer
        await bot.send_message(
            chat_id=order['telegram_id'],
            text=receipt,
            parse_mode='Markdown',
            reply_markup=keyboard
        )

        logger.info(f"Receipt sent successfully for order {order_id} to user {order['telegram_id']}")

        # Update order to mark receipt as sent
        execute_query(
            "UPDATE orders SET receipt_sent_at = NOW() WHERE id = %s",
            (order_id,),
            commit=True
        )

        return True

    except Exception as e:
        logger.error(f"Failed to send receipt for order {order_id}: {str(e)}", exc_info=True)
        return False


async def send_receipt_for_multiple_orders(bot, order_ids: list):
    """
    Send receipts for multiple orders (batch processing)

    Args:
        bot: Telegram bot instance
        order_ids: List of order IDs

    Returns:
        dict: Success/failure counts
    """
    results = {
        'success': 0,
        'failed': 0,
        'errors': []
    }

    for order_id in order_ids:
        try:
            success = await send_receipt_to_customer(bot, order_id)
            if success:
                results['success'] += 1
            else:
                results['failed'] += 1
                results['errors'].append(f"Order {order_id}: Receipt sending failed")
        except Exception as e:
            results['failed'] += 1
            results['errors'].append(f"Order {order_id}: {str(e)}")

    return results

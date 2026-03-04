from telegram import Update
from telegram.ext import ContextTypes
from app.database import execute_query
from bot.keyboards.inline import back_to_menu_keyboard
import logging

logger = logging.getLogger(__name__)


async def my_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show user profile."""
    query = update.callback_query
    await query.answer()

    telegram_id = update.effective_user.id
    user = execute_query(
        "SELECT id, telegram_id, username, first_name, last_name, phone, address, created_at FROM users WHERE telegram_id = %s",
        (telegram_id,), fetch_one=True
    )
    if not user:
        await query.edit_message_text("Please /start first.", reply_markup=back_to_menu_keyboard())
        return

    order_count = execute_query(
        "SELECT COUNT(*) as c FROM orders WHERE user_id = %s", (user["id"],), fetch_one=True
    )["c"]

    text = f"👤 **Your Profile**\n\n"
    text += f"🆔 Username: @{user.get('username', 'N/A')}\n"
    text += f"📱 Telegram ID: `{user['telegram_id']}`\n"

    name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
    if name:
        text += f"📛 Name: {name}\n"
    if user.get("phone"):
        text += f"📞 Phone: {user['phone']}\n"
    if user.get("address"):
        text += f"📍 Address: {user['address']}\n"

    text += f"\n📦 Total Orders: {order_count}\n"
    text += f"📅 Joined: {user['created_at'].strftime('%Y-%m-%d') if user.get('created_at') else 'N/A'}"

    await query.edit_message_text(text, parse_mode="Markdown", reply_markup=back_to_menu_keyboard())


async def support(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show support info."""
    query = update.callback_query
    await query.answer()

    text = (
        "📞 **Customer Support**\n\n"
        "Need help? Here's how to reach us:\n\n"
        "💬 Send your question directly in this chat\n"
        "📧 Or contact us at support@favouriteofshop.com\n\n"
        "Our team will respond as soon as possible!"
    )

    await query.edit_message_text(text, parse_mode="Markdown", reply_markup=back_to_menu_keyboard())
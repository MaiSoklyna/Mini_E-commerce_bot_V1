from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ContextTypes
from app.database import execute_query
from app.utils.security import create_access_token
from app.config import settings
import logging

logger = logging.getLogger(__name__)

_USER_COLS = "id, telegram_id, username, first_name, last_name, phone, email, language, address, is_active"


def _is_https(url: str) -> bool:
    return url.startswith("https://")


def _build_menu_keyboard(miniapp_url: str) -> InlineKeyboardMarkup:
    """Build inline keyboard. Uses WebAppInfo for HTTPS, regular url for HTTPS links."""
    if _is_https(miniapp_url):
        shop_button = InlineKeyboardButton(
            "🛍️ Open Shop",
            web_app=WebAppInfo(url=miniapp_url),
        )
    else:
        # HTTPS required for inline buttons — use web_app with https fallback
        # For local dev, we'll skip the shop button and include URL in text
        shop_button = None

    rows = []
    if shop_button:
        rows.append([shop_button])
    rows.append([
        InlineKeyboardButton("📦 My Orders", callback_data="my_orders"),
        InlineKeyboardButton("🛒 My Cart", callback_data="view_cart"),
    ])
    rows.append([
        InlineKeyboardButton("👤 My Profile", callback_data="my_profile"),
        InlineKeyboardButton("📞 Support", callback_data="support"),
    ])
    return InlineKeyboardMarkup(rows)


def _make_token(user_id: int) -> str:
    return create_access_token({"sub": str(user_id), "role": "customer"})


def _upsert_user(telegram_id, username, first_name, last_name):
    """Get or create user, returns (db_user_dict, is_new)."""
    db_user = execute_query(
        f"SELECT {_USER_COLS} FROM users WHERE telegram_id = %s",
        (telegram_id,), fetch_one=True,
    )
    if db_user:
        return db_user, False

    new_id = execute_query(
        "INSERT INTO users (telegram_id, username, first_name, last_name) VALUES (%s, %s, %s, %s)",
        (telegram_id, username, first_name, last_name), commit=True,
    )
    return {"id": new_id, "telegram_id": telegram_id, "username": username,
            "first_name": first_name, "last_name": last_name}, True


def _complete_login_session(session_id: str, user_id: int, token: str):
    """Mark a login_sessions row as completed with the JWT."""
    execute_query(
        "UPDATE login_sessions SET jwt_token=%s, user_id=%s, status='completed' "
        "WHERE session_id=%s AND status='pending'",
        (token, user_id, session_id), commit=True,
    )


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start — upsert user, optionally complete a browser login session."""
    tg_user = update.effective_user
    telegram_id = tg_user.id
    username   = tg_user.username or f"user_{telegram_id}"
    first_name = tg_user.first_name or ""
    last_name  = tg_user.last_name  or ""

    db_user, is_new = _upsert_user(telegram_id, username, first_name, last_name)
    token = _make_token(db_user["id"])

    # --- deep-link: /start SESSION_ID (browser login) ---
    session_id = context.args[0] if context.args else None

    if session_id and session_id.startswith("dash_"):
        # ── Dashboard login (merchant admin) ──
        merchant_admin = execute_query(
            "SELECT ma.id, ma.merchant_id, ma.full_name, ma.email, ma.role, ma.is_active, "
            "m.name AS merchant_name "
            "FROM merchant_admins ma LEFT JOIN merchants m ON ma.merchant_id = m.id "
            "WHERE ma.telegram_id = %s",
            (telegram_id,), fetch_one=True,
        )
        if merchant_admin and merchant_admin["is_active"]:
            dash_token = create_access_token({
                "sub": str(merchant_admin["id"]),
                "role": "merchant",
                "merchant_id": merchant_admin["merchant_id"],
                "email": merchant_admin["email"],
            })
            _complete_login_session(session_id, merchant_admin["id"], dash_token)
            await update.message.reply_text(
                f"👋 Hello, <b>{merchant_admin['full_name']}</b>!\n\n"
                "✅ You're now logged in — go back to your dashboard.",
                parse_mode="HTML",
            )
        else:
            await update.message.reply_text(
                "⚠️ No merchant account is linked to this Telegram ID.\n\n"
                "Please contact your administrator or log in with email/password.",
                parse_mode="HTML",
            )
        return

    if session_id:
        # ── Miniapp customer login ──
        _complete_login_session(session_id, db_user["id"], token)

        if is_new:
            text = (
                f"🎉 Welcome to <b>Favourite of Shop</b>, {first_name or 'friend'}!\n\n"
                "✅ You're now logged in — go back to your browser to start shopping!"
            )
        else:
            text = (
                f"👋 Welcome back, {first_name or 'friend'}!\n\n"
                "✅ You're now logged in — go back to your browser."
            )
        await update.message.reply_text(text, parse_mode="HTML")
        return

    # --- regular /start (no session) — show Open Shop button ---
    miniapp_url = f"{settings.WEB_APP_URL}?auth={token}"

    if is_new:
        welcome_text = (
            f"🎉 Welcome to <b>Favourite of Shop</b>, {first_name or 'friend'}!\n\n"
            f"Your account is ready."
        )
    else:
        welcome_text = f"👋 Welcome back, {first_name or 'friend'}!"

    if _is_https(miniapp_url):
        welcome_text += "\n\nTap <b>Open Shop</b> below to start shopping!"
    else:
        welcome_text += f'\n\n🛍️ <a href="{miniapp_url}">Open Shop</a>'

    await update.message.reply_text(
        welcome_text,
        parse_mode="HTML",
        reply_markup=_build_menu_keyboard(miniapp_url),
        disable_web_page_preview=True,
    )


async def main_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Regenerate miniapp link and show main menu."""
    query = update.callback_query
    await query.answer()

    tg_user = update.effective_user
    db_user = execute_query(
        "SELECT id FROM users WHERE telegram_id = %s", (tg_user.id,), fetch_one=True
    )
    miniapp_url = (
        f"{settings.WEB_APP_URL}?auth={_make_token(db_user['id'])}"
        if db_user else settings.WEB_APP_URL
    )

    text = f"👋 Hey {tg_user.first_name}! What would you like to do?"
    if not _is_https(miniapp_url):
        text += f'\n\n🛍️ <a href="{miniapp_url}">Open Shop</a>'

    await query.edit_message_text(
        text,
        parse_mode="HTML",
        reply_markup=_build_menu_keyboard(miniapp_url),
        disable_web_page_preview=True,
    )

"""
Authentication service — handles user registration, login, and Telegram auth logic.
Used by both API routes and Telegram bot handlers.
"""
from typing import Optional
from app.database import execute_query
from app.utils.security import hash_password, verify_password, create_access_token
import logging

logger = logging.getLogger(__name__)


def get_user_by_telegram_id(telegram_id: int) -> Optional[dict]:
    """Find a user by their Telegram ID."""
    return execute_query(
        "SELECT * FROM users WHERE telegram_id = %s",
        (telegram_id,), fetch_one=True
    )


def get_user_by_id(user_id: int) -> Optional[dict]:
    """Find a user by their database user_id."""
    return execute_query(
        "SELECT * FROM users WHERE user_id = %s",
        (user_id,), fetch_one=True
    )


def get_user_by_username(username: str) -> Optional[dict]:
    """Find a user by their username."""
    return execute_query(
        "SELECT * FROM users WHERE username = %s",
        (username,), fetch_one=True
    )


def register_telegram_user(telegram_id: int, username: str = None, first_name: str = None, last_name: str = None) -> dict:
    """
    Register a new user coming from Telegram.
    If user already exists, return existing user.
    """
    # Check if already exists
    existing = get_user_by_telegram_id(telegram_id)
    if existing:
        return existing

    # Create user
    display_username = username or f"user_{telegram_id}"
    user_id = execute_query(
        """INSERT INTO users (telegram_id, username, role, is_verified)
           VALUES (%s, %s, 'customer', TRUE)""",
        (telegram_id, display_username), commit=True
    )

    # Create profile
    execute_query(
        "INSERT INTO profiles (user_id, first_name, last_name) VALUES (%s, %s, %s)",
        (user_id, first_name, last_name), commit=True
    )

    logger.info(f"New user registered: {display_username} (telegram_id: {telegram_id})")
    return get_user_by_id(user_id)


def register_web_user(username: str, password: str, email: str = None, phone: str = None) -> dict:
    """Register a new user via web (dashboard registration)."""
    # Check duplicates
    if get_user_by_username(username):
        raise ValueError("Username already exists")
    if email:
        existing_email = execute_query("SELECT user_id FROM users WHERE email = %s", (email,), fetch_one=True)
        if existing_email:
            raise ValueError("Email already exists")

    hashed = hash_password(password)
    user_id = execute_query(
        """INSERT INTO users (username, email, password_hash, phone_number, role, is_verified)
           VALUES (%s, %s, %s, %s, 'customer', FALSE)""",
        (username, email, hashed, phone), commit=True
    )

    execute_query("INSERT INTO profiles (user_id) VALUES (%s)", (user_id,), commit=True)
    return get_user_by_id(user_id)


def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Authenticate user with username and password. Returns user dict or None."""
    user = get_user_by_username(username)
    if not user or not user.get("password_hash"):
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return user


def create_token_for_user(user: dict) -> str:
    """Generate a JWT token for a user."""
    return create_access_token({
        "user_id": user["user_id"],
        "role": user["role"],
    })


def get_user_profile(user_id: int) -> Optional[dict]:
    """Get user profile with merged user + profile data."""
    result = execute_query(
        """SELECT u.user_id, u.telegram_id, u.username, u.email, u.phone_number,
                  u.role, u.is_verified, u.created_date,
                  p.first_name, p.last_name, p.delivery_address, p.city, p.postal_code
           FROM users u
           LEFT JOIN profiles p ON u.user_id = p.user_id
           WHERE u.user_id = %s""",
        (user_id,), fetch_one=True
    )
    return result


def update_user_profile(user_id: int, **kwargs) -> bool:
    """Update user profile fields."""
    user_fields = {"phone_number", "email"}
    profile_fields = {"first_name", "last_name", "delivery_address", "city", "postal_code"}

    # Update users table
    user_updates = {k: v for k, v in kwargs.items() if k in user_fields and v is not None}
    if user_updates:
        sets = ", ".join(f"{k} = %s" for k in user_updates)
        vals = list(user_updates.values()) + [user_id]
        execute_query(f"UPDATE users SET {sets} WHERE user_id = %s", tuple(vals), commit=True)

    # Update profiles table
    profile_updates = {k: v for k, v in kwargs.items() if k in profile_fields and v is not None}
    if profile_updates:
        sets = ", ".join(f"{k} = %s" for k in profile_updates)
        vals = list(profile_updates.values()) + [user_id]
        execute_query(f"UPDATE profiles SET {sets} WHERE user_id = %s", tuple(vals), commit=True)

    return True


def is_admin(user: dict) -> bool:
    """Check if user has admin role."""
    return user.get("role") == "admin"


def is_merchant(user: dict) -> bool:
    """Check if user has merchant or admin role."""
    return user.get("role") in ("merchant", "admin")
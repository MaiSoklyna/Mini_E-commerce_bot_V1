"""Security utilities — MiniShopBot v2.
Tables: users, merchant_admins, super_admins
JWT payload: sub=str(id), role=customer|merchant|super_admin, merchant_id (merchant only)
"""
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import execute_query
import logging

logger = logging.getLogger(__name__)
security = HTTPBearer()


# ── Password helpers ──────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT helpers ───────────────────────────────────────────────────

def create_access_token(data: dict, expires_minutes: int = None) -> str:
    minutes = expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({**data, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Customer (Telegram bot user) ──────────────────────────────────

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Validate customer JWT and return user row from `users` table."""
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Customer token required")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = execute_query(
        "SELECT id, telegram_id, username, first_name, last_name, phone, email, language, address, is_active "
        "FROM users WHERE id = %s",
        (int(user_id),), fetch_one=True,
    )
    if not user or not user["is_active"]:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


# ── Merchant Admin ────────────────────────────────────────────────

def get_current_merchant_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Validate merchant JWT and return row from `merchant_admins`."""
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "merchant":
        raise HTTPException(status_code=403, detail="Merchant token required")
    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    admin = execute_query(
        "SELECT id, merchant_id, full_name, email, role, is_active "
        "FROM merchant_admins WHERE id = %s",
        (int(admin_id),), fetch_one=True,
    )
    if not admin or not admin["is_active"]:
        raise HTTPException(status_code=401, detail="Admin not found or inactive")
    admin["token_role"] = "merchant"
    return admin


# ── Super Admin ───────────────────────────────────────────────────

def get_current_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Validate super-admin JWT and return row from `super_admins`."""
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin token required")
    admin_id = payload.get("sub")
    if not admin_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    admin = execute_query(
        "SELECT id, full_name, email, is_active FROM super_admins WHERE id = %s",
        (int(admin_id),), fetch_one=True,
    )
    if not admin or not admin["is_active"]:
        raise HTTPException(status_code=401, detail="Super admin not found or inactive")
    admin["token_role"] = "super_admin"
    admin["merchant_id"] = None
    return admin


# ── Unified admin (merchant OR super_admin) ───────────────────────

def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Accept both merchant and super_admin tokens."""
    payload = decode_token(credentials.credentials)
    role = payload.get("role")
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    if role == "super_admin":
        admin = execute_query(
            "SELECT id, full_name, email, is_active FROM super_admins WHERE id = %s",
            (int(sub),), fetch_one=True,
        )
        if not admin or not admin["is_active"]:
            raise HTTPException(status_code=401, detail="Super admin not found or inactive")
        admin["token_role"] = "super_admin"
        admin["merchant_id"] = None
        return admin

    if role == "merchant":
        admin = execute_query(
            "SELECT id, merchant_id, full_name, email, role, is_active "
            "FROM merchant_admins WHERE id = %s",
            (int(sub),), fetch_one=True,
        )
        if not admin or not admin["is_active"]:
            raise HTTPException(status_code=401, detail="Merchant admin not found or inactive")
        admin["token_role"] = "merchant"
        return admin

    raise HTTPException(status_code=403, detail="Invalid role in token")


def require_super_admin(admin: dict = Depends(get_current_admin)) -> dict:
    if admin.get("token_role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return admin


def get_merchant_filter(admin: dict) -> int | None:
    """Return merchant_id for scoped queries; None = super_admin (sees all)."""
    if admin.get("token_role") == "super_admin":
        return None
    return admin.get("merchant_id")

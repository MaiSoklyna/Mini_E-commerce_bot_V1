from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserRegister(BaseModel):
    username: str
    email: Optional[str] = None
    password: str
    phone_number: Optional[str] = None
    telegram_id: Optional[int] = None


class UserLogin(BaseModel):
    username: str
    password: str


class ProfileUpdate(BaseModel):
    phone_number: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_province: Optional[str] = None
    bio: Optional[str] = None


class TelegramAuth(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    language: Optional[str] = "en"


class UserUpdate(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    telegram_id: int
    username: Optional[str] = None
    first_name: str
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    language: str
    address: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None


# ── Admin login schemas ────────────────────────────────────────────

class AdminLogin(BaseModel):
    email: str
    password: str
    role: str = "merchant"  # "merchant" | "super_admin"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: int = 3600
    token_type: str = "bearer"
    user: dict


class MerchantAdminResponse(BaseModel):
    id: int
    merchant_id: int
    full_name: str
    email: str
    role: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None


class SuperAdminResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

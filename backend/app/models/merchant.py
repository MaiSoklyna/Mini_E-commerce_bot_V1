from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MerchantCreate(BaseModel):
    name: str
    slug: str
    owner_name: str
    email: str
    phone: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    story: Optional[str] = None
    location: Optional[str] = None
    icon_emoji: Optional[str] = None
    accent_color: Optional[str] = None
    plan: Optional[str] = "Basic"
    telegram_token: Optional[str] = None
    deep_link_code: Optional[str] = None
    fb_page: Optional[str] = None
    instagram: Optional[str] = None


class MerchantUpdate(BaseModel):
    name: Optional[str] = None
    owner_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    story: Optional[str] = None
    location: Optional[str] = None
    icon_emoji: Optional[str] = None
    accent_color: Optional[str] = None
    plan: Optional[str] = None
    telegram_token: Optional[str] = None
    deep_link_code: Optional[str] = None
    status: Optional[str] = None
    fb_page: Optional[str] = None
    instagram: Optional[str] = None


class MerchantResponse(BaseModel):
    id: int
    name: str
    slug: str
    owner_name: str
    email: str
    phone: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    story: Optional[str] = None
    location: Optional[str] = None
    icon_emoji: Optional[str] = None
    accent_color: Optional[str] = None
    plan: str
    deep_link_code: Optional[str] = None
    status: str
    fb_page: Optional[str] = None
    instagram: Optional[str] = None
    product_count: Optional[int] = 0
    order_count: Optional[int] = 0
    created_at: Optional[datetime] = None


class MerchantAdminCreate(BaseModel):
    merchant_id: int
    full_name: str
    email: str
    password: str
    role: str = "staff"

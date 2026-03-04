from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SelectedVariant(BaseModel):
    variant_id: int
    option_id: int
    group_name: str
    label: str


class CartItemAdd(BaseModel):
    product_id: int
    quantity: int = 1
    selected_variants: Optional[List[SelectedVariant]] = []


class CartItemUpdate(BaseModel):
    quantity: int


class CartItemResponse(BaseModel):
    id: int
    cart_id: int
    product_id: int
    quantity: int
    selected_variants: Optional[list] = None
    unit_price: float
    line_total: float
    product_name: Optional[str] = None
    icon_emoji: Optional[str] = None
    merchant_name: Optional[str] = None
    primary_image: Optional[str] = None
    created_at: Optional[datetime] = None


class CartSummary(BaseModel):
    item_count: int
    subtotal: float
    items: List[CartItemResponse] = []

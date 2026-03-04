from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OrderCreate(BaseModel):
    merchant_id: int
    delivery_address: str
    delivery_province: Optional[str] = None
    payment_method: str = "cod"          # khqr | cod | aba | wing
    promo_code: Optional[str] = None
    customer_note: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str                          # confirmed | shipped | delivered | cancelled
    admin_note: Optional[str] = None
    payment_status: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: str
    product_sku: Optional[str] = None
    selected_variants: Optional[list] = None
    quantity: int
    unit_price: float
    subtotal: float


class OrderResponse(BaseModel):
    id: int
    order_code: str
    merchant_id: int
    merchant_name: Optional[str] = None
    user_id: int
    subtotal: float
    discount_amount: float
    delivery_fee: float
    total: float
    status: str
    payment_method: str
    payment_status: str
    delivery_address: str
    delivery_province: Optional[str] = None
    customer_note: Optional[str] = None
    admin_note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: Optional[List[OrderItemResponse]] = None


class PromoValidate(BaseModel):
    code: str
    merchant_id: int
    cart_total: float

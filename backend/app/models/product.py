from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class VariantOptionCreate(BaseModel):
    label: str
    hex_color: Optional[str] = None
    price_adjust: float = 0.00
    stock_adjust: int = 0
    is_popular: bool = False
    sort_order: int = 0


class VariantGroupCreate(BaseModel):
    group_name: str
    type: str = "custom"   # size | color | weight | custom
    sort_order: int = 0
    options: List[VariantOptionCreate] = []


class ProductCreate(BaseModel):
    category_id: Optional[int] = None
    name: str
    slug: Optional[str] = None          # auto-generated from name if omitted
    description: Optional[str] = None
    sku: Optional[str] = None
    base_price: float
    compare_price: Optional[float] = None
    stock: int = 0
    weight: Optional[str] = None
    delivery_days: int = 3
    icon_emoji: Optional[str] = None
    is_featured: bool = False
    variants: Optional[List[VariantGroupCreate]] = []


class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    base_price: Optional[float] = None
    compare_price: Optional[float] = None
    stock: Optional[int] = None
    weight: Optional[str] = None
    delivery_days: Optional[int] = None
    icon_emoji: Optional[str] = None
    is_featured: Optional[bool] = None
    is_active: Optional[bool] = None


class VariantOptionResponse(BaseModel):
    id: int
    label: str
    hex_color: Optional[str] = None
    price_adjust: float
    stock_adjust: int
    is_popular: bool
    is_active: bool
    sort_order: int


class VariantGroupResponse(BaseModel):
    id: int
    group_name: str
    type: str
    sort_order: int
    options: List[VariantOptionResponse] = []


class ProductImageResponse(BaseModel):
    id: int
    url: str
    alt_text: Optional[str] = None
    sort_order: int


class ProductResponse(BaseModel):
    id: int
    merchant_id: int
    category_id: Optional[int] = None
    name: str
    slug: str
    description: Optional[str] = None
    sku: Optional[str] = None
    base_price: float
    compare_price: Optional[float] = None
    stock: int
    weight: Optional[str] = None
    delivery_days: int
    icon_emoji: Optional[str] = None
    rating_avg: float
    review_count: int
    is_active: bool
    is_featured: bool
    created_at: Optional[datetime] = None
    merchant_name: Optional[str] = None
    category_name: Optional[str] = None
    primary_image: Optional[str] = None
    images: Optional[List[ProductImageResponse]] = []
    variants: Optional[List[VariantGroupResponse]] = []


class CategoryCreate(BaseModel):
    name: str
    name_kh: Optional[str] = None
    icon_emoji: Optional[str] = None
    sort_order: int = 0


class CategoryResponse(BaseModel):
    id: int
    merchant_id: Optional[int] = None
    name: str
    name_kh: Optional[str] = None
    icon_emoji: Optional[str] = None
    sort_order: int
    is_active: bool
    product_count: Optional[int] = 0

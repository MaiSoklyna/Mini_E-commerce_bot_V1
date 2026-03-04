from pydantic import BaseModel, Field
from typing import Optional


class TicketCreate(BaseModel):
    merchant_id: int
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=5, max_length=2000)
    order_id: Optional[int] = None


class TicketReply(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

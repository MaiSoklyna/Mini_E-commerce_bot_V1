"""
Reviews API — customer endpoints
Tables: reviews, products, orders, order_items
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from app.database import execute_query
from app.utils.security import get_current_user

router = APIRouter(prefix="/reviews", tags=["Reviews"])


class ReviewCreate(BaseModel):
    product_id: int
    order_id: int
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: str | None = Field(None, max_length=1000)


@router.post("/")
async def create_review(body: ReviewCreate, user: dict = Depends(get_current_user)):
    """Submit a product review (only for delivered orders)."""
    user_id = user["id"]

    # Check order exists and belongs to user
    order = execute_query(
        "SELECT id, status FROM orders WHERE id = %s AND user_id = %s",
        (body.order_id, user_id), fetch_one=True,
    )
    if not order:
        raise HTTPException(status_code=404, detail="ORDER_NOT_FOUND")

    # Check order status is delivered
    if order["status"] != "delivered":
        raise HTTPException(
            status_code=422,
            detail="REVIEW_NOT_ALLOWED: Can only review delivered orders"
        )

    # Check product was in this order
    order_item = execute_query(
        "SELECT id FROM order_items WHERE order_id = %s AND product_id = %s",
        (body.order_id, body.product_id), fetch_one=True,
    )
    if not order_item:
        raise HTTPException(
            status_code=404,
            detail="PRODUCT_NOT_IN_ORDER: This product was not in your order"
        )

    # Check no existing review for this order+product
    existing = execute_query(
        "SELECT id FROM reviews WHERE order_id = %s AND product_id = %s AND user_id = %s",
        (body.order_id, body.product_id, user_id), fetch_one=True,
    )
    if existing:
        raise HTTPException(
            status_code=422,
            detail="REVIEW_ALREADY_EXISTS: You have already reviewed this product"
        )

    # Insert review
    review_id = execute_query(
        "INSERT INTO reviews (product_id, user_id, order_id, rating, comment) "
        "VALUES (%s, %s, %s, %s, %s)",
        (body.product_id, user_id, body.order_id, body.rating, body.comment),
        commit=True,
    )

    # Update product rating stats
    stats = execute_query(
        "SELECT AVG(rating) as avg_rating, COUNT(*) as review_count "
        "FROM reviews WHERE product_id = %s AND is_visible = TRUE",
        (body.product_id,), fetch_one=True,
    )
    if stats:
        execute_query(
            "UPDATE products SET rating_avg = %s, review_count = %s WHERE id = %s",
            (round(float(stats["avg_rating"]), 2), stats["review_count"], body.product_id),
            commit=True,
        )

    # Get created review
    review = execute_query(
        "SELECT id, rating, comment, created_at FROM reviews WHERE id = %s",
        (review_id,), fetch_one=True,
    )

    return {
        "success": True,
        "data": review,
        "message": "Review submitted successfully",
    }

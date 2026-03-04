"""
Products API — public & bot endpoints
Table: products (id, merchant_id, category_id, name, slug, base_price, stock, ...)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.database import execute_query

router = APIRouter(prefix="/products", tags=["Products"])


def _attach_variants(product: dict) -> None:
    """Attach variant groups + options to a product dict in-place."""
    groups = execute_query(
        "SELECT id, group_name, type, sort_order FROM product_variants "
        "WHERE product_id = %s ORDER BY sort_order",
        (product["id"],), fetch_all=True,
    ) or []
    for g in groups:
        g["options"] = execute_query(
            "SELECT id, label, hex_color, price_adjust, stock_adjust, is_popular, is_active, sort_order "
            "FROM product_variant_options WHERE variant_id = %s AND is_active = TRUE ORDER BY sort_order",
            (g["id"],), fetch_all=True,
        ) or []
    product["variants"] = groups


def _attach_primary_image(product: dict) -> None:
    img = execute_query(
        "SELECT url FROM product_images WHERE product_id = %s ORDER BY sort_order LIMIT 1",
        (product["id"],), fetch_one=True,
    )
    product["primary_image"] = img["url"] if img else None


@router.get("/")
async def list_products(
    merchant_id: Optional[int] = None,
    category_id: Optional[int] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    """List active products with optional filters."""
    where = ["p.is_active = TRUE", "m.status = 'active'"]
    params: list = []

    if merchant_id:
        where.append("p.merchant_id = %s")
        params.append(merchant_id)
    if category_id:
        where.append("p.category_id = %s")
        params.append(category_id)
    if featured is not None:
        where.append("p.is_featured = %s")
        params.append(featured)
    if search:
        where.append("(p.name LIKE %s OR p.description LIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])

    where_sql = " AND ".join(where)
    base = (
        "FROM products p "
        "JOIN merchants m ON p.merchant_id = m.id "
        "LEFT JOIN categories c ON p.category_id = c.id "
        f"WHERE {where_sql}"
    )

    total_row = execute_query(f"SELECT COUNT(*) AS total {base}", tuple(params), fetch_one=True)
    total = total_row["total"] if total_row else 0

    params.extend([limit, (page - 1) * limit])
    rows = execute_query(
        f"SELECT p.id, p.merchant_id, p.category_id, p.name, p.slug, p.sku, "
        f"p.base_price, p.compare_price, p.stock, p.weight, p.delivery_days, "
        f"p.icon_emoji, p.rating_avg, p.review_count, p.is_active, p.is_featured, "
        f"p.created_at, m.name AS merchant_name, c.name AS category_name "
        f"{base} ORDER BY p.created_at DESC LIMIT %s OFFSET %s",
        tuple(params), fetch_all=True,
    ) or []

    for p in rows:
        _attach_primary_image(p)

    return {
        "success": True,
        "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit if total else 0},
    }


@router.get("/featured")
async def get_featured(limit: int = Query(10, ge=1, le=50)):
    """Featured products for the home/bot landing page."""
    rows = execute_query(
        "SELECT p.id, p.merchant_id, p.name, p.slug, p.base_price, p.compare_price, "
        "p.stock, p.icon_emoji, p.rating_avg, p.review_count, p.delivery_days, "
        "m.name AS merchant_name, c.name AS category_name "
        "FROM products p "
        "JOIN merchants m ON p.merchant_id = m.id "
        "LEFT JOIN categories c ON p.category_id = c.id "
        "WHERE p.is_featured = TRUE AND p.is_active = TRUE AND m.status = 'active' "
        "ORDER BY p.created_at DESC LIMIT %s",
        (limit,), fetch_all=True,
    ) or []
    for p in rows:
        _attach_primary_image(p)
    return {"success": True, "data": rows}


@router.get("/categories")
async def list_categories():
    """All active categories with product counts."""
    rows = execute_query(
        "SELECT c.id, c.merchant_id, c.name, c.name_kh, c.icon_emoji, c.sort_order, "
        "COUNT(p.id) AS product_count "
        "FROM categories c "
        "LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE "
        "WHERE c.is_active = TRUE "
        "GROUP BY c.id ORDER BY c.sort_order, c.name",
        fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.get("/{product_id}")
async def get_product(product_id: int):
    """Full product detail including variants and images."""
    p = execute_query(
        "SELECT p.id, p.merchant_id, p.category_id, p.name, p.slug, p.description, "
        "p.sku, p.base_price, p.compare_price, p.stock, p.weight, p.delivery_days, "
        "p.icon_emoji, p.rating_avg, p.review_count, p.is_active, p.is_featured, "
        "p.created_at, p.updated_at, "
        "m.name AS merchant_name, m.slug AS merchant_slug, "
        "c.name AS category_name "
        "FROM products p "
        "JOIN merchants m ON p.merchant_id = m.id "
        "LEFT JOIN categories c ON p.category_id = c.id "
        "WHERE p.id = %s",
        (product_id,), fetch_one=True,
    )
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    # Images
    p["images"] = execute_query(
        "SELECT id, url, alt_text, sort_order FROM product_images "
        "WHERE product_id = %s ORDER BY sort_order",
        (product_id,), fetch_all=True,
    ) or []
    p["primary_image"] = p["images"][0]["url"] if p["images"] else None

    # Variants
    _attach_variants(p)

    # Reviews (latest 10)
    p["reviews"] = execute_query(
        "SELECT r.id, r.rating, r.comment, r.created_at, "
        "u.first_name, u.username "
        "FROM reviews r "
        "JOIN users u ON r.user_id = u.id "
        "WHERE r.product_id = %s AND r.is_visible = TRUE "
        "ORDER BY r.created_at DESC LIMIT 10",
        (product_id,), fetch_all=True,
    ) or []

    return {"success": True, "data": p}


@router.get("/{product_id}/reviews")
async def get_product_reviews(product_id: int):
    rows = execute_query(
        "SELECT r.id, r.rating, r.comment, r.created_at, "
        "u.first_name, u.username "
        "FROM reviews r "
        "JOIN users u ON r.user_id = u.id "
        "WHERE r.product_id = %s AND r.is_visible = TRUE "
        "ORDER BY r.created_at DESC",
        (product_id,), fetch_all=True,
    ) or []
    return {"success": True, "data": rows}

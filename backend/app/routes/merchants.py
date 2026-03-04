"""
Merchants API — public & bot endpoints
Table: merchants (id, name, slug, owner_name, email, phone, tagline, ...)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.database import execute_query

router = APIRouter(prefix="/merchants", tags=["Merchants"])


def _merchant_stats(merchant: dict) -> dict:
    stats = execute_query(
        "SELECT COUNT(*) AS product_count FROM products WHERE merchant_id = %s AND is_active = TRUE",
        (merchant["id"],), fetch_one=True,
    )
    orders = execute_query(
        "SELECT COUNT(*) AS order_count FROM orders WHERE merchant_id = %s",
        (merchant["id"],), fetch_one=True,
    )
    merchant["product_count"] = stats["product_count"] if stats else 0
    merchant["order_count"] = orders["order_count"] if orders else 0
    return merchant


@router.get("/")
async def list_merchants():
    """All active merchants."""
    rows = execute_query(
        "SELECT id, name, slug, owner_name, tagline, description, location, "
        "icon_emoji, accent_color, plan, status, fb_page, instagram, created_at "
        "FROM merchants WHERE status = 'active' ORDER BY name",
        fetch_all=True,
    ) or []
    for m in rows:
        _merchant_stats(m)
    return {"success": True, "data": rows}


@router.get("/search")
async def search_merchants(q: Optional[str] = Query(None)):
    where = "WHERE status = 'active'"
    params: list = []
    if q:
        where += " AND (name LIKE %s OR tagline LIKE %s OR location LIKE %s)"
        params.extend([f"%{q}%", f"%{q}%", f"%{q}%"])
    rows = execute_query(
        f"SELECT id, name, slug, owner_name, tagline, icon_emoji, accent_color, "
        f"plan, status, location {where} ORDER BY name",
        tuple(params), fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.get("/promos/active")
async def list_active_promos():
    """Public: return all active, non-expired promo codes with merchant info."""
    rows = execute_query(
        "SELECT pc.id, pc.merchant_id, pc.code, pc.type, pc.value, "
        "pc.min_order, pc.expires_at, "
        "m.name AS merchant_name "
        "FROM promo_codes pc "
        "JOIN merchants m ON pc.merchant_id = m.id "
        "WHERE pc.is_active = TRUE "
        "AND (pc.expires_at IS NULL OR pc.expires_at >= CURDATE()) "
        "AND (pc.max_uses IS NULL OR pc.used_count < pc.max_uses) "
        "AND m.status = 'active' "
        "ORDER BY pc.created_at DESC",
        fetch_all=True,
    ) or []
    for r in rows:
        if r.get("value"):
            r["value"] = float(r["value"])
        if r.get("min_order"):
            r["min_order"] = float(r["min_order"])
        if r.get("expires_at"):
            r["expires_at"] = str(r["expires_at"])
    return {"success": True, "data": rows}


@router.get("/by-slug/{slug}")
async def get_merchant_by_slug(slug: str):
    """Look up merchant by deep-link slug (used by Telegram bot)."""
    m = execute_query(
        "SELECT id, name, slug, owner_name, tagline, description, story, location, "
        "icon_emoji, accent_color, plan, status, fb_page, instagram, "
        "deep_link_code, created_at "
        "FROM merchants WHERE slug = %s",
        (slug,), fetch_one=True,
    )
    if not m:
        raise HTTPException(status_code=404, detail="Merchant not found")
    _merchant_stats(m)
    return {"success": True, "data": m}


@router.get("/{merchant_id}")
async def get_merchant(merchant_id: int):
    m = execute_query(
        "SELECT id, name, slug, owner_name, email, phone, tagline, description, story, "
        "location, icon_emoji, accent_color, plan, status, fb_page, instagram, "
        "deep_link_code, created_at "
        "FROM merchants WHERE id = %s",
        (merchant_id,), fetch_one=True,
    )
    if not m:
        raise HTTPException(status_code=404, detail="Merchant not found")
    _merchant_stats(m)
    return {"success": True, "data": m}


@router.get("/{merchant_id}/products")
async def get_merchant_products(
    merchant_id: int,
    category_id: Optional[int] = None,
    sort: Optional[str] = "newest",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    where = ["p.merchant_id = %s", "p.is_active = TRUE"]
    params: list = [merchant_id]
    if category_id:
        where.append("p.category_id = %s")
        params.append(category_id)

    order = {
        "price_asc":  "p.base_price ASC",
        "price_desc": "p.base_price DESC",
        "rating":     "p.rating_avg DESC",
        "newest":     "p.created_at DESC",
    }.get(sort, "p.created_at DESC")

    where_sql = " AND ".join(where)
    total_row = execute_query(
        f"SELECT COUNT(*) AS total FROM products p WHERE {where_sql}",
        tuple(params), fetch_one=True,
    )
    total = total_row["total"] if total_row else 0

    params.extend([limit, (page - 1) * limit])
    rows = execute_query(
        f"SELECT p.id, p.name, p.slug, p.base_price, p.compare_price, p.stock, "
        f"p.icon_emoji, p.rating_avg, p.review_count, p.delivery_days, p.is_featured, "
        f"c.name AS category_name "
        f"FROM products p "
        f"LEFT JOIN categories c ON p.category_id = c.id "
        f"WHERE {where_sql} ORDER BY {order} LIMIT %s OFFSET %s",
        tuple(params), fetch_all=True,
    ) or []

    for p in rows:
        img = execute_query(
            "SELECT url FROM product_images WHERE product_id = %s ORDER BY sort_order LIMIT 1",
            (p["id"],), fetch_one=True,
        )
        p["primary_image"] = img["url"] if img else None

    return {
        "success": True,
        "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit if total else 0},
    }


@router.get("/{merchant_id}/categories")
async def get_merchant_categories(merchant_id: int):
    """Global categories + merchant-specific categories."""
    rows = execute_query(
        "SELECT c.id, c.merchant_id, c.name, c.name_kh, c.icon_emoji, c.sort_order, "
        "COUNT(p.id) AS product_count "
        "FROM categories c "
        "LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE AND p.merchant_id = %s "
        "WHERE c.is_active = TRUE AND (c.merchant_id IS NULL OR c.merchant_id = %s) "
        "GROUP BY c.id ORDER BY c.sort_order",
        (merchant_id, merchant_id), fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.get("/{merchant_id}/reviews")
async def get_merchant_reviews(merchant_id: int):
    rows = execute_query(
        "SELECT r.id, r.rating, r.comment, r.created_at, "
        "p.name AS product_name, u.first_name, u.username "
        "FROM reviews r "
        "JOIN products p ON r.product_id = p.id "
        "JOIN users u ON r.user_id = u.id "
        "WHERE p.merchant_id = %s AND r.is_visible = TRUE "
        "ORDER BY r.created_at DESC LIMIT 50",
        (merchant_id,), fetch_all=True,
    ) or []
    return {"success": True, "data": rows}

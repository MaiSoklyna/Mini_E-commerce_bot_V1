"""
Categories API — public endpoints
Table: categories (id, merchant_id, name, name_kh, icon_emoji, sort_order)
"""
from fastapi import APIRouter, HTTPException
from app.database import execute_query

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("/")
async def get_categories():
    """All active categories (global + all merchant-specific)."""
    rows = execute_query(
        """SELECT c.id, c.merchant_id, c.name, c.name_kh, c.icon_emoji, c.sort_order,
                  COUNT(p.id) AS product_count
           FROM categories c
           LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
           WHERE c.is_active = TRUE
           GROUP BY c.id
           ORDER BY c.sort_order, c.name""",
        fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.get("/global")
async def get_global_categories():
    """Platform-level categories only (merchant_id IS NULL)."""
    rows = execute_query(
        """SELECT c.id, c.name, c.name_kh, c.icon_emoji, c.sort_order,
                  COUNT(p.id) AS product_count
           FROM categories c
           LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
           WHERE c.is_active = TRUE AND c.merchant_id IS NULL
           GROUP BY c.id
           ORDER BY c.sort_order""",
        fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.get("/{category_id}")
async def get_category(category_id: int):
    row = execute_query(
        "SELECT id, merchant_id, name, name_kh, icon_emoji, sort_order, is_active, created_at "
        "FROM categories WHERE id = %s",
        (category_id,), fetch_one=True,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"success": True, "data": row}

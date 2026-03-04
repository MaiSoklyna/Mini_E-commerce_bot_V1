"""
Product service — handles product CRUD, category management, and search.
Used by both API routes and Telegram bot handlers.
"""
from typing import Optional, List
from app.database import execute_query
import logging

logger = logging.getLogger(__name__)


# ==================== PRODUCTS ====================

def get_products(merchant_id: int = None, category_id: int = None, search: str = None,
                 page: int = 1, limit: int = 20, active_only: bool = True) -> List[dict]:
    """Get products with optional filters."""
    query = """
        SELECT p.*, m.merchant_name, pc.category_name
        FROM products p
        JOIN merchants m ON p.merchant_id = m.merchant_id
        LEFT JOIN product_categories pc ON p.category_id = pc.category_id
        WHERE p.deleted_date IS NULL AND m.status = 'active'
    """
    params = []

    if active_only:
        query += " AND p.is_active = TRUE"
    if merchant_id:
        query += " AND p.merchant_id = %s"
        params.append(merchant_id)
    if category_id:
        query += " AND p.category_id = %s"
        params.append(category_id)
    if search:
        query += " AND (p.product_name LIKE %s OR p.product_description LIKE %s)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY p.created_date DESC LIMIT %s OFFSET %s"
    params.extend([limit, (page - 1) * limit])

    products = execute_query(query, tuple(params), fetch_all=True)

    # Attach images
    for product in products:
        product["images"] = get_product_images(product["product_id"])

    return products


def get_product_by_id(product_id: int) -> Optional[dict]:
    """Get a single product with full details."""
    product = execute_query(
        """SELECT p.*, m.merchant_name, pc.category_name
           FROM products p
           JOIN merchants m ON p.merchant_id = m.merchant_id
           LEFT JOIN product_categories pc ON p.category_id = pc.category_id
           WHERE p.product_id = %s AND p.deleted_date IS NULL""",
        (product_id,), fetch_one=True
    )
    if product:
        product["images"] = get_product_images(product_id)
    return product


def get_product_images(product_id: int) -> List[dict]:
    """Get all images for a product."""
    return execute_query(
        "SELECT image_id, image_url, is_primary, display_order FROM product_images WHERE product_id = %s ORDER BY display_order",
        (product_id,), fetch_all=True
    ) or []


def create_product(merchant_id: int, product_name: str, price: float, **kwargs) -> dict:
    """Create a new product."""
    product_id = execute_query(
        """INSERT INTO products (merchant_id, category_id, product_name, product_description,
                                 price, stock_quantity, unit, delivery_days)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (merchant_id, kwargs.get("category_id"), product_name, kwargs.get("product_description"),
         price, kwargs.get("stock_quantity", 0), kwargs.get("unit", "piece"),
         kwargs.get("delivery_days", 3)),
        commit=True
    )
    logger.info(f"Product created: {product_name} (ID: {product_id}) for merchant {merchant_id}")
    return get_product_by_id(product_id)


def update_product(product_id: int, **kwargs) -> Optional[dict]:
    """Update product fields. Only updates fields that are provided."""
    allowed_fields = {"category_id", "product_name", "product_description", "price",
                      "stock_quantity", "unit", "delivery_days", "is_active"}
    updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}

    if not updates:
        return get_product_by_id(product_id)

    sets = ", ".join(f"{k} = %s" for k in updates)
    vals = list(updates.values()) + [product_id]
    execute_query(f"UPDATE products SET {sets} WHERE product_id = %s", tuple(vals), commit=True)
    logger.info(f"Product updated: ID {product_id}")
    return get_product_by_id(product_id)


def delete_product(product_id: int) -> bool:
    """Soft delete a product."""
    execute_query(
        "UPDATE products SET deleted_date = NOW(), is_active = FALSE WHERE product_id = %s",
        (product_id,), commit=True
    )
    logger.info(f"Product deleted: ID {product_id}")
    return True


def check_product_stock(product_id: int, quantity: int) -> dict:
    """Check if a product has enough stock."""
    product = execute_query(
        "SELECT product_id, product_name, stock_quantity, price, is_active FROM products WHERE product_id = %s",
        (product_id,), fetch_one=True
    )
    if not product:
        return {"available": False, "reason": "Product not found"}
    if not product["is_active"]:
        return {"available": False, "reason": "Product is inactive"}
    if product["stock_quantity"] < quantity:
        return {"available": False, "reason": f"Only {product['stock_quantity']} in stock", "stock": product["stock_quantity"]}
    return {"available": True, "product": product}


def update_product_rating(product_id: int):
    """Recalculate average rating for a product from reviews."""
    result = execute_query(
        "SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE product_id = %s",
        (product_id,), fetch_one=True
    )
    avg = round(float(result["avg_rating"] or 0), 2)
    count = result["review_count"] or 0
    execute_query(
        "UPDATE products SET avg_rating = %s, review_count = %s WHERE product_id = %s",
        (avg, count, product_id), commit=True
    )


# ==================== CATEGORIES ====================

def get_all_categories(with_count: bool = True) -> List[dict]:
    """Get all product categories."""
    if with_count:
        return execute_query(
            """SELECT pc.*, COUNT(p.product_id) as product_count
               FROM product_categories pc
               LEFT JOIN products p ON pc.category_id = p.category_id
                   AND p.is_active = TRUE AND p.deleted_date IS NULL
               GROUP BY pc.category_id
               ORDER BY pc.category_name""",
            fetch_all=True
        )
    return execute_query("SELECT * FROM product_categories ORDER BY category_name", fetch_all=True)


def get_merchant_categories(merchant_id: int) -> List[dict]:
    """Get categories that have products for a specific merchant."""
    return execute_query(
        """SELECT DISTINCT pc.*
           FROM product_categories pc
           JOIN products p ON pc.category_id = p.category_id
           WHERE p.merchant_id = %s AND p.is_active = TRUE AND p.deleted_date IS NULL
           ORDER BY pc.category_name""",
        (merchant_id,), fetch_all=True
    )


def get_category_by_id(category_id: int) -> Optional[dict]:
    """Get a single category."""
    return execute_query(
        "SELECT * FROM product_categories WHERE category_id = %s",
        (category_id,), fetch_one=True
    )


def create_category(category_name: str, description: str = None) -> int:
    """Create a new product category. Returns category_id."""
    return execute_query(
        "INSERT INTO product_categories (category_name, category_description) VALUES (%s, %s)",
        (category_name, description), commit=True
    )


def delete_category(category_id: int) -> bool:
    """Delete a category (products keep their category_id but it becomes NULL)."""
    execute_query("DELETE FROM product_categories WHERE category_id = %s", (category_id,), commit=True)
    return True
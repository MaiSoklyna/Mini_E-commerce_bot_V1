"""
Admin Dashboard API — MiniShopBot v2
/api/admin/  — Super Admin routes
/api/merchant/ — Merchant Admin routes
Both share this router; role is enforced per-endpoint via Depends.
"""
import secrets
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from app.database import execute_query
from app.utils.security import (
    get_current_admin, get_current_merchant_admin,
    require_super_admin, get_merchant_filter,
    hash_password, verify_password, create_access_token,
)
from datetime import datetime, timedelta, timezone
import os, uuid, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["Admin"])

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "images"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Helpers ───────────────────────────────────────────────────────

def merchant_where(admin: dict, alias: str = "") -> tuple[str, tuple]:
    mid = get_merchant_filter(admin)
    if mid:
        col = f"{alias}.merchant_id" if alias else "merchant_id"
        return f" AND {col} = %s", (mid,)
    return "", ()


def enforce_merchant(admin: dict, table: str, id_col: str, id_val: int, label: str = "Resource"):
    mid = get_merchant_filter(admin)
    if mid is None:
        return
    row = execute_query(f"SELECT merchant_id FROM `{table}` WHERE {id_col}=%s", (id_val,), fetch_one=True)
    if not row:
        raise HTTPException(404, f"{label} not found")
    if row["merchant_id"] != mid:
        raise HTTPException(403, f"Access denied — this {label.lower()} belongs to another merchant")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AUTH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/auth/login")
async def admin_login(body: dict):
    email    = (body.get("email") or "").strip()
    password = body.get("password", "")
    role     = body.get("role", "merchant")   # "merchant" | "super_admin"

    if not email or not password:
        raise HTTPException(400, "Email and password required")

    if role == "super_admin":
        admin = execute_query(
            "SELECT id, full_name, email, password_hash, is_active FROM super_admins WHERE email=%s",
            (email,), fetch_one=True,
        )
        if not admin or not admin["is_active"] or not verify_password(password, admin["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        execute_query("UPDATE super_admins SET last_login=NOW() WHERE id=%s", (admin["id"],), commit=True)
        token = create_access_token({"sub": str(admin["id"]), "role": "super_admin", "email": email})
        return {
            "success": True,
            "data": {
                "access_token": token,
                "expires_in": 3600,
                "user": {"id": admin["id"], "email": email,
                         "name": admin["full_name"], "role": "super_admin"},
            },
        }

    # merchant admin
    admin = execute_query(
        "SELECT id, merchant_id, full_name, email, password_hash, role, is_active "
        "FROM merchant_admins WHERE email=%s",
        (email,), fetch_one=True,
    )
    if not admin or not admin["is_active"] or not verify_password(password, admin["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    execute_query("UPDATE merchant_admins SET last_login=NOW() WHERE id=%s", (admin["id"],), commit=True)

    merchant = execute_query(
        "SELECT name, status FROM merchants WHERE id=%s", (admin["merchant_id"],), fetch_one=True
    )
    if merchant and merchant["status"] == "suspended":
        raise HTTPException(403, "MERCHANT_SUSPENDED")

    token = create_access_token({
        "sub": str(admin["id"]),
        "role": "merchant",
        "merchant_id": admin["merchant_id"],
        "email": email,
    })
    return {
        "success": True,
        "data": {
            "access_token": token,
            "expires_in": 3600,
            "user": {
                "id": admin["id"], "email": email,
                "name": admin["full_name"], "role": "merchant",
                "merchant_id": admin["merchant_id"],
                "merchant_name": merchant["name"] if merchant else None,
            },
        },
    }


@router.get("/auth/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return {"success": True, "data": admin}


@router.put("/auth/profile")
async def update_profile(body: dict, admin: dict = Depends(get_current_admin)):
    name  = body.get("name", "").strip()
    email = body.get("email", "").strip()
    if not name and not email:
        raise HTTPException(400, "Provide at least name or email")

    if admin.get("token_role") == "super_admin":
        if name:
            execute_query("UPDATE super_admins SET full_name=%s WHERE id=%s", (name, admin["id"]), commit=True)
        if email:
            execute_query("UPDATE super_admins SET email=%s WHERE id=%s", (email, admin["id"]), commit=True)
    else:
        if name:
            execute_query("UPDATE merchant_admins SET full_name=%s WHERE id=%s", (name, admin["id"]), commit=True)
        if email:
            execute_query("UPDATE merchant_admins SET email=%s WHERE id=%s", (email, admin["id"]), commit=True)
    return {"success": True, "message": "Profile updated"}


@router.put("/auth/password")
async def change_password(body: dict, admin: dict = Depends(get_current_admin)):
    current = body.get("current_password", "")
    new_pw  = body.get("new_password", "")
    if not current or not new_pw:
        raise HTTPException(400, "Both passwords required")

    table = "super_admins" if admin.get("token_role") == "super_admin" else "merchant_admins"
    row = execute_query(f"SELECT password_hash FROM {table} WHERE id=%s", (admin["id"],), fetch_one=True)
    if not row or not verify_password(current, row["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")

    execute_query(
        f"UPDATE {table} SET password_hash=%s WHERE id=%s",
        (hash_password(new_pw), admin["id"]), commit=True,
    )
    return {"success": True, "message": "Password changed"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TELEGRAM LOGIN SESSIONS (magic-link via bot)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DASH_SESSION_TTL_MINUTES = 5


@router.post("/auth/tg-session")
async def create_dash_login_session():
    """Create a pending dashboard login session. Browser calls this, then deep-links to bot."""
    session_id = "dash_" + secrets.token_urlsafe(32)
    execute_query(
        "INSERT INTO login_sessions (session_id) VALUES (%s)",
        (session_id,), commit=True,
    )
    return {"session_id": session_id}


@router.get("/auth/tg-session/{session_id}")
async def poll_dash_login_session(session_id: str):
    """Poll a dashboard login session. Returns token+user when bot completes it."""
    row = execute_query(
        "SELECT session_id, jwt_token, user_id, status, created_at "
        "FROM login_sessions WHERE session_id = %s",
        (session_id,), fetch_one=True,
    )
    if not row:
        raise HTTPException(404, "Session not found")

    # Check expiry
    created = row["created_at"]
    if isinstance(created, str):
        created = datetime.fromisoformat(created)
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - created > timedelta(minutes=DASH_SESSION_TTL_MINUTES):
        execute_query(
            "UPDATE login_sessions SET status='expired' WHERE session_id=%s",
            (session_id,), commit=True,
        )
        return {"status": "expired"}

    if row["status"] == "completed" and row["jwt_token"]:
        # Fetch merchant admin + merchant name for the user object
        admin = execute_query(
            "SELECT ma.id, ma.merchant_id, ma.full_name, ma.email, ma.role, "
            "m.name AS merchant_name "
            "FROM merchant_admins ma LEFT JOIN merchants m ON ma.merchant_id = m.id "
            "WHERE ma.id = %s",
            (row["user_id"],), fetch_one=True,
        )
        # Clean up used session
        execute_query(
            "DELETE FROM login_sessions WHERE session_id=%s",
            (session_id,), commit=True,
        )
        user_data = None
        if admin:
            user_data = {
                "id": admin["id"],
                "email": admin["email"],
                "name": admin["full_name"],
                "role": "merchant",
                "merchant_id": admin["merchant_id"],
                "merchant_name": admin["merchant_name"],
            }
        return {"status": "completed", "token": row["jwt_token"], "user": user_data}

    return {"status": "pending"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DASHBOARD / STATS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/dashboard")
async def admin_dashboard(admin: dict = Depends(get_current_admin)):
    mw_o, mp_o = merchant_where(admin, "o")
    mw_p, mp_p = merchant_where(admin, "p")

    stats: dict = {}
    if admin.get("token_role") == "super_admin":
        stats["total_merchants"]  = execute_query("SELECT COUNT(*) AS c FROM merchants", fetch_one=True)["c"]
        stats["total_customers"]  = execute_query("SELECT COUNT(*) AS c FROM users", fetch_one=True)["c"]
        stats["pending_merchants"] = execute_query(
            "SELECT COUNT(*) AS c FROM merchants WHERE status='pending-review'", fetch_one=True
        )["c"]

    stats["total_products"] = execute_query(
        f"SELECT COUNT(*) AS c FROM products p WHERE is_active=TRUE{mw_p}", mp_p, fetch_one=True
    )["c"]
    stats["total_orders"] = execute_query(
        f"SELECT COUNT(*) AS c FROM orders o WHERE 1=1{mw_o}", mp_o, fetch_one=True
    )["c"]
    stats["total_revenue"] = float(execute_query(
        f"SELECT COALESCE(SUM(total),0) AS t FROM orders o WHERE status='delivered'{mw_o}",
        mp_o, fetch_one=True,
    )["t"])

    stats["recent_orders"] = execute_query(
        f"SELECT o.id, o.order_code, o.total, o.status, o.created_at, "
        f"u.first_name AS customer_name "
        f"FROM orders o LEFT JOIN users u ON o.user_id=u.id "
        f"WHERE 1=1{mw_o} ORDER BY o.created_at DESC LIMIT 10",
        mp_o, fetch_all=True,
    ) or []

    return {"success": True, "data": stats}


@router.get("/analytics/revenue")
async def revenue_chart(period: str = Query("30d"), admin: dict = Depends(get_current_admin)):
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(period, 30)
    mw_o, mp_o = merchant_where(admin, "o")
    rows = execute_query(
        f"SELECT DATE(o.created_at) AS date, COALESCE(SUM(o.total),0) AS revenue, COUNT(*) AS orders "
        f"FROM orders o WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL %s DAY){mw_o} "
        f"GROUP BY DATE(o.created_at) ORDER BY date",
        (days, *mp_o), fetch_all=True,
    ) or []
    for r in rows:
        r["date"] = str(r["date"])
        r["revenue"] = float(r["revenue"])
    return {"success": True, "data": rows}


@router.get("/analytics/orders-status")
async def orders_status_chart(admin: dict = Depends(get_current_admin)):
    mw_o, mp_o = merchant_where(admin, "o")
    rows = execute_query(
        f"SELECT status, COUNT(*) AS count FROM orders o WHERE 1=1{mw_o} GROUP BY status",
        mp_o, fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.get("/analytics/top-products")
async def top_products(admin: dict = Depends(get_current_admin)):
    mw_p, mp_p = merchant_where(admin, "p")
    rows = execute_query(
        f"SELECT p.id, p.name, p.base_price, p.icon_emoji, "
        f"COALESCE(SUM(oi.quantity),0) AS total_sold, "
        f"COALESCE(SUM(oi.subtotal),0) AS total_revenue "
        f"FROM products p "
        f"LEFT JOIN order_items oi ON p.id = oi.product_id "
        f"WHERE 1=1{mw_p} GROUP BY p.id ORDER BY total_sold DESC LIMIT 10",
        mp_p, fetch_all=True,
    ) or []
    for r in rows:
        r["total_revenue"] = float(r["total_revenue"])
    return {"success": True, "data": rows}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PRODUCTS CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/products")
async def list_products(
    page: int = 1, limit: int = 20,
    search: str = "", category_id: int = 0, status: str = "",
    admin: dict = Depends(get_current_admin),
):
    mw_p, mp_p = merchant_where(admin, "p")
    where = f"WHERE 1=1{mw_p}"
    params = list(mp_p)
    if search:
        where += " AND (p.name LIKE %s OR p.description LIKE %s)"
        params += [f"%{search}%", f"%{search}%"]
    if category_id:
        where += " AND p.category_id = %s"
        params.append(category_id)
    if status == "active":
        where += " AND p.is_active = TRUE"
    elif status == "inactive":
        where += " AND p.is_active = FALSE"

    total = execute_query(
        f"SELECT COUNT(*) AS c FROM products p {where}", tuple(params), fetch_one=True
    )["c"]
    offset = (page - 1) * limit
    rows = execute_query(
        f"SELECT p.id, p.name, p.slug, p.base_price, p.compare_price, p.stock, "
        f"p.sku, p.icon_emoji, p.rating_avg, p.review_count, p.is_active, p.is_featured, "
        f"p.delivery_days, p.created_at, "
        f"c.name AS category_name, m.name AS merchant_name, "
        f"(SELECT pi.url FROM product_images pi WHERE pi.product_id=p.id ORDER BY pi.sort_order LIMIT 1) AS primary_image "
        f"FROM products p "
        f"LEFT JOIN categories c ON p.category_id=c.id "
        f"LEFT JOIN merchants m ON p.merchant_id=m.id "
        f"{where} ORDER BY p.id DESC LIMIT %s OFFSET %s",
        tuple(params + [limit, offset]), fetch_all=True,
    ) or []
    return {
        "success": True, "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit},
    }


@router.get("/products/{product_id}")
async def get_product(product_id: int, admin: dict = Depends(get_current_admin)):
    mw_p, mp_p = merchant_where(admin, "p")
    p = execute_query(
        f"SELECT p.*, c.name AS category_name, m.name AS merchant_name "
        f"FROM products p "
        f"LEFT JOIN categories c ON p.category_id=c.id "
        f"LEFT JOIN merchants m ON p.merchant_id=m.id "
        f"WHERE p.id=%s{mw_p}",
        (product_id, *mp_p), fetch_one=True,
    )
    if not p:
        raise HTTPException(404, "Product not found")
    p["images"] = execute_query(
        "SELECT id, url, alt_text, sort_order FROM product_images WHERE product_id=%s ORDER BY sort_order",
        (product_id,), fetch_all=True,
    ) or []
    # Variants
    groups = execute_query(
        "SELECT id, group_name, type, sort_order FROM product_variants WHERE product_id=%s ORDER BY sort_order",
        (product_id,), fetch_all=True,
    ) or []
    for g in groups:
        g["options"] = execute_query(
            "SELECT id, label, hex_color, price_adjust, is_popular, is_active, sort_order "
            "FROM product_variant_options WHERE variant_id=%s ORDER BY sort_order",
            (g["id"],), fetch_all=True,
        ) or []
    p["variants"] = groups
    return {"success": True, "data": p}


@router.post("/products")
async def create_product(body: dict, admin: dict = Depends(get_current_admin)):
    if admin.get("token_role") == "merchant":
        mid = admin["merchant_id"]
    else:
        mid = body.get("merchant_id")
        if not mid:
            first = execute_query(
                "SELECT id FROM merchants WHERE status='active' ORDER BY id LIMIT 1", fetch_one=True
            )
            mid = first["id"] if first else None
    if not mid:
        raise HTTPException(400, "merchant_id required")

    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "name required")

    slug = body.get("slug") or name.lower().replace(" ", "-").replace("'", "")
    base_price = float(body.get("base_price", body.get("price", 0)))

    pid = execute_query(
        "INSERT INTO products (merchant_id, category_id, name, slug, description, sku, "
        "base_price, compare_price, stock, weight, delivery_days, icon_emoji, is_featured, is_active) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (mid, body.get("category_id"), name, slug,
         body.get("description"), body.get("sku"),
         base_price, body.get("compare_price"),
         body.get("stock", 0), body.get("weight"),
         body.get("delivery_days", 3), body.get("icon_emoji"),
         body.get("is_featured", False), body.get("is_active", True)),
        commit=True,
    )

    # Create variant groups + options if provided
    for vg in (body.get("variants") or []):
        gid = execute_query(
            "INSERT INTO product_variants (product_id, group_name, type, sort_order) VALUES (%s,%s,%s,%s)",
            (pid, vg["group_name"], vg.get("type", "custom"), vg.get("sort_order", 0)), commit=True,
        )
        for opt in (vg.get("options") or []):
            execute_query(
                "INSERT INTO product_variant_options (variant_id, label, hex_color, price_adjust, is_popular, sort_order) "
                "VALUES (%s,%s,%s,%s,%s,%s)",
                (gid, opt["label"], opt.get("hex_color"), opt.get("price_adjust", 0),
                 opt.get("is_popular", False), opt.get("sort_order", 0)), commit=True,
            )

    if body.get("image_url"):
        execute_query(
            "INSERT INTO product_images (product_id, url, sort_order) VALUES (%s,%s,0)",
            (pid, body["image_url"]), commit=True,
        )
    return {"success": True, "data": {"id": pid}, "message": "Product created"}


@router.put("/products/{product_id}")
async def update_product(product_id: int, body: dict, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    allowed = ["name", "description", "sku", "base_price", "compare_price",
               "stock", "weight", "delivery_days", "icon_emoji",
               "category_id", "is_active", "is_featured"]
    fields, vals = [], []
    for k in allowed:
        if k in body:
            fields.append(f"{k}=%s")
            vals.append(body[k])
    if not fields:
        raise HTTPException(400, "No updatable fields provided")
    vals.append(product_id)
    execute_query(f"UPDATE products SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Product updated"}


@router.delete("/products/{product_id}")
async def delete_product(product_id: int, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    execute_query("UPDATE products SET is_active=FALSE WHERE id=%s", (product_id,), commit=True)
    return {"success": True, "message": "Product deactivated"}


# ── Product images ──────────────────────────────────────────────

@router.post("/products/{product_id}/images")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    ext = os.path.splitext(file.filename or "img.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    url = f"/uploads/images/{filename}"
    sort_order = execute_query(
        "SELECT COALESCE(MAX(sort_order)+1,0) AS n FROM product_images WHERE product_id=%s",
        (product_id,), fetch_one=True,
    )["n"]
    img_id = execute_query(
        "INSERT INTO product_images (product_id, url, sort_order) VALUES (%s,%s,%s)",
        (product_id, url, sort_order), commit=True,
    )
    return {"success": True, "data": {"id": img_id, "url": url}}


@router.delete("/products/{product_id}/images/{img_id}")
async def delete_product_image(product_id: int, img_id: int, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    execute_query("DELETE FROM product_images WHERE id=%s AND product_id=%s", (img_id, product_id), commit=True)
    return {"success": True, "message": "Image deleted"}


# ── Variants ────────────────────────────────────────────────────

@router.get("/products/{product_id}/variants")
async def list_variants(product_id: int, _: dict = Depends(get_current_admin)):
    groups = execute_query(
        "SELECT id, group_name, type, sort_order FROM product_variants WHERE product_id=%s ORDER BY sort_order",
        (product_id,), fetch_all=True,
    ) or []
    for g in groups:
        g["options"] = execute_query(
            "SELECT id, label, hex_color, price_adjust, is_popular, is_active, sort_order "
            "FROM product_variant_options WHERE variant_id=%s ORDER BY sort_order",
            (g["id"],), fetch_all=True,
        ) or []
    return {"success": True, "data": groups}


@router.post("/products/{product_id}/variants")
async def add_variant_group(product_id: int, body: dict, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    gid = execute_query(
        "INSERT INTO product_variants (product_id, group_name, type, sort_order) VALUES (%s,%s,%s,%s)",
        (product_id, body["group_name"], body.get("type", "custom"), body.get("sort_order", 0)), commit=True,
    )
    for opt in (body.get("options") or []):
        execute_query(
            "INSERT INTO product_variant_options (variant_id, label, hex_color, price_adjust, is_popular, sort_order) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (gid, opt["label"], opt.get("hex_color"), opt.get("price_adjust", 0),
             opt.get("is_popular", False), opt.get("sort_order", 0)), commit=True,
        )
    return {"success": True, "data": {"id": gid}}


@router.put("/products/{product_id}/variants/{vid}")
async def update_variant_group(product_id: int, vid: int, body: dict, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    fields, vals = [], []
    for k in ["group_name", "type", "sort_order"]:
        if k in body:
            fields.append(f"{k}=%s")
            vals.append(body[k])
    if fields:
        vals.append(vid)
        execute_query(f"UPDATE product_variants SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Variant group updated"}


@router.delete("/products/{product_id}/variants/{vid}")
async def delete_variant_group(product_id: int, vid: int, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    execute_query("DELETE FROM product_variants WHERE id=%s AND product_id=%s", (vid, product_id), commit=True)
    return {"success": True, "message": "Variant group deleted"}


@router.post("/products/{product_id}/variants/{vid}/options")
async def add_variant_option(product_id: int, vid: int, body: dict, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    oid = execute_query(
        "INSERT INTO product_variant_options (variant_id, label, hex_color, price_adjust, is_popular, sort_order) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        (vid, body["label"], body.get("hex_color"), body.get("price_adjust", 0),
         body.get("is_popular", False), body.get("sort_order", 0)), commit=True,
    )
    return {"success": True, "data": {"id": oid}}


@router.put("/products/{product_id}/variants/{vid}/options/{oid}")
async def update_variant_option(product_id: int, vid: int, oid: int, body: dict, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    fields, vals = [], []
    for k in ["label", "hex_color", "price_adjust", "stock_adjust", "is_popular", "is_active", "sort_order"]:
        if k in body:
            fields.append(f"{k}=%s")
            vals.append(body[k])
    if fields:
        vals.extend([oid, vid])
        execute_query(f"UPDATE product_variant_options SET {', '.join(fields)} WHERE id=%s AND variant_id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Option updated"}


@router.delete("/products/{product_id}/variants/{vid}/options/{oid}")
async def delete_variant_option(product_id: int, vid: int, oid: int, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "products", "id", product_id, "Product")
    execute_query("DELETE FROM product_variant_options WHERE id=%s AND variant_id=%s", (oid, vid), commit=True)
    return {"success": True, "message": "Option deleted"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CATEGORIES CRUD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/categories")
async def list_categories(admin: dict = Depends(get_current_admin)):
    mid = get_merchant_filter(admin)
    if mid:
        rows = execute_query(
            "SELECT c.id, c.merchant_id, c.name, c.name_kh, c.icon_emoji, c.sort_order, c.is_active, "
            "COUNT(p.id) AS product_count "
            "FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.merchant_id=%s "
            "WHERE c.is_active=TRUE AND (c.merchant_id IS NULL OR c.merchant_id=%s) "
            "GROUP BY c.id ORDER BY c.sort_order",
            (mid, mid), fetch_all=True,
        ) or []
    else:
        rows = execute_query(
            "SELECT c.id, c.merchant_id, c.name, c.name_kh, c.icon_emoji, c.sort_order, c.is_active, "
            "COUNT(p.id) AS product_count "
            "FROM categories c LEFT JOIN products p ON p.category_id=c.id "
            "GROUP BY c.id ORDER BY c.sort_order",
            fetch_all=True,
        ) or []
    return {"success": True, "data": rows}


@router.post("/categories")
async def create_category(body: dict, admin: dict = Depends(get_current_admin)):
    mid = get_merchant_filter(admin) or body.get("merchant_id")
    cid = execute_query(
        "INSERT INTO categories (merchant_id, name, name_kh, icon_emoji, sort_order) VALUES (%s,%s,%s,%s,%s)",
        (mid, body["name"], body.get("name_kh"), body.get("icon_emoji"), body.get("sort_order", 0)),
        commit=True,
    )
    return {"success": True, "data": {"id": cid}, "message": "Category created"}


@router.put("/categories/{cid}")
async def update_category(cid: int, body: dict, _: dict = Depends(get_current_admin)):
    fields, vals = [], []
    for k in ["name", "name_kh", "icon_emoji", "sort_order", "is_active"]:
        if k in body:
            fields.append(f"{k}=%s")
            vals.append(body[k])
    if fields:
        vals.append(cid)
        execute_query(f"UPDATE categories SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Category updated"}


@router.delete("/categories/{cid}")
async def delete_category(cid: int, _: dict = Depends(get_current_admin)):
    execute_query("UPDATE categories SET is_active=FALSE WHERE id=%s", (cid,), commit=True)
    return {"success": True, "message": "Category deactivated"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ORDERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/orders")
async def list_orders(
    page: int = 1, limit: int = 20,
    status: str = "", search: str = "",
    admin: dict = Depends(get_current_admin),
):
    mw_o, mp_o = merchant_where(admin, "o")
    where = f"WHERE 1=1{mw_o}"
    params = list(mp_o)
    if status:
        where += " AND o.status=%s"
        params.append(status)
    if search:
        where += " AND (o.order_code LIKE %s OR u.first_name LIKE %s)"
        params += [f"%{search}%", f"%{search}%"]

    total = execute_query(
        f"SELECT COUNT(*) AS c FROM orders o JOIN users u ON o.user_id=u.id {where}",
        tuple(params), fetch_one=True,
    )["c"]
    offset = (page - 1) * limit
    rows = execute_query(
        f"SELECT o.id, o.order_code, o.merchant_id, m.name AS merchant_name, "
        f"o.subtotal, o.discount_amount, o.total, o.status, "
        f"o.payment_method, o.payment_status, o.delivery_address, o.created_at, "
        f"u.first_name AS customer_name, u.phone AS customer_phone "
        f"FROM orders o "
        f"JOIN users u ON o.user_id=u.id "
        f"JOIN merchants m ON o.merchant_id=m.id "
        f"{where} ORDER BY o.created_at DESC LIMIT %s OFFSET %s",
        tuple(params + [limit, offset]), fetch_all=True,
    ) or []
    return {
        "success": True, "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit},
    }


@router.get("/orders/{order_id}")
async def get_order(order_id: int, admin: dict = Depends(get_current_admin)):
    mw_o, mp_o = merchant_where(admin, "o")
    order = execute_query(
        f"SELECT o.*, m.name AS merchant_name, u.first_name AS customer_name, u.phone AS customer_phone "
        f"FROM orders o "
        f"JOIN merchants m ON o.merchant_id=m.id "
        f"JOIN users u ON o.user_id=u.id "
        f"WHERE o.id=%s{mw_o}",
        (order_id, *mp_o), fetch_one=True,
    )
    if not order:
        raise HTTPException(404, "Order not found")
    order["items"] = execute_query(
        "SELECT id, product_id, product_name, product_sku, selected_variants, "
        "quantity, unit_price, subtotal FROM order_items WHERE order_id=%s",
        (order_id,), fetch_all=True,
    ) or []
    return {"success": True, "data": order}


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: int, body: dict, admin: dict = Depends(get_current_admin)):
    mw_o, mp_o = merchant_where(admin, "o")
    order = execute_query(
        f"SELECT id, status FROM orders o WHERE o.id=%s{mw_o}", (order_id, *mp_o), fetch_one=True
    )
    if not order:
        raise HTTPException(404, "Order not found")

    new_status = body.get("status")
    fields, vals = ["status=%s", "updated_at=NOW()"], [new_status]
    if body.get("admin_note"):
        fields.append("admin_note=%s")
        vals.append(body["admin_note"])
    if body.get("payment_status"):
        fields.append("payment_status=%s")
        vals.append(body["payment_status"])
    vals.append(order_id)
    execute_query(f"UPDATE orders SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": f"Status updated to {new_status}"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PROMO CODES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/promos")
async def list_promos(admin: dict = Depends(get_current_admin)):
    mw, mp = merchant_where(admin)
    rows = execute_query(
        f"SELECT id, merchant_id, code, type, value, min_order, max_uses, used_count, expires_at, is_active, created_at "
        f"FROM promo_codes WHERE 1=1{mw} ORDER BY created_at DESC",
        mp, fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.post("/promos")
async def create_promo(body: dict, admin: dict = Depends(get_current_admin)):
    mid = get_merchant_filter(admin) or body.get("merchant_id")
    if not mid:
        raise HTTPException(400, "merchant_id required")
    code = (body.get("code") or "").strip().upper()
    if not code:
        raise HTTPException(400, "code required")
    pid = execute_query(
        "INSERT INTO promo_codes (merchant_id, code, type, value, min_order, max_uses, expires_at, is_active) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (mid, code, body.get("type", "percent"), body.get("value", 10),
         body.get("min_order", 0), body.get("max_uses"),
         body.get("expires_at"), body.get("is_active", True)),
        commit=True,
    )
    return {"success": True, "data": {"id": pid}, "message": "Promo code created"}


@router.put("/promos/{promo_id}")
async def update_promo(promo_id: int, body: dict, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "promo_codes", "id", promo_id, "Promo")
    fields, vals = [], []
    for k in ["code", "type", "value", "min_order", "max_uses", "expires_at", "is_active"]:
        if k in body:
            fields.append(f"{k}=%s")
            vals.append(body[k])
    if fields:
        vals.append(promo_id)
        execute_query(f"UPDATE promo_codes SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Promo updated"}


@router.delete("/promos/{promo_id}")
async def delete_promo(promo_id: int, admin: dict = Depends(get_current_admin)):
    enforce_merchant(admin, "promo_codes", "id", promo_id, "Promo")
    execute_query("UPDATE promo_codes SET is_active=FALSE WHERE id=%s", (promo_id,), commit=True)
    return {"success": True, "message": "Promo deactivated"}


@router.get("/promos/{promo_id}/usage")
async def promo_usage(promo_id: int, _: dict = Depends(get_current_admin)):
    rows = execute_query(
        "SELECT pu.id, pu.discount_applied, pu.used_at, "
        "u.first_name AS user_name, o.order_code "
        "FROM promo_usages pu "
        "JOIN users u ON pu.user_id=u.id "
        "JOIN orders o ON pu.order_id=o.id "
        "WHERE pu.promo_code_id=%s ORDER BY pu.used_at DESC",
        (promo_id,), fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# REVIEWS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/reviews")
async def list_reviews(admin: dict = Depends(get_current_admin)):
    mw_p, mp_p = merchant_where(admin, "p")
    rows = execute_query(
        f"SELECT r.id, r.rating, r.comment, r.is_visible, r.created_at, "
        f"p.name AS product_name, u.first_name AS user_name "
        f"FROM reviews r "
        f"JOIN products p ON r.product_id=p.id "
        f"JOIN users u ON r.user_id=u.id "
        f"WHERE 1=1{mw_p} ORDER BY r.created_at DESC",
        mp_p, fetch_all=True,
    ) or []
    return {"success": True, "data": rows}


@router.patch("/reviews/{review_id}")
async def toggle_review_visibility(review_id: int, body: dict, _: dict = Depends(get_current_admin)):
    execute_query(
        "UPDATE reviews SET is_visible=%s WHERE id=%s",
        (body.get("is_visible", True), review_id), commit=True,
    )
    return {"success": True, "message": "Review visibility updated"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUPPORT TICKETS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/support/tickets")
async def admin_list_tickets(
    page: int = 1, limit: int = 20, status: str = "", search: str = "",
    admin: dict = Depends(get_current_admin),
):
    """List support tickets for this merchant (or all for super admin)."""
    mw_t, mp_t = merchant_where(admin, "t")
    where = f"WHERE 1=1{mw_t}"
    params = list(mp_t)
    if status:
        where += " AND t.status = %s"
        params.append(status)
    if search:
        where += " AND (t.subject LIKE %s OR u.first_name LIKE %s OR u.username LIKE %s)"
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]

    total = execute_query(
        f"SELECT COUNT(*) AS c FROM support_tickets t "
        f"JOIN users u ON t.user_id = u.id {where}",
        tuple(params), fetch_one=True,
    )["c"]

    offset = (page - 1) * limit
    rows = execute_query(
        f"SELECT t.id, t.subject, t.status, t.order_id, t.created_at, t.updated_at, "
        f"u.first_name AS customer_name, u.username AS customer_username, "
        f"(SELECT tm.body FROM ticket_messages tm WHERE tm.ticket_id = t.id "
        f" ORDER BY tm.created_at DESC LIMIT 1) AS last_message, "
        f"(SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id) AS message_count "
        f"FROM support_tickets t "
        f"JOIN users u ON t.user_id = u.id "
        f"{where} ORDER BY "
        f"CASE t.status WHEN 'open' THEN 0 WHEN 'replied' THEN 1 ELSE 2 END, "
        f"t.updated_at DESC LIMIT %s OFFSET %s",
        tuple(params + [limit, offset]), fetch_all=True,
    ) or []
    return {
        "success": True, "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit},
    }


@router.get("/support/tickets/{ticket_id}")
async def admin_get_ticket(ticket_id: int, admin: dict = Depends(get_current_admin)):
    """Get ticket detail + all messages."""
    mw_t, mp_t = merchant_where(admin, "t")
    ticket = execute_query(
        f"SELECT t.id, t.subject, t.status, t.order_id, t.merchant_id, "
        f"t.created_at, t.updated_at, "
        f"u.first_name AS customer_name, u.username AS customer_username "
        f"FROM support_tickets t "
        f"JOIN users u ON t.user_id = u.id "
        f"WHERE t.id = %s{mw_t}",
        (ticket_id, *mp_t), fetch_one=True,
    )
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    messages = execute_query(
        "SELECT id, sender_type, sender_id, body, created_at "
        "FROM ticket_messages WHERE ticket_id = %s ORDER BY created_at ASC",
        (ticket_id,), fetch_all=True,
    ) or []

    return {"success": True, "data": {**ticket, "messages": messages}}


@router.post("/support/tickets/{ticket_id}/reply")
async def admin_reply_ticket(ticket_id: int, body: dict, admin: dict = Depends(get_current_admin)):
    """Merchant replies to a support ticket. Notifies customer via Telegram."""
    message = (body.get("message") or "").strip()
    if not message:
        raise HTTPException(400, "Message required")

    mw_t, mp_t = merchant_where(admin, "t")
    ticket = execute_query(
        f"SELECT t.id, t.user_id, t.subject, t.merchant_id "
        f"FROM support_tickets t WHERE t.id = %s{mw_t}",
        (ticket_id, *mp_t), fetch_one=True,
    )
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    # Insert reply
    execute_query(
        "INSERT INTO ticket_messages (ticket_id, sender_type, sender_id, body) "
        "VALUES (%s, 'merchant', %s, %s)",
        (ticket_id, admin["id"], message),
        commit=True,
    )

    # Update ticket status
    execute_query(
        "UPDATE support_tickets SET status = 'replied', updated_at = NOW() WHERE id = %s",
        (ticket_id,), commit=True,
    )

    # Notify customer via Telegram DM
    user_row = execute_query(
        "SELECT telegram_id, first_name FROM users WHERE id = %s",
        (ticket["user_id"],), fetch_one=True,
    )
    if user_row and user_row.get("telegram_id"):
        merchant_row = execute_query(
            "SELECT name FROM merchants WHERE id = %s",
            (ticket["merchant_id"],), fetch_one=True,
        )
        try:
            from app.utils.bot_manager import send_telegram_message
            text = (
                f"💬 Reply from {merchant_row['name'] if merchant_row else 'Merchant'}:\n\n"
                f"Re: {ticket['subject']}\n"
                f"---\n{message[:500]}\n\n"
                f"Open the app to continue the conversation."
            )
            await send_telegram_message(user_row["telegram_id"], text)
        except Exception as e:
            logger.warning(f"Failed to notify customer: {e}")

    return {"success": True, "message": "Reply sent"}


@router.patch("/support/tickets/{ticket_id}/close")
async def admin_close_ticket(ticket_id: int, admin: dict = Depends(get_current_admin)):
    """Close a support ticket."""
    mw_t, mp_t = merchant_where(admin, "t")
    ticket = execute_query(
        f"SELECT id FROM support_tickets t WHERE t.id = %s{mw_t}",
        (ticket_id, *mp_t), fetch_one=True,
    )
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    execute_query(
        "UPDATE support_tickets SET status = 'closed', updated_at = NOW() WHERE id = %s",
        (ticket_id,), commit=True,
    )
    return {"success": True, "message": "Ticket closed"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MERCHANT SETTINGS (merchant-admin self-service)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/settings")
async def get_settings(admin: dict = Depends(get_current_merchant_admin)):
    mid = admin["merchant_id"]
    m = execute_query(
        "SELECT id, name, slug, owner_name, email, phone, tagline, description, story, "
        "location, icon_emoji, accent_color, plan, deep_link_code, status, "
        "fb_page, instagram, telegram_token, created_at "
        "FROM merchants WHERE id=%s",
        (mid,), fetch_one=True,
    )
    if not m:
        raise HTTPException(404, "Merchant not found")
    return {"success": True, "data": m}


@router.put("/settings")
async def update_settings(body: dict, admin: dict = Depends(get_current_merchant_admin)):
    mid = admin["merchant_id"]
    allowed = ["name", "owner_name", "email", "phone", "tagline", "description",
               "story", "location", "icon_emoji", "accent_color", "fb_page", "instagram"]
    fields, vals = [], []
    for k in allowed:
        if k in body:
            fields.append(f"{k}=%s")
            vals.append(body[k])
    if fields:
        vals.append(mid)
        execute_query(f"UPDATE merchants SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Settings updated"}


@router.put("/settings/bot")
async def update_bot_settings(body: dict, admin: dict = Depends(get_current_merchant_admin)):
    mid = admin["merchant_id"]
    fields, vals = [], []
    if "telegram_token" in body:
        fields.append("telegram_token=%s")
        vals.append(body["telegram_token"])
    if "deep_link_code" in body:
        fields.append("deep_link_code=%s")
        vals.append(body["deep_link_code"])
    if fields:
        vals.append(mid)
        execute_query(f"UPDATE merchants SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Bot settings updated"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUPER ADMIN — MERCHANT MANAGEMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/merchants")
async def list_merchants(
    page: int = 1, limit: int = 20, status: str = "",
    _: dict = Depends(require_super_admin),
):
    where = "WHERE 1=1"
    params: list = []
    if status:
        where += " AND status=%s"
        params.append(status)
    total = execute_query(f"SELECT COUNT(*) AS c FROM merchants {where}", tuple(params), fetch_one=True)["c"]
    offset = (page - 1) * limit
    rows = execute_query(
        f"SELECT id, name, slug, owner_name, email, phone, plan, status, "
        f"icon_emoji, accent_color, created_at, "
        f"(SELECT COUNT(*) FROM products p WHERE p.merchant_id=merchants.id) AS product_count, "
        f"(SELECT COUNT(*) FROM orders o WHERE o.merchant_id=merchants.id) AS order_count "
        f"FROM merchants {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        tuple(params + [limit, offset]), fetch_all=True,
    ) or []
    return {
        "success": True, "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit},
    }


@router.post("/merchants")
async def create_merchant(body: dict, _: dict = Depends(require_super_admin)):
    slug = (body.get("slug") or body["name"].lower().replace(" ", "-")).strip()
    mid = execute_query(
        "INSERT INTO merchants (name, slug, owner_name, email, phone, tagline, description, "
        "story, location, icon_emoji, accent_color, plan, status) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (body["name"], slug, body["owner_name"], body["email"],
         body.get("phone"), body.get("tagline"), body.get("description"),
         body.get("story"), body.get("location"),
         body.get("icon_emoji"), body.get("accent_color"),
         body.get("plan", "Basic"), body.get("status", "active")),
        commit=True,
    )

    # Create merchant admin (owner) if password provided
    if body.get("admin_password"):
        execute_query(
            "INSERT INTO merchant_admins (merchant_id, full_name, email, telegram_id, password_hash, role) "
            "VALUES (%s,%s,%s,%s,%s,'owner')",
            (mid, body["owner_name"], body["email"],
             body.get("telegram_id"), hash_password(body["admin_password"])),
            commit=True,
        )
    return {"success": True, "data": {"id": mid}, "message": "Merchant created"}


@router.get("/merchants/{merchant_id}")
async def get_merchant(merchant_id: int, _: dict = Depends(require_super_admin)):
    m = execute_query(
        "SELECT * FROM merchants WHERE id=%s", (merchant_id,), fetch_one=True
    )
    if not m:
        raise HTTPException(404, "Merchant not found")
    m["admins"] = execute_query(
        "SELECT id, full_name, email, telegram_id, role, is_active, last_login FROM merchant_admins WHERE merchant_id=%s",
        (merchant_id,), fetch_all=True,
    ) or []
    return {"success": True, "data": m}


@router.put("/merchants/{merchant_id}")
async def update_merchant(merchant_id: int, body: dict, _: dict = Depends(require_super_admin)):
    allowed = ["name", "slug", "owner_name", "email", "phone", "tagline", "description",
               "story", "location", "icon_emoji", "accent_color", "plan",
               "telegram_token", "deep_link_code", "status", "fb_page", "instagram"]
    fields, vals = [], []
    for k in allowed:
        if k in body:
            fields.append(f"{k}=%s")
            vals.append(body[k])
    if fields:
        vals.append(merchant_id)
        execute_query(f"UPDATE merchants SET {', '.join(fields)} WHERE id=%s", tuple(vals), commit=True)
    return {"success": True, "message": "Merchant updated"}


@router.patch("/merchants/{merchant_id}/status")
async def change_merchant_status(merchant_id: int, body: dict, _: dict = Depends(require_super_admin)):
    new_status = body.get("status")
    if new_status not in ("active", "suspended", "pending-review"):
        raise HTTPException(400, "Invalid status value")
    execute_query("UPDATE merchants SET status=%s WHERE id=%s", (new_status, merchant_id), commit=True)
    return {"success": True, "message": f"Merchant status → {new_status}"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUPER ADMIN — CUSTOMER MANAGEMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/users")
async def list_users(
    page: int = 1, limit: int = 20, search: str = "",
    _: dict = Depends(require_super_admin),
):
    where = "WHERE 1=1"
    params: list = []
    if search:
        where += " AND (first_name LIKE %s OR username LIKE %s OR email LIKE %s)"
        params += [f"%{search}%", f"%{search}%", f"%{search}%"]
    total = execute_query(f"SELECT COUNT(*) AS c FROM users {where}", tuple(params), fetch_one=True)["c"]
    offset = (page - 1) * limit
    rows = execute_query(
        f"SELECT id, telegram_id, username, first_name, last_name, phone, email, "
        f"language, is_active, created_at "
        f"FROM users {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        tuple(params + [limit, offset]), fetch_all=True,
    ) or []
    return {
        "success": True, "data": rows,
        "meta": {"page": page, "limit": limit, "total": total,
                 "total_pages": (total + limit - 1) // limit},
    }


@router.get("/users/{user_id}")
async def get_user(user_id: int, _: dict = Depends(require_super_admin)):
    user = execute_query(
        "SELECT id, telegram_id, username, first_name, last_name, phone, email, "
        "language, address, is_active, created_at FROM users WHERE id=%s",
        (user_id,), fetch_one=True,
    )
    if not user:
        raise HTTPException(404, "User not found")
    user["orders"] = execute_query(
        "SELECT id, order_code, total, status, created_at FROM orders WHERE user_id=%s ORDER BY created_at DESC LIMIT 10",
        (user_id,), fetch_all=True,
    ) or []
    return {"success": True, "data": user}


@router.patch("/users/{user_id}/status")
async def toggle_user_status(user_id: int, body: dict, _: dict = Depends(require_super_admin)):
    is_active = body.get("is_active", True)
    execute_query("UPDATE users SET is_active=%s WHERE id=%s", (is_active, user_id), commit=True)
    return {"success": True, "message": f"User {'activated' if is_active else 'deactivated'}"}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SYSTEM HEALTH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/system/health")
async def system_health(_: dict = Depends(require_super_admin)):
    try:
        result = execute_query("SELECT 1 AS ok", fetch_one=True)
        db_ok = bool(result)
    except Exception:
        db_ok = False
    return {
        "success": True,
        "data": {
            "api": "ok",
            "database": "connected" if db_ok else "error",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }

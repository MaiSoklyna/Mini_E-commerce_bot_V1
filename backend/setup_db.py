"""
Full database setup — MiniShopBot v2 schema (18 tables).
Run: cd D:/favourite-of-shop/backend && python setup_db.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import execute_query, init_db_pool
import bcrypt

TABLES = [
    # 1. users
    ("users",
     "CREATE TABLE IF NOT EXISTS users ("
     "  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  telegram_id BIGINT        UNIQUE NOT NULL,"
     "  username    VARCHAR(64)   NULL,"
     "  first_name  VARCHAR(100)  NOT NULL,"
     "  last_name   VARCHAR(100)  NULL,"
     "  phone       VARCHAR(20)   NULL,"
     "  email       VARCHAR(150)  NULL,"
     "  language    ENUM('en','kh') DEFAULT 'en',"
     "  address     TEXT          NULL,"
     "  is_active   BOOLEAN       DEFAULT TRUE,"
     "  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 2. merchants
    ("merchants",
     "CREATE TABLE IF NOT EXISTS merchants ("
     "  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  name            VARCHAR(150)  NOT NULL,"
     "  slug            VARCHAR(100)  UNIQUE NOT NULL,"
     "  owner_name      VARCHAR(150)  NOT NULL,"
     "  email           VARCHAR(150)  UNIQUE NOT NULL,"
     "  phone           VARCHAR(20)   NULL,"
     "  tagline         VARCHAR(255)  NULL,"
     "  description     TEXT          NULL,"
     "  story           TEXT          NULL,"
     "  location        VARCHAR(200)  NULL,"
     "  icon_emoji      VARCHAR(8)    NULL,"
     "  accent_color    VARCHAR(7)    NULL,"
     "  plan            ENUM('Basic','Standard','Premium') DEFAULT 'Basic',"
     "  telegram_token  VARCHAR(255)  NULL,"
     "  deep_link_code  VARCHAR(50)   UNIQUE NULL,"
     "  status          ENUM('active','suspended','pending-review') DEFAULT 'pending-review',"
     "  fb_page         VARCHAR(150)  NULL,"
     "  instagram       VARCHAR(100)  NULL,"
     "  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 3. super_admins
    ("super_admins",
     "CREATE TABLE IF NOT EXISTS super_admins ("
     "  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  full_name     VARCHAR(150)  NOT NULL,"
     "  email         VARCHAR(150)  UNIQUE NOT NULL,"
     "  password_hash VARCHAR(255)  NOT NULL,"
     "  is_active     BOOLEAN       DEFAULT TRUE,"
     "  last_login    TIMESTAMP     NULL,"
     "  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 4. merchant_admins
    ("merchant_admins",
     "CREATE TABLE IF NOT EXISTS merchant_admins ("
     "  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  merchant_id   INT UNSIGNED  NOT NULL,"
     "  full_name     VARCHAR(150)  NOT NULL,"
     "  email         VARCHAR(150)  UNIQUE NOT NULL,"
     "  telegram_id   BIGINT        NULL,"
     "  password_hash VARCHAR(255)  NOT NULL,"
     "  role          ENUM('owner','staff') DEFAULT 'staff',"
     "  is_active     BOOLEAN       DEFAULT TRUE,"
     "  last_login    TIMESTAMP     NULL,"
     "  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  UNIQUE INDEX idx_merchant_admin_tg (telegram_id),"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 5. categories (NULL merchant_id = global)
    ("categories",
     "CREATE TABLE IF NOT EXISTS categories ("
     "  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  merchant_id INT UNSIGNED  NULL,"
     "  name        VARCHAR(100)  NOT NULL,"
     "  name_kh     VARCHAR(200)  NULL,"
     "  icon_emoji  VARCHAR(8)    NULL,"
     "  sort_order  INT           DEFAULT 0,"
     "  is_active   BOOLEAN       DEFAULT TRUE,"
     "  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 6. products
    ("products",
     "CREATE TABLE IF NOT EXISTS products ("
     "  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  merchant_id   INT UNSIGNED    NOT NULL,"
     "  category_id   INT UNSIGNED    NULL,"
     "  name          VARCHAR(200)    NOT NULL,"
     "  slug          VARCHAR(220)    NOT NULL,"
     "  description   TEXT            NULL,"
     "  sku           VARCHAR(80)     NULL,"
     "  base_price    DECIMAL(10,2)   NOT NULL,"
     "  compare_price DECIMAL(10,2)   NULL,"
     "  stock         INT UNSIGNED    DEFAULT 0,"
     "  weight        VARCHAR(50)     NULL,"
     "  delivery_days TINYINT         DEFAULT 3,"
     "  icon_emoji    VARCHAR(8)      NULL,"
     "  rating_avg    DECIMAL(3,2)    DEFAULT 0.00,"
     "  review_count  INT UNSIGNED    DEFAULT 0,"
     "  is_active     BOOLEAN         DEFAULT TRUE,"
     "  is_featured   BOOLEAN         DEFAULT FALSE,"
     "  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  updated_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,"
     "  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 7. product_variants
    ("product_variants",
     "CREATE TABLE IF NOT EXISTS product_variants ("
     "  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  product_id  INT UNSIGNED  NOT NULL,"
     "  group_name  VARCHAR(80)   NOT NULL,"
     "  type        ENUM('size','color','weight','custom') NOT NULL DEFAULT 'custom',"
     "  sort_order  TINYINT       DEFAULT 0,"
     "  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 8. product_variant_options
    ("product_variant_options",
     "CREATE TABLE IF NOT EXISTS product_variant_options ("
     "  id           INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,"
     "  variant_id   INT UNSIGNED   NOT NULL,"
     "  label        VARCHAR(100)   NOT NULL,"
     "  hex_color    VARCHAR(7)     NULL,"
     "  price_adjust DECIMAL(8,2)   DEFAULT 0.00,"
     "  stock_adjust INT            DEFAULT 0,"
     "  is_popular   BOOLEAN        DEFAULT FALSE,"
     "  is_active    BOOLEAN        DEFAULT TRUE,"
     "  sort_order   TINYINT        DEFAULT 0,"
     "  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 9. product_images
    ("product_images",
     "CREATE TABLE IF NOT EXISTS product_images ("
     "  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  product_id  INT UNSIGNED  NOT NULL,"
     "  url         VARCHAR(500)  NOT NULL,"
     "  alt_text    VARCHAR(200)  NULL,"
     "  sort_order  TINYINT       DEFAULT 0,"
     "  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 10. cart
    ("cart",
     "CREATE TABLE IF NOT EXISTS cart ("
     "  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  user_id     INT UNSIGNED  NOT NULL,"
     "  merchant_id INT UNSIGNED  NOT NULL,"
     "  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
     "  UNIQUE KEY uq_cart_user_merchant (user_id, merchant_id),"
     "  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 11. cart_items
    ("cart_items",
     "CREATE TABLE IF NOT EXISTS cart_items ("
     "  id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  cart_id           INT UNSIGNED    NOT NULL,"
     "  product_id        INT UNSIGNED    NOT NULL,"
     "  quantity          SMALLINT        DEFAULT 1 NOT NULL,"
     "  selected_variants JSON            NULL,"
     "  unit_price        DECIMAL(10,2)   NOT NULL,"
     "  created_at        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (cart_id)    REFERENCES cart(id)     ON DELETE CASCADE,"
     "  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 12. promo_codes
    ("promo_codes",
     "CREATE TABLE IF NOT EXISTS promo_codes ("
     "  id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  merchant_id INT UNSIGNED    NOT NULL,"
     "  code        VARCHAR(30)     NOT NULL,"
     "  type        ENUM('percent','fixed') NOT NULL,"
     "  value       DECIMAL(8,2)    NOT NULL,"
     "  min_order   DECIMAL(10,2)   DEFAULT 0.00,"
     "  max_uses    INT UNSIGNED    NULL,"
     "  used_count  INT UNSIGNED    DEFAULT 0,"
     "  expires_at  DATE            NULL,"
     "  is_active   BOOLEAN         DEFAULT TRUE,"
     "  created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  UNIQUE KEY uq_promo_merchant_code (merchant_id, code),"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 13. orders
    ("orders",
     "CREATE TABLE IF NOT EXISTS orders ("
     "  id                  INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  order_code          VARCHAR(20)     UNIQUE NOT NULL,"
     "  user_id             INT UNSIGNED    NOT NULL,"
     "  merchant_id         INT UNSIGNED    NOT NULL,"
     "  promo_code_id       INT UNSIGNED    NULL,"
     "  subtotal            DECIMAL(10,2)   NOT NULL,"
     "  discount_amount     DECIMAL(10,2)   DEFAULT 0.00,"
     "  delivery_fee        DECIMAL(10,2)   DEFAULT 0.00,"
     "  total               DECIMAL(10,2)   NOT NULL,"
     "  status              ENUM('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',"
     "  payment_method      ENUM('khqr','cod','aba','wing') DEFAULT 'cod',"
     "  payment_status      ENUM('unpaid','paid','refunded') DEFAULT 'unpaid',"
     "  delivery_address    TEXT            NOT NULL,"
     "  delivery_province   VARCHAR(100)    NULL,"
     "  customer_note       TEXT            NULL,"
     "  admin_note          TEXT            NULL,"
     "  created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE RESTRICT,"
     "  FOREIGN KEY (merchant_id)   REFERENCES merchants(id)   ON DELETE RESTRICT,"
     "  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE SET NULL"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 14. order_items
    ("order_items",
     "CREATE TABLE IF NOT EXISTS order_items ("
     "  id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  order_id          INT UNSIGNED    NOT NULL,"
     "  product_id        INT UNSIGNED    NULL,"
     "  product_name      VARCHAR(200)    NOT NULL,"
     "  product_sku       VARCHAR(80)     NULL,"
     "  selected_variants JSON            NULL,"
     "  quantity          SMALLINT        NOT NULL,"
     "  unit_price        DECIMAL(10,2)   NOT NULL,"
     "  subtotal          DECIMAL(10,2)   NOT NULL,"
     "  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,"
     "  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 15. reviews
    ("reviews",
     "CREATE TABLE IF NOT EXISTS reviews ("
     "  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  product_id  INT UNSIGNED  NOT NULL,"
     "  user_id     INT UNSIGNED  NOT NULL,"
     "  order_id    INT UNSIGNED  NULL,"
     "  rating      TINYINT       NOT NULL,"
     "  comment     TEXT          NULL,"
     "  is_visible  BOOLEAN       DEFAULT TRUE,"
     "  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,"
     "  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),"
     "  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,"
     "  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,"
     "  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE SET NULL"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 16. promo_usages
    ("promo_usages",
     "CREATE TABLE IF NOT EXISTS promo_usages ("
     "  id               INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,"
     "  promo_code_id    INT UNSIGNED   NOT NULL,"
     "  user_id          INT UNSIGNED   NOT NULL,"
     "  order_id         INT UNSIGNED   NOT NULL,"
     "  discount_applied DECIMAL(8,2)   NOT NULL,"
     "  used_at          TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,"
     "  FOREIGN KEY (user_id)       REFERENCES users(id)       ON DELETE CASCADE,"
     "  FOREIGN KEY (order_id)      REFERENCES orders(id)      ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 17. notifications
    ("notifications",
     "CREATE TABLE IF NOT EXISTS notifications ("
     "  id      INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  user_id INT UNSIGNED    NOT NULL,"
     "  type    ENUM('order_update','promo','system') NOT NULL,"
     "  title   VARCHAR(200)    NOT NULL,"
     "  body    TEXT            NOT NULL,"
     "  ref_id  INT UNSIGNED    NULL,"
     "  is_read BOOLEAN         DEFAULT FALSE,"
     "  sent_at TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 18. telegram_sessions
    ("telegram_sessions",
     "CREATE TABLE IF NOT EXISTS telegram_sessions ("
     "  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,"
     "  user_id     INT UNSIGNED  NULL,"
     "  telegram_id BIGINT        NOT NULL,"
     "  state       VARCHAR(80)   NULL,"
     "  context     JSON          NULL,"
     "  merchant_id INT UNSIGNED  NULL,"
     "  expires_at  TIMESTAMP     NULL,"
     "  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE SET NULL,"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE SET NULL"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 19. support_tickets
    ("support_tickets",
     "CREATE TABLE IF NOT EXISTS support_tickets ("
     "  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  user_id       INT UNSIGNED    NOT NULL,"
     "  merchant_id   INT UNSIGNED    NOT NULL,"
     "  order_id      INT UNSIGNED    NULL,"
     "  subject       VARCHAR(200)    NOT NULL,"
     "  status        ENUM('open','replied','closed') DEFAULT 'open',"
     "  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  updated_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,"
     "  FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,"
     "  FOREIGN KEY (order_id)    REFERENCES orders(id)    ON DELETE SET NULL"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 20. ticket_messages
    ("ticket_messages",
     "CREATE TABLE IF NOT EXISTS ticket_messages ("
     "  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,"
     "  ticket_id     INT UNSIGNED    NOT NULL,"
     "  sender_type   ENUM('customer','merchant') NOT NULL,"
     "  sender_id     INT UNSIGNED    NOT NULL,"
     "  body          TEXT            NOT NULL,"
     "  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,"
     "  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),

    # 21. login_sessions
    ("login_sessions",
     "CREATE TABLE IF NOT EXISTS login_sessions ("
     "  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,"
     "  session_id VARCHAR(64)  UNIQUE NOT NULL,"
     "  jwt_token  TEXT         NULL,"
     "  user_id    INT UNSIGNED NULL,"
     "  status     ENUM('pending','completed','expired') DEFAULT 'pending',"
     "  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,"
     "  INDEX idx_login_session_id (session_id)"
     ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"),
]

INDEXES = [
    ("idx_users_telegram",     "users(telegram_id)"),
    ("idx_products_merchant",  "products(merchant_id, is_active, category_id)"),
    ("idx_products_featured",  "products(merchant_id, is_featured, is_active)"),
    ("idx_orders_merchant",    "orders(merchant_id, status, created_at)"),
    ("idx_orders_user",        "orders(user_id, created_at)"),
    ("idx_cart_user_merchant", "cart(user_id, merchant_id)"),
    ("idx_reviews_product",    "reviews(product_id, is_visible)"),
    ("idx_sessions_telegram",  "telegram_sessions(telegram_id)"),
    ("idx_tickets_merchant",   "support_tickets(merchant_id, status, created_at)"),
    ("idx_tickets_user",       "support_tickets(user_id, created_at)"),
    ("idx_ticket_messages",    "ticket_messages(ticket_id, created_at)"),
]

GLOBAL_CATEGORIES = [
    ("Fashion & Clothing", "\u179f\u1798\u17d2\u179b\u17b9\u1780\u1794\u1798\u17d0\u1780", "\U0001f457", 1),
    ("Electronics",        "\u17a2\u17be\u179b\u17b9\u1785\u178f\u17d2\u179a\u17bc\u1793\u17b9\u1785",  "\U0001f4f1", 2),
    ("Food & Beverages",   "\u1798\u17d2\u17a0\u17bc\u1794\u17a2\u17b6\u17a0\u17b6\u179a",              "\U0001f35c", 3),
    ("Beauty & Skincare",  "\u179f\u1798\u17d2\u1792\u179f\u17d2\u179f",                                 "\U0001f484", 4),
    ("Home & Living",      "\u178f\u17b6\u1793\u17b7\u1789\u1795\u17d2\u178f\u17b9\u17c4",              "\U0001f3e0", 5),
    ("Sports & Fitness",   "\u1780\u17b8\u179b\u17b6",                                                   "\u26bd", 6),
]


def run():
    print("🔧  MiniShopBot v2 — Database Setup\n")
    init_db_pool()

    print("📋  Creating tables...")
    for name, ddl in TABLES:
        try:
            execute_query(ddl, commit=True)
            print(f"    ✅  {name}")
        except Exception as e:
            print(f"    ⚠️   {name}: {e}")

    print("\n🔍  Creating indexes...")
    for idx_name, idx_cols in INDEXES:
        try:
            execute_query(f"CREATE INDEX {idx_name} ON {idx_cols}", commit=True)
            print(f"    ✅  {idx_name}")
        except Exception as e:
            if "Duplicate key name" in str(e):
                print(f"    ⏭   {idx_name} already exists")
            else:
                print(f"    ⚠️   {idx_name}: {e}")

    print("\n🏷️   Seeding global categories...")
    for cat_name, cat_kh, icon, order in GLOBAL_CATEGORIES:
        existing = execute_query(
            "SELECT id FROM categories WHERE name = %s AND merchant_id IS NULL",
            (cat_name,), fetch_one=True
        )
        if not existing:
            execute_query(
                "INSERT INTO categories (merchant_id, name, name_kh, icon_emoji, sort_order) VALUES (NULL, %s, %s, %s, %s)",
                (cat_name, cat_kh, icon, order), commit=True
            )
            print(f"    ✅  {icon} {cat_name}")
        else:
            print(f"    ⏭   {cat_name} already exists")

    print("\n🔐  Setting up Super Admin...")
    pw_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
    existing = execute_query(
        "SELECT id FROM super_admins WHERE email = %s",
        ("admin@digitalalchemy.com",), fetch_one=True
    )
    if existing:
        execute_query(
            "UPDATE super_admins SET password_hash = %s WHERE email = %s",
            (pw_hash, "admin@digitalalchemy.com"), commit=True
        )
        print("    ✅  Super Admin password reset")
    else:
        execute_query(
            "INSERT INTO super_admins (full_name, email, password_hash, is_active) VALUES (%s, %s, %s, TRUE)",
            ("Super Admin", "admin@digitalalchemy.com", pw_hash), commit=True
        )
        print("    ✅  Super Admin created")

    print("\n🎉  Setup complete!")
    print("    Super Admin  →  admin@digitalalchemy.com  /  admin123")
    print("    API Docs     →  http://localhost:8000/docs")
    print("    Dashboard    →  http://localhost:5173\n")


if __name__ == "__main__":
    run()

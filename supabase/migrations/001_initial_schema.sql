-- 001_initial_schema.sql
-- Translated from MySQL (backend/setup_db.py) → PostgreSQL for Supabase

-- ══════════════════════════════════════════════════════════════
-- ENUM TYPES
-- ══════════════════════════════════════════════════════════════

CREATE TYPE user_language AS ENUM ('en', 'kh');
CREATE TYPE merchant_plan AS ENUM ('Basic', 'Standard', 'Premium');
CREATE TYPE merchant_status AS ENUM ('active', 'suspended', 'pending-review');
CREATE TYPE admin_role AS ENUM ('owner', 'staff');
CREATE TYPE variant_type AS ENUM ('size', 'color', 'weight', 'custom');
CREATE TYPE promo_type AS ENUM ('percent', 'fixed');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_method AS ENUM ('khqr', 'cod', 'aba', 'wing');
CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
CREATE TYPE notification_type AS ENUM ('order_update', 'promo', 'system');
CREATE TYPE ticket_status AS ENUM ('open', 'replied', 'closed');
CREATE TYPE sender_type AS ENUM ('customer', 'merchant');
CREATE TYPE login_status AS ENUM ('pending', 'completed', 'expired');

-- ══════════════════════════════════════════════════════════════
-- TRIGGER FUNCTION: auto-update updated_at
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════
-- 1. users
-- ══════════════════════════════════════════════════════════════

CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  username    VARCHAR(64)   NULL,
  first_name  VARCHAR(100)  NOT NULL,
  last_name   VARCHAR(100)  NULL,
  phone       VARCHAR(20)   NULL,
  email       VARCHAR(150)  NULL,
  language    user_language DEFAULT 'en',
  address     TEXT          NULL,
  is_active   BOOLEAN       DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 2. merchants
-- ══════════════════════════════════════════════════════════════

CREATE TABLE merchants (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(150)    NOT NULL,
  slug            VARCHAR(100)    UNIQUE NOT NULL,
  owner_name      VARCHAR(150)    NOT NULL,
  email           VARCHAR(150)    UNIQUE NOT NULL,
  phone           VARCHAR(20)     NULL,
  tagline         VARCHAR(255)    NULL,
  description     TEXT            NULL,
  story           TEXT            NULL,
  location        VARCHAR(200)    NULL,
  icon_emoji      VARCHAR(8)      NULL,
  accent_color    VARCHAR(7)      NULL,
  plan            merchant_plan   DEFAULT 'Basic',
  telegram_token  VARCHAR(255)    NULL,
  deep_link_code  VARCHAR(50)     UNIQUE NULL,
  status          merchant_status DEFAULT 'pending-review',
  fb_page         VARCHAR(150)    NULL,
  instagram       VARCHAR(100)    NULL,
  created_at      TIMESTAMPTZ     DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

CREATE TRIGGER trg_merchants_updated_at
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 3. super_admins
-- ══════════════════════════════════════════════════════════════

CREATE TABLE super_admins (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(150)  NOT NULL,
  email         VARCHAR(150)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  is_active     BOOLEAN       DEFAULT TRUE,
  last_login    TIMESTAMPTZ   NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 4. merchant_admins
-- ══════════════════════════════════════════════════════════════

CREATE TABLE merchant_admins (
  id            SERIAL PRIMARY KEY,
  merchant_id   INT           NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  full_name     VARCHAR(150)  NOT NULL,
  email         VARCHAR(150)  UNIQUE NOT NULL,
  telegram_id   BIGINT        UNIQUE NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          admin_role    DEFAULT 'staff',
  is_active     BOOLEAN       DEFAULT TRUE,
  last_login    TIMESTAMPTZ   NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 5. categories
-- ══════════════════════════════════════════════════════════════

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  merchant_id INT           NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        VARCHAR(100)  NOT NULL,
  name_kh     VARCHAR(200)  NULL,
  icon_emoji  VARCHAR(8)    NULL,
  sort_order  INT           DEFAULT 0,
  is_active   BOOLEAN       DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 6. products
-- ══════════════════════════════════════════════════════════════

CREATE TABLE products (
  id            SERIAL PRIMARY KEY,
  merchant_id   INT             NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category_id   INT             NULL REFERENCES categories(id) ON DELETE SET NULL,
  name          VARCHAR(200)    NOT NULL,
  slug          VARCHAR(220)    NOT NULL,
  description   TEXT            NULL,
  sku           VARCHAR(80)     NULL,
  base_price    DECIMAL(10,2)   NOT NULL,
  compare_price DECIMAL(10,2)   NULL,
  stock         INT             DEFAULT 0,
  weight        VARCHAR(50)     NULL,
  delivery_days SMALLINT        DEFAULT 3,
  icon_emoji    VARCHAR(8)      NULL,
  rating_avg    DECIMAL(3,2)    DEFAULT 0.00,
  review_count  INT             DEFAULT 0,
  is_active     BOOLEAN         DEFAULT TRUE,
  is_featured   BOOLEAN         DEFAULT FALSE,
  created_at    TIMESTAMPTZ     DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 7. product_variants
-- ══════════════════════════════════════════════════════════════

CREATE TABLE product_variants (
  id          SERIAL PRIMARY KEY,
  product_id  INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_name  VARCHAR(80)   NOT NULL,
  type        variant_type  NOT NULL DEFAULT 'custom',
  sort_order  SMALLINT      DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 8. product_variant_options
-- ══════════════════════════════════════════════════════════════

CREATE TABLE product_variant_options (
  id           SERIAL PRIMARY KEY,
  variant_id   INT           NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  label        VARCHAR(100)  NOT NULL,
  hex_color    VARCHAR(7)    NULL,
  price_adjust DECIMAL(8,2)  DEFAULT 0.00,
  stock_adjust INT           DEFAULT 0,
  is_popular   BOOLEAN       DEFAULT FALSE,
  is_active    BOOLEAN       DEFAULT TRUE,
  sort_order   SMALLINT      DEFAULT 0
);

-- ══════════════════════════════════════════════════════════════
-- 9. product_images
-- ══════════════════════════════════════════════════════════════

CREATE TABLE product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         VARCHAR(500)  NOT NULL,
  alt_text    VARCHAR(200)  NULL,
  sort_order  SMALLINT      DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 10. cart
-- ══════════════════════════════════════════════════════════════

CREATE TABLE cart (
  id          SERIAL PRIMARY KEY,
  user_id     INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id INT           NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (user_id, merchant_id)
);

CREATE TRIGGER trg_cart_updated_at
  BEFORE UPDATE ON cart
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 11. cart_items
-- ══════════════════════════════════════════════════════════════

CREATE TABLE cart_items (
  id                SERIAL PRIMARY KEY,
  cart_id           INT             NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  product_id        INT             NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity          SMALLINT        DEFAULT 1 NOT NULL,
  selected_variants JSONB           NULL,
  unit_price        DECIMAL(10,2)   NOT NULL,
  created_at        TIMESTAMPTZ     DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 12. promo_codes
-- ══════════════════════════════════════════════════════════════

CREATE TABLE promo_codes (
  id          SERIAL PRIMARY KEY,
  merchant_id INT             NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  code        VARCHAR(30)     NOT NULL,
  type        promo_type      NOT NULL,
  value       DECIMAL(8,2)    NOT NULL,
  min_order   DECIMAL(10,2)   DEFAULT 0.00,
  max_uses    INT             NULL,
  used_count  INT             DEFAULT 0,
  expires_at  DATE            NULL,
  is_active   BOOLEAN         DEFAULT TRUE,
  created_at  TIMESTAMPTZ     DEFAULT NOW(),
  UNIQUE (merchant_id, code)
);

-- ══════════════════════════════════════════════════════════════
-- 13. orders
-- ══════════════════════════════════════════════════════════════

CREATE TABLE orders (
  id                  SERIAL PRIMARY KEY,
  order_code          VARCHAR(20)     UNIQUE NOT NULL,
  user_id             INT             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  merchant_id         INT             NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  promo_code_id       INT             NULL REFERENCES promo_codes(id) ON DELETE SET NULL,
  subtotal            DECIMAL(10,2)   NOT NULL,
  discount_amount     DECIMAL(10,2)   DEFAULT 0.00,
  delivery_fee        DECIMAL(10,2)   DEFAULT 0.00,
  total               DECIMAL(10,2)   NOT NULL,
  status              order_status    DEFAULT 'pending',
  payment_method      payment_method  DEFAULT 'cod',
  payment_status      payment_status  DEFAULT 'unpaid',
  delivery_address    TEXT            NOT NULL,
  delivery_province   VARCHAR(100)    NULL,
  customer_note       TEXT            NULL,
  admin_note          TEXT            NULL,
  created_at          TIMESTAMPTZ     DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     DEFAULT NOW()
);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 14. order_items
-- ══════════════════════════════════════════════════════════════

CREATE TABLE order_items (
  id                SERIAL PRIMARY KEY,
  order_id          INT             NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INT             NULL REFERENCES products(id) ON DELETE SET NULL,
  product_name      VARCHAR(200)    NOT NULL,
  product_sku       VARCHAR(80)     NULL,
  selected_variants JSONB           NULL,
  quantity          SMALLINT        NOT NULL,
  unit_price        DECIMAL(10,2)   NOT NULL,
  subtotal          DECIMAL(10,2)   NOT NULL
);

-- ══════════════════════════════════════════════════════════════
-- 15. reviews
-- ══════════════════════════════════════════════════════════════

CREATE TABLE reviews (
  id          SERIAL PRIMARY KEY,
  product_id  INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id    INT           NULL REFERENCES orders(id) ON DELETE SET NULL,
  rating      SMALLINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT          NULL,
  is_visible  BOOLEAN       DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 16. promo_usages
-- ══════════════════════════════════════════════════════════════

CREATE TABLE promo_usages (
  id               SERIAL PRIMARY KEY,
  promo_code_id    INT             NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id          INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id         INT             NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_applied DECIMAL(8,2)    NOT NULL,
  used_at          TIMESTAMPTZ     DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 17. notifications
-- ══════════════════════════════════════════════════════════════

CREATE TABLE notifications (
  id      SERIAL PRIMARY KEY,
  user_id INT               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type    notification_type NOT NULL,
  title   VARCHAR(200)      NOT NULL,
  body    TEXT              NOT NULL,
  ref_id  INT               NULL,
  is_read BOOLEAN           DEFAULT FALSE,
  sent_at TIMESTAMPTZ       DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 18. telegram_sessions
-- ══════════════════════════════════════════════════════════════

CREATE TABLE telegram_sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INT           NULL REFERENCES users(id) ON DELETE SET NULL,
  telegram_id BIGINT        NOT NULL,
  state       VARCHAR(80)   NULL,
  context     JSONB         NULL,
  merchant_id INT           NULL REFERENCES merchants(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ   NULL,
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TRIGGER trg_telegram_sessions_updated_at
  BEFORE UPDATE ON telegram_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 19. support_tickets
-- ══════════════════════════════════════════════════════════════

CREATE TABLE support_tickets (
  id            SERIAL PRIMARY KEY,
  user_id       INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id   INT             NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  order_id      INT             NULL REFERENCES orders(id) ON DELETE SET NULL,
  subject       VARCHAR(200)    NOT NULL,
  status        ticket_status   DEFAULT 'open',
  created_at    TIMESTAMPTZ     DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     DEFAULT NOW()
);

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- 20. ticket_messages
-- ══════════════════════════════════════════════════════════════

CREATE TABLE ticket_messages (
  id            SERIAL PRIMARY KEY,
  ticket_id     INT           NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type   sender_type   NOT NULL,
  sender_id     INT           NOT NULL,
  body          TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- 21. login_sessions
-- ══════════════════════════════════════════════════════════════

CREATE TABLE login_sessions (
  id         SERIAL PRIMARY KEY,
  session_id VARCHAR(64)    UNIQUE NOT NULL,
  jwt_token  TEXT           NULL,
  user_id    INT            NULL,
  status     login_status   DEFAULT 'pending',
  created_at TIMESTAMPTZ    DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════

CREATE INDEX idx_users_telegram      ON users(telegram_id);
CREATE INDEX idx_products_merchant    ON products(merchant_id, is_active, category_id);
CREATE INDEX idx_products_featured    ON products(merchant_id, is_featured, is_active);
CREATE INDEX idx_orders_merchant      ON orders(merchant_id, status, created_at);
CREATE INDEX idx_orders_user          ON orders(user_id, created_at);
CREATE INDEX idx_cart_user_merchant   ON cart(user_id, merchant_id);
CREATE INDEX idx_reviews_product      ON reviews(product_id, is_visible);
CREATE INDEX idx_sessions_telegram    ON telegram_sessions(telegram_id);
CREATE INDEX idx_tickets_merchant     ON support_tickets(merchant_id, status, created_at);
CREATE INDEX idx_tickets_user         ON support_tickets(user_id, created_at);
CREATE INDEX idx_ticket_messages      ON ticket_messages(ticket_id, created_at);

-- ══════════════════════════════════════════════════════════════
-- SEED: Global Categories
-- ══════════════════════════════════════════════════════════════

INSERT INTO categories (merchant_id, name, name_kh, icon_emoji, sort_order) VALUES
  (NULL, 'Fashion & Clothing', 'សម្លឹកបំពាក់', '👗', 1),
  (NULL, 'Electronics',        'អេឡិចត្រូនីច',  '📱', 2),
  (NULL, 'Food & Beverages',   'មហូបអាហារ',      '🍜', 3),
  (NULL, 'Beauty & Skincare',  'សម្ធស្ស',         '💄', 4),
  (NULL, 'Home & Living',      'តានិញផ្តើោ',      '🏠', 5),
  (NULL, 'Sports & Fitness',   'កីឡា',            '⚽', 6)
ON CONFLICT DO NOTHING;

-- 004_add_missing_tables.sql
-- Run this in Supabase SQL Editor to create tables missing from your current schema.
-- Your existing tables: categories, merchants, order_items, orders, products,
--                       profiles, promo_codes, support_tickets, ticket_messages, users
--
-- This creates: cart, cart_items, product_images, product_variants,
--               product_variant_options, reviews, promo_usages, notifications,
--               telegram_sessions, login_sessions

-- ══════════════════════════════════════════════════════════════
-- ENUM TYPES (create if not exist)
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE variant_type AS ENUM ('size', 'color', 'weight', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('order_update', 'promo', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sender_type AS ENUM ('customer', 'merchant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE login_status AS ENUM ('pending', 'completed', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ══════════════════════════════════════════════════════════════
-- TRIGGER FUNCTION
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════
-- product_images
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         VARCHAR(500)  NOT NULL,
  alt_text    VARCHAR(200)  NULL,
  sort_order  SMALLINT      DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- product_variants
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_variants (
  id          SERIAL PRIMARY KEY,
  product_id  INT           NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_name  VARCHAR(80)   NOT NULL,
  type        variant_type  NOT NULL DEFAULT 'custom',
  sort_order  SMALLINT      DEFAULT 0,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- product_variant_options
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_variant_options (
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
-- cart
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cart (
  id          SERIAL PRIMARY KEY,
  user_id     INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  merchant_id INT           NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (user_id, merchant_id)
);

CREATE OR REPLACE TRIGGER trg_cart_updated_at
  BEFORE UPDATE ON cart
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- cart_items
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cart_items (
  id                SERIAL PRIMARY KEY,
  cart_id           INT             NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
  product_id        INT             NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity          SMALLINT        DEFAULT 1 NOT NULL,
  selected_variants JSONB           NULL,
  unit_price        DECIMAL(10,2)   NOT NULL,
  created_at        TIMESTAMPTZ     DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- reviews
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reviews (
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
-- promo_usages
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS promo_usages (
  id               SERIAL PRIMARY KEY,
  promo_code_id    INT             NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id          INT             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id         INT             NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_applied DECIMAL(8,2)    NOT NULL,
  used_at          TIMESTAMPTZ     DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- notifications
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
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
-- telegram_sessions
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS telegram_sessions (
  id          SERIAL PRIMARY KEY,
  user_id     INT           NULL REFERENCES users(id) ON DELETE SET NULL,
  telegram_id BIGINT        NOT NULL,
  state       VARCHAR(80)   NULL,
  context     JSONB         NULL,
  merchant_id INT           NULL REFERENCES merchants(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ   NULL,
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_telegram_sessions_updated_at
  BEFORE UPDATE ON telegram_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════
-- login_sessions (needed for Telegram web login flow)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS login_sessions (
  id         SERIAL PRIMARY KEY,
  session_id VARCHAR(64)    UNIQUE NOT NULL,
  jwt_token  TEXT           NULL,
  user_id    INT            NULL,
  status     login_status   DEFAULT 'pending',
  created_at TIMESTAMPTZ    DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- INDEXES for new tables
-- ══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_cart_user_merchant   ON cart(user_id, merchant_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product      ON reviews(product_id, is_visible);
CREATE INDEX IF NOT EXISTS idx_sessions_telegram    ON telegram_sessions(telegram_id);

-- ══════════════════════════════════════════════════════════════
-- RLS: Enable and add policies for new tables
-- ══════════════════════════════════════════════════════════════

ALTER TABLE product_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_usages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions         ENABLE ROW LEVEL SECURITY;

-- Public read for product-related tables
CREATE POLICY product_images_public_read ON product_images FOR SELECT USING (TRUE);
CREATE POLICY product_variants_public_read ON product_variants FOR SELECT USING (TRUE);
CREATE POLICY product_variant_options_public_read ON product_variant_options FOR SELECT USING (is_active = TRUE);
CREATE POLICY reviews_public_read ON reviews FOR SELECT USING (is_visible = TRUE);

-- Login sessions: open access (used pre-auth)
CREATE POLICY login_sessions_public_select ON login_sessions FOR SELECT USING (TRUE);
CREATE POLICY login_sessions_public_insert ON login_sessions FOR INSERT WITH CHECK (TRUE);
CREATE POLICY login_sessions_public_update ON login_sessions FOR UPDATE USING (TRUE);

-- Cart: auth'd user own data (using auth.user_id() if available, otherwise open for now)
CREATE POLICY cart_select ON cart FOR SELECT USING (TRUE);
CREATE POLICY cart_insert ON cart FOR INSERT WITH CHECK (TRUE);
CREATE POLICY cart_update ON cart FOR UPDATE USING (TRUE);
CREATE POLICY cart_delete ON cart FOR DELETE USING (TRUE);

CREATE POLICY cart_items_select ON cart_items FOR SELECT USING (TRUE);
CREATE POLICY cart_items_insert ON cart_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY cart_items_update ON cart_items FOR UPDATE USING (TRUE);
CREATE POLICY cart_items_delete ON cart_items FOR DELETE USING (TRUE);

-- Notifications: auth'd user (open for now)
CREATE POLICY notifications_select ON notifications FOR SELECT USING (TRUE);
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (TRUE);

-- Service-only tables
CREATE POLICY promo_usages_deny ON promo_usages FOR SELECT USING (FALSE);
CREATE POLICY telegram_sessions_deny ON telegram_sessions FOR SELECT USING (FALSE);

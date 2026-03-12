-- 003_rls_policies.sql
-- Row Level Security policies for all tables

-- ══════════════════════════════════════════════════════════════
-- Helper: resolve JWT telegram_id claim → users.id
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.users
  WHERE telegram_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'telegram_id')::BIGINT
  LIMIT 1;
$$;

-- ══════════════════════════════════════════════════════════════
-- Enable RLS on all tables
-- ══════════════════════════════════════════════════════════════

ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products               ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variant_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_usages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions         ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- PUBLIC READ: merchants (active)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY merchants_public_read ON merchants
  FOR SELECT USING (status = 'active');

-- ══════════════════════════════════════════════════════════════
-- PUBLIC READ: categories (active)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY categories_public_read ON categories
  FOR SELECT USING (is_active = TRUE);

-- ══════════════════════════════════════════════════════════════
-- PUBLIC READ: products (active)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY products_public_read ON products
  FOR SELECT USING (is_active = TRUE);

-- ══════════════════════════════════════════════════════════════
-- PUBLIC READ: product_variants, product_variant_options, product_images
-- ══════════════════════════════════════════════════════════════

CREATE POLICY product_variants_public_read ON product_variants
  FOR SELECT USING (TRUE);

CREATE POLICY product_variant_options_public_read ON product_variant_options
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY product_images_public_read ON product_images
  FOR SELECT USING (TRUE);

-- ══════════════════════════════════════════════════════════════
-- PUBLIC READ: reviews (visible only)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY reviews_public_read ON reviews
  FOR SELECT USING (is_visible = TRUE);

-- ══════════════════════════════════════════════════════════════
-- PUBLIC READ: promo_codes (active ones)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY promo_codes_public_read ON promo_codes
  FOR SELECT USING (
    is_active = TRUE
    AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
    AND (max_uses IS NULL OR used_count < max_uses)
  );

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: users — own row only
-- ══════════════════════════════════════════════════════════════

CREATE POLICY users_own_read ON users
  FOR SELECT USING (id = auth.user_id());

CREATE POLICY users_own_update ON users
  FOR UPDATE USING (id = auth.user_id());

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: cart — own data
-- ══════════════════════════════════════════════════════════════

CREATE POLICY cart_own_select ON cart
  FOR SELECT USING (user_id = auth.user_id());

CREATE POLICY cart_own_insert ON cart
  FOR INSERT WITH CHECK (user_id = auth.user_id());

CREATE POLICY cart_own_update ON cart
  FOR UPDATE USING (user_id = auth.user_id());

CREATE POLICY cart_own_delete ON cart
  FOR DELETE USING (user_id = auth.user_id());

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: cart_items — own data (via cart)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY cart_items_own_select ON cart_items
  FOR SELECT USING (
    cart_id IN (SELECT id FROM cart WHERE user_id = auth.user_id())
  );

CREATE POLICY cart_items_own_insert ON cart_items
  FOR INSERT WITH CHECK (
    cart_id IN (SELECT id FROM cart WHERE user_id = auth.user_id())
  );

CREATE POLICY cart_items_own_update ON cart_items
  FOR UPDATE USING (
    cart_id IN (SELECT id FROM cart WHERE user_id = auth.user_id())
  );

CREATE POLICY cart_items_own_delete ON cart_items
  FOR DELETE USING (
    cart_id IN (SELECT id FROM cart WHERE user_id = auth.user_id())
  );

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: orders — own data
-- ══════════════════════════════════════════════════════════════

CREATE POLICY orders_own_select ON orders
  FOR SELECT USING (user_id = auth.user_id());

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: order_items — own data (via orders)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY order_items_own_select ON order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.user_id())
  );

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: notifications — own data
-- ══════════════════════════════════════════════════════════════

CREATE POLICY notifications_own_select ON notifications
  FOR SELECT USING (user_id = auth.user_id());

CREATE POLICY notifications_own_update ON notifications
  FOR UPDATE USING (user_id = auth.user_id());

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: support_tickets — own data
-- ══════════════════════════════════════════════════════════════

CREATE POLICY support_tickets_own_select ON support_tickets
  FOR SELECT USING (user_id = auth.user_id());

CREATE POLICY support_tickets_own_insert ON support_tickets
  FOR INSERT WITH CHECK (user_id = auth.user_id());

-- ══════════════════════════════════════════════════════════════
-- AUTH'D USER: ticket_messages — own tickets
-- ══════════════════════════════════════════════════════════════

CREATE POLICY ticket_messages_own_select ON ticket_messages
  FOR SELECT USING (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.user_id())
  );

CREATE POLICY ticket_messages_own_insert ON ticket_messages
  FOR INSERT WITH CHECK (
    ticket_id IN (SELECT id FROM support_tickets WHERE user_id = auth.user_id())
  );

-- ══════════════════════════════════════════════════════════════
-- OPEN ACCESS: login_sessions (used pre-auth)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY login_sessions_public_select ON login_sessions
  FOR SELECT USING (TRUE);

CREATE POLICY login_sessions_public_insert ON login_sessions
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY login_sessions_public_update ON login_sessions
  FOR UPDATE USING (TRUE);

-- ══════════════════════════════════════════════════════════════
-- SERVICE-ONLY: super_admins, merchant_admins, telegram_sessions, promo_usages
-- (No public/anon access — managed via service_role key in Edge Functions)
-- ══════════════════════════════════════════════════════════════

CREATE POLICY super_admins_deny ON super_admins
  FOR SELECT USING (FALSE);

CREATE POLICY merchant_admins_deny ON merchant_admins
  FOR SELECT USING (FALSE);

CREATE POLICY telegram_sessions_deny ON telegram_sessions
  FOR SELECT USING (FALSE);

CREATE POLICY promo_usages_deny ON promo_usages
  FOR SELECT USING (FALSE);

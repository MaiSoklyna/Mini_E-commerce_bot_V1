-- 006_admin_rls_policies.sql
-- Run in Supabase SQL Editor — safe to re-run

-- ══════════════════════════════════════════
-- STEP 1: Helper function
-- ══════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'app_role',
    ''
  );
$$;

-- ══════════════════════════════════════════
-- STEP 2: Drop old policies (safe re-run)
-- ══════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE '%_admin_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ══════════════════════════════════════════
-- STEP 3: Admin policies (simple, no joins)
-- Scoping by merchant is handled in the
-- dashboard service layer, not RLS.
-- ══════════════════════════════════════════

-- merchants
CREATE POLICY admin_select_merchants ON merchants
  FOR SELECT USING (public.get_app_role() IN ('super_admin','merchant'));
CREATE POLICY admin_write_merchants ON merchants
  FOR ALL USING (public.get_app_role() = 'super_admin');

-- products
CREATE POLICY admin_all_products ON products
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

-- categories
CREATE POLICY admin_all_categories ON categories
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

-- orders
CREATE POLICY admin_all_orders ON orders
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

-- order_items
CREATE POLICY admin_all_order_items ON order_items
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

-- users
CREATE POLICY admin_select_users ON users
  FOR SELECT USING (public.get_app_role() IN ('super_admin','merchant'));
CREATE POLICY admin_update_users ON users
  FOR UPDATE USING (public.get_app_role() = 'super_admin');

-- promo_codes
CREATE POLICY admin_all_promo_codes ON promo_codes
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

-- support_tickets
CREATE POLICY admin_all_support_tickets ON support_tickets
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

-- ticket_messages
CREATE POLICY admin_all_ticket_messages ON ticket_messages
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

-- notifications
CREATE POLICY admin_all_notifications ON notifications
  FOR ALL USING (public.get_app_role() IN ('super_admin','merchant'));

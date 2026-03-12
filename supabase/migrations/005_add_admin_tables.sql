-- 005_add_admin_tables.sql
-- Run this in Supabase SQL Editor to create admin tables if they don't exist.
-- Needed for: admin-login, admin-tg-session, admin-poll-session,
--             admin-update-profile, admin-change-password Edge Functions

-- ══════════════════════════════════════════════════════════════
-- super_admins
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS super_admins (
  id            SERIAL PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- merchant_admins
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS merchant_admins (
  id            SERIAL PRIMARY KEY,
  merchant_id   INT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(30)  DEFAULT 'admin',
  is_active     BOOLEAN DEFAULT TRUE,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_admins_merchant ON merchant_admins(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_admins_email    ON merchant_admins(email);

-- ══════════════════════════════════════════════════════════════
-- RLS: deny anon access, only service_role can read/write
-- ══════════════════════════════════════════════════════════════

ALTER TABLE super_admins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_admins ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (idempotent)
DROP POLICY IF EXISTS super_admins_deny    ON super_admins;
DROP POLICY IF EXISTS merchant_admins_deny ON merchant_admins;

CREATE POLICY super_admins_deny ON super_admins
  FOR ALL USING (FALSE);

CREATE POLICY merchant_admins_deny ON merchant_admins
  FOR ALL USING (FALSE);

-- ══════════════════════════════════════════════════════════════
-- Seed a default super admin (password: admin123)
-- Change this password immediately after first login!
-- ══════════════════════════════════════════════════════════════

INSERT INTO super_admins (full_name, email, password_hash)
VALUES (
  'Super Admin',
  'admin@favouriteshop.com',
  -- bcrypt hash of 'admin123'
  '$2b$12$LJ3m4ys3Lz0JKzNFaYvLPOXORYJmCKzWG/Kv8RGH5Oknl9p8zBGy6'
)
ON CONFLICT (email) DO NOTHING;

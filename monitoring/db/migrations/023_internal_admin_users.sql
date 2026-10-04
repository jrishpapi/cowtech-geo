CREATE TABLE IF NOT EXISTS internal_admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  display_name TEXT NOT NULL,
  disabled_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role IN ('viewer', 'operator', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_internal_admin_users_role ON internal_admin_users (role);
CREATE INDEX IF NOT EXISTS idx_internal_admin_users_disabled ON internal_admin_users (disabled_at);

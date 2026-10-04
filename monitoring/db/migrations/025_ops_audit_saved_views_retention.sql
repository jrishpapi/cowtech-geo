CREATE TABLE IF NOT EXISTS internal_ops_audit_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_username TEXT NOT NULL,
  updated_by_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_ops_audit_saved_views_name
  ON internal_ops_audit_saved_views (lower(name));

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_saved_views_updated_at
  ON internal_ops_audit_saved_views (updated_at DESC);

CREATE TABLE IF NOT EXISTS internal_ops_audit_retention_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  retention_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 30 AND 3650),
  updated_by_username TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO internal_ops_audit_retention_settings (id, retention_days, updated_by_username)
VALUES (TRUE, 365, 'system')
ON CONFLICT (id) DO NOTHING;

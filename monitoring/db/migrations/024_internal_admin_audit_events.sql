CREATE TABLE IF NOT EXISTS internal_admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_username TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id UUID REFERENCES internal_admin_users(id) ON DELETE SET NULL,
  target_username TEXT NOT NULL,
  before_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_admin_audit_events_created_at ON internal_admin_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_internal_admin_audit_events_actor ON internal_admin_audit_events (actor_username);
CREATE INDEX IF NOT EXISTS idx_internal_admin_audit_events_target ON internal_admin_audit_events (target_username);
CREATE INDEX IF NOT EXISTS idx_internal_admin_audit_events_action ON internal_admin_audit_events (action);

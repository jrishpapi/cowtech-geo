CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_policy (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_priority TEXT NOT NULL DEFAULT 'normal',
  notify_overdue BOOLEAN NOT NULL DEFAULT true,
  notify_due_soon BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  adapters JSONB NOT NULL DEFAULT '{"webhook": true, "email": false}'::jsonb,
  updated_by_username TEXT,
  updated_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_notification_policy_id_check
    CHECK (id = 'default'),
  CONSTRAINT internal_ops_audit_notification_policy_min_priority_check
    CHECK (min_priority IN ('low', 'normal', 'high', 'critical')),
  CONSTRAINT internal_ops_audit_notification_policy_quiet_start_check
    CHECK (quiet_hours_start ~ '^[0-2][0-9]:[0-5][0-9]$'),
  CONSTRAINT internal_ops_audit_notification_policy_quiet_end_check
    CHECK (quiet_hours_end ~ '^[0-2][0-9]:[0-5][0-9]$')
);

INSERT INTO internal_ops_audit_notification_policy (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES internal_ops_audit_evidence_case_notifications(id) ON DELETE CASCADE,
  adapter TEXT NOT NULL,
  status TEXT NOT NULL,
  destination_label TEXT NOT NULL,
  reason TEXT,
  payload_hash TEXT NOT NULL,
  attempted_by_username TEXT NOT NULL,
  attempted_by_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_notification_delivery_adapter_check
    CHECK (adapter IN ('webhook', 'email')),
  CONSTRAINT internal_ops_audit_notification_delivery_status_check
    CHECK (status IN ('stubbed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_delivery_notification
  ON internal_ops_audit_notification_delivery_attempts (notification_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_delivery_status
  ON internal_ops_audit_notification_delivery_attempts (status, adapter, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  kind TEXT NOT NULL,
  priority TEXT NOT NULL,
  adapter TEXT NOT NULL DEFAULT 'webhook',
  repeat_interval_minutes INTEGER NOT NULL DEFAULT 60,
  suppression_window_minutes INTEGER NOT NULL DEFAULT 60,
  escalation_assignee_username TEXT,
  escalation_assignee_role TEXT,
  created_by_username TEXT,
  created_by_role TEXT,
  updated_by_username TEXT,
  updated_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_notification_rules_kind_check
    CHECK (kind IN ('overdue', 'due_soon')),
  CONSTRAINT internal_ops_audit_notification_rules_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  CONSTRAINT internal_ops_audit_notification_rules_adapter_check
    CHECK (adapter IN ('webhook', 'email')),
  CONSTRAINT internal_ops_audit_notification_rules_repeat_check
    CHECK (repeat_interval_minutes BETWEEN 5 AND 10080),
  CONSTRAINT internal_ops_audit_notification_rules_suppression_check
    CHECK (suppression_window_minutes BETWEEN 0 AND 10080)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_rules_kind_priority
  ON internal_ops_audit_notification_rules (kind, priority);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_rules_enabled
  ON internal_ops_audit_notification_rules (enabled, kind, priority);

ALTER TABLE internal_ops_audit_notification_delivery_attempts
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES internal_ops_audit_notification_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalation_assignee_username TEXT,
  ADD COLUMN IF NOT EXISTS escalation_assignee_role TEXT,
  ADD COLUMN IF NOT EXISTS repeat_interval_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS suppression_window_minutes INTEGER;

INSERT INTO internal_ops_audit_notification_rules (
  name,
  kind,
  priority,
  adapter,
  repeat_interval_minutes,
  suppression_window_minutes,
  escalation_assignee_username,
  escalation_assignee_role
)
VALUES
  ('Critical overdue escalation', 'overdue', 'critical', 'webhook', 15, 60, 'ops-lead', 'operator'),
  ('Critical due-soon warning', 'due_soon', 'critical', 'webhook', 60, 120, 'ops-lead', 'operator'),
  ('High overdue escalation', 'overdue', 'high', 'webhook', 30, 90, 'ops-lead', 'operator')
ON CONFLICT (kind, priority) DO NOTHING;

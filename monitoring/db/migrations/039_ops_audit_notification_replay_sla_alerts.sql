CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_replay_sla_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acked', 'snoozed', 'resolved')),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'critical')),
  scope TEXT NOT NULL CHECK (scope IN ('summary', 'reviewer')),
  reviewer_username TEXT,
  reviewer_role TEXT,
  metric TEXT NOT NULL,
  value_numeric NUMERIC,
  threshold_numeric NUMERIC,
  message TEXT NOT NULL,
  report_hash TEXT,
  threshold_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_alert JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by_username TEXT NOT NULL,
  generated_by_role TEXT NOT NULL,
  routed_to_username TEXT,
  routed_to_role TEXT,
  acknowledged_by_username TEXT,
  acknowledged_by_role TEXT,
  acknowledged_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  resolved_by_username TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  action_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_replay_sla_alerts_status
  ON internal_ops_audit_notification_replay_sla_alerts(status, severity, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_replay_sla_alerts_reviewer
  ON internal_ops_audit_notification_replay_sla_alerts(reviewer_username, reviewer_role, status);

CREATE INDEX IF NOT EXISTS idx_internal_ops_replay_sla_alerts_metric
  ON internal_ops_audit_notification_replay_sla_alerts(metric, severity, status);

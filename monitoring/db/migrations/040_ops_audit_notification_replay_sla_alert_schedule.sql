CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_replay_sla_alert_schedule (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (interval_minutes BETWEEN 5 AND 10080),
  due_soon_hours INTEGER NOT NULL DEFAULT 4 CHECK (due_soon_hours BETWEEN 1 AND 168),
  alert_limit INTEGER NOT NULL DEFAULT 100 CHECK (alert_limit BETWEEN 1 AND 500),
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by_username TEXT,
  updated_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO internal_ops_audit_notification_replay_sla_alert_schedule (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

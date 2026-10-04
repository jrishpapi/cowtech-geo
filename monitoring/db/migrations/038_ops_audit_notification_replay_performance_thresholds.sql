CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_replay_performance_thresholds (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  max_expired_backlog_count INTEGER NOT NULL DEFAULT 0,
  max_near_expiry_backlog_count INTEGER NOT NULL DEFAULT 2,
  max_unassigned_backlog_count INTEGER NOT NULL DEFAULT 0,
  max_expired_backlog_rate NUMERIC(5,4) NOT NULL DEFAULT 0.2500,
  max_average_review_minutes INTEGER NOT NULL DEFAULT 240,
  max_average_execute_minutes INTEGER NOT NULL DEFAULT 120,
  max_average_workload_action_minutes INTEGER NOT NULL DEFAULT 120,
  updated_by_username TEXT,
  updated_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_notification_replay_performance_thresholds_id_check
    CHECK (id = 'default'),
  CONSTRAINT internal_ops_audit_notification_replay_performance_thresholds_count_check
    CHECK (
      max_expired_backlog_count BETWEEN 0 AND 10000 AND
      max_near_expiry_backlog_count BETWEEN 0 AND 10000 AND
      max_unassigned_backlog_count BETWEEN 0 AND 10000
    ),
  CONSTRAINT internal_ops_audit_notification_replay_performance_thresholds_rate_check
    CHECK (max_expired_backlog_rate BETWEEN 0 AND 1),
  CONSTRAINT internal_ops_audit_notification_replay_performance_thresholds_latency_check
    CHECK (
      max_average_review_minutes BETWEEN 1 AND 10080 AND
      max_average_execute_minutes BETWEEN 1 AND 10080 AND
      max_average_workload_action_minutes BETWEEN 1 AND 10080
    )
);

INSERT INTO internal_ops_audit_notification_replay_performance_thresholds (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

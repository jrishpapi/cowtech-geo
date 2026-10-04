CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_anomaly_notification_digest_schedule (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_minutes INTEGER NOT NULL DEFAULT 1440 CHECK (interval_minutes BETWEEN 15 AND 10080),
  notification_limit INTEGER NOT NULL DEFAULT 100 CHECK (notification_limit BETWEEN 1 AND 500),
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 3650),
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

INSERT INTO internal_ops_audit_evidence_case_anomaly_notification_digest_schedule (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  requested_by_username TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  retention_days INTEGER NOT NULL CHECK (retention_days BETWEEN 1 AND 3650),
  cutoff_at TIMESTAMPTZ NOT NULL,
  executed BOOLEAN NOT NULL DEFAULT FALSE,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  retained_count INTEGER NOT NULL DEFAULT 0,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_anomaly_notification_digest_retention_receipts_created_at
  ON internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_anomaly_notification_digest_retention_receipts_actor
  ON internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts (requested_by_username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_anomaly_notification_digest_retention_receipts_hash
  ON internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts (receipt_hash);

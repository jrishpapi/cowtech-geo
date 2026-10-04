CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts (
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

CREATE INDEX IF NOT EXISTS idx_internal_ops_replay_sla_alert_digest_retention_receipts_created_at
  ON internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_replay_sla_alert_digest_retention_receipts_actor
  ON internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts (requested_by_username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_replay_sla_alert_digest_retention_receipts_hash
  ON internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts (receipt_hash);

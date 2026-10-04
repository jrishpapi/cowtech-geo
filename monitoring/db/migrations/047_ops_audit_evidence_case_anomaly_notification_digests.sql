CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_anomaly_notification_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id TEXT NOT NULL UNIQUE,
  digest_hash TEXT NOT NULL UNIQUE,
  html_hash TEXT NOT NULL,
  requested_by_username TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  digest JSONB NOT NULL,
  html_snapshot TEXT NOT NULL,
  notification_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_anomaly_notification_digests_created_at
  ON internal_ops_audit_evidence_case_anomaly_notification_digests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_anomaly_notification_digests_requested_by
  ON internal_ops_audit_evidence_case_anomaly_notification_digests (requested_by_username, created_at DESC);

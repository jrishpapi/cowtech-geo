CREATE TABLE IF NOT EXISTS internal_ops_audit_report_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id UUID NOT NULL REFERENCES internal_ops_audit_report_archives(id) ON DELETE CASCADE,
  identifier TEXT NOT NULL,
  verifier_username TEXT NOT NULL,
  verifier_role TEXT NOT NULL,
  receipt_hash TEXT NOT NULL,
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_report_verifications_created_at
  ON internal_ops_audit_report_verifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_report_verifications_archive
  ON internal_ops_audit_report_verifications (archive_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_report_verifications_receipt_hash
  ON internal_ops_audit_report_verifications (receipt_hash);

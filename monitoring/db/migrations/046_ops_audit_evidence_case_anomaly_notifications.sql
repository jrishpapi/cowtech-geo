ALTER TABLE internal_ops_audit_evidence_case_notifications
  ADD COLUMN IF NOT EXISTS case_kind TEXT NOT NULL DEFAULT 'evidence_case';

ALTER TABLE internal_ops_audit_evidence_case_notifications
  ADD COLUMN IF NOT EXISTS bundle_verification_receipt_hash TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'internal_ops_audit_evidence_case_notifications_case_kind_check'
  ) THEN
    ALTER TABLE internal_ops_audit_evidence_case_notifications
      ADD CONSTRAINT internal_ops_audit_evidence_case_notifications_case_kind_check
      CHECK (case_kind IN ('evidence_case', 'bundle_anomaly_review'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_notifications_case_kind
  ON internal_ops_audit_evidence_case_notifications (case_kind, status, due_at);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_notifications_bundle_receipt
  ON internal_ops_audit_evidence_case_notifications (bundle_verification_receipt_hash)
  WHERE bundle_verification_receipt_hash IS NOT NULL;

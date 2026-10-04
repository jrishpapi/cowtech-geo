ALTER TABLE internal_ops_audit_evidence_case_reviews
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE internal_ops_audit_evidence_case_reviews
  ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'internal_ops_audit_evidence_case_reviews_priority_check'
  ) THEN
    ALTER TABLE internal_ops_audit_evidence_case_reviews
      ADD CONSTRAINT internal_ops_audit_evidence_case_reviews_priority_check
      CHECK (priority IN ('low', 'normal', 'high', 'critical'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_reviews_due_at
  ON internal_ops_audit_evidence_case_reviews (due_at)
  WHERE status IN ('open', 'in_review');

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_reviews_priority
  ON internal_ops_audit_evidence_case_reviews (priority, status, due_at);

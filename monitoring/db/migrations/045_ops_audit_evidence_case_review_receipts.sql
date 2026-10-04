CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_review_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES internal_ops_audit_evidence_case_reviews(id) ON DELETE CASCADE,
  receipt_hash TEXT NOT NULL UNIQUE,
  reviewer_username TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_status TEXT,
  status TEXT NOT NULL,
  packet_hash TEXT NOT NULL,
  bundle_verification_receipts JSONB NOT NULL DEFAULT '[]'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_evidence_case_review_receipts_action_check
    CHECK (action IN ('opened', 'updated', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_review_receipts_case_id
  ON internal_ops_audit_evidence_case_review_receipts (case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_review_receipts_packet_hash
  ON internal_ops_audit_evidence_case_review_receipts (packet_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_review_receipts_status
  ON internal_ops_audit_evidence_case_review_receipts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_review_receipts_reviewer
  ON internal_ops_audit_evidence_case_review_receipts (reviewer_username, created_at DESC);

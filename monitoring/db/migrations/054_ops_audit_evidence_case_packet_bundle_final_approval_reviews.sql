CREATE TABLE IF NOT EXISTS internal_ops_audit_bundle_final_approval_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  final_approval_receipt_id UUID NOT NULL REFERENCES internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts(id) ON DELETE CASCADE,
  receipt_hash TEXT NOT NULL UNIQUE,
  final_approval_receipt_hash TEXT NOT NULL,
  reviewer_username TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  action TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  approval_preview_hash TEXT NOT NULL,
  decision TEXT NOT NULL,
  approval_status TEXT NOT NULL,
  packet_hash TEXT NOT NULL,
  manifest_hash TEXT,
  handoff_preview_receipt_hash TEXT,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ops_bundle_final_approval_review_action_check
    CHECK (action IN ('confirmed', 'revoked', 'expired')),
  CONSTRAINT ops_bundle_final_approval_review_lifecycle_status_check
    CHECK (lifecycle_status IN ('confirmed', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_reviews_final_receipt
  ON internal_ops_audit_bundle_final_approval_reviews (final_approval_receipt_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_reviews_final_hash
  ON internal_ops_audit_bundle_final_approval_reviews (final_approval_receipt_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_reviews_reviewer
  ON internal_ops_audit_bundle_final_approval_reviews (reviewer_username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_reviews_action
  ON internal_ops_audit_bundle_final_approval_reviews (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_reviews_packet_hash
  ON internal_ops_audit_bundle_final_approval_reviews (packet_hash, created_at DESC);

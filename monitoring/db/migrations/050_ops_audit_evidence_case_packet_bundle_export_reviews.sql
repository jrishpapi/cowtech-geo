CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_packet_bundle_export_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_export_id UUID NOT NULL REFERENCES internal_ops_audit_evidence_case_packet_bundle_exports(id) ON DELETE CASCADE,
  receipt_hash TEXT NOT NULL UNIQUE,
  bundle_export_receipt_hash TEXT NOT NULL,
  reviewer_username TEXT NOT NULL,
  reviewer_role TEXT NOT NULL,
  action TEXT NOT NULL,
  purpose TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  bundle_manifest_hash TEXT NOT NULL,
  bundle_packet_hash TEXT NOT NULL,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_evidence_case_packet_bundle_export_reviews_action_check
    CHECK (action IN ('attested', 'rejected', 'revoked')),
  CONSTRAINT internal_ops_audit_evidence_case_packet_bundle_export_reviews_purpose_check
    CHECK (purpose IN ('delivery', 'archive', 'review', 'internal')),
  CONSTRAINT internal_ops_audit_evidence_case_packet_bundle_export_reviews_decision_check
    CHECK (decision IN ('usable', 'needs_review', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_export_reviews_export
  ON internal_ops_audit_evidence_case_packet_bundle_export_reviews (bundle_export_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_export_reviews_export_hash
  ON internal_ops_audit_evidence_case_packet_bundle_export_reviews (bundle_export_receipt_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_export_reviews_reviewer
  ON internal_ops_audit_evidence_case_packet_bundle_export_reviews (reviewer_username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_export_reviews_decision
  ON internal_ops_audit_evidence_case_packet_bundle_export_reviews (decision, created_at DESC);

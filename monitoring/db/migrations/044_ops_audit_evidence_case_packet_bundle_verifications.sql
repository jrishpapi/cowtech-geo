CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_packet_bundle_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  verifier_username TEXT NOT NULL,
  verifier_role TEXT NOT NULL,
  bundle_manifest_hash TEXT,
  bundle_packet_hash TEXT,
  bundle_requested_by TEXT,
  valid BOOLEAN NOT NULL DEFAULT FALSE,
  checks JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_verifications_created_at
  ON internal_ops_audit_evidence_case_packet_bundle_verifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_verifications_hash
  ON internal_ops_audit_evidence_case_packet_bundle_verifications (receipt_hash);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_verifications_valid
  ON internal_ops_audit_evidence_case_packet_bundle_verifications (valid, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_verifications_actor
  ON internal_ops_audit_evidence_case_packet_bundle_verifications (verifier_username, created_at DESC);

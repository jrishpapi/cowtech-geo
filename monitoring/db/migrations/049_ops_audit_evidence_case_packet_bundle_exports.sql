CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_packet_bundle_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  requester_username TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  bundle_manifest_hash TEXT NOT NULL,
  bundle_packet_hash TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  manifest_entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  reference_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_exports_created_at
  ON internal_ops_audit_evidence_case_packet_bundle_exports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_exports_hash
  ON internal_ops_audit_evidence_case_packet_bundle_exports (receipt_hash);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_exports_manifest
  ON internal_ops_audit_evidence_case_packet_bundle_exports (bundle_manifest_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_exports_actor
  ON internal_ops_audit_evidence_case_packet_bundle_exports (requester_username, created_at DESC);

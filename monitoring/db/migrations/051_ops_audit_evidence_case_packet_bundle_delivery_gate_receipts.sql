CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_deliver BOOLEAN NOT NULL DEFAULT FALSE,
  readiness_status TEXT NOT NULL,
  packet_hash TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ops_audit_bundle_delivery_gate_decision_check
    CHECK (decision IN ('allow', 'deny')),
  CONSTRAINT ops_audit_bundle_delivery_gate_readiness_check
    CHECK (readiness_status IN ('eligible', 'needs_review', 'blocked', 'no_exports', 'unknown'))
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts_created_at
  ON internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts_decision
  ON internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts (decision, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts_packet_hash
  ON internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts (packet_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts_recorder
  ON internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts (recorder_username, created_at DESC);

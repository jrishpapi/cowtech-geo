CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  approval_preview_hash TEXT NOT NULL,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  packet_hash TEXT NOT NULL,
  manifest_hash TEXT,
  handoff_preview_receipt_hash TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ops_bundle_final_approval_decision_check
    CHECK (decision IN ('approve', 'deny')),
  CONSTRAINT ops_bundle_final_approval_status_check
    CHECK (status IN ('ready', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_receipts_created_at
  ON internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_receipts_decision
  ON internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (decision, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_receipts_status
  ON internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_receipts_preview_hash
  ON internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (approval_preview_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_receipts_packet_hash
  ON internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (packet_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_final_approval_receipts_recorder
  ON internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (recorder_username, created_at DESC);

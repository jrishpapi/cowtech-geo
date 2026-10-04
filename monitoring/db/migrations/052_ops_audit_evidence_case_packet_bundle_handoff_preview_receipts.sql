CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  preview_hash TEXT NOT NULL,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_handoff BOOLEAN NOT NULL DEFAULT FALSE,
  packet_hash TEXT NOT NULL,
  manifest_hash TEXT,
  delivery_gate_receipt_hash TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ops_bundle_handoff_preview_status_check
    CHECK (status IN ('ready', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_handoff_preview_receipts_created_at
  ON internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_handoff_preview_receipts_status
  ON internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_handoff_preview_receipts_preview_hash
  ON internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts (preview_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_handoff_preview_receipts_packet_hash
  ON internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts (packet_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_bundle_handoff_preview_receipts_recorder
  ON internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts (recorder_username, created_at DESC);

CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_command_trail_notarizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('notarize', 'block')),
  notarization_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_archive_release_trail BOOLEAN NOT NULL DEFAULT FALSE,
  command_closure_receipt_hash TEXT,
  command_revocation_receipt_hash TEXT,
  command_escrow_receipt_hash TEXT,
  sealed_handoff_review_receipt_hash TEXT,
  readiness_seal_receipt_hash TEXT,
  dual_control_approval_receipt_hash TEXT,
  rehearsal_receipt_hash TEXT,
  dry_run_lock_receipt_hash TEXT,
  policy_gate_receipt_hash TEXT,
  final_approval_receipt_hash TEXT,
  lifecycle_review_receipt_hash TEXT,
  packet_hash TEXT,
  manifest_hash TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_notarizations_created
  ON internal_ops_audit_final_delivery_command_trail_notarizations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_notarizations_decision
  ON internal_ops_audit_final_delivery_command_trail_notarizations (decision, notarization_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_notarizations_closure
  ON internal_ops_audit_final_delivery_command_trail_notarizations (command_closure_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_notarizations_revocation
  ON internal_ops_audit_final_delivery_command_trail_notarizations (command_revocation_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_notarizations_escrow
  ON internal_ops_audit_final_delivery_command_trail_notarizations (command_escrow_receipt_hash);

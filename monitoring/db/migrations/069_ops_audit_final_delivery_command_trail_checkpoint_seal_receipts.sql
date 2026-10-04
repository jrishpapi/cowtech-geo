CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_command_trail_checkpoint_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL,
  seal_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_freeze_archive_checkpoint BOOLEAN NOT NULL DEFAULT false,
  renewal_confirmation_receipt_hash TEXT,
  renewal_window_receipt_hash TEXT,
  retention_attestation_receipt_hash TEXT,
  trail_custody_receipt_hash TEXT,
  trail_notarization_receipt_hash TEXT,
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
  checkpoint_at TIMESTAMPTZ,
  frozen_at TIMESTAMPTZ,
  next_review_due_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_checkpoint_seals_created
  ON internal_ops_audit_final_delivery_command_trail_checkpoint_seals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_checkpoint_seals_decision_status
  ON internal_ops_audit_final_delivery_command_trail_checkpoint_seals (decision, seal_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_checkpoint_seals_confirmation
  ON internal_ops_audit_final_delivery_command_trail_checkpoint_seals (renewal_confirmation_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_checkpoint_seals_window
  ON internal_ops_audit_final_delivery_command_trail_checkpoint_seals (renewal_window_receipt_hash);

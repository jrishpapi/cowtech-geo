CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_command_trail_custody_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash text NOT NULL UNIQUE,
  recorder_username text NOT NULL,
  recorder_role text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('checkpoint', 'block')),
  checkpoint_status text NOT NULL,
  reason text NOT NULL,
  can_checkpoint_sealed_evidence boolean NOT NULL DEFAULT false,
  evidence_seal_receipt_hash text,
  archive_escrow_receipt_hash text,
  custody_handoff_receipt_hash text,
  checkpoint_seal_receipt_hash text,
  renewal_confirmation_receipt_hash text,
  renewal_window_receipt_hash text,
  retention_attestation_receipt_hash text,
  trail_custody_receipt_hash text,
  trail_notarization_receipt_hash text,
  command_closure_receipt_hash text,
  command_revocation_receipt_hash text,
  command_escrow_receipt_hash text,
  sealed_handoff_review_receipt_hash text,
  readiness_seal_receipt_hash text,
  dual_control_approval_receipt_hash text,
  rehearsal_receipt_hash text,
  dry_run_lock_receipt_hash text,
  policy_gate_receipt_hash text,
  final_approval_receipt_hash text,
  lifecycle_review_receipt_hash text,
  packet_hash text,
  manifest_hash text,
  evidence_sealed_at timestamptz,
  custody_checkpointed_at timestamptz,
  next_review_due_at timestamptz,
  expires_at timestamptz,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_custody_checkpoints_created_at
  ON internal_ops_audit_final_delivery_command_trail_custody_checkpoints (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_custody_checkpoints_decision
  ON internal_ops_audit_final_delivery_command_trail_custody_checkpoints (decision, checkpoint_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_custody_checkpoints_evidence_seal_hash
  ON internal_ops_audit_final_delivery_command_trail_custody_checkpoints (evidence_seal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_trail_custody_checkpoints_archive_escrow_hash
  ON internal_ops_audit_final_delivery_command_trail_custody_checkpoints (archive_escrow_receipt_hash);

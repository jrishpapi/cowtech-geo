CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_command_trail_renewal_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash text NOT NULL UNIQUE,
  recorder_username text NOT NULL,
  recorder_role text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('confirm', 'block')),
  confirmation_status text NOT NULL,
  reason text NOT NULL,
  can_continue_archive_renewal boolean NOT NULL DEFAULT false,
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
  renewal_window_opens_at timestamptz,
  checkpoint_at timestamptz,
  next_review_due_at timestamptz,
  expires_at timestamptz,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_renewal_confirmations_created
  ON internal_ops_audit_final_delivery_command_trail_renewal_confirmations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_renewal_confirmations_decision_status
  ON internal_ops_audit_final_delivery_command_trail_renewal_confirmations (decision, confirmation_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_renewal_confirmations_window
  ON internal_ops_audit_final_delivery_command_trail_renewal_confirmations (renewal_window_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_command_trail_renewal_confirmations_attestation
  ON internal_ops_audit_final_delivery_command_trail_renewal_confirmations (retention_attestation_receipt_hash);

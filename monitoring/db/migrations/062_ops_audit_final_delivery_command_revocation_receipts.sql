CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_command_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('revoke', 'block')),
  revocation_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_rollback_release_command BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_revocations_created
  ON internal_ops_audit_final_delivery_command_revocations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_revocations_decision
  ON internal_ops_audit_final_delivery_command_revocations (decision, revocation_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_revocations_escrow
  ON internal_ops_audit_final_delivery_command_revocations (command_escrow_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_revocations_handoff
  ON internal_ops_audit_final_delivery_command_revocations (sealed_handoff_review_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_revocations_seal
  ON internal_ops_audit_final_delivery_command_revocations (readiness_seal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_revocations_dual
  ON internal_ops_audit_final_delivery_command_revocations (dual_control_approval_receipt_hash);

CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_command_escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('escrow', 'block')),
  escrow_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_seal_release_command BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_created
  ON internal_ops_audit_final_delivery_command_escrows (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_decision
  ON internal_ops_audit_final_delivery_command_escrows (decision, escrow_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_handoff
  ON internal_ops_audit_final_delivery_command_escrows (sealed_handoff_review_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_seal
  ON internal_ops_audit_final_delivery_command_escrows (readiness_seal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_dual
  ON internal_ops_audit_final_delivery_command_escrows (dual_control_approval_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_rehearsal
  ON internal_ops_audit_final_delivery_command_escrows (rehearsal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_lock
  ON internal_ops_audit_final_delivery_command_escrows (dry_run_lock_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_command_escrows_policy
  ON internal_ops_audit_final_delivery_command_escrows (policy_gate_receipt_hash);

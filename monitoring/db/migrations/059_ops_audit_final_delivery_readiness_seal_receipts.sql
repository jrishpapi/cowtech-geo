CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_readiness_seals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('seal', 'block')),
  seal_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_handoff_to_operator BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_readiness_seals_created
  ON internal_ops_audit_final_delivery_readiness_seals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_readiness_seals_decision
  ON internal_ops_audit_final_delivery_readiness_seals (decision, seal_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_readiness_seals_dual
  ON internal_ops_audit_final_delivery_readiness_seals (dual_control_approval_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_readiness_seals_rehearsal
  ON internal_ops_audit_final_delivery_readiness_seals (rehearsal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_readiness_seals_lock
  ON internal_ops_audit_final_delivery_readiness_seals (dry_run_lock_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_readiness_seals_policy_gate
  ON internal_ops_audit_final_delivery_readiness_seals (policy_gate_receipt_hash);

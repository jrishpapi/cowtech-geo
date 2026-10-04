CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_dual_control_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'block')),
  approval_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_release_after_dual_control BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dual_control_created
  ON internal_ops_audit_final_delivery_dual_control_approvals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dual_control_decision
  ON internal_ops_audit_final_delivery_dual_control_approvals (decision, approval_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dual_control_rehearsal
  ON internal_ops_audit_final_delivery_dual_control_approvals (rehearsal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dual_control_lock
  ON internal_ops_audit_final_delivery_dual_control_approvals (dry_run_lock_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dual_control_policy_gate
  ON internal_ops_audit_final_delivery_dual_control_approvals (policy_gate_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dual_control_final
  ON internal_ops_audit_final_delivery_dual_control_approvals (final_approval_receipt_hash);

CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_dry_run_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('lock', 'block')),
  lock_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_prepare_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  policy_gate_receipt_hash TEXT,
  final_approval_receipt_hash TEXT,
  lifecycle_review_receipt_hash TEXT,
  packet_hash TEXT,
  manifest_hash TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dry_run_locks_created
  ON internal_ops_audit_final_delivery_dry_run_locks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dry_run_locks_decision
  ON internal_ops_audit_final_delivery_dry_run_locks (decision, lock_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dry_run_locks_policy_gate
  ON internal_ops_audit_final_delivery_dry_run_locks (policy_gate_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dry_run_locks_final
  ON internal_ops_audit_final_delivery_dry_run_locks (final_approval_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_dry_run_locks_lifecycle
  ON internal_ops_audit_final_delivery_dry_run_locks (lifecycle_review_receipt_hash);

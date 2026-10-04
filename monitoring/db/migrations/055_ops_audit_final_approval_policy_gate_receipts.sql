CREATE TABLE IF NOT EXISTS internal_ops_audit_final_approval_policy_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'deny')),
  policy_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_prepare_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  final_approval_receipt_hash TEXT,
  lifecycle_review_receipt_hash TEXT,
  packet_hash TEXT,
  manifest_hash TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_approval_policy_gates_created
  ON internal_ops_audit_final_approval_policy_gates (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_approval_policy_gates_decision
  ON internal_ops_audit_final_approval_policy_gates (decision, policy_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_approval_policy_gates_final_receipt
  ON internal_ops_audit_final_approval_policy_gates (final_approval_receipt_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_approval_policy_gates_lifecycle
  ON internal_ops_audit_final_approval_policy_gates (lifecycle_review_receipt_hash, created_at DESC);

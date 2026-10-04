CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_rehearsals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('rehearse', 'block')),
  rehearsal_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_execute_dry_run BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_rehearsals_created
  ON internal_ops_audit_final_delivery_rehearsals (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_rehearsals_decision
  ON internal_ops_audit_final_delivery_rehearsals (decision, rehearsal_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_rehearsals_lock
  ON internal_ops_audit_final_delivery_rehearsals (dry_run_lock_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_rehearsals_policy_gate
  ON internal_ops_audit_final_delivery_rehearsals (policy_gate_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_rehearsals_final
  ON internal_ops_audit_final_delivery_rehearsals (final_approval_receipt_hash);

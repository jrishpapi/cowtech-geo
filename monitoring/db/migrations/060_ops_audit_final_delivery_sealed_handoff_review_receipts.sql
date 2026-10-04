CREATE TABLE IF NOT EXISTS internal_ops_audit_final_delivery_handoff_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_hash TEXT NOT NULL UNIQUE,
  recorder_username TEXT NOT NULL,
  recorder_role TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('signoff', 'block')),
  review_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  can_release_commander_signoff BOOLEAN NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_handoff_reviews_created
  ON internal_ops_audit_final_delivery_handoff_reviews (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_handoff_reviews_decision
  ON internal_ops_audit_final_delivery_handoff_reviews (decision, review_status);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_handoff_reviews_seal
  ON internal_ops_audit_final_delivery_handoff_reviews (readiness_seal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_handoff_reviews_dual
  ON internal_ops_audit_final_delivery_handoff_reviews (dual_control_approval_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_handoff_reviews_rehearsal
  ON internal_ops_audit_final_delivery_handoff_reviews (rehearsal_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_handoff_reviews_lock
  ON internal_ops_audit_final_delivery_handoff_reviews (dry_run_lock_receipt_hash);

CREATE INDEX IF NOT EXISTS idx_ops_audit_final_delivery_handoff_reviews_policy
  ON internal_ops_audit_final_delivery_handoff_reviews (policy_gate_receipt_hash);

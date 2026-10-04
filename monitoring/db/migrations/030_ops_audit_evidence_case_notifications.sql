CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES internal_ops_audit_evidence_case_reviews(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_at TIMESTAMPTZ,
  message TEXT NOT NULL,
  generated_by_username TEXT NOT NULL,
  generated_by_role TEXT NOT NULL,
  acknowledged_by_username TEXT,
  acknowledged_by_role TEXT,
  acknowledged_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_evidence_case_notifications_kind_check
    CHECK (kind IN ('overdue', 'due_soon')),
  CONSTRAINT internal_ops_audit_evidence_case_notifications_status_check
    CHECK (status IN ('open', 'acked', 'snoozed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_notifications_case_kind
  ON internal_ops_audit_evidence_case_notifications (case_id, kind);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_notifications_status
  ON internal_ops_audit_evidence_case_notifications (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_notifications_kind
  ON internal_ops_audit_evidence_case_notifications (kind, status, due_at);

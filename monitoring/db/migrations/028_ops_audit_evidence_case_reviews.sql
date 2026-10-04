CREATE TABLE IF NOT EXISTS internal_ops_audit_evidence_case_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_hash TEXT NOT NULL UNIQUE,
  packet JSONB NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  assignee_username TEXT,
  assignee_role TEXT,
  resolution_note TEXT,
  opened_by_username TEXT NOT NULL,
  opened_by_role TEXT NOT NULL,
  updated_by_username TEXT NOT NULL,
  updated_by_role TEXT NOT NULL,
  resolved_by_username TEXT,
  resolved_by_role TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_evidence_case_reviews_status_check
    CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_reviews_created_at
  ON internal_ops_audit_evidence_case_reviews (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_reviews_status
  ON internal_ops_audit_evidence_case_reviews (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_reviews_assignee
  ON internal_ops_audit_evidence_case_reviews (assignee_username, status);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_evidence_case_reviews_packet_hash
  ON internal_ops_audit_evidence_case_reviews (packet_hash);

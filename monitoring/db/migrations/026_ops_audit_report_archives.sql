CREATE TABLE IF NOT EXISTS internal_ops_audit_report_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id TEXT NOT NULL UNIQUE,
  report_hash TEXT NOT NULL UNIQUE,
  event_digest TEXT NOT NULL,
  html_hash TEXT NOT NULL,
  evidence_signature TEXT NOT NULL,
  requested_by_username TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention JSONB NOT NULL DEFAULT '{}'::jsonb,
  date_range JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  report JSONB NOT NULL,
  html_snapshot TEXT NOT NULL,
  event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_report_archives_created_at
  ON internal_ops_audit_report_archives (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_report_archives_requested_by
  ON internal_ops_audit_report_archives (requested_by_username, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_report_archives_event_digest
  ON internal_ops_audit_report_archives (event_digest);

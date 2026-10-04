CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_replay_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_attempt_id UUID NOT NULL REFERENCES internal_ops_audit_notification_delivery_attempts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested',
  force_reason TEXT NOT NULL,
  requested_by_username TEXT NOT NULL,
  requested_by_role TEXT NOT NULL,
  reviewed_by_username TEXT,
  reviewed_by_role TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  executed_by_username TEXT,
  executed_by_role TEXT,
  executed_at TIMESTAMPTZ,
  replay_attempt_id UUID REFERENCES internal_ops_audit_notification_delivery_attempts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_notification_replay_approvals_status_check
    CHECK (status IN ('requested', 'approved', 'rejected', 'executed', 'cancelled')),
  CONSTRAINT internal_ops_audit_notification_replay_approvals_reason_check
    CHECK (char_length(force_reason) BETWEEN 8 AND 500)
);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_replay_approvals_status
  ON internal_ops_audit_notification_replay_approvals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_replay_approvals_source
  ON internal_ops_audit_notification_replay_approvals (source_attempt_id);

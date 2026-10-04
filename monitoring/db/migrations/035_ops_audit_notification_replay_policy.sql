CREATE TABLE IF NOT EXISTS internal_ops_audit_notification_replay_policy (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  allow_self_approval BOOLEAN NOT NULL DEFAULT FALSE,
  required_reviewer_role TEXT NOT NULL DEFAULT 'admin',
  request_ttl_minutes INTEGER NOT NULL DEFAULT 1440,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT internal_ops_audit_notification_replay_policy_singleton CHECK (id = TRUE),
  CONSTRAINT internal_ops_audit_notification_replay_policy_role_check
    CHECK (required_reviewer_role IN ('viewer', 'operator', 'admin')),
  CONSTRAINT internal_ops_audit_notification_replay_policy_ttl_check
    CHECK (request_ttl_minutes BETWEEN 15 AND 10080)
);

INSERT INTO internal_ops_audit_notification_replay_policy (
  id,
  enabled,
  allow_self_approval,
  required_reviewer_role,
  request_ttl_minutes
)
VALUES (TRUE, TRUE, FALSE, 'admin', 1440)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE internal_ops_audit_notification_replay_approvals
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS review_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_replay_approvals_expires
  ON internal_ops_audit_notification_replay_approvals (status, expires_at);

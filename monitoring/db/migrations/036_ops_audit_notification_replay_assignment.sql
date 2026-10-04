ALTER TABLE internal_ops_audit_notification_replay_approvals
  ADD COLUMN IF NOT EXISTS assigned_reviewer_username TEXT,
  ADD COLUMN IF NOT EXISTS assigned_reviewer_role TEXT CHECK (
    assigned_reviewer_role IS NULL OR assigned_reviewer_role IN ('viewer', 'operator', 'admin')
  ),
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cleanup_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_ops_audit_notification_replay_approvals_assigned
  ON internal_ops_audit_notification_replay_approvals (assigned_reviewer_username, status, expires_at);

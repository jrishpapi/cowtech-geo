ALTER TABLE internal_ops_audit_notification_replay_approvals
  ADD COLUMN IF NOT EXISTS workload_action_status TEXT CHECK (
    workload_action_status IS NULL OR workload_action_status IN ('acknowledged', 'reassigned', 'resolved')
  ),
  ADD COLUMN IF NOT EXISTS workload_action_note TEXT,
  ADD COLUMN IF NOT EXISTS workload_action_by_username TEXT,
  ADD COLUMN IF NOT EXISTS workload_action_by_role TEXT CHECK (
    workload_action_by_role IS NULL OR workload_action_by_role IN ('viewer', 'operator', 'admin')
  ),
  ADD COLUMN IF NOT EXISTS workload_action_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ops_audit_notification_replay_approvals_workload_action
  ON internal_ops_audit_notification_replay_approvals (workload_action_status, status, expires_at);

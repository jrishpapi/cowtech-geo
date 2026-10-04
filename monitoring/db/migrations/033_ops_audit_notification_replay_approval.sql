ALTER TABLE internal_ops_audit_notification_delivery_attempts
  ADD COLUMN IF NOT EXISTS replay_source_attempt_id UUID REFERENCES internal_ops_audit_notification_delivery_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS force_replay_reason TEXT,
  ADD COLUMN IF NOT EXISTS force_replay_approved_by_username TEXT,
  ADD COLUMN IF NOT EXISTS force_replay_approved_by_role TEXT;

CREATE INDEX IF NOT EXISTS idx_internal_ops_audit_notification_delivery_replay_source
  ON internal_ops_audit_notification_delivery_attempts (replay_source_attempt_id);

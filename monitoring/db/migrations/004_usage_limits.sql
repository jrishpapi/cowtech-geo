ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS monthly_provider_call_limit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_buffer_percent INTEGER NOT NULL DEFAULT 25;

CREATE INDEX IF NOT EXISTS idx_usage_ledger_event_created ON usage_ledger (event_type, created_at);

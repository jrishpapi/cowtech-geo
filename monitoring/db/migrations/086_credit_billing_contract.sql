ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS monthly_credit_limit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_unit TEXT NOT NULL DEFAULT 'web_grounded_ai_response';

UPDATE plans
SET monthly_credit_limit = monthly_provider_call_limit
WHERE monthly_credit_limit = 0
  AND monthly_provider_call_limit > 0;

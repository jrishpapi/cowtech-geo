-- Phase 7 live POC budget and commercial GO amendment.
-- Authority: Telegram message 13650, 2026-08-01.
-- Applying this migration records authority but keeps transport disarmed.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase7_feature_flags
  DROP CONSTRAINT IF EXISTS phase7_flags_contract_ck;
ALTER TABLE phase7_feature_flags
  ADD COLUMN IF NOT EXISTS cash_hard_limit_micro_usd BIGINT NOT NULL DEFAULT 65000000,
  ADD COLUMN IF NOT EXISTS cogs_soft_warning_micro_usd BIGINT NOT NULL DEFAULT 45000000,
  ADD COLUMN IF NOT EXISTS cogs_go_hard_limit_micro_usd BIGINT NOT NULL DEFAULT 50000000,
  ADD COLUMN IF NOT EXISTS live_authority_ref TEXT;
UPDATE phase7_feature_flags SET
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  phase6_exit_passed=TRUE,
  approved_budget_micro_usd=0,
  cash_hard_limit_micro_usd=65000000,
  cogs_soft_warning_micro_usd=45000000,
  cogs_go_hard_limit_micro_usd=50000000,
  live_authority_ref='telegram-13650',
  contract_version='phase7-live-poc-v2-65cash-50cogs',
  updated_at=NOW()
WHERE scope_key='global';
ALTER TABLE phase7_feature_flags
  ADD CONSTRAINT phase7_flags_contract_ck CHECK (
    contract_version='phase7-live-poc-v2-65cash-50cogs'
  ),
  ADD CONSTRAINT phase7_flags_budget_ck CHECK (
    approved_budget_micro_usd BETWEEN 0 AND cash_hard_limit_micro_usd AND
    cash_hard_limit_micro_usd=65000000 AND
    cogs_soft_warning_micro_usd=45000000 AND
    cogs_go_hard_limit_micro_usd=50000000 AND
    cogs_soft_warning_micro_usd < cogs_go_hard_limit_micro_usd
  );
ALTER TABLE phase7_feature_flags
  ALTER COLUMN contract_version SET DEFAULT 'phase7-live-poc-v2-65cash-50cogs';

CREATE TABLE IF NOT EXISTS phase7_live_authorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_ref TEXT NOT NULL UNIQUE CHECK (length(btrim(authority_ref)) > 0),
  cash_hard_limit_micro_usd BIGINT NOT NULL CHECK (cash_hard_limit_micro_usd=65000000),
  cogs_soft_warning_micro_usd BIGINT NOT NULL CHECK (cogs_soft_warning_micro_usd=45000000),
  cogs_go_hard_limit_micro_usd BIGINT NOT NULL CHECK (cogs_go_hard_limit_micro_usd=50000000),
  planned_demands INTEGER NOT NULL CHECK (planned_demands=4000),
  surface_allocation JSONB NOT NULL CHECK (
    surface_allocation='{"chatgpt_ui":1334,"perplexity_ui":1333,"google_aio":1333}'::jsonb
  ),
  serpapi_starter_purchase_authorized BOOLEAN NOT NULL CHECK (serpapi_starter_purchase_authorized),
  authority_text TEXT NOT NULL CHECK (length(btrim(authority_text)) > 0),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO phase7_live_authorities(
  authority_ref,cash_hard_limit_micro_usd,cogs_soft_warning_micro_usd,
  cogs_go_hard_limit_micro_usd,planned_demands,surface_allocation,
  serpapi_starter_purchase_authorized,authority_text
) VALUES (
  'telegram-13650',65000000,45000000,50000000,4000,
  '{"chatgpt_ui":1334,"perplexity_ui":1333,"google_aio":1333}'::jsonb,
  TRUE,
  'Amend Phase 7 to a $65 independent cash hard limit, a $45 steady-state COGS warning and $50 COGS GO hard line; preserve the fixed 4,000-demand workload; authorize SerpApi Starter purchase or renewal and execution.'
) ON CONFLICT (authority_ref) DO NOTHING;

ALTER TABLE phase7_poc_runs
  ADD COLUMN IF NOT EXISTS live_authority_ref TEXT REFERENCES phase7_live_authorities(authority_ref),
  ADD COLUMN IF NOT EXISTS cash_hard_limit_micro_usd BIGINT NOT NULL DEFAULT 65000000,
  ADD COLUMN IF NOT EXISTS cogs_soft_warning_micro_usd BIGINT NOT NULL DEFAULT 45000000,
  ADD COLUMN IF NOT EXISTS cogs_go_hard_limit_micro_usd BIGINT NOT NULL DEFAULT 50000000,
  ADD COLUMN IF NOT EXISTS committed_cash_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (committed_cash_micro_usd >= 0),
  ADD COLUMN IF NOT EXISTS run_window_id TEXT;

CREATE TABLE IF NOT EXISTS phase7_supplier_purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_ref TEXT NOT NULL REFERENCES phase7_live_authorities(authority_ref),
  supplier TEXT NOT NULL CHECK (supplier='serpapi'),
  plan_name TEXT NOT NULL CHECK (plan_name='Starter'),
  amount_micro_usd BIGINT NOT NULL CHECK (amount_micro_usd=25000000),
  cycle_ordinal INTEGER NOT NULL CHECK (cycle_ordinal IN (1,2)),
  provider_receipt_ref TEXT NOT NULL CHECK (length(btrim(provider_receipt_ref)) > 0),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(authority_ref,supplier,cycle_ordinal),
  UNIQUE(provider_receipt_ref)
);

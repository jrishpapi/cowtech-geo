-- Phase 6 v3: xAI preferred, OpenRouter accepted for the Grok API route.
-- Applying this migration always disarms Phase 6 live and paid transport.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase6_feature_flags
  DROP CONSTRAINT IF EXISTS phase6_flags_contract_ck;
UPDATE phase6_feature_flags SET
  smoke_contract_enabled=FALSE,
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  approved_budget_micro_usd=0,
  contract_version='phase6-guest-first-grok-api-flex-v3',
  updated_at=NOW()
WHERE scope_key='global';
ALTER TABLE phase6_feature_flags
  ADD CONSTRAINT phase6_flags_contract_ck CHECK (
    contract_version='phase6-guest-first-grok-api-flex-v3'
  );
ALTER TABLE phase6_feature_flags
  ALTER COLUMN contract_version
  SET DEFAULT 'phase6-guest-first-grok-api-flex-v3';

ALTER TABLE phase6_smoke_runs
  ALTER COLUMN contract_version
  SET DEFAULT 'phase6-guest-first-grok-api-flex-v3';
ALTER TABLE phase6_smoke_runs
  DROP CONSTRAINT IF EXISTS phase6_run_contract_ck;
ALTER TABLE phase6_smoke_runs
  ADD CONSTRAINT phase6_run_contract_ck CHECK (
    contract_version IN (
      'phase6-guest-surface-smoke-v1',
      'phase6-guest-first-official-api-hybrid-v2',
      'phase6-guest-first-grok-api-flex-v3'
    )
  );

ALTER TABLE phase6_smoke_items
  DROP CONSTRAINT IF EXISTS phase6_item_acquisition_ck;
ALTER TABLE phase6_smoke_items
  ADD CONSTRAINT phase6_item_acquisition_ck CHECK (
    acquisition_mode IN ('web_ui','serpapi_aio','official_api','grok_api')
  );
ALTER TABLE phase6_smoke_items
  DROP CONSTRAINT IF EXISTS phase6_item_route_policy_ck;
ALTER TABLE phase6_smoke_items
  ADD CONSTRAINT phase6_item_route_policy_ck CHECK (
    route_policy IS NULL OR route_policy IN (
      'guest_primary','provider_surface','guest_first_official_api_fallback',
      'guest_first_preferred_api'
    )
  );
ALTER TABLE phase6_smoke_items
  DROP CONSTRAINT IF EXISTS phase6_item_official_supplier_ck;
ALTER TABLE phase6_smoke_items
  ADD CONSTRAINT phase6_item_official_supplier_ck CHECK (
    (acquisition_mode='official_api' AND official_api_supplier IN ('xai','dashscope'))
    OR (acquisition_mode='grok_api' AND official_api_supplier IN ('xai','openrouter'))
    OR (acquisition_mode NOT IN ('official_api','grok_api') AND official_api_supplier IS NULL)
  );

ALTER TABLE phase6_budget_permits
  DROP CONSTRAINT IF EXISTS phase6_permit_transport_supplier_ck;
ALTER TABLE phase6_budget_permits
  ADD CONSTRAINT phase6_permit_transport_supplier_ck CHECK (
    transport_supplier IN (
      'bright_data_browser','serpapi','xai','openrouter','dashscope','legacy_other'
    )
  );

ALTER TABLE phase6_supplier_reconciliations
  DROP CONSTRAINT IF EXISTS phase6_reconciliation_supplier_ck;
ALTER TABLE phase6_supplier_reconciliations
  ADD CONSTRAINT phase6_reconciliation_supplier_ck CHECK (
    supplier IN ('bright_data','serpapi','xai','openrouter','dashscope')
  );

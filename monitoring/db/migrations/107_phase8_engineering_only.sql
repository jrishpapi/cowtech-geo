-- Phase 8 engineering-only productionization schema. All runtime paths remain dark.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase8_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  engineering_contract_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_execution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paid_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  production_migration_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  phase7_authoritative_go BOOLEAN NOT NULL DEFAULT FALSE,
  approved_budget_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (approved_budget_micro_usd >= 0),
  contract_version TEXT NOT NULL DEFAULT 'phase8-engineering-only-v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase8_flags_contract_ck CHECK (
    contract_version='phase8-engineering-only-v1'
  ),
  CONSTRAINT phase8_flags_live_ck CHECK (
    NOT live_execution_enabled OR (
      engineering_contract_enabled
      AND paid_transport_enabled
      AND external_spend_enabled
      AND production_migration_enabled
      AND phase7_authoritative_go
      AND approved_budget_micro_usd > 0
    )
  )
);

INSERT INTO phase8_feature_flags (
  scope_key,engineering_contract_enabled,live_execution_enabled,
  paid_transport_enabled,external_spend_enabled,production_migration_enabled,
  phase7_authoritative_go,approved_budget_micro_usd
) VALUES ('global',FALSE,FALSE,FALSE,FALSE,FALSE,FALSE,0)
ON CONFLICT (scope_key) DO UPDATE SET
  engineering_contract_enabled=FALSE,
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  production_migration_enabled=FALSE,
  phase7_authoritative_go=FALSE,
  approved_budget_micro_usd=0,
  updated_at=NOW();

CREATE TABLE IF NOT EXISTS phase8_logical_account_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key TEXT NOT NULL UNIQUE,
  surface TEXT NOT NULL,
  region TEXT NOT NULL,
  compliance_policy_ref TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'live_frozen',
  max_concurrency INTEGER NOT NULL DEFAULT 1 CHECK (max_concurrency > 0),
  real_account_bound BOOLEAN NOT NULL DEFAULT FALSE,
  credential_material_present BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase8_account_surface_ck CHECK (
    surface IN (
      'chatgpt_ui','perplexity_ui','gemini_ui','grok_ui',
      'qwen_ui','deepseek_ui','mistral_vibe_ui'
    )
  ),
  CONSTRAINT phase8_account_state_ck CHECK (
    state IN ('live_frozen','healthy','degraded','quarantined','retired')
  ),
  CONSTRAINT phase8_account_engineering_dark_ck CHECK (
    state <> 'live_frozen' OR (
      real_account_bound=FALSE AND credential_material_present=FALSE
    )
  )
);

CREATE TABLE IF NOT EXISTS phase8_customer_migration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_ref TEXT NOT NULL,
  plan_sha256 TEXT NOT NULL CHECK (plan_sha256 ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL DEFAULT 'dry_run_only',
  production_apply_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  rollback_apply_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  planned_customers INTEGER NOT NULL CHECK (planned_customers >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase8_migration_run_status_ck CHECK (
    status IN ('dry_run_only','ready','running','completed','rolled_back','failed')
  ),
  CONSTRAINT phase8_migration_run_dark_ck CHECK (
    status='dry_run_only' OR (production_apply_allowed AND rollback_apply_allowed)
  )
);

CREATE TABLE IF NOT EXISTS phase8_customer_migration_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id UUID NOT NULL REFERENCES phase8_customer_migration_runs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  plan_code TEXT NOT NULL,
  action TEXT NOT NULL,
  target_contract JSONB NOT NULL CHECK (jsonb_typeof(target_contract)='object'),
  rollback_snapshot JSONB NOT NULL CHECK (jsonb_typeof(rollback_snapshot)='object'),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'dry_run_only',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(migration_run_id,customer_id),
  UNIQUE(idempotency_key),
  CONSTRAINT phase8_migration_plan_ck CHECK (plan_code IN ('starter','pro','god')),
  CONSTRAINT phase8_migration_action_ck CHECK (action IN ('no_op','migrate')),
  CONSTRAINT phase8_migration_item_status_ck CHECK (
    status IN ('dry_run_only','ready','applied','rolled_back','failed')
  )
);

CREATE TABLE IF NOT EXISTS phase8_canary_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id TEXT NOT NULL,
  authority_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'live_frozen',
  current_percent INTEGER NOT NULL DEFAULT 0,
  live_start_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  phase7_authoritative_go BOOLEAN NOT NULL DEFAULT FALSE,
  approved_budget_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (approved_budget_micro_usd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase8_canary_status_ck CHECK (
    status IN ('live_frozen','ready','running_5','running_25','running_100','completed','rolled_back','failed')
  ),
  CONSTRAINT phase8_canary_percent_ck CHECK (current_percent IN (0,5,25,100)),
  CONSTRAINT phase8_canary_dark_ck CHECK (
    status='live_frozen' OR (
      live_start_allowed AND phase7_authoritative_go AND approved_budget_micro_usd > 0
    )
  )
);

CREATE TABLE IF NOT EXISTS phase8_canary_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canary_run_id UUID NOT NULL REFERENCES phase8_canary_runs(id) ON DELETE CASCADE,
  percent INTEGER NOT NULL,
  customer_count INTEGER NOT NULL CHECK (customer_count > 0),
  customer_ids JSONB NOT NULL CHECK (jsonb_typeof(customer_ids)='array'),
  status TEXT NOT NULL DEFAULT 'live_frozen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(canary_run_id,percent),
  CONSTRAINT phase8_canary_stage_percent_ck CHECK (percent IN (5,25,100)),
  CONSTRAINT phase8_canary_stage_status_ck CHECK (
    status IN ('live_frozen','ready','running','accepted','rolled_back','failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_phase8_account_slots_ops
  ON phase8_logical_account_slots(surface,state,updated_at);
CREATE INDEX IF NOT EXISTS idx_phase8_migration_items_ops
  ON phase8_customer_migration_items(migration_run_id,status,customer_id);
CREATE INDEX IF NOT EXISTS idx_phase8_canary_stages_ops
  ON phase8_canary_stages(canary_run_id,percent,status);

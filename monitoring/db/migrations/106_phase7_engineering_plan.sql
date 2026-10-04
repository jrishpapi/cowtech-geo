-- Phase 7 engineering-only POC plan. Live execution remains dark.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase7_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  engineering_contract_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_execution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paid_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  phase6_exit_passed BOOLEAN NOT NULL DEFAULT FALSE,
  approved_budget_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (approved_budget_micro_usd >= 0),
  contract_version TEXT NOT NULL DEFAULT 'phase7-poc-engineering-plan-v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase7_flags_contract_ck CHECK (
    contract_version='phase7-poc-engineering-plan-v1'
  ),
  CONSTRAINT phase7_flags_live_ck CHECK (
    NOT live_execution_enabled OR (
      engineering_contract_enabled
      AND paid_transport_enabled
      AND external_spend_enabled
      AND phase6_exit_passed
      AND approved_budget_micro_usd > 0
    )
  )
);

INSERT INTO phase7_feature_flags (
  scope_key,engineering_contract_enabled,live_execution_enabled,
  paid_transport_enabled,external_spend_enabled,phase6_exit_passed,
  approved_budget_micro_usd
) VALUES ('global',FALSE,FALSE,FALSE,FALSE,FALSE,0)
ON CONFLICT (scope_key) DO UPDATE SET
  engineering_contract_enabled=FALSE,
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  phase6_exit_passed=FALSE,
  approved_budget_micro_usd=0,
  updated_at=NOW();

CREATE TABLE IF NOT EXISTS phase7_poc_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id TEXT NOT NULL DEFAULT 'starter-4000-v1',
  status TEXT NOT NULL DEFAULT 'live_frozen',
  dataset_sha256 TEXT NOT NULL CHECK (dataset_sha256 ~ '^[0-9a-f]{64}$'),
  plan_sha256 TEXT NOT NULL CHECK (plan_sha256 ~ '^[0-9a-f]{64}$'),
  planned_demands INTEGER NOT NULL CHECK (planned_demands=4000),
  planned_batches INTEGER NOT NULL CHECK (planned_batches > 0),
  engineering_authority_ref TEXT NOT NULL,
  phase6_freeze_decision_ref TEXT NOT NULL,
  phase6_exit_passed BOOLEAN NOT NULL DEFAULT FALSE,
  approved_budget_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (approved_budget_micro_usd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT phase7_run_cohort_ck CHECK (cohort_id='starter-4000-v1'),
  CONSTRAINT phase7_run_status_ck CHECK (
    status IN ('live_frozen','ready','running','completed','failed')
  ),
  CONSTRAINT phase7_run_dark_ck CHECK (
    status='live_frozen' OR (
      phase6_exit_passed AND approved_budget_micro_usd > 0
    )
  )
);

CREATE TABLE IF NOT EXISTS phase7_poc_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_run_id UUID NOT NULL REFERENCES phase7_poc_runs(id) ON DELETE CASCADE,
  batch_key TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  planned_demands INTEGER NOT NULL CHECK (planned_demands > 0),
  surfaces JSONB NOT NULL CHECK (jsonb_typeof(surfaces)='array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poc_run_id,batch_key),
  CONSTRAINT phase7_batch_stage_ck CHECK (stage IN ('canary','bulk')),
  CONSTRAINT phase7_batch_status_ck CHECK (
    status IN ('planned','live_frozen','running','completed','failed')
  )
);

CREATE TABLE IF NOT EXISTS phase7_poc_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_run_id UUID NOT NULL REFERENCES phase7_poc_runs(id) ON DELETE CASCADE,
  poc_batch_id UUID NOT NULL REFERENCES phase7_poc_batches(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 4000),
  surface TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  prompt_sha256 TEXT NOT NULL CHECK (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  daily_bucket TEXT NOT NULL,
  workload_class TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  session_mode TEXT NOT NULL,
  session_ordinal INTEGER,
  session_checkpoint INTEGER,
  no_cache BOOLEAN NOT NULL,
  customer_credit_units INTEGER NOT NULL CHECK (customer_credit_units=1),
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poc_run_id,item_key),
  UNIQUE(poc_run_id,sequence),
  CONSTRAINT phase7_item_surface_ck CHECK (
    surface IN ('chatgpt_ui','perplexity_ui','google_aio')
  ),
  CONSTRAINT phase7_item_acquisition_ck CHECK (
    acquisition_mode IN ('web_ui','serpapi_aio')
  ),
  CONSTRAINT phase7_item_session_ck CHECK (
    (acquisition_mode='web_ui' AND session_mode IN ('cold','warm') AND session_ordinal BETWEEN 1 AND 100)
    OR
    (acquisition_mode='serpapi_aio' AND session_mode='not_applicable'
      AND session_ordinal IS NULL AND session_checkpoint IS NULL)
  ),
  CONSTRAINT phase7_item_checkpoint_ck CHECK (
    session_checkpoint IS NULL OR session_checkpoint IN (1,2,10,50,100)
  ),
  CONSTRAINT phase7_item_no_cache_ck CHECK (
    (surface='google_aio' AND no_cache=TRUE)
    OR (surface<>'google_aio' AND no_cache=FALSE)
  ),
  CONSTRAINT phase7_item_status_ck CHECK (
    status IN ('planned','live_frozen','running','completed','failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_phase7_batches_ops
  ON phase7_poc_batches(poc_run_id,stage,status,updated_at);
CREATE INDEX IF NOT EXISTS idx_phase7_items_ops
  ON phase7_poc_items(poc_run_id,surface,status,sequence);

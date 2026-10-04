-- Phase 7-9 production executor persistence. Every production gate remains dark.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Phase 7: bind deterministic 100-demand browser cycles to durable attempts.
ALTER TABLE phase7_feature_flags
  ADD COLUMN IF NOT EXISTS production_runner_enabled BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE phase7_feature_flags SET
  production_runner_enabled=FALSE,
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  approved_budget_micro_usd=0,
  updated_at=NOW()
WHERE scope_key='global';
ALTER TABLE phase7_feature_flags DROP CONSTRAINT IF EXISTS phase7_flags_live_ck;
ALTER TABLE phase7_feature_flags ADD CONSTRAINT phase7_flags_live_ck CHECK (
  NOT live_execution_enabled OR (
    engineering_contract_enabled AND production_runner_enabled
    AND paid_transport_enabled AND external_spend_enabled
    AND phase6_exit_passed AND approved_budget_micro_usd > 0
  )
);

ALTER TABLE phase7_poc_items
  ADD COLUMN IF NOT EXISTS original_prompt_text TEXT,
  ADD COLUMN IF NOT EXISTS surface_ordinal INTEGER,
  ADD COLUMN IF NOT EXISTS session_cycle INTEGER,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS failure_classification TEXT,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT,
  ADD COLUMN IF NOT EXISTS lease_owner TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_session_id TEXT;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY poc_run_id,surface ORDER BY sequence)::integer AS ordinal
  FROM phase7_poc_items
)
UPDATE phase7_poc_items item SET
  surface_ordinal=ranked.ordinal,
  session_cycle=CASE WHEN item.acquisition_mode='web_ui'
    THEN ((ranked.ordinal-1)/100)+1 ELSE NULL END
FROM ranked WHERE ranked.id=item.id AND item.surface_ordinal IS NULL;

ALTER TABLE phase7_poc_items DROP CONSTRAINT IF EXISTS phase7_item_status_ck;
ALTER TABLE phase7_poc_items
  ADD CONSTRAINT phase7_item_status_ck CHECK (
    status IN ('planned','live_frozen','ready','running','retryable','held','dlq','completed','failed')
  ),
  ADD CONSTRAINT phase7_item_attempt_count_ck CHECK (
    attempt_count BETWEEN 0 AND max_attempts AND max_attempts=3
  ),
  ADD CONSTRAINT phase7_item_prompt_text_ck CHECK (
    original_prompt_text IS NULL OR octet_length(original_prompt_text) > 0
  ),
  ADD CONSTRAINT phase7_item_cycle_ck CHECK (
    (acquisition_mode='web_ui' AND surface_ordinal > 0 AND session_cycle > 0)
    OR
    (acquisition_mode='serpapi_aio' AND session_cycle IS NULL)
  ),
  ADD CONSTRAINT phase7_item_failure_class_ck CHECK (
    failure_classification IS NULL OR
    failure_classification IN ('transient','structural_hold','unknown_hold')
  );

CREATE TABLE IF NOT EXISTS phase7_poc_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_run_id UUID NOT NULL REFERENCES phase7_poc_runs(id) ON DELETE CASCADE,
  poc_item_id UUID NOT NULL REFERENCES phase7_poc_items(id) ON DELETE CASCADE,
  attempt_ordinal INTEGER NOT NULL CHECK (attempt_ordinal BETWEEN 1 AND 3),
  worker_id TEXT NOT NULL CHECK (length(btrim(worker_id)) > 0),
  status TEXT NOT NULL CHECK (status IN ('completed','retryable','held','dlq')),
  failure_classification TEXT CHECK (
    failure_classification IS NULL OR
    failure_classification IN ('transient','structural_hold','unknown_hold')
  ),
  error_code TEXT,
  provider_session_id TEXT,
  session_cycle INTEGER,
  session_ordinal INTEGER,
  transport_started BOOLEAN NOT NULL,
  evidence_verified BOOLEAN NOT NULL,
  settled_cost_micro_usd BIGINT CHECK (settled_cost_micro_usd IS NULL OR settled_cost_micro_usd >= 0),
  result_payload JSONB NOT NULL CHECK (jsonb_typeof(result_payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poc_item_id,attempt_ordinal)
);
CREATE TABLE IF NOT EXISTS phase7_session_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_run_id UUID NOT NULL REFERENCES phase7_poc_runs(id) ON DELETE CASCADE,
  surface TEXT NOT NULL CHECK (surface IN ('chatgpt_ui','perplexity_ui')),
  session_cycle INTEGER NOT NULL CHECK (session_cycle > 0),
  provider_session_id TEXT NOT NULL CHECK (length(btrim(provider_session_id)) > 0),
  last_session_ordinal INTEGER NOT NULL CHECK (last_session_ordinal BETWEEN 1 AND 100),
  use_count INTEGER NOT NULL CHECK (use_count BETWEEN 1 AND 100),
  status TEXT NOT NULL CHECK (status IN ('active','completed','broken')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(poc_run_id,surface,session_cycle)
);
CREATE INDEX IF NOT EXISTS idx_phase7_live_claim
  ON phase7_poc_items(poc_run_id,status,sequence,lease_expires_at);

-- Phase 8: durable production events and opaque account bindings.
ALTER TABLE phase8_feature_flags
  ADD COLUMN IF NOT EXISTS production_executor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS live_authority_ref TEXT,
  ADD COLUMN IF NOT EXISTS phase7_completion_authority_ref TEXT;
UPDATE phase8_feature_flags SET
  production_executor_enabled=FALSE,
  live_execution_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  production_migration_enabled=FALSE,
  phase7_authoritative_go=FALSE,
  approved_budget_micro_usd=0,
  live_authority_ref=NULL,
  phase7_completion_authority_ref=NULL,
  updated_at=NOW()
WHERE scope_key='global';
ALTER TABLE phase8_feature_flags DROP CONSTRAINT IF EXISTS phase8_flags_live_ck;
ALTER TABLE phase8_feature_flags ADD CONSTRAINT phase8_flags_live_ck CHECK (
  NOT live_execution_enabled OR (
    engineering_contract_enabled AND production_executor_enabled
    AND paid_transport_enabled AND external_spend_enabled
    AND production_migration_enabled AND phase7_authoritative_go
    AND approved_budget_micro_usd > 0
    AND length(btrim(live_authority_ref)) > 0
    AND length(btrim(phase7_completion_authority_ref)) > 0
  )
);

CREATE TABLE IF NOT EXISTS phase8_production_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (length(btrim(event_type)) > 0),
  authority_ref TEXT NOT NULL CHECK (length(btrim(authority_ref)) > 0),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS phase8_account_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_key TEXT NOT NULL UNIQUE REFERENCES phase8_logical_account_slots(slot_key),
  credential_ref TEXT NOT NULL CHECK (length(btrim(credential_ref)) > 0),
  validation_evidence_ref TEXT NOT NULL CHECK (length(btrim(validation_evidence_ref)) > 0),
  authority_ref TEXT NOT NULL CHECK (length(btrim(authority_ref)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS phase8_real_order_executions (
  order_id TEXT PRIMARY KEY,
  authority_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','rolled_back','failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS phase8_real_order_stage_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES phase8_real_order_executions(order_id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  authority_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(order_id,stage)
);

-- Phase 9: durable live-soak and separate commercial-launch executor controls.
ALTER TABLE phase9_feature_flags
  ADD COLUMN IF NOT EXISTS production_executor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS live_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paid_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS production_write_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS live_authority_ref TEXT,
  ADD COLUMN IF NOT EXISTS phase8_completion_authority_ref TEXT,
  ADD COLUMN IF NOT EXISTS phase9_soak_go_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS commercial_launch_authority_ref TEXT;
UPDATE phase9_feature_flags SET
  production_executor_enabled=FALSE,
  live_soak_enabled=FALSE,
  commercial_launch_enabled=FALSE,
  live_transport_enabled=FALSE,
  paid_transport_enabled=FALSE,
  external_spend_enabled=FALSE,
  production_write_enabled=FALSE,
  phase8_rollout_complete=FALSE,
  approved_budget_micro_usd=0,
  live_authority_ref=NULL,
  phase8_completion_authority_ref=NULL,
  phase9_soak_go_review=FALSE,
  commercial_launch_authority_ref=NULL,
  updated_at=NOW()
WHERE scope_key='global';
ALTER TABLE phase9_feature_flags
  DROP CONSTRAINT IF EXISTS phase9_live_dark_ck,
  DROP CONSTRAINT IF EXISTS phase9_launch_dark_ck;
ALTER TABLE phase9_feature_flags
  ADD CONSTRAINT phase9_live_dark_ck CHECK (
    NOT live_soak_enabled OR (
      engineering_contract_enabled AND production_executor_enabled
      AND live_transport_enabled AND paid_transport_enabled
      AND external_spend_enabled AND production_write_enabled
      AND phase8_rollout_complete AND approved_budget_micro_usd > 0
      AND length(btrim(live_authority_ref)) > 0
      AND length(btrim(phase8_completion_authority_ref)) > 0
    )
  ),
  ADD CONSTRAINT phase9_launch_dark_ck CHECK (
    NOT commercial_launch_enabled OR (
      production_executor_enabled AND phase8_rollout_complete
      AND phase9_soak_go_review
      AND length(btrim(commercial_launch_authority_ref)) > 0
    )
  );

CREATE TABLE IF NOT EXISTS phase9_production_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (length(btrim(event_type)) > 0),
  authority_ref TEXT NOT NULL CHECK (length(btrim(authority_ref)) > 0),
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(btrim(idempotency_key)) > 0),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE phase9_launch_gate_reviews DROP CONSTRAINT IF EXISTS phase9_launch_review_dark_ck;
ALTER TABLE phase9_launch_gate_reviews ADD CONSTRAINT phase9_launch_review_state_ck CHECK (
  (status='commercial_launch_frozen' AND launch_allowed=FALSE)
  OR (status='launch_applied' AND launch_allowed=TRUE)
  OR (status='launch_rolled_back' AND launch_allowed=FALSE)
);
CREATE INDEX IF NOT EXISTS idx_phase8_production_events_type
  ON phase8_production_events(event_type,created_at);
CREATE INDEX IF NOT EXISTS idx_phase9_production_events_type
  ON phase9_production_events(event_type,created_at);

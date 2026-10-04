-- Phase 1 shadow activation controls and durable scheduler intake.
--
-- This is a forward-only follow-up to the already deployed 093 migration.
-- It does not enable any tenant, customer visibility, billing, supplier
-- transport, or external spend.  Activation requires both an exact global
-- shadow-contract gate and an explicit tenant/brand registry row.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase1_feature_flags
  ADD COLUMN IF NOT EXISTS shadow_contract_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shadow_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS scheduler_intake_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS worker_drain_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE phase1_feature_flags
SET shadow_contract_enabled = FALSE,
    shadow_contract_version = NULL,
    scheduler_intake_enabled = FALSE,
    worker_drain_enabled = FALSE,
    updated_at = NOW();

ALTER TABLE phase1_feature_flags
  ADD CONSTRAINT phase1_feature_flags_shadow_version_ck CHECK (
    shadow_contract_version IS NULL
    OR shadow_contract_version = 'diagnostic-monitoring-plan-v2-shadow-v1'
  ),
  ADD CONSTRAINT phase1_feature_flags_shadow_enablement_ck CHECK (
    NOT shadow_contract_enabled
    OR shadow_contract_version = 'diagnostic-monitoring-plan-v2-shadow-v1'
  ),
  ADD CONSTRAINT phase1_feature_flags_scheduler_dependency_ck CHECK (
    NOT scheduler_intake_enabled
    OR (shadow_contract_enabled AND durable_queue_enabled AND worker_drain_enabled)
  ),
  ADD CONSTRAINT phase1_feature_flags_worker_dependency_ck CHECK (
    NOT worker_drain_enabled
    OR (shadow_contract_enabled AND durable_queue_enabled)
  );

-- Composite keys let the registry prove that a selected brand and prompt set
-- belong to the tenant being activated.  They are redundant with the primary
-- keys but make the cross-tenant relationship enforceable by PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_id_customer_id
  ON brands (id, customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_sets_id_brand_id
  ON prompt_sets (id, brand_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_prompts_id_prompt_set_id
  ON prompts (id, prompt_set_id);

CREATE TABLE IF NOT EXISTS phase1_tenant_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  prompt_set_id UUID NOT NULL,
  contract_version TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disabled',
  cycle_anchor_date DATE NOT NULL,
  next_bucket_date DATE NOT NULL,
  last_scheduled_bucket DATE,
  monitoring_timezone TEXT NOT NULL DEFAULT 'UTC',
  region TEXT NOT NULL DEFAULT 'US',
  language TEXT NOT NULL DEFAULT 'en',
  device TEXT NOT NULL DEFAULT 'desktop',
  customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  billing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by TEXT NOT NULL,
  approval_reference TEXT NOT NULL,
  activated_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase1_tenant_activations_brand_tenant_fk
    FOREIGN KEY (brand_id, customer_id)
    REFERENCES brands (id, customer_id)
    ON DELETE CASCADE,
  CONSTRAINT phase1_tenant_activations_prompt_brand_fk
    FOREIGN KEY (prompt_set_id, brand_id)
    REFERENCES prompt_sets (id, brand_id)
    ON DELETE RESTRICT,
  CONSTRAINT phase1_tenant_activations_contract_ck CHECK (
    contract_version = 'diagnostic-monitoring-plan-v2-shadow-v1'
  ),
  CONSTRAINT phase1_tenant_activations_starter_only_ck CHECK (plan_code = 'starter'),
  CONSTRAINT phase1_tenant_activations_status_ck CHECK (
    status IN ('disabled', 'shadow', 'paused', 'retired')
  ),
  CONSTRAINT phase1_tenant_activations_utc_only_ck CHECK (monitoring_timezone = 'UTC'),
  CONSTRAINT phase1_tenant_activations_desktop_only_ck CHECK (device = 'desktop'),
  CONSTRAINT phase1_tenant_activations_nonempty_dimensions_ck CHECK (
    length(btrim(region)) > 0 AND length(btrim(language)) > 0
  ),
  CONSTRAINT phase1_tenant_activations_shadow_only_ck CHECK (
    customer_visible = FALSE
    AND billing_enabled = FALSE
    AND external_transport_enabled = FALSE
  ),
  CONSTRAINT phase1_tenant_activations_dates_ck CHECK (
    next_bucket_date >= cycle_anchor_date
    AND (last_scheduled_bucket IS NULL OR last_scheduled_bucket >= cycle_anchor_date)
    AND (last_scheduled_bucket IS NULL OR last_scheduled_bucket < next_bucket_date)
  ),
  CONSTRAINT phase1_tenant_activations_activation_ck CHECK (
    status <> 'shadow' OR activated_at IS NOT NULL
  ),
  CONSTRAINT phase1_tenant_activations_approval_ck CHECK (
    length(btrim(approved_by)) > 0 AND length(btrim(approval_reference)) > 0
  ),
  CONSTRAINT phase1_tenant_activations_metadata_object_ck CHECK (
    jsonb_typeof(metadata) = 'object'
  ),
  UNIQUE (brand_id, contract_version),
  UNIQUE (id, prompt_set_id),
  UNIQUE (id, customer_id, brand_id, prompt_set_id, contract_version, plan_code)
);

CREATE INDEX IF NOT EXISTS idx_phase1_tenant_activations_due
  ON phase1_tenant_activations (next_bucket_date, id)
  WHERE status = 'shadow';

-- Shadow runs live in a dedicated namespace.  They must never be inserted
-- into tracking_runs because customer dashboard/latest-run queries consume
-- that table without understanding internal Phase 1 canary visibility.
CREATE TABLE IF NOT EXISTS phase1_shadow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  prompt_set_id UUID NOT NULL,
  contract_version TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  daily_bucket DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_mode TEXT NOT NULL DEFAULT 'mock',
  scheduled_for TIMESTAMPTZ NOT NULL,
  monitoring_timezone TEXT NOT NULL DEFAULT 'UTC',
  region TEXT NOT NULL,
  language TEXT NOT NULL,
  device TEXT NOT NULL DEFAULT 'desktop',
  customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  billing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contract_snapshot JSONB NOT NULL,
  run_payload JSONB NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase1_shadow_runs_activation_context_fk
    FOREIGN KEY (
      activation_id, customer_id, brand_id, prompt_set_id, contract_version, plan_code
    )
    REFERENCES phase1_tenant_activations (
      id, customer_id, brand_id, prompt_set_id, contract_version, plan_code
    )
    ON DELETE RESTRICT,
  CONSTRAINT phase1_shadow_runs_contract_ck CHECK (
    contract_version = 'diagnostic-monitoring-plan-v2-shadow-v1'
  ),
  CONSTRAINT phase1_shadow_runs_starter_only_ck CHECK (plan_code = 'starter'),
  CONSTRAINT phase1_shadow_runs_mock_only_ck CHECK (provider_mode = 'mock'),
  CONSTRAINT phase1_shadow_runs_utc_only_ck CHECK (monitoring_timezone = 'UTC'),
  CONSTRAINT phase1_shadow_runs_desktop_only_ck CHECK (device = 'desktop'),
  CONSTRAINT phase1_shadow_runs_status_ck CHECK (
    status IN ('queued', 'completed', 'failed')
  ),
  CONSTRAINT phase1_shadow_runs_terminal_time_ck CHECK (
    (status = 'queued' AND finished_at IS NULL)
    OR (status IN ('completed', 'failed') AND started_at IS NOT NULL AND finished_at IS NOT NULL)
  ),
  CONSTRAINT phase1_shadow_runs_shadow_only_ck CHECK (
    customer_visible = FALSE
    AND billing_enabled = FALSE
    AND external_transport_enabled = FALSE
  ),
  CONSTRAINT phase1_shadow_runs_nonempty_dimensions_ck CHECK (
    length(btrim(region)) > 0 AND length(btrim(language)) > 0
  ),
  CONSTRAINT phase1_shadow_runs_json_ck CHECK (
    jsonb_typeof(contract_snapshot) = 'object'
    AND jsonb_typeof(run_payload) = 'object'
  ),
  UNIQUE (activation_id, daily_bucket),
  UNIQUE (
    id, activation_id, customer_id, brand_id, prompt_set_id,
    daily_bucket, contract_version, plan_code
  )
);

CREATE INDEX IF NOT EXISTS idx_phase1_shadow_runs_activation_bucket
  ON phase1_shadow_runs (activation_id, daily_bucket DESC);

CREATE INDEX IF NOT EXISTS idx_phase1_shadow_runs_status_created
  ON phase1_shadow_runs (status, created_at, id);

CREATE TABLE IF NOT EXISTS phase1_tracking_intake (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_id UUID NOT NULL,
  shadow_run_id UUID NOT NULL UNIQUE,
  customer_id UUID NOT NULL,
  brand_id UUID NOT NULL,
  prompt_set_id UUID NOT NULL,
  contract_version TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  daily_bucket DATE NOT NULL,
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  cycle_number BIGINT NOT NULL,
  bucket_index SMALLINT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  monitoring_timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'queued',
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  lease_fencing_token BIGINT NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  billing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contract_snapshot JSONB NOT NULL,
  run_payload JSONB NOT NULL,
  redis_wakeup_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase1_tracking_intake_shadow_run_context_fk
    FOREIGN KEY (
      shadow_run_id, activation_id, customer_id, brand_id, prompt_set_id,
      daily_bucket, contract_version, plan_code
    )
    REFERENCES phase1_shadow_runs (
      id, activation_id, customer_id, brand_id, prompt_set_id,
      daily_bucket, contract_version, plan_code
    )
    ON DELETE RESTRICT,
  CONSTRAINT phase1_tracking_intake_contract_ck CHECK (
    contract_version = 'diagnostic-monitoring-plan-v2-shadow-v1'
  ),
  CONSTRAINT phase1_tracking_intake_starter_only_ck CHECK (plan_code = 'starter'),
  CONSTRAINT phase1_tracking_intake_utc_only_ck CHECK (monitoring_timezone = 'UTC'),
  CONSTRAINT phase1_tracking_intake_status_ck CHECK (
    status IN ('queued', 'leased', 'retry_wait', 'completed', 'dead_letter')
  ),
  CONSTRAINT phase1_tracking_intake_cycle_ck CHECK (
    cycle_end = cycle_start + 29
    AND daily_bucket BETWEEN cycle_start AND cycle_end
    AND bucket_index = daily_bucket - cycle_start
    AND bucket_index BETWEEN 0 AND 29
    AND cycle_number >= 0
  ),
  CONSTRAINT phase1_tracking_intake_attempt_ck CHECK (
    attempt_count >= 0 AND lease_fencing_token >= 0
  ),
  CONSTRAINT phase1_tracking_intake_lease_ck CHECK (
    (
      status = 'leased'
      AND lease_owner IS NOT NULL
      AND lease_token IS NOT NULL
      AND lease_until IS NOT NULL
    )
    OR
    (
      status <> 'leased'
      AND lease_owner IS NULL
      AND lease_token IS NULL
      AND lease_until IS NULL
    )
  ),
  CONSTRAINT phase1_tracking_intake_shadow_only_ck CHECK (
    customer_visible = FALSE
    AND billing_enabled = FALSE
    AND external_transport_enabled = FALSE
  ),
  CONSTRAINT phase1_tracking_intake_json_ck CHECK (
    jsonb_typeof(last_error_details) = 'object'
    AND jsonb_typeof(contract_snapshot) = 'object'
    AND jsonb_typeof(run_payload) = 'object'
  ),
  UNIQUE (activation_id, daily_bucket),
  UNIQUE (
    id, activation_id, shadow_run_id, daily_bucket, contract_version, plan_code
  )
);

CREATE INDEX IF NOT EXISTS idx_phase1_tracking_intake_ready
  ON phase1_tracking_intake (available_at, created_at, id)
  WHERE status IN ('queued', 'retry_wait');

CREATE INDEX IF NOT EXISTS idx_phase1_tracking_intake_expired_lease
  ON phase1_tracking_intake (lease_until, id)
  WHERE status = 'leased';

CREATE INDEX IF NOT EXISTS idx_phase1_tracking_intake_activation_bucket
  ON phase1_tracking_intake (activation_id, daily_bucket DESC);

-- Internal-only fanout rows for the shadow canary.  They deliberately do not
-- reference observation_demands, credit accounts, usage ledgers, customer
-- results, or supplier transport.  The composite context FK prevents a demand
-- from being attached to another activation, run, contract, or daily bucket.
CREATE TABLE IF NOT EXISTS phase1_shadow_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  activation_id UUID NOT NULL,
  intake_id UUID NOT NULL,
  shadow_run_id UUID NOT NULL,
  prompt_set_id UUID NOT NULL,
  prompt_id UUID NOT NULL,
  prompt_slot SMALLINT NOT NULL,
  surface_key TEXT NOT NULL,
  daily_bucket DATE NOT NULL,
  contract_version TEXT NOT NULL,
  plan_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  validation_error_code TEXT,
  validation_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  customer_visible BOOLEAN NOT NULL DEFAULT FALSE,
  billing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase1_shadow_demands_intake_context_fk
    FOREIGN KEY (
      intake_id, activation_id, shadow_run_id, daily_bucket, contract_version, plan_code
    )
    REFERENCES phase1_tracking_intake (
      id, activation_id, shadow_run_id, daily_bucket, contract_version, plan_code
    )
    ON DELETE RESTRICT,
  CONSTRAINT phase1_shadow_demands_activation_prompt_set_fk
    FOREIGN KEY (activation_id, prompt_set_id)
    REFERENCES phase1_tenant_activations (id, prompt_set_id)
    ON DELETE RESTRICT,
  CONSTRAINT phase1_shadow_demands_prompt_set_fk
    FOREIGN KEY (prompt_id, prompt_set_id)
    REFERENCES prompts (id, prompt_set_id)
    ON DELETE RESTRICT,
  CONSTRAINT phase1_shadow_demands_contract_ck CHECK (
    contract_version = 'diagnostic-monitoring-plan-v2-shadow-v1'
  ),
  CONSTRAINT phase1_shadow_demands_starter_only_ck CHECK (plan_code = 'starter'),
  CONSTRAINT phase1_shadow_demands_prompt_slot_ck CHECK (prompt_slot BETWEEN 1 AND 44),
  CONSTRAINT phase1_shadow_demands_surface_ck CHECK (
    surface_key IN ('chatgpt_ui', 'perplexity_ui', 'google_aio')
  ),
  CONSTRAINT phase1_shadow_demands_status_ck CHECK (
    status IN ('planned', 'validated', 'failed')
  ),
  CONSTRAINT phase1_shadow_demands_validation_ck CHECK (
    (status = 'planned' AND validated_at IS NULL AND validation_error_code IS NULL)
    OR (status = 'validated' AND validated_at IS NOT NULL AND validation_error_code IS NULL)
    OR (
      status = 'failed'
      AND validated_at IS NOT NULL
      AND length(btrim(validation_error_code)) > 0
    )
  ),
  CONSTRAINT phase1_shadow_demands_shadow_only_ck CHECK (
    customer_visible = FALSE
    AND billing_enabled = FALSE
    AND external_transport_enabled = FALSE
  ),
  CONSTRAINT phase1_shadow_demands_validation_details_ck CHECK (
    jsonb_typeof(validation_details) = 'object'
  ),
  UNIQUE (intake_id, prompt_id, surface_key),
  UNIQUE (intake_id, prompt_slot, surface_key)
);

CREATE INDEX IF NOT EXISTS idx_phase1_shadow_demands_intake_status
  ON phase1_shadow_demands (intake_id, status, prompt_slot, surface_key);

CREATE INDEX IF NOT EXISTS idx_phase1_shadow_demands_shadow_run
  ON phase1_shadow_demands (shadow_run_id, daily_bucket, status);

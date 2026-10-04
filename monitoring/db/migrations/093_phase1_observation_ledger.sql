-- Phase 1 durable observation, credit, supplier-cost, and queue schema.
--
-- This migration is intentionally transport-disarmed.  It creates durable
-- state and compatibility bridges, but it does not activate the v2 contract,
-- paid supplier access, live browser/API transport, or the new scheduler.

-- Production runs 093 in its own transaction. Fail closed instead of waiting
-- indefinitely for a busy legacy table or a wedged migration session.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE customers
  ALTER COLUMN plan_code SET DEFAULT 'starter';

ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS monthly_credit_limit INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_unit TEXT NOT NULL DEFAULT 'observation';

ALTER TABLE plans
  ADD CONSTRAINT plans_monthly_credit_limit_nonnegative_ck
    CHECK (monthly_credit_limit >= 0),
  ADD CONSTRAINT plans_credit_unit_nonempty_ck
    CHECK (length(btrim(credit_unit)) > 0);

UPDATE plans
SET monthly_credit_limit = CASE id
      WHEN 'starter' THEN 4000
      WHEN 'pro' THEN 10000
      WHEN 'god' THEN 25000
      ELSE monthly_credit_limit
    END,
    credit_unit = 'observation',
    -- Correct migration 092's unsafe plan-level activation.  Phase 1 remains
    -- mock/no-spend even when 086-092 are replayed into a fresh database.
    live_provider_enabled = FALSE,
    live_provider_status = 'mock_only',
    updated_at = NOW()
WHERE id IN ('starter', 'pro', 'god');

CREATE TABLE IF NOT EXISTS phase1_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  observation_pipeline_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  durable_queue_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  tracking_fanout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  tracking_fanin_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  compatibility_writes_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contract_v2_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_supplier_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paid_supplier_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase1_feature_flags_scope_nonempty_ck
    CHECK (length(btrim(scope_key)) > 0),
  CONSTRAINT phase1_feature_flags_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT phase1_feature_flags_transport_dependency_ck
    CHECK (
      (NOT live_supplier_transport_enabled OR external_spend_enabled)
      AND (NOT paid_supplier_transport_enabled OR external_spend_enabled)
    )
);

INSERT INTO phase1_feature_flags (
  scope_key,
  observation_pipeline_enabled,
  durable_queue_enabled,
  tracking_fanout_enabled,
  tracking_fanin_enabled,
  compatibility_writes_enabled,
  contract_v2_enabled,
  live_supplier_transport_enabled,
  paid_supplier_transport_enabled,
  external_spend_enabled
)
VALUES ('global', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (scope_key) DO UPDATE SET
  observation_pipeline_enabled = FALSE,
  durable_queue_enabled = FALSE,
  tracking_fanout_enabled = FALSE,
  tracking_fanin_enabled = FALSE,
  compatibility_writes_enabled = FALSE,
  contract_v2_enabled = FALSE,
  live_supplier_transport_enabled = FALSE,
  paid_supplier_transport_enabled = FALSE,
  external_spend_enabled = FALSE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS browser_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surface_key TEXT NOT NULL,
  account_pseudonym TEXT NOT NULL UNIQUE,
  authentication_mode TEXT NOT NULL DEFAULT 'guest',
  status TEXT NOT NULL DEFAULT 'healthy',
  auth_state_ciphertext BYTEA,
  auth_state_key_id TEXT,
  auth_state_nonce BYTEA,
  cooldown_until TIMESTAMPTZ,
  last_healthy_at TIMESTAMPTZ,
  last_error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retired_at TIMESTAMPTZ,
  CONSTRAINT browser_accounts_surface_ck CHECK (
    surface_key IN (
      'chatgpt_ui', 'perplexity_ui', 'gemini_ui', 'grok_ui',
      'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui'
    )
  ),
  CONSTRAINT browser_accounts_authentication_ck
    CHECK (authentication_mode IN ('guest', 'login_managed')),
  CONSTRAINT browser_accounts_status_ck CHECK (
    status IN ('healthy', 'cooldown', 'reauth_required', 'quarantined', 'retired')
  ),
  CONSTRAINT browser_accounts_auth_state_all_or_none_ck CHECK (
    (auth_state_ciphertext IS NULL AND auth_state_key_id IS NULL AND auth_state_nonce IS NULL)
    OR
    (auth_state_ciphertext IS NOT NULL AND auth_state_key_id IS NOT NULL AND auth_state_nonce IS NOT NULL)
  ),
  CONSTRAINT browser_accounts_guest_has_no_auth_state_ck CHECK (
    authentication_mode <> 'guest'
    OR (auth_state_ciphertext IS NULL AND auth_state_key_id IS NULL AND auth_state_nonce IS NULL)
  ),
  CONSTRAINT browser_accounts_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_browser_accounts_surface_status
  ON browser_accounts (surface_key, status, cooldown_until);

CREATE TABLE IF NOT EXISTS browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES browser_accounts(id) ON DELETE SET NULL,
  surface_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'phase1_mock',
  authentication_mode TEXT NOT NULL DEFAULT 'guest',
  requested_region TEXT NOT NULL,
  requested_language TEXT NOT NULL,
  requested_device TEXT NOT NULL,
  actual_region TEXT,
  actual_language TEXT,
  actual_device TEXT,
  bright_data_zone TEXT,
  bright_data_session_id TEXT,
  proxy_session_key TEXT,
  status TEXT NOT NULL DEFAULT 'opening',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT browser_sessions_surface_ck CHECK (
    surface_key IN (
      'chatgpt_ui', 'perplexity_ui', 'gemini_ui', 'grok_ui',
      'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui'
    )
  ),
  CONSTRAINT browser_sessions_authentication_ck
    CHECK (authentication_mode IN ('guest', 'login_managed')),
  CONSTRAINT browser_sessions_status_ck CHECK (
    status IN ('opening', 'active', 'idle', 'closed', 'failed', 'quarantined')
  ),
  CONSTRAINT browser_sessions_requested_device_ck
    CHECK (requested_device IN ('desktop', 'mobile', 'tablet')),
  CONSTRAINT browser_sessions_actual_geo_all_or_none_ck CHECK (
    (actual_region IS NULL AND actual_language IS NULL AND actual_device IS NULL)
    OR
    (actual_region IS NOT NULL AND actual_language IS NOT NULL AND actual_device IS NOT NULL)
  ),
  CONSTRAINT browser_sessions_actual_device_ck
    CHECK (actual_device IS NULL OR actual_device IN ('desktop', 'mobile', 'tablet')),
  CONSTRAINT browser_sessions_guest_account_ck
    CHECK (authentication_mode <> 'guest' OR account_id IS NULL),
  CONSTRAINT browser_sessions_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_browser_sessions_bright_data_session
  ON browser_sessions (bright_data_session_id)
  WHERE bright_data_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_browser_sessions_pool
  ON browser_sessions (surface_key, environment, requested_region, requested_language, status, last_used_at);

CREATE TABLE IF NOT EXISTS session_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_session_id UUID NOT NULL REFERENCES browser_sessions(id) ON DELETE CASCADE,
  account_id UUID REFERENCES browser_accounts(id) ON DELETE RESTRICT,
  lease_owner TEXT NOT NULL,
  lease_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  fencing_token BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  leased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  release_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT session_leases_fencing_positive_ck CHECK (fencing_token > 0),
  CONSTRAINT session_leases_owner_nonempty_ck CHECK (length(btrim(lease_owner)) > 0),
  CONSTRAINT session_leases_status_ck
    CHECK (status IN ('active', 'released', 'expired', 'revoked')),
  CONSTRAINT session_leases_terminal_timestamp_ck CHECK (
    (status = 'active' AND released_at IS NULL)
    OR (status <> 'active' AND released_at IS NOT NULL)
  ),
  CONSTRAINT session_leases_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_leases_one_active_session
  ON session_leases (browser_session_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_session_leases_one_active_account
  ON session_leases (account_id)
  WHERE status = 'active' AND account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_leases_expiry
  ON session_leases (status, lease_until);

CREATE TABLE IF NOT EXISTS collection_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_key TEXT NOT NULL UNIQUE,
  normalized_prompt_hash TEXT NOT NULL,
  original_prompt_text TEXT NOT NULL,
  requested_surface TEXT NOT NULL,
  route TEXT NOT NULL,
  region TEXT NOT NULL,
  language TEXT NOT NULL,
  device TEXT NOT NULL,
  daily_bucket DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  lease_owner TEXT,
  lease_token UUID,
  lease_fencing_token BIGINT NOT NULL DEFAULT 0,
  lease_until TIMESTAMPTZ,
  lease_heartbeat_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  native_retry_budget SMALLINT NOT NULL DEFAULT 1,
  fallback_attempt_budget SMALLINT NOT NULL DEFAULT 1,
  replay_count INTEGER NOT NULL DEFAULT 0,
  last_error_taxonomy TEXT,
  last_error_code TEXT,
  last_error_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  dead_letter_reason TEXT,
  completed_at TIMESTAMPTZ,
  unavailable_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  last_replayed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT collection_tasks_prompt_hash_ck
    CHECK (normalized_prompt_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT collection_tasks_prompt_nonempty_ck
    CHECK (octet_length(original_prompt_text) > 0),
  CONSTRAINT collection_tasks_surface_ck CHECK (
    requested_surface IN (
      'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui', 'grok_ui',
      'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui', 'claude'
    )
  ),
  CONSTRAINT collection_tasks_device_ck
    CHECK (device IN ('desktop', 'mobile', 'tablet')),
  CONSTRAINT collection_tasks_status_ck CHECK (
    status IN ('queued', 'leased', 'retry_wait', 'completed', 'unavailable', 'dead_letter')
  ),
  CONSTRAINT collection_tasks_retry_budget_ck
    CHECK (native_retry_budget BETWEEN 0 AND 1 AND fallback_attempt_budget >= 0),
  CONSTRAINT collection_tasks_replay_count_ck CHECK (replay_count >= 0),
  CONSTRAINT collection_tasks_fencing_nonnegative_ck CHECK (lease_fencing_token >= 0),
  CONSTRAINT collection_tasks_lease_shape_ck CHECK (
    (
      status = 'leased'
      AND lease_owner IS NOT NULL
      AND lease_token IS NOT NULL
      AND lease_until IS NOT NULL
      AND lease_heartbeat_at IS NOT NULL
      AND lease_fencing_token > 0
    )
    OR
    (
      status <> 'leased'
      AND lease_owner IS NULL
      AND lease_token IS NULL
      AND lease_until IS NULL
      AND lease_heartbeat_at IS NULL
    )
  ),
  CONSTRAINT collection_tasks_terminal_timestamp_ck CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR (status = 'unavailable' AND unavailable_at IS NOT NULL)
    OR (status = 'dead_letter' AND dead_lettered_at IS NOT NULL)
    OR (status NOT IN ('completed', 'unavailable', 'dead_letter'))
  ),
  CONSTRAINT collection_tasks_error_details_object_ck
    CHECK (jsonb_typeof(last_error_details) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_collection_tasks_claim
  ON collection_tasks (status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'retry_wait');

CREATE INDEX IF NOT EXISTS idx_collection_tasks_lease_expiry
  ON collection_tasks (lease_until)
  WHERE status = 'leased';

CREATE INDEX IF NOT EXISTS idx_collection_tasks_surface_status
  ON collection_tasks (requested_surface, status, created_at);

CREATE TABLE IF NOT EXISTS observation_credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contract_version TEXT NOT NULL,
  entitlement_key TEXT NOT NULL,
  surface_key TEXT NOT NULL,
  credit_class TEXT NOT NULL DEFAULT 'base',
  cycle_start DATE NOT NULL,
  cycle_end DATE NOT NULL,
  limit_units INTEGER NOT NULL,
  reserved_units INTEGER NOT NULL DEFAULT 0,
  settled_units INTEGER NOT NULL DEFAULT 0,
  released_units INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  entitlement_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CONSTRAINT observation_credit_accounts_entitlement_uq UNIQUE (
    customer_id,
    contract_version,
    entitlement_key,
    surface_key,
    credit_class,
    cycle_start,
    cycle_end
  ),
  CONSTRAINT observation_credit_accounts_identity_uq
    UNIQUE (id, customer_id, surface_key),
  CONSTRAINT observation_credit_accounts_surface_ck CHECK (
    surface_key IN (
      'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui', 'grok_ui',
      'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui', 'claude'
    )
  ),
  CONSTRAINT observation_credit_accounts_class_ck
    CHECK (credit_class IN ('base', 'flexible', 'addon')),
  CONSTRAINT observation_credit_accounts_cycle_ck CHECK (cycle_end >= cycle_start),
  CONSTRAINT observation_credit_accounts_units_ck CHECK (
    limit_units >= 0
    AND reserved_units >= 0
    AND settled_units >= 0
    AND released_units >= 0
    AND reserved_units + settled_units <= limit_units
  ),
  CONSTRAINT observation_credit_accounts_status_ck
    CHECK (status IN ('active', 'exhausted', 'closed')),
  CONSTRAINT observation_credit_accounts_closed_at_ck CHECK (
    (status = 'closed' AND closed_at IS NOT NULL)
    OR (status <> 'closed' AND closed_at IS NULL)
  ),
  CONSTRAINT observation_credit_accounts_snapshot_object_ck
    CHECK (jsonb_typeof(entitlement_snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_observation_credit_accounts_customer_cycle
  ON observation_credit_accounts (customer_id, cycle_start, cycle_end, status);

CREATE TABLE IF NOT EXISTS observation_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_key TEXT NOT NULL UNIQUE,
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  collection_task_id UUID NOT NULL REFERENCES collection_tasks(id) ON DELETE RESTRICT,
  credit_account_id UUID NOT NULL REFERENCES observation_credit_accounts(id) ON DELETE RESTRICT,
  original_prompt_text TEXT NOT NULL,
  normalized_prompt_hash TEXT NOT NULL,
  requested_surface TEXT NOT NULL,
  route TEXT NOT NULL,
  authentication_mode TEXT NOT NULL,
  region TEXT NOT NULL,
  language TEXT NOT NULL,
  device TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  daily_bucket DATE NOT NULL,
  demand_class TEXT NOT NULL DEFAULT 'base',
  contract_version TEXT NOT NULL DEFAULT 'diagnostic-monitoring-plan-v2-preproduction',
  observation_contract_version TEXT NOT NULL DEFAULT 'brightdata-playwright-serpapi-observation-v1',
  entitlement_snapshot JSONB NOT NULL,
  addon_entitlement_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  credit_units INTEGER NOT NULL DEFAULT 1,
  credit_state TEXT NOT NULL DEFAULT 'reserved',
  credit_reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credit_settled_at TIMESTAMPTZ,
  credit_released_at TIMESTAMPTZ,
  credit_terminal_reason TEXT,
  cohort_id TEXT,
  dataset_sha256 TEXT,
  parser_evaluated_fields INTEGER NOT NULL DEFAULT 0,
  parser_correct_fields INTEGER NOT NULL DEFAULT 0,
  structured_validation_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observation_demands_prompt_hash_ck
    CHECK (normalized_prompt_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT observation_demands_prompt_nonempty_ck
    CHECK (octet_length(original_prompt_text) > 0),
  CONSTRAINT observation_demands_surface_ck CHECK (
    requested_surface IN (
      'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui', 'grok_ui',
      'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui', 'claude'
    )
  ),
  CONSTRAINT observation_demands_authentication_ck
    CHECK (authentication_mode IN ('guest', 'none', 'login_managed', 'api')),
  CONSTRAINT observation_demands_device_ck
    CHECK (device IN ('desktop', 'mobile', 'tablet')),
  CONSTRAINT observation_demands_class_ck
    CHECK (demand_class IN ('base', 'flexible', 'addon')),
  CONSTRAINT observation_demands_credit_units_ck CHECK (credit_units = 1),
  CONSTRAINT observation_demands_credit_state_ck
    CHECK (credit_state IN ('reserved', 'settled', 'released')),
  CONSTRAINT observation_demands_credit_timestamps_ck CHECK (
    (credit_state = 'reserved' AND credit_settled_at IS NULL AND credit_released_at IS NULL)
    OR
    (credit_state = 'settled' AND credit_settled_at IS NOT NULL AND credit_released_at IS NULL)
    OR
    (credit_state = 'released' AND credit_settled_at IS NULL AND credit_released_at IS NOT NULL)
  ),
  CONSTRAINT observation_demands_cohort_pair_ck CHECK (
    (cohort_id IS NULL AND dataset_sha256 IS NULL)
    OR
    (cohort_id IS NOT NULL AND dataset_sha256 ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT observation_demands_parser_counts_ck CHECK (
    parser_evaluated_fields >= 0
    AND parser_correct_fields >= 0
    AND parser_correct_fields <= parser_evaluated_fields
  ),
  CONSTRAINT observation_demands_structured_validation_ck
    CHECK (structured_validation_status IN ('pending', 'passed', 'failed')),
  CONSTRAINT observation_demands_entitlement_object_ck
    CHECK (jsonb_typeof(entitlement_snapshot) = 'object'),
  CONSTRAINT observation_demands_addon_entitlement_object_ck
    CHECK (jsonb_typeof(addon_entitlement_snapshot) = 'object'),
  CONSTRAINT observation_demands_credit_account_identity_fk
    FOREIGN KEY (credit_account_id, customer_id, requested_surface)
    REFERENCES observation_credit_accounts (id, customer_id, surface_key)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_observation_demands_tracking_run
  ON observation_demands (tracking_run_id, credit_state);

CREATE INDEX IF NOT EXISTS idx_observation_demands_customer_bucket
  ON observation_demands (customer_id, daily_bucket, requested_surface);

CREATE INDEX IF NOT EXISTS idx_observation_demands_collection_task
  ON observation_demands (collection_task_id);

CREATE INDEX IF NOT EXISTS idx_observation_demands_credit_account
  ON observation_demands (credit_account_id, credit_state);

CREATE INDEX IF NOT EXISTS idx_observation_demands_cohort
  ON observation_demands (cohort_id, dataset_sha256, requested_surface)
  WHERE cohort_id IS NOT NULL;

ALTER TABLE observation_demands
  ADD CONSTRAINT observation_demands_id_credit_account_uq
    UNIQUE (id, credit_account_id);

CREATE TABLE IF NOT EXISTS observation_credit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_account_id UUID NOT NULL REFERENCES observation_credit_accounts(id) ON DELETE RESTRICT,
  observation_demand_id UUID NOT NULL REFERENCES observation_demands(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 1,
  from_state TEXT,
  to_state TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observation_credit_entries_demand_type_uq
    UNIQUE (observation_demand_id, entry_type),
  CONSTRAINT observation_credit_entries_demand_account_fk
    FOREIGN KEY (observation_demand_id, credit_account_id)
    REFERENCES observation_demands (id, credit_account_id)
    ON DELETE RESTRICT,
  CONSTRAINT observation_credit_entries_type_ck
    CHECK (entry_type IN ('reserve', 'settle', 'release')),
  CONSTRAINT observation_credit_entries_units_ck CHECK (units > 0),
  CONSTRAINT observation_credit_entries_from_state_ck
    CHECK (from_state IS NULL OR from_state IN ('reserved', 'settled', 'released')),
  CONSTRAINT observation_credit_entries_to_state_ck
    CHECK (to_state IN ('reserved', 'settled', 'released')),
  CONSTRAINT observation_credit_entries_transition_ck CHECK (
    (entry_type = 'reserve' AND from_state IS NULL AND to_state = 'reserved')
    OR (entry_type = 'settle' AND from_state = 'reserved' AND to_state = 'settled')
    OR (entry_type = 'release' AND from_state = 'reserved' AND to_state = 'released')
  ),
  CONSTRAINT observation_credit_entries_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_observation_credit_entries_account_created
  ON observation_credit_entries (credit_account_id, created_at);

CREATE OR REPLACE FUNCTION phase1_reject_credit_entry_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'observation credit entries are append-only';
END;
$$;

CREATE TRIGGER trg_phase1_observation_credit_entries_append_only
BEFORE UPDATE OR DELETE ON observation_credit_entries
FOR EACH ROW
EXECUTE FUNCTION phase1_reject_credit_entry_mutation();

CREATE TABLE IF NOT EXISTS observation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_task_id UUID NOT NULL REFERENCES collection_tasks(id) ON DELETE CASCADE,
  lease_owner TEXT NOT NULL,
  lease_token UUID NOT NULL,
  lease_fencing_token BIGINT NOT NULL,
  attempt_ordinal INTEGER NOT NULL,
  attempt_kind TEXT NOT NULL DEFAULT 'native_initial',
  supplier TEXT NOT NULL,
  transport_supplier TEXT NOT NULL,
  route TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  browser_account_id UUID REFERENCES browser_accounts(id) ON DELETE SET NULL,
  browser_session_id UUID REFERENCES browser_sessions(id) ON DELETE SET NULL,
  bright_data_zone TEXT,
  proxy_session_key TEXT,
  account_pseudonym TEXT,
  provider_request_id TEXT,
  provider_search_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transport_started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  latency_ms INTEGER,
  error_taxonomy TEXT,
  error_code TEXT,
  error_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  local_request_bytes BIGINT,
  local_response_bytes BIGINT,
  vendor_billed_bytes BIGINT,
  estimated_cost_micro_usd BIGINT,
  actual_cost_micro_usd BIGINT,
  adjusted_cost_micro_usd BIGINT,
  cost_state TEXT NOT NULL DEFAULT 'unknown',
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  retry_reason TEXT,
  fallback_reason TEXT,
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observation_attempts_task_ordinal_uq
    UNIQUE (collection_task_id, attempt_ordinal),
  CONSTRAINT observation_attempts_task_lease_fence_uq
    UNIQUE (collection_task_id, lease_fencing_token),
  CONSTRAINT observation_attempts_id_supplier_uq UNIQUE (id, supplier),
  CONSTRAINT observation_attempts_id_task_uq UNIQUE (id, collection_task_id),
  CONSTRAINT observation_attempts_lease_identity_uq
    UNIQUE (id, collection_task_id, lease_fencing_token),
  CONSTRAINT observation_attempts_lease_owner_nonempty_ck
    CHECK (length(btrim(lease_owner)) > 0),
  CONSTRAINT observation_attempts_lease_fencing_positive_ck
    CHECK (lease_fencing_token > 0),
  CONSTRAINT observation_attempts_ordinal_positive_ck CHECK (attempt_ordinal > 0),
  CONSTRAINT observation_attempts_kind_ck CHECK (
    attempt_kind IN ('native_initial', 'native_retry', 'aio_followup', 'api_fallback')
  ),
  CONSTRAINT observation_attempts_acquisition_mode_ck CHECK (
    acquisition_mode IN ('web_ui', 'serpapi_aio', 'sonar_api', 'openrouter_api', 'other_api')
  ),
  CONSTRAINT observation_attempts_status_ck CHECK (
    status IN (
      'created', 'cost_reserved', 'transport_started', 'succeeded', 'failed',
      'crashed', 'unknown', 'reconciliation_pending'
    )
  ),
  CONSTRAINT observation_attempts_latency_ck CHECK (latency_ms IS NULL OR latency_ms >= 0),
  CONSTRAINT observation_attempts_bytes_ck CHECK (
    (local_request_bytes IS NULL OR local_request_bytes >= 0)
    AND (local_response_bytes IS NULL OR local_response_bytes >= 0)
    AND (vendor_billed_bytes IS NULL OR vendor_billed_bytes >= 0)
  ),
  CONSTRAINT observation_attempts_costs_ck CHECK (
    (estimated_cost_micro_usd IS NULL OR estimated_cost_micro_usd >= 0)
    AND (actual_cost_micro_usd IS NULL OR actual_cost_micro_usd >= 0)
    AND (adjusted_cost_micro_usd IS NULL OR adjusted_cost_micro_usd >= 0)
  ),
  CONSTRAINT observation_attempts_cost_state_ck
    CHECK (cost_state IN ('unknown', 'estimated', 'actual', 'adjusted')),
  CONSTRAINT observation_attempts_cost_value_ck CHECK (
    (cost_state = 'unknown' AND actual_cost_micro_usd IS NULL AND adjusted_cost_micro_usd IS NULL)
    OR (cost_state = 'estimated' AND estimated_cost_micro_usd IS NOT NULL)
    OR (cost_state = 'actual' AND actual_cost_micro_usd IS NOT NULL)
    OR (cost_state = 'adjusted' AND adjusted_cost_micro_usd IS NOT NULL)
  ),
  CONSTRAINT observation_attempts_reconciliation_ck CHECK (
    reconciliation_status IN ('pending', 'reconciled', 'disputed', 'adjusted', 'not_required')
  ),
  CONSTRAINT observation_attempts_fallback_shape_ck CHECK (
    (attempt_kind = 'api_fallback' AND is_fallback)
    OR (attempt_kind <> 'api_fallback' AND NOT is_fallback)
  ),
  CONSTRAINT observation_attempts_timestamps_ck CHECK (
    transport_started_at IS NULL OR transport_started_at >= started_at
  ),
  CONSTRAINT observation_attempts_finished_at_ck CHECK (
    finished_at IS NULL OR finished_at >= started_at
  ),
  CONSTRAINT observation_attempts_error_details_object_ck
    CHECK (jsonb_typeof(error_details) = 'object'),
  CONSTRAINT observation_attempts_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_observation_attempts_task_status
  ON observation_attempts (collection_task_id, status, attempt_ordinal);

CREATE INDEX IF NOT EXISTS idx_observation_attempts_reconciliation
  ON observation_attempts (reconciliation_status, supplier, created_at);

CREATE INDEX IF NOT EXISTS idx_observation_attempts_provider_request
  ON observation_attempts (supplier, provider_request_id)
  WHERE provider_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS observation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_task_id UUID NOT NULL UNIQUE REFERENCES collection_tasks(id) ON DELETE CASCADE,
  final_attempt_id UUID REFERENCES observation_attempts(id) ON DELETE RESTRICT,
  requested_surface TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  outcome TEXT NOT NULL,
  answer_text TEXT,
  normalized_answer JSONB,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  requested_geo JSONB NOT NULL,
  actual_geo JSONB,
  adapter_version TEXT,
  parser_version TEXT,
  structured_validation_passed BOOLEAN NOT NULL DEFAULT FALSE,
  result_hash TEXT,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observation_results_surface_ck CHECK (
    requested_surface IN (
      'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui', 'grok_ui',
      'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui', 'claude'
    )
  ),
  CONSTRAINT observation_results_acquisition_mode_ck CHECK (
    acquisition_mode IN ('web_ui', 'serpapi_aio', 'sonar_api', 'openrouter_api', 'other_api')
  ),
  CONSTRAINT observation_results_outcome_ck CHECK (
    outcome IN (
      'web_ui_observed', 'serpapi_aio_observed', 'aio_not_triggered',
      'api_fallback', 'surface_unavailable', 'technical_failed'
    )
  ),
  CONSTRAINT observation_results_provenance_ck CHECK (
    (outcome = 'web_ui_observed' AND acquisition_mode = 'web_ui')
    OR (outcome IN ('serpapi_aio_observed', 'aio_not_triggered') AND acquisition_mode = 'serpapi_aio')
    OR (outcome = 'api_fallback' AND acquisition_mode IN ('sonar_api', 'openrouter_api', 'other_api'))
    OR (outcome IN ('surface_unavailable', 'technical_failed'))
  ),
  CONSTRAINT observation_results_citations_array_ck
    CHECK (jsonb_typeof(citations) = 'array'),
  CONSTRAINT observation_results_requested_geo_object_ck
    CHECK (jsonb_typeof(requested_geo) = 'object'),
  CONSTRAINT observation_results_actual_geo_object_ck
    CHECK (actual_geo IS NULL OR jsonb_typeof(actual_geo) = 'object'),
  CONSTRAINT observation_results_hash_ck
    CHECK (result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT observation_results_final_attempt_task_fk
    FOREIGN KEY (final_attempt_id, collection_task_id)
    REFERENCES observation_attempts (id, collection_task_id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_observation_results_outcome
  ON observation_results (requested_surface, outcome, finalized_at);

CREATE TABLE IF NOT EXISTS evidence_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_key TEXT NOT NULL UNIQUE,
  observation_result_id UUID NOT NULL UNIQUE REFERENCES observation_results(id) ON DELETE RESTRICT,
  requested_surface TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_size_bytes BIGINT NOT NULL,
  object_path TEXT NOT NULL,
  retention_class TEXT NOT NULL,
  requested_geo JSONB NOT NULL,
  actual_geo JSONB NOT NULL,
  adapter_version TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  artifact_verified BOOLEAN NOT NULL DEFAULT FALSE,
  redaction_result TEXT NOT NULL DEFAULT 'pending',
  sensitive_auth_data_present BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT evidence_manifests_acquisition_mode_ck CHECK (
    acquisition_mode IN ('web_ui', 'serpapi_aio', 'sonar_api', 'openrouter_api', 'other_api')
  ),
  CONSTRAINT evidence_manifests_surface_ck CHECK (
    requested_surface IN (
      'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui', 'grok_ui',
      'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui', 'claude'
    )
  ),
  CONSTRAINT evidence_manifests_sha256_ck
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT evidence_manifests_size_ck CHECK (content_size_bytes >= 0),
  CONSTRAINT evidence_manifests_verification_status_ck
    CHECK (verification_status IN ('pending', 'verified', 'failed')),
  CONSTRAINT evidence_manifests_redaction_result_ck
    CHECK (redaction_result IN ('pending', 'passed', 'failed')),
  CONSTRAINT evidence_manifests_no_sensitive_auth_ck
    CHECK (sensitive_auth_data_present = FALSE),
  CONSTRAINT evidence_manifests_verified_shape_ck CHECK (
    verification_status <> 'verified'
    OR (artifact_verified = TRUE AND redaction_result = 'passed' AND verified_at IS NOT NULL)
  ),
  CONSTRAINT evidence_manifests_requested_geo_object_ck
    CHECK (jsonb_typeof(requested_geo) = 'object'),
  CONSTRAINT evidence_manifests_actual_geo_object_ck
    CHECK (jsonb_typeof(actual_geo) = 'object'),
  CONSTRAINT evidence_manifests_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_evidence_manifests_verification
  ON evidence_manifests (verification_status, created_at);

CREATE TABLE IF NOT EXISTS observation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_manifest_id UUID NOT NULL REFERENCES evidence_manifests(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  object_path TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  content_size_bytes BIGINT NOT NULL,
  compression TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  redaction_result TEXT NOT NULL DEFAULT 'pending',
  retention_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observation_artifacts_manifest_path_uq
    UNIQUE (evidence_manifest_id, object_path),
  CONSTRAINT observation_artifacts_type_ck CHECK (
    artifact_type IN ('compressed_json', 'redacted_dom', 'sampled_screenshot', 'network_summary')
  ),
  CONSTRAINT observation_artifacts_sha256_ck
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT observation_artifacts_size_ck CHECK (content_size_bytes >= 0),
  CONSTRAINT observation_artifacts_verification_status_ck
    CHECK (verification_status IN ('pending', 'verified', 'failed')),
  CONSTRAINT observation_artifacts_redaction_result_ck
    CHECK (redaction_result IN ('pending', 'passed', 'failed')),
  CONSTRAINT observation_artifacts_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE observation_demands
  ADD COLUMN IF NOT EXISTS terminal_result_id UUID REFERENCES observation_results(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS settlement_evidence_manifest_id UUID REFERENCES evidence_manifests(id) ON DELETE RESTRICT;

ALTER TABLE observation_demands
  ADD CONSTRAINT observation_demands_terminal_links_ck CHECK (
    (credit_state = 'reserved' AND terminal_result_id IS NULL AND settlement_evidence_manifest_id IS NULL)
    OR
    (credit_state = 'settled' AND terminal_result_id IS NOT NULL AND settlement_evidence_manifest_id IS NOT NULL)
    OR
    (credit_state = 'released' AND terminal_result_id IS NOT NULL AND settlement_evidence_manifest_id IS NULL)
  );

CREATE OR REPLACE FUNCTION phase1_validate_demand_terminal_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  task_row collection_tasks%ROWTYPE;
  credit_account_row observation_credit_accounts%ROWTYPE;
  result_row observation_results%ROWTYPE;
  attempt_row observation_attempts%ROWTYPE;
  manifest_row evidence_manifests%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.credit_state IN ('settled', 'released') AND (
    NEW.credit_state IS DISTINCT FROM OLD.credit_state
    OR NEW.terminal_result_id IS DISTINCT FROM OLD.terminal_result_id
    OR NEW.settlement_evidence_manifest_id IS DISTINCT FROM OLD.settlement_evidence_manifest_id
    OR NEW.credit_settled_at IS DISTINCT FROM OLD.credit_settled_at
    OR NEW.credit_released_at IS DISTINCT FROM OLD.credit_released_at
    OR NEW.credit_terminal_reason IS DISTINCT FROM OLD.credit_terminal_reason
    OR NEW.contract_version IS DISTINCT FROM OLD.contract_version
    OR NEW.observation_contract_version IS DISTINCT FROM OLD.observation_contract_version
    OR NEW.entitlement_snapshot IS DISTINCT FROM OLD.entitlement_snapshot
    OR NEW.addon_entitlement_snapshot IS DISTINCT FROM OLD.addon_entitlement_snapshot
  ) THEN
    RAISE EXCEPTION 'terminal demand credit state and lineage are immutable';
  END IF;

  SELECT * INTO task_row
  FROM collection_tasks
  WHERE id = NEW.collection_task_id;

  IF NOT FOUND
    OR task_row.normalized_prompt_hash <> NEW.normalized_prompt_hash
    OR task_row.original_prompt_text <> NEW.original_prompt_text
    OR task_row.requested_surface <> NEW.requested_surface
    OR task_row.route <> NEW.route
    OR task_row.region <> NEW.region
    OR task_row.language <> NEW.language
    OR task_row.device <> NEW.device
    OR task_row.daily_bucket <> NEW.daily_bucket THEN
    RAISE EXCEPTION 'demand identity must exactly match its collection task';
  END IF;

  SELECT * INTO credit_account_row
  FROM observation_credit_accounts
  WHERE id = NEW.credit_account_id;

  IF NOT FOUND
    OR credit_account_row.customer_id <> NEW.customer_id
    OR credit_account_row.surface_key <> NEW.requested_surface
    OR NEW.daily_bucket < credit_account_row.cycle_start
    OR NEW.daily_bucket > credit_account_row.cycle_end THEN
    RAISE EXCEPTION 'demand must use its customer surface credit account and cycle';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM observation_credit_entries AS credit_entry
    WHERE credit_entry.observation_demand_id = NEW.id
      AND credit_entry.credit_account_id = NEW.credit_account_id
      AND credit_entry.entry_type = 'reserve'
      AND credit_entry.units = NEW.credit_units
      AND credit_entry.from_state IS NULL
      AND credit_entry.to_state = 'reserved'
  ) THEN
    RAISE EXCEPTION 'observation demand requires a matching reserve credit entry';
  END IF;

  IF NEW.credit_state = 'reserved' THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM observation_credit_entries AS credit_entry
    WHERE credit_entry.observation_demand_id = NEW.id
      AND credit_entry.credit_account_id = NEW.credit_account_id
      AND credit_entry.entry_type = CASE NEW.credit_state
        WHEN 'settled' THEN 'settle'
        WHEN 'released' THEN 'release'
      END
      AND credit_entry.units = NEW.credit_units
      AND credit_entry.from_state = 'reserved'
      AND credit_entry.to_state = NEW.credit_state
  ) THEN
    RAISE EXCEPTION 'terminal demand requires a matching terminal credit entry';
  END IF;

  SELECT * INTO result_row
  FROM observation_results
  WHERE id = NEW.terminal_result_id;

  IF NOT FOUND
    OR result_row.collection_task_id <> NEW.collection_task_id
    OR result_row.requested_surface <> NEW.requested_surface
    OR result_row.requested_geo <> jsonb_build_object(
      'region', NEW.region,
      'language', NEW.language,
      'device', NEW.device
    ) THEN
    RAISE EXCEPTION 'terminal result must belong to demand collection task';
  END IF;

  IF NEW.credit_state = 'settled' THEN
    IF result_row.outcome NOT IN ('web_ui_observed', 'serpapi_aio_observed', 'aio_not_triggered') THEN
      RAISE EXCEPTION 'only native valid observation outcomes may settle credit';
    END IF;

    SELECT * INTO attempt_row
    FROM observation_attempts
    WHERE id = result_row.final_attempt_id;

    IF NOT FOUND
      OR attempt_row.collection_task_id <> result_row.collection_task_id
      OR attempt_row.acquisition_mode <> result_row.acquisition_mode
      OR (
        result_row.requested_surface = 'google_aio'
        AND result_row.acquisition_mode <> 'serpapi_aio'
      )
      OR (
        result_row.requested_surface <> 'google_aio'
        AND result_row.acquisition_mode <> 'web_ui'
      ) THEN
      RAISE EXCEPTION 'settled result acquisition must match its attempt and frozen surface route';
    END IF;

    SELECT * INTO manifest_row
    FROM evidence_manifests
    WHERE id = NEW.settlement_evidence_manifest_id;

    IF NOT FOUND
      OR manifest_row.observation_result_id <> result_row.id
      OR manifest_row.requested_surface <> result_row.requested_surface
      OR manifest_row.acquisition_mode <> result_row.acquisition_mode
      OR manifest_row.requested_geo <> result_row.requested_geo
      OR result_row.actual_geo IS NULL
      OR result_row.actual_geo <> result_row.requested_geo
      OR manifest_row.actual_geo <> result_row.actual_geo
      OR manifest_row.verification_status <> 'verified'
      OR manifest_row.artifact_verified IS NOT TRUE
      OR manifest_row.redaction_result <> 'passed'
      OR manifest_row.sensitive_auth_data_present IS NOT FALSE
      OR NOT EXISTS (
        SELECT 1
        FROM observation_artifacts artifact_row
        WHERE artifact_row.evidence_manifest_id = manifest_row.id
          AND artifact_row.object_path = manifest_row.object_path
          AND artifact_row.content_sha256 = manifest_row.content_sha256
          AND artifact_row.content_size_bytes = manifest_row.content_size_bytes
          AND artifact_row.verification_status = 'verified'
          AND artifact_row.redaction_result = 'passed'
      )
      OR EXISTS (
        SELECT 1
        FROM observation_artifacts artifact_row
        WHERE artifact_row.evidence_manifest_id = manifest_row.id
          AND (
            artifact_row.verification_status <> 'verified'
            OR artifact_row.redaction_result <> 'passed'
          )
      ) THEN
      RAISE EXCEPTION 'settled credit requires a verified, redacted evidence manifest';
    END IF;
  ELSIF result_row.outcome NOT IN ('api_fallback', 'surface_unavailable', 'technical_failed') THEN
    RAISE EXCEPTION 'released credit requires a non-native terminal outcome';
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_phase1_validate_demand_terminal_state
AFTER INSERT OR UPDATE OF
  credit_state,
  credit_settled_at,
  credit_released_at,
  credit_terminal_reason,
  contract_version,
  observation_contract_version,
  entitlement_snapshot,
  addon_entitlement_snapshot,
  terminal_result_id,
  settlement_evidence_manifest_id,
  collection_task_id,
  credit_account_id,
  customer_id,
  original_prompt_text,
  normalized_prompt_hash,
  requested_surface,
  route,
  region,
  language,
  device,
  daily_bucket
ON observation_demands
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION phase1_validate_demand_terminal_state();

-- Once customer credit is terminal, its result/evidence lineage is immutable.
-- This closes the reverse-update hole that a trigger on demands alone cannot
-- see when a result or manifest is weakened after settlement.
CREATE OR REPLACE FUNCTION phase1_protect_terminal_result()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM observation_demands
    WHERE terminal_result_id = OLD.id
      AND credit_state IN ('settled', 'released')
  ) THEN
    RAISE EXCEPTION 'terminal observation result is immutable after credit transition';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase1_protect_terminal_result
BEFORE UPDATE OR DELETE ON observation_results
FOR EACH ROW
EXECUTE FUNCTION phase1_protect_terminal_result();

CREATE OR REPLACE FUNCTION phase1_protect_settlement_manifest()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM observation_demands
    WHERE settlement_evidence_manifest_id = OLD.id
      AND credit_state = 'settled'
  ) THEN
    RAISE EXCEPTION 'settlement evidence manifest is immutable after credit settlement';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase1_protect_settlement_manifest
BEFORE UPDATE OR DELETE ON evidence_manifests
FOR EACH ROW
EXECUTE FUNCTION phase1_protect_settlement_manifest();

CREATE OR REPLACE FUNCTION phase1_protect_settlement_artifact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM observation_demands
    WHERE settlement_evidence_manifest_id = CASE
      WHEN TG_OP = 'INSERT' THEN NEW.evidence_manifest_id
      ELSE OLD.evidence_manifest_id
    END
      AND credit_state = 'settled'
  ) THEN
    RAISE EXCEPTION 'settlement evidence artifact is immutable after credit settlement';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase1_protect_settlement_artifact
BEFORE INSERT OR UPDATE OR DELETE ON observation_artifacts
FOR EACH ROW
EXECUTE FUNCTION phase1_protect_settlement_artifact();

CREATE TABLE IF NOT EXISTS collection_task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_task_id UUID NOT NULL REFERENCES collection_tasks(id) ON DELETE CASCADE,
  observation_attempt_id UUID REFERENCES observation_attempts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  lease_token UUID,
  fencing_token BIGINT,
  idempotency_key TEXT NOT NULL UNIQUE,
  actor TEXT NOT NULL,
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT collection_task_events_type_ck CHECK (
    event_type IN (
      'enqueued', 'claimed', 'heartbeat', 'attempt_started', 'attempt_finished',
      'retry_scheduled', 'lease_expired', 'completed', 'unavailable',
      'dead_lettered', 'replayed'
    )
  ),
  CONSTRAINT collection_task_events_fencing_ck
    CHECK (fencing_token IS NULL OR fencing_token > 0),
  CONSTRAINT collection_task_events_details_object_ck
    CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_collection_task_events_task_created
  ON collection_task_events (collection_task_id, created_at);

CREATE TABLE IF NOT EXISTS supplier_budget_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL UNIQUE,
  cohort_id TEXT,
  budget_approval_id TEXT,
  status TEXT NOT NULL DEFAULT 'disarmed',
  total_cap_micro_usd BIGINT NOT NULL DEFAULT 0,
  total_reserved_micro_usd BIGINT NOT NULL DEFAULT 0,
  total_actual_micro_usd BIGINT NOT NULL DEFAULT 0,
  external_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paid_run_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pricing_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  stop_reason TEXT,
  approved_at TIMESTAMPTZ,
  hard_stopped_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_budget_scopes_status_ck CHECK (
    status IN ('disarmed', 'approved', 'active', 'hard_stopped', 'closed')
  ),
  CONSTRAINT supplier_budget_scopes_amounts_ck CHECK (
    total_cap_micro_usd >= 0
    AND total_reserved_micro_usd >= 0
    AND total_actual_micro_usd >= 0
  ),
  CONSTRAINT supplier_budget_scopes_cap_ck CHECK (
    status = 'hard_stopped'
    OR total_reserved_micro_usd + total_actual_micro_usd <= total_cap_micro_usd
  ),
  CONSTRAINT supplier_budget_scopes_approval_ck CHECK (
    status = 'disarmed'
    OR (budget_approval_id IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT supplier_budget_scopes_transport_dependency_ck CHECK (
    (NOT paid_run_enabled OR external_transport_enabled)
    AND (NOT live_transport_enabled OR external_transport_enabled)
  ),
  CONSTRAINT supplier_budget_scopes_evidence_objects_ck CHECK (
    jsonb_typeof(pricing_evidence) = 'object'
    AND jsonb_typeof(policy_evidence) = 'object'
  )
);

CREATE TABLE IF NOT EXISTS supplier_budget_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_scope_id UUID NOT NULL REFERENCES supplier_budget_scopes(id) ON DELETE CASCADE,
  supplier TEXT NOT NULL,
  cap_micro_usd BIGINT NOT NULL DEFAULT 0,
  reserved_micro_usd BIGINT NOT NULL DEFAULT 0,
  actual_micro_usd BIGINT NOT NULL DEFAULT 0,
  hard_stopped BOOLEAN NOT NULL DEFAULT FALSE,
  stop_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_budget_accounts_scope_supplier_uq
    UNIQUE (budget_scope_id, supplier),
  CONSTRAINT supplier_budget_accounts_identity_uq
    UNIQUE (id, budget_scope_id, supplier),
  CONSTRAINT supplier_budget_accounts_supplier_ck
    CHECK (supplier IN ('bright_data', 'serpapi', 'other')),
  CONSTRAINT supplier_budget_accounts_amounts_ck CHECK (
    cap_micro_usd >= 0 AND reserved_micro_usd >= 0 AND actual_micro_usd >= 0
  ),
  CONSTRAINT supplier_budget_accounts_cap_ck CHECK (
    hard_stopped OR reserved_micro_usd + actual_micro_usd <= cap_micro_usd
  )
);

CREATE INDEX IF NOT EXISTS idx_supplier_budget_accounts_scope_stop
  ON supplier_budget_accounts (budget_scope_id, hard_stopped, supplier);

CREATE TABLE IF NOT EXISTS supplier_budget_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  permit_token_hash TEXT NOT NULL UNIQUE,
  permit_token_key_id TEXT NOT NULL,
  budget_scope_id UUID NOT NULL,
  budget_account_id UUID NOT NULL,
  collection_task_id UUID NOT NULL,
  observation_attempt_id UUID NOT NULL,
  lease_fencing_token BIGINT NOT NULL,
  supplier TEXT NOT NULL,
  transport_supplier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved',
  max_cost_micro_usd BIGINT NOT NULL,
  actual_cost_micro_usd BIGINT,
  adjusted_cost_micro_usd BIGINT,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reservation_expires_at TIMESTAMPTZ NOT NULL,
  transport_started_at TIMESTAMPTZ,
  reconciliation_due_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  adjusted_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT supplier_budget_reservations_attempt_uq UNIQUE (observation_attempt_id),
  CONSTRAINT supplier_budget_reservations_attempt_lease_fk
    FOREIGN KEY (observation_attempt_id, collection_task_id, lease_fencing_token)
    REFERENCES observation_attempts (id, collection_task_id, lease_fencing_token)
    ON DELETE RESTRICT,
  CONSTRAINT supplier_budget_reservations_account_fk
    FOREIGN KEY (budget_account_id, budget_scope_id, supplier)
    REFERENCES supplier_budget_accounts (id, budget_scope_id, supplier)
    ON DELETE RESTRICT,
  CONSTRAINT supplier_budget_reservations_attempt_supplier_fk
    FOREIGN KEY (observation_attempt_id, supplier)
    REFERENCES observation_attempts (id, supplier)
    ON DELETE RESTRICT,
  CONSTRAINT supplier_budget_reservations_permit_hash_ck
    CHECK (permit_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT supplier_budget_reservations_permit_key_nonempty_ck
    CHECK (length(btrim(permit_token_key_id)) > 0),
  CONSTRAINT supplier_budget_reservations_fencing_positive_ck
    CHECK (lease_fencing_token > 0),
  CONSTRAINT supplier_budget_reservations_expiry_ck
    CHECK (reservation_expires_at > reserved_at),
  CONSTRAINT supplier_budget_reservations_status_ck CHECK (
    status IN (
      'reserved', 'transport_started', 'reconciliation_pending',
      'settled', 'released', 'adjusted', 'overrun_hard_stopped'
    )
  ),
  CONSTRAINT supplier_budget_reservations_cost_ck CHECK (
    max_cost_micro_usd > 0
    AND (actual_cost_micro_usd IS NULL OR actual_cost_micro_usd >= 0)
    AND (adjusted_cost_micro_usd IS NULL OR adjusted_cost_micro_usd >= 0)
  ),
  CONSTRAINT supplier_budget_reservations_state_shape_ck CHECK (
    (
      status = 'reserved'
      AND transport_started_at IS NULL
      AND reconciliation_due_at IS NULL
      AND actual_cost_micro_usd IS NULL
      AND settled_at IS NULL
      AND released_at IS NULL
      AND adjusted_at IS NULL
    ) OR (
      status = 'transport_started'
      AND transport_started_at IS NOT NULL
      AND reconciliation_due_at IS NULL
      AND actual_cost_micro_usd IS NULL
      AND settled_at IS NULL
      AND released_at IS NULL
    ) OR (
      status = 'reconciliation_pending'
      AND transport_started_at IS NOT NULL
      AND reconciliation_due_at IS NOT NULL
      AND actual_cost_micro_usd IS NULL
      AND settled_at IS NULL
      AND released_at IS NULL
    ) OR (
      status = 'settled'
      AND transport_started_at IS NOT NULL
      AND actual_cost_micro_usd IS NOT NULL
      AND settled_at IS NOT NULL
      AND released_at IS NULL
    ) OR (
      status = 'released'
      AND transport_started_at IS NULL
      AND actual_cost_micro_usd = 0
      AND released_at IS NOT NULL
      AND settled_at IS NULL
    ) OR (
      status = 'adjusted'
      AND transport_started_at IS NOT NULL
      AND actual_cost_micro_usd IS NOT NULL
      AND adjusted_cost_micro_usd IS NOT NULL
      AND settled_at IS NOT NULL
      AND adjusted_at IS NOT NULL
      AND released_at IS NULL
    ) OR (
      status = 'overrun_hard_stopped'
      AND transport_started_at IS NOT NULL
      AND actual_cost_micro_usd IS NOT NULL
      AND settled_at IS NOT NULL
      AND released_at IS NULL
    )
  ),
  CONSTRAINT supplier_budget_reservations_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_supplier_budget_reservations_scope_status
  ON supplier_budget_reservations (budget_scope_id, supplier, status, reserved_at);

CREATE INDEX IF NOT EXISTS idx_supplier_budget_reservations_reconciliation
  ON supplier_budget_reservations (status, reconciliation_due_at)
  WHERE status IN ('transport_started', 'reconciliation_pending', 'overrun_hard_stopped');

CREATE INDEX IF NOT EXISTS idx_supplier_budget_reservations_expiry
  ON supplier_budget_reservations (reservation_expires_at)
  WHERE status = 'reserved';

CREATE TABLE IF NOT EXISTS supplier_usage_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT NOT NULL,
  billing_scope_id TEXT NOT NULL UNIQUE,
  cohort_id TEXT,
  dataset_sha256 TEXT,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  provider_snapshot_id TEXT,
  local_billable_units BIGINT NOT NULL,
  supplier_billable_units BIGINT,
  billed_bytes BIGINT,
  billed_cost_micro_usd BIGINT,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_usage_snapshots_id_supplier_uq UNIQUE (id, supplier),
  CONSTRAINT supplier_usage_snapshots_supplier_ck
    CHECK (supplier IN ('bright_data', 'serpapi', 'other')),
  CONSTRAINT supplier_usage_snapshots_period_ck CHECK (period_end >= period_start),
  CONSTRAINT supplier_usage_snapshots_units_ck CHECK (
    local_billable_units >= 0
    AND (supplier_billable_units IS NULL OR supplier_billable_units >= 0)
    AND (billed_bytes IS NULL OR billed_bytes >= 0)
    AND (billed_cost_micro_usd IS NULL OR billed_cost_micro_usd >= 0)
  ),
  CONSTRAINT supplier_usage_snapshots_reconciliation_ck CHECK (
    reconciliation_status IN ('pending', 'reconciled', 'disputed', 'adjusted')
  ),
  CONSTRAINT supplier_usage_snapshots_cohort_pair_ck CHECK (
    (cohort_id IS NULL AND dataset_sha256 IS NULL)
    OR (cohort_id IS NOT NULL AND dataset_sha256 ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT supplier_usage_snapshots_payload_object_ck
    CHECK (jsonb_typeof(source_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_supplier_usage_snapshots_reconciliation
  ON supplier_usage_snapshots (supplier, reconciliation_status, period_end);

CREATE TABLE IF NOT EXISTS supplier_cost_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_attempt_id UUID NOT NULL,
  supplier_usage_snapshot_id UUID,
  supplier TEXT NOT NULL,
  allocation_version INTEGER NOT NULL DEFAULT 1,
  cost_status TEXT NOT NULL DEFAULT 'unknown',
  amount_micro_usd BIGINT,
  allocated_bytes BIGINT,
  allocated_billable_units BIGINT,
  reconciliation_status TEXT NOT NULL DEFAULT 'pending',
  allocation_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_cost_entries_attempt_version_uq
    UNIQUE (observation_attempt_id, allocation_version),
  CONSTRAINT supplier_cost_entries_attempt_supplier_fk
    FOREIGN KEY (observation_attempt_id, supplier)
    REFERENCES observation_attempts (id, supplier)
    ON DELETE RESTRICT,
  CONSTRAINT supplier_cost_entries_snapshot_supplier_fk
    FOREIGN KEY (supplier_usage_snapshot_id, supplier)
    REFERENCES supplier_usage_snapshots (id, supplier)
    ON DELETE RESTRICT,
  CONSTRAINT supplier_cost_entries_version_positive_ck CHECK (allocation_version > 0),
  CONSTRAINT supplier_cost_entries_supplier_ck
    CHECK (supplier IN ('bright_data', 'serpapi', 'other')),
  CONSTRAINT supplier_cost_entries_status_ck
    CHECK (cost_status IN ('unknown', 'estimated', 'actual', 'adjusted')),
  CONSTRAINT supplier_cost_entries_unknown_not_zero_ck CHECK (
    (cost_status = 'unknown' AND amount_micro_usd IS NULL)
    OR (cost_status <> 'unknown' AND amount_micro_usd IS NOT NULL AND amount_micro_usd >= 0)
  ),
  CONSTRAINT supplier_cost_entries_units_ck CHECK (
    (allocated_bytes IS NULL OR allocated_bytes >= 0)
    AND (allocated_billable_units IS NULL OR allocated_billable_units >= 0)
  ),
  CONSTRAINT supplier_cost_entries_reconciliation_ck CHECK (
    reconciliation_status IN ('pending', 'reconciled', 'disputed', 'adjusted', 'not_required')
  ),
  CONSTRAINT supplier_cost_entries_metadata_object_ck
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_supplier_cost_entries_snapshot
  ON supplier_cost_entries (supplier_usage_snapshot_id, supplier, reconciliation_status);

CREATE INDEX IF NOT EXISTS idx_supplier_cost_entries_attempt
  ON supplier_cost_entries (observation_attempt_id, allocation_version DESC);

-- Frozen-plan compatibility name.  supplier_cost_entries is the one writable
-- source of truth; this view exposes the documented cost_allocations contract
-- without introducing a second ledger or a dual-write path.
CREATE OR REPLACE VIEW cost_allocations AS
SELECT
  id,
  observation_attempt_id,
  supplier_usage_snapshot_id,
  supplier,
  allocation_version,
  cost_status,
  amount_micro_usd,
  allocated_bytes,
  allocated_billable_units,
  reconciliation_status,
  allocation_reason,
  metadata,
  created_at,
  updated_at
FROM supplier_cost_entries;

-- Compatibility writes remain feature-flagged.  The new IDs make retries and
-- DLQ replays idempotent without reclassifying legacy prompt/provider quotas as
-- the authoritative Phase 1 credit or supplier-cost ledgers.
ALTER TABLE tracking_runs
  ADD COLUMN IF NOT EXISTS observation_contract_version TEXT,
  ADD COLUMN IF NOT EXISTS observation_fanout_idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS observation_fanout_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observation_fanin_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_runs_observation_fanout_key
  ON tracking_runs (observation_fanout_idempotency_key)
  WHERE observation_fanout_idempotency_key IS NOT NULL;

ALTER TABLE prompt_results
  ADD COLUMN IF NOT EXISTS observation_demand_id UUID REFERENCES observation_demands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observation_result_id UUID REFERENCES observation_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observation_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_results_observation_demand
  ON prompt_results (observation_demand_id)
  WHERE observation_demand_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prompt_results_observation_idempotency
  ON prompt_results (observation_idempotency_key)
  WHERE observation_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prompt_results_observation_result
  ON prompt_results (observation_result_id)
  WHERE observation_result_id IS NOT NULL;

ALTER TABLE usage_ledger
  ADD COLUMN IF NOT EXISTS observation_demand_id UUID REFERENCES observation_demands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observation_attempt_id UUID REFERENCES observation_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_cost_entry_id UUID REFERENCES supplier_cost_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observation_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usage_ledger_observation_idempotency
  ON usage_ledger (observation_idempotency_key)
  WHERE observation_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_ledger_observation_demand
  ON usage_ledger (observation_demand_id)
  WHERE observation_demand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_ledger_observation_attempt
  ON usage_ledger (observation_attempt_id)
  WHERE observation_attempt_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_ledger_supplier_cost_entry
  ON usage_ledger (supplier_cost_entry_id)
  WHERE supplier_cost_entry_id IS NOT NULL;

CREATE OR REPLACE VIEW phase1_queue_metrics AS
SELECT
  COALESCE(requested_surface, '__all__') AS requested_surface,
  (COUNT(*) FILTER (WHERE status = 'queued'))::BIGINT AS queued_tasks,
  (COUNT(*) FILTER (WHERE status = 'leased'))::BIGINT AS leased_tasks,
  (COUNT(*) FILTER (WHERE status = 'retry_wait'))::BIGINT AS retry_wait_tasks,
  (COUNT(*) FILTER (WHERE status = 'completed'))::BIGINT AS completed_tasks,
  (COUNT(*) FILTER (WHERE status = 'unavailable'))::BIGINT AS unavailable_tasks,
  (COUNT(*) FILTER (WHERE status = 'dead_letter'))::BIGINT AS dead_letter_tasks,
  (COUNT(*) FILTER (
    WHERE status IN ('queued', 'retry_wait') AND next_attempt_at <= NOW()
  ))::BIGINT AS ready_tasks,
  (COUNT(*) FILTER (
    WHERE status = 'leased' AND lease_until <= NOW()
  ))::BIGINT AS expired_leases,
  MIN(created_at) FILTER (
    WHERE status IN ('queued', 'retry_wait') AND next_attempt_at <= NOW()
  ) AS oldest_ready_at,
  CASE
    WHEN MIN(created_at) FILTER (
      WHERE status IN ('queued', 'retry_wait') AND next_attempt_at <= NOW()
    ) IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (
      NOW() - MIN(created_at) FILTER (
        WHERE status IN ('queued', 'retry_wait') AND next_attempt_at <= NOW()
      )
    ))::BIGINT
  END AS oldest_ready_age_seconds,
  NOW() AS measured_at
FROM collection_tasks
GROUP BY GROUPING SETS ((requested_surface), ());

CREATE OR REPLACE VIEW phase1_poc_metrics_export_v1 AS
WITH demand_metrics AS (
  SELECT
    d.cohort_id,
    d.dataset_sha256,
    d.requested_surface,
    MIN(d.route) AS route,
    MIN(d.authentication_mode) AS authentication,
    COUNT(*)::BIGINT AS planned_demands,
    (COUNT(*) FILTER (
      WHERE d.credit_state = 'settled'
        AND r.outcome IN ('web_ui_observed', 'serpapi_aio_observed', 'aio_not_triggered')
    ))::BIGINT AS native_valid_observations,
    (COUNT(*) FILTER (
      WHERE em.verification_status = 'verified'
        AND em.artifact_verified = TRUE
        AND em.redaction_result = 'passed'
        AND em.sensitive_auth_data_present = FALSE
    ))::BIGINT AS evidence_records,
    (COUNT(*) FILTER (
      WHERE d.structured_validation_status = 'passed'
    ))::BIGINT AS structured_validations_passed,
    SUM(d.parser_evaluated_fields)::BIGINT AS parser_evaluated_fields,
    SUM(d.parser_correct_fields)::BIGINT AS parser_correct_fields,
    (COUNT(*) FILTER (
      WHERE COALESCE(d.credit_settled_at, d.credit_released_at) <= d.scheduled_for + INTERVAL '2 hours'
    ))::BIGINT AS completed_within_2h,
    (COUNT(*) FILTER (
      WHERE COALESCE(d.credit_settled_at, d.credit_released_at) <= d.scheduled_for + INTERVAL '6 hours'
    ))::BIGINT AS completed_within_6h
  FROM observation_demands d
  LEFT JOIN observation_results r ON r.id = d.terminal_result_id
  LEFT JOIN evidence_manifests em ON em.observation_result_id = r.id
  WHERE d.cohort_id IS NOT NULL
  GROUP BY d.cohort_id, d.dataset_sha256, d.requested_surface
),
cohort_tasks AS (
  SELECT DISTINCT
    cohort_id,
    dataset_sha256,
    requested_surface,
    collection_task_id
  FROM observation_demands
  WHERE cohort_id IS NOT NULL
),
attempt_metrics AS (
  SELECT
    ct.cohort_id,
    ct.dataset_sha256,
    ct.requested_surface,
    COUNT(a.id)::BIGINT AS total_supplier_attempts,
    (COUNT(a.id) FILTER (WHERE a.is_fallback))::BIGINT AS api_fallback_attempts,
    COALESCE(SUM(a.vendor_billed_bytes) FILTER (
      WHERE a.supplier = 'bright_data' AND a.acquisition_mode = 'web_ui'
    ), 0)::BIGINT AS vendor_billed_bytes,
    (COUNT(a.id) FILTER (
      WHERE a.acquisition_mode = 'serpapi_aio'
        AND a.attempt_kind = 'native_initial'
        AND a.status = 'succeeded'
    ))::BIGINT AS aio_initial_successful,
    (COUNT(a.id) FILTER (
      WHERE a.acquisition_mode = 'serpapi_aio'
        AND a.attempt_kind = 'aio_followup'
        AND a.status = 'succeeded'
    ))::BIGINT AS aio_followup_successful,
    (COUNT(a.id) FILTER (WHERE a.cost_state = 'unknown'))::BIGINT AS unknown_cost_attempts,
    (COUNT(a.id) FILTER (WHERE a.reconciliation_status = 'pending'))::BIGINT AS reconciliation_pending_attempts
  FROM cohort_tasks ct
  LEFT JOIN observation_attempts a ON a.collection_task_id = ct.collection_task_id
  GROUP BY ct.cohort_id, ct.dataset_sha256, ct.requested_surface
),
surface_metrics AS (
  SELECT
    dm.*,
    COALESCE(am.total_supplier_attempts, 0)::BIGINT AS total_supplier_attempts,
    COALESCE(am.api_fallback_attempts, 0)::BIGINT AS api_fallback_attempts,
    COALESCE(am.vendor_billed_bytes, 0)::BIGINT AS vendor_billed_bytes,
    COALESCE(am.aio_initial_successful, 0)::BIGINT AS aio_initial_successful,
    COALESCE(am.aio_followup_successful, 0)::BIGINT AS aio_followup_successful,
    COALESCE(am.unknown_cost_attempts, 0)::BIGINT AS unknown_cost_attempts,
    COALESCE(am.reconciliation_pending_attempts, 0)::BIGINT AS reconciliation_pending_attempts
  FROM demand_metrics dm
  LEFT JOIN attempt_metrics am
    ON am.cohort_id = dm.cohort_id
   AND am.dataset_sha256 = dm.dataset_sha256
   AND am.requested_surface = dm.requested_surface
)
SELECT
  sm.cohort_id,
  sm.dataset_sha256,
  jsonb_object_agg(
    sm.requested_surface,
    jsonb_build_object(
      'planned_demands', sm.planned_demands,
      'native_valid_observations', sm.native_valid_observations,
      'vendor_billed_bytes', sm.vendor_billed_bytes,
      'authentication', sm.authentication,
      'route', sm.route
    )
    ORDER BY sm.requested_surface
  ) AS surfaces,
  SUM(sm.planned_demands)::BIGINT AS planned_demands,
  SUM(sm.total_supplier_attempts)::BIGINT AS total_supplier_attempts,
  SUM(sm.api_fallback_attempts)::BIGINT AS api_fallback_attempts,
  SUM(sm.parser_evaluated_fields)::BIGINT AS parser_evaluated_fields,
  SUM(sm.parser_correct_fields)::BIGINT AS parser_correct_fields,
  SUM(sm.evidence_records)::BIGINT AS evidence_records,
  SUM(sm.structured_validations_passed)::BIGINT AS structured_validations_passed,
  SUM(sm.completed_within_2h)::BIGINT AS completed_within_2h,
  SUM(sm.completed_within_6h)::BIGINT AS completed_within_6h,
  SUM(sm.aio_initial_successful)::BIGINT AS aio_initial_successful,
  SUM(sm.aio_followup_successful)::BIGINT AS aio_followup_successful,
  SUM(sm.unknown_cost_attempts)::BIGINT AS unknown_cost_attempts,
  SUM(sm.reconciliation_pending_attempts)::BIGINT AS reconciliation_pending_attempts,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'supplier', sus.supplier,
          'billing_scope_id', sus.billing_scope_id,
          'local_billable_units', sus.local_billable_units,
          'supplier_billable_units', sus.supplier_billable_units,
          'reconciliation_status', sus.reconciliation_status
        )
        ORDER BY sus.supplier, sus.billing_scope_id
      )
      FROM supplier_usage_snapshots sus
      WHERE sus.cohort_id = sm.cohort_id
        AND sus.dataset_sha256 = sm.dataset_sha256
    ),
    '[]'::jsonb
  ) AS supplier_reconciliations,
  NOW() AS exported_at
FROM surface_metrics sm
GROUP BY sm.cohort_id, sm.dataset_sha256;

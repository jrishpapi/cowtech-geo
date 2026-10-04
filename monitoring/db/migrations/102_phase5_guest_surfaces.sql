-- Phase 5 Pro/God guest surfaces and entitlement boundary.
-- Dark by construction: migration always leaves all transport gates disabled.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase5_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  surface_contract_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  gemini_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  grok_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  qwen_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  openrouter_fallback_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  claude_addon_boundary_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  independent_controls_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  smoke_execution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_connectivity_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paid_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contract_version TEXT NOT NULL DEFAULT 'phase5-pro-god-guest-surfaces-v1',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase5_flags_contract_ck
    CHECK (contract_version = 'phase5-pro-god-guest-surfaces-v1'),
  CONSTRAINT phase5_flags_smoke_dependency_ck CHECK (
    NOT smoke_execution_enabled OR (
      surface_contract_enabled
      AND gemini_guest_enabled
      AND grok_guest_enabled
      AND qwen_guest_enabled
      AND independent_controls_enabled
    )
  ),
  CONSTRAINT phase5_flags_live_dependency_ck CHECK (
    NOT live_connectivity_enabled OR (smoke_execution_enabled AND external_spend_enabled)
  ),
  CONSTRAINT phase5_flags_paid_dependency_ck CHECK (
    NOT paid_transport_enabled OR (live_connectivity_enabled AND external_spend_enabled)
  ),
  CONSTRAINT phase5_flags_fallback_dependency_ck CHECK (
    NOT openrouter_fallback_enabled OR (surface_contract_enabled AND external_spend_enabled)
  )
);

INSERT INTO phase5_feature_flags (
  scope_key, surface_contract_enabled, gemini_guest_enabled, grok_guest_enabled,
  qwen_guest_enabled, openrouter_fallback_enabled, claude_addon_boundary_enabled,
  independent_controls_enabled, smoke_execution_enabled, live_connectivity_enabled,
  paid_transport_enabled, external_spend_enabled
)
VALUES ('global', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (scope_key) DO UPDATE SET
  surface_contract_enabled = FALSE,
  gemini_guest_enabled = FALSE,
  grok_guest_enabled = FALSE,
  qwen_guest_enabled = FALSE,
  openrouter_fallback_enabled = FALSE,
  claude_addon_boundary_enabled = FALSE,
  independent_controls_enabled = FALSE,
  smoke_execution_enabled = FALSE,
  live_connectivity_enabled = FALSE,
  paid_transport_enabled = FALSE,
  external_spend_enabled = FALSE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS phase5_customer_surface_entitlements (
  customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  gemini_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  grok_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  qwen_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  claude_addon_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  entitlement_source TEXT NOT NULL DEFAULT 'not_entitled',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase5_entitlement_source_ck CHECK (
    entitlement_source IN ('not_entitled', 'plan', 'addon', 'admin_override', 'fixture')
  )
);

CREATE TABLE IF NOT EXISTS phase5_surface_runtime_state (
  surface TEXT PRIMARY KEY,
  adapter_version TEXT NOT NULL,
  limiter_window_started_at TIMESTAMPTZ,
  limiter_attempts INTEGER NOT NULL DEFAULT 0 CHECK (limiter_attempts >= 0),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  circuit_open_until TIMESTAMPTZ,
  last_outcome TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase5_runtime_surface_ck CHECK (surface IN ('gemini_ui', 'grok_ui', 'qwen_ui')),
  CONSTRAINT phase5_runtime_version_ck CHECK (adapter_version ~ '^(gemini|grok|qwen)-guest-ui-v[0-9]+$')
);

CREATE TABLE IF NOT EXISTS phase5_surface_observation_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_task_id UUID NOT NULL REFERENCES collection_tasks(id) ON DELETE RESTRICT,
  observation_attempt_id UUID NOT NULL UNIQUE,
  requested_surface TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  outcome TEXT NOT NULL,
  adapter_version TEXT,
  prompt_sha256 TEXT NOT NULL,
  answer_sha256 TEXT,
  citation_count INTEGER NOT NULL DEFAULT 0,
  fallback_model TEXT,
  fallback_reason TEXT,
  credit_settlement TEXT NOT NULL,
  structured_validation_passed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase5_details_attempt_task_fk
    FOREIGN KEY (observation_attempt_id, collection_task_id)
    REFERENCES observation_attempts (id, collection_task_id) ON DELETE RESTRICT,
  CONSTRAINT phase5_details_surface_ck CHECK (
    requested_surface IN ('gemini_ui', 'grok_ui', 'qwen_ui')
  ),
  CONSTRAINT phase5_details_acquisition_ck CHECK (acquisition_mode IN ('web_ui', 'api_fallback')),
  CONSTRAINT phase5_details_outcome_ck CHECK (
    outcome IN ('web_ui_observed', 'api_fallback', 'surface_unavailable', 'technical_failed')
  ),
  CONSTRAINT phase5_details_hash_ck CHECK (
    prompt_sha256 ~ '^[0-9a-f]{64}$'
    AND (answer_sha256 IS NULL OR answer_sha256 ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT phase5_details_json_ck CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT phase5_details_provenance_ck CHECK (
    (outcome = 'web_ui_observed' AND acquisition_mode = 'web_ui'
      AND credit_settlement = 'settled' AND fallback_model IS NULL)
    OR (outcome = 'api_fallback' AND acquisition_mode = 'api_fallback'
      AND credit_settlement = 'not_native_ui_credit' AND fallback_model IS NOT NULL)
    OR (outcome IN ('surface_unavailable', 'technical_failed')
      AND credit_settlement = 'released')
  )
);

CREATE INDEX IF NOT EXISTS idx_phase5_details_ops
  ON phase5_surface_observation_details(requested_surface, acquisition_mode, outcome, created_at);

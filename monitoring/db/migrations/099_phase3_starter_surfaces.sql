-- Phase 3 Starter surface adapters and observability.
-- Dark by construction: migration always leaves every execution gate disabled.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase3_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  starter_contract_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  chatgpt_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  perplexity_guest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  google_aio_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sonar_fallback_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ops_metrics_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  smoke_execution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_connectivity_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paid_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contract_version TEXT NOT NULL DEFAULT 'phase3-starter-surfaces-v1',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase3_feature_flags_scope_ck CHECK (length(btrim(scope_key)) > 0),
  CONSTRAINT phase3_feature_flags_contract_ck CHECK (contract_version = 'phase3-starter-surfaces-v1'),
  CONSTRAINT phase3_feature_flags_metadata_ck CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT phase3_feature_flags_execution_dependency_ck CHECK (
    NOT smoke_execution_enabled
    OR (
      starter_contract_enabled
      AND chatgpt_guest_enabled
      AND perplexity_guest_enabled
      AND google_aio_enabled
      AND ops_metrics_enabled
    )
  ),
  CONSTRAINT phase3_feature_flags_transport_dependency_ck CHECK (
    NOT live_connectivity_enabled
    OR (smoke_execution_enabled AND external_spend_enabled)
  ),
  CONSTRAINT phase3_feature_flags_paid_dependency_ck CHECK (
    NOT paid_transport_enabled
    OR (live_connectivity_enabled AND external_spend_enabled)
  )
);

INSERT INTO phase3_feature_flags (
  scope_key, starter_contract_enabled, chatgpt_guest_enabled,
  perplexity_guest_enabled, google_aio_enabled, sonar_fallback_enabled,
  ops_metrics_enabled, smoke_execution_enabled, live_connectivity_enabled,
  paid_transport_enabled, external_spend_enabled
)
VALUES ('global', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (scope_key) DO UPDATE SET
  starter_contract_enabled = FALSE,
  chatgpt_guest_enabled = FALSE,
  perplexity_guest_enabled = FALSE,
  google_aio_enabled = FALSE,
  sonar_fallback_enabled = FALSE,
  ops_metrics_enabled = FALSE,
  smoke_execution_enabled = FALSE,
  live_connectivity_enabled = FALSE,
  paid_transport_enabled = FALSE,
  external_spend_enabled = FALSE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS phase3_surface_observation_details (
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
  provider_search_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_units INTEGER,
  fallback_reason TEXT,
  credit_settlement TEXT NOT NULL,
  structured_validation_passed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase3_surface_details_attempt_task_fk
    FOREIGN KEY (observation_attempt_id, collection_task_id)
    REFERENCES observation_attempts (id, collection_task_id) ON DELETE RESTRICT,
  CONSTRAINT phase3_surface_details_surface_ck
    CHECK (requested_surface IN ('chatgpt_ui', 'perplexity_ui', 'google_aio')),
  CONSTRAINT phase3_surface_details_acquisition_ck
    CHECK (acquisition_mode IN ('web_ui', 'serpapi_aio', 'api_fallback')),
  CONSTRAINT phase3_surface_details_outcome_ck
    CHECK (outcome IN (
      'web_ui_observed', 'serpapi_aio_observed', 'aio_not_triggered',
      'api_fallback', 'surface_unavailable', 'technical_failed'
    )),
  CONSTRAINT phase3_surface_details_prompt_sha_ck CHECK (prompt_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT phase3_surface_details_answer_sha_ck
    CHECK (answer_sha256 IS NULL OR answer_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT phase3_surface_details_counts_ck
    CHECK (citation_count >= 0 AND (search_units IS NULL OR search_units > 0)),
  CONSTRAINT phase3_surface_details_json_ck
    CHECK (jsonb_typeof(provider_search_ids) = 'array' AND jsonb_typeof(metadata) = 'object'),
  CONSTRAINT phase3_surface_details_provenance_ck CHECK (
    (outcome = 'web_ui_observed' AND acquisition_mode = 'web_ui' AND requested_surface IN ('chatgpt_ui', 'perplexity_ui'))
    OR (outcome IN ('serpapi_aio_observed', 'aio_not_triggered') AND acquisition_mode = 'serpapi_aio' AND requested_surface = 'google_aio')
    OR (outcome = 'api_fallback' AND acquisition_mode = 'api_fallback' AND requested_surface IN ('chatgpt_ui', 'perplexity_ui'))
    OR outcome IN ('surface_unavailable', 'technical_failed')
  ),
  CONSTRAINT phase3_surface_details_credit_ck CHECK (
    (outcome IN ('web_ui_observed', 'serpapi_aio_observed', 'aio_not_triggered') AND credit_settlement = 'settled')
    OR (outcome = 'api_fallback' AND credit_settlement = 'not_native_ui_credit')
    OR (outcome IN ('surface_unavailable', 'technical_failed') AND credit_settlement = 'released')
  )
);

CREATE INDEX IF NOT EXISTS idx_phase3_surface_details_ops
  ON phase3_surface_observation_details (requested_surface, acquisition_mode, outcome, created_at);

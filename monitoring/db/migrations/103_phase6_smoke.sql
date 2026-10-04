-- Phase 6 live smoke orchestration. Dark by construction.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase6_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  smoke_contract_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_execution_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_required BOOLEAN NOT NULL DEFAULT TRUE,
  reconciliation_required BOOLEAN NOT NULL DEFAULT TRUE,
  paid_transport_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  external_spend_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  contract_version TEXT NOT NULL DEFAULT 'phase6-guest-surface-smoke-v1',
  approved_budget_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (approved_budget_micro_usd >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase6_flags_contract_ck CHECK (contract_version='phase6-guest-surface-smoke-v1'),
  CONSTRAINT phase6_flags_live_ck CHECK (
    NOT live_execution_enabled OR (
      smoke_contract_enabled AND evidence_required AND reconciliation_required
      AND paid_transport_enabled AND external_spend_enabled
      AND approved_budget_micro_usd > 0
    )
  )
);
INSERT INTO phase6_feature_flags (
  scope_key,smoke_contract_enabled,live_execution_enabled,evidence_required,
  reconciliation_required,paid_transport_enabled,external_spend_enabled,approved_budget_micro_usd
) VALUES ('global',FALSE,FALSE,TRUE,TRUE,FALSE,FALSE,0)
ON CONFLICT (scope_key) DO UPDATE SET
  smoke_contract_enabled=FALSE,live_execution_enabled=FALSE,evidence_required=TRUE,
  reconciliation_required=TRUE,paid_transport_enabled=FALSE,external_spend_enabled=FALSE,
  approved_budget_micro_usd=0,updated_at=NOW();

CREATE TABLE IF NOT EXISTS phase6_smoke_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'planned',
  runs_per_surface INTEGER NOT NULL CHECK (runs_per_surface BETWEEN 30 AND 50),
  planned_attempts INTEGER NOT NULL CHECK (planned_attempts BETWEEN 180 AND 300),
  approved_budget_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (approved_budget_micro_usd >= 0),
  technical_status TEXT NOT NULL DEFAULT 'pending',
  commercial_status TEXT NOT NULL DEFAULT 'blocked',
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT phase6_run_status_ck CHECK (status IN ('planned','external_blocked','running','completed','failed')),
  CONSTRAINT phase6_technical_ck CHECK (technical_status IN ('pending','passed','no_go')),
  CONSTRAINT phase6_commercial_ck CHECK (commercial_status IN ('blocked','proved'))
);

CREATE TABLE IF NOT EXISTS phase6_smoke_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smoke_run_id UUID NOT NULL REFERENCES phase6_smoke_runs(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  surface TEXT NOT NULL,
  session_mode TEXT NOT NULL,
  resource_policy TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result_payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(smoke_run_id,item_key),
  CONSTRAINT phase6_item_surface_ck CHECK (surface IN (
    'chatgpt_ui','perplexity_ui','google_aio','gemini_ui','grok_ui','qwen_ui'
  )),
  CONSTRAINT phase6_item_session_ck CHECK (session_mode IN ('cold','warm','not_applicable')),
  CONSTRAINT phase6_item_resource_ck CHECK (resource_policy IN ('conservative','aggressive')),
  CONSTRAINT phase6_item_acquisition_ck CHECK (acquisition_mode IN ('web_ui','serpapi_aio')),
  CONSTRAINT phase6_item_status_ck CHECK (status IN ('planned','running','completed','failed','external_blocked'))
);
CREATE INDEX IF NOT EXISTS idx_phase6_smoke_items_ops
  ON phase6_smoke_items(smoke_run_id,surface,status,updated_at);

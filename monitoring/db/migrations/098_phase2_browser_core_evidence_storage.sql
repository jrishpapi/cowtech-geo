-- Phase 2 Browser Core and evidence-storage persistence.
-- This migration is dark by construction: every Phase 2 and supplier gate is
-- inserted/updated FALSE and no tenant, task, browser session, or object is created.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase2_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  browser_core_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  evidence_storage_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  session_pool_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  supplier_telemetry_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_connectivity_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase2_feature_flags_scope_ck CHECK (length(btrim(scope_key)) > 0),
  CONSTRAINT phase2_feature_flags_metadata_ck CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT phase2_feature_flags_dependency_ck CHECK (
    NOT live_connectivity_enabled
    OR (browser_core_enabled AND evidence_storage_enabled AND session_pool_enabled AND supplier_telemetry_enabled)
  )
);

INSERT INTO phase2_feature_flags (
  scope_key, browser_core_enabled, evidence_storage_enabled,
  session_pool_enabled, supplier_telemetry_enabled, live_connectivity_enabled
)
VALUES ('global', FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (scope_key) DO UPDATE SET
  browser_core_enabled = FALSE,
  evidence_storage_enabled = FALSE,
  session_pool_enabled = FALSE,
  supplier_telemetry_enabled = FALSE,
  live_connectivity_enabled = FALSE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS phase2_evidence_object_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_task_id UUID NOT NULL REFERENCES collection_tasks(id) ON DELETE RESTRICT,
  observation_attempt_id UUID NOT NULL,
  object_path TEXT NOT NULL UNIQUE,
  content_sha256 TEXT NOT NULL,
  content_size_bytes BIGINT NOT NULL,
  retention_class TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared',
  evidence_manifest_id UUID REFERENCES evidence_manifests(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  attached_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,
  last_error JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase2_evidence_receipts_attempt_task_fk
    FOREIGN KEY (observation_attempt_id, collection_task_id)
    REFERENCES observation_attempts (id, collection_task_id) ON DELETE RESTRICT,
  CONSTRAINT phase2_evidence_receipts_sha_ck CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT phase2_evidence_receipts_size_ck CHECK (content_size_bytes >= 0),
  CONSTRAINT phase2_evidence_receipts_retention_ck CHECK (
    retention_class IN ('operational_30d', 'audit_180d', 'legal_hold')
  ),
  CONSTRAINT phase2_evidence_receipts_status_ck CHECK (
    status IN ('prepared', 'uploaded', 'verified', 'attached', 'orphaned', 'delete_pending', 'deleted', 'failed')
  ),
  CONSTRAINT phase2_evidence_receipts_json_ck CHECK (
    jsonb_typeof(last_error) = 'object' AND jsonb_typeof(metadata) = 'object'
  ),
  CONSTRAINT phase2_evidence_receipts_terminal_shape_ck CHECK (
    (status IN ('prepared', 'uploaded') AND verified_at IS NULL AND attached_at IS NULL AND evidence_manifest_id IS NULL)
    OR (status = 'verified' AND verified_at IS NOT NULL AND attached_at IS NULL AND evidence_manifest_id IS NULL)
    OR (status IN ('orphaned', 'delete_pending', 'deleted', 'failed') AND attached_at IS NULL AND evidence_manifest_id IS NULL)
    OR (status = 'attached' AND verified_at IS NOT NULL AND attached_at IS NOT NULL AND evidence_manifest_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_phase2_evidence_receipts_recovery
  ON phase2_evidence_object_receipts (status, uploaded_at)
  WHERE status IN ('prepared', 'uploaded', 'verified', 'orphaned', 'delete_pending');

CREATE TABLE IF NOT EXISTS phase2_browser_session_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_session_id UUID NOT NULL REFERENCES browser_sessions(id) ON DELETE RESTRICT,
  observation_attempt_id UUID NOT NULL UNIQUE,
  collection_task_id UUID NOT NULL,
  sequence_no INTEGER NOT NULL,
  temperature TEXT NOT NULL,
  resource_policy TEXT NOT NULL,
  requested_geo JSONB NOT NULL,
  actual_geo JSONB NOT NULL,
  geo_verification_status TEXT NOT NULL,
  local_request_bytes BIGINT NOT NULL DEFAULT 0,
  local_response_bytes BIGINT NOT NULL DEFAULT 0,
  vendor_billed_bytes BIGINT,
  provider_session_id_hash TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'started',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase2_browser_observations_attempt_task_fk
    FOREIGN KEY (observation_attempt_id, collection_task_id)
    REFERENCES observation_attempts (id, collection_task_id) ON DELETE RESTRICT,
  CONSTRAINT phase2_browser_observations_sequence_ck CHECK (sequence_no > 0),
  CONSTRAINT phase2_browser_observations_temperature_ck CHECK (temperature IN ('cold', 'warm')),
  CONSTRAINT phase2_browser_observations_policy_ck CHECK (resource_policy IN ('conservative', 'aggressive')),
  CONSTRAINT phase2_browser_observations_geo_ck CHECK (
    jsonb_typeof(requested_geo) = 'object' AND jsonb_typeof(actual_geo) = 'object'
    AND geo_verification_status IN ('matched', 'mismatched', 'unverified')
  ),
  CONSTRAINT phase2_browser_observations_bytes_ck CHECK (
    local_request_bytes >= 0 AND local_response_bytes >= 0
    AND (vendor_billed_bytes IS NULL OR vendor_billed_bytes >= 0)
  ),
  CONSTRAINT phase2_browser_observations_provider_session_hash_ck
    CHECK (provider_session_id_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT phase2_browser_observations_status_ck CHECK (status IN ('started', 'succeeded', 'failed', 'aborted')),
  CONSTRAINT phase2_browser_observations_metadata_ck CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_phase2_browser_observations_session_sequence
  ON phase2_browser_session_observations (browser_session_id, sequence_no);

ALTER TABLE phase1_runtime_heartbeats DROP CONSTRAINT IF EXISTS phase1_runtime_heartbeats_component_ck;
ALTER TABLE phase1_runtime_heartbeats
  ADD CONSTRAINT phase1_runtime_heartbeats_component_ck CHECK (
    component IN ('api', 'worker', 'scheduler', 'evidence_recovery', 'downstream', 'browser_core', 'evidence_storage')
  );

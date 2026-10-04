-- Phase 1 activation hardening: trustworthy provenance, evidence-only recovery,
-- immutable task generations, durable downstream completion, and runtime health.
--
-- This migration remains transport-disarmed.  It does not enable any feature
-- flag, customer tenant, supplier transport, paid call, or external spend.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE collection_tasks
  ADD COLUMN IF NOT EXISTS collection_root_key TEXT,
  ADD COLUMN IF NOT EXISTS generation_no INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_collection_task_id UUID REFERENCES collection_tasks(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS work_kind TEXT NOT NULL DEFAULT 'collect';

UPDATE collection_tasks
SET collection_root_key = collection_key
WHERE collection_root_key IS NULL;

ALTER TABLE collection_tasks
  ALTER COLUMN collection_root_key SET NOT NULL,
  ADD CONSTRAINT collection_tasks_generation_positive_ck CHECK (generation_no > 0),
  ADD CONSTRAINT collection_tasks_root_generation_uq UNIQUE (collection_root_key, generation_no),
  ADD CONSTRAINT collection_tasks_generation_parent_ck CHECK (
    (generation_no = 1 AND supersedes_collection_task_id IS NULL)
    OR (generation_no > 1 AND supersedes_collection_task_id IS NOT NULL)
  ),
  ADD CONSTRAINT collection_tasks_work_kind_ck CHECK (
    work_kind IN ('collect', 'evidence_recovery', 'cost_reconciliation')
  );

CREATE INDEX IF NOT EXISTS idx_collection_tasks_root_latest
  ON collection_tasks (collection_root_key, generation_no DESC);

CREATE INDEX IF NOT EXISTS idx_collection_tasks_claim_kind
  ON collection_tasks (work_kind, status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'retry_wait');

ALTER TABLE observation_demands
  ADD COLUMN IF NOT EXISTS logical_demand_key TEXT,
  ADD COLUMN IF NOT EXISTS generation_no INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_observation_demand_id UUID REFERENCES observation_demands(id) ON DELETE RESTRICT;

UPDATE observation_demands AS demand
SET logical_demand_key = demand.demand_key,
    generation_no = task.generation_no
FROM collection_tasks AS task
WHERE task.id = demand.collection_task_id
  AND demand.logical_demand_key IS NULL;

ALTER TABLE observation_demands
  ALTER COLUMN logical_demand_key SET NOT NULL,
  ADD CONSTRAINT observation_demands_logical_generation_uq UNIQUE (logical_demand_key, generation_no),
  ADD CONSTRAINT observation_demands_generation_positive_ck CHECK (generation_no > 0),
  ADD CONSTRAINT observation_demands_generation_parent_ck CHECK (
    (generation_no = 1 AND supersedes_observation_demand_id IS NULL)
    OR (generation_no > 1 AND supersedes_observation_demand_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_observation_demands_logical_latest
  ON observation_demands (logical_demand_key, generation_no DESC);

ALTER TABLE observation_attempts
  ADD COLUMN IF NOT EXISTS provenance_class TEXT NOT NULL DEFAULT 'unverified';

UPDATE observation_attempts
SET provenance_class = CASE
  WHEN supplier = 'phase1_mock'
    OR metadata @> '{"synthetic": true}'::jsonb
    THEN 'synthetic_shadow'
  WHEN acquisition_mode IN ('sonar_api', 'openrouter_api', 'other_api')
    THEN 'api_auxiliary'
  WHEN (acquisition_mode = 'web_ui' AND supplier = 'bright_data' AND transport_supplier = 'bright_data')
    OR (acquisition_mode = 'serpapi_aio' AND supplier = 'serpapi' AND transport_supplier = 'serpapi')
    THEN 'native_supplier'
  ELSE 'unverified'
END;

ALTER TABLE observation_attempts
  ADD CONSTRAINT observation_attempts_provenance_class_ck CHECK (
    provenance_class IN ('unverified', 'synthetic_shadow', 'native_supplier', 'api_auxiliary')
  );

ALTER TABLE observation_attempts DROP CONSTRAINT IF EXISTS observation_attempts_status_ck;
ALTER TABLE observation_attempts
  ADD CONSTRAINT observation_attempts_status_ck CHECK (
    status IN (
      'created', 'cost_reserved', 'transport_started', 'evidence_pending',
      'succeeded', 'failed', 'crashed', 'unknown', 'reconciliation_pending'
    )
  );

CREATE TABLE IF NOT EXISTS observation_finalization_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_task_id UUID NOT NULL UNIQUE REFERENCES collection_tasks(id) ON DELETE CASCADE,
  observation_attempt_id UUID NOT NULL UNIQUE,
  outcome TEXT NOT NULL,
  acquisition_mode TEXT NOT NULL,
  answer_text TEXT,
  normalized_answer JSONB,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  requested_geo JSONB NOT NULL,
  actual_geo JSONB,
  adapter_version TEXT,
  parser_version TEXT,
  structured_validation_passed BOOLEAN NOT NULL DEFAULT FALSE,
  result_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'evidence_pending',
  evidence_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery_attempt_count INTEGER NOT NULL DEFAULT 0,
  next_recovery_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recovery_deadline_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT observation_finalization_candidates_attempt_task_fk
    FOREIGN KEY (observation_attempt_id, collection_task_id)
    REFERENCES observation_attempts (id, collection_task_id)
    ON DELETE RESTRICT,
  CONSTRAINT observation_finalization_candidates_outcome_ck CHECK (
    outcome IN ('web_ui_observed', 'serpapi_aio_observed', 'aio_not_triggered')
  ),
  CONSTRAINT observation_finalization_candidates_acquisition_ck CHECK (
    acquisition_mode IN ('web_ui', 'serpapi_aio')
  ),
  CONSTRAINT observation_finalization_candidates_status_ck CHECK (
    status IN ('evidence_pending', 'finalized', 'failed')
  ),
  CONSTRAINT observation_finalization_candidates_hash_ck CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT observation_finalization_candidates_citations_ck CHECK (jsonb_typeof(citations) = 'array'),
  CONSTRAINT observation_finalization_candidates_geo_ck CHECK (
    jsonb_typeof(requested_geo) = 'object'
    AND (actual_geo IS NULL OR jsonb_typeof(actual_geo) = 'object')
  ),
  CONSTRAINT observation_finalization_candidates_errors_ck CHECK (jsonb_typeof(evidence_errors) = 'array'),
  CONSTRAINT observation_finalization_candidates_recovery_count_ck CHECK (recovery_attempt_count >= 0),
  CONSTRAINT observation_finalization_candidates_deadline_ck CHECK (recovery_deadline_at >= created_at),
  CONSTRAINT observation_finalization_candidates_terminal_ck CHECK (
    (status = 'evidence_pending' AND finalized_at IS NULL AND failed_at IS NULL)
    OR (status = 'finalized' AND finalized_at IS NOT NULL AND failed_at IS NULL)
    OR (status = 'failed' AND finalized_at IS NULL AND failed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_observation_finalization_candidates_due
  ON observation_finalization_candidates (status, next_recovery_at, recovery_deadline_at)
  WHERE status = 'evidence_pending';

CREATE TABLE IF NOT EXISTS phase1_downstream_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  generation_no INTEGER NOT NULL,
  stage TEXT NOT NULL DEFAULT 'post_observation_pipeline',
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_stages JSONB NOT NULL DEFAULT '[]'::jsonb,
  stage_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  lease_owner TEXT,
  lease_token UUID,
  lease_fencing_token BIGINT NOT NULL DEFAULT 0,
  lease_until TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  last_error JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase1_downstream_outbox_identity_uq UNIQUE (tracking_run_id, generation_no, stage),
  CONSTRAINT phase1_downstream_outbox_generation_ck CHECK (generation_no > 0),
  CONSTRAINT phase1_downstream_outbox_stage_ck CHECK (
    stage IN ('post_observation_pipeline')
  ),
  CONSTRAINT phase1_downstream_outbox_status_ck CHECK (
    status IN ('queued', 'leased', 'retry_wait', 'completed', 'dead_letter')
  ),
  CONSTRAINT phase1_downstream_outbox_attempts_ck CHECK (
    attempt_count >= 0 AND max_attempts > 0 AND attempt_count <= max_attempts
  ),
  CONSTRAINT phase1_downstream_outbox_payload_ck CHECK (
    jsonb_typeof(payload) = 'object'
    AND jsonb_typeof(completed_stages) = 'array'
    AND jsonb_typeof(stage_results) = 'object'
    AND jsonb_typeof(last_error) = 'object'
  ),
  CONSTRAINT phase1_downstream_outbox_lease_ck CHECK (
    (
      status = 'leased'
      AND lease_owner IS NOT NULL
      AND lease_token IS NOT NULL
      AND lease_until IS NOT NULL
      AND heartbeat_at IS NOT NULL
      AND lease_fencing_token > 0
    ) OR (
      status <> 'leased'
      AND lease_owner IS NULL
      AND lease_token IS NULL
      AND lease_until IS NULL
      AND heartbeat_at IS NULL
    )
  ),
  CONSTRAINT phase1_downstream_outbox_terminal_ck CHECK (
    (status = 'completed' AND completed_at IS NOT NULL AND dead_lettered_at IS NULL)
    OR (status = 'dead_letter' AND dead_lettered_at IS NOT NULL AND completed_at IS NULL)
    OR (status NOT IN ('completed', 'dead_letter') AND completed_at IS NULL AND dead_lettered_at IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_phase1_downstream_outbox_claim
  ON phase1_downstream_outbox (status, next_attempt_at, created_at)
  WHERE status IN ('queued', 'retry_wait');

CREATE INDEX IF NOT EXISTS idx_phase1_downstream_outbox_expiry
  ON phase1_downstream_outbox (lease_until)
  WHERE status = 'leased';

CREATE TABLE IF NOT EXISTS phase1_runtime_heartbeats (
  component TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  release_revision TEXT,
  heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (component, instance_id),
  CONSTRAINT phase1_runtime_heartbeats_component_ck CHECK (
    component IN ('api', 'worker', 'scheduler', 'evidence_recovery', 'downstream')
  ),
  CONSTRAINT phase1_runtime_heartbeats_identity_ck CHECK (
    length(btrim(instance_id)) > 0
  ),
  CONSTRAINT phase1_runtime_heartbeats_details_ck CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_phase1_runtime_heartbeats_freshness
  ON phase1_runtime_heartbeats (component, heartbeat_at DESC);

CREATE OR REPLACE FUNCTION phase1_validate_native_settlement_provenance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  result_row observation_results%ROWTYPE;
  attempt_row observation_attempts%ROWTYPE;
  manifest_row evidence_manifests%ROWTYPE;
BEGIN
  IF NEW.credit_state <> 'settled' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO result_row
  FROM observation_results
  WHERE id = NEW.terminal_result_id;

  SELECT * INTO attempt_row
  FROM observation_attempts
  WHERE id = result_row.final_attempt_id;

  SELECT * INTO manifest_row
  FROM evidence_manifests
  WHERE id = NEW.settlement_evidence_manifest_id;

  IF result_row.id IS NULL
    OR attempt_row.id IS NULL
    OR manifest_row.id IS NULL
    OR attempt_row.provenance_class <> 'native_supplier'
    OR attempt_row.transport_started_at IS NULL
    OR attempt_row.metadata @> '{"synthetic": true}'::jsonb
    OR (
      result_row.acquisition_mode = 'web_ui'
      AND (attempt_row.supplier <> 'bright_data' OR attempt_row.transport_supplier <> 'bright_data')
    )
    OR (
      result_row.acquisition_mode = 'serpapi_aio'
      AND (attempt_row.supplier <> 'serpapi' OR attempt_row.transport_supplier <> 'serpapi')
    )
    OR manifest_row.metadata @> '{"synthetic": true}'::jsonb
    OR NOT EXISTS (
      SELECT 1
      FROM supplier_budget_reservations AS reservation
      WHERE reservation.observation_attempt_id = attempt_row.id
        AND reservation.collection_task_id = result_row.collection_task_id
        AND reservation.transport_started_at IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM observation_artifacts AS artifact
      WHERE artifact.evidence_manifest_id = manifest_row.id
        AND artifact.metadata @> '{"synthetic": true}'::jsonb
    ) THEN
    RAISE EXCEPTION 'settled native credit requires non-synthetic started native supplier provenance';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase1_validate_native_settlement_provenance ON observation_demands;
CREATE CONSTRAINT TRIGGER trg_phase1_validate_native_settlement_provenance
AFTER INSERT OR UPDATE OF credit_state, terminal_result_id, settlement_evidence_manifest_id
ON observation_demands
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION phase1_validate_native_settlement_provenance();

CREATE OR REPLACE FUNCTION phase1_protect_finalization_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('finalized', 'failed') THEN
    RAISE EXCEPTION 'terminal observation finalization candidate is immutable';
  END IF;
  IF NEW.collection_task_id IS DISTINCT FROM OLD.collection_task_id
    OR NEW.observation_attempt_id IS DISTINCT FROM OLD.observation_attempt_id
    OR NEW.outcome IS DISTINCT FROM OLD.outcome
    OR NEW.acquisition_mode IS DISTINCT FROM OLD.acquisition_mode
    OR NEW.answer_text IS DISTINCT FROM OLD.answer_text
    OR NEW.normalized_answer IS DISTINCT FROM OLD.normalized_answer
    OR NEW.citations IS DISTINCT FROM OLD.citations
    OR NEW.requested_geo IS DISTINCT FROM OLD.requested_geo
    OR NEW.actual_geo IS DISTINCT FROM OLD.actual_geo
    OR NEW.adapter_version IS DISTINCT FROM OLD.adapter_version
    OR NEW.parser_version IS DISTINCT FROM OLD.parser_version
    OR NEW.structured_validation_passed IS DISTINCT FROM OLD.structured_validation_passed
    OR NEW.result_hash IS DISTINCT FROM OLD.result_hash THEN
    RAISE EXCEPTION 'observation finalization candidate payload is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase1_protect_finalization_candidate ON observation_finalization_candidates;
CREATE TRIGGER trg_phase1_protect_finalization_candidate
BEFORE UPDATE ON observation_finalization_candidates
FOR EACH ROW
EXECUTE FUNCTION phase1_protect_finalization_candidate();

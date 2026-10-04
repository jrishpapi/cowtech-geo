-- Owner-authorized Phase 9 soak waiver. All launch controls remain dark by default.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE phase9_feature_flags
  ADD COLUMN IF NOT EXISTS phase9_soak_waived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phase9_soak_waiver_authority_ref TEXT,
  ADD COLUMN IF NOT EXISTS phase9_soak_waiver_evidence_ref TEXT;

UPDATE phase9_feature_flags SET
  commercial_launch_enabled=FALSE,
  phase9_soak_waived=FALSE,
  phase9_soak_waiver_authority_ref=NULL,
  phase9_soak_waiver_evidence_ref=NULL,
  commercial_launch_authority_ref=NULL,
  updated_at=NOW()
WHERE scope_key='global';

ALTER TABLE phase9_feature_flags
  DROP CONSTRAINT IF EXISTS phase9_soak_waiver_evidence_ck,
  DROP CONSTRAINT IF EXISTS phase9_launch_dark_ck;

ALTER TABLE phase9_feature_flags
  ADD CONSTRAINT phase9_soak_waiver_evidence_ck CHECK (
    NOT phase9_soak_waived OR (
      length(btrim(phase9_soak_waiver_authority_ref)) > 0
      AND length(btrim(phase9_soak_waiver_evidence_ref)) > 0
    )
  ),
  ADD CONSTRAINT phase9_launch_dark_ck CHECK (
    NOT commercial_launch_enabled OR (
      production_executor_enabled AND production_write_enabled
      AND phase8_rollout_complete
      AND (
        phase9_soak_go_review OR (
          phase9_soak_waived
          AND length(btrim(phase9_soak_waiver_authority_ref)) > 0
          AND length(btrim(phase9_soak_waiver_evidence_ref)) > 0
        )
      )
      AND length(btrim(commercial_launch_authority_ref)) > 0
    )
  );

CREATE TABLE IF NOT EXISTS phase9_soak_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_key TEXT NOT NULL UNIQUE CHECK (length(btrim(waiver_key)) > 0),
  decision_owner TEXT NOT NULL CHECK (length(btrim(decision_owner)) > 0),
  authority_ref TEXT NOT NULL CHECK (length(btrim(authority_ref)) > 0),
  evidence_ref TEXT NOT NULL UNIQUE CHECK (length(btrim(evidence_ref)) > 0),
  decided_at TIMESTAMPTZ NOT NULL,
  waived_requirement TEXT NOT NULL CHECK (
    waived_requirement='phase9_authoritative_7_to_14_day_live_soak'
  ),
  acceptance_effect TEXT NOT NULL CHECK (
    acceptance_effect='FULL_ACCEPTANCE_WITH_SOAK_WAIVED'
  ),
  risk_acknowledged BOOLEAN NOT NULL CHECK (risk_acknowledged=TRUE),
  claims_authoritative_soak_completed BOOLEAN NOT NULL DEFAULT FALSE CHECK (
    claims_authoritative_soak_completed=FALSE
  ),
  decision_payload JSONB NOT NULL CHECK (jsonb_typeof(decision_payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE phase9_launch_gate_reviews
  ALTER COLUMN soak_run_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS soak_waiver_id UUID REFERENCES phase9_soak_waivers(id);

ALTER TABLE phase9_launch_gate_reviews
  DROP CONSTRAINT IF EXISTS phase9_launch_review_evidence_ck;

ALTER TABLE phase9_launch_gate_reviews
  ADD CONSTRAINT phase9_launch_review_evidence_ck CHECK (
    num_nonnulls(soak_run_id,soak_waiver_id)=1
  );

CREATE INDEX IF NOT EXISTS idx_phase9_soak_waivers_authority
  ON phase9_soak_waivers(authority_ref,decided_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_phase9_launch_review_soak_waiver
  ON phase9_launch_gate_reviews(soak_waiver_id)
  WHERE soak_waiver_id IS NOT NULL;

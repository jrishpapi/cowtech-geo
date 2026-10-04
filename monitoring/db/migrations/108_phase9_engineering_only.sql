-- Phase 9 engineering-only soak and launch-gate schema. No live executor exists.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS phase9_feature_flags (
  scope_key TEXT PRIMARY KEY DEFAULT 'global',
  engineering_contract_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  live_soak_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  commercial_launch_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  phase8_rollout_complete BOOLEAN NOT NULL DEFAULT FALSE,
  approved_budget_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (approved_budget_micro_usd >= 0),
  contract_version TEXT NOT NULL DEFAULT 'phase9-engineering-only-v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase9_flags_contract_ck CHECK (contract_version='phase9-engineering-only-v1'),
  CONSTRAINT phase9_live_dark_ck CHECK (
    NOT live_soak_enabled OR (engineering_contract_enabled AND phase8_rollout_complete AND approved_budget_micro_usd > 0)
  ),
  CONSTRAINT phase9_launch_dark_ck CHECK (commercial_launch_enabled=FALSE)
);

INSERT INTO phase9_feature_flags VALUES
  ('global',FALSE,FALSE,FALSE,FALSE,0,'phase9-engineering-only-v1',NOW())
ON CONFLICT (scope_key) DO UPDATE SET
  engineering_contract_enabled=FALSE,live_soak_enabled=FALSE,
  commercial_launch_enabled=FALSE,phase8_rollout_complete=FALSE,
  approved_budget_micro_usd=0,updated_at=NOW();

CREATE TABLE IF NOT EXISTS phase9_soak_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soak_key TEXT NOT NULL UNIQUE,
  authority_ref TEXT NOT NULL,
  plan_sha256 TEXT NOT NULL CHECK (plan_sha256 ~ '^[0-9a-f]{64}$'),
  target_days INTEGER NOT NULL CHECK (target_days BETWEEN 7 AND 14),
  maximum_days INTEGER NOT NULL CHECK (maximum_days BETWEEN target_days AND 14),
  status TEXT NOT NULL DEFAULT 'live_frozen',
  live_start_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase9_soak_status_ck CHECK (
    status IN ('live_frozen','ready','running','paused','extended','completed','rolled_back','failed')
  ),
  CONSTRAINT phase9_soak_dark_ck CHECK (status='live_frozen' OR live_start_allowed)
);

CREATE TABLE IF NOT EXISTS phase9_soak_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soak_run_id UUID NOT NULL REFERENCES phase9_soak_runs(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 14),
  day_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'live_frozen',
  authoritative BOOLEAN NOT NULL DEFAULT FALSE,
  metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(soak_run_id,day_number),
  CONSTRAINT phase9_day_status_ck CHECK (
    status IN ('live_frozen','pending','running','passed','failed','rolled_back')
  ),
  CONSTRAINT phase9_day_dark_ck CHECK (status='live_frozen' OR authoritative)
);

CREATE TABLE IF NOT EXISTS phase9_soak_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soak_run_id UUID NOT NULL REFERENCES phase9_soak_runs(id) ON DELETE CASCADE,
  completed_days INTEGER NOT NULL CHECK (completed_days BETWEEN 0 AND 14),
  next_day INTEGER NOT NULL CHECK (next_day BETWEEN 1 AND 15),
  checkpoint_payload JSONB NOT NULL CHECK (jsonb_typeof(checkpoint_payload)='object'),
  live_resume_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phase9_failure_drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soak_run_id UUID NOT NULL REFERENCES phase9_soak_runs(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL,
  status TEXT NOT NULL,
  result_payload JSONB NOT NULL CHECK (jsonb_typeof(result_payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phase9_launch_gate_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soak_run_id UUID NOT NULL REFERENCES phase9_soak_runs(id) ON DELETE CASCADE,
  soak_decision TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'commercial_launch_frozen',
  launch_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  review_payload JSONB NOT NULL CHECK (jsonb_typeof(review_payload)='object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phase9_launch_review_dark_ck CHECK (
    status='commercial_launch_frozen' AND launch_allowed=FALSE
  )
);

CREATE INDEX IF NOT EXISTS idx_phase9_soak_days_ops ON phase9_soak_days(soak_run_id,day_number,status);
CREATE INDEX IF NOT EXISTS idx_phase9_drills_ops ON phase9_failure_drills(soak_run_id,scenario,status);

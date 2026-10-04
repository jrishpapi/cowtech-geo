CREATE TABLE IF NOT EXISTS run_scores (
  tracking_run_id UUID PRIMARY KEY REFERENCES tracking_runs(id) ON DELETE CASCADE,
  visibility_score NUMERIC(5,2) NOT NULL,
  source_quality_score NUMERIC(5,2) NOT NULL,
  competitor_pressure_score NUMERIC(5,2) NOT NULL,
  scoring_output JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_scores_visibility_score ON run_scores (visibility_score);
CREATE INDEX IF NOT EXISTS idx_run_scores_source_quality_score ON run_scores (source_quality_score);
CREATE INDEX IF NOT EXISTS idx_run_scores_competitor_pressure_score ON run_scores (competitor_pressure_score);

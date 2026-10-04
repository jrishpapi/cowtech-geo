CREATE TABLE IF NOT EXISTS opportunity_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES content_opportunities(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  prompt_source TEXT NOT NULL,
  prompt_category TEXT NOT NULL,
  commercial_intent_score NUMERIC(5,2) NOT NULL,
  gap_severity_score NUMERIC(5,2) NOT NULL,
  competitor_pressure_score NUMERIC(5,2) NOT NULL,
  feasibility_score NUMERIC(5,2) NOT NULL,
  stability_score NUMERIC(5,2) NOT NULL,
  opportunity_prompt_score NUMERIC(5,2) NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'candidate',
  promoted_prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tracking_run_id, prompt_text)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_prompts_run ON opportunity_prompts (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_prompts_brand_status ON opportunity_prompts (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunity_prompts_score ON opportunity_prompts (opportunity_prompt_score);
CREATE INDEX IF NOT EXISTS idx_opportunity_prompts_category ON opportunity_prompts (prompt_category);

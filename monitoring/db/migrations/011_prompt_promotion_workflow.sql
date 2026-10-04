ALTER TABLE prompt_sets
  ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_prompt_set_id UUID REFERENCES prompt_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_reason TEXT,
  ADD COLUMN IF NOT EXISTS promoted_from_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS prompt_source TEXT NOT NULL DEFAULT 'system_seed',
  ADD COLUMN IF NOT EXISTS opportunity_prompt_id UUID REFERENCES opportunity_prompts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS prompt_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  opportunity_prompt_id UUID NOT NULL REFERENCES opportunity_prompts(id) ON DELETE CASCADE,
  source_prompt_set_id UUID NOT NULL REFERENCES prompt_sets(id) ON DELETE CASCADE,
  target_prompt_set_id UUID NOT NULL REFERENCES prompt_sets(id) ON DELETE CASCADE,
  promoted_prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  opportunity_prompt_score NUMERIC(5,2) NOT NULL,
  promotion_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'promoted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (target_prompt_set_id, opportunity_prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_promotions_run ON prompt_promotions (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_prompt_promotions_brand ON prompt_promotions (brand_id);
CREATE INDEX IF NOT EXISTS idx_prompts_source_opportunity ON prompts (opportunity_prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_sets_brand_version ON prompt_sets (brand_id, version_number);

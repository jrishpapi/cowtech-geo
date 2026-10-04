CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  monthly_prompt_limit INTEGER NOT NULL,
  model_limit INTEGER NOT NULL,
  competitor_limit INTEGER NOT NULL,
  weekly_runs_per_month INTEGER NOT NULL DEFAULT 4,
  included_full_retests INTEGER NOT NULL DEFAULT 0,
  content_opportunities_min INTEGER NOT NULL DEFAULT 0,
  content_opportunities_max INTEGER NOT NULL DEFAULT 0,
  article_drafts_min INTEGER NOT NULL DEFAULT 0,
  article_drafts_max INTEGER NOT NULL DEFAULT 0,
  openrouter_reserve_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompt_taxonomy (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  applies_to JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seed_records (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_name ON brands (name);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts (category);
CREATE INDEX IF NOT EXISTS idx_model_targets_status ON model_targets (status);

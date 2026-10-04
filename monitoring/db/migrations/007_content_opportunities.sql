CREATE TABLE IF NOT EXISTS content_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  opportunity_key TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommended_format TEXT NOT NULL,
  target_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tracking_run_id, opportunity_key)
);

CREATE INDEX IF NOT EXISTS idx_content_opportunities_run ON content_opportunities (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_content_opportunities_brand_status ON content_opportunities (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_content_opportunities_priority ON content_opportunities (priority);

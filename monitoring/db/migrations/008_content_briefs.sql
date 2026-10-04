CREATE TABLE IF NOT EXISTS content_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES content_opportunities(id) ON DELETE CASCADE,
  brief_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  target_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  outline JSONB NOT NULL DEFAULT '[]'::jsonb,
  must_include_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_link_targets JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  guardrails JSONB NOT NULL DEFAULT '[]'::jsonb,
  retest_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tracking_run_id, brief_key)
);

CREATE INDEX IF NOT EXISTS idx_content_briefs_run ON content_briefs (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_content_briefs_opportunity ON content_briefs (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_content_briefs_status ON content_briefs (status);

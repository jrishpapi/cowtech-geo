CREATE TABLE IF NOT EXISTS article_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  content_brief_id UUID NOT NULL REFERENCES content_briefs(id) ON DELETE CASCADE,
  draft_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft_skeleton',
  draft_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_opportunity_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tracking_run_id, content_brief_id)
);

CREATE INDEX IF NOT EXISTS idx_article_drafts_run ON article_drafts (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_article_drafts_brief ON article_drafts (content_brief_id);
CREATE INDEX IF NOT EXISTS idx_article_drafts_status ON article_drafts (status);

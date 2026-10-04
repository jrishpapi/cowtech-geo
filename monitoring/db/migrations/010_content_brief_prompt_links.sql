CREATE TABLE IF NOT EXISTS content_brief_prompt_links (
  content_brief_id UUID NOT NULL REFERENCES content_briefs(id) ON DELETE CASCADE,
  opportunity_prompt_id UUID NOT NULL REFERENCES opportunity_prompts(id) ON DELETE CASCADE,
  link_role TEXT NOT NULL DEFAULT 'supporting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_brief_id, opportunity_prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_content_brief_prompt_links_prompt ON content_brief_prompt_links (opportunity_prompt_id);

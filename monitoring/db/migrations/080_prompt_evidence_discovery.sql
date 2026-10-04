ALTER TABLE prompt_discovery_runs
  DROP CONSTRAINT IF EXISTS prompt_discovery_runs_provider_mode_check;

ALTER TABLE prompt_discovery_runs
  ADD CONSTRAINT prompt_discovery_runs_provider_mode_check CHECK (
    provider_mode IN ('fixture', 'mock', 'manual', 'paid_provider_gated', 'minimax', 'openrouter_web_search', 'multi_source_evidence')
  );

CREATE TABLE IF NOT EXISTS prompt_evidence_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt_discovery_run_id UUID REFERENCES prompt_discovery_runs(id) ON DELETE SET NULL,
  provider_mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  query_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_evidence_runs_status_check CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS prompt_evidence_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_run_id UUID NOT NULL REFERENCES prompt_evidence_runs(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_url TEXT,
  source_domain TEXT,
  query_text TEXT,
  evidence_text TEXT NOT NULL,
  title TEXT,
  market TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  confidence NUMERIC(5,4),
  evidence_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_evidence_items_source_type_check CHECK (
    source_type IN (
      'gsc_query',
      'paa_question',
      'serp_title',
      'competitor_page',
      'review_page',
      'forum_question',
      'ai_answer',
      'brand_page',
      'llm_web_search'
    )
  ),
  CONSTRAINT prompt_evidence_items_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_prompt_evidence_items_brand_source
  ON prompt_evidence_items (brand_id, source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_evidence_items_hash
  ON prompt_evidence_items (brand_id, evidence_hash);

CREATE TABLE IF NOT EXISTS prompt_evidence_candidate_links (
  prompt_candidate_id UUID NOT NULL REFERENCES prompt_candidates(id) ON DELETE CASCADE,
  prompt_evidence_item_id UUID NOT NULL REFERENCES prompt_evidence_items(id) ON DELETE CASCADE,
  link_role TEXT NOT NULL DEFAULT 'supporting',
  confidence NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (prompt_candidate_id, prompt_evidence_item_id),
  CONSTRAINT prompt_evidence_candidate_links_role_check CHECK (link_role IN ('primary', 'supporting')),
  CONSTRAINT prompt_evidence_candidate_links_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  )
);

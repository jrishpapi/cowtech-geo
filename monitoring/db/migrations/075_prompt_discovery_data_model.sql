CREATE TABLE IF NOT EXISTS prompt_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  parent_topic_id UUID REFERENCES prompt_topics(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, slug),
  CONSTRAINT prompt_topics_status_check CHECK (status IN ('active', 'merged', 'archived'))
);

CREATE TABLE IF NOT EXISTS prompt_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, tag_type, slug),
  CONSTRAINT prompt_tags_tag_type_check CHECK (
    tag_type IN ('intent', 'funnel_stage', 'persona', 'geo', 'language', 'product', 'source', 'operator')
  ),
  CONSTRAINT prompt_tags_status_check CHECK (status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS prompt_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  seed_type TEXT NOT NULL,
  seed_text TEXT,
  seed_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'customer_onboarding',
  locale TEXT,
  market TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_seeds_seed_type_check CHECK (
    seed_type IN (
      'brand_profile',
      'customer_question',
      'pain_point',
      'competitor',
      'category',
      'icp',
      'geo_market',
      'language',
      'existing_url',
      'gsc_query',
      'keyword',
      'support_question',
      'operator_note'
    )
  ),
  CONSTRAINT prompt_seeds_status_check CHECK (status IN ('active', 'ignored', 'archived'))
);

CREATE TABLE IF NOT EXISTS prompt_discovery_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  run_type TEXT NOT NULL DEFAULT 'initial_setup',
  provider_mode TEXT NOT NULL DEFAULT 'fixture',
  source_mode TEXT NOT NULL DEFAULT 'seed_only',
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT,
  idempotency_key TEXT UNIQUE,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_discovery_runs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT prompt_discovery_runs_run_type_check CHECK (
    run_type IN ('initial_setup', 'operator_refresh', 'competitor_gap_refresh', 'seo_data_import', 'post_report_refresh')
  ),
  CONSTRAINT prompt_discovery_runs_provider_mode_check CHECK (
    provider_mode IN ('fixture', 'mock', 'manual', 'paid_provider_gated')
  ),
  CONSTRAINT prompt_discovery_runs_source_mode_check CHECK (
    source_mode IN (
      'seed_only',
      'seed_plus_existing_results',
      'seed_plus_seo_data',
      'seed_plus_competitor_gap',
      'full_available_context'
    )
  )
);

CREATE TABLE IF NOT EXISTS prompt_candidate_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  discovery_run_id UUID REFERENCES prompt_discovery_runs(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL,
  source_ref_id TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_confidence NUMERIC(5,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_candidate_sources_source_type_check CHECK (
    source_type IN (
      'customer_seed',
      'category_template',
      'competitor_gap',
      'gsc_query',
      'keyword_research',
      'question_serp',
      'forum_question',
      'support_query',
      'existing_opportunity',
      'model_suggestion',
      'operator_manual',
      'report_gap'
    )
  ),
  CONSTRAINT prompt_candidate_sources_confidence_check CHECK (
    source_confidence IS NULL OR (source_confidence >= 0 AND source_confidence <= 1)
  )
);

CREATE TABLE IF NOT EXISTS prompt_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  discovery_run_id UUID REFERENCES prompt_discovery_runs(id) ON DELETE SET NULL,
  primary_source_id UUID REFERENCES prompt_candidate_sources(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES prompt_topics(id) ON DELETE SET NULL,
  candidate_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  market TEXT,
  intent TEXT NOT NULL DEFAULT 'unknown',
  funnel_stage TEXT NOT NULL DEFAULT 'unknown',
  gap_type TEXT NOT NULL DEFAULT 'untested',
  provenance TEXT NOT NULL DEFAULT 'synthetic',
  recommendation_reason TEXT NOT NULL DEFAULT '',
  quota_impact INTEGER NOT NULL DEFAULT 1,
  duplicate_key TEXT,
  duplicate_risk NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'suggested',
  edited_from_candidate_id UUID REFERENCES prompt_candidates(id) ON DELETE SET NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_candidates_intent_check CHECK (
    intent IN (
      'awareness',
      'comparison',
      'problem_led',
      'purchase_intent',
      'brand_defense',
      'source_seeking',
      'alternative_search',
      'education',
      'unknown'
    )
  ),
  CONSTRAINT prompt_candidates_funnel_stage_check CHECK (
    funnel_stage IN ('awareness', 'consideration', 'decision', 'retention', 'unknown')
  ),
  CONSTRAINT prompt_candidates_gap_type_check CHECK (
    gap_type IN ('strong', 'weak', 'missing', 'untested', 'brand_defense', 'source_gap', 'competitor_pressure')
  ),
  CONSTRAINT prompt_candidates_provenance_check CHECK (
    provenance IN ('observed', 'synthetic', 'model_inferred', 'operator_manual')
  ),
  CONSTRAINT prompt_candidates_status_check CHECK (
    status IN ('suggested', 'shortlisted', 'approved', 'rejected', 'edited', 'confirmed', 'archived')
  ),
  CONSTRAINT prompt_candidates_quota_impact_check CHECK (quota_impact = 1),
  CONSTRAINT prompt_candidates_duplicate_risk_check CHECK (duplicate_risk >= 0 AND duplicate_risk <= 100)
);

CREATE TABLE IF NOT EXISTS prompt_candidate_tag_links (
  prompt_candidate_id UUID NOT NULL REFERENCES prompt_candidates(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES prompt_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (prompt_candidate_id, tag_id)
);

CREATE TABLE IF NOT EXISTS prompt_candidate_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_candidate_id UUID NOT NULL REFERENCES prompt_candidates(id) ON DELETE CASCADE,
  score_version TEXT NOT NULL DEFAULT 'prompt-candidate-score-v1',
  commercial_value_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  competitor_relevance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  insight_value_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  tracking_value_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  gap_severity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  source_opportunity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  volume_signal_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  duplicate_penalty NUMERIC(5,2) NOT NULL DEFAULT 0,
  priority_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  score_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_candidate_scores_range_check CHECK (
    commercial_value_score BETWEEN 0 AND 100
    AND competitor_relevance_score BETWEEN 0 AND 100
    AND insight_value_score BETWEEN 0 AND 100
    AND tracking_value_score BETWEEN 0 AND 100
    AND gap_severity_score BETWEEN 0 AND 100
    AND source_opportunity_score BETWEEN 0 AND 100
    AND volume_signal_score BETWEEN 0 AND 100
    AND duplicate_penalty BETWEEN 0 AND 100
    AND priority_score BETWEEN 0 AND 100
  )
);

CREATE TABLE IF NOT EXISTS competitor_prompt_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES prompt_topics(id) ON DELETE SET NULL,
  prompt_candidate_id UUID REFERENCES prompt_candidates(id) ON DELETE SET NULL,
  tracking_run_id UUID REFERENCES tracking_runs(id) ON DELETE SET NULL,
  gap_type TEXT NOT NULL,
  gap_label TEXT NOT NULL,
  gap_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT competitor_prompt_gaps_gap_type_check CHECK (
    gap_type IN (
      'competitor_mentioned_brand_missing',
      'competitor_cited_brand_not_cited',
      'topic_missing',
      'source_missing',
      'weak_visibility',
      'weak_source_quality',
      'brand_defense'
    )
  ),
  CONSTRAINT competitor_prompt_gaps_status_check CHECK (
    status IN ('open', 'candidate_created', 'confirmed_prompt_created', 'resolved', 'ignored')
  ),
  CONSTRAINT competitor_prompt_gaps_severity_score_check CHECK (severity_score >= 0 AND severity_score <= 100)
);

CREATE TABLE IF NOT EXISTS prompt_selection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt_candidate_id UUID REFERENCES prompt_candidates(id) ON DELETE SET NULL,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prompt_selection_events_event_type_check CHECK (
    event_type IN ('shortlist', 'approve', 'reject', 'edit', 'replace', 'confirm', 'unconfirm', 'archive', 'operator_override')
  ),
  CONSTRAINT prompt_selection_events_actor_type_check CHECK (actor_type IN ('customer', 'operator', 'system'))
);

CREATE TABLE IF NOT EXISTS confirmed_prompt_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  prompt_candidate_id UUID NOT NULL REFERENCES prompt_candidates(id) ON DELETE RESTRICT,
  prompt_set_id UUID NOT NULL REFERENCES prompt_sets(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',
  confirmation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (prompt_candidate_id, prompt_id),
  UNIQUE (prompt_id),
  CONSTRAINT confirmed_prompt_links_status_check CHECK (status IN ('active', 'superseded', 'removed'))
);

CREATE TABLE IF NOT EXISTS run_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_result_id UUID NOT NULL REFERENCES prompt_results(id) ON DELETE CASCADE,
  tracking_run_id UUID NOT NULL REFERENCES tracking_runs(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  source_url TEXT,
  source_domain TEXT,
  source_title TEXT,
  source_snippet TEXT,
  source_position INTEGER,
  domain_type TEXT NOT NULL DEFAULT 'other',
  url_type TEXT NOT NULL DEFAULT 'other',
  is_own_domain BOOLEAN NOT NULL DEFAULT false,
  is_competitor_domain BOOLEAN NOT NULL DEFAULT false,
  matched_competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  mentioned_brands JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT run_sources_domain_type_check CHECK (
    domain_type IN ('corporate', 'editorial', 'institutional', 'ugc', 'reference', 'competitor', 'other')
  ),
  CONSTRAINT run_sources_url_type_check CHECK (
    url_type IN (
      'homepage',
      'category_page',
      'product_page',
      'listicle',
      'comparison',
      'profile',
      'alternative',
      'discussion',
      'how_to_guide',
      'article',
      'other'
    )
  ),
  CONSTRAINT run_sources_position_check CHECK (source_position IS NULL OR source_position >= 0)
);

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS brand_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE prompts
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES prompt_topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intent TEXT,
  ADD COLUMN IF NOT EXISTS funnel_stage TEXT,
  ADD COLUMN IF NOT EXISTS market TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_from_candidate_id UUID REFERENCES prompt_candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quota_unit INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT;

ALTER TABLE prompt_results
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS brand_text_visibility NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS source_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS citation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS competitor_mention_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tracking_runs
  ADD COLUMN IF NOT EXISTS job_id UUID,
  ADD COLUMN IF NOT EXISTS provider_mode TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS run_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_prompt_topics_brand_status
  ON prompt_topics (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_prompt_topics_brand_parent
  ON prompt_topics (brand_id, parent_topic_id);

CREATE INDEX IF NOT EXISTS idx_prompt_tags_brand_type_status
  ON prompt_tags (brand_id, tag_type, status);

CREATE INDEX IF NOT EXISTS idx_prompt_seeds_brand_status
  ON prompt_seeds (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_prompt_seeds_brand_type
  ON prompt_seeds (brand_id, seed_type);
CREATE INDEX IF NOT EXISTS idx_prompt_seeds_payload_gin
  ON prompt_seeds USING GIN (seed_payload);

CREATE INDEX IF NOT EXISTS idx_prompt_discovery_runs_brand_status_created
  ON prompt_discovery_runs (brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_discovery_runs_brand_type_created
  ON prompt_discovery_runs (brand_id, run_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_candidate_sources_brand_type
  ON prompt_candidate_sources (brand_id, source_type);
CREATE INDEX IF NOT EXISTS idx_prompt_candidate_sources_run
  ON prompt_candidate_sources (discovery_run_id);
CREATE INDEX IF NOT EXISTS idx_prompt_candidate_sources_payload_gin
  ON prompt_candidate_sources USING GIN (source_payload);

CREATE INDEX IF NOT EXISTS idx_prompt_candidates_brand_status
  ON prompt_candidates (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_prompt_candidates_brand_topic
  ON prompt_candidates (brand_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_prompt_candidates_brand_gap_type
  ON prompt_candidates (brand_id, gap_type);
CREATE INDEX IF NOT EXISTS idx_prompt_candidates_run
  ON prompt_candidates (discovery_run_id);
CREATE INDEX IF NOT EXISTS idx_prompt_candidates_duplicate_key
  ON prompt_candidates (duplicate_key);

CREATE INDEX IF NOT EXISTS idx_prompt_candidate_tag_links_tag
  ON prompt_candidate_tag_links (tag_id);

CREATE INDEX IF NOT EXISTS idx_prompt_candidate_scores_candidate_created
  ON prompt_candidate_scores (prompt_candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_candidate_scores_priority
  ON prompt_candidate_scores (priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_competitor_prompt_gaps_brand_status
  ON competitor_prompt_gaps (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_competitor_prompt_gaps_brand_type
  ON competitor_prompt_gaps (brand_id, gap_type);
CREATE INDEX IF NOT EXISTS idx_competitor_prompt_gaps_competitor
  ON competitor_prompt_gaps (competitor_id);
CREATE INDEX IF NOT EXISTS idx_competitor_prompt_gaps_tracking_run
  ON competitor_prompt_gaps (tracking_run_id);

CREATE INDEX IF NOT EXISTS idx_prompt_selection_events_brand_created
  ON prompt_selection_events (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_selection_events_candidate_created
  ON prompt_selection_events (prompt_candidate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_selection_events_prompt_created
  ON prompt_selection_events (prompt_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_selection_events_type_created
  ON prompt_selection_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_confirmed_prompt_links_brand_status
  ON confirmed_prompt_links (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_confirmed_prompt_links_candidate
  ON confirmed_prompt_links (prompt_candidate_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_prompt_links_prompt_set
  ON confirmed_prompt_links (prompt_set_id);

CREATE INDEX IF NOT EXISTS idx_run_sources_tracking_run
  ON run_sources (tracking_run_id);
CREATE INDEX IF NOT EXISTS idx_run_sources_prompt_result
  ON run_sources (prompt_result_id);
CREATE INDEX IF NOT EXISTS idx_run_sources_brand_domain
  ON run_sources (brand_id, source_domain);
CREATE INDEX IF NOT EXISTS idx_run_sources_brand_domain_type
  ON run_sources (brand_id, domain_type);
CREATE INDEX IF NOT EXISTS idx_run_sources_brand_url_type
  ON run_sources (brand_id, url_type);
CREATE INDEX IF NOT EXISTS idx_run_sources_brand_position
  ON run_sources (brand_id, source_position);

CREATE INDEX IF NOT EXISTS idx_brands_aliases_gin
  ON brands USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_brands_profile_gin
  ON brands USING GIN (brand_profile);
CREATE INDEX IF NOT EXISTS idx_prompts_topic
  ON prompts (topic_id);
CREATE INDEX IF NOT EXISTS idx_prompts_confirmed_candidate
  ON prompts (confirmed_from_candidate_id);
CREATE INDEX IF NOT EXISTS idx_prompt_results_engine_region_language
  ON prompt_results (engine, region, language);
CREATE INDEX IF NOT EXISTS idx_tracking_runs_job
  ON tracking_runs (job_id);
CREATE INDEX IF NOT EXISTS idx_tracking_runs_provider_mode
  ON tracking_runs (provider_mode);

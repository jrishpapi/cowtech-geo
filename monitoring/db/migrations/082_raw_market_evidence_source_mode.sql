ALTER TABLE prompt_discovery_runs
  DROP CONSTRAINT IF EXISTS prompt_discovery_runs_source_mode_check;

ALTER TABLE prompt_discovery_runs
  ADD CONSTRAINT prompt_discovery_runs_source_mode_check CHECK (
    source_mode IN (
      'seed_only',
      'seed_plus_existing_results',
      'seed_plus_seo_data',
      'seed_plus_competitor_gap',
      'full_available_context',
      'raw_market_evidence'
    )
  );

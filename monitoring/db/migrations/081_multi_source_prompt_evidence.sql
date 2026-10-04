ALTER TABLE prompt_discovery_runs
  DROP CONSTRAINT IF EXISTS prompt_discovery_runs_provider_mode_check;

ALTER TABLE prompt_discovery_runs
  ADD CONSTRAINT prompt_discovery_runs_provider_mode_check CHECK (
    provider_mode IN ('fixture', 'mock', 'manual', 'paid_provider_gated', 'minimax', 'openrouter_web_search', 'multi_source_evidence')
  );

ALTER TABLE ops_runtime_settings DROP CONSTRAINT ops_runtime_settings_provider_mode_check;
ALTER TABLE ops_runtime_settings ADD CONSTRAINT ops_runtime_settings_provider_mode_check
  CHECK (default_provider_mode IN ('unconfigured', 'mock', 'openrouter'));
ALTER TABLE ops_runtime_settings ALTER COLUMN default_provider_mode SET DEFAULT 'unconfigured';
ALTER TABLE ops_runtime_settings ALTER COLUMN live_provider_testing_enabled SET DEFAULT FALSE;
UPDATE ops_runtime_settings
SET default_provider_mode = 'unconfigured', live_provider_testing_enabled = FALSE
WHERE default_provider_mode = 'mock';

ALTER TABLE brand_monitoring_configs ALTER COLUMN provider_mode SET DEFAULT 'unconfigured';
UPDATE brand_monitoring_configs SET provider_mode = 'unconfigured' WHERE provider_mode = 'mock';
UPDATE brand_monitoring_surface_configs SET provider_mode = 'unconfigured' WHERE provider_mode = 'mock';

-- Result records keep their original provenance. Future writes must name the
-- actual provider rather than acquiring a synthetic provider via a DB default.
ALTER TABLE article_draft_expansions ALTER COLUMN provider_mode DROP DEFAULT;
ALTER TABLE deep_article_evidence_packs ALTER COLUMN provider_mode DROP DEFAULT;

BEGIN;

INSERT INTO model_targets (provider_id, model_id, display_name, status)
VALUES ('openrouter', 'qwen/qwen3.6-plus:online', 'Qwen 3.6 Plus Online', 'active')
ON CONFLICT (provider_id, model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  status = 'active';

COMMIT;

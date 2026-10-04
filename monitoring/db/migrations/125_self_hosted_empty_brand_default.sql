ALTER TABLE ops_runtime_settings ALTER COLUMN default_brand_name SET DEFAULT '';
-- Preserve explicitly saved operator choices and actual customer brands.
UPDATE ops_runtime_settings SET default_brand_name = ''
WHERE updated_by IS NULL
  AND NOT EXISTS (SELECT 1 FROM brands WHERE lower(brands.name) = lower(ops_runtime_settings.default_brand_name));

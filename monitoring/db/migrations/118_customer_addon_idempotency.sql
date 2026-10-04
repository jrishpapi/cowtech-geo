ALTER TABLE customer_addon_allocations
  ADD COLUMN IF NOT EXISTS allocation_key TEXT;

UPDATE customer_addon_allocations
SET allocation_key = 'legacy:' || id::text
WHERE allocation_key IS NULL OR BTRIM(allocation_key) = '';

ALTER TABLE customer_addon_allocations
  ALTER COLUMN allocation_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customer_addon_allocations_key_unique
  ON customer_addon_allocations (customer_id, addon_code, allocation_key);

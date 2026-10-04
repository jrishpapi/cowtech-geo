-- Classify non-customer canary tenants explicitly so every unmarked tenant
-- continues through the normal customer path. This migration only adds the
-- fail-closed marker; it does not classify or create any tenant.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE customers
  ADD COLUMN tenant_class TEXT NOT NULL DEFAULT 'customer',
  ADD CONSTRAINT customers_tenant_class_ck CHECK (
    tenant_class IN ('customer', 'internal_canary')
  ),
  ADD CONSTRAINT customers_internal_canary_no_public_identity_ck CHECK (
    tenant_class <> 'internal_canary'
    OR (external_customer_id IS NULL AND email IS NULL)
  );

COMMENT ON COLUMN customers.tenant_class IS
  'Fail-closed tenant class: customer is the default; internal_canary is reserved for explicitly isolated non-customer canaries without public identity.';

CREATE INDEX idx_customers_tenant_class_status
  ON customers (tenant_class, status, id);

CREATE OR REPLACE FUNCTION enforce_customers_tenant_class_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_class IS NOT DISTINCT FROM OLD.tenant_class THEN
    RETURN NEW;
  END IF;

  IF OLD.tenant_class = 'customer'
     AND NEW.tenant_class = 'internal_canary'
     AND OLD.status = 'paused'
     AND NEW.status = 'paused'
     AND OLD.external_customer_id IS NULL
     AND OLD.email IS NULL
     AND NOT EXISTS (
       SELECT 1
       FROM brands
       WHERE customer_id = OLD.id
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'unsafe tenant_class transition for customer %: % -> %',
    OLD.id, OLD.tenant_class, NEW.tenant_class
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER customers_tenant_class_transition_guard
BEFORE UPDATE OF tenant_class ON customers
FOR EACH ROW
EXECUTE FUNCTION enforce_customers_tenant_class_transition();

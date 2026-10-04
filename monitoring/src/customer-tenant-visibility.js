export const CUSTOMER_TENANT_CLASS = 'customer';
export const INTERNAL_CANARY_TENANT_CLASS = 'internal_canary';

export function customerVisibleTenantPredicate(customerAlias = 'c') {
  if (!/^[a-z_][a-z0-9_]*$/i.test(customerAlias)) {
    throw new Error(`invalid SQL alias for customer tenant visibility: ${customerAlias}`);
  }
  return `${customerAlias}.tenant_class = '${CUSTOMER_TENANT_CLASS}'`;
}

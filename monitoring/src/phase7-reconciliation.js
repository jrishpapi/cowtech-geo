export const PHASE7_REQUIRED_SUPPLIERS = Object.freeze([
  'bright_data',
  'serpapi',
  'sonar'
]);

const UNIT_BY_SUPPLIER = Object.freeze({
  bright_data: 'bytes',
  serpapi: 'searches',
  sonar: 'tokens'
});

const RECONCILIATION_TOLERANCE = 0.02;

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function deltaRatio(left, right) {
  if (left === 0 && right === 0) return 0;
  return Math.abs(left - right) / Math.max(left, right);
}

export function buildPhase7SupplierReconciliation(input = {}) {
  const supplier = required(input.supplier, 'supplier');
  if (!PHASE7_REQUIRED_SUPPLIERS.includes(supplier)) {
    throw new RangeError(`unsupported Phase 7 supplier: ${supplier}`);
  }
  const unit = required(input.unit, 'unit');
  if (unit !== UNIT_BY_SUPPLIER[supplier]) {
    throw new RangeError(`${supplier} unit must be ${UNIT_BY_SUPPLIER[supplier]}`);
  }
  const localUnits = nonNegativeInteger(input.local_billable_units, 'local_billable_units');
  const supplierUnits = nonNegativeInteger(
    input.supplier_billable_units,
    'supplier_billable_units'
  );
  const billedCost = nonNegativeInteger(input.billed_cost_micro_usd, 'billed_cost_micro_usd');
  const noDedupUnits = nonNegativeInteger(
    input.no_dedup_baseline_units,
    'no_dedup_baseline_units'
  );
  const steadyStateCost = nonNegativeInteger(
    input.steady_state_allocated_cost_micro_usd,
    'steady_state_allocated_cost_micro_usd'
  );
  const blockers = [];
  if (deltaRatio(localUnits, supplierUnits) > RECONCILIATION_TOLERANCE) {
    blockers.push('billable_units_outside_2pct_tolerance');
  }
  if (input.pricing_state !== 'commercial') blockers.push('commercial_pricing_not_proved');
  if (localUnits > 0 && billedCost === 0) blockers.push('used_supplier_has_zero_cost');
  if (noDedupUnits < localUnits) blockers.push('no_dedup_baseline_below_deduplicated_units');
  if (localUnits > 0 && steadyStateCost === 0) {
    blockers.push('steady_state_allocated_cost_missing');
  }
  return Object.freeze({
    schema_version: 'phase7-supplier-reconciliation-v1',
    supplier,
    unit,
    run_window_id: required(input.run_window_id, 'run_window_id'),
    local_billable_units: localUnits,
    supplier_billable_units: supplierUnits,
    deduplicated_billable_units: localUnits,
    no_dedup_baseline_units: noDedupUnits,
    billed_cost_micro_usd: billedCost,
    steady_state_allocated_cost_micro_usd: steadyStateCost,
    statement_ref: required(input.statement_ref, 'statement_ref'),
    captured_at: required(input.captured_at, 'captured_at'),
    pricing_state: required(input.pricing_state, 'pricing_state'),
    reconciliation_status: blockers.length ? 'blocked' : 'reconciled',
    blockers: Object.freeze(blockers)
  });
}

export function buildPhase7BillingReconciliation({
  runWindowId,
  records = []
} = {}) {
  const windowId = required(runWindowId, 'runWindowId');
  const blockers = [];
  const bySupplier = new Map();
  for (const record of records) {
    if (record?.schema_version !== 'phase7-supplier-reconciliation-v1') {
      blockers.push('invalid_supplier_record');
      continue;
    }
    if (bySupplier.has(record.supplier)) {
      blockers.push(`${record.supplier}_duplicate`);
      continue;
    }
    bySupplier.set(record.supplier, record);
    if (record.run_window_id !== windowId) blockers.push(`${record.supplier}_run_window_mismatch`);
    if (record.reconciliation_status !== 'reconciled') {
      blockers.push(...record.blockers.map((blocker) => `${record.supplier}_${blocker}`));
    }
  }
  for (const supplier of PHASE7_REQUIRED_SUPPLIERS) {
    if (!bySupplier.has(supplier)) blockers.push(`${supplier}_record_missing`);
  }
  const billedCost = [...bySupplier.values()]
    .reduce((sum, record) => sum + record.billed_cost_micro_usd, 0);
  const steadyStateCost = [...bySupplier.values()]
    .reduce((sum, record) => sum + record.steady_state_allocated_cost_micro_usd, 0);
  return Object.freeze({
    schema_version: 'phase7-billing-reconciliation-v1',
    run_window_id: windowId,
    required_suppliers: PHASE7_REQUIRED_SUPPLIERS,
    records: Object.freeze([...bySupplier.values()]),
    total_billed_cost_micro_usd: billedCost,
    steady_state_cogs_micro_usd_per_4000_credits: steadyStateCost,
    status: blockers.length ? 'commercial_blocked' : 'reconciled',
    commercial_cost_proved: blockers.length === 0,
    blockers: Object.freeze([...new Set(blockers)].sort())
  });
}

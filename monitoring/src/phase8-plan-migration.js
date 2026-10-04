import { createHash } from 'node:crypto';
import {
  FROZEN_PLAN_CONTRACTS,
  FROZEN_PLAN_CONTRACT_VERSION
} from './poc/frozen-observation-contract.js';
import { buildPhase8Phase4PlanContract } from './phase8-commercialization.js';

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildPhase8PlanV2Catalog() {
  const plans = Object.entries(FROZEN_PLAN_CONTRACTS).map(([planCode, contract]) => Object.freeze({
    plan_code: planCode,
    contract_version: contract.contract_version,
    prompt_slots: contract.prompt_slots,
    surfaces: Object.freeze([...contract.surfaces]),
    surface_count: contract.surfaces.length,
    cadence: contract.cadence,
    cycle_days: contract.cycle_days,
    base_credits: contract.base_credits,
    flexible_credits: contract.flexible_credits,
    total_credits: contract.total_credits,
    phase4_service_contract: buildPhase8Phase4PlanContract(planCode),
    activation_state: 'phase8_live_frozen'
  }));
  return Object.freeze({
    schema_version: 'phase8-plan-v2-catalog-v1',
    contract_version: FROZEN_PLAN_CONTRACT_VERSION,
    activation_allowed: false,
    plans: Object.freeze(plans),
    catalog_sha256: hash(plans)
  });
}

export function buildPhase8CustomerMigrationPlan({
  customers = [],
  authorityRef
} = {}) {
  required(authorityRef, 'authorityRef');
  const catalog = buildPhase8PlanV2Catalog();
  const byCode = new Map(catalog.plans.map((plan) => [plan.plan_code, plan]));
  const seen = new Set();
  const items = customers.map((customer) => {
    const customerId = required(customer.customer_id, 'customer_id');
    if (seen.has(customerId)) throw new Error(`duplicate customer_id: ${customerId}`);
    seen.add(customerId);
    const plan = byCode.get(customer.plan_code);
    if (!plan) throw new RangeError(`unsupported plan_code: ${customer.plan_code}`);
    const sourceVersion = required(customer.source_contract_version, 'source_contract_version');
    const snapshot = Object.freeze({
      customer_id: customerId,
      source_contract_version: sourceVersion,
      source_plan_code: customer.plan_code,
      source_prompt_slots: customer.prompt_slots,
      source_surfaces: Object.freeze([...(customer.surfaces || [])]),
      source_total_credits: customer.total_credits
    });
    const alreadyCurrent =
      sourceVersion === plan.contract_version &&
      customer.prompt_slots === plan.prompt_slots &&
      customer.total_credits === plan.total_credits &&
      JSON.stringify(customer.surfaces || []) === JSON.stringify(plan.surfaces);
    return Object.freeze({
      customer_id: customerId,
      plan_code: customer.plan_code,
      action: alreadyCurrent ? 'no_op' : 'migrate',
      target: plan,
      rollback_snapshot: snapshot,
      idempotency_key: `phase8-plan-v2:${customerId}:${plan.contract_version}`,
      status: 'dry_run_only'
    });
  }).sort((left, right) => left.customer_id.localeCompare(right.customer_id));
  return Object.freeze({
    schema_version: 'phase8-customer-migration-plan-v1',
    engineering_authority_ref: authorityRef.trim(),
    status: 'PHASE8_MIGRATION_DRY_RUN_COMPLETE_LIVE_FROZEN',
    planned_customers: items.length,
    migrate_count: items.filter((item) => item.action === 'migrate').length,
    no_op_count: items.filter((item) => item.action === 'no_op').length,
    production_apply_allowed: false,
    rollback_apply_allowed: false,
    items: Object.freeze(items),
    plan_sha256: hash(items),
    database_writes_performed: 0
  });
}

export function previewPhase8Rollback(migrationItem) {
  if (migrationItem?.status !== 'dry_run_only' || !migrationItem.rollback_snapshot) {
    throw new TypeError('valid dry-run migration item is required');
  }
  return Object.freeze({
    schema_version: 'phase8-customer-rollback-preview-v1',
    customer_id: migrationItem.customer_id,
    restore: migrationItem.rollback_snapshot,
    apply_allowed: false,
    reason: 'phase8_live_frozen'
  });
}

export function buildPhase8WeightedCostAddendum({
  planCode,
  surfaceCostMicroUsd = {},
  fixedAllocatedCostMicroUsd = 0
} = {}) {
  const plan = FROZEN_PLAN_CONTRACTS[planCode];
  if (!plan) throw new RangeError(`unsupported planCode: ${planCode}`);
  if (!Number.isSafeInteger(fixedAllocatedCostMicroUsd) || fixedAllocatedCostMicroUsd < 0) {
    throw new TypeError('fixedAllocatedCostMicroUsd must be a non-negative safe integer');
  }
  const rows = plan.surfaces.map((surface) => {
    const unit = surfaceCostMicroUsd[surface] ?? 0;
    if (!Number.isSafeInteger(unit) || unit < 0) {
      throw new TypeError(`${surface} cost must be a non-negative safe integer`);
    }
    return Object.freeze({
      surface,
      monthly_base_demands: plan.prompt_slots * plan.cycle_days,
      micro_usd_per_demand: unit,
      allocated_micro_usd: plan.prompt_slots * plan.cycle_days * unit
    });
  });
  const variable = rows.reduce((sum, row) => sum + row.allocated_micro_usd, 0);
  const total = variable + fixedAllocatedCostMicroUsd;
  return Object.freeze({
    schema_version: 'phase8-weighted-cost-addendum-v1',
    plan_code: planCode,
    contract_version: plan.contract_version,
    prompt_slots: plan.prompt_slots,
    surface_count: plan.surfaces.length,
    total_credits: plan.total_credits,
    variable_cost_micro_usd: variable,
    fixed_allocated_cost_micro_usd: fixedAllocatedCostMicroUsd,
    total_allocated_cost_micro_usd: total,
    micro_usd_per_credit: plan.total_credits ? total / plan.total_credits : null,
    authoritative: false,
    commercial_status: 'FIXTURE_ONLY',
    rows: Object.freeze(rows)
  });
}

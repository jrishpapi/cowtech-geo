import { FROZEN_PLAN_CONTRACTS } from './poc/frozen-observation-contract.js';
import { PHASE8_PHASE4_PLAN_MATRIX, PHASE4_FEATURE_KEYS } from './phase8-commercialization.js';

export const PHASE8_ENGINEERING_STATUS = 'PHASE8_ENGINEERING_READY_LIVE_FROZEN';
export const PHASE7_DEFERRED_STATUS =
  'PHASE7_ENGINEERING_COMPLETE_LIVE_POC_DEFERRED_TO_PRELAUNCH';

const EXPECTED_PLANS = Object.freeze({
  starter: Object.freeze({ prompt_slots: 44, surfaces: 3, total_credits: 4000 }),
  pro: Object.freeze({ prompt_slots: 66, surfaces: 5, total_credits: 10000 }),
  god: Object.freeze({ prompt_slots: 104, surfaces: 8, total_credits: 25000 })
});

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildPhase8EngineeringReadiness({
  decision = {},
  planContracts = FROZEN_PLAN_CONTRACTS,
  safety = {}
} = {}) {
  const blockers = [];
  if (decision?.schema_version !== 'phase8-engineering-only-decision-v1') {
    blockers.push('phase8_decision_schema_invalid');
  }
  if (!nonEmpty(decision?.authority_ref)) blockers.push('phase8_engineering_authority_missing');
  if (decision?.phase7?.status !== PHASE7_DEFERRED_STATUS) {
    blockers.push('phase7_deferred_status_missing');
  }
  if (decision?.phase7?.authoritative_go_recorded !== false) {
    blockers.push('phase7_go_must_remain_unrecorded');
  }
  if (decision?.phase8?.engineering_status !== 'PHASE8_ENGINEERING_ONLY_AUTHORIZED') {
    blockers.push('phase8_engineering_not_authorized');
  }
  for (const [planCode, expected] of Object.entries(EXPECTED_PLANS)) {
    const contract = planContracts?.[planCode];
    if (!contract) {
      blockers.push(`${planCode}_contract_missing`);
      continue;
    }
    for (const [field, value] of Object.entries(expected)) {
      const actual = field === 'surfaces' ? contract.surfaces?.length : contract[field];
      if (actual !== value) blockers.push(`${planCode}_${field}_changed`);
    }
    const phase4Contract = PHASE8_PHASE4_PLAN_MATRIX[planCode];
    for (const featureKey of PHASE4_FEATURE_KEYS) {
      if (phase4Contract?.[featureKey]?.enabled !== true) {
        blockers.push(`${planCode}_${featureKey}_commercial_contract_missing`);
      }
    }
  }
  if (safety.external_spend_mode !== 'deny') blockers.push('external_spend_must_be_denied');
  if (safety.live_transport_enabled !== false) blockers.push('live_transport_must_be_disabled');
  if (safety.paid_transport_enabled !== false) blockers.push('paid_transport_must_be_disabled');
  if (safety.production_migration_enabled !== false) {
    blockers.push('production_migration_must_be_disabled');
  }
  if (safety.approved_budget_micro_usd !== 0) blockers.push('engineering_budget_must_be_zero');

  return Object.freeze({
    schema_version: 'phase8-engineering-readiness-v1',
    status: blockers.length ? 'PHASE8_ENGINEERING_BLOCKED' : PHASE8_ENGINEERING_STATUS,
    engineering_allowed: blockers.length === 0,
    live_allowed: false,
    production_migration_allowed: false,
    network_calls_performed: 0,
    external_spend_micro_usd: 0,
    blockers: Object.freeze(blockers)
  });
}

export function buildPhase8LiveReadiness({
  engineeringReadiness,
  commercializationEngineeringComplete = false,
  phase7AuthoritativeGo = false,
  phase7CompletionAuthorityRef = '',
  phase8LiveAuthorityRef = '',
  approvedBudgetMicroUsd = 0,
  realAccountValidationComplete = false,
  productionMigrationApproved = false,
  billingEntitlementApplyVerified = false,
  realSiteIntakeProjectionVerified = false,
  geoFlowPublishRetestVerified = false,
  realOrderAcceptanceVerified = false
} = {}) {
  const blockers = [];
  if (engineeringReadiness?.engineering_allowed !== true) {
    blockers.push('phase8_engineering_not_ready');
  }
  if (commercializationEngineeringComplete !== true) {
    blockers.push('phase8_commercialization_engineering_not_complete');
  }
  if (phase7AuthoritativeGo !== true) blockers.push('phase7_authoritative_go_missing');
  if (!nonEmpty(phase7CompletionAuthorityRef)) {
    blockers.push('phase7_completion_authority_missing');
  }
  if (!nonEmpty(phase8LiveAuthorityRef)) blockers.push('phase8_live_authority_missing');
  if (!Number.isSafeInteger(approvedBudgetMicroUsd) || approvedBudgetMicroUsd <= 0) {
    blockers.push('phase8_positive_budget_missing');
  }
  if (realAccountValidationComplete !== true) blockers.push('real_account_validation_missing');
  if (productionMigrationApproved !== true) blockers.push('production_migration_approval_missing');
  if (billingEntitlementApplyVerified !== true) {
    blockers.push('billing_entitlement_apply_verification_missing');
  }
  if (realSiteIntakeProjectionVerified !== true) {
    blockers.push('real_site_intake_projection_verification_missing');
  }
  if (geoFlowPublishRetestVerified !== true) {
    blockers.push('geoflow_publish_retest_verification_missing');
  }
  if (realOrderAcceptanceVerified !== true) {
    blockers.push('real_order_acceptance_verification_missing');
  }
  return Object.freeze({
    schema_version: 'phase8-live-readiness-v1',
    status: blockers.length ? 'PHASE8_LIVE_FROZEN' : 'PHASE8_LIVE_READY',
    live_allowed: blockers.length === 0,
    production_migration_allowed: blockers.length === 0,
    approved_budget_micro_usd: blockers.length ? 0 : approvedBudgetMicroUsd,
    blockers: Object.freeze(blockers)
  });
}

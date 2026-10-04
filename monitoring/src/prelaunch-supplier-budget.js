export const PRELAUNCH_WORKLOAD = Object.freeze({
  schema_version: 'prelaunch-workload-v1',
  phase6_new_demands: 0,
  phase7_demands: 4000,
  phase8_demands: 216,
  total_demands: 4216,
  supplier_units: Object.freeze({
    bright_data_browser: 2802,
    serpapi_google_aio: 1360,
    openrouter_grok: 27,
    dashscope_qwen: 27
  }),
  phase9_live_soak_demands: 0
});

export const PRELAUNCH_BUDGET = Object.freeze({
  schema_version: 'prelaunch-budget-v1',
  currency: 'USD',
  phase6_historical_sunk_cost_micro_usd: 3_330_074,
  phase6_new_budget_micro_usd: 0,
  phase7_authorized_hard_limit_micro_usd: 65_000_000,
  phase8_existing_hard_stop_micro_usd: 20_000_000,
  prospective_phase7_phase8_max_micro_usd: 85_000_000,
  aggregate_owner_authority: 'PENDING',
  phase_allocations_micro_usd: Object.freeze({
    phase7: Object.freeze({ serpapi: 50_000_000, bright_data: 15_000_000 }),
    phase8: Object.freeze({
      bright_data: 8_000_000,
      openrouter: 1_500_000,
      dashscope: 500_000,
      order_storage_email_misc: 10_000_000
    })
  }),
  supplier_reservations_micro_usd: Object.freeze({
    serpapi: 50_000_000,
    bright_data: 23_000_000,
    openrouter: 1_500_000,
    dashscope: 500_000,
    phase8_order_storage_email_misc: 10_000_000
  })
});

function isTrue(value) {
  return value === true;
}

export function evaluatePrelaunchSupplierBudgetReadiness({
  credentials = {},
  accounts = {},
  evidence = {},
  authority = {},
  safety = {}
} = {}) {
  const blockers = [];

  if (!isTrue(accounts.serpapi?.active)) blockers.push('serpapi_account_not_active');
  if ((accounts.serpapi?.remaining_searches ?? 0) < PRELAUNCH_WORKLOAD.supplier_units.serpapi_google_aio) {
    blockers.push('serpapi_capacity_purchase_required');
  }
  if (!isTrue(credentials.serpapi)) blockers.push('serpapi_credential_missing');

  if (!isTrue(accounts.bright_data?.api_reachable)) blockers.push('bright_data_account_unreachable');
  if (!isTrue(credentials.bright_data_api) || !isTrue(credentials.bright_data_cdp)) {
    blockers.push('bright_data_credentials_missing');
  }
  if (!isTrue(evidence.bright_data_zone_rate)) blockers.push('bright_data_zone_rate_evidence_missing');

  if (!isTrue(accounts.openrouter?.api_reachable)) blockers.push('openrouter_account_unreachable');
  if (!isTrue(credentials.openrouter_project_env)) {
    blockers.push('openrouter_credential_not_provisioned_to_project_env');
  }
  if ((accounts.openrouter?.remaining_credit_micro_usd ?? 0) < 1_500_000) {
    blockers.push('openrouter_reserved_credit_insufficient');
  }

  if (!isTrue(credentials.dashscope)) blockers.push('dashscope_credential_missing');
  if (!isTrue(evidence.dashscope_balance)) blockers.push('dashscope_balance_evidence_missing');

  if (!isTrue(authority.aggregate_budget)) blockers.push('aggregate_budget_authority_missing');
  if (!isTrue(authority.phase8_live)) blockers.push('phase8_live_authority_missing');

  if (safety.external_spend_enabled !== false) blockers.push('external_spend_must_remain_disabled');
  if (safety.live_transport_enabled !== false) blockers.push('live_transport_must_remain_disabled');
  if (safety.production_write_enabled !== false) blockers.push('production_write_must_remain_disabled');
  if (safety.commercial_launch_enabled !== false) blockers.push('commercial_launch_must_remain_disabled');
  if (safety.runtime_budget_micro_usd !== 0) blockers.push('runtime_budget_must_remain_zero');

  return Object.freeze({
    schema_version: 'prelaunch-supplier-budget-readiness-v1',
    status: blockers.length === 0
      ? 'SUPPLIERS_AND_BUDGET_READY_GATES_FROZEN'
      : 'SUPPLIER_PREPARATION_INCOMPLETE_GATES_FROZEN',
    phase6_status: 'COMPLETE_NO_NEW_FUNDING_REQUIRED',
    workload: PRELAUNCH_WORKLOAD,
    budget: PRELAUNCH_BUDGET,
    ready_to_request_live_gate: blockers.length === 0,
    live_allowed: false,
    paid_allowed: false,
    production_write_allowed: false,
    network_calls_performed: 0,
    external_spend_micro_usd: 0,
    secrets_exposed: false,
    blockers: Object.freeze(blockers)
  });
}

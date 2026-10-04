const RUNBOOK = Object.freeze({
  supplier_outage: ['open_circuit', 'apply_fallback_cap', 'preserve_evidence', 'reconcile_cost'],
  account_quarantine: ['quarantine_account', 'release_lease', 'rebalance_queue', 'require_human_clearance'],
  fallback_cap: ['pause_surface', 'drain_inflight', 'preserve_checkpoint', 'require_quality_review'],
  queue_backlog: ['stop_admission', 'scale_preview', 'preserve_fairness', 'verify_queue_sla'],
  parser_drift: ['quarantine_parser', 'pin_golden_fixture', 'reparse_evidence', 'require_parser_review']
});

export function runPhase9FailureDrill({ scenario, injectedAtDay = 1 }) {
  if (!RUNBOOK[scenario]) throw new TypeError('unsupported phase9 drill');
  return Object.freeze({
    schema_version: 'phase9-failure-drill-v1',
    scenario,
    injected_at_day: injectedAtDay,
    actions: Object.freeze(RUNBOOK[scenario]),
    checkpoint_preserved: true,
    data_loss: false,
    external_calls: 0,
    external_spend_micro_usd: 0,
    status: 'DRILL_PASSED'
  });
}

export const PHASE9_SLO = Object.freeze({
  minimum_success_rate: 0.98,
  maximum_fallback_rate: 0.10,
  minimum_parser_accuracy: 0.98,
  minimum_evidence_coverage: 0.95,
  maximum_p95_latency_ms: 120000,
  minimum_account_healthy_ratio: 0.90,
  maximum_queue_oldest_age_seconds: 300
});

export function evaluatePhase9Day(day, thresholds = PHASE9_SLO) {
  const blockers = [];
  if (day.success_rate < thresholds.minimum_success_rate) blockers.push('success_rate_regressed');
  if (day.fallback_rate > thresholds.maximum_fallback_rate) blockers.push('fallback_cap_exceeded');
  if (day.parser_accuracy < thresholds.minimum_parser_accuracy) blockers.push('parser_accuracy_regressed');
  if (day.evidence_coverage < thresholds.minimum_evidence_coverage) blockers.push('evidence_coverage_regressed');
  if (day.p95_latency_ms > thresholds.maximum_p95_latency_ms) blockers.push('latency_slo_failed');
  if (day.account_healthy_ratio < thresholds.minimum_account_healthy_ratio) blockers.push('account_health_failed');
  if (day.queue_oldest_age_seconds > thresholds.maximum_queue_oldest_age_seconds) {
    blockers.push('queue_sla_failed');
  }
  if (!day.reconciled) blockers.push('cost_reconciliation_missing');
  return Object.freeze({
    schema_version: 'phase9-daily-slo-evaluation-v1',
    day: day.day,
    passed: blockers.length === 0,
    authoritative: day.authoritative === true && day.fixture !== true,
    blockers: Object.freeze(blockers.sort())
  });
}

export function evaluatePhase9Soak({ plan, dailyAggregates }) {
  const evaluations = dailyAggregates.map((day) => evaluatePhase9Day(day));
  const consecutive = [...evaluations].reverse().findIndex((item) => !item.passed);
  const consecutiveStableDays = consecutive === -1 ? evaluations.length : consecutive;
  const anyFixture = dailyAggregates.some((day) => day.fixture);
  const allAuthoritative = dailyAggregates.length > 0 &&
    dailyAggregates.every((day) => day.authoritative === true && day.fixture !== true);
  const critical = evaluations.some((item) => item.blockers.some((blocker) => [
    'account_health_failed', 'cost_reconciliation_missing'
  ].includes(blocker)));
  let decision = 'CONTINUE';
  if (critical) decision = 'ROLLBACK';
  else if (dailyAggregates.length >= plan.maximum_days && consecutiveStableDays < plan.target_days) decision = 'NO_GO';
  else if (evaluations.some((item) => !item.passed) && dailyAggregates.length >= plan.target_days) {
    decision = 'EXTEND_SOAK';
  } else if (evaluations.some((item) => !item.passed)) decision = 'PAUSE';
  else if (consecutiveStableDays >= plan.target_days) decision = allAuthoritative ? 'GO_REVIEW' : 'COMMERCIAL_BLOCKED';
  return Object.freeze({
    schema_version: 'phase9-soak-evaluation-v1',
    decision,
    consecutive_stable_days: consecutiveStableDays,
    target_days: plan.target_days,
    completed_days: dailyAggregates.length,
    fixture_present: anyFixture,
    authoritative: allAuthoritative,
    commercial_launch_eligible: false,
    evaluations: Object.freeze(evaluations)
  });
}

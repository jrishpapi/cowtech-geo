import { readFileSync } from 'node:fs';
import { buildPhase9EngineeringReadiness, buildPhase9LiveReadiness } from './phase9-engineering-contract.js';
import { aggregatePhase9Day, buildPhase9Checkpoint, buildPhase9SoakPlan } from './phase9-soak.js';
import { evaluatePhase9Soak } from './phase9-slo.js';
import { runPhase9FailureDrill } from './phase9-failure-drills.js';
import { buildPhase9LaunchGate } from './phase9-launch-gate.js';

const decision = JSON.parse(readFileSync(
  new URL('../docs/decisions/phase9-engineering-only-2026-07-30.json', import.meta.url),
  'utf8'
));

const surfaces = [
  'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui',
  'grok_ui', 'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui'
];

function fixtureDay(day) {
  return aggregatePhase9Day({
    day,
    surfaceMetrics: surfaces.map((surface) => ({
      surface,
      attempts: 100,
      successes: 99,
      fallbacks: 2,
      parser_accuracy: 0.995,
      evidence_coverage: 0.98,
      p95_latency_ms: 45000,
      traffic_units: 100,
      fixture: true
    })),
    accountHealth: { healthy_ratio: 1, quarantined: 0 },
    queue: { oldest_age_seconds: 10, depth: 2 },
    costs: { billed_micro_usd: 0, reconciled: true, fixture: true }
  });
}

export function buildPhase9EngineeringAcceptance() {
  const blockers = [];
  const readiness = buildPhase9EngineeringReadiness({
    decision,
    safety: {
      live_transport_enabled: false,
      paid_transport_enabled: false,
      external_spend_enabled: false,
      production_write_enabled: false,
      approved_budget_micro_usd: 0
    }
  });
  if (!readiness.engineering_allowed) blockers.push(...readiness.blockers);
  const liveReadiness = buildPhase9LiveReadiness({ engineeringReadiness: readiness });
  if (liveReadiness.live_soak_allowed) blockers.push('live_soak_must_remain_frozen');
  const plan = buildPhase9SoakPlan({
    soakId: 'phase9-engineering-fixture-v1',
    startDate: '2026-08-01',
    targetDays: 7,
    maximumDays: 14,
    checkpointEveryDays: 1,
    authorityRef: decision.authority_ref
  });
  const daily = Array.from({ length: 14 }, (_, index) => fixtureDay(index + 1));
  const checkpoint = buildPhase9Checkpoint({ plan, dailyAggregates: daily });
  const evaluation = evaluatePhase9Soak({ plan, dailyAggregates: daily });
  if (evaluation.decision !== 'COMMERCIAL_BLOCKED' || evaluation.authoritative) {
    blockers.push('fixture_soak_must_remain_commercial_blocked');
  }
  const drills = [
    'supplier_outage', 'account_quarantine', 'fallback_cap', 'queue_backlog', 'parser_drift'
  ].map((scenario) => runPhase9FailureDrill({ scenario, injectedAtDay: 3 }));
  if (drills.some((drill) => drill.status !== 'DRILL_PASSED')) blockers.push('failure_drill_failed');
  const launchGate = buildPhase9LaunchGate({ soakEvaluation: evaluation });
  if (launchGate.launch_allowed || launchGate.launch_eligible) {
    blockers.push('commercial_launch_must_remain_frozen');
  }
  return Object.freeze({
    schema_version: 'phase9-engineering-acceptance-v1',
    engineering_status: blockers.length
      ? 'PHASE9_ENGINEERING_BLOCKED'
      : 'PHASE9_ENGINEERING_COMPLETE_LIVE_SOAK_FROZEN',
    live_soak_status: 'PHASE9_LIVE_SOAK_FROZEN',
    commercial_launch_status: 'COMMERCIAL_LAUNCH_FROZEN',
    engineering_complete: blockers.length === 0,
    live_soak_complete: false,
    commercial_launch_allowed: false,
    network_calls_performed: 0,
    provider_calls_performed: 0,
    external_spend_micro_usd: 0,
    readiness,
    live_readiness: liveReadiness,
    soak_plan: plan,
    checkpoint,
    fixture_soak_evaluation: evaluation,
    failure_drills: Object.freeze(drills),
    launch_gate: launchGate,
    deferred_live_blockers: Object.freeze([
      'phase6_live_exit_gate_not_passed',
      'phase7_authoritative_go_missing',
      'phase8_live_rollout_not_complete',
      'phase9_authoritative_7_to_14_day_soak_not_run',
      'commercial_launch_authority_missing'
    ]),
    engineering_blockers: Object.freeze([...new Set(blockers)].sort())
  });
}

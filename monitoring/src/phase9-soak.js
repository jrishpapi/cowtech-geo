import { createHash } from 'node:crypto';

const SURFACES = Object.freeze([
  'chatgpt_ui', 'perplexity_ui', 'google_aio', 'gemini_ui',
  'grok_ui', 'qwen_ui', 'deepseek_ui', 'mistral_vibe_ui'
]);

function assertInteger(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) throw new TypeError(`${name} invalid`);
}

export function buildPhase9SoakPlan({
  soakId,
  startDate,
  targetDays = 7,
  maximumDays = 14,
  checkpointEveryDays = 1,
  authorityRef
}) {
  if (!String(soakId || '').trim()) throw new TypeError('soakId required');
  if (!String(authorityRef || '').trim()) throw new TypeError('authorityRef required');
  assertInteger(targetDays, 'targetDays', 7);
  assertInteger(maximumDays, 'maximumDays', targetDays);
  assertInteger(checkpointEveryDays, 'checkpointEveryDays', 1);
  if (maximumDays > 14) throw new RangeError('maximumDays exceeds 14');
  const first = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(first.valueOf())) throw new TypeError('startDate invalid');
  const days = Array.from({ length: maximumDays }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + index);
    return Object.freeze({
      day: index + 1,
      date: date.toISOString().slice(0, 10),
      checkpoint: (index + 1) % checkpointEveryDays === 0,
      status: 'live_frozen'
    });
  });
  const planHash = createHash('sha256').update(JSON.stringify({
    soakId, startDate, targetDays, maximumDays, checkpointEveryDays, authorityRef
  })).digest('hex');
  return Object.freeze({
    schema_version: 'phase9-soak-plan-v1',
    soak_id: soakId,
    authority_ref: authorityRef,
    target_days: targetDays,
    maximum_days: maximumDays,
    surfaces: SURFACES,
    timeline: Object.freeze(days),
    plan_sha256: planHash,
    status: 'PHASE9_LIVE_SOAK_FROZEN',
    live_start_allowed: false
  });
}

export function aggregatePhase9Day({
  day, surfaceMetrics, accountHealth, queue, costs, authoritative = false
}) {
  assertInteger(day, 'day', 1);
  if (!Array.isArray(surfaceMetrics) || surfaceMetrics.length !== SURFACES.length) {
    throw new TypeError('all eight surface metrics required');
  }
  const attempts = surfaceMetrics.reduce((sum, item) => sum + Number(item.attempts || 0), 0);
  const successes = surfaceMetrics.reduce((sum, item) => sum + Number(item.successes || 0), 0);
  const fallbacks = surfaceMetrics.reduce((sum, item) => sum + Number(item.fallbacks || 0), 0);
  const weighted = (field) => attempts === 0 ? 0 : surfaceMetrics.reduce(
    (sum, item) => sum + Number(item[field] || 0) * Number(item.attempts || 0), 0
  ) / attempts;
  const billedMicroUsd = Number(costs?.billed_micro_usd || 0);
  return Object.freeze({
    schema_version: 'phase9-daily-aggregate-v1',
    day,
    attempts,
    successes,
    success_rate: attempts === 0 ? 0 : successes / attempts,
    fallback_rate: attempts === 0 ? 0 : fallbacks / attempts,
    parser_accuracy: weighted('parser_accuracy'),
    evidence_coverage: weighted('evidence_coverage'),
    p95_latency_ms: Math.max(...surfaceMetrics.map((item) => Number(item.p95_latency_ms || 0))),
    traffic_units: surfaceMetrics.reduce((sum, item) => sum + Number(item.traffic_units || 0), 0),
    account_healthy_ratio: Number(accountHealth?.healthy_ratio || 0),
    quarantined_accounts: Number(accountHealth?.quarantined || 0),
    queue_oldest_age_seconds: Number(queue?.oldest_age_seconds || 0),
    queue_depth: Number(queue?.depth || 0),
    billed_micro_usd: billedMicroUsd,
    reconciled: costs?.reconciled === true,
    fixture: surfaceMetrics.some((item) => item.fixture === true) || costs?.fixture === true,
    authoritative: authoritative === true &&
      surfaceMetrics.every((item) => item.fixture !== true) && costs?.fixture !== true
  });
}

export function buildPhase9Checkpoint({ plan, dailyAggregates }) {
  const ordered = [...dailyAggregates].sort((a, b) => a.day - b.day);
  const expected = ordered.map((_, index) => index + 1);
  const actual = ordered.map((item) => item.day);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('daily aggregates not contiguous');
  if (ordered.length > plan.maximum_days) throw new RangeError('checkpoint exceeds plan');
  return Object.freeze({
    schema_version: 'phase9-soak-checkpoint-v1',
    soak_id: plan.soak_id,
    plan_sha256: plan.plan_sha256,
    completed_days: ordered.length,
    next_day: ordered.length + 1,
    resumable: true,
    live_resume_allowed: false,
    daily_aggregates: Object.freeze(ordered)
  });
}

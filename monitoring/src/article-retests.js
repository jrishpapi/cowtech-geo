import { pool } from './db.js';
import { enqueueJob } from './jobs.js';
import { createTrackingRun } from './tracking.js';
import { generateArticlePublishHandoffs, listArticlePublishHandoffs } from './article-publish-handoffs.js';
import { assertPaidProviderAllowed } from './provider-policy.js';

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function scorePayload(row) {
  if (!row) return null;
  return {
    tracking_run_id: row.tracking_run_id,
    visibility_score: toNumber(row.visibility_score),
    source_quality_score: toNumber(row.source_quality_score),
    competitor_pressure_score: toNumber(row.competitor_pressure_score),
    grade: row.scoring_output?.grade || null,
    components: row.scoring_output?.components || {},
    scored_at: row.updated_at
  };
}

function metricDelta(before, after, direction = 'higher_is_better') {
  const delta = Number((after - before).toFixed(2));
  let outcome = 'unchanged';
  if (delta > 0) outcome = direction === 'higher_is_better' ? 'improved' : 'declined';
  if (delta < 0) outcome = direction === 'higher_is_better' ? 'declined' : 'improved';
  return {
    before,
    after,
    delta,
    direction,
    outcome
  };
}

function targetMetricOutcome(comparison, targetMetric) {
  if (!targetMetric || !comparison.metrics[targetMetric]) {
    return {
      target_metric: targetMetric || null,
      outcome: 'not_evaluated'
    };
  }

  return {
    target_metric: targetMetric,
    outcome: comparison.metrics[targetMetric].outcome,
    delta: comparison.metrics[targetMetric].delta,
    direction: comparison.metrics[targetMetric].direction
  };
}

export function buildArticleRetestSchedule(handoffRow) {
  const payload = handoffRow.handoff_payload || {};
  const scheduledFor = payload.retest_schedule?.scheduled_for;

  if (handoffRow.status !== 'retest_scheduled' || payload.status !== 'retest_scheduled') {
    return {
      status: 'blocked',
      article_publish_handoff_id: handoffRow.id,
      blockers: ['publish handoff is not retest_scheduled']
    };
  }

  if (handoffRow.publish_status !== 'published_externally' || payload.publish_status !== 'published_externally') {
    return {
      status: 'blocked',
      article_publish_handoff_id: handoffRow.id,
      blockers: ['external publication has not been confirmed']
    };
  }

  if (!scheduledFor) {
    return {
      status: 'blocked',
      article_publish_handoff_id: handoffRow.id,
      blockers: ['retest scheduled_for is required']
    };
  }

  return {
    schema_version: 'phase4-article-retest-schedule-v1',
    status: 'pending',
    tracking_run_id: handoffRow.tracking_run_id,
    article_publish_handoff_id: handoffRow.id,
    article_export_package_id: payload.article_export_package_id,
    article_export_id: payload.article_export_id,
    scheduled_for: scheduledFor,
    target_metric: payload.retest_schedule?.target_metric || null,
    desired_direction: payload.retest_schedule?.desired_direction || null,
    source_publish: payload.external_publish || {},
    baseline_tracking_run_id: handoffRow.tracking_run_id,
    retest_tracking_run_id: null,
    guardrails: [
      'Create a new post_publish_retest tracking run only when scheduled_for is due.',
      'Use the same active prompt set and model limits unless the customer changes the plan.',
      'Do not claim improvement until the retest run is parsed, scored, and compared.'
    ]
  };
}

function normalizeRetestRow(row) {
  return {
    ...row,
    baseline_payload: row.baseline_payload || {},
    comparison_payload: row.comparison_payload || {}
  };
}

async function brandIdForRun(trackingRunId) {
  const result = await pool.query('SELECT brand_id FROM tracking_runs WHERE id = $1', [trackingRunId]);
  if (!result.rowCount) {
    throw new Error(`tracking run not found: ${trackingRunId}`);
  }
  return result.rows[0].brand_id;
}

async function scoreForRun(trackingRunId) {
  const result = await pool.query(
    `SELECT tracking_run_id,
            visibility_score,
            source_quality_score,
            competitor_pressure_score,
            scoring_output,
            updated_at
     FROM run_scores
     WHERE tracking_run_id = $1`,
    [trackingRunId]
  );
  return scorePayload(result.rows[0]);
}

export async function listArticleRetestSchedules(trackingRunId) {
  const result = await pool.query(
    `SELECT *
     FROM article_retest_schedules
     WHERE tracking_run_id = $1
     ORDER BY created_at ASC`,
    [trackingRunId]
  );
  return result.rows.map(normalizeRetestRow);
}

export async function generateArticleRetestSchedules(trackingRunId) {
  let handoffs = await listArticlePublishHandoffs(trackingRunId);
  if (!handoffs.length) {
    await generateArticlePublishHandoffs(trackingRunId);
    handoffs = await listArticlePublishHandoffs(trackingRunId);
  }

  const brandId = await brandIdForRun(trackingRunId);
  const baselineScore = await scoreForRun(trackingRunId);
  const saved = [];
  const blocked = [];

  for (const handoff of handoffs) {
    const schedulePayload = buildArticleRetestSchedule(handoff);
    if (schedulePayload.status !== 'pending') {
      blocked.push(schedulePayload);
      continue;
    }

    const baselinePayload = {
      schema_version: 'phase4-retest-baseline-v1',
      source_tracking_run_id: trackingRunId,
      source_scores: baselineScore,
      target_metric: schedulePayload.target_metric,
      desired_direction: schedulePayload.desired_direction,
      source_publish: schedulePayload.source_publish
    };
    const scheduleKey = `${handoff.id}:post-publish-retest`;
    const result = await pool.query(
      `INSERT INTO article_retest_schedules (
         tracking_run_id,
         article_publish_handoff_id,
         brand_id,
         schedule_key,
         status,
         scheduled_for,
         baseline_payload,
         comparison_payload
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (article_publish_handoff_id)
       DO NOTHING
       RETURNING *`,
      [
        trackingRunId,
        handoff.id,
        brandId,
        scheduleKey,
        schedulePayload.status,
        schedulePayload.scheduled_for,
        JSON.stringify(baselinePayload),
        JSON.stringify(schedulePayload)
      ]
    );

    if (result.rowCount) {
      saved.push(normalizeRetestRow(result.rows[0]));
      continue;
    }

    const existing = await pool.query(
      `SELECT *
       FROM article_retest_schedules
       WHERE article_publish_handoff_id = $1`,
      [handoff.id]
    );
    saved.push(normalizeRetestRow(existing.rows[0]));
  }

  return {
    tracking_run_id: trackingRunId,
    retest_schedule_count: saved.length,
    blocked_count: blocked.length,
    schedules: saved,
    blocked_schedules: blocked
  };
}

export async function queueDueArticleRetests({
  redis,
  due_at = new Date().toISOString(),
  provider_mode = 'unconfigured',
  allow_paid_provider = false,
  limit = 20,
  database = pool
}) {
  assertPaidProviderAllowed({ provider_mode, allow_paid_provider });
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const due = await database.query(
    `SELECT schedule.*
     FROM article_retest_schedules AS schedule
     JOIN brands AS brand ON brand.id = schedule.brand_id
     JOIN customers AS customer ON customer.id = brand.customer_id
     JOIN tracking_runs AS baseline_run
       ON baseline_run.id = schedule.tracking_run_id
      AND baseline_run.brand_id = schedule.brand_id
     WHERE schedule.status = 'pending'
       AND customer.tenant_class = 'customer'
       AND customer.status IN ('active', 'trialing', 'comped')
       AND schedule.scheduled_for <= $1
     ORDER BY schedule.scheduled_for ASC
     LIMIT $2`,
    [due_at, safeLimit]
  );

  const queued = [];
  for (const schedule of due.rows.map(normalizeRetestRow)) {
    const run = await createTrackingRun({
      brand_id: schedule.brand_id,
      run_type: 'post_publish_retest',
      idempotency_key: `article-retest:${schedule.id}`
    });
    const job = {
      id: run.id,
      type: 'tracking.run',
      tracking_run_id: run.id,
      provider_mode,
      allow_paid_provider,
      retest_schedule_id: schedule.id,
      created_at: new Date().toISOString()
    };
    await enqueueJob(redis, job);
    const updated = await database.query(
      `UPDATE article_retest_schedules
       SET status = 'queued',
           retest_tracking_run_id = $2,
           queued_at = COALESCE(queued_at, NOW()),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [schedule.id, run.id]
    );
    queued.push({
      ...normalizeRetestRow(updated.rows[0]),
      job
    });
  }

  return {
    due_at,
    queued_count: queued.length,
    queued
  };
}

export function buildRetestComparison({ baseline, retest, target_metric }) {
  if (!baseline || !retest) {
    return {
      schema_version: 'phase4-retest-comparison-v1',
      status: 'blocked',
      blockers: ['baseline and retest scores are required']
    };
  }

  const comparison = {
    schema_version: 'phase4-retest-comparison-v1',
    status: 'completed',
    baseline_tracking_run_id: baseline.tracking_run_id,
    retest_tracking_run_id: retest.tracking_run_id,
    metrics: {
      visibility_score: metricDelta(baseline.visibility_score, retest.visibility_score, 'higher_is_better'),
      source_quality_score: metricDelta(baseline.source_quality_score, retest.source_quality_score, 'higher_is_better'),
      competitor_pressure_score: metricDelta(
        baseline.competitor_pressure_score,
        retest.competitor_pressure_score,
        'lower_is_better'
      )
    },
    guardrail: 'Only report measured deltas; do not claim causation from one retest.'
  };
  comparison.target_metric = targetMetricOutcome(comparison, target_metric);
  return comparison;
}

export async function compareArticleRetestSchedule(scheduleId) {
  const scheduleResult = await pool.query('SELECT * FROM article_retest_schedules WHERE id = $1', [scheduleId]);
  if (!scheduleResult.rowCount) {
    const error = new Error('article retest schedule not found');
    error.code = 'article_retest_schedule_not_found';
    throw error;
  }

  const schedule = normalizeRetestRow(scheduleResult.rows[0]);
  if (!schedule.retest_tracking_run_id) {
    return {
      status: 'waiting_for_retest_run',
      article_retest_schedule_id: schedule.id
    };
  }

  const baseline = await scoreForRun(schedule.tracking_run_id);
  const retest = await scoreForRun(schedule.retest_tracking_run_id);
  const comparison = buildRetestComparison({
    baseline,
    retest,
    target_metric: schedule.baseline_payload?.target_metric || schedule.comparison_payload?.target_metric
  });

  if (comparison.status !== 'completed') {
    return {
      ...comparison,
      article_retest_schedule_id: schedule.id
    };
  }

  const updated = await pool.query(
    `UPDATE article_retest_schedules
     SET status = 'completed',
         comparison_payload = $2,
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [schedule.id, JSON.stringify(comparison)]
  );

  return normalizeRetestRow(updated.rows[0]);
}

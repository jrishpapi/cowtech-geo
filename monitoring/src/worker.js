import { pool, closeDb } from './db.js';
import { createRedisClient } from './redis.js';
import { readJob } from './jobs.js';
import { logger } from './logger.js';
import { getConfig } from './config.js';
import { executeTrackingRun } from './tracking.js';
import { assertCustomerTrackingJobAllowed } from './customer-tracking-run-boundary.js';
import { isPhase1FanoutResult, runPhase1CollectionCycle } from './phase1-collection-worker.js';
import { runPhase1IntakeCycle } from './phase1-intake-worker.js';
import { recordPhase1RuntimeHeartbeat } from './phase1-activation-health.js';
import { parseTrackingRunResults } from './parser.js';
import { scoreTrackingRun } from './scoring.js';
import { generateContentOpportunities } from './opportunities.js';
import { generateContentBriefs } from './briefs.js';
import { generateRunExecutionPlan } from './execution-plan.js';
import { discoverOpportunityPrompts } from './opportunity-prompts.js';
import { promoteOpportunityPrompts } from './prompt-promotions.js';
import { generateMonthlyReport } from './monthly-report.js';
import {
  markMonthlyFulfillmentItemCompleted,
  markMonthlyFulfillmentItemFailed,
  markMonthlyFulfillmentItemGenerating,
  markMonthlyFulfillmentItemPendingOperator,
  assertCustomerMonthlyFulfillmentJobAllowed
} from './monthly-fulfillment.js';
import { generateCompetitorDeepReport, generateStrategyMemo } from './god-mode-deliverables.js';
import { generateArticleDrafts } from './article-drafts.js';
import { generateArticleProductionHandoffs } from './article-production-handoffs.js';
import { dispatchGeoFlowProductionHandoffsForRun } from './geoflow-connector.js';
import { importGeoFlowProductionResultsForRun } from './geoflow-import.js';
import { expandArticleDrafts } from './article-draft-expansions.js';
import { reviewArticleDraftExpansions } from './article-quality-reviews.js';
import { generateArticleExports } from './article-exports.js';
import { generateArticleExportPackages } from './article-export-packages.js';
import { generateArticlePublishHandoffs } from './article-publish-handoffs.js';
import { generateArticleRetestSchedules, queueDueArticleRetests } from './article-retests.js';
import { generateArticleRetestReports } from './article-retest-reports.js';
import { generateArticleDeliveryTimelines } from './article-delivery-timelines.js';
import { generateMonitoringAlertsForRun } from './recurring-monitoring.js';
import { assertPaidProviderAllowed } from './provider-policy.js';
import {
  runOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule,
  runOpsAuditNotificationReplaySlaAlertDigestSchedule,
  runOpsAuditNotificationReplaySlaAlertSchedule
} from './ops-audit-report-archives.js';
import { recordInternalAdminAuditEvent } from './internal-admin-audit-events.js';

let shouldStop = false;

process.on('SIGINT', () => {
  shouldStop = true;
});

process.on('SIGTERM', () => {
  shouldStop = true;
});

function compactMonthlyFulfillmentResult(job, result) {
  return {
    schema_version: 'monthly-fulfillment-job-result-v1',
    status: 'ready',
    job_type: job.type,
    tracking_run_id: job.tracking_run_id || null,
    generated_at: new Date().toISOString(),
    summary: {
      status: result?.status || null,
      count:
        result?.count ??
        result?.created_count ??
        result?.generated_count ??
        result?.draft_count ??
        result?.scheduled_count ??
        result?.report_count ??
        null
    }
  };
}

async function runMonthlyFulfillmentJob(job, handler, { resultPayload } = {}) {
  const itemId = job.monthly_fulfillment_item_id;
  let item = null;
  if (itemId) {
    item = await markMonthlyFulfillmentItemGenerating(itemId);
  }

  try {
    const result = await handler();
    const generatedCount = Number(
      result?.count ??
        result?.created_count ??
        result?.generated_count ??
        result?.draft_count ??
        result?.scheduled_count ??
        result?.report_count ??
        0
    );
    const blockedCount = Number(result?.blocked_count || 0);
    if (item && (generatedCount < Number(item.quota_units || 0) || blockedCount > 0)) {
      const error = new Error(
        `monthly fulfillment incomplete: generated ${generatedCount}/${Number(item.quota_units || 0)}, blocked ${blockedCount}`
      );
      error.code = 'monthly_fulfillment_incomplete';
      throw error;
    }
    if (itemId && item?.item_type === 'article_drafts') {
      await markMonthlyFulfillmentItemPendingOperator(
        itemId,
        resultPayload ? resultPayload(result) : compactMonthlyFulfillmentResult(job, result)
      );
    } else if (itemId) {
      await markMonthlyFulfillmentItemCompleted(
        itemId,
        resultPayload ? resultPayload(result) : compactMonthlyFulfillmentResult(job, result)
      );
    }
    return result;
  } catch (error) {
    if (itemId) {
      await markMonthlyFulfillmentItemFailed(itemId, error);
    }
    throw error;
  }
}

export async function processJob(job, { redis, boundary_database = pool } = {}) {
  await assertCustomerTrackingJobAllowed(job, { database: boundary_database });
  if (job?.monthly_fulfillment_item_id) {
    await assertCustomerMonthlyFulfillmentJobAllowed(job, { database: boundary_database });
  }

  if (job.type === 'tracking.run') {
    const result = await executeTrackingRun({
      tracking_run_id: job.tracking_run_id,
      provider_mode: job.provider_mode || 'unconfigured',
      allow_paid_provider: job.allow_paid_provider === true
    });
    return { status: result.status, result };
  }

  if (job.type === 'tracking.parse') {
    const result = await parseTrackingRunResults(job.tracking_run_id);
    return { status: 'parsed', result };
  }

  if (job.type === 'tracking.score') {
    const result = await scoreTrackingRun(job.tracking_run_id);
    const monitoring_alerts = await generateMonitoringAlertsForRun(job.tracking_run_id);
    return { status: 'scored', result, monitoring_alerts };
  }

  if (job.type === 'tracking.recurring_monitoring_cycle') {
    const tracking = await executeTrackingRun({
      tracking_run_id: job.tracking_run_id,
      provider_mode: job.provider_mode || 'unconfigured',
      allow_paid_provider: job.allow_paid_provider === true
    });
    const availability_alerts = await generateMonitoringAlertsForRun(job.tracking_run_id);
    if (isPhase1FanoutResult(tracking)) {
      return {
        status: tracking.status === 'fanned_out' ? 'recurring_monitoring_fanned_out' : tracking.status,
        tracking,
        availability_alerts
      };
    }
    const parsing = await parseTrackingRunResults(job.tracking_run_id);
    const scoring = await scoreTrackingRun(job.tracking_run_id);
    const execution_plan = await generateRunExecutionPlan(job.tracking_run_id, {
      includeOpportunityPrompts: true,
      includeBriefs: true
    });
    const monitoring_alerts = await generateMonitoringAlertsForRun(job.tracking_run_id);
    return { status: 'recurring_monitoring_completed', tracking, parsing, scoring, execution_plan, availability_alerts, monitoring_alerts };
  }

  if (job.type === 'tracking.opportunities') {
    const result = await generateContentOpportunities(job.tracking_run_id);
    return { status: 'opportunities_generated', result };
  }

  if (job.type === 'tracking.briefs') {
    const result = await generateContentBriefs(job.tracking_run_id);
    return { status: 'briefs_generated', result };
  }

  if (job.type === 'tracking.execution_plan') {
    const result = await generateRunExecutionPlan(job.tracking_run_id, {
      brief_priority: job.brief_priority || 'high'
    });
    return { status: 'execution_plan_generated', result };
  }

  if (job.type === 'tracking.opportunity_prompts') {
    const result = await discoverOpportunityPrompts(job.tracking_run_id);
    return { status: 'opportunity_prompts_discovered', result };
  }

  if (job.type === 'tracking.prompt_promotions') {
    const result = await promoteOpportunityPrompts(job.tracking_run_id, {
      score_threshold: job.score_threshold,
      max_promotions: job.max_promotions,
      change_reason: job.change_reason
    });
    return { status: 'prompt_promotions_created', result };
  }

  if (job.type === 'tracking.monthly_report') {
    const result = await runMonthlyFulfillmentJob(job, () =>
      generateMonthlyReport(job.tracking_run_id, {
        generated_at: job.generated_at
      })
    );
    return { status: 'monthly_report_generated', result };
  }

  if (job.type === 'tracking.article_drafts') {
    const result = await runMonthlyFulfillmentJob(
      job,
      async () => {
        const drafts = await generateArticleDrafts(job.tracking_run_id);
        const production = await generateArticleProductionHandoffs(job.tracking_run_id, {
          provider: 'geoflow'
        });
        return {
          ...drafts,
          production_handoff_count: Number(production.handoff_count || 0),
          production_blocked_count: Number(production.blocked_count || 0),
          production_handoffs: production.handoffs || [],
          blocked_production_handoffs: production.blocked_handoffs || []
        };
      },
      {
        resultPayload: (payload) => ({
          schema_version: 'monthly-article-delivery-v1',
          status: 'production_handoff_ready',
          generated_at: new Date().toISOString(),
          draft_count: Number(payload.generated_count || 0),
          production_handoff_count: Number(payload.production_handoff_count || 0),
          blocked_count: Number(payload.blocked_count || 0) + Number(payload.production_blocked_count || 0),
          next_action: 'operator_submit_production_handoffs',
          customer_stage: 'content_production_prepared'
        })
      }
    );
    return { status: 'article_production_prepared', result };
  }

  if (job.type === 'tracking.competitor_deep_report') {
    const result = await runMonthlyFulfillmentJob(
      job,
      () =>
        generateCompetitorDeepReport(job.tracking_run_id, {
          generated_at: job.generated_at
        }),
      { resultPayload: (payload) => payload }
    );
    return { status: 'competitor_deep_report_generated', result };
  }

  if (job.type === 'tracking.strategy_memo') {
    const result = await runMonthlyFulfillmentJob(
      job,
      () =>
        generateStrategyMemo(job.tracking_run_id, {
          generated_at: job.generated_at
        }),
      { resultPayload: (payload) => payload }
    );
    return { status: 'strategy_memo_generated', result };
  }

  if (job.type === 'tracking.article_production_handoffs') {
    const result = await generateArticleProductionHandoffs(job.tracking_run_id, {
      provider: job.provider || 'geoflow'
    });
    return { status: 'article_production_handoffs_generated', result };
  }

  if (job.type === 'tracking.geoflow_dispatch') {
    const result = await dispatchGeoFlowProductionHandoffsForRun(job.tracking_run_id, {
      dry_run: job.dry_run !== false,
      allow_live_geoflow: job.allow_live_geoflow === true,
      actor: job.actor || 'worker'
    });
    return { status: 'geoflow_dispatch_completed', result };
  }

  if (job.type === 'tracking.geoflow_imports') {
    const result = await importGeoFlowProductionResultsForRun(job.tracking_run_id, {
      review_import: job.review_import === true,
      human_review_status: job.human_review_status || 'pending'
    });
    return { status: 'geoflow_imports_completed', result };
  }

  if (job.type === 'tracking.article_draft_expansions') {
    const providerMode = job.provider_mode || 'unconfigured';
    assertPaidProviderAllowed({
      provider_mode: providerMode,
      allow_paid_provider: job.allow_paid_provider === true
    });
    const result = await expandArticleDrafts(job.tracking_run_id, {
      provider_mode: providerMode
    });
    return { status: 'article_draft_expansions_generated', result };
  }

  if (job.type === 'tracking.article_quality_reviews') {
    const result = await reviewArticleDraftExpansions(job.tracking_run_id, {
      human_review_status: job.human_review_status || 'pending'
    });
    return { status: 'article_quality_reviews_generated', result };
  }

  if (job.type === 'tracking.article_exports') {
    const result = await generateArticleExports(job.tracking_run_id);
    return { status: 'article_exports_generated', result };
  }

  if (job.type === 'tracking.article_export_packages') {
    const result = await generateArticleExportPackages(job.tracking_run_id);
    return { status: 'article_export_packages_generated', result };
  }

  if (job.type === 'tracking.article_publish_handoffs') {
    const result = await generateArticlePublishHandoffs(job.tracking_run_id);
    return { status: 'article_publish_handoffs_generated', result };
  }

  if (job.type === 'tracking.article_retests') {
    const result = await runMonthlyFulfillmentJob(job, () => generateArticleRetestSchedules(job.tracking_run_id));
    return { status: 'article_retests_generated', result };
  }

  if (job.type === 'tracking.article_retest_queue_due') {
    const providerMode = job.provider_mode || 'unconfigured';
    assertPaidProviderAllowed({
      provider_mode: providerMode,
      allow_paid_provider: job.allow_paid_provider === true
    });
    const result = await queueDueArticleRetests({
      redis,
      due_at: job.due_at,
      provider_mode: providerMode,
      allow_paid_provider: job.allow_paid_provider === true,
      limit: job.limit
    });
    return { status: 'article_retests_queued', result };
  }

  if (job.type === 'tracking.article_retest_reports') {
    const result = await generateArticleRetestReports(job.tracking_run_id);
    return { status: 'article_retest_reports_generated', result };
  }

  if (job.type === 'tracking.article_delivery_timelines') {
    const result = await generateArticleDeliveryTimelines(job.tracking_run_id);
    return { status: 'article_delivery_timelines_generated', result };
  }

  if (job.type === 'ops.replay_sla_alerts.generate') {
    const actor = { username: job.actor_username || 'scheduler', role: job.actor_role || 'admin' };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const run = await runOpsAuditNotificationReplaySlaAlertSchedule(
        {
          actor,
          force: job.force === true,
          source: job.source || 'worker'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: actor.username,
          actor_role: actor.role,
          action: `evidence_case_notification_replay_sla_alert_schedule_${run.status}`,
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alert_schedule',
          before_payload: null,
          after_payload: run,
          metadata: { source: 'ops_replay_sla_alert_schedule_worker', job_id: job.id }
        },
        client
      );
      await client.query('COMMIT');
      return { status: `replay_sla_alert_schedule_${run.status}`, result: run };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  if (job.type === 'ops.replay_sla_alert_digest.generate') {
    const actor = { username: job.actor_username || 'scheduler', role: job.actor_role || 'admin' };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const run = await runOpsAuditNotificationReplaySlaAlertDigestSchedule(
        {
          actor,
          force: job.force === true,
          source: job.source || 'worker'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: actor.username,
          actor_role: actor.role,
          action: `evidence_case_notification_replay_sla_alert_digest_schedule_${run.status}`,
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alert_digest_schedule',
          before_payload: null,
          after_payload: run,
          metadata: { source: 'ops_replay_sla_alert_digest_schedule_worker', job_id: job.id }
        },
        client
      );
      await client.query('COMMIT');
      return { status: `replay_sla_alert_digest_schedule_${run.status}`, result: run };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  if (job.type === 'ops.anomaly_sla_digest.generate') {
    const actor = { username: job.actor_username || 'scheduler', role: job.actor_role || 'admin' };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const run = await runOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(
        {
          actor,
          force: job.force === true,
          source: job.source || 'worker'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: actor.username,
          actor_role: actor.role,
          action: `evidence_case_anomaly_notification_digest_schedule_${run.status}`,
          target_user_id: null,
          target_username: 'evidence_case_anomaly_notification_digest_schedule',
          before_payload: null,
          after_payload: run,
          metadata: { source: 'ops_anomaly_sla_digest_schedule_worker', job_id: job.id }
        },
        client
      );
      await client.query('COMMIT');
      return { status: `anomaly_sla_digest_schedule_${run.status}`, result: run };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  if (job.type !== 'healthcheck') {
    await pool.query(
      `INSERT INTO health_checks (source, status, details)
       VALUES ($1, $2, $3)`,
      ['worker', 'ignored', { job }]
    );
    return { status: 'ignored' };
  }

  await pool.query(
    `INSERT INTO health_checks (source, status, details)
     VALUES ($1, $2, $3)`,
    [job.source || 'worker', 'ok', { job_id: job.id, received_at: new Date().toISOString() }]
  );
  return { status: 'ok' };
}

export async function runWorker() {
  const redis = createRedisClient();
  const config = getConfig();
  const phase1WorkerId = `phase1-mock-worker:${process.pid}`;
  logger.info('worker started');

  try {
    while (!shouldStop) {
      if (config.phase1DurableQueueWorkerEnabled) {
        let durableWorkProcessed = false;
        try {
          const intakeCycle = await runPhase1IntakeCycle({
            pool,
            config,
            workerId: `${phase1WorkerId}:intake`
          });
          await recordPhase1RuntimeHeartbeat({
            component: 'worker',
            instanceId: `${phase1WorkerId}:intake`,
            details: {
              mode: 'phase1_shadow_intake',
              state: intakeCycle.status,
              external_transport_allowed: false,
              collection_worker_enabled: config.phase1CollectionWorkerEnabled === true
            }
          });
          if (intakeCycle.status === 'processed') {
            durableWorkProcessed = true;
            logger.info({ intakeCycle }, 'processed Phase 1 durable tracking intake');
          } else if (['retry_scheduled', 'dead_letter'].includes(intakeCycle.status)) {
            logger.warn({ intakeCycle }, 'Phase 1 durable tracking intake did not fan out');
          }
        } catch (error) {
          logger.error({ error }, 'Phase 1 durable tracking intake cycle failed');
        }
        if (config.phase1CollectionWorkerEnabled) {
          try {
            const phase1Cycle = await runPhase1CollectionCycle({ pool, config, workerId: phase1WorkerId });
            if (phase1Cycle.status === 'processed') {
              durableWorkProcessed = true;
              logger.info({ phase1Cycle }, 'processed Phase 1 durable collection task');
            }
          } catch (error) {
            // The claimed task remains durable and leased. A later sweeper cycle
            // recovers it; never fall through to an external provider path.
            logger.error({ error }, 'Phase 1 mock collection cycle failed');
          }
        }
        if (durableWorkProcessed) continue;
      }
      const job = await readJob(redis, 5);
      if (!job) continue;
      logger.info({ job }, 'processing job');
      try {
        const result = await processJob(job, { redis });
        logger.info({ job_id: job.id, job_type: job.type, result_status: result?.status || 'completed' }, 'job completed');
      } catch (error) {
        logger.error(
          { job_id: job.id, job_type: job.type, tracking_run_id: job.tracking_run_id || null, error },
          'job failed'
        );
      }
    }
  } finally {
    await redis.quit();
    await closeDb();
    logger.info('worker stopped');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWorker().catch((error) => {
    logger.error({ error }, 'worker failed');
    process.exit(1);
  });
}

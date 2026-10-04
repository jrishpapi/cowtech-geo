import { pool } from './db.js';
import { performOpsArticleAction } from './article-ops-actions.js';
import { runDueCustomerRetests } from './customer-retests.js';
import { createTrackingRun, executeTrackingRun, getTrackingRun } from './tracking.js';
import { parseTrackingRunResults } from './parser.js';
import { scoreTrackingRun } from './scoring.js';

export const PRODUCT_OPS_ACTIONS = [
  'retry_tracking_run_mock',
  'prepare_publish_handoff',
  'schedule_retest',
  'run_due_retests_mock',
  'acknowledge_product_failure'
];

const ACTION_COPY = {
  retry_tracking_run_mock: {
    label: 'Retry tracking run',
    precondition: 'The source tracking run must be failed or partially failed.',
    customer_visible_impact: 'Creates a new mock tracking run for the same customer brand; no customer workflow state changes until downstream reports are generated.'
  },
  prepare_publish_handoff: {
    label: 'Prepare publish handoff',
    precondition: 'The publish handoff must be approved for manual handoff preparation.',
    customer_visible_impact: 'Moves the article package to handoff prepared so ops can publish manually outside the product.'
  },
  schedule_retest: {
    label: 'Schedule retest',
    precondition: 'The publish handoff must already be externally published and include a scheduled retest time.',
    customer_visible_impact: 'Creates a pending post-publish retest schedule visible in the customer retest board.'
  },
  run_due_retests_mock: {
    label: 'Run due retests',
    precondition: 'One or more customer retests must be due.',
    customer_visible_impact: 'Runs due retests in mock mode and prepares comparison/report data without paid-provider calls.'
  },
  acknowledge_product_failure: {
    label: 'Acknowledge product failure',
    precondition: 'The target queue item must include a product failure or blocker to triage.',
    customer_visible_impact: 'Records an internal product-ops acknowledgement only; customer-facing state is not changed.'
  }
};

export function assertProductOpsActionAllowed(action) {
  if (!PRODUCT_OPS_ACTIONS.includes(action)) {
    const error = new Error(`product ops action is not allowed: ${action}`);
    error.code = 'product_ops_action_not_allowed';
    throw error;
  }
}

function actionCopy(action) {
  return ACTION_COPY[action] || {
    label: action,
    precondition: 'The product ops precondition must be satisfied.',
    customer_visible_impact: 'Product state was updated through an existing Growth Loop workflow.'
  };
}

function requireValue(value, code, message) {
  if (value === undefined || value === null || value === '') {
    const error = new Error(message);
    error.code = code;
    throw error;
  }
  return value;
}

function productOpsResult({ action, actor, status = 'accepted', resultState, customerVisibleImpact, data = {}, event = null }) {
  const copy = actionCopy(action);
  return {
    schema_version: 'r7-2-product-ops-action-result-v1',
    status,
    action: {
      type: action,
      label: copy.label,
      actor: actor || 'ops_dashboard'
    },
    precondition: copy.precondition,
    result_state: resultState,
    customer_visible_impact: customerVisibleImpact || copy.customer_visible_impact,
    data,
    event,
    guardrails: [
      'R7.2 product ops actions reuse existing Growth Loop state machines.',
      'Tracking retry and due retest execution are forced to provider_mode=mock with allow_paid_provider=false.',
      'This action surface does not auto-publish to CMS, send webhooks, send email, deploy infrastructure, or bypass customer approval.',
      'Internal audit receipts, custody trails, evidence packets, signed bundles, and raw provider payloads are not exposed by this result.'
    ]
  };
}

async function recordProductOpsActionEvent({
  action,
  target_type: targetType,
  target_id: targetId,
  idempotency_key: idempotencyKey,
  status,
  actor,
  request_payload: requestPayload = {},
  result_payload: resultPayload = {},
  customer_visible_impact: customerVisibleImpact
}) {
  const result = await pool.query(
    `INSERT INTO product_ops_action_events (
       action, target_type, target_id, idempotency_key, status, actor,
       request_payload, result_payload, customer_visible_impact
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (idempotency_key)
     DO UPDATE SET
       status = EXCLUDED.status,
       request_payload = EXCLUDED.request_payload,
       result_payload = EXCLUDED.result_payload,
       customer_visible_impact = EXCLUDED.customer_visible_impact,
       updated_at = NOW()
     RETURNING id, action, target_type, target_id, idempotency_key, status, actor, created_at, updated_at`,
    [
      action,
      targetType,
      targetId || null,
      idempotencyKey || null,
      status,
      actor || 'ops_dashboard',
      JSON.stringify(requestPayload),
      JSON.stringify(resultPayload),
      customerVisibleImpact || actionCopy(action).customer_visible_impact
    ]
  );
  return result.rows[0];
}

async function preparePublishHandoff(options) {
  const handoffId = requireValue(
    options.publish_handoff_id || options.handoff_id,
    'product_ops_publish_handoff_id_required',
    'publish_handoff_id is required'
  );
  const result = await performOpsArticleAction({
    handoff_id: handoffId,
    action: 'prepare_handoff',
    actor: options.actor,
    note: options.note,
    channel: options.channel || 'manual',
    instructions: options.instructions || 'Use the exported Markdown, HTML, and metadata package for manual publication.'
  });
  return productOpsResult({
    action: options.action,
    actor: options.actor,
    resultState: result.handoff.status,
    data: {
      publish_handoff_id: handoffId,
      handoff_status: result.handoff.status,
      publish_status: result.handoff.publish_status
    }
  });
}

async function scheduleRetest(options) {
  const handoffId = requireValue(
    options.publish_handoff_id || options.handoff_id,
    'product_ops_publish_handoff_id_required',
    'publish_handoff_id is required'
  );
  const scheduledFor = requireValue(
    options.scheduled_for,
    'product_ops_retest_schedule_required',
    'scheduled_for is required'
  );
  const result = await performOpsArticleAction({
    handoff_id: handoffId,
    action: 'schedule_retest',
    actor: options.actor,
    note: options.note,
    scheduled_for: scheduledFor,
    create_retest_schedule: true
  });
  return productOpsResult({
    action: options.action,
    actor: options.actor,
    resultState: result.handoff.status,
    data: {
      publish_handoff_id: handoffId,
      handoff_status: result.handoff.status,
      publish_status: result.handoff.publish_status,
      retest_schedule_count: result.retest_schedule_result?.retest_schedule_count || 0
    }
  });
}

async function runDueRetestsMock(options) {
  const dueAt = options.due_at || new Date().toISOString();
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 50);
  const result = await runDueCustomerRetests({
    redis: options.redis,
    due_at: dueAt,
    limit
  });
  return productOpsResult({
    action: options.action,
    actor: options.actor,
    resultState: result.completed_count ? 'retests_completed' : 'no_due_retests',
    data: {
      due_at: dueAt,
      provider_mode: result.provider_mode,
      queued_count: result.queued_count,
      completed_count: result.completed_count,
      report_results: result.report_results
    }
  });
}

async function retryTrackingRunMock(options) {
  const trackingRunId = requireValue(
    options.tracking_run_id,
    'product_ops_tracking_run_id_required',
    'tracking_run_id is required'
  );
  const source = await getTrackingRun(trackingRunId);
  if (!source?.run) {
    const error = new Error(`tracking run not found: ${trackingRunId}`);
    error.code = 'product_ops_tracking_run_not_found';
    throw error;
  }
  if (!['failed', 'partial_failed'].includes(source.run.status)) {
    const error = new Error(`tracking run is not retryable from status ${source.run.status}`);
    error.code = 'product_ops_tracking_run_not_retryable';
    throw error;
  }

  const retryRun = await createTrackingRun({
    brand_id: source.run.brand_id,
    run_type: 'product_ops_retry',
    idempotency_key: options.idempotency_key || `product-ops-retry:${trackingRunId}`
  });
  if (!retryRun.was_created) {
    const existingRetry = await getTrackingRun(retryRun.id);
    return productOpsResult({
      action: options.action,
      actor: options.actor,
      resultState: existingRetry?.run?.status || retryRun.status,
      data: {
        source_tracking_run_id: trackingRunId,
        retry_tracking_run_id: retryRun.id,
        retry_run_created: false,
        provider_mode: 'mock',
        allow_paid_provider: false,
        result_count: (existingRetry?.summary || []).reduce((sum, row) => sum + Number(row.count || 0), 0),
        failures: (existingRetry?.summary || [])
          .filter((row) => row.status === 'failed')
          .reduce((sum, row) => sum + Number(row.count || 0), 0)
      }
    });
  }
  const executed = await executeTrackingRun({
    tracking_run_id: retryRun.id,
    provider_mode: 'mock',
    allow_paid_provider: false
  });
  await parseTrackingRunResults(retryRun.id);
  await scoreTrackingRun(retryRun.id);

  return productOpsResult({
    action: options.action,
    actor: options.actor,
    resultState: executed.status,
    data: {
      source_tracking_run_id: trackingRunId,
      retry_tracking_run_id: retryRun.id,
      retry_run_created: retryRun.was_created,
      provider_mode: 'mock',
      allow_paid_provider: false,
      result_count: executed.result_count,
      failures: executed.failures
    }
  });
}

async function acknowledgeProductFailure(options) {
  const targetType = requireValue(
    options.target_type || (options.tracking_run_id ? 'tracking_run' : options.publish_handoff_id ? 'publish_handoff' : null),
    'product_ops_target_type_required',
    'target_type is required'
  );
  const targetId = requireValue(
    options.target_id || options.tracking_run_id || options.publish_handoff_id || options.retest_schedule_id,
    'product_ops_target_id_required',
    'target_id is required'
  );
  return productOpsResult({
    action: options.action,
    actor: options.actor,
    resultState: 'acknowledged',
    data: {
      target_type: targetType,
      target_id: targetId,
      note: options.note || null
    }
  });
}

export async function performProductOpsAction(options = {}) {
  const action = options.action;
  const actor = options.actor || 'ops_dashboard';
  assertProductOpsActionAllowed(action);

  let result;
  if (action === 'prepare_publish_handoff') result = await preparePublishHandoff({ ...options, action, actor });
  if (action === 'schedule_retest') result = await scheduleRetest({ ...options, action, actor });
  if (action === 'run_due_retests_mock') result = await runDueRetestsMock({ ...options, action, actor });
  if (action === 'retry_tracking_run_mock') result = await retryTrackingRunMock({ ...options, action, actor });
  if (action === 'acknowledge_product_failure') result = await acknowledgeProductFailure({ ...options, action, actor });

  const event = await recordProductOpsActionEvent({
    action,
    target_type:
      options.target_type ||
      (options.tracking_run_id ? 'tracking_run' : options.publish_handoff_id || options.handoff_id ? 'publish_handoff' : 'product_ops'),
    target_id: options.target_id || options.tracking_run_id || options.publish_handoff_id || options.handoff_id || options.retest_schedule_id,
    idempotency_key: options.event_idempotency_key || null,
    status: result.status,
    actor,
    request_payload: {
      tracking_run_id: options.tracking_run_id,
      publish_handoff_id: options.publish_handoff_id || options.handoff_id,
      retest_schedule_id: options.retest_schedule_id,
      scheduled_for: options.scheduled_for,
      due_at: options.due_at,
      limit: options.limit,
      note: options.note
    },
    result_payload: result.data,
    customer_visible_impact: result.customer_visible_impact
  });

  return {
    ...result,
    event
  };
}

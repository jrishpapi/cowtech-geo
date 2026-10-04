import { pool } from './db.js';
import { buildGeoFlowReadiness } from './geoflow-connector.js';
import { buildGeoFlowLiveDispatchGate } from './geoflow-live-gate.js';
import { buildDeploymentReadiness } from './deployment-readiness.js';
import { buildBillingAuthOverview, listBillingAuthEntitlements } from './billing-auth-bridge.js';
import { getPaidProviderPilotReadiness } from './paid-provider-pilot-readiness.js';
import { getPromptDiscoveryPayload } from './prompt-discovery.js';

export const OPS_PROMPT_DISCOVERY_QUEUE_SCHEMA_VERSION = 'pd7-product-ops-prompt-discovery-queue-v1';

const QUEUE_ORDER = [
  'production_failed',
  'failed_imports',
  'changes_requested',
  'needs_quality_review',
  'production_ready',
  'production_submitted',
  'awaiting_customer_review',
  'awaiting_handoff',
  'awaiting_publish_confirmation',
  'retest_ready_to_schedule',
  'retest_scheduled'
];

const QUEUE_COPY = {
  production_failed: {
    label: 'Production failed',
    priority: 'high',
    next_action: 'Review provider error and rerun production.'
  },
  failed_imports: {
    label: 'Import needed',
    priority: 'high',
    next_action: 'Import completed provider output into Growth Loop.'
  },
  changes_requested: {
    label: 'Changes requested',
    priority: 'high',
    next_action: 'Revise the package and resume customer review.'
  },
  needs_quality_review: {
    label: 'Needs quality review',
    priority: 'medium',
    next_action: 'Complete human review before export.'
  },
  production_ready: {
    label: 'Ready for production',
    priority: 'medium',
    next_action: 'Dispatch the production handoff.'
  },
  production_submitted: {
    label: 'Sent to production',
    priority: 'medium',
    next_action: 'Wait for provider callback or follow up on the job.'
  },
  awaiting_customer_review: {
    label: 'Awaiting customer review',
    priority: 'medium',
    next_action: 'Wait for customer approval or requested changes.'
  },
  awaiting_handoff: {
    label: 'Awaiting handoff',
    priority: 'medium',
    next_action: 'Prepare manual publish handoff.'
  },
  awaiting_publish_confirmation: {
    label: 'Awaiting publish confirmation',
    priority: 'medium',
    next_action: 'Confirm the external published URL or reference.'
  },
  retest_ready_to_schedule: {
    label: 'Ready to schedule retest',
    priority: 'low',
    next_action: 'Schedule the post-publish retest.'
  },
  retest_scheduled: {
    label: 'Retest scheduled',
    priority: 'low',
    next_action: 'Wait for the retest due date before queueing execution.'
  }
};

const PRODUCT_QUEUE_COPY = {
  active_tracking_runs: {
    label: 'Active tracking runs',
    priority: 'medium',
    next_operator_action: 'Watch run progress and investigate stale or failed tracking results.'
  },
  job_failures: {
    label: 'Jobs and failures',
    priority: 'high',
    next_operator_action: 'Review failed prompt, production, import, or workflow state before retry planning.'
  },
  pending_customer_reviews: {
    label: 'Pending customer reviews',
    priority: 'medium',
    next_operator_action: 'Wait for customer decision or prepare requested revisions.'
  },
  publish_handoffs: {
    label: 'Publish handoffs',
    priority: 'medium',
    next_operator_action: 'Prepare or confirm manual publish handoff through the existing state machine.'
  },
  geoflow_readiness: {
    label: 'GeoFlow readiness',
    priority: 'medium',
    next_operator_action: 'Review dry-run request plan and blockers before any R8.3 live pilot approval.'
  },
  due_retests: {
    label: 'Due retests',
    priority: 'high',
    next_operator_action: 'Run due retests only through the mock-safe retest path in R7.2.'
  },
  provider_usage: {
    label: 'Provider and cost usage',
    priority: 'low',
    next_operator_action: 'Check plan usage and cost pressure before enabling any paid-provider run.'
  }
};

function sourceConfidence(candidate) {
  return candidate.source_confidence == null ? null : Number(candidate.source_confidence);
}

function candidateNeedsOpsReview(candidate) {
  return (
    candidate.duplicate_risk >= 70 ||
    (sourceConfidence(candidate) !== null && sourceConfidence(candidate) < 0.7) ||
    candidate.score_components?.priority_score < 55 ||
    candidate.gap_type === 'competitor_pressure' ||
    candidate.status === 'rejected' ||
    candidate.operator_blockers?.length
  );
}

function promptDiscoveryPriority(candidate, runBlockers = []) {
  if (runBlockers.includes('selected_candidates_exceed_plan_limit')) return 'high';
  if (candidate.duplicate_risk >= 70 || candidate.operator_blockers?.includes('source_confidence_low')) return 'high';
  if (candidate.status === 'rejected') return 'medium';
  if (candidate.gap_type === 'competitor_pressure') return 'medium';
  return 'low';
}

function promptDiscoveryNextAction(candidate) {
  if (candidate.status === 'confirmed') return 'Trace confirmed prompt lineage.';
  if (candidate.status === 'rejected') return 'Review rejection and decide whether to replace, archive, or restore.';
  if (candidate.duplicate_risk >= 70) return 'Review duplicate risk before approval, replacement, or confirmation.';
  if (sourceConfidence(candidate) !== null && sourceConfidence(candidate) < 0.7) return 'Review weak source confidence before customer confirmation.';
  if (candidate.gap_type === 'competitor_pressure') return 'Review competitor-gap candidate and supporting source payload.';
  return 'Review candidate context and choose an operator action.';
}

function promptDiscoveryAvailableActions(candidate) {
  if (candidate.status === 'confirmed' || candidate.status === 'archived') return [];
  const actions = [
    {
      type: 'shortlist',
      label: 'Shortlist',
      precondition: 'Candidate is still useful for customer selection.',
      customer_visible_impact: 'Moves the candidate into the shortlist without consuming prompt quota.'
    },
    {
      type: 'approve',
      label: 'Approve',
      precondition: 'Operator reviewed blockers and source context.',
      customer_visible_impact: 'Marks the candidate approved for confirmation without starting tracking.'
    },
    {
      type: 'reject',
      label: 'Reject',
      precondition: 'Candidate is not suitable for this customer.',
      customer_visible_impact: 'Removes the candidate from the customer confirmation path.'
    },
    {
      type: 'edit',
      label: 'Save edit',
      precondition: 'Operator supplies customer-safe prompt text.',
      customer_visible_impact: 'Updates the candidate text before confirmation.'
    },
    {
      type: 'replace',
      label: 'Replace',
      precondition: 'Operator supplies a replacement prompt and reason.',
      customer_visible_impact: 'Archives the original candidate and creates an approved replacement candidate.'
    },
    {
      type: 'confirm',
      label: 'Confirm',
      precondition: 'Candidate should become an active prompt in the existing prompt set.',
      customer_visible_impact: 'Creates an active prompt; it does not start tracking.'
    },
    {
      type: 'block_confirmation',
      label: 'Block',
      precondition: 'Operator provides a reason.',
      customer_visible_impact: 'Archives the candidate so it cannot be confirmed.'
    },
    {
      type: 'override_quota',
      label: 'Override quota',
      precondition: 'Operator provides actor and reason metadata.',
      customer_visible_impact: 'Records explicit quota override metadata without starting tracking.'
    }
  ];
  if (candidate.status === 'rejected') {
    return actions.filter((action) => ['replace', 'block_confirmation'].includes(action.type));
  }
  return actions;
}

function promptDiscoveryRunSummary(payload) {
  const candidates = payload.candidates || [];
  const selected = payload.quota?.selected_candidate_count || 0;
  const limit = payload.quota?.plan_prompt_limit || 0;
  const runBlockers = [...(payload.warnings || [])];
  if (limit > 0 && selected > limit && !runBlockers.includes('selected_candidates_exceed_plan_limit')) {
    runBlockers.push('selected_candidates_exceed_plan_limit');
  }

  const duplicateRiskCandidates = candidates.filter((candidate) => candidate.duplicate_risk >= 70).length;
  const lowConfidenceCandidates = candidates.filter(
    (candidate) => (sourceConfidence(candidate) !== null && sourceConfidence(candidate) < 0.7) || candidate.score_components?.priority_score < 55
  ).length;
  const competitorGapCandidates = candidates.filter(
    (candidate) => candidate.gap_type === 'competitor_pressure' || candidate.gap_payload?.gaps?.length
  ).length;

  return {
    discovery_run_id: payload.discovery_run?.id || null,
    brand: payload.brand,
    customer: payload.customer,
    readiness: payload.readiness,
    quota: payload.quota,
    counts: {
      candidates: candidates.length,
      selected,
      confirmed: payload.quota?.confirmed_prompt_count || 0,
      duplicate_risk_candidates: duplicateRiskCandidates,
      low_confidence_candidates: lowConfidenceCandidates,
      competitor_gap_candidates: competitorGapCandidates
    },
    blockers: runBlockers,
    updated_at: payload.discovery_run?.finished_at || payload.discovery_run?.started_at || payload.generated_at
  };
}

function promptDiscoveryQueueItem(payload, candidate, runBlockers) {
  const confirmedLink = (payload.confirmed_prompts || []).find((prompt) => prompt.id === candidate.prompt_id);
  return {
    item_type: 'prompt_discovery_candidate',
    priority: promptDiscoveryPriority(candidate, runBlockers),
    label: 'Prompt discovery',
    brand: payload.brand,
    customer: payload.customer,
    discovery_run: payload.discovery_run,
    candidate: {
      id: candidate.id,
      candidate_text: candidate.candidate_text,
      status: candidate.status,
      intent: candidate.intent,
      funnel_stage: candidate.funnel_stage,
      gap_type: candidate.gap_type,
      priority_band: candidate.priority_band,
      duplicate_risk: candidate.duplicate_risk,
      source_label: candidate.source_label,
      source_confidence: sourceConfidence(candidate),
      recommendation_reason: candidate.recommendation_reason
    },
    score_components: candidate.score_components || {},
    source_payload: candidate.source_payload || {},
    gap_payload: candidate.gap_payload || {},
    selection_events: candidate.selection_events || [],
    operator_blockers: [...new Set([...(candidate.operator_blockers || []), ...runBlockers])],
    override_options: candidate.override_options || [],
    confirmed_prompt_lineage: confirmedLink
      ? {
          prompt_id: confirmedLink.id,
          prompt_text: confirmedLink.prompt_text,
          category: confirmedLink.category,
          status: confirmedLink.status,
          quota_unit: confirmedLink.quota_unit
        }
      : null,
    available_actions: promptDiscoveryAvailableActions(candidate),
    action_mode: 'controlled_pd8',
    next_operator_action: promptDiscoveryNextAction(candidate),
    route_hints: {
      customer_dashboard_url: `/dashboard/articles?discovery_run_id=${payload.discovery_run?.id || ''}`,
      pd8_action_endpoint: `/internal/ops/prompt-discovery/candidates/${candidate.id}/action`,
      ops_action_endpoint: `/internal/ops/prompt-discovery/candidates/${candidate.id}/action`
    },
    updated_at: payload.discovery_run?.finished_at || payload.generated_at
  };
}

export function buildOpsPromptDiscoveryQueueFromPayloads(payloads = [], { limitPerRun = 25 } = {}) {
  const safeLimitPerRun = Math.min(Math.max(Number(limitPerRun) || 25, 1), 100);
  const runs = payloads.map(promptDiscoveryRunSummary);
  const items = payloads.flatMap((payload) => {
    const run = promptDiscoveryRunSummary(payload);
    return (payload.candidates || [])
      .filter((candidate) => candidateNeedsOpsReview(candidate) || run.blockers.length)
      .slice(0, safeLimitPerRun)
      .map((candidate) => promptDiscoveryQueueItem(payload, candidate, run.blockers));
  });

  const summary = {
    discovery_runs: runs.length,
    brands: new Set(runs.map((run) => run.brand?.id).filter(Boolean)).size,
    candidates: runs.reduce((sum, run) => sum + run.counts.candidates, 0),
    queue_items: items.length,
    blocked_brands: runs.filter((run) => run.blockers.length || run.readiness?.selection_status === 'over_limit').length,
    duplicate_risk_candidates: runs.reduce((sum, run) => sum + run.counts.duplicate_risk_candidates, 0),
    low_confidence_candidates: runs.reduce((sum, run) => sum + run.counts.low_confidence_candidates, 0),
    competitor_gap_candidates: runs.reduce((sum, run) => sum + run.counts.competitor_gap_candidates, 0),
    over_limit_runs: runs.filter((run) => run.blockers.includes('selected_candidates_exceed_plan_limit')).length,
    confirmed_prompts: runs.reduce((sum, run) => sum + run.counts.confirmed, 0)
  };

  return {
    schema_version: OPS_PROMPT_DISCOVERY_QUEUE_SCHEMA_VERSION,
    status: summary.discovery_runs ? 'active' : 'empty',
    mode: 'controlled_actions',
    generated_at: new Date().toISOString(),
    summary,
    runs,
    items: items.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityDelta = (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    }),
    guardrails: [
      'PD8 Product Ops prompt discovery actions are controlled operator mutations only.',
      'Override options require explicit operator actor and reason metadata.',
      'Customer prompt discovery payloads remain redacted; source payloads and score components stay internal.',
      'This queue and action surface never start tracking, paid providers, CMS, webhook, email, Cloudflare, VPS, or GeoFlow dispatch.'
    ]
  };
}

function hasGeoFlowImport(row) {
  return Boolean(row.geoflow_expansion_id);
}

function asNumber(value) {
  return Number(value || 0);
}

export function classifyOpsQueues(row) {
  const queues = [];
  if (row.production_status === 'production_failed') queues.push('production_failed');
  if (row.production_status === 'production_completed' && !hasGeoFlowImport(row)) queues.push('failed_imports');
  if (row.review_status === 'needs_human_review') queues.push('needs_quality_review');
  if (row.production_status === 'ready_for_external_production') queues.push('production_ready');
  if (row.production_status === 'submitted_to_geoflow') queues.push('production_submitted');

  if (row.handoff_status === 'changes_requested') queues.push('changes_requested');
  if (row.handoff_status === 'customer_review') queues.push('awaiting_customer_review');
  if (row.handoff_status === 'approved_for_publish_handoff') queues.push('awaiting_handoff');
  if (row.handoff_status === 'handoff_prepared') queues.push('awaiting_publish_confirmation');
  if (row.handoff_status === 'published_externally') queues.push('retest_ready_to_schedule');

  if (row.handoff_status === 'retest_scheduled' || row.retest_status === 'pending' || row.retest_status === 'queued') {
    queues.push('retest_scheduled');
  }

  return [...new Set(queues)];
}

function baseItem(row, queueKey) {
  const queue = QUEUE_COPY[queueKey];
  return {
    queue: queueKey,
    label: queue.label,
    priority: queue.priority,
    next_action: queue.next_action,
    tracking_run_id: row.tracking_run_id,
    run_type: row.run_type,
    brand: {
      id: row.brand_id,
      name: row.brand_name,
      website_url: row.website_url
    },
    article: {
      article_draft_id: row.article_draft_id,
      title: row.article_title,
      content_type: row.content_type
    },
    ids: {
      production_handoff_id: row.production_handoff_id || null,
      quality_review_id: row.quality_review_id || null,
      export_package_id: row.export_package_id || null,
      publish_handoff_id: row.publish_handoff_id || null,
      retest_schedule_id: row.retest_schedule_id || null
    },
    statuses: {
      production: row.production_status || 'not_started',
      quality_review: row.review_status || 'not_started',
      package: row.package_status || 'not_started',
      publish_handoff: row.handoff_status || 'not_started',
      publish: row.publish_status || 'not_published',
      retest: row.retest_status || 'not_started'
    },
    provider: row.production_provider || null,
    provider_job_id: row.production_provider_result?.provider_job_id || null,
    published_url: row.handoff_payload?.external_publish?.url || null,
    scheduled_for: row.retest_scheduled_for || row.handoff_payload?.retest_schedule?.scheduled_for || null,
    route_hints: {
      customer_dashboard_url: `/dashboard/articles?run_id=${row.tracking_run_id}`,
      ops_action_endpoint: row.publish_handoff_id
        ? `/internal/article-publish-handoffs/${row.publish_handoff_id}/ops-action`
        : null
    },
    updated_at: row.updated_at || row.run_created_at
  };
}

function compactRunItem(row) {
  const totalResults = asNumber(row.result_count);
  const completed = asNumber(row.completed_count);
  const failed = asNumber(row.failed_count);
  const availableActions = [];
  if (failed) {
    availableActions.push({
      type: 'retry_tracking_run_mock',
      label: 'Retry tracking run',
      endpoint: '/internal/ops/product-actions',
      method: 'POST',
      precondition: 'Source tracking run has failed prompt results.',
      provider_mode: 'mock',
      allow_paid_provider: false
    });
    availableActions.push({
      type: 'acknowledge_product_failure',
      label: 'Acknowledge failure',
      endpoint: '/internal/ops/product-actions',
      method: 'POST',
      precondition: 'Operator reviewed the failed tracking run.',
      customer_visible_impact: 'Internal acknowledgement only; customer state is unchanged.'
    });
  }
  return {
    item_type: 'tracking_run',
    priority: failed ? 'high' : 'medium',
    tracking_run_id: row.id,
    label: row.status,
    brand: {
      id: row.brand_id,
      name: row.brand_name,
      website_url: row.website_url
    },
    run: {
      type: row.run_type,
      status: row.status,
      created_at: row.created_at,
      started_at: row.started_at,
      finished_at: row.finished_at
    },
    progress: {
      total_results: totalResults,
      completed_results: completed,
      failed_results: failed
    },
    blocker: failed ? 'One or more prompt results failed.' : null,
    next_operator_action: failed
      ? PRODUCT_QUEUE_COPY.job_failures.next_operator_action
      : PRODUCT_QUEUE_COPY.active_tracking_runs.next_operator_action,
    available_actions: availableActions,
    route_hints: {
      customer_dashboard_url: `/dashboard/articles?run_id=${row.id}`,
      internal_run_url: `/internal/tracking/runs/${row.id}`
    },
    updated_at: row.finished_at || row.started_at || row.created_at
  };
}

function productOpsActionsForRow(row, queueKey, due) {
  const actions = [];
  if (queueKey === 'job_failures') {
    actions.push({
      type: 'acknowledge_product_failure',
      label: 'Acknowledge failure',
      endpoint: '/internal/ops/product-actions',
      method: 'POST',
      precondition: 'Operator reviewed the product workflow blocker.',
      customer_visible_impact: 'Internal acknowledgement only; customer state is unchanged.'
    });
  }
  if (queueKey === 'publish_handoffs' && row.handoff_status === 'approved_for_publish_handoff') {
    actions.push({
      type: 'prepare_publish_handoff',
      label: 'Prepare handoff',
      endpoint: '/internal/ops/product-actions',
      method: 'POST',
      precondition: 'Customer approved the article package for manual publishing handoff.',
      customer_visible_impact: 'Moves the package into prepared handoff state without publishing automatically.'
    });
  }
  if (queueKey === 'publish_handoffs' && row.handoff_status === 'published_externally' && !row.retest_schedule_id) {
    actions.push({
      type: 'schedule_retest',
      label: 'Schedule retest',
      endpoint: '/internal/ops/product-actions',
      method: 'POST',
      precondition: 'External publish has been confirmed and no retest schedule exists.',
      customer_visible_impact: 'Creates a pending post-publish retest schedule.'
    });
  }
  if (queueKey === 'due_retests' && due) {
    actions.push({
      type: 'run_due_retests_mock',
      label: 'Run due retests',
      endpoint: '/internal/ops/product-actions',
      method: 'POST',
      precondition: 'Retest scheduled time has passed.',
      provider_mode: 'mock',
      allow_paid_provider: false,
      customer_visible_impact: 'Runs due retests and prepares customer comparison/report data in mock mode.'
    });
  }
  return actions;
}

function geoflowReadinessForRow(row) {
  if (!row.production_handoff_id || row.production_provider !== 'geoflow') return null;
  return buildGeoFlowReadiness({
    id: row.production_handoff_id,
    tracking_run_id: row.tracking_run_id,
    article_draft_id: row.article_draft_id,
    production_key: row.production_key,
    provider: row.production_provider,
    status: row.production_status,
    outbound_payload: row.production_outbound_payload || {},
    callback_contract: row.production_callback_contract || {}
  });
}

function geoflowLiveGateForRow(row) {
  if (!row.production_handoff_id || row.production_provider !== 'geoflow') return null;
  return buildGeoFlowLiveDispatchGate(
    {
      id: row.production_handoff_id,
      tracking_run_id: row.tracking_run_id,
      article_draft_id: row.article_draft_id,
      production_key: row.production_key,
      provider: row.production_provider,
      status: row.production_status,
      outbound_payload: row.production_outbound_payload || {},
      callback_contract: row.production_callback_contract || {}
    },
    {
      allow_live_geoflow: false,
      execute_live: false,
      explicit_same_turn_approval: false,
      requested_pilot_jobs: 1
    }
  );
}

function productQueueItem(row, queueKey, now) {
  const queue = PRODUCT_QUEUE_COPY[queueKey];
  const item = baseItem(row, queueKey in QUEUE_COPY ? queueKey : classifyOpsQueues(row)[0] || 'awaiting_customer_review');
  const due = row.retest_scheduled_for ? new Date(row.retest_scheduled_for) <= now : false;
  const blockerByQueue = {
    job_failures:
      row.production_status === 'production_failed'
        ? 'Article production handoff failed.'
        : row.production_status === 'production_completed' && !hasGeoFlowImport(row)
          ? 'Provider output exists but has not been imported.'
          : row.failed_result_count > 0
            ? `${row.failed_result_count} prompt result(s) failed.`
            : 'Workflow failure needs triage.',
    pending_customer_reviews: 'Customer review is still open.',
    publish_handoffs:
      row.handoff_status === 'approved_for_publish_handoff'
        ? 'Approved package is waiting for handoff preparation.'
        : 'Prepared handoff is waiting for external publication confirmation.',
    geoflow_readiness: null,
    due_retests: due ? 'Retest scheduled time has passed.' : 'Retest is scheduled but not due yet.',
    provider_usage: null
  };
  const geoflowReadiness = queueKey === 'geoflow_readiness' ? geoflowReadinessForRow(row) : null;
  const geoflowLiveGate = queueKey === 'geoflow_readiness' ? geoflowLiveGateForRow(row) : null;

  return {
    item_type: queueKey,
    priority: queue.priority,
    label: queue.label,
    tracking_run_id: item.tracking_run_id,
    brand: item.brand,
    article: item.article,
    ids: item.ids,
    statuses: item.statuses,
    blocker: blockerByQueue[queueKey] || null,
    next_operator_action: queue.next_operator_action,
    available_actions: productOpsActionsForRow(row, queueKey, due),
    customer_product_link: item.route_hints.customer_dashboard_url,
    scheduled_for: item.scheduled_for,
    due: queueKey === 'due_retests' ? due : null,
    geoflow_readiness: geoflowReadiness,
    geoflow_live_gate: geoflowLiveGate,
    updated_at: item.updated_at
  };
}

function pushLimited(target, item, limit) {
  if (target.items.length < limit) target.items.push(item);
  target.count += 1;
}

function buildProductActivity(rows = [], limit = 10) {
  return rows
    .flatMap((row) =>
      ((row.handoff_payload || {}).timeline || []).map((event, index) => ({
        activity_id: `${row.publish_handoff_id || row.article_draft_id}:${index}:${event.action}`,
        at: event.at,
        action: event.action,
        actor: event.actor || 'system',
        note: event.note || null,
        brand: {
          id: row.brand_id,
          name: row.brand_name
        },
        article: {
          article_draft_id: row.article_draft_id,
          title: row.article_title
        },
        tracking_run_id: row.tracking_run_id,
        customer_product_link: `/dashboard/articles?run_id=${row.tracking_run_id}`
      }))
    )
    .filter((event) => event.at && event.action)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, limit);
}

export function buildProductOpsOverview(
  rows = [],
  { trackingRuns = [], usageRows = [], now = new Date(), limitPerQueue = 25 } = {}
) {
  const safeLimit = Math.min(Math.max(Number(limitPerQueue) || 25, 1), 100);
  const queues = Object.fromEntries(
    Object.entries(PRODUCT_QUEUE_COPY).map(([key, value]) => [
      key,
      {
        key,
        ...value,
        count: 0,
        items: []
      }
    ])
  );

  for (const run of trackingRuns) {
    if (['queued', 'running'].includes(run.status) || asNumber(run.failed_count) > 0) {
      pushLimited(
        queues[asNumber(run.failed_count) > 0 ? 'job_failures' : 'active_tracking_runs'],
        compactRunItem(run),
        safeLimit
      );
    }
  }

  for (const row of rows) {
    if (row.production_status === 'production_failed' || (row.production_status === 'production_completed' && !hasGeoFlowImport(row))) {
      pushLimited(queues.job_failures, productQueueItem(row, 'job_failures', now), safeLimit);
    }
    if (row.handoff_status === 'changes_requested' || row.handoff_status === 'customer_review') {
      pushLimited(queues.pending_customer_reviews, productQueueItem(row, 'pending_customer_reviews', now), safeLimit);
    }
    if (
      row.handoff_status === 'approved_for_publish_handoff' ||
      row.handoff_status === 'handoff_prepared' ||
      (row.handoff_status === 'published_externally' && !row.retest_schedule_id)
    ) {
      pushLimited(queues.publish_handoffs, productQueueItem(row, 'publish_handoffs', now), safeLimit);
    }
    if (row.production_provider === 'geoflow' && row.production_status === 'ready_for_external_production') {
      pushLimited(queues.geoflow_readiness, productQueueItem(row, 'geoflow_readiness', now), safeLimit);
    }
    if (
      row.retest_schedule_id &&
      ['pending', 'queued'].includes(row.retest_status || 'pending') &&
      row.retest_scheduled_for &&
      new Date(row.retest_scheduled_for) <= now
    ) {
      pushLimited(queues.due_retests, productQueueItem(row, 'due_retests', now), safeLimit);
    }
  }

  const providerUsageItems = usageRows.map((row) => ({
    item_type: 'provider_usage',
    priority: 'low',
    label: row.brand_name || 'Unassigned brand',
    brand: {
      id: row.brand_id,
      name: row.brand_name,
      website_url: null
    },
    plan_code: row.plan_code || null,
    provider_calls: asNumber(row.provider_calls),
    cost_estimate_usd: asNumber(row.cost_estimate_usd),
    first_event_at: row.first_event_at,
    last_event_at: row.last_event_at,
    blocker: null,
    next_operator_action: PRODUCT_QUEUE_COPY.provider_usage.next_operator_action,
    updated_at: row.last_event_at || row.first_event_at
  }));
  queues.provider_usage.count = providerUsageItems.length;
  queues.provider_usage.items = providerUsageItems.slice(0, safeLimit);

  const providerCalls30d = usageRows.reduce((sum, row) => sum + asNumber(row.provider_calls), 0);
  const estimatedCost30d = usageRows.reduce((sum, row) => sum + asNumber(row.cost_estimate_usd), 0);
  const summary = {
    active_tracking_runs: queues.active_tracking_runs.count,
    job_failures: queues.job_failures.count,
    pending_customer_reviews: queues.pending_customer_reviews.count,
    publish_handoffs: queues.publish_handoffs.count,
    geoflow_readiness: queues.geoflow_readiness.count,
    due_retests: queues.due_retests.count,
    provider_usage_brands: queues.provider_usage.count,
    provider_calls_30d: providerCalls30d,
    estimated_cost_30d_usd: Number(estimatedCost30d.toFixed(6)),
    urgent_count: queues.job_failures.count + queues.due_retests.count,
    total_product_queue_items:
      queues.active_tracking_runs.count +
      queues.job_failures.count +
      queues.pending_customer_reviews.count +
      queues.publish_handoffs.count +
      queues.geoflow_readiness.count +
      queues.due_retests.count
  };

  return {
    schema_version: 'r8-3-product-ops-geoflow-live-gate-v1',
    status: summary.total_product_queue_items || summary.provider_usage_brands ? 'active' : 'empty',
    mode: 'controlled_actions',
    generated_at: new Date().toISOString(),
    summary,
    queues,
    activity: buildProductActivity(rows),
    guardrails: [
      'R7.2 exposes only controlled product ops actions backed by existing state machines.',
      'R8.1 adds read-only GeoFlow readiness and dry-run comparison; it never dispatches live production jobs.',
      'R8.3 adds a controlled live dispatch pilot gate; Product Ops exposes gate state only and no live action button.',
      'Retry and due retest execution are forced through mock-safe paths with allow_paid_provider=false.',
      'Customer approval, publish handoff, retest scheduling, and paid-provider gates remain authoritative.',
      'GeoFlow tokens, callback secrets, raw provider payloads, and raw connector request bodies are redacted from the overview.',
      'Internal audit receipts, custody trails, evidence packets, signed bundles, and raw provider payloads are not part of this product ops overview.',
      'No paid provider, CMS, webhook, email, Cloudflare, or VPS action is performed by this overview.'
    ]
  };
}

export function buildOpsDashboardAggregate(
  rows = [],
  { limitPerQueue = 25, productOps = null, billingAuth = null, paidProviderPilot = null } = {}
) {
  const safeLimit = Math.min(Math.max(Number(limitPerQueue) || 25, 1), 100);
  const queues = Object.fromEntries(
    QUEUE_ORDER.map((key) => [
      key,
      {
        key,
        ...QUEUE_COPY[key],
        count: 0,
        items: []
      }
    ])
  );

  for (const row of rows) {
    for (const queueKey of classifyOpsQueues(row)) {
      const queue = queues[queueKey];
      queue.count += 1;
      if (queue.items.length < safeLimit) {
        queue.items.push(baseItem(row, queueKey));
      }
    }
  }

  const summary = QUEUE_ORDER.reduce(
    (acc, key) => {
      const queue = queues[key];
      acc.total_items += queue.count;
      if (queue.priority === 'high') acc.high_priority += queue.count;
      if (queue.priority === 'medium') acc.medium_priority += queue.count;
      if (queue.priority === 'low') acc.low_priority += queue.count;
      acc.by_queue[key] = queue.count;
      return acc;
    },
    {
      total_items: 0,
      high_priority: 0,
      medium_priority: 0,
      low_priority: 0,
      by_queue: {}
    }
  );

  return {
    schema_version: 'phase4-ops-dashboard-v1',
    status: summary.total_items ? 'active' : 'empty',
    generated_at: new Date().toISOString(),
    summary,
    product_ops: productOps || buildProductOpsOverview(rows, { limitPerQueue }),
    deployment_readiness: buildDeploymentReadiness(),
    billing_auth: billingAuth || buildBillingAuthOverview([]),
    paid_provider_pilot: paidProviderPilot,
    queues,
    guardrails: [
      'This aggregate is for internal ops/admin use only.',
      'It is read-only and does not mutate article, publish, production, or retest state.',
      'Do not expose provider errors, internal endpoints, or ops action controls in the customer dashboard.',
      'Retest scheduled does not mean a visibility improvement has been measured.'
    ]
  };
}

export async function getOpsDashboardAggregate({ limit = 200, limit_per_queue: limitPerQueue = 25 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500);
  const [result, runs, usage, billingAuthEntitlements, paidProviderPilot] = await Promise.all([
    pool.query(
    `SELECT
       tr.id AS tracking_run_id,
       tr.run_type,
       tr.created_at AS run_created_at,
       b.id AS brand_id,
       b.name AS brand_name,
       b.website_url,
       ad.id AS article_draft_id,
       ad.title AS article_title,
       ad.content_type,
      apho.id AS production_handoff_id,
       apho.production_key,
       apho.provider AS production_provider,
       apho.status AS production_status,
       apho.outbound_payload AS production_outbound_payload,
       apho.callback_contract AS production_callback_contract,
       apho.provider_result AS production_provider_result,
       geoflow_exp.id AS geoflow_expansion_id,
       aqr.id AS quality_review_id,
       aqr.status AS review_status,
       aep.id AS export_package_id,
       aep.status AS package_status,
       aph.id AS publish_handoff_id,
       aph.status AS handoff_status,
       aph.publish_status,
       aph.handoff_payload,
       ars.id AS retest_schedule_id,
       ars.status AS retest_status,
       ars.scheduled_for AS retest_scheduled_for,
       COALESCE(prompt_failures.failed_result_count, 0)::int AS failed_result_count,
       GREATEST(
         ad.updated_at,
         COALESCE(apho.updated_at, ad.updated_at),
         COALESCE(aqr.updated_at, ad.updated_at),
         COALESCE(aep.updated_at, ad.updated_at),
         COALESCE(aph.updated_at, ad.updated_at),
         COALESCE(ars.updated_at, ad.updated_at)
       ) AS updated_at
     FROM article_drafts ad
     JOIN tracking_runs tr ON tr.id = ad.tracking_run_id
     JOIN brands b ON b.id = tr.brand_id
     LEFT JOIN article_production_handoffs apho ON apho.article_draft_id = ad.id
     LEFT JOIN article_draft_expansions geoflow_exp
       ON geoflow_exp.article_draft_id = ad.id AND geoflow_exp.provider_mode = 'geoflow'
     LEFT JOIN article_quality_reviews aqr ON aqr.article_draft_id = ad.id
     LEFT JOIN article_exports ae ON ae.article_draft_id = ad.id
     LEFT JOIN article_export_packages aep ON aep.article_export_id = ae.id
     LEFT JOIN article_publish_handoffs aph ON aph.article_export_package_id = aep.id
     LEFT JOIN article_retest_schedules ars ON ars.article_publish_handoff_id = aph.id
     LEFT JOIN (
       SELECT tracking_run_id, COUNT(*)::int AS failed_result_count
       FROM prompt_results
       WHERE status = 'failed'
       GROUP BY tracking_run_id
     ) prompt_failures ON prompt_failures.tracking_run_id = tr.id
     ORDER BY updated_at DESC
     LIMIT $1`,
      [safeLimit]
    ),
    pool.query(
      `SELECT tr.id,
              tr.status,
              tr.run_type,
              tr.started_at,
              tr.finished_at,
              tr.created_at,
              b.id AS brand_id,
              b.name AS brand_name,
              b.website_url,
              COUNT(pr.id)::int AS result_count,
              COUNT(pr.id) FILTER (WHERE pr.status = 'completed')::int AS completed_count,
              COUNT(pr.id) FILTER (WHERE pr.status = 'failed')::int AS failed_count
       FROM tracking_runs tr
       JOIN brands b ON b.id = tr.brand_id
       LEFT JOIN prompt_results pr ON pr.tracking_run_id = tr.id
       WHERE tr.status IN ('queued', 'running', 'failed')
          OR EXISTS (
            SELECT 1
            FROM prompt_results failed_pr
            WHERE failed_pr.tracking_run_id = tr.id AND failed_pr.status = 'failed'
          )
       GROUP BY tr.id, b.id, b.name, b.website_url
       ORDER BY tr.created_at DESC
       LIMIT 50`
    ),
    pool.query(
      `SELECT b.id AS brand_id,
              b.name AS brand_name,
              c.plan_code,
              COUNT(*)::int AS provider_calls,
              COALESCE(SUM(ul.cost_estimate_usd), 0)::numeric AS cost_estimate_usd,
              MIN(ul.created_at) AS first_event_at,
              MAX(ul.created_at) AS last_event_at
       FROM usage_ledger ul
       LEFT JOIN brands b ON b.id = ul.brand_id
       LEFT JOIN customers c ON c.id = ul.customer_id
       WHERE ul.event_type = 'provider_call'
         AND ul.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY b.id, b.name, c.plan_code
       ORDER BY provider_calls DESC, b.name
       LIMIT 50`
    ),
    listBillingAuthEntitlements({ limit: safeLimit }),
    getPaidProviderPilotReadiness()
  ]);

  return buildOpsDashboardAggregate(result.rows, {
    limitPerQueue,
    productOps: buildProductOpsOverview(result.rows, {
      trackingRuns: runs.rows,
      usageRows: usage.rows,
      limitPerQueue
    }),
    billingAuth: buildBillingAuthOverview(billingAuthEntitlements),
    paidProviderPilot
  });
}

export async function getOpsPromptDiscoveryQueue({ limit = 50, limit_per_run: limitPerRun = 25 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const runResult = await pool.query(
    `SELECT pdr.id
     FROM prompt_discovery_runs pdr
     JOIN brands b ON b.id = pdr.brand_id
     ORDER BY pdr.created_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  const payloads = (
    await Promise.all(
      runResult.rows.map((row) =>
        getPromptDiscoveryPayload({
          discovery_run_id: row.id,
          includeOperator: true
        })
      )
    )
  ).filter(Boolean);

  return buildOpsPromptDiscoveryQueueFromPayloads(payloads, { limitPerRun });
}

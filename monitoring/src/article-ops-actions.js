import { transitionArticlePublishHandoff } from './article-publish-handoffs.js';
import { generateArticleRetestSchedules } from './article-retests.js';

export const OPS_ARTICLE_ACTIONS = [
  'resume_customer_review',
  'prepare_handoff',
  'mark_published_externally',
  'schedule_retest'
];

export function assertOpsArticleActionAllowed(action) {
  if (!OPS_ARTICLE_ACTIONS.includes(action)) {
    const error = new Error(`ops article action is not allowed: ${action}`);
    error.code = 'ops_article_action_not_allowed';
    throw error;
  }
}

function actionCopy(action) {
  const copy = {
    resume_customer_review: {
      label: 'Resume customer review',
      next_step: 'The revised package is ready for another customer review.'
    },
    prepare_handoff: {
      label: 'Prepare publish handoff',
      next_step: 'The team prepares manual publishing instructions. Nothing is published automatically.'
    },
    mark_published_externally: {
      label: 'Confirm external publish',
      next_step: 'The published URL or external reference is recorded for retest planning.'
    },
    schedule_retest: {
      label: 'Schedule retest',
      next_step: 'A pending post-publish retest schedule can now be created.'
    }
  };
  return copy[action] || { label: action, next_step: 'The ops workflow state was updated.' };
}

export function filterOpsArticleActions(actions = []) {
  return actions.filter((action) => OPS_ARTICLE_ACTIONS.includes(action.type));
}

function transitionOptions({ action, actor, note, channel, instructions, url, external_reference, published_at, scheduled_for }) {
  const base = {
    actor: actor || 'ops_dashboard',
    note: note || actionCopy(action).next_step
  };
  if (action === 'prepare_handoff') {
    return {
      ...base,
      channel: channel || 'manual',
      instructions: instructions || 'Use the exported Markdown, HTML, and metadata package for manual publication.'
    };
  }
  if (action === 'mark_published_externally') {
    return {
      ...base,
      url,
      external_reference,
      published_at
    };
  }
  if (action === 'schedule_retest') {
    return {
      ...base,
      scheduled_for
    };
  }
  return base;
}

export async function performOpsArticleAction(options) {
  const {
    handoff_id: handoffId,
    action,
    actor,
    note,
    channel,
    instructions,
    url,
    external_reference: externalReference,
    published_at: publishedAt,
    scheduled_for: scheduledFor,
    create_retest_schedule: createRetestSchedule = true
  } = options || {};

  assertOpsArticleActionAllowed(action);
  const handoff = await transitionArticlePublishHandoff(
    handoffId,
    action,
    transitionOptions({
      action,
      actor,
      note,
      channel,
      instructions,
      url,
      external_reference: externalReference,
      published_at: publishedAt,
      scheduled_for: scheduledFor
    })
  );

  let retestScheduleResult = null;
  if (action === 'schedule_retest' && createRetestSchedule) {
    retestScheduleResult = await generateArticleRetestSchedules(handoff.tracking_run_id);
  }

  return {
    schema_version: 'phase4-ops-article-action-v1',
    status: 'accepted',
    ops_action: {
      type: action,
      label: actionCopy(action).label,
      actor: actor || 'ops_dashboard',
      next_step: actionCopy(action).next_step
    },
    handoff,
    retest_schedule_result: retestScheduleResult,
    guardrails: [
      'Ops actions are separated from customer actions.',
      'This endpoint records manual operations but does not auto-publish or call a CMS.',
      'Scheduling a retest creates a pending schedule only; it does not queue or execute LLM retest runs.',
      'Visibility improvement claims require a completed retest comparison.'
    ]
  };
}

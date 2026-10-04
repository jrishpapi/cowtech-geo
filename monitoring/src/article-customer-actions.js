import { pool } from './db.js';
import { transitionArticlePublishHandoff } from './article-publish-handoffs.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

export const CUSTOMER_ARTICLE_ACTIONS = ['request_changes', 'approve_for_publish_handoff'];

export function assertCustomerArticleActionAllowed(action) {
  if (!CUSTOMER_ARTICLE_ACTIONS.includes(action)) {
    const error = new Error(`customer article action is not allowed: ${action}`);
    error.code = 'customer_article_action_not_allowed';
    throw error;
  }
}

function actionCopy(action) {
  const copy = {
    request_changes: {
      label: 'Request changes',
      next_step: 'The article returns to the team for revision before another review.'
    },
    approve_for_publish_handoff: {
      label: 'Approve handoff',
      next_step: 'The team can prepare the manual publish handoff. Nothing is published automatically.'
    }
  };
  return copy[action] || { label: action, next_step: 'The customer review state was updated.' };
}

export function filterCustomerArticleActions(actions = []) {
  return actions.filter((action) => CUSTOMER_ARTICLE_ACTIONS.includes(action.type));
}

export async function performCustomerArticleAction({ handoff_id: handoffId, action, actor, note }) {
  assertCustomerArticleActionAllowed(action);
  const visible = await pool.query(
    `SELECT 1
     FROM article_publish_handoffs aph
     JOIN tracking_runs tr ON tr.id = aph.tracking_run_id
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE aph.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [handoffId]
  );
  if (!visible.rowCount) {
    const error = new Error('customer article handoff not found');
    error.code = 'customer_article_handoff_not_found';
    throw error;
  }
  const handoff = await transitionArticlePublishHandoff(handoffId, action, {
    actor: actor || 'customer_dashboard',
    note: note || actionCopy(action).next_step
  });

  return {
    schema_version: 'phase4-customer-article-action-v1',
    status: 'accepted',
    customer_action: {
      type: action,
      label: actionCopy(action).label,
      actor: actor || 'customer_dashboard',
      next_step: actionCopy(action).next_step
    },
    handoff,
    guardrails: [
      'Customer actions are restricted to approve or request changes.',
      'This endpoint never prepares a publish handoff, confirms publication, schedules retests, or calls GeoFlow.',
      'Auto publish remains blocked after customer approval.'
    ]
  };
}

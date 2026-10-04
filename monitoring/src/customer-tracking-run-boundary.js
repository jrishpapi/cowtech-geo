import { pool } from './db.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const LEGACY_TRACKING_RUN_PATH = /^\/internal\/tracking\/runs\/([^/]+)(?:\/|$)/u;
const TRACKING_JOB_TYPES_WITHOUT_RUN = new Set(['tracking.article_retest_queue_due']);

function trackingRunBoundaryError() {
  const error = new Error('tracking run not found');
  error.code = 'tracking_run_not_found';
  return error;
}

export function legacyTrackingRunIdFromPath(path) {
  const match = LEGACY_TRACKING_RUN_PATH.exec(String(path || ''));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function customerVisibleTrackingRunExists(trackingRunId, options = {}) {
  if (!UUID_PATTERN.test(String(trackingRunId || ''))) return false;
  const database = options.database || pool;
  const query = options.query || ((sql, values) => database.query(sql, values));
  const result = await query(
    `SELECT 1
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE tr.id = $1
       AND ${customerVisibleTenantPredicate('c')}
     LIMIT 1`,
    [trackingRunId]
  );
  return result.rowCount === 1;
}

export async function assertCustomerTrackingRunAllowed(trackingRunId, options = {}) {
  if (!(await customerVisibleTrackingRunExists(trackingRunId, options))) {
    throw trackingRunBoundaryError();
  }
  return true;
}

async function customerTrackingRunExecutionAllowed(trackingRunId, options = {}) {
  if (!UUID_PATTERN.test(String(trackingRunId || ''))) return false;
  const database = options.database || pool;
  const query = options.query || ((sql, values) => database.query(sql, values));
  const result = await query(
    `SELECT 1
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE tr.id = $1
       AND ${customerVisibleTenantPredicate('c')}
       AND c.status IN ('active', 'trialing', 'comped')
     LIMIT 1`,
    [trackingRunId]
  );
  return result.rowCount === 1;
}

export async function assertCustomerTrackingJobAllowed(job, options = {}) {
  const jobType = String(job?.type || '');
  if (!jobType.startsWith('tracking.') || TRACKING_JOB_TYPES_WITHOUT_RUN.has(jobType)) {
    return true;
  }
  if (!(await customerTrackingRunExecutionAllowed(job?.tracking_run_id, options))) {
    throw trackingRunBoundaryError();
  }
  return true;
}

export function registerCustomerTrackingRunBoundary(app, options = {}) {
  app.addHook('preHandler', async (request, reply) => {
    const path = new URL(request.url, 'http://internal.local').pathname;
    const trackingRunId = legacyTrackingRunIdFromPath(path);
    if (!trackingRunId) return;

    const visible = await customerVisibleTrackingRunExists(trackingRunId, options);
    if (visible) return;

    return reply.code(404).send({
      ok: false,
      error: 'tracking_run_not_found',
      message: 'Tracking run not found.'
    });
  });
}

import { pool } from './db.js';

const ALLOWED_FILTERS = new Set(['category', 'action', 'actor', 'target', 'q']);

function assertActor(actor) {
  if (!actor?.username) {
    const error = new Error('Internal audit settings actor is required.');
    error.code = 'ops_audit_settings_actor_required';
    throw error;
  }
}

function normalizeSavedViewName(name) {
  const normalized = String(name || '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    const error = new Error('Saved audit view name is required.');
    error.code = 'ops_audit_saved_view_name_required';
    throw error;
  }
  if (normalized.length > 80) {
    const error = new Error('Saved audit view name must be 80 characters or fewer.');
    error.code = 'ops_audit_saved_view_name_too_long';
    throw error;
  }
  return normalized;
}

export function normalizeAuditSavedViewFilters(filters = {}) {
  const normalized = {};
  for (const key of ALLOWED_FILTERS) {
    const value = String(filters[key] ?? '').trim();
    if (key === 'category') {
      normalized.category = ['workflow', 'admin'].includes(value) ? value : 'all';
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

function normalizeSavedView(row) {
  return {
    id: row.id,
    name: row.name,
    filters: normalizeAuditSavedViewFilters(row.filters || {}),
    created_by_username: row.created_by_username,
    updated_by_username: row.updated_by_username,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listOpsAuditSavedViews(client = pool) {
  const result = await client.query(
    `SELECT id, name, filters, created_by_username, updated_by_username, created_at, updated_at
     FROM internal_ops_audit_saved_views
     ORDER BY lower(name) ASC`
  );
  return result.rows.map(normalizeSavedView);
}

export async function createOpsAuditSavedView({ name, filters, actor }, client = pool) {
  assertActor(actor);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_saved_views (name, filters, created_by_username, updated_by_username)
     VALUES ($1, $2::jsonb, $3, $3)
     RETURNING id, name, filters, created_by_username, updated_by_username, created_at, updated_at`,
    [normalizeSavedViewName(name), JSON.stringify(normalizeAuditSavedViewFilters(filters)), actor.username]
  );
  return normalizeSavedView(result.rows[0]);
}

export async function updateOpsAuditSavedView(id, { name, filters, actor }, client = pool) {
  assertActor(actor);
  const result = await client.query(
    `UPDATE internal_ops_audit_saved_views
     SET name = COALESCE($2, name),
         filters = COALESCE($3::jsonb, filters),
         updated_by_username = $4,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, filters, created_by_username, updated_by_username, created_at, updated_at`,
    [
      id,
      name === undefined ? null : normalizeSavedViewName(name),
      filters === undefined ? null : JSON.stringify(normalizeAuditSavedViewFilters(filters)),
      actor.username
    ]
  );
  if (!result.rows[0]) {
    const error = new Error('Saved audit view was not found.');
    error.code = 'ops_audit_saved_view_not_found';
    throw error;
  }
  return normalizeSavedView(result.rows[0]);
}

export async function deleteOpsAuditSavedView(id, client = pool) {
  const result = await client.query(
    `DELETE FROM internal_ops_audit_saved_views
     WHERE id = $1
     RETURNING id`,
    [id]
  );
  if (!result.rows[0]) {
    const error = new Error('Saved audit view was not found.');
    error.code = 'ops_audit_saved_view_not_found';
    throw error;
  }
  return { id };
}

function normalizeRetention(row) {
  const retentionDays = Number(row?.retention_days || 365);
  const generatedAt = new Date();
  const cutoff = new Date(generatedAt.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  return {
    schema_version: 'phase4-ops-audit-retention-v1',
    retention_days: retentionDays,
    cutoff_at: cutoff.toISOString(),
    updated_by_username: row?.updated_by_username || 'system',
    updated_at: row?.updated_at || null,
    retained_categories: ['workflow', 'admin'],
    notes: [
      'Workflow audit events are filtered at read time because they live inside publish handoff payloads.',
      'Internal admin audit events can be pruned from internal_admin_audit_events when execute=true is supplied.'
    ]
  };
}

export async function getOpsAuditRetentionSettings(client = pool) {
  const result = await client.query(
    `SELECT retention_days, updated_by_username, updated_at
     FROM internal_ops_audit_retention_settings
     WHERE id = TRUE`
  );
  return normalizeRetention(result.rows[0]);
}

export async function updateOpsAuditRetentionSettings({ retention_days: retentionDays, actor }, client = pool) {
  assertActor(actor);
  const normalizedDays = Number(retentionDays);
  if (!Number.isInteger(normalizedDays) || normalizedDays < 30 || normalizedDays > 3650) {
    const error = new Error('Audit retention days must be an integer between 30 and 3650.');
    error.code = 'ops_audit_retention_days_invalid';
    throw error;
  }
  const result = await client.query(
    `INSERT INTO internal_ops_audit_retention_settings (id, retention_days, updated_by_username, updated_at)
     VALUES (TRUE, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE
       SET retention_days = EXCLUDED.retention_days,
           updated_by_username = EXCLUDED.updated_by_username,
           updated_at = NOW()
     RETURNING retention_days, updated_by_username, updated_at`,
    [normalizedDays, actor.username]
  );
  return normalizeRetention(result.rows[0]);
}

export async function buildOpsAuditRetentionPrunePlan({ execute = false, actor } = {}, client = pool) {
  assertActor(actor);
  const retention = await getOpsAuditRetentionSettings(client);
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM internal_admin_audit_events
     WHERE created_at < $1`,
    [retention.cutoff_at]
  );
  const adminEventsToDelete = countResult.rows[0]?.count || 0;
  let deletedAdminEvents = 0;
  if (execute === true && adminEventsToDelete > 0) {
    const deleteResult = await client.query(
      `DELETE FROM internal_admin_audit_events
       WHERE created_at < $1
       RETURNING id`,
      [retention.cutoff_at]
    );
    deletedAdminEvents = deleteResult.rowCount || 0;
  }
  return {
    schema_version: 'phase4-ops-audit-retention-prune-v1',
    executed: execute === true,
    actor: `${actor.username}:${actor.role}`,
    retention,
    admin_events_to_delete: adminEventsToDelete,
    deleted_admin_events: deletedAdminEvents,
    workflow_events_policy: 'filtered_at_read_time'
  };
}

import { pool } from './db.js';

function compactUser(user = null) {
  if (!user) return null;
  return {
    id: user.id || null,
    username: user.username,
    role: user.role,
    display_name: user.display_name,
    disabled: Boolean(user.disabled_at),
    disabled_at: user.disabled_at || null,
    last_login_at: user.last_login_at || null
  };
}

function normalizeAuditEvent(row) {
  return {
    id: row.id,
    actor_username: row.actor_username,
    actor_role: row.actor_role,
    action: row.action,
    target_user_id: row.target_user_id || null,
    target_username: row.target_username,
    before_payload: row.before_payload || {},
    after_payload: row.after_payload || {},
    metadata: row.metadata || {},
    created_at: row.created_at
  };
}

export function buildInternalAdminAuditEvent({ actor, action, targetUser, beforeUser = null, metadata = {} }) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Internal admin audit actor is required.');
    error.code = 'internal_admin_audit_actor_required';
    throw error;
  }
  if (!targetUser?.username) {
    const error = new Error('Internal admin audit target user is required.');
    error.code = 'internal_admin_audit_target_required';
    throw error;
  }
  return {
    actor_username: actor.username,
    actor_role: actor.role,
    action,
    target_user_id: targetUser.id || null,
    target_username: targetUser.username,
    before_payload: compactUser(beforeUser) || {},
    after_payload: compactUser(targetUser) || {},
    metadata
  };
}

export async function recordInternalAdminAuditEvent(event, client = pool) {
  const result = await client.query(
    `INSERT INTO internal_admin_audit_events (
       actor_username,
       actor_role,
       action,
       target_user_id,
       target_username,
       before_payload,
       after_payload,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb)
     RETURNING id, actor_username, actor_role, action, target_user_id, target_username,
       before_payload, after_payload, metadata, created_at`,
    [
      event.actor_username,
      event.actor_role,
      event.action,
      event.target_user_id,
      event.target_username,
      JSON.stringify(event.before_payload || {}),
      JSON.stringify(event.after_payload || {}),
      JSON.stringify(event.metadata || {})
    ]
  );
  return normalizeAuditEvent(result.rows[0]);
}

export async function listInternalAdminAuditEvents({ limit = 50, created_after: createdAfter = null } = {}, client = pool) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const params = [];
  let where = '';
  if (createdAfter) {
    params.push(createdAfter);
    where = `WHERE created_at >= $${params.length}`;
  }
  params.push(safeLimit);
  const result = await client.query(
    `SELECT id, actor_username, actor_role, action, target_user_id, target_username,
       before_payload, after_payload, metadata, created_at
     FROM internal_admin_audit_events
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeAuditEvent);
}

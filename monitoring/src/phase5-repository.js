import { pool } from './db.js';
import { withTransaction } from './db-transaction.js';
import {
  assertPhase5Provenance,
  buildPhase5SurfaceEntitlement
} from './phase5-surface-contract.js';

function sha256(value, name) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new TypeError(`${name} must be a SHA-256 hex digest`);
  return normalized;
}

export async function getPhase5CustomerEntitlement(customerId, client = pool) {
  const result = await client.query(
    `SELECT c.plan_code, e.*
       FROM customers c
       LEFT JOIN phase5_customer_surface_entitlements e ON e.customer_id=c.id
      WHERE c.id=$1`,
    [customerId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const planEntitlement = buildPhase5SurfaceEntitlement({
    planCode: row.plan_code,
    claudeAddonEnabled: row.claude_addon_enabled === true
  });
  return Object.freeze({
    ...planEntitlement,
    guest_surfaces: Object.freeze({
      gemini_ui: row.gemini_guest_enabled ?? planEntitlement.guest_surfaces.gemini_ui,
      grok_ui: row.grok_guest_enabled ?? planEntitlement.guest_surfaces.grok_ui,
      qwen_ui: row.qwen_guest_enabled ?? planEntitlement.guest_surfaces.qwen_ui
    }),
    entitlement_source: row.entitlement_source || 'plan'
  });
}

export async function persistPhase5Observation(input, { client = pool } = {}) {
  assertPhase5Provenance(input);
  const transactionOptions = typeof client.connect === 'function' ? { pool: client } : { client };
  return withTransaction(transactionOptions, async (tx) => {
    const result = await tx.query(
      `INSERT INTO phase5_surface_observation_details (
         collection_task_id,observation_attempt_id,requested_surface,acquisition_mode,
         outcome,adapter_version,prompt_sha256,answer_sha256,citation_count,
         fallback_model,fallback_reason,credit_settlement,
         structured_validation_passed,metadata
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb
       )
       RETURNING *`,
      [
        input.collection_task_id,
        input.observation_attempt_id,
        input.requested_surface,
        input.acquisition_mode,
        input.outcome,
        input.adapter_version || null,
        sha256(input.prompt_sha256, 'prompt_sha256'),
        input.answer_sha256 ? sha256(input.answer_sha256, 'answer_sha256') : null,
        Number(input.citation_count || 0),
        input.fallback_model || null,
        input.fallback_reason || null,
        input.credit_settlement,
        input.structured_validation_passed === true,
        JSON.stringify(input.metadata || {})
      ]
    );
    await tx.query(
      `INSERT INTO phase5_surface_runtime_state (
         surface,adapter_version,last_outcome,updated_at
       ) VALUES ($1,$2,$3,NOW())
       ON CONFLICT (surface) DO UPDATE SET
         adapter_version=EXCLUDED.adapter_version,
         last_outcome=EXCLUDED.last_outcome,
         updated_at=NOW()`,
      [input.requested_surface, input.adapter_version, input.outcome]
    );
    return result.rows[0];
  });
}

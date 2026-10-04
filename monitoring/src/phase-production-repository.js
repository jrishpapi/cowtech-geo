import { createHash } from 'node:crypto';
import { pool } from './db.js';
import { withTransaction } from './db-transaction.js';

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function optionsFor(client) {
  return typeof client.connect === 'function' ? { pool: client } : { client };
}

function payloadHash(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function insertEvent(tx, table, event) {
  const hash = payloadHash(event.payload);
  const inserted = await tx.query(
    `INSERT INTO ${table} (
       event_type,authority_ref,idempotency_key,payload_sha256,payload
     ) VALUES ($1,$2,$3,$4,$5::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      required(event.eventType, 'eventType'),
      required(event.authorityRef, 'authorityRef'),
      required(event.idempotencyKey, 'idempotencyKey'),
      hash,
      JSON.stringify(event.payload || {})
    ]
  );
  if (inserted.rows[0]) return { row: inserted.rows[0], duplicate: false };
  const existing = await tx.query(
    `SELECT * FROM ${table} WHERE idempotency_key=$1 FOR UPDATE`,
    [event.idempotencyKey]
  );
  const row = existing.rows[0];
  if (
    !row || row.payload_sha256 !== hash || row.event_type !== event.eventType ||
    row.authority_ref !== event.authorityRef
  ) {
    throw new Error('production event idempotency conflict');
  }
  return { row, duplicate: true };
}

export class Phase8PostgresProductionRepository {
  constructor({ client = pool } = {}) {
    if (!client || typeof client.query !== 'function') throw new TypeError('client.query is required');
    this.client = client;
  }

  async recordEvent(event = {}) {
    if (event.phase !== 8) throw new Error('Phase 8 repository received another phase');
    return withTransaction(optionsFor(this.client), async (tx) => {
      const persisted = await insertEvent(tx, 'phase8_production_events', event);
      if (persisted.duplicate) return Object.freeze({ persisted: true, duplicate: true });
      const payload = event.payload || {};
      if (event.eventType === 'account_bound') {
        await tx.query(
          `UPDATE phase8_logical_account_slots SET
             state='healthy',real_account_bound=TRUE,
             credential_material_present=FALSE,updated_at=NOW()
           WHERE slot_key=$1`,
          [payload.slot_key]
        );
        await tx.query(
          `INSERT INTO phase8_account_bindings (
             slot_key,credential_ref,validation_evidence_ref,authority_ref
           ) VALUES ($1,$2,$3,$4)
           ON CONFLICT (slot_key) DO UPDATE SET
             credential_ref=EXCLUDED.credential_ref,
             validation_evidence_ref=EXCLUDED.validation_evidence_ref,
             authority_ref=EXCLUDED.authority_ref,updated_at=NOW()`,
          [payload.slot_key, payload.credential_ref, payload.evidence_ref, event.authorityRef]
        );
      } else if (event.eventType === 'migration_item_applied') {
        await tx.query(
          `UPDATE phase8_customer_migration_items SET status='applied'
           WHERE idempotency_key=$1`,
          [event.idempotencyKey]
        );
        await tx.query(
          `UPDATE phase8_customer_migration_runs SET status='running'
           WHERE id=$1 AND status IN ('ready','running')`,
          [payload.migration_run_id]
        );
      } else if (event.eventType === 'migration_rolled_back') {
        await tx.query(
          `UPDATE phase8_customer_migration_runs SET status='rolled_back'
           WHERE id=$1`,
          [payload.migration_run_id]
        );
      } else if (/^order_.+_verified$/u.test(event.eventType)) {
        const stage = event.eventType.slice('order_'.length, -'_verified'.length);
        await tx.query(
          `INSERT INTO phase8_real_order_executions(order_id,authority_ref,status)
           VALUES ($1,$2,'running') ON CONFLICT (order_id) DO NOTHING`,
          [payload.order_id, event.authorityRef]
        );
        await tx.query(
          `INSERT INTO phase8_real_order_stage_receipts(
             order_id,stage,evidence_ref,authority_ref
           ) VALUES ($1,$2,$3,$4)
           ON CONFLICT (order_id,stage) DO UPDATE SET
             evidence_ref=EXCLUDED.evidence_ref,authority_ref=EXCLUDED.authority_ref`,
          [payload.order_id, stage, payload.evidence_ref, event.authorityRef]
        );
        if (stage === 'rollback_verification') {
          await tx.query(
            `UPDATE phase8_real_order_executions SET status='completed',updated_at=NOW()
             WHERE order_id=$1`,
            [payload.order_id]
          );
        }
      } else if (event.eventType === 'order_execution_rolled_back') {
        await tx.query(
          `INSERT INTO phase8_real_order_executions(order_id,authority_ref,status)
           VALUES ($1,$2,'rolled_back')
           ON CONFLICT (order_id) DO UPDATE SET status='rolled_back',updated_at=NOW()`,
          [payload.order_id, event.authorityRef]
        );
      } else if (event.eventType === 'rollout_stage_accepted') {
        await tx.query(
          `UPDATE phase8_canary_stages SET status='accepted',updated_at=NOW()
           WHERE canary_run_id=(SELECT id FROM phase8_canary_runs WHERE cohort_id=$1)
             AND percent=$2`,
          [payload.cohort_id, payload.percent]
        );
        await tx.query(
          `UPDATE phase8_canary_runs SET
             current_percent=$2,
             status=CASE WHEN $2=100 THEN 'completed' ELSE 'running_' || $2::text END,
             updated_at=NOW()
           WHERE cohort_id=$1`,
          [payload.cohort_id, payload.percent]
        );
      } else if (event.eventType === 'rollout_stage_rolled_back') {
        await tx.query(
          `UPDATE phase8_canary_runs SET status='rolled_back',updated_at=NOW()
           WHERE cohort_id=$1`,
          [payload.cohort_id]
        );
      }
      return Object.freeze({ persisted: true, duplicate: false, event: persisted.row });
    });
  }
}

export class Phase9PostgresProductionRepository {
  constructor({ client = pool } = {}) {
    if (!client || typeof client.query !== 'function') throw new TypeError('client.query is required');
    this.client = client;
  }

  async recordEvent(event = {}) {
    if (event.phase !== 9) throw new Error('Phase 9 repository received another phase');
    return withTransaction(optionsFor(this.client), async (tx) => {
      const persisted = await insertEvent(tx, 'phase9_production_events', event);
      if (persisted.duplicate) return Object.freeze({ persisted: true, duplicate: true });
      const payload = event.payload || {};
      if (event.eventType === 'soak_started') {
        await tx.query(
          `UPDATE phase9_soak_runs SET status='running',live_start_allowed=TRUE
           WHERE soak_key=$1 AND plan_sha256=$2`,
          [payload.soak_id, payload.plan_sha256]
        );
      } else if (event.eventType === 'soak_day_recorded') {
        const aggregate = payload.aggregate || {};
        const passed = !['PAUSE', 'ROLLBACK', 'NO_GO'].includes(payload.decision);
        await tx.query(
          `UPDATE phase9_soak_days SET status=$3,authoritative=TRUE,metrics=$4::jsonb
           WHERE soak_run_id=(SELECT id FROM phase9_soak_runs WHERE soak_key=$1)
             AND day_number=$2`,
          [payload.soak_id, aggregate.day,
            passed ? 'passed' : 'failed', JSON.stringify(aggregate)]
        );
        await tx.query(
          `INSERT INTO phase9_soak_checkpoints(
             soak_run_id,completed_days,next_day,checkpoint_payload,live_resume_allowed
           ) SELECT id,$2,$3,$4::jsonb,FALSE FROM phase9_soak_runs WHERE soak_key=$1`,
          [payload.soak_id, payload.checkpoint.completed_days,
            payload.checkpoint.next_day, JSON.stringify(payload.checkpoint)]
        );
        const runStatus = payload.decision === 'GO_REVIEW'
          ? 'completed'
          : payload.decision === 'PAUSE'
            ? 'paused'
            : payload.decision === 'EXTEND_SOAK'
              ? 'extended'
              : payload.decision === 'NO_GO'
                ? 'failed'
                : 'running';
        await tx.query(
          `UPDATE phase9_soak_runs SET status=$2 WHERE soak_key=$1`,
          [payload.soak_id, runStatus]
        );
      } else if (event.eventType === 'soak_rolled_back') {
        await tx.query(
          `UPDATE phase9_soak_runs SET status='rolled_back'
           WHERE soak_key=$1`,
          [payload.soak_id]
        );
      } else if (event.eventType === 'soak_resumed') {
        await tx.query(
          `UPDATE phase9_soak_runs SET status='running'
           WHERE soak_key=$1 AND status IN ('paused','extended','running')`,
          [payload.soak_id]
        );
      } else if (event.eventType === 'soak_waiver_accepted') {
        const inserted = await tx.query(
          `INSERT INTO phase9_soak_waivers(
             waiver_key,decision_owner,authority_ref,evidence_ref,decided_at,
             waived_requirement,acceptance_effect,risk_acknowledged,
             claims_authoritative_soak_completed,decision_payload
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
           ON CONFLICT (waiver_key) DO UPDATE SET
             decision_payload=EXCLUDED.decision_payload
           RETURNING id`,
          [
            payload.waiver_key, payload.decision_owner, event.authorityRef,
            payload.evidence_ref, payload.decided_at, payload.waived_requirement,
            payload.acceptance_effect, payload.risk_acknowledged,
            payload.claims_authoritative_soak_completed, JSON.stringify(payload)
          ]
        );
        await tx.query(
          `INSERT INTO phase9_launch_gate_reviews(
             soak_run_id,soak_waiver_id,soak_decision,status,launch_allowed,review_payload
           ) VALUES (NULL,$1,'SOAK_WAIVED_BY_OWNER','commercial_launch_frozen',FALSE,$2::jsonb)
           ON CONFLICT (soak_waiver_id) WHERE soak_waiver_id IS NOT NULL
           DO UPDATE SET review_payload=EXCLUDED.review_payload`,
          [inserted.rows[0].id, JSON.stringify(payload)]
        );
      } else if (event.eventType === 'commercial_launch_applied') {
        const reviewPayload = JSON.stringify({
          launch_evidence_ref: payload.evidence_ref,
          acceptance_basis: payload.acceptance_basis
        });
        if (payload.acceptance_basis === 'OWNER_SOAK_WAIVER') {
          await tx.query(
            `UPDATE phase9_launch_gate_reviews SET
               status='launch_applied',launch_allowed=TRUE,
               review_payload=review_payload || $1::jsonb
             WHERE soak_waiver_id=(
               SELECT id FROM phase9_soak_waivers WHERE evidence_ref=$2
             )`,
            [reviewPayload, payload.soak_waiver_evidence_ref]
          );
        } else {
          await tx.query(
            `UPDATE phase9_launch_gate_reviews SET
               status='launch_applied',launch_allowed=TRUE,
               review_payload=review_payload || $1::jsonb
             WHERE id=(SELECT id FROM phase9_launch_gate_reviews
                       WHERE soak_run_id IS NOT NULL ORDER BY created_at DESC LIMIT 1)`,
            [reviewPayload]
          );
        }
      }
      return Object.freeze({ persisted: true, duplicate: false, event: persisted.row });
    });
  }
}

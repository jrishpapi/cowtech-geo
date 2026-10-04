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

const TERMINAL_STATUSES = new Set(['completed', 'held', 'dlq']);

export class Phase7PostgresLiveRepository {
  constructor({ client = pool, leaseSeconds = 180 } = {}) {
    if (!client || typeof client.query !== 'function') throw new TypeError('client.query is required');
    if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 900) {
      throw new RangeError('leaseSeconds must be between 30 and 900');
    }
    this.client = client;
    this.leaseSeconds = leaseSeconds;
  }

  async claimNext({ runId, workerId, authorityRef } = {}) {
    const run = required(runId, 'runId');
    const worker = required(workerId, 'workerId');
    const authority = required(authorityRef, 'authorityRef');
    return withTransaction(optionsFor(this.client), async (tx) => {
      const gate = await tx.query(
        `SELECT * FROM phase7_feature_flags WHERE scope_key='global' FOR UPDATE`
      );
      const flags = gate.rows[0];
      if (!flags) throw new Error('Phase 7 feature flags are missing');
      for (const flag of [
        'engineering_contract_enabled', 'production_runner_enabled',
        'live_execution_enabled', 'paid_transport_enabled',
        'external_spend_enabled', 'phase6_exit_passed'
      ]) {
        if (flags[flag] !== true) throw new Error(`Phase 7 database gate blocked: ${flag}`);
      }
      if (flags.live_authority_ref !== authority) {
        throw new Error('Phase 7 live authority mismatch');
      }
      if (Number(flags.approved_budget_micro_usd) <= 0) {
        throw new Error('Phase 7 database budget is not positive');
      }
      const runResult = await tx.query(
        `SELECT * FROM phase7_poc_runs WHERE id=$1 FOR UPDATE`,
        [run]
      );
      const runRow = runResult.rows[0];
      if (!runRow) throw new Error('Phase 7 POC run not found');
      if (!['ready', 'running'].includes(runRow.status)) {
        throw new Error(`Phase 7 POC run is not claimable: ${runRow.status}`);
      }
      if (runRow.live_authority_ref !== authority || runRow.phase6_exit_passed !== true) {
        throw new Error('Phase 7 POC run authority tuple is incomplete');
      }
      const claimed = await tx.query(
        `WITH candidate AS (
           SELECT item.id
           FROM phase7_poc_items item
           JOIN phase7_poc_batches batch ON batch.id=item.poc_batch_id
           WHERE item.poc_run_id=$1
             AND item.status IN ('ready','retryable')
             AND (item.lease_expires_at IS NULL OR item.lease_expires_at <= NOW())
           ORDER BY CASE batch.stage WHEN 'canary' THEN 0 ELSE 1 END,item.sequence
           FOR UPDATE OF item SKIP LOCKED
           LIMIT 1
         )
         UPDATE phase7_poc_items item SET
           status='running',lease_owner=$2,
           lease_expires_at=NOW()+($3::text || ' seconds')::interval,
           updated_at=NOW()
         FROM candidate
         WHERE item.id=candidate.id
         RETURNING item.*`,
        [run, worker, this.leaseSeconds]
      );
      if (!claimed.rows[0]) return null;
      if (runRow.status === 'ready') {
        await tx.query(
          `UPDATE phase7_poc_runs SET status='running' WHERE id=$1 AND status='ready'`,
          [run]
        );
      }
      return claimed.rows[0];
    });
  }

  async recordOutcome({
    runId, workerId, item, attemptOrdinal, status, result, session, failure
  } = {}) {
    const run = required(runId, 'runId');
    const worker = required(workerId, 'workerId');
    if (!item?.id) throw new TypeError('item.id is required');
    if (!Number.isSafeInteger(attemptOrdinal) || attemptOrdinal < 1 || attemptOrdinal > 3) {
      throw new RangeError('attemptOrdinal must be between 1 and 3');
    }
    if (!['completed', 'retryable', 'held', 'dlq'].includes(status)) {
      throw new RangeError('unsupported Phase 7 item outcome');
    }
    return withTransaction(optionsFor(this.client), async (tx) => {
      const locked = await tx.query(
        `SELECT * FROM phase7_poc_items
         WHERE id=$1 AND poc_run_id=$2 FOR UPDATE`,
        [item.id, run]
      );
      const current = locked.rows[0];
      if (!current) throw new Error('Phase 7 claimed item disappeared');
      if (current.status !== 'running' || current.lease_owner !== worker) {
        throw new Error('Phase 7 item lease ownership mismatch');
      }
      if (Number(current.attempt_count) + 1 !== attemptOrdinal) {
        throw new Error('Phase 7 attempt ordinal is not contiguous');
      }
      const attempt = await tx.query(
        `INSERT INTO phase7_poc_attempts (
           poc_run_id,poc_item_id,attempt_ordinal,worker_id,status,
           failure_classification,error_code,provider_session_id,
           session_cycle,session_ordinal,transport_started,evidence_verified,
           settled_cost_micro_usd,result_payload
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb
         ) RETURNING *`,
        [
          run, item.id, attemptOrdinal, worker, status,
          failure?.classification || null, failure?.code || null,
          result?.provider_session_id || null, session?.cycle || null,
          session?.ordinal || null, result?.transport_started === true,
          result?.evidence_verified === true,
          Number.isSafeInteger(result?.settled_cost_micro_usd)
            ? result.settled_cost_micro_usd
            : null,
          JSON.stringify(result || {})
        ]
      );
      await tx.query(
        `UPDATE phase7_poc_items SET
           status=$3,attempt_count=$4,failure_classification=$5,
           last_error_code=$6,provider_session_id=$7,
           lease_owner=NULL,lease_expires_at=NULL,updated_at=NOW()
         WHERE id=$1 AND poc_run_id=$2`,
        [
          item.id, run, status, attemptOrdinal,
          failure?.classification || null, failure?.code || null,
          result?.provider_session_id || null
        ]
      );
      if (TERMINAL_STATUSES.has(status)) {
        const remaining = await tx.query(
          `SELECT COUNT(*)::integer AS count FROM phase7_poc_items
           WHERE poc_run_id=$1 AND status NOT IN ('completed','held','dlq')`,
          [run]
        );
        if (remaining.rows[0].count === 0) {
          await tx.query(
            `UPDATE phase7_poc_runs SET status=CASE
               WHEN EXISTS (
                 SELECT 1 FROM phase7_poc_items
                 WHERE poc_run_id=$1 AND status IN ('held','dlq')
               ) THEN 'failed' ELSE 'completed' END,
               completed_at=NOW()
             WHERE id=$1`,
            [run]
          );
        }
      }
      return Object.freeze({ persisted: true, attempt: attempt.rows[0], item_status: status });
    });
  }

  async verifySessionContinuity({
    runId, item, session, providerSessionId
  } = {}) {
    const run = required(runId, 'runId');
    if (!item?.surface || !session?.cycle || !session?.ordinal) {
      throw new TypeError('web session identity is incomplete');
    }
    const providerSession = required(providerSessionId, 'providerSessionId');
    return withTransaction(optionsFor(this.client), async (tx) => {
      const existing = await tx.query(
        `SELECT * FROM phase7_session_cycles
         WHERE poc_run_id=$1 AND surface=$2 AND session_cycle=$3
         FOR UPDATE`,
        [run, item.surface, session.cycle]
      );
      const row = existing.rows[0];
      if (!row) {
        if (session.ordinal !== 1) {
          return Object.freeze({ verified: false, reason: 'session_cycle_binding_missing' });
        }
        await tx.query(
          `INSERT INTO phase7_session_cycles(
             poc_run_id,surface,session_cycle,provider_session_id,
             last_session_ordinal,use_count,status
           ) VALUES ($1,$2,$3,$4,1,1,'active')`,
          [run, item.surface, session.cycle, providerSession]
        );
        return Object.freeze({ verified: true, bound: true, provider_session_id: providerSession });
      }
      if (row.provider_session_id !== providerSession) {
        await tx.query(
          `UPDATE phase7_session_cycles SET status='broken',updated_at=NOW()
           WHERE id=$1`,
          [row.id]
        );
        return Object.freeze({ verified: false, reason: 'provider_session_id_changed' });
      }
      if (Number(row.last_session_ordinal) + 1 !== session.ordinal) {
        return Object.freeze({ verified: false, reason: 'session_ordinal_not_contiguous' });
      }
      await tx.query(
        `UPDATE phase7_session_cycles SET
           last_session_ordinal=$2,use_count=use_count+1,
           status=CASE WHEN $2=100 THEN 'completed' ELSE 'active' END,
           updated_at=NOW()
         WHERE id=$1`,
        [row.id, session.ordinal]
      );
      return Object.freeze({ verified: true, bound: false, provider_session_id: providerSession });
    });
  }
}

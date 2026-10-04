import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ledgerError, withTransaction } from './db-transaction.js';

const BUDGETED_SUPPLIERS = new Set(['bright_data', 'serpapi', 'other']);
const SUPPLIER_PERMIT_VERSION = 'supplier-permit-hmac-sha256-v1';
const DEFAULT_RESERVATION_TTL_SECONDS = 300;
const MAX_RESERVATION_TTL_SECONDS = 86400;

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function supplierName(value) {
  const supplier = nonEmptyString(value, 'supplier');
  if (!BUDGETED_SUPPLIERS.has(supplier)) throw new RangeError(`supplier is not budgeted: ${supplier}`);
  return supplier;
}

function positiveSafeInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new TypeError(`${name} must be a positive safe integer no greater than ${maximum}`);
  }
  return parsed;
}

function permitKeyId(value, name = 'permit_token_key_id') {
  const keyId = nonEmptyString(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(keyId)) {
    throw new TypeError(`${name} must be a simple key identifier`);
  }
  return keyId;
}

function permitSecret(value, keyId) {
  let secret;
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    secret = Buffer.from(value);
  } else if (typeof value === 'string') {
    secret = Buffer.from(value, 'utf8');
  } else {
    throw new TypeError(`permit key ${keyId} must be a string, Buffer, or Uint8Array`);
  }
  if (secret.byteLength < 32) throw new TypeError(`permit key ${keyId} must contain at least 32 bytes`);
  return secret;
}

function normalizePermitKeyring(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('permit_keyring must be an object');
  }
  const activeKeyId = permitKeyId(value.active_key_id, 'permit_keyring.active_key_id');
  const sourceKeys = value.keys;
  if (!sourceKeys || typeof sourceKeys !== 'object' || Array.isArray(sourceKeys)) {
    throw new TypeError('permit_keyring.keys must be an object or Map');
  }
  const entries = sourceKeys instanceof Map ? [...sourceKeys.entries()] : Object.entries(sourceKeys);
  const keys = new Map(entries.map(([keyId, secret]) => {
    const normalizedKeyId = permitKeyId(keyId, 'permit_keyring key id');
    return [normalizedKeyId, permitSecret(secret, normalizedKeyId)];
  }));
  if (!keys.has(activeKeyId)) {
    throw new TypeError(`permit_keyring does not contain active key ${activeKeyId}`);
  }
  return { activeKeyId, keys };
}

function canonicalPermitPayload({
  permitId,
  collectionTaskId,
  observationAttemptId,
  leaseFencingToken,
  budgetScopeId,
  supplier,
  transportSupplier,
  maxCostMicroUsd
}) {
  return JSON.stringify([
    SUPPLIER_PERMIT_VERSION,
    permitId,
    collectionTaskId,
    observationAttemptId,
    String(leaseFencingToken),
    budgetScopeId,
    supplier,
    transportSupplier,
    String(maxCostMicroUsd)
  ]);
}

export function deriveSupplierPermitToken({
  permit_keyring,
  permit_token_key_id,
  permit_id,
  collection_task_id,
  observation_attempt_id,
  lease_fencing_token,
  budget_scope_id,
  supplier,
  transport_supplier,
  max_cost_micro_usd
} = {}) {
  const keyring = normalizePermitKeyring(permit_keyring);
  const keyId = permitKeyId(permit_token_key_id || keyring.activeKeyId);
  const key = keyring.keys.get(keyId);
  if (!key) {
    throw ledgerError('supplier_permit_key_unavailable', `supplier permit key is unavailable: ${keyId}`, {
      permit_token_key_id: keyId
    });
  }
  const payload = canonicalPermitPayload({
    permitId: nonEmptyString(permit_id, 'permit_id'),
    collectionTaskId: nonEmptyString(collection_task_id, 'collection_task_id'),
    observationAttemptId: nonEmptyString(observation_attempt_id, 'observation_attempt_id'),
    leaseFencingToken: positiveSafeInteger(lease_fencing_token, 'lease_fencing_token'),
    budgetScopeId: nonEmptyString(budget_scope_id, 'budget_scope_id'),
    supplier: supplierName(supplier),
    transportSupplier: nonEmptyString(transport_supplier, 'transport_supplier'),
    maxCostMicroUsd: microUsd(max_cost_micro_usd, 'max_cost_micro_usd', { positive: true })
  });
  const digest = createHmac('sha256', key).update(payload, 'utf8').digest('base64url');
  return `${SUPPLIER_PERMIT_VERSION}.${keyId}.${digest}`;
}

function jsonObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return JSON.stringify(value);
}

function microUsd(value, name, { positive = false } = {}) {
  let parsed;
  if (typeof value === 'bigint') {
    parsed = value;
  } else if (Number.isSafeInteger(value)) {
    parsed = BigInt(value);
  } else if (typeof value === 'string' && /^\d+$/.test(value)) {
    parsed = BigInt(value);
  } else {
    throw new TypeError(`${name} must be a non-negative safe integer or integer string`);
  }
  if (parsed < 0n || (positive && parsed === 0n)) {
    throw new TypeError(`${name} must be ${positive ? 'positive' : 'non-negative'}`);
  }
  return parsed.toString();
}

function rowBigInt(value, name) {
  try {
    return BigInt(value);
  } catch {
    throw ledgerError('invalid_ledger_row', `${name} is not an integer`);
  }
}

function transactionOptions({ pool, client }) {
  return client ? { client } : pool ? { pool } : {};
}

export function hashSupplierPermitToken(permitToken) {
  const token = nonEmptyString(permitToken, 'permit_token');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function assertPermitToken(reservation, permitToken) {
  const actual = Buffer.from(hashSupplierPermitToken(permitToken), 'hex');
  const expected = Buffer.from(String(reservation.permit_token_hash || ''), 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw ledgerError('supplier_permit_token_invalid', 'supplier transport permit token is invalid', {
      permit_id: reservation.permit_id
    });
  }
}

async function lockBudgetScope(client, budgetScopeId) {
  const result = await client.query(
    `SELECT *
       FROM supplier_budget_scopes
      WHERE id = $1
      FOR UPDATE`,
    [budgetScopeId]
  );
  if (!result.rows[0]) {
    throw ledgerError('supplier_budget_scope_not_found', `supplier budget scope not found: ${budgetScopeId}`);
  }
  return result.rows[0];
}

async function lockBudgetAccountBySupplier(client, budgetScopeId, supplier) {
  const result = await client.query(
    `SELECT *
       FROM supplier_budget_accounts
      WHERE budget_scope_id = $1
        AND supplier = $2
      FOR UPDATE`,
    [budgetScopeId, supplier]
  );
  if (!result.rows[0]) {
    throw ledgerError('supplier_budget_account_not_found', 'supplier budget account was not configured', {
      budget_scope_id: budgetScopeId,
      supplier
    });
  }
  return result.rows[0];
}

async function lockBudgetAccountById(client, budgetAccountId, budgetScopeId, supplier) {
  const result = await client.query(
    `SELECT *
       FROM supplier_budget_accounts
      WHERE id = $1
        AND budget_scope_id = $2
        AND supplier = $3
      FOR UPDATE`,
    [budgetAccountId, budgetScopeId, supplier]
  );
  if (!result.rows[0]) {
    throw ledgerError('supplier_budget_account_not_found', 'supplier budget account no longer matches reservation');
  }
  return result.rows[0];
}

function assertScopeCanStartTransport(scope) {
  if (scope.status !== 'active') {
    throw ledgerError('supplier_budget_scope_not_active', `supplier budget scope is ${scope.status}`);
  }
  if (
    scope.external_transport_enabled !== true ||
    scope.paid_run_enabled !== true ||
    scope.live_transport_enabled !== true
  ) {
    throw ledgerError('supplier_transport_disarmed', 'supplier transport gates are not all enabled', {
      external_transport_enabled: scope.external_transport_enabled === true,
      paid_run_enabled: scope.paid_run_enabled === true,
      live_transport_enabled: scope.live_transport_enabled === true
    });
  }
  if (!scope.budget_approval_id) {
    throw ledgerError('supplier_budget_approval_missing', 'supplier budget scope has no approval id');
  }
}

async function hardStopBudget(client, { scope, account, reason }) {
  const scopeResult = await client.query(
    `UPDATE supplier_budget_scopes
        SET status = 'hard_stopped',
            stop_reason = $2,
            hard_stopped_at = COALESCE(hard_stopped_at, NOW()),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [scope.id, reason]
  );
  const accountResult = await client.query(
    `UPDATE supplier_budget_accounts
        SET hard_stopped = TRUE,
            stop_reason = $2,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [account.id, reason]
  );
  return { scope: scopeResult.rows[0], account: accountResult.rows[0] };
}

async function lockAttempt(client, observationAttemptId) {
  const result = await client.query(
    `SELECT *
       FROM observation_attempts
      WHERE id = $1
      FOR UPDATE`,
    [observationAttemptId]
  );
  if (!result.rows[0]) {
    throw ledgerError('observation_attempt_not_found', `observation attempt not found: ${observationAttemptId}`);
  }
  return result.rows[0];
}

async function lockActiveTaskLease(client, { taskId, leaseToken, leaseFencingToken, workerId }) {
  const result = await client.query(
    `SELECT *
       FROM collection_tasks
      WHERE id = $1
        AND status = 'leased'
        AND lease_token = $2
        AND lease_fencing_token = $3
        AND lease_owner = $4
        AND lease_until > clock_timestamp()
      FOR UPDATE`,
    [taskId, leaseToken, leaseFencingToken, workerId]
  );
  if (!result.rows[0]) {
    throw ledgerError('supplier_task_lease_fenced', 'supplier operation requires the current unexpired task lease', {
      collection_task_id: taskId,
      lease_fencing_token: leaseFencingToken,
      worker_id: workerId
    });
  }
  return result.rows[0];
}

async function lockAttemptForLease(client, {
  taskId,
  observationAttemptId,
  leaseToken,
  leaseFencingToken,
  workerId
}) {
  const result = await client.query(
    `SELECT *
       FROM observation_attempts
      WHERE id = $1
        AND collection_task_id = $2
        AND lease_token = $3
        AND lease_fencing_token = $4
        AND lease_owner = $5
      FOR UPDATE`,
    [observationAttemptId, taskId, leaseToken, leaseFencingToken, workerId]
  );
  if (!result.rows[0]) {
    throw ledgerError('supplier_attempt_lease_fenced', 'observation attempt is not bound to the current task lease', {
      collection_task_id: taskId,
      observation_attempt_id: observationAttemptId,
      lease_fencing_token: leaseFencingToken,
      worker_id: workerId
    });
  }
  return result.rows[0];
}

async function assertTaskLeaseStillActive(client, { taskId, leaseToken, leaseFencingToken, workerId }) {
  const result = await client.query(
    `SELECT id
       FROM collection_tasks
      WHERE id = $1
        AND status = 'leased'
        AND lease_token = $2
        AND lease_fencing_token = $3
        AND lease_owner = $4
        AND lease_until > clock_timestamp()`,
    [taskId, leaseToken, leaseFencingToken, workerId]
  );
  if (!result.rows[0]) {
    throw ledgerError('supplier_task_lease_fenced', 'supplier operation crossed the task lease expiry', {
      collection_task_id: taskId,
      lease_fencing_token: leaseFencingToken,
      worker_id: workerId
    });
  }
}

async function findAttemptReservation(client, observationAttemptId) {
  const result = await client.query(
    `SELECT *
       FROM supplier_budget_reservations
      WHERE observation_attempt_id = $1
      FOR UPDATE`,
    [observationAttemptId]
  );
  return result.rows[0] || null;
}

async function lockReservationContext(client, permitId, permitToken) {
  const coordinateResult = await client.query(
    `SELECT observation_attempt_id, budget_scope_id, budget_account_id, supplier
       FROM supplier_budget_reservations
      WHERE permit_id = $1`,
    [permitId]
  );
  const coordinates = coordinateResult.rows[0];
  if (!coordinates) throw ledgerError('supplier_reservation_not_found', `unknown supplier permit: ${permitId}`);

  const attempt = await lockAttempt(client, coordinates.observation_attempt_id);
  const scope = await lockBudgetScope(client, coordinates.budget_scope_id);
  const account = await lockBudgetAccountById(
    client,
    coordinates.budget_account_id,
    coordinates.budget_scope_id,
    coordinates.supplier
  );
  const reservationResult = await client.query(
    `SELECT *
       FROM supplier_budget_reservations
      WHERE permit_id = $1
        AND budget_scope_id = $2
        AND budget_account_id = $3
        AND supplier = $4
      FOR UPDATE`,
    [permitId, scope.id, account.id, account.supplier]
  );
  const reservation = reservationResult.rows[0];
  if (!reservation) throw ledgerError('supplier_reservation_changed', 'supplier reservation identity changed');
  if (reservation.observation_attempt_id !== attempt.id) {
    throw ledgerError('supplier_reservation_changed', 'supplier reservation attempt identity changed');
  }
  assertPermitToken(reservation, permitToken);
  return { attempt, scope, account, reservation };
}

async function lockReservationContextByAttempt(client, observationAttemptId) {
  const coordinateResult = await client.query(
    `SELECT budget_scope_id, budget_account_id, supplier
       FROM supplier_budget_reservations
      WHERE observation_attempt_id = $1`,
    [observationAttemptId]
  );
  const coordinates = coordinateResult.rows[0];
  if (!coordinates) return null;

  const scope = await lockBudgetScope(client, coordinates.budget_scope_id);
  const account = await lockBudgetAccountById(
    client,
    coordinates.budget_account_id,
    coordinates.budget_scope_id,
    coordinates.supplier
  );
  const reservationResult = await client.query(
    `SELECT *
       FROM supplier_budget_reservations
      WHERE observation_attempt_id = $1
        AND budget_scope_id = $2
        AND budget_account_id = $3
        AND supplier = $4
      FOR UPDATE`,
    [observationAttemptId, scope.id, account.id, account.supplier]
  );
  const reservation = reservationResult.rows[0];
  if (!reservation) throw ledgerError('supplier_reservation_changed', 'supplier reservation identity changed');
  return { scope, account, reservation };
}

function assertReservationLeaseBinding(reservation, {
  taskId,
  observationAttemptId,
  leaseFencingToken
}) {
  const matches =
    reservation.collection_task_id === taskId &&
    reservation.observation_attempt_id === observationAttemptId &&
    String(reservation.lease_fencing_token) === String(leaseFencingToken);
  if (!matches) {
    throw ledgerError('supplier_permit_lease_binding_mismatch', 'supplier permit belongs to another task lease', {
      permit_id: reservation.permit_id,
      collection_task_id: taskId,
      observation_attempt_id: observationAttemptId,
      lease_fencing_token: leaseFencingToken
    });
  }
}

function assertReservationTerms(reservation, {
  budgetScopeId,
  taskId,
  observationAttemptId,
  leaseFencingToken,
  supplier,
  transportSupplier,
  maxCostMicroUsd
}) {
  const matches =
    reservation.budget_scope_id === budgetScopeId &&
    reservation.collection_task_id === taskId &&
    reservation.observation_attempt_id === observationAttemptId &&
    String(reservation.lease_fencing_token) === String(leaseFencingToken) &&
    reservation.supplier === supplier &&
    reservation.transport_supplier === transportSupplier &&
    String(reservation.max_cost_micro_usd) === String(maxCostMicroUsd);
  if (!matches) {
    throw ledgerError('supplier_reservation_idempotency_conflict', 'attempt reservation exists with different immutable terms', {
      observation_attempt_id: observationAttemptId,
      existing_reservation_id: reservation.id
    });
  }
}

function reconstructPermitToken(permitKeyring, reservation) {
  const permitToken = deriveSupplierPermitToken({
    permit_keyring: permitKeyring,
    permit_token_key_id: reservation.permit_token_key_id,
    permit_id: reservation.permit_id,
    collection_task_id: reservation.collection_task_id,
    observation_attempt_id: reservation.observation_attempt_id,
    lease_fencing_token: reservation.lease_fencing_token,
    budget_scope_id: reservation.budget_scope_id,
    supplier: reservation.supplier,
    transport_supplier: reservation.transport_supplier,
    max_cost_micro_usd: reservation.max_cost_micro_usd
  });
  assertPermitToken(reservation, permitToken);
  return permitToken;
}

function transportPermit(scope, reservation, permitToken) {
  return Object.freeze({
    version: SUPPLIER_PERMIT_VERSION,
    permit_id: reservation.permit_id,
    permit_token: permitToken,
    permit_token_key_id: reservation.permit_token_key_id,
    scope_id: scope.id,
    budget_approval_id: scope.budget_approval_id,
    collection_task_id: reservation.collection_task_id,
    attempt_id: reservation.observation_attempt_id,
    lease_fencing_token: reservation.lease_fencing_token,
    supplier: reservation.supplier,
    transport_supplier: reservation.transport_supplier,
    max_cost_micro_usd: String(reservation.max_cost_micro_usd),
    reservation_expires_at: reservation.reservation_expires_at,
    status: reservation.status
  });
}

async function lockCostEntry(client, observationAttemptId) {
  const result = await client.query(
    `SELECT *
       FROM supplier_cost_entries
      WHERE observation_attempt_id = $1
        AND allocation_version = 1
      FOR UPDATE`,
    [observationAttemptId]
  );
  return result.rows[0] || null;
}

async function insertCostEntry(client, {
  observationAttemptId,
  supplier,
  costStatus,
  amountMicroUsd,
  reconciliationStatus,
  allocationReason,
  metadataJson
}) {
  const result = await client.query(
    `INSERT INTO supplier_cost_entries (
       observation_attempt_id, supplier, allocation_version, cost_status,
       amount_micro_usd, reconciliation_status, allocation_reason, metadata
     ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      observationAttemptId,
      supplier,
      costStatus,
      amountMicroUsd,
      reconciliationStatus,
      allocationReason,
      metadataJson
    ]
  );
  return result.rows[0];
}

async function recordUnknownCostForContext(client, context, {
  reconciliationDueAt,
  allocationReason,
  metadataJson
}) {
  if (!context.reservation.transport_started_at) {
    throw ledgerError('supplier_transport_not_started', 'unknown supplier cost requires a started transport');
  }
  const existingCost = await lockCostEntry(client, context.reservation.observation_attempt_id);
  if (context.reservation.status === 'reconciliation_pending') {
    if (!existingCost || existingCost.cost_status !== 'unknown' || existingCost.amount_micro_usd !== null) {
      throw ledgerError('supplier_cost_invariant_violation', 'pending reconciliation must have a NULL unknown cost');
    }
    return Object.freeze({
      reservation: context.reservation,
      cost_entry: existingCost,
      idempotent: true
    });
  }
  if (context.reservation.status !== 'transport_started') {
    throw ledgerError('supplier_reservation_not_reconcilable', `reservation is ${context.reservation.status}`);
  }
  if (existingCost) {
    throw ledgerError('supplier_cost_entry_conflict', 'supplier attempt already has a cost entry');
  }

  const reservationResult = await client.query(
    `UPDATE supplier_budget_reservations
        SET status = 'reconciliation_pending',
            actual_cost_micro_usd = NULL,
            reconciliation_due_at = COALESCE($2::timestamptz, NOW() + INTERVAL '24 hours')
      WHERE id = $1
        AND status = 'transport_started'
      RETURNING *`,
    [context.reservation.id, reconciliationDueAt]
  );
  if (!reservationResult.rows[0]) {
    throw ledgerError('supplier_reconciliation_race_lost', 'unknown cost transition lost a reservation race');
  }
  const costEntry = await insertCostEntry(client, {
    observationAttemptId: context.reservation.observation_attempt_id,
    supplier: context.reservation.supplier,
    costStatus: 'unknown',
    amountMicroUsd: null,
    reconciliationStatus: 'pending',
    allocationReason,
    metadataJson
  });
  const attemptResult = await client.query(
    `UPDATE observation_attempts
        SET status = 'reconciliation_pending',
            cost_state = 'unknown',
            actual_cost_micro_usd = NULL,
            reconciliation_status = 'pending',
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [context.reservation.observation_attempt_id]
  );
  if (!attemptResult.rows[0]) {
    throw ledgerError('supplier_attempt_not_found', 'supplier attempt disappeared during reconciliation');
  }
  return Object.freeze({
    reservation: reservationResult.rows[0],
    cost_entry: costEntry,
    attempt: attemptResult.rows[0],
    idempotent: false
  });
}

async function releaseBudgetForContext(client, context, { reason, metadataJson }) {
  const existingCost = await lockCostEntry(client, context.reservation.observation_attempt_id);
  if (context.reservation.status === 'released') {
    if (!existingCost || existingCost.cost_status !== 'actual' || String(existingCost.amount_micro_usd) !== '0') {
      throw ledgerError('supplier_cost_invariant_violation', 'released reservation must have an actual zero cost');
    }
    return Object.freeze({ reservation: context.reservation, cost_entry: existingCost, idempotent: true });
  }
  if (context.reservation.transport_started_at) {
    throw ledgerError(
      'started_supplier_transport_cannot_release',
      'started transport cannot release its reservation; settle or reconcile it'
    );
  }
  if (context.reservation.status !== 'reserved') {
    throw ledgerError('supplier_reservation_not_releasable', `reservation is ${context.reservation.status}`);
  }
  if (existingCost) throw ledgerError('supplier_cost_entry_conflict', 'unstarted reservation already has a cost entry');

  const maxCost = rowBigInt(context.reservation.max_cost_micro_usd, 'reservation.max_cost_micro_usd');
  if (
    rowBigInt(context.scope.total_reserved_micro_usd, 'scope.total_reserved_micro_usd') < maxCost ||
    rowBigInt(context.account.reserved_micro_usd, 'account.reserved_micro_usd') < maxCost
  ) {
    throw ledgerError('supplier_budget_invariant_violation', 'reserved counters are below the permit maximum');
  }
  const scopeResult = await client.query(
    `UPDATE supplier_budget_scopes
        SET total_reserved_micro_usd = total_reserved_micro_usd - $2,
            updated_at = NOW()
      WHERE id = $1
        AND total_reserved_micro_usd >= $2
      RETURNING *`,
    [context.scope.id, maxCost.toString()]
  );
  const accountResult = await client.query(
    `UPDATE supplier_budget_accounts
        SET reserved_micro_usd = reserved_micro_usd - $2,
            updated_at = NOW()
      WHERE id = $1
        AND reserved_micro_usd >= $2
      RETURNING *`,
    [context.account.id, maxCost.toString()]
  );
  if (!scopeResult.rows[0] || !accountResult.rows[0]) {
    throw ledgerError('supplier_release_race_lost', 'supplier release lost a budget counter race');
  }
  const reservationResult = await client.query(
    `UPDATE supplier_budget_reservations
        SET status = 'released',
            actual_cost_micro_usd = 0,
            released_at = NOW(),
            failure_reason = $2
      WHERE id = $1
        AND status = 'reserved'
        AND transport_started_at IS NULL
      RETURNING *`,
    [context.reservation.id, reason]
  );
  if (!reservationResult.rows[0]) {
    throw ledgerError('supplier_release_race_lost', 'supplier release lost a reservation race');
  }
  const costEntry = await insertCostEntry(client, {
    observationAttemptId: context.reservation.observation_attempt_id,
    supplier: context.reservation.supplier,
    costStatus: 'actual',
    amountMicroUsd: '0',
    reconciliationStatus: 'not_required',
    allocationReason: reason,
    metadataJson
  });
  const attemptResult = await client.query(
    `UPDATE observation_attempts
        SET actual_cost_micro_usd = 0,
            cost_state = 'actual',
            reconciliation_status = 'not_required',
            updated_at = NOW()
      WHERE id = $1
        AND transport_started_at IS NULL
      RETURNING *`,
    [context.reservation.observation_attempt_id]
  );
  if (!attemptResult.rows[0]) {
    throw ledgerError('supplier_release_race_lost', 'supplier attempt started transport during release');
  }
  return Object.freeze({
    reservation: reservationResult.rows[0],
    cost_entry: costEntry,
    scope: scopeResult.rows[0],
    account: accountResult.rows[0],
    attempt: attemptResult.rows[0],
    idempotent: false
  });
}

export async function reserveSupplierBudget({
  pool,
  client,
  budget_scope_id,
  collection_task_id,
  observation_attempt_id,
  lease_token,
  lease_fencing_token,
  worker_id,
  supplier,
  transport_supplier,
  max_cost_micro_usd,
  permit_keyring,
  reservation_ttl_seconds = DEFAULT_RESERVATION_TTL_SECONDS,
  metadata = {}
} = {}) {
  const budgetScopeId = nonEmptyString(budget_scope_id, 'budget_scope_id');
  const taskId = nonEmptyString(collection_task_id, 'collection_task_id');
  const observationAttemptId = nonEmptyString(observation_attempt_id, 'observation_attempt_id');
  const leaseToken = nonEmptyString(lease_token, 'lease_token');
  const leaseFencingToken = positiveSafeInteger(lease_fencing_token, 'lease_fencing_token');
  const workerId = nonEmptyString(worker_id, 'worker_id');
  const budgetedSupplier = supplierName(supplier);
  const transportSupplier = nonEmptyString(transport_supplier, 'transport_supplier');
  const maxCost = microUsd(max_cost_micro_usd, 'max_cost_micro_usd', { positive: true });
  const keyring = normalizePermitKeyring(permit_keyring);
  const permitTokenKeyId = keyring.activeKeyId;
  const reservationTtlSeconds = positiveSafeInteger(
    reservation_ttl_seconds,
    'reservation_ttl_seconds',
    MAX_RESERVATION_TTL_SECONDS
  );
  const metadataJson = jsonObject(metadata, 'metadata');
  const permitId = randomUUID();
  const permitToken = deriveSupplierPermitToken({
    permit_keyring,
    permit_token_key_id: permitTokenKeyId,
    permit_id: permitId,
    collection_task_id: taskId,
    observation_attempt_id: observationAttemptId,
    lease_fencing_token: leaseFencingToken,
    budget_scope_id: budgetScopeId,
    supplier: budgetedSupplier,
    transport_supplier: transportSupplier,
    max_cost_micro_usd: maxCost
  });
  const permitTokenHash = hashSupplierPermitToken(permitToken);

  const result = await withTransaction(transactionOptions({ pool, client }), async (tx) => {
    await lockActiveTaskLease(tx, { taskId, leaseToken, leaseFencingToken, workerId });
    const attempt = await lockAttemptForLease(tx, {
      taskId,
      observationAttemptId,
      leaseToken,
      leaseFencingToken,
      workerId
    });
    const scope = await lockBudgetScope(tx, budgetScopeId);
    const account = await lockBudgetAccountBySupplier(tx, budgetScopeId, budgetedSupplier);
    const duplicate = await findAttemptReservation(tx, observationAttemptId);
    await assertTaskLeaseStillActive(tx, { taskId, leaseToken, leaseFencingToken, workerId });

    if (attempt.supplier !== budgetedSupplier) {
      throw ledgerError('supplier_attempt_mismatch', 'observation attempt belongs to another supplier');
    }
    if (attempt.transport_supplier !== transportSupplier) {
      throw ledgerError('supplier_transport_attempt_mismatch', 'observation attempt uses another transport supplier');
    }
    if (duplicate) {
      assertReservationTerms(duplicate, {
        budgetScopeId,
        taskId,
        observationAttemptId,
        leaseFencingToken,
        supplier: budgetedSupplier,
        transportSupplier,
        maxCostMicroUsd: maxCost
      });
      const reconstructedToken = reconstructPermitToken(permit_keyring, duplicate);
      return Object.freeze({
        status: duplicate.status,
        reason: null,
        scope,
        account,
        reservation: duplicate,
        transport_permit: transportPermit(scope, duplicate, reconstructedToken),
        idempotent: true
      });
    }
    if (attempt.status !== 'created') {
      throw ledgerError('supplier_attempt_not_reservable', `observation attempt is ${attempt.status}`);
    }
    assertScopeCanStartTransport(scope);
    if (account.hard_stopped === true) {
      throw ledgerError('supplier_budget_account_hard_stopped', 'supplier budget account is hard stopped');
    }

    const max = BigInt(maxCost);
    const scopeCommitted =
      rowBigInt(scope.total_reserved_micro_usd, 'supplier_budget_scopes.total_reserved_micro_usd') +
      rowBigInt(scope.total_actual_micro_usd, 'supplier_budget_scopes.total_actual_micro_usd');
    const accountCommitted =
      rowBigInt(account.reserved_micro_usd, 'supplier_budget_accounts.reserved_micro_usd') +
      rowBigInt(account.actual_micro_usd, 'supplier_budget_accounts.actual_micro_usd');
    const totalExceeded =
      scopeCommitted + max > rowBigInt(scope.total_cap_micro_usd, 'supplier_budget_scopes.total_cap_micro_usd');
    const supplierExceeded =
      accountCommitted + max > rowBigInt(account.cap_micro_usd, 'supplier_budget_accounts.cap_micro_usd');

    if (totalExceeded || supplierExceeded) {
      const reason = totalExceeded
        ? 'total_budget_cap_would_be_exceeded'
        : `${budgetedSupplier}_budget_cap_would_be_exceeded`;
      const stopped = await hardStopBudget(tx, { scope, account, reason });
      return Object.freeze({
        status: 'hard_stopped',
        reason,
        scope: stopped.scope,
        account: stopped.account,
        reservation: null,
        transport_permit: null,
        idempotent: false
      });
    }

    const scopeUpdate = await tx.query(
      `UPDATE supplier_budget_scopes
          SET total_reserved_micro_usd = total_reserved_micro_usd + $2,
              updated_at = NOW()
        WHERE id = $1
          AND status = 'active'
          AND total_reserved_micro_usd + total_actual_micro_usd + $2 <= total_cap_micro_usd
        RETURNING *`,
      [scope.id, maxCost]
    );
    const accountUpdate = await tx.query(
      `UPDATE supplier_budget_accounts
          SET reserved_micro_usd = reserved_micro_usd + $2,
              updated_at = NOW()
        WHERE id = $1
          AND hard_stopped = FALSE
          AND reserved_micro_usd + actual_micro_usd + $2 <= cap_micro_usd
        RETURNING *`,
      [account.id, maxCost]
    );
    if (!scopeUpdate.rows[0] || !accountUpdate.rows[0]) {
      throw ledgerError('supplier_budget_race_lost', 'supplier reservation lost a budget race');
    }

    const reservationResult = await tx.query(
      `INSERT INTO supplier_budget_reservations (
         permit_id, permit_token_hash, permit_token_key_id,
         budget_scope_id, budget_account_id, collection_task_id,
         lease_fencing_token, observation_attempt_id, supplier, transport_supplier,
         status, max_cost_micro_usd, reservation_expires_at, metadata
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         'reserved', $11, clock_timestamp() + ($12::integer * INTERVAL '1 second'), $13::jsonb
       )
       RETURNING *`,
      [
        permitId,
        permitTokenHash,
        permitTokenKeyId,
        scope.id,
        account.id,
        taskId,
        leaseFencingToken,
        observationAttemptId,
        budgetedSupplier,
        transportSupplier,
        maxCost,
        reservationTtlSeconds,
        metadataJson
      ]
    );
    const reservation = reservationResult.rows[0];
    const attemptUpdate = await tx.query(
      `UPDATE observation_attempts
          SET status = 'cost_reserved',
              updated_at = NOW()
        WHERE id = $1
          AND collection_task_id = $2
          AND status = 'created'
          AND lease_token = $3
          AND lease_fencing_token = $4
          AND lease_owner = $5
        RETURNING *`,
      [observationAttemptId, taskId, leaseToken, leaseFencingToken, workerId]
    );
    if (!attemptUpdate.rows[0]) {
      throw ledgerError('supplier_attempt_reservation_race_lost', 'attempt lost its active lease while reserving budget');
    }

    return Object.freeze({
      status: 'reserved',
      reason: null,
      scope: scopeUpdate.rows[0],
      account: accountUpdate.rows[0],
      reservation,
      transport_permit: transportPermit(scope, reservation, permitToken),
      idempotent: false
    });
  });
  return result;
}

export async function markSupplierTransportStarted({
  pool,
  client,
  permit_id,
  permit_token,
  collection_task_id,
  observation_attempt_id,
  lease_token,
  lease_fencing_token,
  worker_id
} = {}) {
  const permitId = nonEmptyString(permit_id, 'permit_id');
  const permitToken = nonEmptyString(permit_token, 'permit_token');
  const taskId = nonEmptyString(collection_task_id, 'collection_task_id');
  const observationAttemptId = nonEmptyString(observation_attempt_id, 'observation_attempt_id');
  const leaseToken = nonEmptyString(lease_token, 'lease_token');
  const leaseFencingToken = positiveSafeInteger(lease_fencing_token, 'lease_fencing_token');
  const workerId = nonEmptyString(worker_id, 'worker_id');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    await lockActiveTaskLease(tx, { taskId, leaseToken, leaseFencingToken, workerId });
    const attempt = await lockAttemptForLease(tx, {
      taskId,
      observationAttemptId,
      leaseToken,
      leaseFencingToken,
      workerId
    });
    const context = await lockReservationContext(tx, permitId, permitToken);
    assertReservationLeaseBinding(context.reservation, { taskId, observationAttemptId, leaseFencingToken });
    await assertTaskLeaseStillActive(tx, { taskId, leaseToken, leaseFencingToken, workerId });

    if (context.reservation.transport_started_at) {
      if (!attempt.transport_started_at || attempt.status === 'cost_reserved') {
        throw ledgerError('supplier_transport_start_invariant_violation', 'started reservation and attempt disagree');
      }
      return Object.freeze({
        reservation: context.reservation,
        attempt,
        idempotent: true,
        already_started: true
      });
    }
    assertScopeCanStartTransport(context.scope);
    if (context.account.hard_stopped === true) {
      throw ledgerError('supplier_budget_account_hard_stopped', 'supplier budget account is hard stopped');
    }
    if (context.reservation.status !== 'reserved') {
      throw ledgerError('supplier_reservation_not_startable', 'supplier permit is no longer startable', {
        permit_id: permitId,
        reservation_status: context.reservation.status
      });
    }
    if (attempt.status !== 'cost_reserved' || attempt.transport_started_at) {
      throw ledgerError('supplier_attempt_not_startable', `observation attempt is ${attempt.status}`);
    }

    const reservationResult = await tx.query(
      `UPDATE supplier_budget_reservations
          SET status = 'transport_started',
              transport_started_at = clock_timestamp()
        WHERE id = $1
          AND status = 'reserved'
          AND transport_started_at IS NULL
          AND reservation_expires_at > clock_timestamp()
        RETURNING *`,
      [context.reservation.id]
    );
    if (!reservationResult.rows[0]) {
      throw ledgerError('supplier_transport_start_race_lost', 'supplier transport start lost a permit race');
    }
    const attemptResult = await tx.query(
      `UPDATE observation_attempts
          SET status = 'transport_started',
              transport_started_at = COALESCE(transport_started_at, clock_timestamp()),
              updated_at = NOW()
        WHERE id = $1
          AND collection_task_id = $2
          AND status = 'cost_reserved'
          AND transport_started_at IS NULL
          AND lease_token = $3
          AND lease_fencing_token = $4
          AND lease_owner = $5
        RETURNING *`,
      [observationAttemptId, taskId, leaseToken, leaseFencingToken, workerId]
    );
    if (!attemptResult.rows[0]) {
      throw ledgerError('supplier_transport_start_race_lost', 'attempt lost its active lease while starting transport');
    }
    return Object.freeze({
      reservation: reservationResult.rows[0],
      attempt: attemptResult.rows[0],
      idempotent: false,
      already_started: false
    });
  });
}

export async function recordUnknownSupplierCost({
  pool,
  client,
  permit_id,
  permit_token,
  reconciliation_due_at = null,
  allocation_reason = 'supplier_actual_cost_not_yet_available',
  metadata = {}
} = {}) {
  const permitId = nonEmptyString(permit_id, 'permit_id');
  const permitToken = nonEmptyString(permit_token, 'permit_token');
  const metadataJson = jsonObject(metadata, 'metadata');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const context = await lockReservationContext(tx, permitId, permitToken);
    return recordUnknownCostForContext(tx, context, {
      reconciliationDueAt: reconciliation_due_at,
      allocationReason: allocation_reason,
      metadataJson
    });
  });
}

export async function settleSupplierBudget({
  pool,
  client,
  permit_id,
  permit_token,
  actual_cost_micro_usd,
  allocation_reason = 'supplier_actual_cost',
  metadata = {}
} = {}) {
  const permitId = nonEmptyString(permit_id, 'permit_id');
  const permitToken = nonEmptyString(permit_token, 'permit_token');
  const actualCost = microUsd(actual_cost_micro_usd, 'actual_cost_micro_usd');
  const metadataJson = jsonObject(metadata, 'metadata');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const context = await lockReservationContext(tx, permitId, permitToken);
    if (!context.reservation.transport_started_at) {
      throw ledgerError('supplier_transport_not_started', 'supplier cost cannot settle before transport starts');
    }
    const existingCost = await lockCostEntry(tx, context.reservation.observation_attempt_id);
    if (['settled', 'overrun_hard_stopped'].includes(context.reservation.status)) {
      if (String(context.reservation.actual_cost_micro_usd) !== actualCost) {
        throw ledgerError('supplier_settlement_conflict', 'supplier permit was settled with a different actual cost');
      }
      if (!existingCost || existingCost.cost_status !== 'actual' || String(existingCost.amount_micro_usd) !== actualCost) {
        throw ledgerError('supplier_cost_invariant_violation', 'settled reservation is missing its actual cost entry');
      }
      return Object.freeze({
        reservation: context.reservation,
        cost_entry: existingCost,
        idempotent: true,
        overrun: context.reservation.status === 'overrun_hard_stopped'
      });
    }
    if (!['transport_started', 'reconciliation_pending'].includes(context.reservation.status)) {
      throw ledgerError('supplier_reservation_not_settleable', `reservation is ${context.reservation.status}`);
    }
    if (existingCost && existingCost.cost_status !== 'unknown') {
      throw ledgerError('supplier_cost_entry_conflict', 'supplier attempt already has a non-unknown cost entry');
    }

    const maxCost = rowBigInt(context.reservation.max_cost_micro_usd, 'reservation.max_cost_micro_usd');
    const actual = BigInt(actualCost);
    if (
      rowBigInt(context.scope.total_reserved_micro_usd, 'scope.total_reserved_micro_usd') < maxCost ||
      rowBigInt(context.account.reserved_micro_usd, 'account.reserved_micro_usd') < maxCost
    ) {
      throw ledgerError('supplier_budget_invariant_violation', 'reserved counters are below the permit maximum');
    }
    const overrun = actual > maxCost;
    const overrunReason = overrun ? 'actual_cost_exceeded_reserved_maximum' : null;

    const scopeResult = await tx.query(
      `UPDATE supplier_budget_scopes
          SET total_reserved_micro_usd = total_reserved_micro_usd - $2,
              total_actual_micro_usd = total_actual_micro_usd + $3,
              status = CASE WHEN $4 THEN 'hard_stopped' ELSE status END,
              stop_reason = CASE WHEN $4 THEN $5 ELSE stop_reason END,
              hard_stopped_at = CASE WHEN $4 THEN COALESCE(hard_stopped_at, NOW()) ELSE hard_stopped_at END,
              updated_at = NOW()
        WHERE id = $1
          AND total_reserved_micro_usd >= $2
        RETURNING *`,
      [context.scope.id, maxCost.toString(), actualCost, overrun, overrunReason]
    );
    const accountResult = await tx.query(
      `UPDATE supplier_budget_accounts
          SET reserved_micro_usd = reserved_micro_usd - $2,
              actual_micro_usd = actual_micro_usd + $3,
              hard_stopped = CASE WHEN $4 THEN TRUE ELSE hard_stopped END,
              stop_reason = CASE WHEN $4 THEN $5 ELSE stop_reason END,
              updated_at = NOW()
        WHERE id = $1
          AND reserved_micro_usd >= $2
        RETURNING *`,
      [context.account.id, maxCost.toString(), actualCost, overrun, overrunReason]
    );
    if (!scopeResult.rows[0] || !accountResult.rows[0]) {
      throw ledgerError('supplier_settlement_race_lost', 'supplier settlement lost a budget counter race');
    }

    const reservationResult = await tx.query(
      `UPDATE supplier_budget_reservations
          SET status = $2,
              actual_cost_micro_usd = $3,
              settled_at = NOW(),
              failure_reason = CASE WHEN $4 THEN $5 ELSE failure_reason END
        WHERE id = $1
          AND status IN ('transport_started', 'reconciliation_pending')
        RETURNING *`,
      [
        context.reservation.id,
        overrun ? 'overrun_hard_stopped' : 'settled',
        actualCost,
        overrun,
        overrunReason
      ]
    );
    if (!reservationResult.rows[0]) {
      throw ledgerError('supplier_settlement_race_lost', 'supplier settlement lost a reservation race');
    }

    let costEntry;
    if (existingCost) {
      const costResult = await tx.query(
        `UPDATE supplier_cost_entries
            SET cost_status = 'actual',
                amount_micro_usd = $2,
                reconciliation_status = 'reconciled',
                allocation_reason = $3,
                metadata = metadata || $4::jsonb,
                updated_at = NOW()
          WHERE id = $1
            AND cost_status = 'unknown'
            AND amount_micro_usd IS NULL
          RETURNING *`,
        [existingCost.id, actualCost, allocation_reason, metadataJson]
      );
      costEntry = costResult.rows[0];
    } else {
      costEntry = await insertCostEntry(tx, {
        observationAttemptId: context.reservation.observation_attempt_id,
        supplier: context.reservation.supplier,
        costStatus: 'actual',
        amountMicroUsd: actualCost,
        reconciliationStatus: 'reconciled',
        allocationReason: allocation_reason,
        metadataJson
      });
    }
    if (!costEntry) throw ledgerError('supplier_cost_race_lost', 'supplier cost write lost a reconciliation race');

    await tx.query(
      `UPDATE observation_attempts
          SET actual_cost_micro_usd = $2,
              cost_state = 'actual',
              reconciliation_status = 'reconciled',
              updated_at = NOW()
        WHERE id = $1`,
      [context.reservation.observation_attempt_id, actualCost]
    );
    return Object.freeze({
      reservation: reservationResult.rows[0],
      cost_entry: costEntry,
      scope: scopeResult.rows[0],
      account: accountResult.rows[0],
      idempotent: false,
      overrun
    });
  });
}

export async function releaseSupplierBudget({
  pool,
  client,
  permit_id,
  permit_token,
  reason = 'transport_not_started',
  metadata = {}
} = {}) {
  const permitId = nonEmptyString(permit_id, 'permit_id');
  const permitToken = nonEmptyString(permit_token, 'permit_token');
  const metadataJson = jsonObject(metadata, 'metadata');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const context = await lockReservationContext(tx, permitId, permitToken);
    return releaseBudgetForContext(tx, context, { reason, metadataJson });
  });
}

/**
 * Independently expire permits that were reserved but never durably started.
 *
 * The candidate query locks the collection task first.  The remaining locks
 * follow the same order as transport start (task -> attempt -> scope ->
 * account -> reservation), so a start and expiry sweep cannot both win.
 * This intentionally does not wait for the collection-task lease to expire.
 */
export async function sweepExpiredSupplierReservations({
  pool,
  client,
  actor = 'supplier-permit-expiry-sweeper',
  limit = 100
} = {}) {
  const sweepActor = nonEmptyString(actor, 'actor');
  const sweepLimit = positiveSafeInteger(limit, 'limit', 1000);

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const candidates = await tx.query(
      `SELECT reservation.collection_task_id,
              reservation.observation_attempt_id
         FROM supplier_budget_reservations AS reservation
         JOIN collection_tasks AS task ON task.id = reservation.collection_task_id
        WHERE reservation.status = 'reserved'
          AND reservation.transport_started_at IS NULL
          AND reservation.reservation_expires_at <= clock_timestamp()
        ORDER BY reservation.reservation_expires_at, reservation.id
        FOR UPDATE OF task SKIP LOCKED
        LIMIT $1`,
      [sweepLimit]
    );

    const decisions = [];
    for (const candidate of candidates.rows) {
      const attempt = await lockAttempt(tx, candidate.observation_attempt_id);
      if (attempt.collection_task_id !== candidate.collection_task_id) {
        throw ledgerError('supplier_reservation_task_mismatch', 'expired permit attempt belongs to another task');
      }
      const context = await lockReservationContextByAttempt(tx, candidate.observation_attempt_id);
      if (!context) {
        decisions.push(Object.freeze({
          observation_attempt_id: candidate.observation_attempt_id,
          status: 'no_reservation'
        }));
        continue;
      }
      if (context.reservation.collection_task_id !== candidate.collection_task_id) {
        throw ledgerError('supplier_reservation_task_mismatch', 'expired permit reservation belongs to another task');
      }

      const stillExpired = await tx.query(
        `SELECT id
           FROM supplier_budget_reservations
          WHERE id = $1
            AND status = 'reserved'
            AND transport_started_at IS NULL
            AND reservation_expires_at <= clock_timestamp()`,
        [context.reservation.id]
      );
      if (!stillExpired.rows[0]) {
        decisions.push(Object.freeze({
          permit_id: context.reservation.permit_id,
          observation_attempt_id: attempt.id,
          status: 'start_or_renewal_won'
        }));
        continue;
      }
      if (attempt.transport_started_at || attempt.status !== 'cost_reserved') {
        throw ledgerError(
          'supplier_permit_expiry_invariant_violation',
          `expired unstarted permit has observation attempt status ${attempt.status}`
        );
      }

      const released = await releaseBudgetForContext(tx, context, {
        reason: 'supplier_permit_expired_before_transport',
        metadataJson: jsonObject({
          actor: sweepActor,
          permit_id: context.reservation.permit_id,
          reservation_expires_at: context.reservation.reservation_expires_at
        }, 'metadata')
      });
      const failedAttempt = await tx.query(
        `UPDATE observation_attempts
            SET status = 'failed',
                finished_at = COALESCE(finished_at, NOW()),
                error_taxonomy = 'supplier_permit_expired',
                error_code = 'supplier_permit_expired_before_transport',
                error_details = error_details || $2::jsonb,
                updated_at = NOW()
          WHERE id = $1
            AND status = 'cost_reserved'
            AND transport_started_at IS NULL
          RETURNING *`,
        [
          attempt.id,
          JSON.stringify({
            actor: sweepActor,
            permit_id: context.reservation.permit_id,
            reservation_expires_at: context.reservation.reservation_expires_at
          })
        ]
      );
      if (!failedAttempt.rows[0]) {
        throw ledgerError('supplier_permit_expiry_race_lost', 'expired permit attempt started during release');
      }
      decisions.push(Object.freeze({
        permit_id: released.reservation.permit_id,
        observation_attempt_id: attempt.id,
        collection_task_id: candidate.collection_task_id,
        status: 'released',
        actual_cost_micro_usd: '0'
      }));
    }
    return Object.freeze(decisions);
  });
}

/**
 * Sweeper-only recovery for a worker that died after reserving budget but
 * before durable transport start. The caller must run this in the same outer
 * transaction that fences the expired task lease.
 */
export async function releaseUnstartedSupplierReservationForAttempt({
  pool,
  client,
  observation_attempt_id,
  reason = 'worker_crash_before_transport',
  metadata = {}
} = {}) {
  const observationAttemptId = nonEmptyString(observation_attempt_id, 'observation_attempt_id');
  const releaseReason = nonEmptyString(reason, 'reason');
  const metadataJson = jsonObject(metadata, 'metadata');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const attempt = await lockAttempt(tx, observationAttemptId);
    const context = await lockReservationContextByAttempt(tx, observationAttemptId);
    if (!context) {
      return Object.freeze({ status: 'no_reservation', attempt, idempotent: true });
    }
    if (context.reservation.collection_task_id !== attempt.collection_task_id) {
      throw ledgerError('supplier_reservation_task_mismatch', 'supplier reservation belongs to another task');
    }
    if (attempt.transport_started_at || context.reservation.transport_started_at) {
      throw ledgerError(
        'supplier_transport_outcome_unknown',
        'started transport cannot use the pre-transport crash recovery path'
      );
    }
    const released = await releaseBudgetForContext(tx, context, {
      reason: releaseReason,
      metadataJson
    });
    return Object.freeze({ status: 'released', ...released });
  });
}

/**
 * Sweeper-only recovery for an expired lease after durable transport start.
 * It preserves the full reservation until provider billing can be reconciled.
 */
export async function markPostStartSupplierReservationUnknownForAttempt({
  pool,
  client,
  observation_attempt_id,
  reconciliation_due_at = null,
  allocation_reason = 'worker_crash_after_transport_started',
  metadata = {}
} = {}) {
  const observationAttemptId = nonEmptyString(observation_attempt_id, 'observation_attempt_id');
  const allocationReason = nonEmptyString(allocation_reason, 'allocation_reason');
  const metadataJson = jsonObject(metadata, 'metadata');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const attempt = await lockAttempt(tx, observationAttemptId);
    const context = await lockReservationContextByAttempt(tx, observationAttemptId);
    if (!context) {
      return Object.freeze({ status: 'no_reservation', attempt, idempotent: true });
    }
    if (context.reservation.collection_task_id !== attempt.collection_task_id) {
      throw ledgerError('supplier_reservation_task_mismatch', 'supplier reservation belongs to another task');
    }
    if (!attempt.transport_started_at || !context.reservation.transport_started_at) {
      throw ledgerError(
        'supplier_transport_not_started',
        'post-transport crash recovery requires matching durable start timestamps'
      );
    }
    const pending = await recordUnknownCostForContext(tx, context, {
      reconciliationDueAt: reconciliation_due_at,
      allocationReason,
      metadataJson
    });
    return Object.freeze({ status: 'reconciliation_pending', ...pending });
  });
}

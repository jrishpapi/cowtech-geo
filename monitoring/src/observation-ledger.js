import { ledgerError, withTransaction } from './db-transaction.js';

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return value;
}

function jsonObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  return JSON.stringify(value);
}

function rowInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw ledgerError('invalid_ledger_row', `${name} is not a safe integer`);
  return parsed;
}

function transactionOptions({ pool, client }) {
  return client ? { client } : pool ? { pool } : {};
}

async function lockCreditAccount(client, creditAccountId) {
  const result = await client.query(
    `SELECT *
       FROM observation_credit_accounts
      WHERE id = $1
      FOR UPDATE`,
    [creditAccountId]
  );
  if (!result.rows[0]) {
    throw ledgerError('credit_account_not_found', `observation credit account not found: ${creditAccountId}`);
  }
  return result.rows[0];
}

async function lockDemand(client, observationDemandId) {
  const result = await client.query(
    `SELECT *
       FROM observation_demands
      WHERE id = $1
      FOR UPDATE`,
    [observationDemandId]
  );
  if (!result.rows[0]) {
    throw ledgerError('observation_demand_not_found', `observation demand not found: ${observationDemandId}`);
  }
  return result.rows[0];
}

async function findEntryByIdempotencyKey(client, idempotencyKey) {
  const result = await client.query(
    `SELECT *
       FROM observation_credit_entries
      WHERE idempotency_key = $1
      FOR UPDATE`,
    [idempotencyKey]
  );
  return result.rows[0] || null;
}

async function findDemandEntry(client, observationDemandId, entryType) {
  const result = await client.query(
    `SELECT *
       FROM observation_credit_entries
      WHERE observation_demand_id = $1
        AND entry_type = $2
      FOR UPDATE`,
    [observationDemandId, entryType]
  );
  return result.rows[0] || null;
}

function assertDemandAccount(demand, creditAccountId, units) {
  if (demand.credit_account_id !== creditAccountId) {
    throw ledgerError('credit_account_mismatch', 'observation demand belongs to a different credit account', {
      observation_demand_id: demand.id,
      expected_credit_account_id: creditAccountId,
      actual_credit_account_id: demand.credit_account_id
    });
  }
  if (rowInteger(demand.credit_units, 'observation_demands.credit_units') !== units) {
    throw ledgerError('credit_units_mismatch', 'credit units do not match the observation demand');
  }
}

function assertEntryMatch(entry, { creditAccountId, observationDemandId, entryType, units }) {
  const matches =
    entry.credit_account_id === creditAccountId &&
    entry.observation_demand_id === observationDemandId &&
    entry.entry_type === entryType &&
    rowInteger(entry.units, 'observation_credit_entries.units') === units;
  if (!matches) {
    throw ledgerError('credit_idempotency_conflict', 'credit idempotency key was already used for another transition', {
      idempotency_key: entry.idempotency_key,
      existing_entry_id: entry.id
    });
  }
}

function accountCapacity(account) {
  return {
    limit: rowInteger(account.limit_units, 'observation_credit_accounts.limit_units'),
    reserved: rowInteger(account.reserved_units, 'observation_credit_accounts.reserved_units'),
    settled: rowInteger(account.settled_units, 'observation_credit_accounts.settled_units')
  };
}

export async function ensureObservationCreditAccount({
  pool,
  client,
  customer_id,
  contract_version,
  entitlement_key,
  surface_key,
  credit_class = 'base',
  cycle_start,
  cycle_end,
  limit_units,
  entitlement_snapshot
} = {}) {
  const customerId = nonEmptyString(customer_id, 'customer_id');
  const contractVersion = nonEmptyString(contract_version, 'contract_version');
  const entitlementKey = nonEmptyString(entitlement_key, 'entitlement_key');
  const surfaceKey = nonEmptyString(surface_key, 'surface_key');
  const creditClass = nonEmptyString(credit_class, 'credit_class');
  const cycleStart = nonEmptyString(cycle_start, 'cycle_start');
  const cycleEnd = nonEmptyString(cycle_end, 'cycle_end');
  const limitUnits = nonNegativeInteger(limit_units, 'limit_units');
  const entitlementSnapshotJson = jsonObject(entitlement_snapshot, 'entitlement_snapshot');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const inserted = await tx.query(
      `INSERT INTO observation_credit_accounts (
         customer_id, contract_version, entitlement_key, surface_key,
         credit_class, cycle_start, cycle_end, limit_units, entitlement_snapshot, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
         CASE WHEN $8 = 0 THEN 'exhausted' ELSE 'active' END
       )
       ON CONFLICT (
         customer_id, contract_version, entitlement_key, surface_key,
         credit_class, cycle_start, cycle_end
       ) DO NOTHING
       RETURNING *`,
      [
        customerId,
        contractVersion,
        entitlementKey,
        surfaceKey,
        creditClass,
        cycleStart,
        cycleEnd,
        limitUnits,
        entitlementSnapshotJson
      ]
    );
    if (inserted.rows[0]) return Object.freeze({ account: inserted.rows[0], idempotent: false });

    const existing = await tx.query(
      `SELECT *,
              limit_units = $8 AS limit_matches,
              entitlement_snapshot = $9::jsonb AS snapshot_matches
         FROM observation_credit_accounts
        WHERE customer_id = $1
          AND contract_version = $2
          AND entitlement_key = $3
          AND surface_key = $4
          AND credit_class = $5
          AND cycle_start = $6
          AND cycle_end = $7
        FOR UPDATE`,
      [
        customerId,
        contractVersion,
        entitlementKey,
        surfaceKey,
        creditClass,
        cycleStart,
        cycleEnd,
        limitUnits,
        entitlementSnapshotJson
      ]
    );
    const account = existing.rows[0];
    if (!account) throw ledgerError('credit_account_upsert_failed', 'credit account conflict row disappeared');
    if (account.limit_matches !== true || account.snapshot_matches !== true) {
      throw ledgerError(
        'credit_account_idempotency_conflict',
        'credit account entitlement identity already exists with different immutable terms',
        { credit_account_id: account.id }
      );
    }
    delete account.limit_matches;
    delete account.snapshot_matches;
    return Object.freeze({ account, idempotent: true });
  });
}

export async function reserveObservationCredit({
  pool,
  client,
  credit_account_id,
  observation_demand_id,
  units = 1,
  idempotency_key,
  reason = 'observation_demand_reserved',
  metadata = {}
} = {}) {
  const creditAccountId = nonEmptyString(credit_account_id, 'credit_account_id');
  const observationDemandId = nonEmptyString(observation_demand_id, 'observation_demand_id');
  const creditUnits = positiveInteger(units, 'units');
  const idempotencyKey = nonEmptyString(idempotency_key, 'idempotency_key');
  const metadataJson = jsonObject(metadata, 'metadata');

  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const account = await lockCreditAccount(tx, creditAccountId);
    const demand = await lockDemand(tx, observationDemandId);
    assertDemandAccount(demand, creditAccountId, creditUnits);

    const idempotentEntry = await findEntryByIdempotencyKey(tx, idempotencyKey);
    if (idempotentEntry) {
      assertEntryMatch(idempotentEntry, {
        creditAccountId,
        observationDemandId,
        entryType: 'reserve',
        units: creditUnits
      });
      return Object.freeze({ account, demand, entry: idempotentEntry, idempotent: true });
    }

    const conflictingEntry = await findDemandEntry(tx, observationDemandId, 'reserve');
    if (conflictingEntry) {
      throw ledgerError('credit_transition_conflict', 'observation demand already has a reserve entry', {
        observation_demand_id: observationDemandId,
        existing_entry_id: conflictingEntry.id
      });
    }
    if (demand.credit_state !== 'reserved') {
      throw ledgerError('credit_state_conflict', `cannot reserve credit from state ${demand.credit_state}`);
    }
    if (account.status !== 'active') {
      throw ledgerError('credit_account_not_active', `credit account is ${account.status}`);
    }
    const capacity = accountCapacity(account);
    if (capacity.reserved + capacity.settled + creditUnits > capacity.limit) {
      throw ledgerError('observation_credit_quota_exceeded', 'observation credit quota would be exceeded', {
        credit_account_id: creditAccountId,
        requested_units: creditUnits,
        available_units: Math.max(0, capacity.limit - capacity.reserved - capacity.settled)
      });
    }

    const accountUpdate = await tx.query(
      `UPDATE observation_credit_accounts
          SET reserved_units = reserved_units + $2,
              status = CASE
                WHEN reserved_units + settled_units + $2 >= limit_units THEN 'exhausted'
                ELSE 'active'
              END,
              updated_at = NOW()
        WHERE id = $1
          AND status = 'active'
          AND reserved_units + settled_units + $2 <= limit_units
        RETURNING *`,
      [creditAccountId, creditUnits]
    );
    if (!accountUpdate.rows[0]) {
      throw ledgerError('observation_credit_quota_race_lost', 'credit reservation lost a quota race');
    }

    const entryResult = await tx.query(
      `INSERT INTO observation_credit_entries (
         credit_account_id, observation_demand_id, entry_type, units,
         from_state, to_state, idempotency_key, reason, metadata
       ) VALUES ($1, $2, 'reserve', $3, NULL, 'reserved', $4, $5, $6::jsonb)
       RETURNING *`,
      [creditAccountId, observationDemandId, creditUnits, idempotencyKey, reason, metadataJson]
    );
    return Object.freeze({
      account: accountUpdate.rows[0],
      demand,
      entry: entryResult.rows[0],
      idempotent: false
    });
  });
}

async function transitionObservationCredit({
  pool,
  client,
  creditAccountId,
  observationDemandId,
  units,
  idempotencyKey,
  entryType,
  toState,
  terminalResultId,
  evidenceManifestId,
  reason,
  metadataJson
}) {
  return withTransaction(transactionOptions({ pool, client }), async (tx) => {
    const account = await lockCreditAccount(tx, creditAccountId);
    const demand = await lockDemand(tx, observationDemandId);
    assertDemandAccount(demand, creditAccountId, units);

    const idempotentEntry = await findEntryByIdempotencyKey(tx, idempotencyKey);
    if (idempotentEntry) {
      assertEntryMatch(idempotentEntry, {
        creditAccountId,
        observationDemandId,
        entryType,
        units
      });
      const terminalMatches =
        demand.credit_state === toState &&
        demand.terminal_result_id === terminalResultId &&
        (toState !== 'settled' || demand.settlement_evidence_manifest_id === evidenceManifestId);
      if (!terminalMatches) {
        throw ledgerError('credit_idempotency_conflict', 'credit transition payload differs from its committed state');
      }
      return Object.freeze({ account, demand, entry: idempotentEntry, idempotent: true });
    }

    const conflictingEntry = await findDemandEntry(tx, observationDemandId, entryType);
    if (conflictingEntry) {
      throw ledgerError('credit_transition_conflict', `observation demand already has a ${entryType} entry`, {
        observation_demand_id: observationDemandId,
        existing_entry_id: conflictingEntry.id
      });
    }
    if (demand.credit_state !== 'reserved') {
      throw ledgerError('credit_state_conflict', `cannot ${entryType} credit from state ${demand.credit_state}`);
    }
    const reserveEntry = await findDemandEntry(tx, observationDemandId, 'reserve');
    if (!reserveEntry) {
      throw ledgerError('credit_reservation_missing', 'credit cannot transition without a reserve entry');
    }
    if (rowInteger(account.reserved_units, 'observation_credit_accounts.reserved_units') < units) {
      throw ledgerError('credit_account_invariant_violation', 'credit account has fewer reserved units than demand');
    }

    const demandUpdate = await tx.query(
      `UPDATE observation_demands
          SET credit_state = $2,
              credit_settled_at = CASE WHEN $2 = 'settled' THEN NOW() ELSE NULL END,
              credit_released_at = CASE WHEN $2 = 'released' THEN NOW() ELSE NULL END,
              credit_terminal_reason = $3,
              terminal_result_id = $4,
              settlement_evidence_manifest_id = $5,
              updated_at = NOW()
        WHERE id = $1
          AND credit_state = 'reserved'
        RETURNING *`,
      [observationDemandId, toState, reason, terminalResultId, evidenceManifestId]
    );
    if (!demandUpdate.rows[0]) {
      throw ledgerError('credit_state_race_lost', 'credit transition lost a demand state race');
    }

    const accountUpdate = await tx.query(
      `UPDATE observation_credit_accounts
          SET reserved_units = reserved_units - $2,
              settled_units = settled_units + CASE WHEN $3 = 'settled' THEN $2 ELSE 0 END,
              released_units = released_units + CASE WHEN $3 = 'released' THEN $2 ELSE 0 END,
              status = CASE
                WHEN status = 'closed' THEN 'closed'
                WHEN reserved_units - $2
                     + settled_units
                     + CASE WHEN $3 = 'settled' THEN $2 ELSE 0 END >= limit_units
                  THEN 'exhausted'
                ELSE 'active'
              END,
              updated_at = NOW()
        WHERE id = $1
          AND reserved_units >= $2
        RETURNING *`,
      [creditAccountId, units, toState]
    );
    if (!accountUpdate.rows[0]) {
      throw ledgerError('credit_account_race_lost', 'credit transition lost an account state race');
    }

    const entryResult = await tx.query(
      `INSERT INTO observation_credit_entries (
         credit_account_id, observation_demand_id, entry_type, units,
         from_state, to_state, idempotency_key, reason, metadata
       ) VALUES ($1, $2, $3, $4, 'reserved', $5, $6, $7, $8::jsonb)
       RETURNING *`,
      [
        creditAccountId,
        observationDemandId,
        entryType,
        units,
        toState,
        idempotencyKey,
        reason,
        metadataJson
      ]
    );
    return Object.freeze({
      account: accountUpdate.rows[0],
      demand: demandUpdate.rows[0],
      entry: entryResult.rows[0],
      idempotent: false
    });
  });
}

export async function settleObservationCredit({
  pool,
  client,
  credit_account_id,
  observation_demand_id,
  units = 1,
  terminal_result_id,
  evidence_manifest_id,
  idempotency_key,
  reason = 'native_valid_observation',
  metadata = {}
} = {}) {
  return transitionObservationCredit({
    pool,
    client,
    creditAccountId: nonEmptyString(credit_account_id, 'credit_account_id'),
    observationDemandId: nonEmptyString(observation_demand_id, 'observation_demand_id'),
    units: positiveInteger(units, 'units'),
    terminalResultId: nonEmptyString(terminal_result_id, 'terminal_result_id'),
    evidenceManifestId: nonEmptyString(evidence_manifest_id, 'evidence_manifest_id'),
    idempotencyKey: nonEmptyString(idempotency_key, 'idempotency_key'),
    entryType: 'settle',
    toState: 'settled',
    reason,
    metadataJson: jsonObject(metadata, 'metadata')
  });
}

export async function releaseObservationCredit({
  pool,
  client,
  credit_account_id,
  observation_demand_id,
  units = 1,
  terminal_result_id,
  idempotency_key,
  reason = 'no_valid_native_observation',
  metadata = {}
} = {}) {
  return transitionObservationCredit({
    pool,
    client,
    creditAccountId: nonEmptyString(credit_account_id, 'credit_account_id'),
    observationDemandId: nonEmptyString(observation_demand_id, 'observation_demand_id'),
    units: positiveInteger(units, 'units'),
    terminalResultId: nonEmptyString(terminal_result_id, 'terminal_result_id'),
    evidenceManifestId: null,
    idempotencyKey: nonEmptyString(idempotency_key, 'idempotency_key'),
    entryType: 'release',
    toState: 'released',
    reason,
    metadataJson: jsonObject(metadata, 'metadata')
  });
}

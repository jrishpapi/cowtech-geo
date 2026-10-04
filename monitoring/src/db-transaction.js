import { pool as defaultPool } from './db.js';

const ISOLATION_LEVELS = Object.freeze({
  'read committed': 'READ COMMITTED',
  'repeatable read': 'REPEATABLE READ',
  serializable: 'SERIALIZABLE'
});
const RETRYABLE_TRANSACTION_CODES = new Set(['40001', '40P01']);

export class LedgerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LedgerError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
export function ledgerError(code, message, details = {}) {
  return new LedgerError(code, message, details);
}

function assertQueryClient(client, name) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError(`${name} must expose query(sql, params)`);
  }
  return client;
}

function normalizeIsolationLevel(value) {
  const normalized = String(value || 'serializable').trim().toLowerCase();
  const isolationLevel = ISOLATION_LEVELS[normalized];
  if (!isolationLevel) throw new RangeError(`unsupported transaction isolation level: ${value}`);
  return isolationLevel;
}

/**
 * Run work on one PostgreSQL client.
 *
 * Supplying `client` joins the caller-owned transaction and deliberately does
 * not issue BEGIN/COMMIT. Supplying `pool` (or neither option) acquires a client
 * and owns a SERIALIZABLE transaction. This lets fan-out create a demand and
 * reserve its credit in the same outer transaction without nested BEGIN calls.
 */
export async function withTransaction(options = {}, work) {
  if (typeof work !== 'function') throw new TypeError('transaction work must be a function');
  if (options.client && options.pool) throw new TypeError('provide either pool or client, not both');

  if (options.client) {
    return work(assertQueryClient(options.client, 'client'));
  }

  const selectedPool = options.pool || defaultPool;
  if (!selectedPool || typeof selectedPool.connect !== 'function') {
    throw new TypeError('pool must expose connect()');
  }

  const isolationLevel = normalizeIsolationLevel(options.isolationLevel);
  const maxRetries = options.maxRetries === undefined ? 2 : options.maxRetries;
  if (!Number.isSafeInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) {
    throw new RangeError('maxRetries must be an integer between 0 and 5');
  }

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const client = assertQueryClient(await selectedPool.connect(), 'connected client');
    let began = false;
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      began = true;
      const result = await work(client);
      await client.query('COMMIT');
      began = false;
      return result;
    } catch (error) {
      if (began) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          Object.defineProperty(error, 'rollbackError', {
            configurable: true,
            enumerable: false,
            value: rollbackError
          });
        }
      }
      if (!RETRYABLE_TRANSACTION_CODES.has(error?.code) || attempt === maxRetries || error.rollbackError) {
        throw error;
      }
    } finally {
      if (typeof client.release === 'function') client.release();
    }
  }

  throw new Error('transaction retry loop exhausted unexpectedly');
}

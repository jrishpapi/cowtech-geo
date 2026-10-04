import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { pool } from './db.js';

const HASH_ALGORITHM = 'pbkdf2_sha256';
const HASH_ITERATIONS = 210000;
const HASH_KEY_LENGTH = 32;
const VALID_ROLES = new Set(['viewer', 'operator', 'admin']);

function normalizeRole(role) {
  return VALID_ROLES.has(role) ? role : 'viewer';
}

function assertRole(role) {
  if (!VALID_ROLES.has(role)) {
    const error = new Error(`Invalid internal admin role: ${role}`);
    error.code = 'invalid_internal_admin_role';
    throw error;
  }
}

function assertUsername(username) {
  const normalized = String(username || '').trim();
  if (!normalized) {
    const error = new Error('Internal admin username is required.');
    error.code = 'internal_admin_username_required';
    throw error;
  }
  return normalized;
}

function assertPassword(password) {
  const normalized = String(password || '');
  if (normalized.length < 8) {
    const error = new Error('Internal admin password must be at least 8 characters.');
    error.code = 'internal_admin_password_too_short';
    throw error;
  }
  return normalized;
}

function normalizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    role: normalizeRole(row.role),
    display_name: row.display_name || row.username,
    disabled_at: row.disabled_at || null,
    last_login_at: row.last_login_at || null
  };
}

export function hashInternalAdminPassword(password, salt = randomBytes(16).toString('base64url')) {
  const hash = pbkdf2Sync(String(password), salt, HASH_ITERATIONS, HASH_KEY_LENGTH, 'sha256').toString('base64url');
  return `${HASH_ALGORITHM}$${HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyInternalAdminPassword(password, encodedHash) {
  const [algorithm, iterationsRaw, salt, expectedHash] = String(encodedHash || '').split('$');
  const iterations = Number.parseInt(iterationsRaw, 10);
  if (algorithm !== HASH_ALGORITHM || !iterations || !salt || !expectedHash) return false;
  const actualHash = pbkdf2Sync(String(password), salt, iterations, HASH_KEY_LENGTH, 'sha256');
  const expected = Buffer.from(expectedHash, 'base64url');
  if (actualHash.length !== expected.length) return false;
  return timingSafeEqual(actualHash, expected);
}

export function parseInternalAdminBootstrapUsers(rawUsers = '') {
  if (!rawUsers) return [];
  try {
    const parsed = JSON.parse(rawUsers);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((user) => ({
        username: String(user.username || '').trim(),
        password: String(user.password || ''),
        role: normalizeRole(user.role),
        display_name: String(user.display_name || user.username || '').trim()
      }))
      .filter((user) => user.username && user.password);
  } catch {
    return [];
  }
}

export async function getInternalAdminUserByUsername(username, client = pool) {
  const result = await client.query(
    `SELECT id, username, password_hash, role, display_name, disabled_at, last_login_at
     FROM internal_admin_users
     WHERE username = $1`,
    [username]
  );
  return normalizeUser(result.rows[0]);
}

export async function listInternalAdminUsers(client = pool) {
  const result = await client.query(
    `SELECT id, username, password_hash, role, display_name, disabled_at, last_login_at
     FROM internal_admin_users
     ORDER BY username ASC`
  );
  return result.rows.map(normalizeUser);
}

export async function createInternalAdminUser(
  { username, password, role = 'viewer', display_name: displayName },
  client = pool
) {
  const normalizedUsername = assertUsername(username);
  const normalizedRole = String(role || 'viewer');
  assertRole(normalizedRole);
  const passwordHash = hashInternalAdminPassword(assertPassword(password));
  const result = await client.query(
    `INSERT INTO internal_admin_users (username, password_hash, role, display_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO NOTHING
     RETURNING id, username, password_hash, role, display_name, disabled_at, last_login_at`,
    [normalizedUsername, passwordHash, normalizedRole, String(displayName || normalizedUsername).trim() || normalizedUsername]
  );
  if (!result.rows[0]) {
    const error = new Error(`Internal admin user already exists: ${normalizedUsername}`);
    error.code = 'internal_admin_user_exists';
    throw error;
  }
  return normalizeUser(result.rows[0]);
}

export async function updateInternalAdminUser(username, { role, display_name: displayName }, client = pool) {
  const normalizedUsername = assertUsername(username);
  const updates = [];
  const values = [];
  if (role !== undefined) {
    assertRole(role);
    values.push(role);
    updates.push(`role = $${values.length}`);
  }
  if (displayName !== undefined) {
    values.push(String(displayName || normalizedUsername).trim() || normalizedUsername);
    updates.push(`display_name = $${values.length}`);
  }
  if (!updates.length) {
    const user = await getInternalAdminUserByUsername(normalizedUsername, client);
    if (!user) {
      const error = new Error(`Internal admin user not found: ${normalizedUsername}`);
      error.code = 'internal_admin_user_not_found';
      throw error;
    }
    return user;
  }
  values.push(normalizedUsername);
  const result = await client.query(
    `UPDATE internal_admin_users
     SET ${updates.join(', ')},
         updated_at = NOW()
     WHERE username = $${values.length}
     RETURNING id, username, password_hash, role, display_name, disabled_at, last_login_at`,
    values
  );
  if (!result.rows[0]) {
    const error = new Error(`Internal admin user not found: ${normalizedUsername}`);
    error.code = 'internal_admin_user_not_found';
    throw error;
  }
  return normalizeUser(result.rows[0]);
}

export async function setInternalAdminUserDisabled(username, disabled, client = pool) {
  const normalizedUsername = assertUsername(username);
  const result = await client.query(
    `UPDATE internal_admin_users
     SET disabled_at = CASE WHEN $2::BOOLEAN THEN COALESCE(disabled_at, NOW()) ELSE NULL END,
         updated_at = NOW()
     WHERE username = $1
     RETURNING id, username, password_hash, role, display_name, disabled_at, last_login_at`,
    [normalizedUsername, Boolean(disabled)]
  );
  if (!result.rows[0]) {
    const error = new Error(`Internal admin user not found: ${normalizedUsername}`);
    error.code = 'internal_admin_user_not_found';
    throw error;
  }
  return normalizeUser(result.rows[0]);
}

export async function resetInternalAdminUserPassword(username, password, client = pool) {
  const normalizedUsername = assertUsername(username);
  const result = await client.query(
    `UPDATE internal_admin_users
     SET password_hash = $2,
         updated_at = NOW()
     WHERE username = $1
     RETURNING id, username, password_hash, role, display_name, disabled_at, last_login_at`,
    [normalizedUsername, hashInternalAdminPassword(assertPassword(password))]
  );
  if (!result.rows[0]) {
    const error = new Error(`Internal admin user not found: ${normalizedUsername}`);
    error.code = 'internal_admin_user_not_found';
    throw error;
  }
  return normalizeUser(result.rows[0]);
}

export async function bootstrapInternalAdminUsers(rawUsers = '', client = pool) {
  const users = parseInternalAdminBootstrapUsers(rawUsers);
  const bootstrapped = [];
  for (const user of users) {
    const passwordHash = hashInternalAdminPassword(user.password);
    const result = await client.query(
      `INSERT INTO internal_admin_users (username, password_hash, role, display_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO NOTHING
       RETURNING id, username, password_hash, role, display_name, disabled_at, last_login_at`,
      [user.username, passwordHash, user.role, user.display_name || user.username]
    );
    if (result.rows[0]) bootstrapped.push(normalizeUser(result.rows[0]));
  }
  return bootstrapped;
}

export async function authenticateInternalAdminUser({ username, password }, rawBootstrapUsers = '', client = pool) {
  await bootstrapInternalAdminUsers(rawBootstrapUsers, client);
  const user = await getInternalAdminUserByUsername(username, client);
  if (!user || user.disabled_at) return null;
  if (!verifyInternalAdminPassword(password, user.password_hash)) return null;
  const result = await client.query(
    `UPDATE internal_admin_users
     SET last_login_at = NOW(),
         updated_at = NOW()
     WHERE username = $1
     RETURNING id, username, password_hash, role, display_name, disabled_at, last_login_at`,
    [username]
  );
  return normalizeUser(result.rows[0]);
}

export async function resolveInternalAdminSessionUser(username, rawBootstrapUsers = '', client = pool) {
  await bootstrapInternalAdminUsers(rawBootstrapUsers, client);
  const user = await getInternalAdminUserByUsername(username, client);
  if (!user || user.disabled_at) return null;
  return user;
}

export const internalAdminUserStore = {
  authenticate: authenticateInternalAdminUser,
  resolveSessionUser: resolveInternalAdminSessionUser,
  bootstrap: bootstrapInternalAdminUsers,
  list: listInternalAdminUsers,
  create: createInternalAdminUser,
  update: updateInternalAdminUser,
  setDisabled: setInternalAdminUserDisabled,
  resetPassword: resetInternalAdminUserPassword
};

import pg from 'pg';
import { getConfig } from './config.js';

const { Pool } = pg;
const config = getConfig();

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export async function pingDb() {
  const result = await pool.query('SELECT NOW() AS now');
  return result.rows[0];
}

export async function closeDb() {
  await pool.end();
}

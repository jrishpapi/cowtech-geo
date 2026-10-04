import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closeDb } from './db.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'db', 'migrations');
export const MIGRATION_ADVISORY_LOCK_KEY = 'aivgl-schema-migrations-v1';

export async function runMigrations({ database = pool, migrationsDirectory = migrationsDir } = {}) {
  const client = typeof database.connect === 'function' ? await database.connect() : database;
  let lockAcquired = false;

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_ADVISORY_LOCK_KEY]);
    lockAcquired = true;
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const existing = await client
        .query('SELECT version FROM schema_migrations WHERE version = $1', [version])
        .catch(() => ({ rowCount: 0 }));

      if (existing.rowCount > 0) {
        logger.info({ version }, 'migration already applied');
        continue;
      }

      const sql = await readFile(join(migrationsDirectory, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version)
           VALUES ($1)
           ON CONFLICT (version) DO NOTHING`,
          [version]
        );
        await client.query('COMMIT');
        logger.info({ version }, 'migration applied');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    if (lockAcquired) {
      await client
        .query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_ADVISORY_LOCK_KEY])
        .catch((error) => logger.warn({ error }, 'failed to release migration advisory lock'));
    }
    if (typeof client.release === 'function') client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await runMigrations();
    logger.info('migrations complete');
  } catch (error) {
    logger.error({ error }, 'migration failed');
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

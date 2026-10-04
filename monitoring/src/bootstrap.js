import { pool, closeDb } from './db.js';
import { runMigrations } from './migrate.js';
import { modelTargets, promptTaxonomy } from './seed-data.js';
import { logger } from './logger.js';

// First-install reference data only. Never insert customers, brands, prompts or results.
// DO NOTHING preserves operator changes and never re-enables provider spending.
export async function bootstrapDatabase() {
  await runMigrations();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('self-hosted-bootstrap-v1'))");
    const initialized = await client.query("SELECT 1 FROM seed_records WHERE id = 'self-hosted-bootstrap-v1'");
    if (!initialized.rowCount) {
      const existing = await client.query('SELECT 1 FROM customers LIMIT 1');
      if (existing.rowCount) throw new Error('First bootstrap requires an empty customer database; refusing to alter an existing installation.');
      // Historical schema migrations insert commercial plans. Disarm them once on fresh install.
      await client.query(`UPDATE plans SET live_provider_enabled = false, live_provider_status = 'disabled',
        daily_provider_call_limit = 0, monthly_provider_call_limit = 0,
        monthly_provider_cost_limit_usd = 0, openrouter_reserve_usd = 0`);
      await client.query(`INSERT INTO seed_records (id, label, details)
        VALUES ('self-hosted-bootstrap-v1', 'Self-hosted reference initialization', '{}')`);
    }
    await client.query(`INSERT INTO plans
      (id, name, description, monthly_prompt_limit, model_limit, competitor_limit,
       weekly_runs_per_month, live_provider_enabled, live_provider_status,
       daily_provider_call_limit, monthly_provider_call_limit, monthly_provider_cost_limit_usd)
      VALUES ('god', 'Self-hosted', 'Local capacity profile; no paid subscription included.',
       120, 15, 10, 150, false, 'disabled', 0, 0, 0)
      ON CONFLICT (id) DO NOTHING`);
    for (const model of modelTargets) {
      await client.query(`INSERT INTO model_targets (provider_id, model_id, display_name, status)
        VALUES ($1, $2, $3, 'active') ON CONFLICT (provider_id, model_id) DO NOTHING`,
      [model.provider_id, model.model_id, model.display_name]);
    }
    for (const item of promptTaxonomy) {
      await client.query(`INSERT INTO prompt_taxonomy (id, label, description, applies_to)
        VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [item.id, item.label, item.description, JSON.stringify(item.applies_to)]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await bootstrapDatabase();
    logger.info('reference data initialized; external providers remain disabled');
  } catch (error) {
    logger.error({ error }, 'bootstrap failed');
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

import { pool, closeDb } from './db.js';
import { logger } from './logger.js';
import { runMigrations } from './migrate.js';
import { modelTargets, plans, promptTaxonomy } from './seed-data.js';

async function upsertPlans() {
  for (const plan of plans) {
    await pool.query(
      `INSERT INTO plans (
        id, name, description, monthly_prompt_limit, model_limit, competitor_limit,
        weekly_runs_per_month, included_full_retests, content_opportunities_min,
        content_opportunities_max, article_drafts_min, article_drafts_max,
        openrouter_reserve_usd, monthly_provider_call_limit, live_provider_enabled,
        live_provider_status, daily_provider_call_limit, monthly_provider_cost_limit_usd,
        retry_buffer_percent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        monthly_prompt_limit = EXCLUDED.monthly_prompt_limit,
        model_limit = EXCLUDED.model_limit,
        competitor_limit = EXCLUDED.competitor_limit,
        weekly_runs_per_month = EXCLUDED.weekly_runs_per_month,
        included_full_retests = EXCLUDED.included_full_retests,
        content_opportunities_min = EXCLUDED.content_opportunities_min,
        content_opportunities_max = EXCLUDED.content_opportunities_max,
        article_drafts_min = EXCLUDED.article_drafts_min,
        article_drafts_max = EXCLUDED.article_drafts_max,
        openrouter_reserve_usd = EXCLUDED.openrouter_reserve_usd,
        monthly_provider_call_limit = EXCLUDED.monthly_provider_call_limit,
        live_provider_enabled = EXCLUDED.live_provider_enabled,
        live_provider_status = EXCLUDED.live_provider_status,
        daily_provider_call_limit = EXCLUDED.daily_provider_call_limit,
        monthly_provider_cost_limit_usd = EXCLUDED.monthly_provider_cost_limit_usd,
        retry_buffer_percent = EXCLUDED.retry_buffer_percent,
        updated_at = NOW()`,
      [
        plan.id,
        plan.name,
        plan.description,
        plan.monthly_prompt_limit,
        plan.model_limit,
        plan.competitor_limit,
        plan.weekly_runs_per_month,
        plan.included_full_retests,
        plan.content_opportunities_min,
        plan.content_opportunities_max,
        plan.article_drafts_min,
        plan.article_drafts_max,
        plan.openrouter_reserve_usd,
        plan.monthly_provider_call_limit,
        plan.live_provider_enabled === true,
        plan.live_provider_status || 'mock_only',
        plan.daily_provider_call_limit || 0,
        plan.monthly_provider_cost_limit_usd || 0,
        plan.retry_buffer_percent
      ]
    );
  }
}

async function upsertModelTargets() {
  for (const model of modelTargets) {
    await pool.query(
      `INSERT INTO model_targets (provider_id, model_id, display_name, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (provider_id, model_id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         status = 'active'`,
      [model.provider_id, model.model_id, model.display_name]
    );
  }
}

async function upsertTaxonomy() {
  for (const item of promptTaxonomy) {
    await pool.query(
      `INSERT INTO prompt_taxonomy (id, label, description, applies_to)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         label = EXCLUDED.label,
         description = EXCLUDED.description,
         applies_to = EXCLUDED.applies_to`,
      [item.id, item.label, item.description, JSON.stringify(item.applies_to)]
    );
  }
}

async function upsertFixture(fixture) {
  const customerResult = await pool.query(
    `INSERT INTO customers (external_customer_id, email, plan_code, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (external_customer_id) DO UPDATE SET
       email = EXCLUDED.email,
       plan_code = EXCLUDED.plan_code,
       status = 'active',
       updated_at = NOW()
     RETURNING id`,
    [fixture.customer.external_customer_id, fixture.customer.email, fixture.customer.plan_code]
  );
  const customerId = customerResult.rows[0].id;

  const existingBrand = await pool.query(
    `SELECT id FROM brands WHERE customer_id = $1 AND name = $2 LIMIT 1`,
    [customerId, fixture.brand.name]
  );

  const brandResult =
    existingBrand.rowCount > 0
      ? await pool.query(
          `UPDATE brands
           SET website_url = $2, vertical = $3, locale = $4, updated_at = NOW()
           WHERE id = $1
           RETURNING id`,
          [existingBrand.rows[0].id, fixture.brand.website_url, fixture.brand.vertical, fixture.brand.locale]
        )
      : await pool.query(
          `INSERT INTO brands (customer_id, name, website_url, vertical, locale)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [customerId, fixture.brand.name, fixture.brand.website_url, fixture.brand.vertical, fixture.brand.locale]
        );

  const brandId = brandResult.rows[0].id;

  await pool.query('DELETE FROM competitors WHERE brand_id = $1', [brandId]);
  for (const competitor of fixture.competitors) {
    await pool.query(
      `INSERT INTO competitors (brand_id, name, website_url, aliases)
       VALUES ($1, $2, $3, $4)`,
      [brandId, competitor.name, competitor.website_url, JSON.stringify(competitor.aliases)]
    );
  }

  await pool.query('DELETE FROM prompt_sets WHERE brand_id = $1', [brandId]);
  const promptSetResult = await pool.query(
    `INSERT INTO prompt_sets (brand_id, name, status)
     VALUES ($1, $2, 'active')
     RETURNING id`,
    [brandId, fixture.promptSetName]
  );
  const promptSetId = promptSetResult.rows[0].id;

  for (const prompt of fixture.prompts) {
    await pool.query(
      `INSERT INTO prompts (prompt_set_id, category, prompt_text, locale)
       VALUES ($1, $2, $3, 'en')`,
      [promptSetId, prompt.category, prompt.prompt_text]
    );
  }

  await pool.query(
    `INSERT INTO seed_records (id, label, details)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       label = EXCLUDED.label,
       details = EXCLUDED.details,
       updated_at = NOW()`,
    [
      `fixture-${fixture.brand.name.toLowerCase()}`,
      fixture.brand.name,
      JSON.stringify({
        customer_id: customerId,
        brand_id: brandId,
        prompt_count: fixture.prompts.length,
        competitor_count: fixture.competitors.length
      })
    ]
  );
}

export async function seedDatabase() {
  if (!['test', 'development'].includes(process.env.NODE_ENV || 'development')) {
    throw new Error('Fixture seeding is test/development only; use npm run bootstrap for production.');
  }
  const { fixtures } = await import('../test-support/seed-fixtures.js');
  await runMigrations();
  await upsertPlans();
  await upsertModelTargets();
  await upsertTaxonomy();
  for (const fixture of fixtures) {
    await upsertFixture(fixture);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await seedDatabase();
    logger.info('seed complete');
  } catch (error) {
    logger.error({ error }, 'seed failed');
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

import { pool } from './db.js';
import { buildBillingAuthEntitlement } from './billing-auth-bridge.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function limitStatus({ count, limit, required = 1 }) {
  if (count < required) return 'needs_setup';
  if (limit > 0 && count > limit) return 'over_plan';
  return 'ready';
}

function remaining(limit, count) {
  return Math.max(numberValue(limit) - numberValue(count), 0);
}

function promptCategories(prompts) {
  const counts = new Map();
  for (const prompt of prompts) {
    counts.set(prompt.category, (counts.get(prompt.category) || 0) + 1);
  }
  return [...counts.entries()].map(([category, count]) => ({ category, count }));
}

function readinessFromSections(sections) {
  const missing = [];
  const warnings = [];

  for (const section of sections) {
    if (section.status === 'needs_setup') {
      missing.push(section.key);
    }
    if (section.status === 'over_plan') {
      warnings.push(section.key);
    }
  }

  return {
    status: missing.length ? 'needs_setup' : warnings.length ? 'needs_attention' : 'ready_for_tracking',
    missing_items: missing,
    warnings,
    next_step: missing.length
      ? `Complete ${missing[0].replaceAll('_', ' ')}.`
      : warnings.length
        ? `Review ${warnings[0].replaceAll('_', ' ')} against plan limits.`
        : 'Ready to run tracking.'
  };
}

export function buildCustomerSetupPayload({
  brand,
  customer,
  plan,
  competitors = [],
  promptSet = null,
  prompts = [],
  modelTargets = [],
  usage = {}
}) {
  const promptLimit = numberValue(plan.monthly_prompt_limit);
  const modelLimit = numberValue(plan.model_limit);
  const competitorLimit = numberValue(plan.competitor_limit);
  const monthlyRuns = numberValue(plan.weekly_runs_per_month, 4);
  const retryBufferPercent = numberValue(plan.retry_buffer_percent, 25);
  const monthlyProviderCallLimit = numberValue(plan.monthly_provider_call_limit);

  const selectedPrompts = prompts.slice(0, promptLimit || prompts.length);
  const selectedModels = modelTargets.slice(0, modelLimit || modelTargets.length);
  const selectedCompetitors = competitors.slice(0, competitorLimit || competitors.length);

  const trackingCallsPerRun = selectedPrompts.length * selectedModels.length;
  const estimatedMonthlyCalls = Math.ceil(trackingCallsPerRun * monthlyRuns * (1 + retryBufferPercent / 100));
  const providerCallsUsed = numberValue(usage.provider_calls_used);
  const projectedMonthlyCalls = providerCallsUsed + estimatedMonthlyCalls;

  const brandStatus = brand?.name && brand?.website_url && brand?.vertical ? 'ready' : 'needs_setup';
  const competitorStatus = limitStatus({ count: competitors.length, limit: competitorLimit });
  const promptStatus = limitStatus({ count: prompts.length, limit: promptLimit });
  const modelStatus = limitStatus({ count: selectedModels.length, limit: modelLimit });
  const quotaStatus = monthlyProviderCallLimit > 0 && projectedMonthlyCalls > monthlyProviderCallLimit ? 'needs_attention' : 'ready';

  const readiness = readinessFromSections([
    { key: 'brand_profile', status: brandStatus },
    { key: 'competitors', status: competitorStatus },
    { key: 'prompts', status: promptStatus },
    { key: 'model_targets', status: modelStatus },
    { key: 'quota', status: quotaStatus === 'needs_attention' ? 'over_plan' : 'ready' }
  ]);

  return {
    schema_version: 'r2-customer-setup-v1',
    customer: {
      id: customer.id,
      external_customer_id: customer.external_customer_id,
      email: customer.email,
      status: customer.status,
      plan_code: customer.plan_code
    },
    brand: {
      id: brand.id,
      name: brand.name,
      website_url: brand.website_url,
      vertical: brand.vertical,
      locale: brand.locale
    },
    readiness,
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      limits: {
        prompts: promptLimit,
        models: modelLimit,
        competitors: competitorLimit,
        monthly_runs: monthlyRuns,
        included_full_retests: numberValue(plan.included_full_retests),
        monthly_provider_calls: monthlyProviderCallLimit,
        retry_buffer_percent: retryBufferPercent
      },
      deliverables: {
        content_opportunities: {
          min: numberValue(plan.content_opportunities_min),
          max: numberValue(plan.content_opportunities_max)
        },
        article_drafts: {
          min: numberValue(plan.article_drafts_min),
          max: numberValue(plan.article_drafts_max)
        }
      }
    },
    setup: {
      brand_profile: {
        status: brandStatus,
        fields: {
          name: Boolean(brand.name),
          website_url: Boolean(brand.website_url),
          vertical: Boolean(brand.vertical),
          locale: Boolean(brand.locale)
        }
      },
      competitors: {
        status: competitorStatus,
        count: competitors.length,
        selected_count: selectedCompetitors.length,
        limit: competitorLimit,
        remaining: remaining(competitorLimit, competitors.length),
        items: competitors.map((competitor) => ({
          id: competitor.id,
          name: competitor.name,
          website_url: competitor.website_url,
          aliases: competitor.aliases || []
        }))
      },
      prompts: {
        status: promptStatus,
        prompt_set: promptSet
          ? {
              id: promptSet.id,
              name: promptSet.name,
              status: promptSet.status,
              version_number: numberValue(promptSet.version_number, 1)
            }
          : null,
        count: prompts.length,
        selected_count: selectedPrompts.length,
        limit: promptLimit,
        remaining: remaining(promptLimit, prompts.length),
        categories: promptCategories(prompts),
        items: prompts.map((prompt) => ({
          id: prompt.id,
          category: prompt.category,
          prompt_text: prompt.prompt_text,
          locale: prompt.locale,
          status: prompt.status,
          priority: numberValue(prompt.priority)
        }))
      },
      model_targets: {
        status: modelStatus,
        selected_count: selectedModels.length,
        available_count: modelTargets.length,
        limit: modelLimit,
        items: selectedModels.map((model) => ({
          id: model.id,
          provider_id: model.provider_id,
          model_id: model.model_id,
          display_name: model.display_name,
          status: model.status
        }))
      }
    },
    quota: {
      status: quotaStatus,
      tracking_calls_per_run: trackingCallsPerRun,
      monthly_runs: monthlyRuns,
      estimated_monthly_provider_calls: estimatedMonthlyCalls,
      projected_monthly_provider_calls: projectedMonthlyCalls,
      monthly_provider_call_limit: monthlyProviderCallLimit,
      provider_calls_used_this_month: providerCallsUsed,
      provider_calls_remaining_this_month:
        monthlyProviderCallLimit > 0 ? Math.max(monthlyProviderCallLimit - providerCallsUsed, 0) : null,
      openrouter_reserve_usd: numberValue(plan.openrouter_reserve_usd),
      note:
        quotaStatus === 'ready'
          ? 'Plan quota can support the current setup.'
          : 'Projected monthly calls exceed the current plan limit.'
    },
    billing_auth: buildBillingAuthEntitlement({
      customer,
      brand,
      plan,
      usage: {
        ...usage,
        prompt_count: prompts.length,
        model_count: selectedModels.length,
        competitor_count: competitors.length
      }
    })
  };
}

async function resolveBrandId({ brand_id, brand_name, run_id }) {
  const values = [];
  const filters = [customerVisibleTenantPredicate('c')];
  if (brand_id) {
    values.push(brand_id);
    filters.push(`b.id = $${values.length}`);
  }
  if (brand_name) {
    values.push(brand_name);
    filters.push(`LOWER(b.name) = LOWER($${values.length})`);
  }
  if (run_id) {
    values.push(run_id);
    filters.push(`tr.id = $${values.length}`);
  }
  const result = await pool.query(
    `SELECT b.id
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN tracking_runs tr ON tr.brand_id = b.id
     WHERE ${filters.join(' AND ')}
     ORDER BY b.created_at ASC
     LIMIT 1`,
    values
  );
  return result.rows[0]?.id || null;
}

export async function getCustomerSetupPayload({ brand_id, brand_name, run_id } = {}) {
  const resolvedBrandId = await resolveBrandId({ brand_id, brand_name, run_id });
  if (!resolvedBrandId) return null;

  const brandResult = await pool.query(
    `SELECT b.*, c.id AS customer_id, c.external_customer_id, c.email, c.plan_code, c.status AS customer_status
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     WHERE b.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [resolvedBrandId]
  );
  if (!brandResult.rowCount) return null;

  const brandRow = brandResult.rows[0];
  const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [brandRow.plan_code]);
  if (!planResult.rowCount) return null;

  const promptSetResult = await pool.query(
    `SELECT *
     FROM prompt_sets
     WHERE brand_id = $1 AND status = 'active'
     ORDER BY version_number DESC, created_at DESC
     LIMIT 1`,
    [resolvedBrandId]
  );
  const promptSet = promptSetResult.rows[0] || null;

  const [competitors, prompts, modelTargets, usage] = await Promise.all([
    pool.query('SELECT * FROM competitors WHERE brand_id = $1 ORDER BY created_at ASC', [resolvedBrandId]),
    promptSet
      ? pool.query(
          `SELECT *
           FROM prompts
           WHERE prompt_set_id = $1 AND COALESCE(status, 'active') = 'active'
           ORDER BY priority DESC, created_at ASC`,
          [promptSet.id]
        )
      : { rows: [] },
    pool.query("SELECT * FROM model_targets WHERE status = 'active' ORDER BY created_at ASC"),
    pool.query(
      `SELECT COALESCE(SUM(units), 0)::int AS provider_calls_used
       FROM usage_ledger
       WHERE customer_id = $1
         AND event_type = 'provider_call'
         AND COALESCE(metadata->>'provider_mode', '') <> 'mock'
         AND created_at >= date_trunc('month', NOW())`,
      [brandRow.customer_id]
    )
  ]);

  return buildCustomerSetupPayload({
    brand: brandRow,
    customer: {
      id: brandRow.customer_id,
      external_customer_id: brandRow.external_customer_id,
      email: brandRow.email,
      plan_code: brandRow.plan_code,
      status: brandRow.customer_status
    },
    plan: planResult.rows[0],
    competitors: competitors.rows,
    promptSet,
    prompts: prompts.rows,
    modelTargets: modelTargets.rows,
    usage: usage.rows[0]
  });
}

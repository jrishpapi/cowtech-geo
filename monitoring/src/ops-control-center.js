import { getConfig } from './config.js';
import { pool } from './db.js';
import { modelTargets } from './seed-data.js';
import { createTrackingRun, executeTrackingRun, getTrackingResults } from './tracking.js';
import { parseTrackingRunResults } from './parser.js';
import { scoreTrackingRun } from './scoring.js';
import { estimatePromptTrackingCall } from './cost-estimator.js';
import { generateRunExecutionPlan } from './execution-plan.js';

export const OPS_CONTROL_CENTER_SCHEMA = 'r12-ops-control-center-v1';
export const OPS_CUSTOMER_INTAKE_SCHEMA = 'r12-ops-customer-brand-intake-v1';
export const OPS_FULL_TRACKING_TEST_SCHEMA = 'r12-ops-full-tracking-test-v1';

const DEFAULT_SETTINGS = {
  live_provider_testing_enabled: false,
  default_provider_mode: 'unconfigured',
  max_estimated_cost_usd: 0.05,
  default_brand_name: '',
  default_prompt_index: 0,
  default_model_index: 0
};

const VERTICAL_LABELS = {
  b2b_saas: 'B2B SaaS',
  dtc: 'consumer brand',
  healthcare: 'healthcare',
  insurance: 'insurance'
};

function boolValue(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value, fallback = '') {
  return String(value || fallback).trim();
}

function requireText(value, code) {
  const text = cleanText(value);
  if (!text) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  return text;
}

function slug(value) {
  return cleanText(value, 'brand')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'brand';
}

function normalizeUrl(value) {
  const text = requireText(value, 'ops_control_brand_website_required');
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

export function normalizeOpsRuntimeSettings(input = {}, base = DEFAULT_SETTINGS) {
  const providerMode = cleanText(input.default_provider_mode, base.default_provider_mode);
  if (!['unconfigured', 'mock', 'openrouter'].includes(providerMode)) {
    const error = new Error('ops_control_provider_mode_invalid');
    error.code = 'ops_control_provider_mode_invalid';
    throw error;
  }

  const maxCost = numberValue(input.max_estimated_cost_usd, base.max_estimated_cost_usd);
  if (maxCost < 0 || maxCost > 5) {
    const error = new Error('ops_control_budget_invalid');
    error.code = 'ops_control_budget_invalid';
    throw error;
  }

  return {
    live_provider_testing_enabled: boolValue(
      input.live_provider_testing_enabled,
      base.live_provider_testing_enabled
    ),
    default_provider_mode: providerMode,
    max_estimated_cost_usd: Number(maxCost.toFixed(6)),
    default_brand_name: cleanText(input.default_brand_name, base.default_brand_name),
    default_prompt_index: Math.max(numberValue(input.default_prompt_index, base.default_prompt_index), 0),
    default_model_index: Math.max(numberValue(input.default_model_index, base.default_model_index), 0)
  };
}

function rowToSettings(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    live_provider_testing_enabled: row.live_provider_testing_enabled,
    default_provider_mode: row.default_provider_mode,
    max_estimated_cost_usd: numberValue(row.max_estimated_cost_usd, DEFAULT_SETTINGS.max_estimated_cost_usd),
    default_brand_name: row.default_brand_name,
    default_prompt_index: numberValue(row.default_prompt_index, 0),
    default_model_index: numberValue(row.default_model_index, 0),
    updated_by: row.updated_by || null,
    updated_at: row.updated_at || null
  };
}

export async function getOpsRuntimeSettings() {
  const result = await pool.query(
    `SELECT *
     FROM ops_runtime_settings
     WHERE id = 'default'
     LIMIT 1`
  );
  if (result.rowCount) return rowToSettings(result.rows[0]);

  const inserted = await pool.query(
    `INSERT INTO ops_runtime_settings (id)
     VALUES ('default')
     ON CONFLICT (id) DO UPDATE SET updated_at = ops_runtime_settings.updated_at
     RETURNING *`
  );
  return rowToSettings(inserted.rows[0]);
}

export async function updateOpsRuntimeSettings(input = {}, actor = 'ops_dashboard') {
  const current = await getOpsRuntimeSettings();
  const settings = normalizeOpsRuntimeSettings(input, current);
  const result = await pool.query(
    `INSERT INTO ops_runtime_settings (
       id,
       live_provider_testing_enabled,
       default_provider_mode,
       max_estimated_cost_usd,
       default_brand_name,
       default_prompt_index,
       default_model_index,
       updated_by,
       settings_payload
     )
     VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       live_provider_testing_enabled = EXCLUDED.live_provider_testing_enabled,
       default_provider_mode = EXCLUDED.default_provider_mode,
       max_estimated_cost_usd = EXCLUDED.max_estimated_cost_usd,
       default_brand_name = EXCLUDED.default_brand_name,
       default_prompt_index = EXCLUDED.default_prompt_index,
       default_model_index = EXCLUDED.default_model_index,
       updated_by = EXCLUDED.updated_by,
       settings_payload = EXCLUDED.settings_payload,
       updated_at = NOW()
     RETURNING *`,
    [
      settings.live_provider_testing_enabled,
      settings.default_provider_mode,
      settings.max_estimated_cost_usd,
      settings.default_brand_name,
      settings.default_prompt_index,
      settings.default_model_index,
      cleanText(actor, 'ops_dashboard'),
      JSON.stringify(settings)
    ]
  );
  return rowToSettings(result.rows[0]);
}

export function buildOpsRuntimeConfig(settings = DEFAULT_SETTINGS, config = getConfig()) {
  return {
    ...config,
    liveProviderTestingEnabled: settings.live_provider_testing_enabled === true,
    liveProviderTestingMaxEstimatedCostUsd: numberValue(
      settings.max_estimated_cost_usd,
      config.liveProviderTestingMaxEstimatedCostUsd || DEFAULT_SETTINGS.max_estimated_cost_usd
    )
  };
}

function defaultPromptsForBrand({ name, vertical, competitors = [] }) {
  const category = VERTICAL_LABELS[vertical] || vertical || 'companies';
  const competitorName = competitors[0]?.name || 'a leading competitor';
  return [
    {
      category: 'brand-awareness',
      prompt_text: `Do you know ${name}?`,
      prompt_source: 'ops_dashboard_default'
    },
    {
      category: 'category-recommendation',
      prompt_text: `Which ${category} companies do you recommend?`,
      prompt_source: 'ops_dashboard_default'
    },
    {
      category: 'problem-solution',
      prompt_text: `What ${category} tools or companies help customers solve this problem?`,
      prompt_source: 'ops_dashboard_default'
    },
    {
      category: 'competitor-comparison',
      prompt_text: `Compare ${name} vs ${competitorName}.`,
      prompt_source: 'ops_dashboard_default'
    },
    {
      category: 'source-seeking',
      prompt_text: `Where can I learn more about ${category} options like ${name}?`,
      prompt_source: 'ops_dashboard_default'
    }
  ];
}

function normalizeCompetitors(input = []) {
  return input
    .map((entry) => ({
      name: cleanText(entry?.name),
      website_url: cleanText(entry?.website_url),
      aliases: Array.isArray(entry?.aliases)
        ? entry.aliases.map((alias) => cleanText(alias)).filter(Boolean)
        : []
    }))
    .filter((entry) => entry.name)
    .slice(0, 10);
}

export function normalizePrompts(input = [], brand) {
  const hasCustomInput = input.length > 0;
  const source = hasCustomInput ? input : defaultPromptsForBrand(brand);
  return source
    .map((entry) => ({
      category: cleanText(entry?.category, 'brand-awareness'),
      prompt_text: cleanText(entry?.prompt_text || entry?.text),
      prompt_source: cleanText(
        entry?.prompt_source,
        hasCustomInput ? 'ops_dashboard_intake' : 'ops_dashboard_default'
      )
    }))
    .filter((entry) => entry.prompt_text)
    .slice(0, 50);
}

function answerPreview(value = '') {
  return String(value || '').slice(0, 900);
}

export function assertOpsFullTrackingLivePlan({
  providerMode,
  executeLive,
  liveProviderTestingEnabled,
  openrouterApiKey,
  estimatedCostUsd,
  maxEstimatedCostUsd,
  plannedCalls,
  hasDefaultTemplatePrompts = false
}) {
  if (providerMode === 'mock') {
    return {
      provider_mode: 'mock',
      execute_live: false,
      allow_paid_provider: false,
      paid_provider_call_executed: false
    };
  }

  if (providerMode !== 'openrouter') {
    const error = new Error('ops_full_tracking_provider_mode_invalid');
    error.code = 'ops_full_tracking_provider_mode_invalid';
    throw error;
  }
  if (liveProviderTestingEnabled !== true) {
    const error = new Error('ops_full_tracking_live_provider_testing_disabled');
    error.code = 'ops_full_tracking_live_provider_testing_disabled';
    throw error;
  }
  if (!openrouterApiKey) {
    const error = new Error('ops_full_tracking_openrouter_key_missing');
    error.code = 'ops_full_tracking_openrouter_key_missing';
    throw error;
  }
  if (executeLive !== true) {
    const error = new Error('ops_full_tracking_execute_live_required');
    error.code = 'ops_full_tracking_execute_live_required';
    throw error;
  }
  if (plannedCalls < 1) {
    const error = new Error('ops_full_tracking_no_provider_calls_planned');
    error.code = 'ops_full_tracking_no_provider_calls_planned';
    throw error;
  }
  if (!(maxEstimatedCostUsd > 0)) {
    const error = new Error('ops_full_tracking_budget_required');
    error.code = 'ops_full_tracking_budget_required';
    throw error;
  }
  if (hasDefaultTemplatePrompts === true) {
    const error = new Error('ops_full_tracking_default_template_prompts_blocked');
    error.code = 'ops_full_tracking_default_template_prompts_blocked';
    throw error;
  }
  if (estimatedCostUsd > maxEstimatedCostUsd) {
    const error = new Error('ops_full_tracking_estimated_cost_exceeds_budget');
    error.code = 'ops_full_tracking_estimated_cost_exceeds_budget';
    error.details = {
      estimated_cost_usd: estimatedCostUsd,
      max_estimated_cost_usd: maxEstimatedCostUsd,
      planned_calls: plannedCalls
    };
    throw error;
  }

  return {
    provider_mode: 'openrouter',
    execute_live: true,
    allow_paid_provider: true,
    paid_provider_call_executed: true
  };
}

async function estimateOpsFullTrackingPlan(brandName) {
  const brand = await pool.query(
    `SELECT b.*, c.plan_code
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     WHERE LOWER(b.name) = LOWER($1)
     LIMIT 1`,
    [requireText(brandName, 'ops_full_tracking_brand_required')]
  );
  if (brand.rowCount !== 1) {
    const error = new Error('ops_full_tracking_brand_not_found');
    error.code = 'ops_full_tracking_brand_not_found';
    throw error;
  }

  const plan = await pool.query('SELECT * FROM plans WHERE id = $1', [brand.rows[0].plan_code]);
  if (plan.rowCount !== 1) {
    const error = new Error('ops_full_tracking_plan_not_found');
    error.code = 'ops_full_tracking_plan_not_found';
    throw error;
  }

  const promptSet = await pool.query(
    `SELECT id
     FROM prompt_sets
     WHERE brand_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [brand.rows[0].id]
  );
  if (promptSet.rowCount !== 1) {
    const error = new Error('ops_full_tracking_active_prompt_set_not_found');
    error.code = 'ops_full_tracking_active_prompt_set_not_found';
    throw error;
  }

  const prompts = await pool.query(
    `SELECT id, category, prompt_text, prompt_source
     FROM prompts
     WHERE prompt_set_id = $1 AND COALESCE(status, 'active') = 'active'
     ORDER BY priority DESC, created_at ASC
     LIMIT $2`,
    [promptSet.rows[0].id, plan.rows[0].monthly_prompt_limit]
  );
  const competitors = await pool.query(
    `SELECT name
     FROM competitors
     WHERE brand_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [brand.rows[0].id, plan.rows[0].competitor_limit]
  );
  const targets = await pool.query(
    `SELECT id, model_id, display_name
     FROM model_targets
     WHERE status = 'active'
     ORDER BY created_at ASC
     LIMIT $1`,
    [plan.rows[0].model_limit]
  );

  const estimatedCostUsd = prompts.rows.reduce((sum, prompt) => {
    return (
      sum +
      targets.rows.reduce((targetSum, target) => {
        return targetSum + estimatePromptTrackingCall({ model_id: target.model_id, prompt_text: prompt.prompt_text }).estimated_cost_usd;
      }, 0)
    );
  }, 0);
  const defaultPromptTexts = new Set(
    defaultPromptsForBrand({
      name: brand.rows[0].name,
      vertical: brand.rows[0].vertical,
      competitors: competitors.rows
    }).map((prompt) => prompt.prompt_text)
  );
  const defaultTemplateMatchCount = prompts.rows.filter((prompt) => defaultPromptTexts.has(prompt.prompt_text)).length;
  const defaultSourceCount = prompts.rows.filter((prompt) => prompt.prompt_source === 'ops_dashboard_default').length;
  const hasDefaultTemplatePrompts =
    prompts.rowCount > 0 && (defaultSourceCount > 0 || defaultTemplateMatchCount === prompts.rowCount);

  return {
    brand_name: brand.rows[0].name,
    prompt_count: prompts.rowCount,
    model_count: targets.rowCount,
    planned_calls: prompts.rowCount * targets.rowCount,
    estimated_cost_usd: Number(estimatedCostUsd.toFixed(6)),
    has_default_template_prompts: hasDefaultTemplatePrompts,
    default_template_match_count: defaultTemplateMatchCount,
    prompts: prompts.rows.map((prompt, index) => ({
      index,
      id: prompt.id,
      category: prompt.category,
      prompt_text: prompt.prompt_text,
      prompt_source: prompt.prompt_source || null,
      default_template_match: defaultPromptTexts.has(prompt.prompt_text)
    })),
    models: targets.rows.map((target, index) => ({
      index,
      id: target.id,
      provider_id: 'openrouter',
      model_id: target.model_id,
      display_name: target.display_name || target.model_id
    })),
    model_ids: targets.rows.map((target) => target.model_id)
  };
}

export async function createOpsCustomerBrandIntake(input = {}, actor = 'ops_dashboard') {
  const customer = input.customer || {};
  const brandInput = input.brand || {};
  const brandName = requireText(brandInput.name, 'ops_control_brand_name_required');
  const brand = {
    name: brandName,
    website_url: normalizeUrl(brandInput.website_url),
    vertical: cleanText(brandInput.vertical, 'b2b_saas'),
    locale: cleanText(brandInput.locale, 'en')
  };
  const planCode = cleanText(customer.plan_code, 'basic');
  const email = cleanText(customer.email, `ops+${slug(brandName)}@ai-visibility.local`);
  const externalCustomerId = cleanText(
    customer.external_customer_id,
    `ops-${slug(brandName)}-${Date.now()}`
  );
  const competitors = normalizeCompetitors(input.competitors || []);
  const prompts = normalizePrompts(input.prompts || [], { ...brand, competitors });

  if (!prompts.length) {
    const error = new Error('ops_control_prompt_required');
    error.code = 'ops_control_prompt_required';
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plan = await client.query('SELECT id FROM plans WHERE id = $1 AND status = $2', [planCode, 'active']);
    if (plan.rowCount !== 1) {
      const error = new Error('ops_control_plan_not_found');
      error.code = 'ops_control_plan_not_found';
      throw error;
    }

    const customerResult = await client.query(
      `INSERT INTO customers (external_customer_id, email, plan_code, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (external_customer_id) DO UPDATE SET
         email = EXCLUDED.email,
         plan_code = EXCLUDED.plan_code,
         status = 'active',
         updated_at = NOW()
       RETURNING id, external_customer_id, email, plan_code, status, created_at, updated_at`,
      [externalCustomerId, email, planCode]
    );
    const customerRow = customerResult.rows[0];

    const existingBrand = await client.query(
      `SELECT id
       FROM brands
       WHERE customer_id = $1 AND LOWER(name) = LOWER($2)
       LIMIT 1`,
      [customerRow.id, brand.name]
    );
    const brandResult = existingBrand.rowCount
      ? await client.query(
          `UPDATE brands
           SET website_url = $2, vertical = $3, locale = $4, updated_at = NOW()
           WHERE id = $1
           RETURNING id, customer_id, name, website_url, vertical, locale, created_at, updated_at`,
          [existingBrand.rows[0].id, brand.website_url, brand.vertical, brand.locale]
        )
      : await client.query(
          `INSERT INTO brands (customer_id, name, website_url, vertical, locale)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, customer_id, name, website_url, vertical, locale, created_at, updated_at`,
          [customerRow.id, brand.name, brand.website_url, brand.vertical, brand.locale]
        );
    const brandRow = brandResult.rows[0];

    await client.query('DELETE FROM competitors WHERE brand_id = $1', [brandRow.id]);
    for (const competitor of competitors) {
      await client.query(
        `INSERT INTO competitors (brand_id, name, website_url, aliases)
         VALUES ($1, $2, $3, $4)`,
        [brandRow.id, competitor.name, competitor.website_url || null, JSON.stringify(competitor.aliases)]
      );
    }

    // Keep prompt sets referenced by prior runs; retries must not erase baselines.
    await client.query("UPDATE prompt_sets SET status = 'archived' WHERE brand_id = $1 AND status = 'active'", [brandRow.id]);
    const promptSetResult = await client.query(
      `INSERT INTO prompt_sets (brand_id, name, status, change_reason, activated_at)
       VALUES ($1, $2, 'active', $3, NOW())
       RETURNING id, name, status, created_at`,
      [brandRow.id, `${brand.name} Ops intake prompts`, `created_by:${cleanText(actor, 'ops_dashboard')}`]
    );
    const promptSet = promptSetResult.rows[0];
    for (const [index, prompt] of prompts.entries()) {
      await client.query(
        `INSERT INTO prompts (prompt_set_id, category, prompt_text, locale, status, priority, prompt_source)
         VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
        [promptSet.id, prompt.category, prompt.prompt_text, brand.locale, Math.max(100 - index, 1), prompt.prompt_source]
      );
    }

    await client.query('COMMIT');
    return {
      schema_version: OPS_CUSTOMER_INTAKE_SCHEMA,
      status: 'ready',
      created_at: new Date().toISOString(),
      customer: customerRow,
      brand: brandRow,
      prompt_set: promptSet,
      counts: {
        competitors: competitors.length,
        prompts: prompts.length
      },
      dashboard_urls: {
        setup: `/dashboard/setup?brand_name=${encodeURIComponent(brandRow.name)}`,
        articles: `/dashboard/articles?brand_name=${encodeURIComponent(brandRow.name)}`
      },
      next_operator_action: 'Open customer dashboard setup or run a bounded provider pilot from Ops Control Center.'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listOpsBrands() {
  const result = await pool.query(
    `SELECT b.id,
            b.name,
            b.website_url,
            b.vertical,
            b.locale,
            b.created_at,
            b.updated_at,
            c.id AS customer_id,
            c.email,
            c.plan_code,
            COUNT(DISTINCT p.id)::int AS prompt_count,
            COUNT(DISTINCT cmp.id)::int AS competitor_count,
            COUNT(DISTINCT tr.id)::int AS tracking_run_count,
            MAX(tr.created_at) AS latest_tracking_run_at
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     LEFT JOIN prompt_sets ps ON ps.brand_id = b.id AND ps.status = 'active'
     LEFT JOIN prompts p ON p.prompt_set_id = ps.id AND COALESCE(p.status, 'active') = 'active'
     LEFT JOIN competitors cmp ON cmp.brand_id = b.id
     LEFT JOIN tracking_runs tr ON tr.brand_id = b.id
     GROUP BY b.id, c.id
     ORDER BY b.created_at DESC, b.updated_at DESC
     LIMIT 40`
  );
  return result.rows.map((row) => ({
    ...row,
    dashboard_urls: {
      setup: `/dashboard/setup?brand_name=${encodeURIComponent(row.name)}`,
      articles: `/dashboard/articles?brand_name=${encodeURIComponent(row.name)}`
    }
  }));
}

async function listRecentPaidProviderPilots() {
  const result = await pool.query(
    `SELECT ul.id,
            ul.event_type,
            ul.units,
            ul.cost_estimate_usd,
            ul.metadata,
            ul.created_at,
            b.name AS brand_name,
            b.website_url AS brand_website_url,
            b.vertical AS brand_vertical,
            p.category AS prompt_category,
            p.prompt_text
     FROM usage_ledger ul
     LEFT JOIN brands b ON b.id = ul.brand_id
     LEFT JOIN prompts p ON p.id::text = ul.metadata->>'prompt_id'
     WHERE ul.metadata->>'source' = 'r11_paid_provider_pilot'
        OR ul.metadata->'metadata'->>'source' = 'r11_paid_provider_pilot'
     ORDER BY ul.created_at DESC
     LIMIT 20`
  );
  return result.rows.map((row) => ({
    id: row.id,
    event_type: row.event_type,
    units: row.units,
    cost_estimate_usd: numberValue(row.cost_estimate_usd, 0),
    created_at: row.created_at,
    brand_name: row.metadata?.brand_name || row.brand_name || null,
    brand_website_url: row.metadata?.brand_website_url || row.brand_website_url || null,
    brand_vertical: row.metadata?.brand_vertical || row.brand_vertical || null,
    model_id: row.metadata?.model_id || row.metadata?.metadata?.model_id || null,
    model_display_name: row.metadata?.model_display_name || null,
    prompt_id: row.metadata?.prompt_id || null,
    prompt_category: row.metadata?.prompt_category || row.prompt_category || null,
    prompt_text: row.metadata?.prompt_text || row.prompt_text || null,
    provider_id: row.metadata?.provider_id || null,
    provider_mode: row.metadata?.provider_mode || null,
    provider_response_id: row.metadata?.provider_response_id || row.metadata?.metadata?.provider_response_id || null,
    answer_chars: row.metadata?.answer_chars || null,
    answer_preview: row.metadata?.answer_preview || null,
    usage: row.metadata?.usage || null,
    estimated_cost_usd: numberValue(row.metadata?.estimated_cost_usd, 0),
    actual_cost_estimate_usd: numberValue(row.metadata?.actual_cost_estimate_usd, row.cost_estimate_usd),
    budget_max_estimated_cost_usd: numberValue(row.metadata?.budget_max_estimated_cost_usd, 0),
    fixture_path: row.metadata?.fixture_path || row.metadata?.metadata?.fixture_path || null,
    raw_provider_payload_exposed: row.metadata?.raw_provider_payload_exposed === true,
    openrouter_api_key_exposed: row.metadata?.openrouter_api_key_exposed === true,
    test_process: row.metadata?.test_process || [
      'Selected one active brand, one active prompt, and one OpenRouter model.',
      'Checked entitlement, provider-call quota, OpenRouter key, budget, explicit execute flag, and scheduler safety gates.',
      'Executed exactly one OpenRouter call when all gates passed.',
      'Recorded provider response summary, token usage, cost estimate, ledger event, and fixture path without exposing provider secrets.'
    ],
    evaluation_criteria: row.metadata?.evaluation_criteria || [
      'provider_call_executed must be true only after explicit execute_live confirmation',
      'paid_provider_call_count must equal 1',
      'actual_cost_estimate_usd must be within the dashboard budget',
      'raw_provider_payload_exposed and openrouter_api_key_exposed must remain false',
      'answer_chars and provider_response_id must be present for completed calls'
    ]
  }));
}

async function listRecentFullTrackingTests(limit = 5) {
  const result = await pool.query(
    `SELECT tr.id,
            tr.status,
            tr.run_type,
            tr.created_at,
            tr.started_at,
            tr.finished_at,
            b.name AS brand_name,
            b.vertical AS brand_vertical,
            COUNT(pr.id)::int AS result_count,
            COUNT(DISTINCT pr.prompt_id)::int AS prompt_count,
            COUNT(DISTINCT pr.model_target_id)::int AS model_count,
            COUNT(pr.id) FILTER (WHERE pr.status = 'completed')::int AS completed_count,
            COUNT(pr.id) FILTER (WHERE pr.parser_output IS NOT NULL)::int AS parsed_count,
            COALESCE(SUM(pr.cost_estimate_usd), 0)::numeric AS total_cost_estimate_usd,
            rs.visibility_score,
            rs.source_quality_score,
            rs.competitor_pressure_score,
            rs.scoring_output
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     LEFT JOIN prompt_results pr ON pr.tracking_run_id = tr.id
     LEFT JOIN run_scores rs ON rs.tracking_run_id = tr.id
     WHERE tr.run_type IN ('ops_full_tracking_test', 'ops_full_tracking_live_test')
     GROUP BY tr.id, b.name, b.vertical, rs.visibility_score, rs.source_quality_score, rs.competitor_pressure_score, rs.scoring_output
     ORDER BY tr.created_at DESC
     LIMIT $1`,
    [Math.max(numberValue(limit, 5), 1)]
  );

  return result.rows.map((row) => ({
    provider_mode: row.run_type === 'ops_full_tracking_live_test' ? 'openrouter' : 'mock',
    score_meaning: row.run_type === 'ops_full_tracking_live_test' ? 'ai_visibility_measurement' : 'pipeline_validation',
    paid_provider_call_executed: row.run_type === 'ops_full_tracking_live_test',
    id: row.id,
    status: row.status,
    run_type: row.run_type,
    brand_name: row.brand_name,
    brand_vertical: row.brand_vertical,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
    prompt_count: numberValue(row.prompt_count),
    model_count: numberValue(row.model_count),
    result_count: numberValue(row.result_count),
    completed_count: numberValue(row.completed_count),
    parsed_count: numberValue(row.parsed_count),
    total_cost_estimate_usd: numberValue(row.total_cost_estimate_usd),
    scores:
      row.visibility_score === null || row.visibility_score === undefined
        ? null
        : {
            visibility_score: numberValue(row.visibility_score),
            source_quality_score: numberValue(row.source_quality_score),
            competitor_pressure_score: numberValue(row.competitor_pressure_score),
            grade: row.scoring_output?.grade || null,
            components: row.scoring_output?.components || null
          },
    customer_dashboard_url: `/dashboard/articles?run_id=${encodeURIComponent(row.id)}`,
    internal_results_url: `/internal/tracking/runs/${encodeURIComponent(row.id)}/results`
  }));
}

async function listOpsFullTrackingPreviews(brands = []) {
  return Promise.all(
    brands.slice(0, 40).map(async (brand) => {
      try {
        return await estimateOpsFullTrackingPlan(brand.name);
      } catch (error) {
        return {
          brand_name: brand.name,
          prompt_count: 0,
          model_count: 0,
          planned_calls: 0,
          estimated_cost_usd: 0,
          prompts: [],
          models: [],
          model_ids: [],
          blocker: error.code || error.message
        };
      }
    })
  );
}

export async function runOpsFullTrackingTest({
  brand_name = '',
  provider_mode = 'unconfigured',
  execute_live = false,
  max_estimated_cost_usd,
  runtime_config = getConfig()
} = {}) {
  const providerMode = cleanText(provider_mode, 'unconfigured');
  const plan = await estimateOpsFullTrackingPlan(brand_name);
  const budgetMax = numberValue(
    max_estimated_cost_usd,
    runtime_config.liveProviderTestingMaxEstimatedCostUsd || DEFAULT_SETTINGS.max_estimated_cost_usd
  );
  const execution = assertOpsFullTrackingLivePlan({
    providerMode,
    executeLive: boolValue(execute_live),
    liveProviderTestingEnabled: runtime_config.liveProviderTestingEnabled === true,
    openrouterApiKey: runtime_config.openrouterApiKey,
    estimatedCostUsd: plan.estimated_cost_usd,
    maxEstimatedCostUsd: budgetMax,
    plannedCalls: plan.planned_calls,
    hasDefaultTemplatePrompts: plan.has_default_template_prompts
  });

  const run = await createTrackingRun({
    brand_name: requireText(brand_name, 'ops_full_tracking_brand_required'),
    run_type: execution.provider_mode === 'mock' ? 'ops_full_tracking_test' : 'ops_full_tracking_live_test',
    idempotency_key: `ops-full-tracking-test:${slug(brand_name)}:${Date.now()}`
  });
  const tracking = await executeTrackingRun({
    tracking_run_id: run.id,
    provider_mode: execution.provider_mode,
    allow_paid_provider: execution.allow_paid_provider
  });
  const parsing = await parseTrackingRunResults(run.id);
  const scoring = await scoreTrackingRun(run.id);
  const executionPlan = await generateRunExecutionPlan(run.id);
  const results = await getTrackingResults(run.id);

  return {
    schema_version: OPS_FULL_TRACKING_TEST_SCHEMA,
    status: 'completed',
    provider_mode: execution.provider_mode,
    paid_provider_call_executed: execution.paid_provider_call_executed,
    budget: {
      planned_calls: plan.planned_calls,
      estimated_cost_usd: plan.estimated_cost_usd,
      max_estimated_cost_usd: Number(budgetMax.toFixed(6)),
      within_budget: plan.estimated_cost_usd <= budgetMax,
      has_default_template_prompts: plan.has_default_template_prompts
    },
    tracking_run_id: run.id,
    brand_name,
    tracking,
    parsing,
    scoring,
    execution_plan: {
      schema_version: executionPlan.schema_version,
      status: executionPlan.status,
      opportunities: executionPlan.steps.opportunities,
      opportunity_prompt_bindings: executionPlan.steps.opportunity_prompt_bindings,
      high_priority_briefs: executionPlan.steps.high_priority_briefs,
      next_step: executionPlan.next_step
    },
    answer_previews: results.slice(0, 12).map((result) => ({
      prompt_text: result.prompt_text,
      category: result.category,
      model_id: result.model_id,
      status: result.status,
      answer_preview: answerPreview(result.raw_answer),
      cost_estimate_usd: numberValue(result.cost_estimate_usd)
    })),
    process: [
      'Created an ops_full_tracking_test tracking run for the selected brand.',
      `Executed all active prompts against all active model targets with ${execution.provider_mode} provider mode.`,
      'Persisted answers into prompt_results.',
      'Parsed completed answers into parser_output.',
      'Scored visibility, source quality, and competitor pressure from parsed results.',
      'Generated content opportunities, opportunity prompt bindings, and high-priority content briefs for the customer execution plan.'
    ],
    evaluation_criteria: [
      'This full test must produce prompt_results, not only usage_ledger rows.',
      'parsed_results must match completed answers.',
      'visibility/source/competitor scores must be persisted in run_scores.',
      'content opportunities and high-priority briefs must be generated after scoring.',
      'OpenRouter full tests must require execute_live=true, an injected API key, and an estimated cost within the dashboard budget.'
    ],
    customer_dashboard_url: `/dashboard/articles?run_id=${encodeURIComponent(run.id)}`,
    internal_results_url: `/internal/tracking/runs/${encodeURIComponent(run.id)}/results`
  };
}

export async function getOpsControlCenterPayload({ settings = null } = {}) {
  const currentSettings = settings || (await getOpsRuntimeSettings());
  const config = getConfig();
  const [brands, recentPilots, recentFullTests] = await Promise.all([
    listOpsBrands(),
    listRecentPaidProviderPilots(),
    listRecentFullTrackingTests()
  ]);
  const fullTrackingPreviews = await listOpsFullTrackingPreviews(brands);

  return {
    schema_version: OPS_CONTROL_CENTER_SCHEMA,
    status: 'active',
    generated_at: new Date().toISOString(),
    settings: currentSettings,
    runtime_config_preview: {
      live_provider_testing_enabled: currentSettings.live_provider_testing_enabled,
      default_provider_mode: currentSettings.default_provider_mode,
      max_estimated_cost_usd: currentSettings.max_estimated_cost_usd,
      openrouter_api_key_present: Boolean(config.openrouterApiKey),
      openrouter_api_key_value: config.openrouterApiKey ? '[redacted]' : null,
      openrouter_base_url_present: Boolean(config.openrouterBaseUrl),
      scheduler_provider_mode: config.schedulerProviderMode,
      scheduler_paid_provider_allowed: config.schedulerAllowPaidProvider === true,
      continuous_paid_jobs_allowed: false
    },
    brands,
    model_targets: modelTargets,
    full_tracking_previews: fullTrackingPreviews,
    recent_paid_provider_pilots: recentPilots,
    recent_full_tracking_tests: recentFullTests,
    guardrails: [
      'Dashboard live provider pilots remain one-call bounded and ledgered.',
      'Configure an explicit provider before executing a GEO run. Mock providers are test-only.',
      'Runtime settings apply to internal pilot controls, not scheduler live execution.',
      'Provider keys are never exposed in dashboard payloads.',
      'Customer and brand intake creates active local records only; it does not bill, email, publish, deploy, or run tracking automatically.'
    ]
  };
}

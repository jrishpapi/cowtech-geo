import { assertProviderConfigured } from './provider-configuration.js';
import { randomUUID } from 'node:crypto';
import { pool } from './db.js';
import { createProvider } from './providers/index.js';
import { estimatePromptTrackingCall } from './cost-estimator.js';
import { assertMonthlyQuotaAllowed, assertStaticPlanLimit, recordQuotaUsageEvent } from './quota-bridge.js';
import { classifyProviderError } from './errors.js';
import { assertPaidProviderAllowed } from './provider-policy.js';
import { assertLiveProviderGateAllowed, getLiveProviderGateForCustomer } from './live-provider-controls.js';
import { getCustomerAddonSummary } from './customer-addons.js';
import { getConfig } from './config.js';
import { fanOutTrackingRun } from './tracking-observation-pipeline.js';
import { customerVisibleTenantPredicate } from './customer-tenant-visibility.js';
import { assertCustomerTrackingRunAllowed } from './customer-tracking-run-boundary.js';
import { CommercialLiveProviderBudgetGate } from './costing/external-spend-gate.js';

export async function listBrands() {
  const result = await pool.query(
    `SELECT b.id, b.name, b.website_url, b.vertical, c.plan_code
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     WHERE ${customerVisibleTenantPredicate('c')}
     ORDER BY b.name`
  );
  return result.rows;
}

export async function resolveBrand({ brand_id, brand_name }) {
  if (brand_id) {
    const result = await pool.query(
      `SELECT b.*, c.plan_code, c.id AS customer_id
       FROM brands b
       JOIN customers c ON c.id = b.customer_id
       WHERE b.id = $1
         AND ${customerVisibleTenantPredicate('c')}`,
      [brand_id]
    );
    return result.rows[0] || null;
  }

  if (brand_name) {
    const result = await pool.query(
      `SELECT b.*, c.plan_code, c.id AS customer_id
       FROM brands b
       JOIN customers c ON c.id = b.customer_id
       WHERE LOWER(b.name) = LOWER($1)
         AND ${customerVisibleTenantPredicate('c')}
       LIMIT 1`,
      [brand_name]
    );
    return result.rows[0] || null;
  }

  return null;
}

export function buildScheduledRunKey({ brand_id, date = new Date() }) {
  const day = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return `scheduled:${brand_id}:${day}`;
}

export function buildRecurringMonitoringRunKey({ config_id, date = new Date() }) {
  const day = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return `recurring-monitoring:${config_id}:${day}`;
}

function normalizeRegion(value = 'US') {
  return String(value || 'US').trim().toUpperCase() || 'US';
}

function normalizeLanguage(value = 'en') {
  return String(value || 'en').trim().toLowerCase() || 'en';
}

function engineForProvider(providerMode, providerId) {
  if (providerMode === 'openrouter' || providerId === 'openrouter') return 'openrouter_llm';
  if (providerMode === 'perplexity' || providerId === 'perplexity') return 'perplexity_search';
  if (providerMode === 'google_ai_overview' || providerId === 'google_ai_overview') return 'google_aio';
  if (providerMode === 'chatgpt_api_like' || providerId === 'chatgpt_api_like') return 'chatgpt_api_like';
  if (providerMode === 'gemini_api_like' || providerId === 'gemini_api_like') return 'gemini_api_like';
  if (providerMode === 'claude_api_like' || providerId === 'claude_api_like') return 'claude_api_like';
  if (providerMode === 'grok_api_like' || providerId === 'grok_api_like') return 'grok_api_like';
  return 'mock_llm';
}

export function openRouterModelIdsForSurface(surfaceKey = '') {
  return {
    chatgpt: ['openai/gpt-4o-mini'],
    perplexity: ['perplexity/sonar'],
    gemini: ['google/gemini-2.5-flash-lite', 'google/gemini-2.5-flash'],
    grok: ['x-ai/grok-4.20'],
    qwen: ['qwen/qwen3.6-plus:online'],
    deepseek: ['deepseek/deepseek-chat'],
    mistral: ['mistralai/mistral-nemo']
  }[String(surfaceKey || '').trim().toLowerCase()] || [];
}

export async function createTrackingRun({
  brand_id,
  brand_name,
  prompt_set_id,
  run_type = 'manual',
  idempotency_key,
  region = 'US',
  language = 'en',
  run_payload = {}
}) {
  const brand = await resolveBrand({ brand_id, brand_name });
  if (!brand) {
    throw new Error('brand not found');
  }

  const promptSet = prompt_set_id
    ? await pool.query(
        `SELECT id
         FROM prompt_sets
         WHERE id = $1 AND brand_id = $2
         LIMIT 1`,
        [prompt_set_id, brand.id]
      )
    : await pool.query(
        `SELECT id
     FROM prompt_sets
     WHERE brand_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
        [brand.id]
      );

  if (promptSet.rowCount !== 1) {
    throw new Error(`active prompt set not found for brand ${brand.name}`);
  }

  const key =
    idempotency_key ||
    (run_type === 'scheduled' ? buildScheduledRunKey({ brand_id: brand.id }) : `${run_type}:${brand.id}:${randomUUID()}`);

  const existing = await pool.query('SELECT * FROM tracking_runs WHERE idempotency_key = $1 LIMIT 1', [key]);
  if (existing.rowCount > 0) {
    return {
      ...existing.rows[0],
      was_created: false
    };
  }

  const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [brand.plan_code]);
  if (planResult.rowCount !== 1) {
    throw new Error(`plan not found: ${brand.plan_code}`);
  }
  if (run_type === 'scheduled') {
    await assertMonthlyQuotaAllowed({
      customer_id: brand.customer_id,
      brand_id: brand.id,
      plan: planResult.rows[0],
      quota_type: 'scheduled_run',
      requested_units: 1,
      metadata: {
        source: 'create_tracking_run',
        run_type
      }
    });
  }
  if (run_type === 'post_publish_retest') {
    let retestMetadata = {};
    const scheduleId = String(key).startsWith('article-retest:') ? String(key).slice('article-retest:'.length) : null;
    if (scheduleId) {
      const schedule = await pool.query(
        `SELECT id, tracking_run_id
         FROM article_retest_schedules
         WHERE id = $1`,
        [scheduleId]
      );
      if (schedule.rowCount) {
        retestMetadata = {
          retest_schedule_id: schedule.rows[0].id,
          source_tracking_run_id: schedule.rows[0].tracking_run_id
        };
      }
    }
    await assertMonthlyQuotaAllowed({
      customer_id: brand.customer_id,
      brand_id: brand.id,
      plan: planResult.rows[0],
      quota_type: 'manual_retest',
      requested_units: 1,
      metadata: {
        source: 'create_tracking_run',
        run_type,
        ...retestMetadata
      }
    });
  }

  const result = await pool.query(
    `INSERT INTO tracking_runs (brand_id, prompt_set_id, status, run_type, idempotency_key, region, language, run_payload)
     VALUES ($1, $2, 'queued', $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [
      brand.id,
      promptSet.rows[0].id,
      run_type,
      key,
      normalizeRegion(region),
      normalizeLanguage(language),
      JSON.stringify(run_payload || {})
    ]
  );

  return {
    ...result.rows[0],
    was_created: true
  };
}

async function loadTrackingContext(trackingRunId) {
  const runResult = await pool.query(
    `SELECT tr.*, b.name, b.website_url, b.vertical, b.locale, c.id AS customer_id, c.plan_code,
            c.live_provider_enabled AS customer_live_provider_enabled
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE tr.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [trackingRunId]
  );

  if (runResult.rowCount !== 1) {
    throw new Error(`tracking run not found: ${trackingRunId}`);
  }

  const run = runResult.rows[0];
  const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [run.plan_code]);
  if (planResult.rowCount !== 1) {
    throw new Error(`plan not found: ${run.plan_code}`);
  }
  const addons = await getCustomerAddonSummary({ customer_id: run.customer_id });
  const addonTotals = addons?.totals || {};
  const effectivePlan = {
    ...planResult.rows[0],
    competitor_limit: Number(planResult.rows[0].competitor_limit || 0) + Number(addonTotals.competitor || 0),
    article_drafts_max: Number(planResult.rows[0].article_drafts_max || 0) + Number(addonTotals.article || 0),
    monthly_provider_call_limit:
      Number(planResult.rows[0].monthly_provider_call_limit || 0) + Number(addonTotals.credits || 0),
    customer_live_provider_enabled: run.customer_live_provider_enabled === true
  };

  const prompts = await pool.query(
    `SELECT p.*
     FROM prompts p
     WHERE p.prompt_set_id = $1 AND COALESCE(p.status, 'active') = 'active'
     ORDER BY p.priority DESC, p.created_at ASC
     LIMIT $2`,
    [run.prompt_set_id, effectivePlan.monthly_prompt_limit]
  );

  const modelTargets = await pool.query(
    `SELECT *
     FROM model_targets
     WHERE status = 'active'
     ORDER BY created_at ASC
     LIMIT $1`,
    [effectivePlan.model_limit]
  );

  const competitors = await pool.query(
    `SELECT *
     FROM competitors
     WHERE brand_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [run.brand_id, effectivePlan.competitor_limit]
  );

  assertStaticPlanLimit({
    plan: effectivePlan,
    quota_type: 'prompt_count',
    current_usage: 0,
    requested_units: prompts.rowCount
  });
  assertStaticPlanLimit({
    plan: effectivePlan,
    quota_type: 'model_count',
    current_usage: 0,
    requested_units: modelTargets.rowCount
  });
  assertStaticPlanLimit({
    plan: effectivePlan,
    quota_type: 'competitor_count',
    current_usage: 0,
    requested_units: competitors.rowCount
  });

  return {
    run,
    brand: {
      id: run.brand_id,
      name: run.name,
      website_url: run.website_url,
      vertical: run.vertical,
      locale: run.locale
    },
    customer_id: run.customer_id,
    plan: effectivePlan,
    prompts: prompts.rows,
    modelTargets: modelTargets.rows,
    competitors: competitors.rows
  };
}

export async function executeTrackingRun({
  tracking_run_id,
  provider_mode = 'unconfigured',
  allow_paid_provider = false,
  boundary_database = pool
}) {
  await assertCustomerTrackingRunAllowed(tracking_run_id, { database: boundary_database });
  assertProviderConfigured(provider_mode);
  const runtimeConfig = getConfig();
  if (runtimeConfig.phase1ObservationLedgerEnabled) {
    if (provider_mode !== 'mock' || allow_paid_provider === true) {
      throw new Error('Phase 1 durable fan-out is transport-disarmed and requires provider_mode=mock');
    }
    const runResult = await boundary_database.query(
      `SELECT tr.created_at, tr.run_payload
       FROM tracking_runs AS tr
       JOIN brands AS b ON b.id = tr.brand_id
       JOIN customers AS c ON c.id = b.customer_id
       WHERE tr.id = $1
         AND ${customerVisibleTenantPredicate('c')}`,
      [tracking_run_id]
    );
    if (!runResult.rows[0]) throw new Error(`tracking run not found: ${tracking_run_id}`);
    const run = runResult.rows[0];
    const scheduledFor = run.run_payload?.scheduled_for || run.created_at || new Date().toISOString();
    const cycleStart = run.run_payload?.cycle_start || new Date(scheduledFor).toISOString().slice(0, 8) + '01';
    return fanOutTrackingRun({
      pool,
      tracking_run_id,
      scheduled_for: scheduledFor,
      cycle_start: cycleStart,
      device: run.run_payload?.device || 'desktop',
      monitoring_timezone: run.run_payload?.monitoring_timezone || 'UTC',
      enabled: true
    });
  }
  assertPaidProviderAllowed({ provider_mode, allow_paid_provider });
  const context = await loadTrackingContext(tracking_run_id);
  const provider = createProvider(provider_mode);
  const maxRetries = 2;
  const surfaceModelIds = provider_mode === 'openrouter' ? openRouterModelIdsForSurface(context.run.run_payload?.surface_key) : [];
  let surfaceModelTargets = surfaceModelIds.length
    ? context.modelTargets.filter((target) => surfaceModelIds.includes(target.model_id))
    : [];
  if (surfaceModelIds.length && surfaceModelTargets.length === 0) {
    const selected = await pool.query(
      `SELECT *
       FROM model_targets
       WHERE status = 'active'
         AND model_id = ANY($1::text[])
       ORDER BY array_position($1::text[], model_id)
       LIMIT 1`,
      [surfaceModelIds]
    );
    surfaceModelTargets = selected.rows;
  }
  const modelTargets = surfaceModelTargets.length ? surfaceModelTargets.slice(0, 1) : context.modelTargets;
  let failures = 0;
  const executionTargets =
    provider.singleSurfaceRun && typeof provider.getModelTargets === 'function'
      ? provider.getModelTargets(modelTargets)
      : modelTargets;
  const plannedCalls = context.prompts.length * executionTargets.length;
  const estimatedRunCost = context.prompts.reduce(
    (sum, prompt) =>
      sum +
      executionTargets.reduce(
        (modelSum, modelTarget) =>
          modelSum +
          estimatePromptTrackingCall({
            model_id: modelTarget.model_id,
            prompt_text: prompt.prompt_text
          }).estimated_cost_usd,
        0
      ),
    0
  );

  if (provider_mode !== 'mock') {
    const liveGate = await getLiveProviderGateForCustomer({
      customer_id: context.customer_id,
      customer: {
        live_provider_enabled: context.plan.customer_live_provider_enabled
      },
      plan: context.plan,
      provider_mode,
      allow_paid_provider,
      requested_calls: plannedCalls,
      estimated_cost_usd: estimatedRunCost
    });
    assertLiveProviderGateAllowed(liveGate);
    await assertMonthlyQuotaAllowed({
      customer_id: context.customer_id,
      brand_id: context.brand.id,
      plan: context.plan,
      quota_type: 'provider_call',
      requested_units: plannedCalls,
      metadata: {
        source: 'execute_tracking_run',
        run_type: context.run.run_type,
        provider_mode
      }
    });
  }

  const runBudgetGate = provider_mode === 'mock'
    ? null
    : new CommercialLiveProviderBudgetGate({
        trackingRunId: tracking_run_id,
        capMicroUsd: Math.round(Number(context.plan.monitoring_run_cost_limit_usd || 0) * 1_000_000)
      });

  await pool.query(
    `UPDATE tracking_runs
     SET status = 'running',
         started_at = COALESCE(started_at, NOW()),
         provider_mode = $2,
         region = COALESCE(region, $3),
         language = COALESCE(language, $4)
     WHERE id = $1`,
    [tracking_run_id, provider_mode, normalizeRegion(context.run.region), normalizeLanguage(context.run.language || context.brand.locale)]
  );

  for (const prompt of context.prompts) {
    for (const modelTarget of executionTargets) {
      try {
        const estimate = estimatePromptTrackingCall({
          model_id: modelTarget.model_id,
          prompt_text: prompt.prompt_text
        });
        const response = await runProviderWithRetry({
          provider,
          brand: context.brand,
          competitors: context.competitors,
          modelTarget,
          prompt,
          maxRetries,
          budgetGate: runBudgetGate,
          trackingRunId: tracking_run_id,
          maxCostMicroUsd: Math.max(50_000, Math.ceil(estimate.estimated_cost_usd * 3_000_000))
        });
        const costEstimate = response.usage.cost_estimate_usd || (provider_mode === 'mock' ? 0 : estimate.estimated_cost_usd);

        await pool.query(
          `INSERT INTO prompt_results (
            tracking_run_id, prompt_id, model_target_id, provider_id, model_id,
            status, raw_answer, normalized_answer, cost_estimate_usd, engine, region, language
          )
          VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9, $10, $11)`,
          [
            tracking_run_id,
            prompt.id,
            modelTarget.id,
            response.provider_id,
            response.model_id,
            response.raw_answer,
            JSON.stringify(response.normalized_answer),
            costEstimate,
            engineForProvider(provider_mode, response.provider_id),
            normalizeRegion(context.run.region),
            normalizeLanguage(context.run.language || context.brand.locale)
          ]
        );

        await pool.query(
          `INSERT INTO usage_ledger (customer_id, brand_id, event_type, units, cost_estimate_usd, metadata)
           VALUES ($1, $2, 'provider_call', 1, $3, $4)`,
          [
            context.customer_id,
            context.brand.id,
            costEstimate,
            JSON.stringify({
              tracking_run_id,
              provider_mode,
              provider_id: response.provider_id,
              model_id: response.model_id,
              prompt_id: prompt.id,
              retry_count: response.retry_count,
              estimated_tokens: {
                input_tokens: estimate.input_tokens,
                output_tokens: estimate.output_tokens
              }
            })
          ]
        );
      } catch (error) {
        failures += 1;
        const classified = classifyProviderError(error);
        if (provider_mode !== 'mock') {
          const failedEstimate = estimatePromptTrackingCall({
            model_id: modelTarget.model_id,
            prompt_text: prompt.prompt_text
          });
          const conservativeAttemptCostUsd =
            Math.max(0.015, failedEstimate.estimated_cost_usd * 1.5) * (Number(error.retry_count || 0) + 1);
          await recordQuotaUsageEvent({
            customer_id: context.customer_id,
            brand_id: context.brand.id,
            event_type: 'provider_call_failed',
            quota_type: 'provider_call',
            units: Number(error.retry_count || 0) + 1,
            cost_estimate_usd: conservativeAttemptCostUsd,
            status: 'failed',
            metadata: {
              source: 'execute_tracking_run',
              run_type: context.run.run_type,
              provider_mode,
              result_status: classified.code,
              retry_count: Number(error.retry_count || 0)
            }
          });
        }
        await pool.query(
          `INSERT INTO prompt_results (
            tracking_run_id, prompt_id, model_target_id, provider_id, model_id,
            status, error_code, error_message, retry_count, engine, region, language
          )
          VALUES ($1, $2, $3, $4, $5, 'failed', $6, $7, $8, $9, $10, $11)`,
          [
            tracking_run_id,
            prompt.id,
            modelTarget.id,
            provider.providerId,
            modelTarget.model_id,
            classified.code,
            classified.message.slice(0, 1000),
            Number(error.retry_count || 0),
            engineForProvider(provider_mode, provider.providerId),
            normalizeRegion(context.run.region),
            normalizeLanguage(context.run.language || context.brand.locale)
          ]
        );
      }
    }
  }

  const resultCount = context.prompts.length * executionTargets.length;
  const status = failures === 0 ? 'completed' : failures === resultCount ? 'failed' : 'partial_failed';
  await pool.query(
    `UPDATE tracking_runs
     SET status = $2, finished_at = NOW()
     WHERE id = $1`,
    [tracking_run_id, status]
  );

  return {
    tracking_run_id,
    status,
    prompt_count: context.prompts.length,
    model_count: executionTargets.length,
    result_count: resultCount,
    failures
  };
}

async function runProviderWithRetry({
  provider,
  brand,
  competitors,
  modelTarget,
  prompt,
  maxRetries,
  budgetGate = null,
  trackingRunId = '',
  maxCostMicroUsd = 0
}) {
  let lastError;
  let retryCount = 0;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const permit = budgetGate
      ? budgetGate.reserve({
          attempt_id: `${trackingRunId}:${prompt.id}:${modelTarget.id}:${attempt}`,
          transport_supplier: provider.transportSupplier || provider.providerId,
          max_cost_micro_usd: maxCostMicroUsd
        })
      : null;
    let permitFinalized = false;
    try {
      const response = await provider.runPrompt({
        brand,
        competitors,
        modelTarget,
        prompt,
        transport_permit: permit
      });
      if (permit) {
        const actualCostMicroUsd = Math.max(
          0,
          Math.ceil(Number(response.usage?.cost_estimate_usd || maxCostMicroUsd / 1_000_000) * 1_000_000)
        );
        permitFinalized = true;
        budgetGate.settle({ permit_id: permit.permit_id, actual_cost_micro_usd: actualCostMicroUsd });
      }
      return {
        ...response,
        retry_count: attempt
      };
    } catch (error) {
      if (permit && !permitFinalized) {
        permitFinalized = true;
        try {
          budgetGate.settle({ permit_id: permit.permit_id, actual_cost_micro_usd: maxCostMicroUsd });
        } catch (settlementError) {
          if (/cannot settle before transport starts/i.test(String(settlementError?.message || ''))) {
            budgetGate.release({ permit_id: permit.permit_id });
          } else {
            throw settlementError;
          }
        }
      }
      lastError = error;
      retryCount = attempt;
      const classified = classifyProviderError(error);
      if (!classified.retryable) break;
      if (attempt === maxRetries) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  lastError.retry_count = Math.min(maxRetries, lastError.retry_count ?? retryCount);
  throw lastError;
}

export async function getTrackingRun(trackingRunId) {
  const run = await pool.query(
    `SELECT tr.*
     FROM tracking_runs tr
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE tr.id = $1
       AND ${customerVisibleTenantPredicate('c')}`,
    [trackingRunId]
  );
  if (run.rowCount !== 1) return null;

  const summary = await pool.query(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(cost_estimate_usd), 0)::numeric AS cost
     FROM prompt_results
     WHERE tracking_run_id = $1
     GROUP BY status
     ORDER BY status`,
    [trackingRunId]
  );

  return {
    run: run.rows[0],
    summary: summary.rows
  };
}

export async function getTrackingResults(trackingRunId) {
  const results = await pool.query(
    `SELECT pr.id, pr.status, pr.provider_id, pr.model_id, pr.raw_answer,
            pr.cost_estimate_usd, pr.error_code, pr.error_message,
            p.category, p.prompt_text
     FROM prompt_results pr
     LEFT JOIN prompts p ON p.id = pr.prompt_id
     JOIN tracking_runs tr ON tr.id = pr.tracking_run_id
     JOIN brands b ON b.id = tr.brand_id
     JOIN customers c ON c.id = b.customer_id
     WHERE pr.tracking_run_id = $1
       AND ${customerVisibleTenantPredicate('c')}
     ORDER BY pr.created_at ASC`,
    [trackingRunId]
  );
  return results.rows;
}

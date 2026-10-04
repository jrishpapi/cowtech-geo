import { mkdir, writeFile } from 'node:fs/promises';
import { pool } from './db.js';
import { estimatePromptTrackingCall } from './cost-estimator.js';
import { assertPaidProviderAllowed } from './provider-policy.js';
import { createProvider } from './providers/index.js';
import { parseAnswer } from './parser.js';

export function parseOpenRouterSmokeArgs(argv = []) {
  return {
    execute: argv.includes('--execute'),
    allow_paid_provider: argv.includes('--allow-paid-provider'),
    save_fixture: argv.includes('--save-fixture'),
    fixture_name: readArgValue(argv, '--fixture-name') || '',
    brand_name: readArgValue(argv, '--brand') || '',
    prompt_index: Number(readArgValue(argv, '--prompt-index') || 0),
    model_index: Number(readArgValue(argv, '--model-index') || 0)
  };
}

function readArgValue(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return '';
  return argv[index + 1] || '';
}

export async function buildOpenRouterSmokePlan({
  brand_name = '',
  prompt_index = 0,
  model_index = 0
} = {}) {
  const brandResult = await pool.query(
    `SELECT b.id, b.name, b.website_url, b.vertical, b.locale, c.id AS customer_id, c.plan_code
     FROM brands b
     JOIN customers c ON c.id = b.customer_id
     WHERE LOWER(b.name) = LOWER($1)
     LIMIT 1`,
    [brand_name]
  );
  if (brandResult.rowCount !== 1) {
    throw new Error(`brand not found for OpenRouter smoke: ${brand_name}`);
  }

  const brand = brandResult.rows[0];
  const promptResult = await pool.query(
    `SELECT p.*
     FROM prompts p
     JOIN prompt_sets ps ON ps.id = p.prompt_set_id
     WHERE ps.brand_id = $1 AND ps.status = 'active'
     ORDER BY p.created_at ASC
     OFFSET $2
     LIMIT 1`,
    [brand.id, prompt_index]
  );
  if (promptResult.rowCount !== 1) {
    throw new Error(`prompt not found for OpenRouter smoke index: ${prompt_index}`);
  }

  const modelResult = await pool.query(
    `SELECT *
     FROM model_targets
     WHERE provider_id = 'openrouter' AND status = 'active'
     ORDER BY created_at ASC
     OFFSET $1
     LIMIT 1`,
    [model_index]
  );
  if (modelResult.rowCount !== 1) {
    throw new Error(`model target not found for OpenRouter smoke index: ${model_index}`);
  }

  const competitors = await pool.query(
    `SELECT name, website_url, aliases
     FROM competitors
     WHERE brand_id = $1
     ORDER BY created_at ASC
     LIMIT 3`,
    [brand.id]
  );

  const prompt = promptResult.rows[0];
  const modelTarget = modelResult.rows[0];
  const estimate = estimatePromptTrackingCall({
    model_id: modelTarget.model_id,
    prompt_text: prompt.prompt_text,
    expected_output_tokens: 600
  });

  return {
    provider_mode: 'openrouter',
    planned_calls: 1,
    brand,
    prompt: {
      id: prompt.id,
      category: prompt.category,
      prompt_text: prompt.prompt_text
    },
    model_target: {
      id: modelTarget.id,
      model_id: modelTarget.model_id,
      display_name: modelTarget.display_name
    },
    competitors: competitors.rows,
    estimate
  };
}

export async function runOpenRouterSmoke(options = {}) {
  const plan = await buildOpenRouterSmokePlan(options);

  if (!options.execute) {
    return {
      dry_run: true,
      would_execute: false,
      approval_required: true,
      required_flags: ['--execute', '--allow-paid-provider'],
      plan
    };
  }

  assertPaidProviderAllowed({
    provider_mode: 'openrouter',
    allow_paid_provider: options.allow_paid_provider === true
  });

  const provider = createProvider('openrouter');
  const response = await provider.runPrompt({
    brand: plan.brand,
    competitors: plan.competitors,
    modelTarget: plan.model_target,
    prompt: plan.prompt
  });

  const savedFixture = options.save_fixture
    ? await saveOpenRouterFixture({ options, plan, response })
    : null;

  return {
    dry_run: false,
    would_execute: true,
    plan,
    response: {
      provider_id: response.provider_id,
      model_id: response.model_id,
      answer_chars: response.raw_answer.length,
      answer_preview: response.raw_answer.slice(0, 2000),
      usage: response.usage,
      provider_response_id: response.normalized_answer.provider_response_id
    },
    saved_fixture: savedFixture
  };
}

async function saveOpenRouterFixture({ options, plan, response }) {
  const fixtureDir = new URL('../fixtures/parser/openrouter/', import.meta.url);
  await mkdir(fixtureDir, { recursive: true });

  const parsed = parseAnswer({
    raw_answer: response.raw_answer,
    brand: plan.brand,
    competitors: plan.competitors
  });
  const name = options.fixture_name || `${plan.brand.name}-${plan.model_target.model_id}-${Date.now()}`;
  const filename = `${sanitizeFilename(name)}.json`;
  const fixture = {
    name,
    source: 'openrouter-smoke',
    provider_response_id: response.normalized_answer.provider_response_id,
    provider_id: response.provider_id,
    model_id: response.model_id,
    prompt_category: plan.prompt.category,
    prompt_text: plan.prompt.prompt_text,
    brand: {
      id: plan.brand.id,
      name: plan.brand.name,
      website_url: plan.brand.website_url
    },
    competitors: plan.competitors,
    raw_answer: response.raw_answer,
    expect: {
      brand_mentioned: parsed.summary.brand_mentioned,
      min_competitor_mentions: parsed.summary.competitor_mentions,
      min_source_url_count: parsed.summary.source_url_count,
      domains: parsed.sources.domains
    }
  };

  const pathname = new URL(filename, fixtureDir);
  await writeFile(pathname, `${JSON.stringify(fixture, null, 2)}\n`);
  return pathname.pathname;
}

function sanitizeFilename(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

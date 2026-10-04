import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  FROZEN_PLAN_CONTRACTS,
  FROZEN_PLAN_CONTRACT_VERSION,
  STANDARD_SURFACES,
  assertOriginalPromptPreserved
} from './frozen-observation-contract.js';

export const STARTER_POC_COHORT_ID = 'starter-4000-v1';
export const STARTER_POC_DATASET_SCHEMA_VERSION = 'starter-poc-demand-dataset-v1';
export const STARTER_POC_FLEX_ALLOCATION = Object.freeze({
  chatgpt_ui: Object.freeze(['gp-001', 'gp-002', 'gp-003', 'gp-004', 'gp-005', 'gp-006', 'gp-007', 'gp-008', 'gp-009', 'gp-010', 'gp-011', 'gp-012', 'gp-013', 'gp-014']),
  perplexity_ui: Object.freeze(['gp-015', 'gp-016', 'gp-017', 'gp-018', 'gp-019', 'gp-020', 'gp-021', 'gp-022', 'gp-023', 'gp-024', 'gp-025', 'gp-026', 'gp-027']),
  google_aio: Object.freeze(['gp-028', 'gp-029', 'gp-030', 'gp-031', 'gp-032', 'gp-033', 'gp-034', 'gp-035', 'gp-036', 'gp-037', 'gp-038', 'gp-039', 'gp-040'])
});

const goldenPromptUrl = new URL('../../docs/poc/starter-golden-prompts-v1.json', import.meta.url);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizePromptForCollection(promptText) {
  return promptText.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function canonicalDemandIdentity({ prompt_hash, surface, region, language, device, daily_bucket }) {
  return JSON.stringify({
    prompt_hash,
    surface,
    region,
    language,
    device,
    daily_bucket
  });
}

export function loadStarterGoldenPrompts() {
  const document = JSON.parse(readFileSync(goldenPromptUrl, 'utf8'));
  if (document.schema_version !== 'starter-golden-prompts-v1') {
    throw new Error('unsupported Starter golden prompt schema version');
  }
  if (document.contract_version !== FROZEN_PLAN_CONTRACT_VERSION) {
    throw new Error('golden prompt contract version does not match the frozen plan contract');
  }
  if (!Array.isArray(document.prompts) || document.prompts.length !== 44) {
    throw new Error('Starter golden prompt corpus must contain exactly 44 prompts');
  }

  const ids = new Set();
  const promptTexts = new Set();
  for (const prompt of document.prompts) {
    if (!/^gp-\d{3}$/.test(prompt.id || '')) throw new Error(`invalid golden prompt id: ${prompt.id || '<missing>'}`);
    if (ids.has(prompt.id)) throw new Error(`duplicate golden prompt id: ${prompt.id}`);
    ids.add(prompt.id);
    if (typeof prompt.prompt_text !== 'string' || !prompt.prompt_text.trim()) {
      throw new Error(`golden prompt ${prompt.id} has empty prompt_text`);
    }
    if (prompt.prompt_text !== prompt.prompt_text.trim()) {
      throw new Error(`golden prompt ${prompt.id} has leading or trailing whitespace`);
    }
    if (promptTexts.has(prompt.prompt_text)) throw new Error(`duplicate golden prompt text: ${prompt.id}`);
    promptTexts.add(prompt.prompt_text);
  }
  return document;
}

function buildDemand({ sequence, prompt, surface, dayIndex, device, workloadClass }) {
  const region = 'US';
  const language = 'en';
  const dailyBucket = `poc-day-${String(dayIndex).padStart(2, '0')}`;
  const originalPromptSha256 = sha256(Buffer.from(prompt.prompt_text, 'utf8'));
  const normalizedPromptHash = sha256(normalizePromptForCollection(prompt.prompt_text));
  const demandKey = sha256(
    canonicalDemandIdentity({
      prompt_hash: normalizedPromptHash,
      surface,
      region,
      language,
      device,
      daily_bucket: dailyBucket
    })
  );
  assertOriginalPromptPreserved({
    stored_prompt_text: prompt.prompt_text,
    submitted_prompt_text: prompt.prompt_text
  });
  return Object.freeze({
    schema_version: STARTER_POC_DATASET_SCHEMA_VERSION,
    cohort_id: STARTER_POC_COHORT_ID,
    sequence,
    demand_key: demandKey,
    prompt_id: prompt.id,
    prompt_category: prompt.category,
    prompt_text: prompt.prompt_text,
    original_prompt_sha256: originalPromptSha256,
    normalized_prompt_hash: normalizedPromptHash,
    surface,
    native_route: STANDARD_SURFACES[surface].route,
    acquisition_mode: STANDARD_SURFACES[surface].acquisition_mode,
    region,
    language,
    device,
    daily_bucket: dailyBucket,
    day_index: dayIndex,
    workload_class: workloadClass,
    no_cache: surface === 'google_aio',
    customer_credit_units: 1,
    credit_settlement_rule: 'native_valid_observation_with_verified_evidence_only'
  });
}

export function buildStarterPocDataset() {
  const corpus = loadStarterGoldenPrompts();
  const promptById = new Map(corpus.prompts.map((prompt) => [prompt.id, prompt]));
  const surfaces = FROZEN_PLAN_CONTRACTS.starter.surfaces;
  const demands = [];
  let sequence = 1;

  for (let dayIndex = 1; dayIndex <= 30; dayIndex += 1) {
    for (const surface of surfaces) {
      for (const prompt of corpus.prompts) {
        demands.push(
          buildDemand({
            sequence,
            prompt,
            surface,
            dayIndex,
            device: 'desktop',
            workloadClass: 'daily_base'
          })
        );
        sequence += 1;
      }
    }
  }

  for (const surface of surfaces) {
    for (const promptId of STARTER_POC_FLEX_ALLOCATION[surface]) {
      const prompt = promptById.get(promptId);
      if (!prompt) throw new Error(`flex allocation references unknown prompt: ${promptId}`);
      demands.push(
        buildDemand({
          sequence,
          prompt,
          surface,
          dayIndex: 15,
          device: 'mobile',
          workloadClass: 'preallocated_flex_mobile_burst'
        })
      );
      sequence += 1;
    }
  }

  return Object.freeze(demands);
}

function countBy(items, keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

export function validateStarterPocDataset(demands = buildStarterPocDataset()) {
  const errors = [];
  const keys = new Set();
  const expectedDemands = buildStarterPocDataset();
  const promptById = new Map(loadStarterGoldenPrompts().prompts.map((prompt) => [prompt.id, prompt]));
  if (!Array.isArray(demands)) throw new TypeError('Starter POC demands must be an array');
  for (const [index, demand] of demands.entries()) {
    if (!demand || typeof demand !== 'object' || Array.isArray(demand)) {
      errors.push(`demand_${index + 1}_must_be_an_object`);
      continue;
    }
    if (keys.has(demand.demand_key)) errors.push(`duplicate_demand_key_${demand.demand_key}`);
    keys.add(demand.demand_key);
    try {
      assertOriginalPromptPreserved({
        stored_prompt_text: promptById.get(demand.prompt_id)?.prompt_text,
        submitted_prompt_text: demand.prompt_text
      });
    } catch {
      errors.push(`original_prompt_mismatch_${demand.prompt_id}_${demand.sequence}`);
    }

    const expected = expectedDemands[index];
    if (!expected) {
      errors.push(`unexpected_demand_at_index_${index}`);
      continue;
    }
    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(demand);
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key) => !expectedKeys.includes(key))) {
      errors.push(`demand_schema_mismatch_${index + 1}`);
    }
    for (const field of expectedKeys) {
      if (demand[field] !== expected[field]) errors.push(`demand_${index + 1}_${field}_mismatch`);
    }
  }

  const bySurface = countBy(demands, (demand) => demand.surface);
  const byClass = countBy(demands, (demand) => demand.workload_class);
  const expectedBySurface = { chatgpt_ui: 1334, perplexity_ui: 1333, google_aio: 1333 };
  if (demands.length !== 4000) errors.push('total_demand_count_must_equal_4000');
  if (byClass.daily_base !== 3960) errors.push('daily_base_count_must_equal_3960');
  if (byClass.preallocated_flex_mobile_burst !== 40) errors.push('flex_burst_count_must_equal_40');
  for (const [surface, expected] of Object.entries(expectedBySurface)) {
    if (bySurface[surface] !== expected) errors.push(`${surface}_count_must_equal_${expected}`);
  }
  if (Object.keys(bySurface).some((surface) => !FROZEN_PLAN_CONTRACTS.starter.surfaces.includes(surface))) {
    errors.push('dataset_contains_non_starter_surface');
  }
  if (demands.some((demand) => demand.surface === 'google_aio' && demand.no_cache !== true)) {
    errors.push('google_aio_demands_must_disable_supplier_cache');
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    counts: Object.freeze({
      total: demands.length,
      by_surface: Object.freeze(bySurface),
      by_workload_class: Object.freeze(byClass)
    }),
    dataset_sha256: sha256(JSON.stringify(demands))
  });
}

export function buildStarterPocManifest() {
  const corpus = loadStarterGoldenPrompts();
  const demands = buildStarterPocDataset();
  const validation = validateStarterPocDataset(demands);
  return Object.freeze({
    schema_version: 'starter-poc-manifest-v1',
    cohort_id: STARTER_POC_COHORT_ID,
    contract_version: FROZEN_PLAN_CONTRACT_VERSION,
    prompt_corpus_schema_version: corpus.schema_version,
    prompt_count: corpus.prompts.length,
    cycle_days: 30,
    base_device: 'desktop',
    flex_cohort: Object.freeze({
      device: 'mobile',
      day_index: 15,
      allocation: STARTER_POC_FLEX_ALLOCATION,
      allocation_is_fixed_before_run: true
    }),
    counts: validation.counts,
    dataset_sha256: validation.dataset_sha256,
    valid: validation.valid,
    errors: validation.errors
  });
}

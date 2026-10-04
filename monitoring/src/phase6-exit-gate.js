import { createHash } from 'node:crypto';
import { PHASE6_SURFACES } from './phase6-smoke-contract.js';

export const PHASE6_HUMAN_SAMPLE_PER_SURFACE = 5;
export const PHASE6_REQUIRED_SUPPLIERS = Object.freeze([
  'bright_data', 'serpapi', 'xai', 'openrouter', 'dashscope'
]);

function nonEmpty(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function nonNegativeInteger(value, name) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new TypeError(`${name} must be a non-negative integer`);
  }
  return normalized;
}

export function buildPhase6SupplierReconciliation(input = {}) {
  const supplier = nonEmpty(input.supplier, 'supplier');
  if (!PHASE6_REQUIRED_SUPPLIERS.includes(supplier)) {
    throw new RangeError(`unsupported Phase 6 supplier: ${supplier}`);
  }
  const localUnits = nonNegativeInteger(input.local_billable_units, 'local_billable_units');
  const supplierUnits = nonNegativeInteger(input.supplier_billable_units, 'supplier_billable_units');
  const billedCost = nonNegativeInteger(input.billed_cost_micro_usd, 'billed_cost_micro_usd');
  const statementRef = nonEmpty(input.statement_ref, 'statement_ref');
  const blockers = [];
  if (localUnits !== supplierUnits) blockers.push('billable_units_mismatch');
  if (billedCost === 0) blockers.push('zero_or_promotional_cost');
  return Object.freeze({
    schema_version: 'phase6-supplier-reconciliation-v1',
    supplier,
    local_billable_units: localUnits,
    supplier_billable_units: supplierUnits,
    billed_cost_micro_usd: billedCost,
    statement_ref: statementRef,
    captured_at: nonEmpty(input.captured_at, 'captured_at'),
    reconciliation_status: blockers.length ? 'blocked' : 'reconciled',
    blockers: Object.freeze(blockers)
  });
}

function stableRank(seed, item) {
  return createHash('sha256')
    .update(`${seed}\0${item.surface}\0${item.item_key || item.attempt_id || ''}`)
    .digest('hex');
}

export function selectPhase6HumanGoldenSample(results = [], {
  seed = 'phase6-human-golden-v1',
  perSurface = PHASE6_HUMAN_SAMPLE_PER_SURFACE
} = {}) {
  if (!Array.isArray(results)) throw new TypeError('results must be an array');
  if (!Number.isSafeInteger(perSurface) || perSurface < 1) {
    throw new TypeError('perSurface must be a positive integer');
  }
  const sample = [];
  const blockers = [];
  for (const surface of Object.keys(PHASE6_SURFACES)) {
    const rows = results.filter((row) =>
      row.surface === surface &&
      row.terminal === true &&
      row.delivery_valid === true &&
      row.evidence_verified === true
    );
    if (rows.length < perSurface) {
      blockers.push(`${surface}_insufficient_terminal_rows`);
      continue;
    }
    sample.push(...rows
      .map((row) => ({ row, rank: stableRank(seed, row) }))
      .sort((a, b) => a.rank.localeCompare(b.rank))
      .slice(0, perSurface)
      .map(({ row }) => Object.freeze({
        surface,
        item_key: nonEmpty(row.item_key || row.attempt_id, 'item_key'),
        evidence_ref: nonEmpty(row.evidence_ref, 'evidence_ref')
      })));
  }
  return Object.freeze({
    schema_version: 'phase6-human-golden-sample-v1',
    seed,
    per_surface: perSurface,
    expected_count: Object.keys(PHASE6_SURFACES).length * perSurface,
    sample: Object.freeze(sample),
    status: blockers.length ? 'blocked' : 'ready',
    blockers: Object.freeze(blockers)
  });
}

export function evaluatePhase6HumanGolden({ selection, reviews = [] } = {}) {
  const blockers = [...(selection?.blockers || [])];
  const byKey = new Map(reviews.map((review) => [review.item_key, review]));
  for (const item of selection?.sample || []) {
    const review = byKey.get(item.item_key);
    if (!review) {
      blockers.push(`${item.item_key}_review_missing`);
      continue;
    }
    if (!String(review.reviewer_id || '').trim()) blockers.push(`${item.item_key}_reviewer_missing`);
    if (!String(review.reviewed_at || '').trim()) blockers.push(`${item.item_key}_reviewed_at_missing`);
    if (review.answer_boundary_correct !== true) blockers.push(`${item.item_key}_answer_boundary_failed`);
    if (review.citations_correct !== true) blockers.push(`${item.item_key}_citations_failed`);
    if (review.brand_mentions_correct !== true) blockers.push(`${item.item_key}_brand_mentions_failed`);
    if (review.provenance_correct !== true) blockers.push(`${item.item_key}_provenance_failed`);
  }
  return Object.freeze({
    schema_version: 'phase6-human-golden-evaluation-v1',
    reviewed_count: reviews.length,
    expected_count: selection?.expected_count || 0,
    status: blockers.length ? 'blocked' : 'passed',
    blockers: Object.freeze(blockers)
  });
}

export function buildPhase6ToPhase7Gate({
  smokeEvaluation,
  humanEvaluation,
  canaries = [],
  requireVerifiedBulkCanaries = false,
  phase6CompletionAuthorityRef = '',
  phase7AuthorizationRef = '',
  phase7BudgetMicroUsd = 0
} = {}) {
  const blockers = [];
  if (smokeEvaluation?.exit_status !== 'PHASE6_EXIT_PASSED') blockers.push('phase6_smoke_exit_not_passed');
  if (!['passed', 'waived'].includes(humanEvaluation?.status)) {
    blockers.push('phase6_human_golden_not_passed');
  }
  const grokCanary = canaries.find((row) =>
    row.surface === 'grok-api' &&
    ['xai', 'openrouter'].includes(row.supplier) &&
    row.status === 'passed' &&
    (!requireVerifiedBulkCanaries || row.source === 'verified-completed-bulk')
  );
  if (!grokCanary) blockers.push('grok-api_canary_not_passed');
  if (!canaries.some((row) =>
    row.surface === 'qwen-dashscope' &&
    row.status === 'passed' &&
    (!requireVerifiedBulkCanaries || row.source === 'verified-completed-bulk')
  )) {
    blockers.push('qwen-dashscope_canary_not_passed');
  }
  if (!String(phase6CompletionAuthorityRef || '').trim()) blockers.push('phase6_completion_authority_missing');
  const phase6Complete = blockers.length === 0;
  const phase7Authorized = phase6Complete &&
    String(phase7AuthorizationRef || '').trim().length > 0 &&
    Number.isSafeInteger(phase7BudgetMicroUsd) &&
    phase7BudgetMicroUsd > 0;
  return Object.freeze({
    schema_version: 'phase6-to-phase7-gate-v1',
    phase6_status: phase6Complete ? 'PHASE6_COMPLETE' : 'PHASE6_EXIT_NOT_PASSED',
    phase7_status: phase7Authorized ? 'PHASE7_AUTHORIZED' : 'PHASE7_FROZEN',
    blockers: Object.freeze(blockers),
    phase7_blockers: Object.freeze(phase7Authorized ? [] : [
      ...(!phase6Complete ? ['phase6_not_complete'] : []),
      ...(!String(phase7AuthorizationRef || '').trim() ? ['phase7_authorization_missing'] : []),
      ...(!(Number.isSafeInteger(phase7BudgetMicroUsd) && phase7BudgetMicroUsd > 0)
        ? ['phase7_budget_missing']
        : [])
    ])
  });
}

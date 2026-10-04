import {
  evaluatePhase6Smoke
} from './phase6-smoke-contract.js';
import {
  selectPhase6HumanGoldenSample,
  evaluatePhase6HumanGolden,
  buildPhase6ToPhase7Gate
} from './phase6-exit-gate.js';

const REVIEW_FIELDS = Object.freeze([
  'answer_boundary_correct',
  'citations_correct',
  'brand_mentions_correct',
  'provenance_correct'
]);

const AUTHORIZED_WAIVER_FIELDS = Object.freeze([
  'supplier_reconciliation',
  'human_golden_parser_review'
]);

function resultPayload(item) {
  return item?.result_payload && typeof item.result_payload === 'object'
    ? item.result_payload
    : {};
}

export function buildPhase6CloseoutResults(items = [], reviews = []) {
  if (!Array.isArray(items) || !Array.isArray(reviews)) {
    throw new TypeError('items and reviews must be arrays');
  }
  const reviewByKey = new Map(reviews.map((review) => [review.item_key, review]));
  return Object.freeze(items.map((item) => {
    const payload = resultPayload(item);
    const review = reviewByKey.get(item.item_key);
    const reviewedFields = review ? REVIEW_FIELDS.length : 0;
    const correctFields = review
      ? REVIEW_FIELDS.filter((field) => review[field] === true).length
      : Number(payload.parser_correct_fields || 0);
    return Object.freeze({
      item_key: item.item_key,
      surface: item.surface,
      status: item.status,
      terminal: ['completed', 'failed'].includes(item.status),
      delivery_valid: payload.delivery_valid === true,
      native_valid: payload.native_valid === true,
      acquisition_mode: item.acquisition_mode,
      official_api_supplier: item.official_api_supplier || null,
      parser_evaluated_fields: review
        ? reviewedFields
        : Number(payload.parser_evaluated_fields || 0),
      parser_correct_fields: correctFields,
      evidence_verified: payload.evidence_verified === true,
      structural_failure: payload.structural_failure === true,
      failure_audit_verified: item.status !== 'failed' || (
        payload.structural_failure === true &&
        String(payload.error_code || '').trim().length > 0 &&
        String(payload.failure_detail || '').trim().length > 0
      ),
      evidence_ref: payload.evidence_manifest?.object_path || null
    });
  }));
}

export function buildPhase6CloseoutSnapshot({
  items = [],
  reconciliations = [],
  reviews = [],
  canaries = [],
  completionAuthorityRef = '',
  acceptanceWaiver = null,
  selectionSeed = 'phase6-human-golden-v1'
} = {}) {
  const results = buildPhase6CloseoutResults(items, reviews);
  const waiverAuthorityRef = String(acceptanceWaiver?.authority_ref || '').trim();
  const waiverEnabled = waiverAuthorityRef.length > 0 &&
    AUTHORIZED_WAIVER_FIELDS.every((field) => acceptanceWaiver?.[field] === true);
  const selection = selectPhase6HumanGoldenSample(results, { seed: selectionSeed });
  const selectedKeys = new Set(selection.sample.map((item) => item.item_key));
  const selectedReviews = reviews.filter((review) => selectedKeys.has(review.item_key));
  const unwaivedHumanEvaluation = evaluatePhase6HumanGolden({ selection, reviews: selectedReviews });
  const unwaivedSmokeEvaluation = evaluatePhase6Smoke(results, reconciliations);
  const failureAuditBlockers = results
    .filter((row) => row.status === 'failed' && row.failure_audit_verified !== true)
    .map((row) => `${row.item_key}_failure_audit_missing`);
  const retainedTechnicalBlockers = unwaivedSmokeEvaluation.blockers.filter((blocker) =>
    !(waiverEnabled && blocker.endsWith('_parser_below_0.99'))
  );
  const retainedCommercialBlockers = waiverEnabled
    ? []
    : [...unwaivedSmokeEvaluation.commercial_blockers];
  const smokeEvaluation = Object.freeze({
    ...unwaivedSmokeEvaluation,
    schema_version: 'phase6-closeout-smoke-evaluation-v1-authorized-waivers',
    technical_status: retainedTechnicalBlockers.length || failureAuditBlockers.length ? 'no_go' : 'passed',
    commercial_status: waiverEnabled ? 'waived' : unwaivedSmokeEvaluation.commercial_status,
    exit_status: retainedTechnicalBlockers.length || failureAuditBlockers.length
      ? 'NO_GO'
      : retainedCommercialBlockers.length
        ? 'COMMERCIAL_BLOCKED'
        : 'PHASE6_EXIT_PASSED',
    blockers: Object.freeze([...retainedTechnicalBlockers, ...failureAuditBlockers]),
    commercial_blockers: Object.freeze(retainedCommercialBlockers),
    waived_blockers: Object.freeze(waiverEnabled ? [
      ...unwaivedSmokeEvaluation.blockers.filter((blocker) => blocker.endsWith('_parser_below_0.99')),
      ...unwaivedSmokeEvaluation.commercial_blockers
    ] : [])
  });
  const humanEvaluation = waiverEnabled
    ? Object.freeze({
      ...unwaivedHumanEvaluation,
      schema_version: 'phase6-human-golden-evaluation-v2-authorized-waiver',
      status: 'waived',
      authority_ref: waiverAuthorityRef,
      blockers: Object.freeze([]),
      waived_blockers: unwaivedHumanEvaluation.blockers
    })
    : unwaivedHumanEvaluation;
  const transition = buildPhase6ToPhase7Gate({
    smokeEvaluation,
    humanEvaluation,
    canaries,
    requireVerifiedBulkCanaries: true,
    phase6CompletionAuthorityRef: completionAuthorityRef
  });
  const blockers = Object.freeze([
    ...smokeEvaluation.blockers,
    ...smokeEvaluation.commercial_blockers,
    ...humanEvaluation.blockers,
    ...transition.blockers
  ]);
  return Object.freeze({
    schema_version: 'phase6-closeout-snapshot-v2-95pct-authorized-waivers',
    status: blockers.length ? 'blocked' : 'complete',
    completion_authority_ref: completionAuthorityRef,
    acceptance_waiver: Object.freeze({
      applied: waiverEnabled,
      authority_ref: waiverAuthorityRef || null,
      waived_gates: Object.freeze(waiverEnabled ? [...AUTHORIZED_WAIVER_FIELDS] : [])
    }),
    selection,
    unwaived_smoke_evaluation: unwaivedSmokeEvaluation,
    unwaived_human_evaluation: unwaivedHumanEvaluation,
    smoke_evaluation: smokeEvaluation,
    human_evaluation: humanEvaluation,
    supplier_evaluation: Object.freeze({
      reconciliations: Object.freeze(reconciliations),
      blockers: smokeEvaluation.commercial_blockers
    }),
    canary_evaluation: Object.freeze({ canaries: Object.freeze(canaries) }),
    transition,
    blockers
  });
}

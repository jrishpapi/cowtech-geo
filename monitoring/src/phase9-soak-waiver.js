const REQUIRED_SCOPE = 'phase9_authoritative_7_to_14_day_live_soak';
const REQUIRED_EFFECT = 'FULL_ACCEPTANCE_WITH_SOAK_WAIVED';

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validatePhase9SoakWaiver(waiver = {}) {
  const blockers = [];
  if (waiver.schema_version !== 'phase9-soak-waiver-decision-v1') {
    blockers.push('phase9_soak_waiver_schema_invalid');
  }
  if (waiver.decision !== 'SOAK_WAIVED_BY_OWNER') {
    blockers.push('phase9_soak_waiver_decision_invalid');
  }
  if (!nonEmpty(waiver.decision_owner)) blockers.push('phase9_soak_waiver_owner_missing');
  if (!nonEmpty(waiver.authority_ref)) blockers.push('phase9_soak_waiver_authority_missing');
  if (!nonEmpty(waiver.evidence_ref)) blockers.push('phase9_soak_waiver_evidence_missing');
  if (!nonEmpty(waiver.decided_at) || !Number.isFinite(Date.parse(waiver.decided_at))) {
    blockers.push('phase9_soak_waiver_timestamp_invalid');
  }
  if (waiver.waived_requirement !== REQUIRED_SCOPE) {
    blockers.push('phase9_soak_waiver_scope_invalid');
  }
  if (waiver.acceptance_effect !== REQUIRED_EFFECT) {
    blockers.push('phase9_soak_waiver_acceptance_effect_invalid');
  }
  if (waiver.risk_acknowledged !== true) {
    blockers.push('phase9_soak_waiver_risk_acknowledgement_missing');
  }
  if (waiver.claims_authoritative_soak_completed !== false) {
    blockers.push('phase9_soak_waiver_must_not_claim_soak_completion');
  }
  return Object.freeze({
    schema_version: 'phase9-soak-waiver-validation-v1',
    status: blockers.length ? 'SOAK_WAIVER_INVALID' : 'SOAK_WAIVED_BY_OWNER',
    waiver_valid: blockers.length === 0,
    acceptance_complete: blockers.length === 0,
    claims_authoritative_soak_completed: false,
    authority_ref: nonEmpty(waiver.authority_ref) ? waiver.authority_ref.trim() : null,
    evidence_ref: nonEmpty(waiver.evidence_ref) ? waiver.evidence_ref.trim() : null,
    blockers: Object.freeze([...new Set(blockers)].sort())
  });
}

export const PHASE9_SOAK_WAIVER_SCOPE = REQUIRED_SCOPE;
export const PHASE9_SOAK_WAIVER_ACCEPTANCE_EFFECT = REQUIRED_EFFECT;

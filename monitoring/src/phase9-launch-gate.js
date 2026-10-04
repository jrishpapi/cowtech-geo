import { validatePhase9SoakWaiver } from './phase9-soak-waiver.js';

export function buildPhase9LaunchGate({
  soakEvaluation,
  soakWaiver,
  phase8RolloutComplete = false,
  supportRunbookApproved = false,
  statusPageApproved = false,
  rollbackChecklistApproved = false,
  commercialLaunchAuthorityRef = ''
}) {
  const blockers = [];
  if (!phase8RolloutComplete) blockers.push('phase8_live_rollout_not_complete');
  const authoritativeSoakGo =
    soakEvaluation?.decision === 'GO_REVIEW' && soakEvaluation?.authoritative === true;
  const waiver = validatePhase9SoakWaiver(soakWaiver);
  if (!authoritativeSoakGo && !waiver.waiver_valid) {
    blockers.push('phase9_soak_go_or_owner_waiver_missing');
  }
  if (!supportRunbookApproved) blockers.push('support_runbook_not_approved');
  if (!statusPageApproved) blockers.push('status_page_not_approved');
  if (!rollbackChecklistApproved) blockers.push('rollback_checklist_not_approved');
  if (!String(commercialLaunchAuthorityRef || '').trim()) {
    blockers.push('commercial_launch_authority_missing');
  }
  return Object.freeze({
    schema_version: 'phase9-commercial-launch-gate-v2',
    status: 'COMMERCIAL_LAUNCH_FROZEN',
    launch_eligible: blockers.length === 0,
    launch_allowed: false,
    requires_separate_apply_executor: true,
    acceptance_basis: authoritativeSoakGo
      ? 'AUTHORITATIVE_SOAK_GO'
      : waiver.waiver_valid
        ? 'OWNER_SOAK_WAIVER'
        : null,
    authoritative_soak_complete: authoritativeSoakGo,
    owner_soak_waiver_valid: waiver.waiver_valid,
    blockers: Object.freeze([...new Set(blockers)].sort())
  });
}

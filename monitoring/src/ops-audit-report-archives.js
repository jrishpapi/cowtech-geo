import { createHash, createHmac } from 'node:crypto';
import { pool } from './db.js';
import { buildOpsAuditComplianceReportHtml, getOpsAuditComplianceReport } from './ops-audit-report.js';

function assertActor(actor) {
  if (!actor?.username) {
    const error = new Error('Audit report archive actor is required.');
    error.code = 'ops_audit_report_archive_actor_required';
    throw error;
  }
}

function hashText(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digestValue(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function jsonSafeValue(value) {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value));
}

function verificationReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    archive: receipt.archive,
    checks: receipt.checks,
    computed: receipt.computed,
    drill: receipt.drill || null,
    watermark: receipt.watermark
  });
}

function bundleVerificationReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    bundle: receipt.bundle,
    verifier: receipt.verifier,
    verification: receipt.verification,
    watermark: receipt.watermark
  });
}

function bundleExportReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    bundle: receipt.bundle,
    requester: receipt.requester,
    filters: receipt.filters,
    manifest_entries: receipt.manifest_entries,
    reference_counts: receipt.reference_counts,
    watermark: receipt.watermark
  });
}

function bundleExportReviewReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    reviewed_at: receipt.reviewed_at,
    action: receipt.action,
    purpose: receipt.purpose,
    decision: receipt.decision,
    reviewer: receipt.reviewer,
    export_receipt: receipt.export_receipt,
    watermark: receipt.watermark
  });
}

function bundleDeliveryGateReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    packet: receipt.packet,
    delivery_readiness: receipt.delivery_readiness,
    delivery_gate: receipt.delivery_gate,
    watermark: receipt.watermark
  });
}

function bundleDeliveryHandoffPreviewHash(preview) {
  return digestValue({
    schema_version: preview.schema_version,
    generated_at: preview.generated_at,
    requested_by: preview.requested_by,
    filters: preview.filters,
    status: preview.status,
    can_handoff: preview.can_handoff,
    reason: preview.reason,
    packet: preview.packet,
    delivery_gate_receipt: preview.delivery_gate_receipt,
    signed_bundle: preview.signed_bundle,
    bundle_verification: preview.bundle_verification,
    delivery_stub: preview.delivery_stub,
    watermark: preview.watermark
  });
}

function bundleDeliveryHandoffPreviewReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    preview: receipt.preview,
    packet: receipt.packet,
    signed_bundle: receipt.signed_bundle,
    bundle_verification: receipt.bundle_verification,
    delivery_stub: receipt.delivery_stub,
    watermark: receipt.watermark
  });
}

function bundleDeliveryFinalApprovalPreviewHash(preview) {
  return digestValue({
    schema_version: preview.schema_version,
    generated_at: preview.generated_at,
    requested_by: preview.requested_by,
    filters: preview.filters,
    status: preview.status,
    can_approve: preview.can_approve,
    decision: preview.decision,
    reason: preview.reason,
    packet: preview.packet,
    handoff_preview_receipt: preview.handoff_preview_receipt,
    signed_bundle: preview.signed_bundle,
    bundle_verification: preview.bundle_verification,
    approval_stub: preview.approval_stub,
    watermark: preview.watermark
  });
}

function bundleDeliveryFinalApprovalReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    final_approval: receipt.final_approval,
    packet: receipt.packet,
    handoff_preview_receipt: receipt.handoff_preview_receipt,
    delivery_gate: receipt.delivery_gate,
    signed_bundle: receipt.signed_bundle,
    bundle_verification: receipt.bundle_verification,
    approval_stub: receipt.approval_stub,
    watermark: receipt.watermark
  });
}

function bundleDeliveryFinalApprovalReviewReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    reviewed_at: receipt.reviewed_at,
    reviewer: receipt.reviewer,
    action: receipt.action,
    lifecycle_status: receipt.lifecycle_status,
    note: receipt.note,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_stub: receipt.lifecycle_stub,
    watermark: receipt.watermark
  });
}

function bundleDeliveryFinalApprovalPolicyGateReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    policy_gate: receipt.policy_gate,
    selected_final_approval_receipt: receipt.selected_final_approval_receipt,
    latest_lifecycle_review: receipt.latest_lifecycle_review,
    lifecycle_summary: receipt.lifecycle_summary,
    delivery_preparation_stub: receipt.delivery_preparation_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryDryRunLockReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    dry_run_lock: receipt.dry_run_lock,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    dry_run_plan: receipt.dry_run_plan,
    release_lock_stub: receipt.release_lock_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryRehearsalReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    rehearsal: receipt.rehearsal,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    rehearsal_plan: receipt.rehearsal_plan,
    rollback_plan: receipt.rollback_plan,
    human_confirmation_window: receipt.human_confirmation_window,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryDualControlApprovalReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    dual_control_approval: receipt.dual_control_approval,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    approval_checkpoint: receipt.approval_checkpoint,
    release_guard: receipt.release_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryReadinessSealReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    readiness_seal: receipt.readiness_seal,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    operator_handoff: receipt.operator_handoff,
    release_guard: receipt.release_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliverySealedHandoffReviewReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    sealed_handoff_review: receipt.sealed_handoff_review,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    release_commander_signoff: receipt.release_commander_signoff,
    release_guard: receipt.release_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandEscrowReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    command_escrow: receipt.command_escrow,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    release_command_packet: receipt.release_command_packet,
    release_guard: receipt.release_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandRevocationReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    command_revocation: receipt.command_revocation,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    rollback_plan: receipt.rollback_plan,
    release_guard: receipt.release_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandClosureReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    command_closure: receipt.command_closure,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    closure_plan: receipt.closure_plan,
    reinstatement_review: receipt.reinstatement_review,
    release_guard: receipt.release_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailNotarizationReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    trail_notarization: receipt.trail_notarization,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    notarized_release_trail: receipt.notarized_release_trail,
    freeze_guard: receipt.freeze_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailCustodyReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    trail_custody: receipt.trail_custody,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    custody_plan: receipt.custody_plan,
    release_archive_review: receipt.release_archive_review,
    custody_guard: receipt.custody_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailRetentionAttestationReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    retention_attestation: receipt.retention_attestation,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    retention_review: receipt.retention_review,
    archive_retention_attestation: receipt.archive_retention_attestation,
    retention_guard: receipt.retention_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailRenewalWindowReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    renewal_window: receipt.renewal_window,
    retention_attestation_receipt: receipt.retention_attestation_receipt,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    archive_expiry_guard: receipt.archive_expiry_guard,
    renewal_guard: receipt.renewal_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailRenewalConfirmationReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    renewal_confirmation: receipt.renewal_confirmation,
    renewal_window_receipt: receipt.renewal_window_receipt,
    retention_attestation_receipt: receipt.retention_attestation_receipt,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    archive_renewal_checkpoint: receipt.archive_renewal_checkpoint,
    renewal_confirmation_guard: receipt.renewal_confirmation_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailCheckpointSealReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    checkpoint_seal: receipt.checkpoint_seal,
    renewal_confirmation_receipt: receipt.renewal_confirmation_receipt,
    renewal_window_receipt: receipt.renewal_window_receipt,
    retention_attestation_receipt: receipt.retention_attestation_receipt,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    archive_checkpoint_freeze: receipt.archive_checkpoint_freeze,
    checkpoint_seal_guard: receipt.checkpoint_seal_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailCustodyHandoffReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    custody_handoff: receipt.custody_handoff,
    checkpoint_seal_receipt: receipt.checkpoint_seal_receipt,
    renewal_confirmation_receipt: receipt.renewal_confirmation_receipt,
    renewal_window_receipt: receipt.renewal_window_receipt,
    retention_attestation_receipt: receipt.retention_attestation_receipt,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    archive_custody_transfer: receipt.archive_custody_transfer,
    custody_handoff_guard: receipt.custody_handoff_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailArchiveEscrowReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    archive_escrow: receipt.archive_escrow,
    custody_handoff_receipt: receipt.custody_handoff_receipt,
    checkpoint_seal_receipt: receipt.checkpoint_seal_receipt,
    renewal_confirmation_receipt: receipt.renewal_confirmation_receipt,
    renewal_window_receipt: receipt.renewal_window_receipt,
    retention_attestation_receipt: receipt.retention_attestation_receipt,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    archive_evidence_lock: receipt.archive_evidence_lock,
    archive_escrow_guard: receipt.archive_escrow_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailEvidenceSealReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    evidence_seal: receipt.evidence_seal,
    archive_escrow_receipt: receipt.archive_escrow_receipt,
    custody_handoff_receipt: receipt.custody_handoff_receipt,
    checkpoint_seal_receipt: receipt.checkpoint_seal_receipt,
    renewal_confirmation_receipt: receipt.renewal_confirmation_receipt,
    renewal_window_receipt: receipt.renewal_window_receipt,
    retention_attestation_receipt: receipt.retention_attestation_receipt,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    release_evidence_seal: receipt.release_evidence_seal,
    evidence_seal_guard: receipt.evidence_seal_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function bundleFinalDeliveryCommandTrailCustodyCheckpointReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    recorded_at: receipt.recorded_at,
    recorder: receipt.recorder,
    filters: receipt.filters,
    custody_checkpoint: receipt.custody_checkpoint,
    evidence_seal_receipt: receipt.evidence_seal_receipt,
    archive_escrow_receipt: receipt.archive_escrow_receipt,
    custody_handoff_receipt: receipt.custody_handoff_receipt,
    checkpoint_seal_receipt: receipt.checkpoint_seal_receipt,
    renewal_confirmation_receipt: receipt.renewal_confirmation_receipt,
    renewal_window_receipt: receipt.renewal_window_receipt,
    retention_attestation_receipt: receipt.retention_attestation_receipt,
    trail_custody_receipt: receipt.trail_custody_receipt,
    trail_notarization_receipt: receipt.trail_notarization_receipt,
    command_closure_receipt: receipt.command_closure_receipt,
    command_revocation_receipt: receipt.command_revocation_receipt,
    command_escrow_receipt: receipt.command_escrow_receipt,
    sealed_handoff_review_receipt: receipt.sealed_handoff_review_receipt,
    readiness_seal_receipt: receipt.readiness_seal_receipt,
    dual_control_approval_receipt: receipt.dual_control_approval_receipt,
    rehearsal_receipt: receipt.rehearsal_receipt,
    dry_run_lock_receipt: receipt.dry_run_lock_receipt,
    policy_gate_receipt: receipt.policy_gate_receipt,
    final_approval_receipt: receipt.final_approval_receipt,
    lifecycle_review_receipt: receipt.lifecycle_review_receipt,
    sealed_evidence_custody_checkpoint: receipt.sealed_evidence_custody_checkpoint,
    custody_checkpoint_guard: receipt.custody_checkpoint_guard,
    signed_bundle: receipt.signed_bundle,
    execution_stub: receipt.execution_stub,
    watermark: receipt.watermark
  });
}

function evidenceCaseReviewReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    reviewed_at: receipt.reviewed_at,
    action: receipt.action,
    case: receipt.case,
    reviewer: receipt.reviewer,
    references: receipt.references,
    watermark: receipt.watermark
  });
}

export function signatureForEvidence({ report_hash: reportHash, html_hash: htmlHash, requested_by: requestedBy, event_digest: eventDigest }, secret) {
  const payload = [reportHash, htmlHash, requestedBy, eventDigest].join('|');
  if (secret) {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }
  return hashText(payload);
}

function requestedParts(report) {
  const [username, role] = String(report.requested_by || '').split(':');
  return {
    username: username || 'unknown',
    role: role || 'unknown'
  };
}

function normalizeArchive(row, { includeReport = false, includeHtml = false } = {}) {
  const archive = {
    schema_version: 'phase4-ops-audit-report-archive-v1',
    id: row.id,
    report_id: row.report_id,
    report_hash: row.report_hash,
    event_digest: row.event_digest,
    html_hash: row.html_hash,
    evidence_signature: row.evidence_signature,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    filters: row.filters || {},
    retention: row.retention || {},
    date_range: row.date_range || {},
    summary: row.summary || {},
    totals: row.totals || {},
    event_count: Number(row.event_count || 0),
    created_at: row.created_at
  };
  if (includeReport) archive.report = row.report;
  if (includeHtml) archive.html_snapshot = row.html_snapshot;
  return archive;
}

function normalizeVerification(row) {
  return {
    schema_version: 'phase4-ops-audit-report-verification-history-v1',
    id: row.id,
    archive_id: row.archive_id,
    identifier: row.identifier,
    verifier: `${row.verifier_username}:${row.verifier_role}`,
    receipt_hash: row.receipt_hash,
    checks: row.checks || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleVerification(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-verification-history-v1',
    id: row.id,
    verifier: `${row.verifier_username}:${row.verifier_role}`,
    receipt_hash: row.receipt_hash,
    bundle_manifest_hash: row.bundle_manifest_hash || null,
    bundle_packet_hash: row.bundle_packet_hash || null,
    bundle_requested_by: row.bundle_requested_by || null,
    valid: Boolean(row.valid),
    checks: row.checks || {},
    entry_results: row.entry_results || [],
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleExport(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    requester: `${row.requester_username}:${row.requester_role}`,
    bundle_manifest_hash: row.bundle_manifest_hash,
    bundle_packet_hash: row.bundle_packet_hash,
    filters: row.filters || {},
    manifest_entries: row.manifest_entries || [],
    reference_counts: row.reference_counts || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleExportReview(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-review-history-v1',
    id: row.id,
    bundle_export_id: row.bundle_export_id,
    receipt_hash: row.receipt_hash,
    bundle_export_receipt_hash: row.bundle_export_receipt_hash,
    reviewer: `${row.reviewer_username}:${row.reviewer_role}`,
    action: row.action,
    purpose: row.purpose,
    decision: row.decision,
    note: row.note || '',
    bundle_manifest_hash: row.bundle_manifest_hash,
    bundle_packet_hash: row.bundle_packet_hash,
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleDeliveryGateReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-gate-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    reason: row.reason,
    can_deliver: Boolean(row.can_deliver),
    readiness_status: row.readiness_status,
    packet_hash: row.packet_hash,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleDeliveryHandoffPreviewReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-handoff-preview-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    preview_hash: row.preview_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    status: row.status,
    reason: row.reason,
    can_handoff: Boolean(row.can_handoff),
    packet_hash: row.packet_hash,
    manifest_hash: row.manifest_hash || null,
    delivery_gate_receipt_hash: row.delivery_gate_receipt_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleDeliveryFinalApprovalReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    approval_preview_hash: row.approval_preview_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    status: row.status,
    reason: row.reason,
    can_approve: Boolean(row.can_approve),
    packet_hash: row.packet_hash,
    manifest_hash: row.manifest_hash || null,
    handoff_preview_receipt_hash: row.handoff_preview_receipt_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleDeliveryFinalApprovalReview(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-review-history-v1',
    id: row.id,
    final_approval_receipt_id: row.final_approval_receipt_id,
    receipt_hash: row.receipt_hash,
    final_approval_receipt_hash: row.final_approval_receipt_hash,
    reviewer: `${row.reviewer_username}:${row.reviewer_role}`,
    action: row.action,
    lifecycle_status: row.lifecycle_status,
    note: row.note || '',
    approval_preview_hash: row.approval_preview_hash,
    decision: row.decision,
    approval_status: row.approval_status,
    packet_hash: row.packet_hash,
    manifest_hash: row.manifest_hash || null,
    handoff_preview_receipt_hash: row.handoff_preview_receipt_hash || null,
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleDeliveryFinalApprovalPolicyGateReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    policy_status: row.policy_status,
    reason: row.reason,
    can_prepare_delivery: Boolean(row.can_prepare_delivery),
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryDryRunLockReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    lock_status: row.lock_status,
    reason: row.reason,
    can_prepare_delivery: Boolean(row.can_prepare_delivery),
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryRehearsalReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-rehearsal-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    rehearsal_status: row.rehearsal_status,
    reason: row.reason,
    can_execute_dry_run: Boolean(row.can_execute_dry_run),
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryDualControlApprovalReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    approval_status: row.approval_status,
    reason: row.reason,
    can_release_after_dual_control: Boolean(row.can_release_after_dual_control),
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryReadinessSealReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-readiness-seal-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    seal_status: row.seal_status,
    reason: row.reason,
    can_handoff_to_operator: Boolean(row.can_handoff_to_operator),
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliverySealedHandoffReviewReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    review_status: row.review_status,
    reason: row.reason,
    can_release_commander_signoff: Boolean(row.can_release_commander_signoff),
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandEscrowReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-escrow-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    escrow_status: row.escrow_status,
    reason: row.reason,
    can_seal_release_command: Boolean(row.can_seal_release_command),
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandRevocationReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-revocation-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    revocation_status: row.revocation_status,
    reason: row.reason,
    can_rollback_release_command: Boolean(row.can_rollback_release_command),
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandClosureReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-closure-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    closure_status: row.closure_status,
    reason: row.reason,
    can_reinstate_release_command: Boolean(row.can_reinstate_release_command),
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailNotarizationReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    notarization_status: row.notarization_status,
    reason: row.reason,
    can_archive_release_trail: Boolean(row.can_archive_release_trail),
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailCustodyReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    custody_status: row.custody_status,
    reason: row.reason,
    can_retain_release_archive: Boolean(row.can_retain_release_archive),
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailRetentionAttestationReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    attestation_status: row.attestation_status,
    reason: row.reason,
    can_continue_release_archive_retention: Boolean(row.can_continue_release_archive_retention),
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    next_review_due_at: row.next_review_due_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailRenewalWindowReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    renewal_status: row.renewal_status,
    reason: row.reason,
    can_schedule_next_retention_review: Boolean(row.can_schedule_next_retention_review),
    retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    renewal_window_opens_at: row.renewal_window_opens_at || null,
    expires_at: row.expires_at || null,
    next_review_due_at: row.next_review_due_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    confirmation_status: row.confirmation_status,
    reason: row.reason,
    can_continue_archive_renewal: Boolean(row.can_continue_archive_renewal),
    renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
    retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    renewal_window_opens_at: row.renewal_window_opens_at || null,
    checkpoint_at: row.checkpoint_at || null,
    next_review_due_at: row.next_review_due_at || null,
    expires_at: row.expires_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailCheckpointSealReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    seal_status: row.seal_status,
    reason: row.reason,
    can_freeze_archive_checkpoint: Boolean(row.can_freeze_archive_checkpoint),
    renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
    renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
    retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    checkpoint_at: row.checkpoint_at || null,
    frozen_at: row.frozen_at || null,
    next_review_due_at: row.next_review_due_at || null,
    expires_at: row.expires_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailCustodyHandoffReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    handoff_status: row.handoff_status,
    reason: row.reason,
    can_transfer_archive_custody: Boolean(row.can_transfer_archive_custody),
    checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
    renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
    renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
    retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    checkpoint_at: row.checkpoint_at || null,
    frozen_at: row.frozen_at || null,
    custody_handoff_at: row.custody_handoff_at || null,
    next_review_due_at: row.next_review_due_at || null,
    expires_at: row.expires_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailArchiveEscrowReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    escrow_status: row.escrow_status,
    reason: row.reason,
    can_lock_archive_evidence: Boolean(row.can_lock_archive_evidence),
    custody_handoff_receipt_hash: row.custody_handoff_receipt_hash || null,
    checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
    renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
    renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
    retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    custody_handoff_at: row.custody_handoff_at || null,
    escrow_locked_at: row.escrow_locked_at || null,
    next_review_due_at: row.next_review_due_at || null,
    expires_at: row.expires_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailEvidenceSealReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    seal_status: row.seal_status,
    reason: row.reason,
    can_notarize_release_evidence: Boolean(row.can_notarize_release_evidence),
    archive_escrow_receipt_hash: row.archive_escrow_receipt_hash || null,
    custody_handoff_receipt_hash: row.custody_handoff_receipt_hash || null,
    checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
    renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
    renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
    retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    escrow_locked_at: row.escrow_locked_at || null,
    evidence_sealed_at: row.evidence_sealed_at || null,
    next_review_due_at: row.next_review_due_at || null,
    expires_at: row.expires_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-history-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    recorder: `${row.recorder_username}:${row.recorder_role}`,
    decision: row.decision,
    checkpoint_status: row.checkpoint_status,
    reason: row.reason,
    can_checkpoint_sealed_evidence: Boolean(row.can_checkpoint_sealed_evidence),
    evidence_seal_receipt_hash: row.evidence_seal_receipt_hash || null,
    archive_escrow_receipt_hash: row.archive_escrow_receipt_hash || null,
    custody_handoff_receipt_hash: row.custody_handoff_receipt_hash || null,
    checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
    renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
    renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
    retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
    trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
    trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
    command_closure_receipt_hash: row.command_closure_receipt_hash || null,
    command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
    command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
    sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
    readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
    dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
    rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
    dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
    policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
    final_approval_receipt_hash: row.final_approval_receipt_hash || null,
    lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
    packet_hash: row.packet_hash || null,
    manifest_hash: row.manifest_hash || null,
    evidence_sealed_at: row.evidence_sealed_at || null,
    custody_checkpointed_at: row.custody_checkpointed_at || null,
    next_review_due_at: row.next_review_due_at || null,
    expires_at: row.expires_at || null,
    filters: row.filters || {},
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

function normalizeEvidenceCaseReviewReceipt(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-review-receipt-history-v1',
    id: row.id,
    case_id: row.case_id,
    receipt_hash: row.receipt_hash,
    reviewer: `${row.reviewer_username}:${row.reviewer_role}`,
    action: row.action,
    previous_status: row.previous_status || null,
    status: row.status,
    packet_hash: row.packet_hash,
    bundle_verification_receipts: row.bundle_verification_receipts || [],
    receipt: row.receipt || null,
    created_at: row.created_at
  };
}

export async function createOpsAuditReportArchive(options = {}, client = pool) {
  assertActor(options.export_actor);
  const report = await getOpsAuditComplianceReport(options);
  const html = buildOpsAuditComplianceReportHtml(report);
  const htmlHash = hashText(html);
  const evidenceSignature = signatureForEvidence(
    {
      report_hash: report.report_hash,
      html_hash: htmlHash,
      requested_by: report.requested_by,
      event_digest: report.event_digest
    },
    options.signing_secret
  );
  const requested = requestedParts(report);

  const result = await client.query(
    `INSERT INTO internal_ops_audit_report_archives (
       report_id,
       report_hash,
       event_digest,
       html_hash,
       evidence_signature,
       requested_by_username,
       requested_by_role,
       filters,
       retention,
       date_range,
       summary,
       totals,
       report,
       html_snapshot,
       event_count
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14, $15)
     ON CONFLICT (report_hash) DO UPDATE
       SET html_snapshot = EXCLUDED.html_snapshot
     RETURNING id, report_id, report_hash, event_digest, html_hash, evidence_signature, requested_by_username,
       requested_by_role, filters, retention, date_range, summary, totals, report, html_snapshot, event_count, created_at`,
    [
      report.report_id,
      report.report_hash,
      report.event_digest,
      htmlHash,
      evidenceSignature,
      requested.username,
      requested.role,
      JSON.stringify(report.filters || {}),
      JSON.stringify(report.retention || {}),
      JSON.stringify(report.date_range || {}),
      JSON.stringify(report.summary || {}),
      JSON.stringify(report.totals || {}),
      JSON.stringify(report),
      html,
      report.totals?.included_events || report.event_count || 0
    ]
  );

  return normalizeArchive(result.rows[0], { includeReport: true });
}

export async function listOpsAuditReportArchives({ limit = 20 } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const result = await client.query(
    `SELECT id, report_id, report_hash, event_digest, html_hash, evidence_signature, requested_by_username,
       requested_by_role, filters, retention, date_range, summary, totals, event_count, created_at
     FROM internal_ops_audit_report_archives
     ORDER BY created_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows.map((row) => normalizeArchive(row));
}

export async function getLatestOpsAuditReportArchive(client = pool) {
  const result = await client.query(
    `SELECT id, report_id, report_hash, event_digest, html_hash, evidence_signature, requested_by_username,
       requested_by_role, filters, retention, date_range, summary, totals, report, html_snapshot, event_count, created_at
     FROM internal_ops_audit_report_archives
     ORDER BY created_at DESC
     LIMIT 1`
  );
  if (!result.rows[0]) {
    const error = new Error('Audit report archive was not found.');
    error.code = 'ops_audit_report_archive_not_found';
    throw error;
  }
  return normalizeArchive(result.rows[0], { includeReport: true, includeHtml: true });
}

export async function getOpsAuditReportArchive(identifier, client = pool) {
  const result = await client.query(
    `SELECT id, report_id, report_hash, event_digest, html_hash, evidence_signature, requested_by_username,
       requested_by_role, filters, retention, date_range, summary, totals, report, html_snapshot, event_count, created_at
     FROM internal_ops_audit_report_archives
     WHERE id::text = $1 OR report_id = $1 OR report_hash = $1 OR evidence_signature = $1
     LIMIT 1`,
    [identifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Audit report archive was not found.');
    error.code = 'ops_audit_report_archive_not_found';
    throw error;
  }
  return normalizeArchive(result.rows[0], { includeReport: true, includeHtml: true });
}

export async function verifyOpsAuditReportArchive({ identifier, evidence_signature: suppliedSignature, signing_secret: signingSecret } = {}, client = pool) {
  const normalizedIdentifier = String(identifier || suppliedSignature || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Audit report archive verification identifier is required.');
    error.code = 'ops_audit_report_archive_verify_identifier_required';
    throw error;
  }

  const archive = await getOpsAuditReportArchive(normalizedIdentifier, client);
  const computedHtmlHash = hashText(archive.html_snapshot);
  const computedSignature = signatureForEvidence(
    {
      report_hash: archive.report_hash,
      html_hash: archive.html_hash,
      requested_by: archive.requested_by,
      event_digest: archive.event_digest
    },
    signingSecret
  );
  const suppliedSignatureMatches = suppliedSignature ? suppliedSignature === archive.evidence_signature : null;
  const receipt = {
    schema_version: 'phase4-ops-audit-report-verification-v1',
    verified_at: new Date().toISOString(),
    identifier: normalizedIdentifier,
    archive: {
      id: archive.id,
      report_id: archive.report_id,
      report_hash: archive.report_hash,
      event_digest: archive.event_digest,
      html_hash: archive.html_hash,
      evidence_signature: archive.evidence_signature,
      requested_by: archive.requested_by,
      event_count: archive.event_count,
      created_at: archive.created_at
    },
    checks: {
      archive_found: true,
      html_hash_matches: computedHtmlHash === archive.html_hash,
      evidence_signature_matches: computedSignature === archive.evidence_signature,
      supplied_signature_matches: suppliedSignatureMatches,
      report_hash_matches: archive.report?.report_hash === archive.report_hash,
      event_digest_matches: archive.report?.event_digest === archive.event_digest
    },
    computed: {
      html_hash: computedHtmlHash,
      evidence_signature: computedSignature
    },
    watermark: 'internal_ops_audit_archive_verification'
  };
  receipt.receipt_hash = verificationReceiptHash(receipt);
  return receipt;
}

export async function recordOpsAuditReportVerification(
  { identifier, evidence_signature: suppliedSignature, signing_secret: signingSecret, verifier, drill } = {},
  client = pool
) {
  if (!verifier?.username) {
    const error = new Error('Audit report verification actor is required.');
    error.code = 'ops_audit_report_verification_actor_required';
    throw error;
  }
  const receipt = await verifyOpsAuditReportArchive(
    {
      identifier,
      evidence_signature: suppliedSignature,
      signing_secret: signingSecret
    },
    client
  );
  if (drill) {
    receipt.drill = drill;
    receipt.receipt_hash = verificationReceiptHash(receipt);
  }
  const result = await client.query(
    `INSERT INTO internal_ops_audit_report_verifications (
       archive_id,
       identifier,
       verifier_username,
       verifier_role,
       receipt_hash,
       checks,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     RETURNING id, archive_id, identifier, verifier_username, verifier_role, receipt_hash, checks, receipt, created_at`,
    [
      receipt.archive.id,
      receipt.identifier,
      verifier.username,
      verifier.role,
      receipt.receipt_hash,
      JSON.stringify(receipt.checks || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeVerification(result.rows[0]);
}

export async function recordOpsAuditReportTamperDrill({ identifier, signing_secret: signingSecret, verifier } = {}, client = pool) {
  const archive = identifier ? await getOpsAuditReportArchive(identifier, client) : await getLatestOpsAuditReportArchive(client);
  const tamperedSignature = hashText(`tamper-drill:${archive.report_hash}:${archive.evidence_signature}:${Date.now()}`);
  return recordOpsAuditReportVerification(
    {
      identifier: archive.report_hash,
      evidence_signature: tamperedSignature,
      signing_secret: signingSecret,
      verifier,
      drill: {
        mode: 'supplied_signature_mismatch',
        supplied_evidence_signature_hash: hashText(tamperedSignature),
        expected_failed_check: 'supplied_signature_matches',
        generated_at: new Date().toISOString()
      }
    },
    client
  );
}

export async function listOpsAuditReportVerifications({ limit = 20, archive_id: archiveId } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = archiveId ? [archiveId, normalizedLimit] : [normalizedLimit];
  const result = await client.query(
    archiveId
      ? `SELECT id, archive_id, identifier, verifier_username, verifier_role, receipt_hash, checks, receipt, created_at
         FROM internal_ops_audit_report_verifications
         WHERE archive_id = $1
         ORDER BY created_at DESC
         LIMIT $2`
      : `SELECT id, archive_id, identifier, verifier_username, verifier_role, receipt_hash, checks, receipt, created_at
         FROM internal_ops_audit_report_verifications
         ORDER BY created_at DESC
         LIMIT $1`,
    params
  );
  return result.rows.map(normalizeVerification);
}

export async function getOpsAuditReportVerification(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Audit report verification identifier is required.');
    error.code = 'ops_audit_report_verification_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, archive_id, identifier, verifier_username, verifier_role, receipt_hash, checks, receipt, created_at
     FROM internal_ops_audit_report_verifications
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Audit report verification was not found.');
    error.code = 'ops_audit_report_verification_not_found';
    throw error;
  }
  return normalizeVerification(result.rows[0]);
}

function evidenceChainSearchText(item) {
  return [
    item.type,
    item.status,
    item.archive?.report_id,
    item.archive?.report_hash,
    item.archive?.event_digest,
    item.archive?.requested_by,
    item.verification?.receipt_hash,
    item.verification?.verifier,
    item.verification?.identifier,
    item.retention_receipt?.receipt_hash,
    item.retention_receipt?.requested_by,
    item.retention_receipt?.mode,
    item.retention_receipt?.watermark,
    item.anomaly_digest_retention_receipt?.receipt_hash,
    item.anomaly_digest_retention_receipt?.requested_by,
    item.anomaly_digest_retention_receipt?.mode,
    item.anomaly_digest_retention_receipt?.watermark,
    item.bundle_verification?.receipt_hash,
    item.bundle_verification?.verifier,
    item.bundle_verification?.bundle_manifest_hash,
    item.bundle_verification?.bundle_packet_hash,
    item.bundle_verification?.bundle_requested_by,
    item.bundle_verification?.watermark,
    item.bundle_export?.receipt_hash,
    item.bundle_export?.requester,
    item.bundle_export?.bundle_manifest_hash,
    item.bundle_export?.bundle_packet_hash,
    item.bundle_export?.watermark,
    item.bundle_export_review?.receipt_hash,
    item.bundle_export_review?.bundle_export_receipt_hash,
    item.bundle_export_review?.reviewer,
    item.bundle_export_review?.action,
    item.bundle_export_review?.purpose,
    item.bundle_export_review?.decision,
    item.bundle_export_review?.bundle_manifest_hash,
    item.bundle_export_review?.bundle_packet_hash,
    item.bundle_export_review?.watermark,
    item.bundle_delivery_gate?.receipt_hash,
    item.bundle_delivery_gate?.recorder,
    item.bundle_delivery_gate?.decision,
    item.bundle_delivery_gate?.reason,
    item.bundle_delivery_gate?.readiness_status,
    item.bundle_delivery_gate?.packet_hash,
    item.bundle_delivery_gate?.watermark,
    item.bundle_handoff_preview?.receipt_hash,
    item.bundle_handoff_preview?.preview_hash,
    item.bundle_handoff_preview?.recorder,
    item.bundle_handoff_preview?.status,
    item.bundle_handoff_preview?.reason,
    item.bundle_handoff_preview?.packet_hash,
    item.bundle_handoff_preview?.manifest_hash,
    item.bundle_handoff_preview?.delivery_gate_receipt_hash,
    item.bundle_handoff_preview?.watermark,
    item.bundle_final_approval?.receipt_hash,
    item.bundle_final_approval?.approval_preview_hash,
    item.bundle_final_approval?.recorder,
    item.bundle_final_approval?.decision,
    item.bundle_final_approval?.status,
    item.bundle_final_approval?.reason,
    item.bundle_final_approval?.packet_hash,
    item.bundle_final_approval?.manifest_hash,
    item.bundle_final_approval?.handoff_preview_receipt_hash,
    item.bundle_final_approval?.watermark,
    item.bundle_final_approval_review?.receipt_hash,
    item.bundle_final_approval_review?.final_approval_receipt_hash,
    item.bundle_final_approval_review?.reviewer,
    item.bundle_final_approval_review?.action,
    item.bundle_final_approval_review?.lifecycle_status,
    item.bundle_final_approval_review?.decision,
    item.bundle_final_approval_review?.approval_status,
    item.bundle_final_approval_review?.approval_preview_hash,
    item.bundle_final_approval_review?.packet_hash,
    item.bundle_final_approval_review?.manifest_hash,
    item.bundle_final_approval_review?.handoff_preview_receipt_hash,
    item.bundle_final_approval_review?.watermark,
    item.bundle_final_approval_policy_gate?.receipt_hash,
    item.bundle_final_approval_policy_gate?.recorder,
    item.bundle_final_approval_policy_gate?.decision,
    item.bundle_final_approval_policy_gate?.policy_status,
    item.bundle_final_approval_policy_gate?.reason,
    item.bundle_final_approval_policy_gate?.final_approval_receipt_hash,
    item.bundle_final_approval_policy_gate?.lifecycle_review_receipt_hash,
    item.bundle_final_approval_policy_gate?.packet_hash,
    item.bundle_final_approval_policy_gate?.manifest_hash,
    item.bundle_final_approval_policy_gate?.watermark,
    item.bundle_final_delivery_dry_run_lock?.receipt_hash,
    item.bundle_final_delivery_dry_run_lock?.recorder,
    item.bundle_final_delivery_dry_run_lock?.decision,
    item.bundle_final_delivery_dry_run_lock?.lock_status,
    item.bundle_final_delivery_dry_run_lock?.reason,
    item.bundle_final_delivery_dry_run_lock?.policy_gate_receipt_hash,
    item.bundle_final_delivery_dry_run_lock?.final_approval_receipt_hash,
    item.bundle_final_delivery_dry_run_lock?.lifecycle_review_receipt_hash,
    item.bundle_final_delivery_dry_run_lock?.packet_hash,
    item.bundle_final_delivery_dry_run_lock?.manifest_hash,
    item.bundle_final_delivery_dry_run_lock?.watermark,
    item.bundle_final_delivery_rehearsal?.receipt_hash,
    item.bundle_final_delivery_rehearsal?.recorder,
    item.bundle_final_delivery_rehearsal?.decision,
    item.bundle_final_delivery_rehearsal?.rehearsal_status,
    item.bundle_final_delivery_rehearsal?.reason,
    item.bundle_final_delivery_rehearsal?.dry_run_lock_receipt_hash,
    item.bundle_final_delivery_rehearsal?.policy_gate_receipt_hash,
    item.bundle_final_delivery_rehearsal?.final_approval_receipt_hash,
    item.bundle_final_delivery_rehearsal?.lifecycle_review_receipt_hash,
    item.bundle_final_delivery_rehearsal?.packet_hash,
    item.bundle_final_delivery_rehearsal?.manifest_hash,
    item.bundle_final_delivery_rehearsal?.watermark,
    item.bundle_final_delivery_dual_control_approval?.receipt_hash,
    item.bundle_final_delivery_dual_control_approval?.recorder,
    item.bundle_final_delivery_dual_control_approval?.decision,
    item.bundle_final_delivery_dual_control_approval?.approval_status,
    item.bundle_final_delivery_dual_control_approval?.reason,
    item.bundle_final_delivery_dual_control_approval?.rehearsal_receipt_hash,
    item.bundle_final_delivery_dual_control_approval?.dry_run_lock_receipt_hash,
    item.bundle_final_delivery_dual_control_approval?.policy_gate_receipt_hash,
    item.bundle_final_delivery_dual_control_approval?.final_approval_receipt_hash,
    item.bundle_final_delivery_dual_control_approval?.lifecycle_review_receipt_hash,
    item.bundle_final_delivery_dual_control_approval?.packet_hash,
    item.bundle_final_delivery_dual_control_approval?.manifest_hash,
    item.bundle_final_delivery_dual_control_approval?.watermark,
    item.bundle_final_delivery_readiness_seal?.receipt_hash,
    item.bundle_final_delivery_readiness_seal?.recorder,
    item.bundle_final_delivery_readiness_seal?.decision,
    item.bundle_final_delivery_readiness_seal?.seal_status,
    item.bundle_final_delivery_readiness_seal?.reason,
    item.bundle_final_delivery_readiness_seal?.dual_control_approval_receipt_hash,
    item.bundle_final_delivery_readiness_seal?.rehearsal_receipt_hash,
    item.bundle_final_delivery_readiness_seal?.dry_run_lock_receipt_hash,
    item.bundle_final_delivery_readiness_seal?.policy_gate_receipt_hash,
    item.bundle_final_delivery_readiness_seal?.final_approval_receipt_hash,
    item.bundle_final_delivery_readiness_seal?.lifecycle_review_receipt_hash,
    item.bundle_final_delivery_readiness_seal?.packet_hash,
    item.bundle_final_delivery_readiness_seal?.manifest_hash,
    item.bundle_final_delivery_readiness_seal?.watermark,
    item.bundle_final_delivery_sealed_handoff_review?.receipt_hash,
    item.bundle_final_delivery_sealed_handoff_review?.recorder,
    item.bundle_final_delivery_sealed_handoff_review?.decision,
    item.bundle_final_delivery_sealed_handoff_review?.review_status,
    item.bundle_final_delivery_sealed_handoff_review?.reason,
    item.bundle_final_delivery_sealed_handoff_review?.readiness_seal_receipt_hash,
    item.bundle_final_delivery_sealed_handoff_review?.packet_hash,
    item.bundle_final_delivery_sealed_handoff_review?.manifest_hash,
    item.bundle_final_delivery_sealed_handoff_review?.watermark,
    item.bundle_final_delivery_command_escrow?.receipt_hash,
    item.bundle_final_delivery_command_escrow?.recorder,
    item.bundle_final_delivery_command_escrow?.decision,
    item.bundle_final_delivery_command_escrow?.escrow_status,
    item.bundle_final_delivery_command_escrow?.reason,
    item.bundle_final_delivery_command_escrow?.sealed_handoff_review_receipt_hash,
    item.bundle_final_delivery_command_escrow?.readiness_seal_receipt_hash,
    item.bundle_final_delivery_command_escrow?.packet_hash,
    item.bundle_final_delivery_command_escrow?.manifest_hash,
    item.bundle_final_delivery_command_escrow?.watermark,
    item.bundle_final_delivery_command_revocation?.receipt_hash,
    item.bundle_final_delivery_command_revocation?.recorder,
    item.bundle_final_delivery_command_revocation?.decision,
    item.bundle_final_delivery_command_revocation?.revocation_status,
    item.bundle_final_delivery_command_revocation?.reason,
    item.bundle_final_delivery_command_revocation?.command_escrow_receipt_hash,
    item.bundle_final_delivery_command_revocation?.sealed_handoff_review_receipt_hash,
    item.bundle_final_delivery_command_revocation?.readiness_seal_receipt_hash,
    item.bundle_final_delivery_command_revocation?.packet_hash,
    item.bundle_final_delivery_command_revocation?.manifest_hash,
    item.bundle_final_delivery_command_revocation?.watermark,
    item.bundle_final_delivery_command_closure?.receipt_hash,
    item.bundle_final_delivery_command_closure?.recorder,
    item.bundle_final_delivery_command_closure?.decision,
    item.bundle_final_delivery_command_closure?.closure_status,
    item.bundle_final_delivery_command_closure?.reason,
    item.bundle_final_delivery_command_closure?.command_revocation_receipt_hash,
    item.bundle_final_delivery_command_closure?.command_escrow_receipt_hash,
    item.bundle_final_delivery_command_closure?.sealed_handoff_review_receipt_hash,
    item.bundle_final_delivery_command_closure?.readiness_seal_receipt_hash,
    item.bundle_final_delivery_command_closure?.packet_hash,
    item.bundle_final_delivery_command_closure?.manifest_hash,
    item.bundle_final_delivery_command_closure?.watermark,
    item.bundle_final_delivery_command_trail_notarization?.receipt_hash,
    item.bundle_final_delivery_command_trail_notarization?.recorder,
    item.bundle_final_delivery_command_trail_notarization?.decision,
    item.bundle_final_delivery_command_trail_notarization?.notarization_status,
    item.bundle_final_delivery_command_trail_notarization?.reason,
    item.bundle_final_delivery_command_trail_notarization?.command_closure_receipt_hash,
    item.bundle_final_delivery_command_trail_notarization?.packet_hash,
    item.bundle_final_delivery_command_trail_notarization?.manifest_hash,
    item.bundle_final_delivery_command_trail_notarization?.watermark,
    item.bundle_final_delivery_command_trail_custody?.receipt_hash,
    item.bundle_final_delivery_command_trail_custody?.recorder,
    item.bundle_final_delivery_command_trail_custody?.decision,
    item.bundle_final_delivery_command_trail_custody?.custody_status,
    item.bundle_final_delivery_command_trail_custody?.reason,
    item.bundle_final_delivery_command_trail_custody?.trail_notarization_receipt_hash,
    item.bundle_final_delivery_command_trail_custody?.packet_hash,
    item.bundle_final_delivery_command_trail_custody?.manifest_hash,
    item.bundle_final_delivery_command_trail_custody?.watermark,
    item.bundle_final_delivery_command_trail_retention_attestation?.receipt_hash,
    item.bundle_final_delivery_command_trail_retention_attestation?.recorder,
    item.bundle_final_delivery_command_trail_retention_attestation?.decision,
    item.bundle_final_delivery_command_trail_retention_attestation?.attestation_status,
    item.bundle_final_delivery_command_trail_retention_attestation?.reason,
    item.bundle_final_delivery_command_trail_retention_attestation?.trail_custody_receipt_hash,
    item.bundle_final_delivery_command_trail_retention_attestation?.packet_hash,
    item.bundle_final_delivery_command_trail_retention_attestation?.manifest_hash,
    item.bundle_final_delivery_command_trail_retention_attestation?.watermark,
    item.bundle_final_delivery_command_trail_renewal_window?.receipt_hash,
    item.bundle_final_delivery_command_trail_renewal_window?.recorder,
    item.bundle_final_delivery_command_trail_renewal_window?.decision,
    item.bundle_final_delivery_command_trail_renewal_window?.renewal_status,
    item.bundle_final_delivery_command_trail_renewal_window?.reason,
    item.bundle_final_delivery_command_trail_renewal_window?.retention_attestation_receipt_hash,
    item.bundle_final_delivery_command_trail_renewal_window?.packet_hash,
    item.bundle_final_delivery_command_trail_renewal_window?.manifest_hash,
    item.bundle_final_delivery_command_trail_renewal_window?.watermark,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.receipt_hash,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.recorder,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.decision,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.confirmation_status,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.reason,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.renewal_window_receipt_hash,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.packet_hash,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.manifest_hash,
    item.bundle_final_delivery_command_trail_renewal_confirmation?.watermark,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.receipt_hash,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.recorder,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.decision,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.seal_status,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.reason,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.renewal_confirmation_receipt_hash,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.renewal_window_receipt_hash,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.packet_hash,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.manifest_hash,
    item.bundle_final_delivery_command_trail_checkpoint_seal?.watermark,
    item.bundle_final_delivery_command_trail_custody_handoff?.receipt_hash,
    item.bundle_final_delivery_command_trail_custody_handoff?.recorder,
    item.bundle_final_delivery_command_trail_custody_handoff?.decision,
    item.bundle_final_delivery_command_trail_custody_handoff?.handoff_status,
    item.bundle_final_delivery_command_trail_custody_handoff?.reason,
    item.bundle_final_delivery_command_trail_custody_handoff?.checkpoint_seal_receipt_hash,
    item.bundle_final_delivery_command_trail_custody_handoff?.renewal_confirmation_receipt_hash,
    item.bundle_final_delivery_command_trail_custody_handoff?.packet_hash,
    item.bundle_final_delivery_command_trail_custody_handoff?.manifest_hash,
    item.bundle_final_delivery_command_trail_custody_handoff?.watermark,
    item.bundle_final_delivery_command_trail_archive_escrow?.receipt_hash,
    item.bundle_final_delivery_command_trail_archive_escrow?.recorder,
    item.bundle_final_delivery_command_trail_archive_escrow?.decision,
    item.bundle_final_delivery_command_trail_archive_escrow?.escrow_status,
    item.bundle_final_delivery_command_trail_archive_escrow?.reason,
    item.bundle_final_delivery_command_trail_archive_escrow?.custody_handoff_receipt_hash,
    item.bundle_final_delivery_command_trail_archive_escrow?.checkpoint_seal_receipt_hash,
    item.bundle_final_delivery_command_trail_archive_escrow?.packet_hash,
    item.bundle_final_delivery_command_trail_archive_escrow?.manifest_hash,
    item.bundle_final_delivery_command_trail_archive_escrow?.watermark,
    item.bundle_final_delivery_command_trail_evidence_seal?.receipt_hash,
    item.bundle_final_delivery_command_trail_evidence_seal?.recorder,
    item.bundle_final_delivery_command_trail_evidence_seal?.decision,
    item.bundle_final_delivery_command_trail_evidence_seal?.seal_status,
    item.bundle_final_delivery_command_trail_evidence_seal?.reason,
    item.bundle_final_delivery_command_trail_evidence_seal?.archive_escrow_receipt_hash,
    item.bundle_final_delivery_command_trail_evidence_seal?.custody_handoff_receipt_hash,
    item.bundle_final_delivery_command_trail_evidence_seal?.packet_hash,
    item.bundle_final_delivery_command_trail_evidence_seal?.manifest_hash,
    item.bundle_final_delivery_command_trail_evidence_seal?.watermark,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.receipt_hash,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.recorder,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.decision,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.checkpoint_status,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.reason,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.evidence_seal_receipt_hash,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.archive_escrow_receipt_hash,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.packet_hash,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.manifest_hash,
    item.bundle_final_delivery_command_trail_custody_checkpoint?.watermark,
    ...(item.bundle_export?.manifest_paths || []),
    ...(item.retention_receipt?.digest_ids || []),
    ...(item.anomaly_digest_retention_receipt?.digest_ids || []),
    ...(item.failed_checks || [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function failedChecks(checks = {}) {
  return Object.entries(checks)
    .filter(([, value]) => value === false)
    .map(([key]) => key);
}

function evidenceMatchesFilters(item, filters) {
  const reportId = String(filters.report_id || '').trim().toLowerCase();
  const reportHash = String(filters.report_hash || '').trim().toLowerCase();
  const receiptHash = String(filters.receipt_hash || '').trim().toLowerCase();
  const verifier = String(filters.verifier || '').trim().toLowerCase();
  const failedCheck = String(filters.failed_check || '').trim();
  const query = String(filters.q || '').trim().toLowerCase();
  if (reportId && !String(item.archive?.report_id || '').toLowerCase().includes(reportId)) return false;
  if (reportHash && !String(item.archive?.report_hash || '').toLowerCase().includes(reportHash)) return false;
  if (
    receiptHash &&
    !String(item.verification?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.retention_receipt?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.anomaly_digest_retention_receipt?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_verification?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_export?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_export_review?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_export_review?.bundle_export_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_delivery_gate?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_handoff_preview?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_handoff_preview?.preview_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_handoff_preview?.delivery_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval?.approval_preview_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval?.handoff_preview_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval_review?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval_review?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval_review?.approval_preview_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval_review?.handoff_preview_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval_policy_gate?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval_policy_gate?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_approval_policy_gate?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dry_run_lock?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dry_run_lock?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dry_run_lock?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dry_run_lock?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_rehearsal?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_rehearsal?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_rehearsal?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_rehearsal?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_rehearsal?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dual_control_approval?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dual_control_approval?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dual_control_approval?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dual_control_approval?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dual_control_approval?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_dual_control_approval?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_readiness_seal?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_readiness_seal?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_readiness_seal?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_readiness_seal?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_readiness_seal?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_readiness_seal?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_readiness_seal?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_escrow?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_revocation?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_closure?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.trail_custody_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.retention_attestation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.trail_custody_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.renewal_window_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.retention_attestation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.trail_custody_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.renewal_confirmation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.renewal_window_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.retention_attestation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.trail_custody_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.checkpoint_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.renewal_confirmation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.renewal_window_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.retention_attestation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.trail_custody_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.custody_handoff_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.checkpoint_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.renewal_confirmation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.renewal_window_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.retention_attestation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.trail_custody_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.archive_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.custody_handoff_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.checkpoint_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.renewal_confirmation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.renewal_window_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.retention_attestation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.trail_custody_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.trail_notarization_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.command_closure_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.command_revocation_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.command_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.sealed_handoff_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.readiness_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.dual_control_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.rehearsal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.dry_run_lock_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.policy_gate_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.final_approval_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.lifecycle_review_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_checkpoint?.receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_checkpoint?.evidence_seal_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_checkpoint?.archive_escrow_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_checkpoint?.custody_handoff_receipt_hash || '').toLowerCase().includes(receiptHash) &&
    !String(item.bundle_final_delivery_command_trail_custody_checkpoint?.checkpoint_seal_receipt_hash || '').toLowerCase().includes(receiptHash)
  ) return false;
  if (
    verifier &&
    !String(item.verification?.verifier || '').toLowerCase().includes(verifier) &&
    !String(item.retention_receipt?.requested_by || '').toLowerCase().includes(verifier) &&
    !String(item.anomaly_digest_retention_receipt?.requested_by || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_verification?.verifier || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_export?.requester || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_export_review?.reviewer || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_delivery_gate?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_handoff_preview?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_approval?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_approval_review?.reviewer || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_approval_policy_gate?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_dry_run_lock?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_rehearsal?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_dual_control_approval?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_readiness_seal?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_sealed_handoff_review?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_escrow?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_revocation?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_closure?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_notarization?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_custody?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_retention_attestation?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_renewal_window?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_renewal_confirmation?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_checkpoint_seal?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_custody_handoff?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_archive_escrow?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_evidence_seal?.recorder || '').toLowerCase().includes(verifier) &&
    !String(item.bundle_final_delivery_command_trail_custody_checkpoint?.recorder || '').toLowerCase().includes(verifier)
  ) return false;
  if (failedCheck) {
    const failures = item.failed_checks || [];
    if (failedCheck === 'any') {
      if (!failures.length) return false;
    } else if (!failures.includes(failedCheck)) {
      return false;
    }
  }
  if (query && !evidenceChainSearchText(item).includes(query)) return false;
  return true;
}

function archiveEvidenceFromRow(row) {
  return {
    id: row.archive_id,
    report_id: row.report_id,
    report_hash: row.report_hash,
    event_digest: row.event_digest,
    evidence_signature: row.evidence_signature,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    event_count: Number(row.event_count || 0),
    created_at: row.archive_created_at
  };
}

function buildEvidenceSummary(items) {
  const summary = {
    total_items: items.length,
    archive_count: items.filter((item) => item.type === 'archive').length,
    verification_count: items.filter((item) => item.type === 'verification').length,
    retention_receipt_count: items.filter((item) => item.type === 'digest_retention_receipt').length,
    anomaly_digest_retention_receipt_count: items.filter((item) => item.type === 'anomaly_digest_retention_receipt').length,
    bundle_verification_receipt_count: items.filter((item) => item.type === 'bundle_verification_receipt').length,
    bundle_export_receipt_count: items.filter((item) => item.type === 'bundle_export_receipt').length,
    bundle_export_review_receipt_count: items.filter((item) => item.type === 'bundle_export_review_receipt').length,
    bundle_delivery_gate_receipt_count: items.filter((item) => item.type === 'bundle_delivery_gate_receipt').length,
    bundle_handoff_preview_receipt_count: items.filter((item) => item.type === 'bundle_handoff_preview_receipt').length,
    bundle_final_approval_receipt_count: items.filter((item) => item.type === 'bundle_final_approval_receipt').length,
    bundle_final_approval_review_receipt_count: items.filter((item) => item.type === 'bundle_final_approval_review_receipt').length,
    bundle_final_approval_policy_gate_receipt_count: items.filter((item) => item.type === 'bundle_final_approval_policy_gate_receipt').length,
    bundle_final_delivery_dry_run_lock_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_dry_run_lock_receipt').length,
    bundle_final_delivery_rehearsal_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_rehearsal_receipt').length,
    bundle_final_delivery_dual_control_approval_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_dual_control_approval_receipt').length,
    bundle_final_delivery_readiness_seal_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_readiness_seal_receipt').length,
    bundle_final_delivery_sealed_handoff_review_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_sealed_handoff_review_receipt').length,
    bundle_final_delivery_command_escrow_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_escrow_receipt').length,
    bundle_final_delivery_command_revocation_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_revocation_receipt').length,
    bundle_final_delivery_command_closure_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_closure_receipt').length,
    bundle_final_delivery_command_trail_notarization_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_notarization_receipt').length,
    bundle_final_delivery_command_trail_custody_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_custody_receipt').length,
    bundle_final_delivery_command_trail_retention_attestation_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_retention_attestation_receipt').length,
    bundle_final_delivery_command_trail_renewal_window_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_renewal_window_receipt').length,
    bundle_final_delivery_command_trail_renewal_confirmation_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_renewal_confirmation_receipt').length,
    bundle_final_delivery_command_trail_checkpoint_seal_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_checkpoint_seal_receipt').length,
    bundle_final_delivery_command_trail_custody_handoff_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_custody_handoff_receipt').length,
    bundle_final_delivery_command_trail_archive_escrow_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_archive_escrow_receipt').length,
    bundle_final_delivery_command_trail_evidence_seal_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_evidence_seal_receipt').length,
    bundle_final_delivery_command_trail_custody_checkpoint_receipt_count: items.filter((item) => item.type === 'bundle_final_delivery_command_trail_custody_checkpoint_receipt').length,
    anomaly_count: items.filter((item) => item.status === 'anomaly').length,
    by_failed_check: {}
  };
  items.forEach((item) => {
    (item.failed_checks || []).forEach((check) => {
      summary.by_failed_check[check] = (summary.by_failed_check[check] || 0) + 1;
    });
  });
  return summary;
}

function casePacketFilters(filters = {}) {
  return {
    report_id: filters.report_id || '',
    report_hash: filters.report_hash || '',
    receipt_hash: filters.receipt_hash || '',
    verifier: filters.verifier || '',
    failed_check: filters.failed_check || '',
    q: filters.q || ''
  };
}

function casePacketActor(actor) {
  if (!actor?.username) return 'unknown:unknown';
  return `${actor.username}:${actor.role || 'unknown'}`;
}

function casePacketRecommendations(summary = {}) {
  if (summary.anomaly_count > 0) {
    return [
      'Review each anomaly row and confirm the failed check is expected for the case.',
      'Re-run verification against the archived report hash before closing the evidence case.',
      'Escalate supplied-signature mismatches as tamper drill or evidence handling exceptions.'
    ];
  }
  return [
    'Archive this packet with the related report and verification references.',
    'Keep the report hash and receipt hash available for future spot checks.'
  ];
}

function casePacketReferences(items = []) {
  const archives = new Map();
  const verifications = [];
  const retentionReceipts = [];
  const anomalyDigestRetentionReceipts = [];
  const bundleVerifications = [];
  const bundleExports = [];
  const bundleExportReviews = [];
  const bundleDeliveryGateReceipts = [];
  const bundleHandoffPreviewReceipts = [];
  const bundleFinalApprovalReceipts = [];
  const bundleFinalApprovalReviews = [];
  const bundleFinalApprovalPolicyGateReceipts = [];
  const bundleFinalDeliveryDryRunLockReceipts = [];
  const bundleFinalDeliveryRehearsalReceipts = [];
  const bundleFinalDeliveryDualControlApprovalReceipts = [];
  const bundleFinalDeliveryReadinessSealReceipts = [];
  const bundleFinalDeliverySealedHandoffReviewReceipts = [];
  const bundleFinalDeliveryCommandEscrowReceipts = [];
  const bundleFinalDeliveryCommandRevocationReceipts = [];
  const bundleFinalDeliveryCommandClosureReceipts = [];
  const bundleFinalDeliveryCommandTrailNotarizationReceipts = [];
  const bundleFinalDeliveryCommandTrailCustodyReceipts = [];
  const bundleFinalDeliveryCommandTrailRetentionAttestationReceipts = [];
  const bundleFinalDeliveryCommandTrailRenewalWindowReceipts = [];
  const bundleFinalDeliveryCommandTrailRenewalConfirmationReceipts = [];
  const bundleFinalDeliveryCommandTrailCheckpointSealReceipts = [];
  const bundleFinalDeliveryCommandTrailCustodyHandoffReceipts = [];
  const bundleFinalDeliveryCommandTrailArchiveEscrowReceipts = [];
  const bundleFinalDeliveryCommandTrailEvidenceSealReceipts = [];
  const bundleFinalDeliveryCommandTrailCustodyCheckpointReceipts = [];
  items.forEach((item) => {
    if (item.archive?.id && !archives.has(item.archive.id)) {
      archives.set(item.archive.id, item.archive);
    }
    if (item.verification?.id) {
      verifications.push({
        id: item.verification.id,
        receipt_hash: item.verification.receipt_hash,
        verifier: item.verification.verifier,
        status: item.status,
        failed_checks: item.failed_checks || [],
        at: item.at
      });
    }
    if (item.retention_receipt?.id) {
      retentionReceipts.push({
        id: item.retention_receipt.id,
        receipt_hash: item.retention_receipt.receipt_hash,
        requested_by: item.retention_receipt.requested_by,
        mode: item.retention_receipt.mode,
        retention_days: item.retention_receipt.retention_days,
        cutoff_at: item.retention_receipt.cutoff_at,
        retained_count: item.retention_receipt.retained_count,
        eligible_count: item.retention_receipt.eligible_count,
        deleted_count: item.retention_receipt.deleted_count,
        at: item.at
      });
    }
    if (item.anomaly_digest_retention_receipt?.id) {
      anomalyDigestRetentionReceipts.push({
        id: item.anomaly_digest_retention_receipt.id,
        receipt_hash: item.anomaly_digest_retention_receipt.receipt_hash,
        requested_by: item.anomaly_digest_retention_receipt.requested_by,
        mode: item.anomaly_digest_retention_receipt.mode,
        retention_days: item.anomaly_digest_retention_receipt.retention_days,
        cutoff_at: item.anomaly_digest_retention_receipt.cutoff_at,
        retained_count: item.anomaly_digest_retention_receipt.retained_count,
        eligible_count: item.anomaly_digest_retention_receipt.eligible_count,
        deleted_count: item.anomaly_digest_retention_receipt.deleted_count,
        at: item.at
      });
    }
    if (item.bundle_verification?.id) {
      bundleVerifications.push({
        id: item.bundle_verification.id,
        receipt_hash: item.bundle_verification.receipt_hash,
        verifier: item.bundle_verification.verifier,
        valid: item.bundle_verification.valid,
        bundle_manifest_hash: item.bundle_verification.bundle_manifest_hash,
        bundle_packet_hash: item.bundle_verification.bundle_packet_hash,
        bundle_requested_by: item.bundle_verification.bundle_requested_by,
        failed_checks: item.failed_checks || [],
        at: item.at
      });
    }
    if (item.bundle_export?.id) {
      bundleExports.push({
        id: item.bundle_export.id,
        receipt_hash: item.bundle_export.receipt_hash,
        requester: item.bundle_export.requester,
        bundle_manifest_hash: item.bundle_export.bundle_manifest_hash,
        bundle_packet_hash: item.bundle_export.bundle_packet_hash,
        manifest_entry_count: item.bundle_export.manifest_entry_count,
        reference_counts: item.bundle_export.reference_counts || {},
        at: item.at
      });
    }
    if (item.bundle_export_review?.id) {
      bundleExportReviews.push({
        id: item.bundle_export_review.id,
        receipt_hash: item.bundle_export_review.receipt_hash,
        bundle_export_id: item.bundle_export_review.bundle_export_id,
        bundle_export_receipt_hash: item.bundle_export_review.bundle_export_receipt_hash,
        reviewer: item.bundle_export_review.reviewer,
        action: item.bundle_export_review.action,
        purpose: item.bundle_export_review.purpose,
        decision: item.bundle_export_review.decision,
        bundle_manifest_hash: item.bundle_export_review.bundle_manifest_hash,
        bundle_packet_hash: item.bundle_export_review.bundle_packet_hash,
        at: item.at
      });
    }
    if (item.bundle_delivery_gate?.id) {
      bundleDeliveryGateReceipts.push({
        id: item.bundle_delivery_gate.id,
        receipt_hash: item.bundle_delivery_gate.receipt_hash,
        recorder: item.bundle_delivery_gate.recorder,
        decision: item.bundle_delivery_gate.decision,
        reason: item.bundle_delivery_gate.reason,
        can_deliver: Boolean(item.bundle_delivery_gate.can_deliver),
        readiness_status: item.bundle_delivery_gate.readiness_status,
        packet_hash: item.bundle_delivery_gate.packet_hash,
        filters: item.bundle_delivery_gate.filters || {},
        at: item.at
      });
    }
    if (item.bundle_handoff_preview?.id) {
      bundleHandoffPreviewReceipts.push({
        id: item.bundle_handoff_preview.id,
        receipt_hash: item.bundle_handoff_preview.receipt_hash,
        preview_hash: item.bundle_handoff_preview.preview_hash,
        recorder: item.bundle_handoff_preview.recorder,
        status: item.bundle_handoff_preview.status,
        reason: item.bundle_handoff_preview.reason,
        can_handoff: Boolean(item.bundle_handoff_preview.can_handoff),
        packet_hash: item.bundle_handoff_preview.packet_hash,
        manifest_hash: item.bundle_handoff_preview.manifest_hash,
        delivery_gate_receipt_hash: item.bundle_handoff_preview.delivery_gate_receipt_hash,
        filters: item.bundle_handoff_preview.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_approval?.id) {
      bundleFinalApprovalReceipts.push({
        id: item.bundle_final_approval.id,
        receipt_hash: item.bundle_final_approval.receipt_hash,
        approval_preview_hash: item.bundle_final_approval.approval_preview_hash,
        recorder: item.bundle_final_approval.recorder,
        decision: item.bundle_final_approval.decision,
        status: item.bundle_final_approval.status,
        reason: item.bundle_final_approval.reason,
        can_approve: Boolean(item.bundle_final_approval.can_approve),
        packet_hash: item.bundle_final_approval.packet_hash,
        manifest_hash: item.bundle_final_approval.manifest_hash,
        handoff_preview_receipt_hash: item.bundle_final_approval.handoff_preview_receipt_hash,
        filters: item.bundle_final_approval.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_approval_review?.id) {
      bundleFinalApprovalReviews.push({
        id: item.bundle_final_approval_review.id,
        final_approval_receipt_id: item.bundle_final_approval_review.final_approval_receipt_id,
        receipt_hash: item.bundle_final_approval_review.receipt_hash,
        final_approval_receipt_hash: item.bundle_final_approval_review.final_approval_receipt_hash,
        reviewer: item.bundle_final_approval_review.reviewer,
        action: item.bundle_final_approval_review.action,
        lifecycle_status: item.bundle_final_approval_review.lifecycle_status,
        decision: item.bundle_final_approval_review.decision,
        approval_status: item.bundle_final_approval_review.approval_status,
        approval_preview_hash: item.bundle_final_approval_review.approval_preview_hash,
        packet_hash: item.bundle_final_approval_review.packet_hash,
        manifest_hash: item.bundle_final_approval_review.manifest_hash,
        handoff_preview_receipt_hash: item.bundle_final_approval_review.handoff_preview_receipt_hash,
        at: item.at
      });
    }
    if (item.bundle_final_approval_policy_gate?.id) {
      bundleFinalApprovalPolicyGateReceipts.push({
        id: item.bundle_final_approval_policy_gate.id,
        receipt_hash: item.bundle_final_approval_policy_gate.receipt_hash,
        recorder: item.bundle_final_approval_policy_gate.recorder,
        decision: item.bundle_final_approval_policy_gate.decision,
        policy_status: item.bundle_final_approval_policy_gate.policy_status,
        reason: item.bundle_final_approval_policy_gate.reason,
        can_prepare_delivery: Boolean(item.bundle_final_approval_policy_gate.can_prepare_delivery),
        final_approval_receipt_hash: item.bundle_final_approval_policy_gate.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_approval_policy_gate.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_approval_policy_gate.packet_hash,
        manifest_hash: item.bundle_final_approval_policy_gate.manifest_hash,
        filters: item.bundle_final_approval_policy_gate.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_dry_run_lock?.id) {
      bundleFinalDeliveryDryRunLockReceipts.push({
        id: item.bundle_final_delivery_dry_run_lock.id,
        receipt_hash: item.bundle_final_delivery_dry_run_lock.receipt_hash,
        recorder: item.bundle_final_delivery_dry_run_lock.recorder,
        decision: item.bundle_final_delivery_dry_run_lock.decision,
        lock_status: item.bundle_final_delivery_dry_run_lock.lock_status,
        reason: item.bundle_final_delivery_dry_run_lock.reason,
        can_prepare_delivery: Boolean(item.bundle_final_delivery_dry_run_lock.can_prepare_delivery),
        policy_gate_receipt_hash: item.bundle_final_delivery_dry_run_lock.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_dry_run_lock.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_dry_run_lock.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_dry_run_lock.packet_hash,
        manifest_hash: item.bundle_final_delivery_dry_run_lock.manifest_hash,
        filters: item.bundle_final_delivery_dry_run_lock.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_rehearsal?.id) {
      bundleFinalDeliveryRehearsalReceipts.push({
        id: item.bundle_final_delivery_rehearsal.id,
        receipt_hash: item.bundle_final_delivery_rehearsal.receipt_hash,
        recorder: item.bundle_final_delivery_rehearsal.recorder,
        decision: item.bundle_final_delivery_rehearsal.decision,
        rehearsal_status: item.bundle_final_delivery_rehearsal.rehearsal_status,
        reason: item.bundle_final_delivery_rehearsal.reason,
        can_execute_dry_run: Boolean(item.bundle_final_delivery_rehearsal.can_execute_dry_run),
        dry_run_lock_receipt_hash: item.bundle_final_delivery_rehearsal.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_rehearsal.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_rehearsal.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_rehearsal.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_rehearsal.packet_hash,
        manifest_hash: item.bundle_final_delivery_rehearsal.manifest_hash,
        filters: item.bundle_final_delivery_rehearsal.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_dual_control_approval?.id) {
      bundleFinalDeliveryDualControlApprovalReceipts.push({
        id: item.bundle_final_delivery_dual_control_approval.id,
        receipt_hash: item.bundle_final_delivery_dual_control_approval.receipt_hash,
        recorder: item.bundle_final_delivery_dual_control_approval.recorder,
        decision: item.bundle_final_delivery_dual_control_approval.decision,
        approval_status: item.bundle_final_delivery_dual_control_approval.approval_status,
        reason: item.bundle_final_delivery_dual_control_approval.reason,
        can_release_after_dual_control: Boolean(item.bundle_final_delivery_dual_control_approval.can_release_after_dual_control),
        rehearsal_receipt_hash: item.bundle_final_delivery_dual_control_approval.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_dual_control_approval.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_dual_control_approval.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_dual_control_approval.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_dual_control_approval.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_dual_control_approval.packet_hash,
        manifest_hash: item.bundle_final_delivery_dual_control_approval.manifest_hash,
        filters: item.bundle_final_delivery_dual_control_approval.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_readiness_seal?.id) {
      bundleFinalDeliveryReadinessSealReceipts.push({
        id: item.bundle_final_delivery_readiness_seal.id,
        receipt_hash: item.bundle_final_delivery_readiness_seal.receipt_hash,
        recorder: item.bundle_final_delivery_readiness_seal.recorder,
        decision: item.bundle_final_delivery_readiness_seal.decision,
        seal_status: item.bundle_final_delivery_readiness_seal.seal_status,
        reason: item.bundle_final_delivery_readiness_seal.reason,
        can_handoff_to_operator: Boolean(item.bundle_final_delivery_readiness_seal.can_handoff_to_operator),
        dual_control_approval_receipt_hash: item.bundle_final_delivery_readiness_seal.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_readiness_seal.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_readiness_seal.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_readiness_seal.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_readiness_seal.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_readiness_seal.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_readiness_seal.packet_hash,
        manifest_hash: item.bundle_final_delivery_readiness_seal.manifest_hash,
        filters: item.bundle_final_delivery_readiness_seal.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_sealed_handoff_review?.id) {
      bundleFinalDeliverySealedHandoffReviewReceipts.push({
        id: item.bundle_final_delivery_sealed_handoff_review.id,
        receipt_hash: item.bundle_final_delivery_sealed_handoff_review.receipt_hash,
        recorder: item.bundle_final_delivery_sealed_handoff_review.recorder,
        decision: item.bundle_final_delivery_sealed_handoff_review.decision,
        review_status: item.bundle_final_delivery_sealed_handoff_review.review_status,
        reason: item.bundle_final_delivery_sealed_handoff_review.reason,
        can_release_commander_signoff: Boolean(item.bundle_final_delivery_sealed_handoff_review.can_release_commander_signoff),
        readiness_seal_receipt_hash: item.bundle_final_delivery_sealed_handoff_review.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_sealed_handoff_review.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_sealed_handoff_review.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_sealed_handoff_review.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_sealed_handoff_review.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_sealed_handoff_review.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_sealed_handoff_review.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_sealed_handoff_review.packet_hash,
        manifest_hash: item.bundle_final_delivery_sealed_handoff_review.manifest_hash,
        filters: item.bundle_final_delivery_sealed_handoff_review.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_escrow?.id) {
      bundleFinalDeliveryCommandEscrowReceipts.push({
        id: item.bundle_final_delivery_command_escrow.id,
        receipt_hash: item.bundle_final_delivery_command_escrow.receipt_hash,
        recorder: item.bundle_final_delivery_command_escrow.recorder,
        decision: item.bundle_final_delivery_command_escrow.decision,
        escrow_status: item.bundle_final_delivery_command_escrow.escrow_status,
        reason: item.bundle_final_delivery_command_escrow.reason,
        can_seal_release_command: Boolean(item.bundle_final_delivery_command_escrow.can_seal_release_command),
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_escrow.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_escrow.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_escrow.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_escrow.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_escrow.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_escrow.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_escrow.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_escrow.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_escrow.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_escrow.manifest_hash,
        filters: item.bundle_final_delivery_command_escrow.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_revocation?.id) {
      bundleFinalDeliveryCommandRevocationReceipts.push({
        id: item.bundle_final_delivery_command_revocation.id,
        receipt_hash: item.bundle_final_delivery_command_revocation.receipt_hash,
        recorder: item.bundle_final_delivery_command_revocation.recorder,
        decision: item.bundle_final_delivery_command_revocation.decision,
        revocation_status: item.bundle_final_delivery_command_revocation.revocation_status,
        reason: item.bundle_final_delivery_command_revocation.reason,
        can_rollback_release_command: Boolean(item.bundle_final_delivery_command_revocation.can_rollback_release_command),
        command_escrow_receipt_hash: item.bundle_final_delivery_command_revocation.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_revocation.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_revocation.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_revocation.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_revocation.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_revocation.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_revocation.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_revocation.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_revocation.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_revocation.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_revocation.manifest_hash,
        filters: item.bundle_final_delivery_command_revocation.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_closure?.id) {
      bundleFinalDeliveryCommandClosureReceipts.push({
        id: item.bundle_final_delivery_command_closure.id,
        receipt_hash: item.bundle_final_delivery_command_closure.receipt_hash,
        recorder: item.bundle_final_delivery_command_closure.recorder,
        decision: item.bundle_final_delivery_command_closure.decision,
        closure_status: item.bundle_final_delivery_command_closure.closure_status,
        reason: item.bundle_final_delivery_command_closure.reason,
        can_reinstate_release_command: Boolean(item.bundle_final_delivery_command_closure.can_reinstate_release_command),
        command_revocation_receipt_hash: item.bundle_final_delivery_command_closure.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_closure.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_closure.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_closure.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_closure.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_closure.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_closure.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_closure.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_closure.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_closure.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_closure.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_closure.manifest_hash,
        filters: item.bundle_final_delivery_command_closure.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_notarization?.id) {
      bundleFinalDeliveryCommandTrailNotarizationReceipts.push({
        id: item.bundle_final_delivery_command_trail_notarization.id,
        receipt_hash: item.bundle_final_delivery_command_trail_notarization.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_notarization.recorder,
        decision: item.bundle_final_delivery_command_trail_notarization.decision,
        notarization_status: item.bundle_final_delivery_command_trail_notarization.notarization_status,
        reason: item.bundle_final_delivery_command_trail_notarization.reason,
        can_archive_release_trail: Boolean(item.bundle_final_delivery_command_trail_notarization.can_archive_release_trail),
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_notarization.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_notarization.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_notarization.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_notarization.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_notarization.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_notarization.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_notarization.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_notarization.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_notarization.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_notarization.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_notarization.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_notarization.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_notarization.manifest_hash,
        filters: item.bundle_final_delivery_command_trail_notarization.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_custody?.id) {
      bundleFinalDeliveryCommandTrailCustodyReceipts.push({
        id: item.bundle_final_delivery_command_trail_custody.id,
        receipt_hash: item.bundle_final_delivery_command_trail_custody.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_custody.recorder,
        decision: item.bundle_final_delivery_command_trail_custody.decision,
        custody_status: item.bundle_final_delivery_command_trail_custody.custody_status,
        reason: item.bundle_final_delivery_command_trail_custody.reason,
        can_retain_release_archive: Boolean(item.bundle_final_delivery_command_trail_custody.can_retain_release_archive),
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_custody.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_custody.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_custody.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_custody.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_custody.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_custody.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_custody.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_custody.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_custody.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_custody.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_custody.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_custody.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_custody.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_custody.manifest_hash,
        filters: item.bundle_final_delivery_command_trail_custody.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_retention_attestation?.id) {
      bundleFinalDeliveryCommandTrailRetentionAttestationReceipts.push({
        id: item.bundle_final_delivery_command_trail_retention_attestation.id,
        receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_retention_attestation.recorder,
        decision: item.bundle_final_delivery_command_trail_retention_attestation.decision,
        attestation_status: item.bundle_final_delivery_command_trail_retention_attestation.attestation_status,
        reason: item.bundle_final_delivery_command_trail_retention_attestation.reason,
        can_continue_release_archive_retention: Boolean(item.bundle_final_delivery_command_trail_retention_attestation.can_continue_release_archive_retention),
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_retention_attestation.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_retention_attestation.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_retention_attestation.manifest_hash,
        next_review_due_at: item.bundle_final_delivery_command_trail_retention_attestation.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_retention_attestation.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_renewal_window?.id) {
      bundleFinalDeliveryCommandTrailRenewalWindowReceipts.push({
        id: item.bundle_final_delivery_command_trail_renewal_window.id,
        receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_renewal_window.recorder,
        decision: item.bundle_final_delivery_command_trail_renewal_window.decision,
        renewal_status: item.bundle_final_delivery_command_trail_renewal_window.renewal_status,
        reason: item.bundle_final_delivery_command_trail_renewal_window.reason,
        can_schedule_next_retention_review: Boolean(item.bundle_final_delivery_command_trail_renewal_window.can_schedule_next_retention_review),
        retention_attestation_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.retention_attestation_receipt_hash,
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_renewal_window.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_renewal_window.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_renewal_window.manifest_hash,
        renewal_window_opens_at: item.bundle_final_delivery_command_trail_renewal_window.renewal_window_opens_at,
        expires_at: item.bundle_final_delivery_command_trail_renewal_window.expires_at,
        next_review_due_at: item.bundle_final_delivery_command_trail_renewal_window.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_renewal_window.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_renewal_confirmation?.id) {
      bundleFinalDeliveryCommandTrailRenewalConfirmationReceipts.push({
        id: item.bundle_final_delivery_command_trail_renewal_confirmation.id,
        receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_renewal_confirmation.recorder,
        decision: item.bundle_final_delivery_command_trail_renewal_confirmation.decision,
        confirmation_status: item.bundle_final_delivery_command_trail_renewal_confirmation.confirmation_status,
        reason: item.bundle_final_delivery_command_trail_renewal_confirmation.reason,
        can_continue_archive_renewal: Boolean(item.bundle_final_delivery_command_trail_renewal_confirmation.can_continue_archive_renewal),
        renewal_window_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.renewal_window_receipt_hash,
        retention_attestation_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.retention_attestation_receipt_hash,
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_renewal_confirmation.manifest_hash,
        renewal_window_opens_at: item.bundle_final_delivery_command_trail_renewal_confirmation.renewal_window_opens_at,
        checkpoint_at: item.bundle_final_delivery_command_trail_renewal_confirmation.checkpoint_at,
        expires_at: item.bundle_final_delivery_command_trail_renewal_confirmation.expires_at,
        next_review_due_at: item.bundle_final_delivery_command_trail_renewal_confirmation.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_renewal_confirmation.filters || {},
        at: item.at
      });
    }
  });
  items.forEach((item) => {
    if (item.bundle_final_delivery_command_trail_checkpoint_seal?.id) {
      bundleFinalDeliveryCommandTrailCheckpointSealReceipts.push({
        id: item.bundle_final_delivery_command_trail_checkpoint_seal.id,
        receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_checkpoint_seal.recorder,
        decision: item.bundle_final_delivery_command_trail_checkpoint_seal.decision,
        seal_status: item.bundle_final_delivery_command_trail_checkpoint_seal.seal_status,
        reason: item.bundle_final_delivery_command_trail_checkpoint_seal.reason,
        can_freeze_archive_checkpoint: Boolean(item.bundle_final_delivery_command_trail_checkpoint_seal.can_freeze_archive_checkpoint),
        renewal_confirmation_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.renewal_confirmation_receipt_hash,
        renewal_window_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.renewal_window_receipt_hash,
        retention_attestation_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.retention_attestation_receipt_hash,
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_checkpoint_seal.manifest_hash,
        checkpoint_at: item.bundle_final_delivery_command_trail_checkpoint_seal.checkpoint_at,
        frozen_at: item.bundle_final_delivery_command_trail_checkpoint_seal.frozen_at,
        expires_at: item.bundle_final_delivery_command_trail_checkpoint_seal.expires_at,
        next_review_due_at: item.bundle_final_delivery_command_trail_checkpoint_seal.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_checkpoint_seal.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_custody_handoff?.id) {
      bundleFinalDeliveryCommandTrailCustodyHandoffReceipts.push({
        id: item.bundle_final_delivery_command_trail_custody_handoff.id,
        receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_custody_handoff.recorder,
        decision: item.bundle_final_delivery_command_trail_custody_handoff.decision,
        handoff_status: item.bundle_final_delivery_command_trail_custody_handoff.handoff_status,
        reason: item.bundle_final_delivery_command_trail_custody_handoff.reason,
        can_transfer_archive_custody: Boolean(item.bundle_final_delivery_command_trail_custody_handoff.can_transfer_archive_custody),
        checkpoint_seal_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.checkpoint_seal_receipt_hash,
        renewal_confirmation_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.renewal_confirmation_receipt_hash,
        renewal_window_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.renewal_window_receipt_hash,
        retention_attestation_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.retention_attestation_receipt_hash,
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_custody_handoff.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_custody_handoff.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_custody_handoff.manifest_hash,
        checkpoint_at: item.bundle_final_delivery_command_trail_custody_handoff.checkpoint_at,
        frozen_at: item.bundle_final_delivery_command_trail_custody_handoff.frozen_at,
        custody_handoff_at: item.bundle_final_delivery_command_trail_custody_handoff.custody_handoff_at,
        expires_at: item.bundle_final_delivery_command_trail_custody_handoff.expires_at,
        next_review_due_at: item.bundle_final_delivery_command_trail_custody_handoff.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_custody_handoff.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_archive_escrow?.id) {
      bundleFinalDeliveryCommandTrailArchiveEscrowReceipts.push({
        id: item.bundle_final_delivery_command_trail_archive_escrow.id,
        receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_archive_escrow.recorder,
        decision: item.bundle_final_delivery_command_trail_archive_escrow.decision,
        escrow_status: item.bundle_final_delivery_command_trail_archive_escrow.escrow_status,
        reason: item.bundle_final_delivery_command_trail_archive_escrow.reason,
        can_lock_archive_evidence: Boolean(item.bundle_final_delivery_command_trail_archive_escrow.can_lock_archive_evidence),
        custody_handoff_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.custody_handoff_receipt_hash,
        checkpoint_seal_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.checkpoint_seal_receipt_hash,
        renewal_confirmation_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.renewal_confirmation_receipt_hash,
        renewal_window_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.renewal_window_receipt_hash,
        retention_attestation_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.retention_attestation_receipt_hash,
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_archive_escrow.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_archive_escrow.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_archive_escrow.manifest_hash,
        custody_handoff_at: item.bundle_final_delivery_command_trail_archive_escrow.custody_handoff_at,
        escrow_locked_at: item.bundle_final_delivery_command_trail_archive_escrow.escrow_locked_at,
        expires_at: item.bundle_final_delivery_command_trail_archive_escrow.expires_at,
        next_review_due_at: item.bundle_final_delivery_command_trail_archive_escrow.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_archive_escrow.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_evidence_seal?.id) {
      bundleFinalDeliveryCommandTrailEvidenceSealReceipts.push({
        id: item.bundle_final_delivery_command_trail_evidence_seal.id,
        receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_evidence_seal.recorder,
        decision: item.bundle_final_delivery_command_trail_evidence_seal.decision,
        seal_status: item.bundle_final_delivery_command_trail_evidence_seal.seal_status,
        reason: item.bundle_final_delivery_command_trail_evidence_seal.reason,
        can_notarize_release_evidence: Boolean(item.bundle_final_delivery_command_trail_evidence_seal.can_notarize_release_evidence),
        archive_escrow_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.archive_escrow_receipt_hash,
        custody_handoff_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.custody_handoff_receipt_hash,
        checkpoint_seal_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.checkpoint_seal_receipt_hash,
        renewal_confirmation_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.renewal_confirmation_receipt_hash,
        renewal_window_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.renewal_window_receipt_hash,
        retention_attestation_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.retention_attestation_receipt_hash,
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_evidence_seal.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_evidence_seal.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_evidence_seal.manifest_hash,
        escrow_locked_at: item.bundle_final_delivery_command_trail_evidence_seal.escrow_locked_at,
        evidence_sealed_at: item.bundle_final_delivery_command_trail_evidence_seal.evidence_sealed_at,
        expires_at: item.bundle_final_delivery_command_trail_evidence_seal.expires_at,
        next_review_due_at: item.bundle_final_delivery_command_trail_evidence_seal.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_evidence_seal.filters || {},
        at: item.at
      });
    }
    if (item.bundle_final_delivery_command_trail_custody_checkpoint?.id) {
      bundleFinalDeliveryCommandTrailCustodyCheckpointReceipts.push({
        id: item.bundle_final_delivery_command_trail_custody_checkpoint.id,
        receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.receipt_hash,
        recorder: item.bundle_final_delivery_command_trail_custody_checkpoint.recorder,
        decision: item.bundle_final_delivery_command_trail_custody_checkpoint.decision,
        checkpoint_status: item.bundle_final_delivery_command_trail_custody_checkpoint.checkpoint_status,
        reason: item.bundle_final_delivery_command_trail_custody_checkpoint.reason,
        can_checkpoint_sealed_evidence: Boolean(item.bundle_final_delivery_command_trail_custody_checkpoint.can_checkpoint_sealed_evidence),
        evidence_seal_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.evidence_seal_receipt_hash,
        archive_escrow_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.archive_escrow_receipt_hash,
        custody_handoff_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.custody_handoff_receipt_hash,
        checkpoint_seal_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.checkpoint_seal_receipt_hash,
        renewal_confirmation_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.renewal_confirmation_receipt_hash,
        renewal_window_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.renewal_window_receipt_hash,
        retention_attestation_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.retention_attestation_receipt_hash,
        trail_custody_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.trail_custody_receipt_hash,
        trail_notarization_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.trail_notarization_receipt_hash,
        command_closure_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.command_closure_receipt_hash,
        command_revocation_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.command_revocation_receipt_hash,
        command_escrow_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.command_escrow_receipt_hash,
        sealed_handoff_review_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.sealed_handoff_review_receipt_hash,
        readiness_seal_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.readiness_seal_receipt_hash,
        dual_control_approval_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.dual_control_approval_receipt_hash,
        rehearsal_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.rehearsal_receipt_hash,
        dry_run_lock_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.dry_run_lock_receipt_hash,
        policy_gate_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.policy_gate_receipt_hash,
        final_approval_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.final_approval_receipt_hash,
        lifecycle_review_receipt_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.lifecycle_review_receipt_hash,
        packet_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.packet_hash,
        manifest_hash: item.bundle_final_delivery_command_trail_custody_checkpoint.manifest_hash,
        evidence_sealed_at: item.bundle_final_delivery_command_trail_custody_checkpoint.evidence_sealed_at,
        custody_checkpointed_at: item.bundle_final_delivery_command_trail_custody_checkpoint.custody_checkpointed_at,
        expires_at: item.bundle_final_delivery_command_trail_custody_checkpoint.expires_at,
        next_review_due_at: item.bundle_final_delivery_command_trail_custody_checkpoint.next_review_due_at,
        filters: item.bundle_final_delivery_command_trail_custody_checkpoint.filters || {},
        at: item.at
      });
    }
  });
  return {
    archives: [...archives.values()],
    verifications,
    retention_receipts: retentionReceipts,
    anomaly_digest_retention_receipts: anomalyDigestRetentionReceipts,
    bundle_verifications: bundleVerifications,
    bundle_exports: bundleExports,
    bundle_export_reviews: bundleExportReviews,
    bundle_delivery_gate_receipts: bundleDeliveryGateReceipts,
    bundle_handoff_preview_receipts: bundleHandoffPreviewReceipts,
    bundle_final_approval_receipts: bundleFinalApprovalReceipts,
    bundle_final_approval_reviews: bundleFinalApprovalReviews,
    bundle_final_approval_policy_gate_receipts: bundleFinalApprovalPolicyGateReceipts,
    bundle_final_delivery_dry_run_lock_receipts: bundleFinalDeliveryDryRunLockReceipts,
    bundle_final_delivery_rehearsal_receipts: bundleFinalDeliveryRehearsalReceipts,
    bundle_final_delivery_dual_control_approval_receipts: bundleFinalDeliveryDualControlApprovalReceipts,
    bundle_final_delivery_readiness_seal_receipts: bundleFinalDeliveryReadinessSealReceipts,
    bundle_final_delivery_sealed_handoff_review_receipts: bundleFinalDeliverySealedHandoffReviewReceipts,
    bundle_final_delivery_command_escrow_receipts: bundleFinalDeliveryCommandEscrowReceipts,
    bundle_final_delivery_command_revocation_receipts: bundleFinalDeliveryCommandRevocationReceipts,
    bundle_final_delivery_command_closure_receipts: bundleFinalDeliveryCommandClosureReceipts,
    bundle_final_delivery_command_trail_notarization_receipts: bundleFinalDeliveryCommandTrailNotarizationReceipts,
    bundle_final_delivery_command_trail_custody_receipts: bundleFinalDeliveryCommandTrailCustodyReceipts,
    bundle_final_delivery_command_trail_retention_attestation_receipts: bundleFinalDeliveryCommandTrailRetentionAttestationReceipts,
    bundle_final_delivery_command_trail_renewal_window_receipts: bundleFinalDeliveryCommandTrailRenewalWindowReceipts,
    bundle_final_delivery_command_trail_renewal_confirmation_receipts: bundleFinalDeliveryCommandTrailRenewalConfirmationReceipts,
    bundle_final_delivery_command_trail_checkpoint_seal_receipts: bundleFinalDeliveryCommandTrailCheckpointSealReceipts,
    bundle_final_delivery_command_trail_custody_handoff_receipts: bundleFinalDeliveryCommandTrailCustodyHandoffReceipts,
    bundle_final_delivery_command_trail_archive_escrow_receipts: bundleFinalDeliveryCommandTrailArchiveEscrowReceipts,
    bundle_final_delivery_command_trail_evidence_seal_receipts: bundleFinalDeliveryCommandTrailEvidenceSealReceipts,
    bundle_final_delivery_command_trail_custody_checkpoint_receipts: bundleFinalDeliveryCommandTrailCustodyCheckpointReceipts
  };
}

function bundleExportReviewRank(review = {}) {
  return Date.parse(review.at || review.created_at || '') || 0;
}

function bundleExportDeliveryStatus(review = null) {
  if (!review) return 'needs_review';
  if (review.action === 'revoked' || review.action === 'rejected' || review.decision === 'rejected') {
    return 'blocked';
  }
  if (review.action === 'attested' && review.decision === 'usable') {
    return 'eligible';
  }
  return 'needs_review';
}

function buildBundleExportDeliveryReadiness(references = {}) {
  const exports = references.bundle_exports || [];
  const reviews = references.bundle_export_reviews || [];
  const reviewsByExportHash = new Map();
  reviews.forEach((review) => {
    const exportHash = review.bundle_export_receipt_hash;
    if (!exportHash) return;
    const current = reviewsByExportHash.get(exportHash);
    if (!current || bundleExportReviewRank(review) > bundleExportReviewRank(current)) {
      reviewsByExportHash.set(exportHash, review);
    }
  });
  const exportsByHash = new Map();
  exports.forEach((bundleExport) => {
    if (bundleExport.receipt_hash) exportsByHash.set(bundleExport.receipt_hash, bundleExport);
  });
  reviewsByExportHash.forEach((review, exportHash) => {
    if (exportsByHash.has(exportHash)) return;
    exportsByHash.set(exportHash, {
      receipt_hash: exportHash,
      bundle_manifest_hash: review.bundle_manifest_hash,
      bundle_packet_hash: review.bundle_packet_hash,
      requester: null
    });
  });
  const exportStatuses = [...exportsByHash.values()].map((bundleExport) => {
    const latestReview = reviewsByExportHash.get(bundleExport.receipt_hash) || null;
    return {
      export_receipt_hash: bundleExport.receipt_hash,
      bundle_manifest_hash: bundleExport.bundle_manifest_hash,
      bundle_packet_hash: bundleExport.bundle_packet_hash,
      requester: bundleExport.requester,
      latest_review_receipt_hash: latestReview?.receipt_hash || null,
      reviewer: latestReview?.reviewer || null,
      action: latestReview?.action || null,
      purpose: latestReview?.purpose || null,
      decision: latestReview?.decision || null,
      reviewed_at: latestReview?.at || null,
      delivery_status: bundleExportDeliveryStatus(latestReview)
    };
  });
  const counts = {
    total_exports: exportStatuses.length,
    reviewed_exports: exportStatuses.filter((item) => item.latest_review_receipt_hash).length,
    unreviewed_exports: exportStatuses.filter((item) => !item.latest_review_receipt_hash).length,
    eligible_exports: exportStatuses.filter((item) => item.delivery_status === 'eligible').length,
    needs_review_exports: exportStatuses.filter((item) => item.delivery_status === 'needs_review').length,
    blocked_exports: exportStatuses.filter((item) => item.delivery_status === 'blocked').length
  };
  const deliveryStatus = counts.total_exports === 0
    ? 'no_exports'
    : counts.blocked_exports > 0
      ? 'blocked'
      : counts.needs_review_exports > 0 || counts.unreviewed_exports > 0
        ? 'needs_review'
        : 'eligible';
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-delivery-readiness-v1',
    delivery_status: deliveryStatus,
    counts,
    exports: exportStatuses,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_export_delivery_readiness'
  };
}

function buildBundleExportDeliveryPolicyGate(deliveryReadiness = {}) {
  const status = deliveryReadiness.delivery_status || 'no_exports';
  const counts = deliveryReadiness.counts || {};
  const base = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-delivery-gate-v1',
    readiness_status: status,
    counts,
    can_deliver: false,
    decision: 'deny',
    reason: 'delivery_readiness_missing',
    explanation: 'Delivery is blocked because no delivery readiness rollup is available.',
    required_actions: ['Generate a signed bundle export and review receipt before delivery.'],
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_export_delivery_gate'
  };
  if (status === 'eligible') {
    return {
      ...base,
      can_deliver: true,
      decision: 'allow',
      reason: 'ready_for_delivery',
      explanation: 'Delivery is allowed because every matching signed bundle export has a latest usable attestation.',
      required_actions: []
    };
  }
  if (status === 'blocked') {
    return {
      ...base,
      reason: 'blocked_by_review',
      explanation: 'Delivery is denied because at least one matching signed bundle export was rejected or revoked.',
      required_actions: ['Resolve the blocked export review, create a new signed bundle export if needed, and record a usable attestation.']
    };
  }
  if (status === 'needs_review') {
    const unreviewed = Number(counts.unreviewed_exports || 0);
    return {
      ...base,
      reason: unreviewed > 0 ? 'unreviewed_export' : 'review_required',
      explanation: unreviewed > 0
        ? 'Delivery is denied because at least one matching signed bundle export has no review attestation.'
        : 'Delivery is denied because at least one matching signed bundle export still needs review.',
      required_actions: ['Record an attested usable review for every matching signed bundle export before delivery.']
    };
  }
  if (status === 'no_exports') {
    return {
      ...base,
      reason: 'no_export_receipt',
      explanation: 'Delivery is denied because no signed bundle export receipt matched the current evidence filters.',
      required_actions: ['Generate a signed evidence case bundle export, then record a usable delivery review.']
    };
  }
  return base;
}

const EVIDENCE_CASE_STATUSES = new Set(['open', 'in_review', 'resolved', 'dismissed']);
const EVIDENCE_CASE_PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);
const EVIDENCE_CASE_NOTIFICATION_KINDS = new Set(['overdue', 'due_soon']);
const EVIDENCE_CASE_NOTIFICATION_STATUSES = new Set(['open', 'acked', 'snoozed']);
const EVIDENCE_CASE_NOTIFICATION_CASE_KINDS = new Set(['evidence_case', 'bundle_anomaly_review']);
const EVIDENCE_CASE_NOTIFICATION_ADAPTERS = new Set(['webhook', 'email']);
const EVIDENCE_CASE_NOTIFICATION_PRIORITY_RANK = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4
};
const DUE_SOON_MS = 24 * 60 * 60 * 1000;

function normalizeCaseStatus(status, fallback = 'open') {
  const normalized = String(status || fallback).trim().toLowerCase();
  if (!EVIDENCE_CASE_STATUSES.has(normalized)) {
    const error = new Error('Evidence case status is invalid.');
    error.code = 'ops_audit_evidence_case_status_invalid';
    throw error;
  }
  return normalized;
}

function normalizeCasePriority(priority, fallback = 'normal') {
  const normalized = String(priority || fallback).trim().toLowerCase();
  if (!EVIDENCE_CASE_PRIORITIES.has(normalized)) {
    const error = new Error('Evidence case priority is invalid.');
    error.code = 'ops_audit_evidence_case_priority_invalid';
    throw error;
  }
  return normalized;
}

function normalizeCaseDueAt(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error('Evidence case due_at is invalid.');
    error.code = 'ops_audit_evidence_case_due_at_invalid';
    throw error;
  }
  return date.toISOString();
}

function normalizeNotificationKind(kind) {
  const normalized = String(kind || '').trim().toLowerCase();
  if (!EVIDENCE_CASE_NOTIFICATION_KINDS.has(normalized)) {
    const error = new Error('Evidence case notification kind is invalid.');
    error.code = 'ops_audit_evidence_case_notification_kind_invalid';
    throw error;
  }
  return normalized;
}

function normalizeNotificationStatus(status, fallback = 'open') {
  const normalized = String(status || fallback).trim().toLowerCase();
  if (!EVIDENCE_CASE_NOTIFICATION_STATUSES.has(normalized)) {
    const error = new Error('Evidence case notification status is invalid.');
    error.code = 'ops_audit_evidence_case_notification_status_invalid';
    throw error;
  }
  return normalized;
}

function normalizeNotificationCaseKind(caseKind, fallback = '') {
  const normalized = String(caseKind || fallback || '').trim().toLowerCase();
  if (!normalized) return '';
  if (!EVIDENCE_CASE_NOTIFICATION_CASE_KINDS.has(normalized)) {
    const error = new Error('Evidence case notification case kind is invalid.');
    error.code = 'ops_audit_evidence_case_notification_case_kind_invalid';
    throw error;
  }
  return normalized;
}

function normalizeNotificationAdapter(adapter, fallback = 'webhook') {
  const normalized = String(adapter || fallback).trim().toLowerCase();
  if (!EVIDENCE_CASE_NOTIFICATION_ADAPTERS.has(normalized)) {
    const error = new Error('Evidence case notification adapter is invalid.');
    error.code = 'ops_audit_evidence_case_notification_adapter_invalid';
    throw error;
  }
  return normalized;
}

function normalizeQuietHour(value, fallback) {
  const normalized = String(value || fallback).trim();
  if (!/^[0-2][0-9]:[0-5][0-9]$/.test(normalized)) {
    const error = new Error('Evidence case notification quiet hour is invalid.');
    error.code = 'ops_audit_evidence_case_notification_quiet_hour_invalid';
    throw error;
  }
  const [hour] = normalized.split(':').map(Number);
  if (hour > 23) {
    const error = new Error('Evidence case notification quiet hour is invalid.');
    error.code = 'ops_audit_evidence_case_notification_quiet_hour_invalid';
    throw error;
  }
  return normalized;
}

function normalizeNotificationPolicy(row) {
  return {
    schema_version: 'phase4-ops-audit-notification-policy-v1',
    enabled: row.enabled !== false,
    min_priority: row.min_priority || 'normal',
    notify_overdue: row.notify_overdue !== false,
    notify_due_soon: row.notify_due_soon !== false,
    quiet_hours: {
      enabled: row.quiet_hours_enabled === true,
      start: row.quiet_hours_start || '22:00',
      end: row.quiet_hours_end || '08:00',
      timezone: row.timezone || 'UTC'
    },
    adapters: {
      webhook: row.adapters?.webhook !== false,
      email: row.adapters?.email === true
    },
    updated_by: row.updated_by_username ? `${row.updated_by_username}:${row.updated_by_role}` : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeNotificationRule(row) {
  return {
    schema_version: 'phase4-ops-audit-notification-rule-v1',
    id: row.id,
    name: row.name,
    enabled: row.enabled !== false,
    kind: row.kind,
    priority: row.priority,
    adapter: row.adapter,
    repeat_interval_minutes: Number(row.repeat_interval_minutes || 60),
    suppression_window_minutes: Number(row.suppression_window_minutes || 60),
    escalation_assignee: row.escalation_assignee_username
      ? `${row.escalation_assignee_username}:${row.escalation_assignee_role || 'operator'}`
      : null,
    created_by: row.created_by_username ? `${row.created_by_username}:${row.created_by_role}` : null,
    updated_by: row.updated_by_username ? `${row.updated_by_username}:${row.updated_by_role}` : null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeNotificationRuleInput(input = {}, fallback = {}) {
  const assignee = input.escalation_assignee !== undefined
    ? normalizeAssignee(input.escalation_assignee)
    : {
        username: fallback.escalation_assignee_username || null,
        role: fallback.escalation_assignee_role || null
      };
  const repeatInterval = Number(input.repeat_interval_minutes ?? fallback.repeat_interval_minutes ?? 60);
  const suppressionWindow = Number(input.suppression_window_minutes ?? fallback.suppression_window_minutes ?? 60);
  if (!Number.isInteger(repeatInterval) || repeatInterval < 5 || repeatInterval > 10080) {
    const error = new Error('Notification rule repeat interval is invalid.');
    error.code = 'ops_audit_notification_rule_repeat_invalid';
    throw error;
  }
  if (!Number.isInteger(suppressionWindow) || suppressionWindow < 0 || suppressionWindow > 10080) {
    const error = new Error('Notification rule suppression window is invalid.');
    error.code = 'ops_audit_notification_rule_suppression_invalid';
    throw error;
  }
  return {
    name: String(input.name ?? fallback.name ?? '').trim() || 'Evidence notification rule',
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : fallback.enabled !== false,
    kind: input.kind !== undefined ? normalizeNotificationKind(input.kind) : normalizeNotificationKind(fallback.kind || 'overdue'),
    priority: input.priority !== undefined ? normalizeCasePriority(input.priority) : normalizeCasePriority(fallback.priority || 'critical'),
    adapter: input.adapter !== undefined ? normalizeNotificationAdapter(input.adapter) : normalizeNotificationAdapter(fallback.adapter || 'webhook'),
    repeat_interval_minutes: repeatInterval,
    suppression_window_minutes: suppressionWindow,
    escalation_assignee_username: assignee.username,
    escalation_assignee_role: assignee.role
  };
}

function evidenceCaseSla(row, now = new Date()) {
  const dueAt = row.due_at ? new Date(row.due_at) : null;
  const status = row.status;
  const closed = status === 'resolved' || status === 'dismissed';
  const msUntilDue = dueAt ? dueAt.getTime() - now.getTime() : null;
  const overdue = Boolean(!closed && dueAt && msUntilDue < 0);
  const dueSoon = Boolean(!closed && dueAt && msUntilDue >= 0 && msUntilDue <= DUE_SOON_MS);
  return {
    status: closed ? 'closed' : overdue ? 'overdue' : dueSoon ? 'due_soon' : dueAt ? 'on_track' : 'unscheduled',
    priority: row.priority || 'normal',
    due_at: row.due_at || null,
    overdue,
    due_soon: dueSoon,
    hours_until_due: dueAt ? Math.round((msUntilDue / (60 * 60 * 1000)) * 10) / 10 : null
  };
}

function actorParts(actor = {}) {
  return {
    username: actor.username || 'unknown',
    role: actor.role || 'unknown'
  };
}

function normalizeAssignee(value) {
  const raw = typeof value === 'string' ? { username: value } : value || {};
  const username = String(raw.username || '').trim();
  if (!username) return { username: null, role: null };
  return {
    username,
    role: String(raw.role || 'operator').trim() || 'operator'
  };
}

function normalizeEvidenceCaseReview(row) {
  const sla = evidenceCaseSla(row);
  return {
    schema_version: 'phase4-ops-audit-evidence-case-review-v1',
    id: row.id,
    packet_hash: row.packet_hash,
    status: row.status,
    priority: row.priority || 'normal',
    due_at: row.due_at || null,
    sla,
    assignee: row.assignee_username
      ? `${row.assignee_username}:${row.assignee_role || 'unknown'}`
      : null,
    resolution_note: row.resolution_note || null,
    opened_by: `${row.opened_by_username}:${row.opened_by_role}`,
    updated_by: `${row.updated_by_username}:${row.updated_by_role}`,
    resolved_by: row.resolved_by_username ? `${row.resolved_by_username}:${row.resolved_by_role}` : null,
    resolved_at: row.resolved_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    filters: row.filters || {},
    summary: row.summary || {},
    packet: row.packet || null
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function getOpsAuditEvidenceChain(filters = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(filters.limit) || 50, 200));
  const archiveResult = await client.query(
    `SELECT
       a.id AS archive_id,
       a.report_id,
       a.report_hash,
       a.event_digest,
       a.evidence_signature,
       a.requested_by_username,
       a.requested_by_role,
       a.event_count,
       a.created_at AS archive_created_at,
       v.id AS verification_id,
       v.identifier AS verification_identifier,
       v.verifier_username,
       v.verifier_role,
       v.receipt_hash,
       v.checks AS verification_checks,
       v.receipt AS verification_receipt,
       v.created_at AS verification_created_at
     FROM internal_ops_audit_report_archives a
     LEFT JOIN internal_ops_audit_report_verifications v ON v.archive_id = a.id
     ORDER BY COALESCE(v.created_at, a.created_at) DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const retentionReceiptResult = await client.query(
    `SELECT id, receipt_hash, requested_by_username, requested_by_role, retention_days, cutoff_at,
       executed, eligible_count, retained_count, deleted_count, receipt, created_at
     FROM internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const anomalyDigestRetentionReceiptResult = await client.query(
    `SELECT id, receipt_hash, requested_by_username, requested_by_role, retention_days, cutoff_at,
       executed, eligible_count, retained_count, deleted_count, receipt, created_at
     FROM internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleVerificationResult = await client.query(
    `SELECT id, receipt_hash, verifier_username, verifier_role, bundle_manifest_hash, bundle_packet_hash,
       bundle_requested_by, valid, checks, entry_results, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_verifications
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleExportResult = await client.query(
    `SELECT id, receipt_hash, requester_username, requester_role, bundle_manifest_hash, bundle_packet_hash,
       filters, manifest_entries, reference_counts, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_exports
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleExportReviewResult = await client.query(
    `SELECT id, bundle_export_id, receipt_hash, bundle_export_receipt_hash, reviewer_username, reviewer_role,
       action, purpose, decision, note, bundle_manifest_hash, bundle_packet_hash, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_export_reviews
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleDeliveryGateReceiptResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, reason, can_deliver,
       readiness_status, packet_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleHandoffPreviewReceiptResult = await client.query(
    `SELECT id, receipt_hash, preview_hash, recorder_username, recorder_role, status, reason, can_handoff,
       packet_hash, manifest_hash, delivery_gate_receipt_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalApprovalReceiptResult = await client.query(
    `SELECT id, receipt_hash, approval_preview_hash, recorder_username, recorder_role, decision, status,
       reason, can_approve, packet_hash, manifest_hash, handoff_preview_receipt_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalApprovalReviewResult = await client.query(
    `SELECT id, final_approval_receipt_id, receipt_hash, final_approval_receipt_hash, reviewer_username,
       reviewer_role, action, lifecycle_status, note, approval_preview_hash, decision, approval_status,
       packet_hash, manifest_hash, handoff_preview_receipt_hash, receipt, created_at
     FROM internal_ops_audit_bundle_final_approval_reviews
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalApprovalPolicyGateResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, policy_status, reason,
       can_prepare_delivery, final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash,
       manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_approval_policy_gates
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryDryRunLockResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, lock_status, reason,
       can_prepare_delivery, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_dry_run_locks
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryRehearsalResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, rehearsal_status, reason,
       can_execute_dry_run, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at
    FROM internal_ops_audit_final_delivery_rehearsals
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryDualControlApprovalResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, approval_status, reason,
       can_release_after_dual_control, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_dual_control_approvals
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryReadinessSealResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_handoff_to_operator, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_readiness_seals
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliverySealedHandoffReviewResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, review_status, reason,
       can_release_commander_signoff, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_handoff_reviews
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandEscrowResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_seal_release_command, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_escrows
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandRevocationResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, revocation_status, reason,
       can_rollback_release_command, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_revocations
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandClosureResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, closure_status, reason,
       can_reinstate_release_command, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_closures
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailNotarizationResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, notarization_status, reason,
       can_archive_release_trail, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_notarizations
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailCustodyResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, custody_status, reason,
       can_retain_release_archive, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custodies
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailRetentionAttestationResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, attestation_status, reason,
       can_continue_release_archive_retention, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, next_review_due_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_retention_attestations
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailRenewalWindowResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, renewal_status, reason,
       can_schedule_next_retention_review, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, renewal_window_opens_at, expires_at, next_review_due_at, filters, receipt, created_at
    FROM internal_ops_audit_final_delivery_command_trail_renewals
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailRenewalConfirmationResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, confirmation_status, reason,
       can_continue_archive_renewal, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, renewal_window_opens_at,
       checkpoint_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_renewal_confirmations
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailCheckpointSealResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_freeze_archive_checkpoint, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       checkpoint_at, frozen_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_checkpoint_seals
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailCustodyHandoffResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, handoff_status, reason,
       can_transfer_archive_custody, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, checkpoint_at, frozen_at, custody_handoff_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custody_handoffs
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailArchiveEscrowResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_lock_archive_evidence, custody_handoff_receipt_hash, checkpoint_seal_receipt_hash,
       renewal_confirmation_receipt_hash, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, custody_handoff_at,
       escrow_locked_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_archive_escrows
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailEvidenceSealResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_notarize_release_evidence, archive_escrow_receipt_hash, custody_handoff_receipt_hash,
       checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       escrow_locked_at, evidence_sealed_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_evidence_seals
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const bundleFinalDeliveryCommandTrailCustodyCheckpointResult = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, checkpoint_status, reason,
       can_checkpoint_sealed_evidence, evidence_seal_receipt_hash, archive_escrow_receipt_hash,
       custody_handoff_receipt_hash, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, evidence_sealed_at, custody_checkpointed_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custody_checkpoints
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(normalizedLimit * 4, 500)]
  );
  const items = [];
  const archived = new Set();
  archiveResult.rows.forEach((row) => {
    const archive = archiveEvidenceFromRow(row);
    if (!archived.has(archive.id)) {
      archived.add(archive.id);
      items.push({
        type: 'archive',
        status: 'archived',
        id: `archive:${archive.id}`,
        at: archive.created_at,
        archive,
        failed_checks: []
      });
    }
    if (row.verification_id) {
      const checks = row.verification_checks || {};
      const failures = failedChecks(checks);
      items.push({
        type: 'verification',
        status: failures.length ? 'anomaly' : 'verified',
        id: `verification:${row.verification_id}`,
        at: row.verification_created_at,
        archive,
        verification: {
          id: row.verification_id,
          identifier: row.verification_identifier,
          verifier: `${row.verifier_username}:${row.verifier_role}`,
          receipt_hash: row.receipt_hash,
          drill: row.verification_receipt?.drill || null,
          checks
        },
        failed_checks: failures
      });
    }
  });
  retentionReceiptResult.rows.forEach((row) => {
    const receipt = row.receipt || {};
    const digestIds = [
      ...(receipt.digests?.retained || []),
      ...(receipt.digests?.eligible || []),
      ...(receipt.digests?.deleted || [])
    ].map((digest) => digest.digest_id).filter(Boolean);
    items.push({
      type: 'digest_retention_receipt',
      status: row.executed ? 'pruned' : 'verified',
      id: `digest-retention-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
        mode: receipt.action?.mode || (row.executed ? 'prune_execute' : 'verification_dry_run'),
        retention_days: Number(row.retention_days || 0),
        cutoff_at: row.cutoff_at,
        retained_count: Number(row.retained_count || 0),
        eligible_count: Number(row.eligible_count || 0),
        deleted_count: Number(row.deleted_count || 0),
        digest_ids: digestIds,
        watermark: receipt.watermark || 'internal_ops_audit_notification_replay_sla_alert_digest_retention_receipt'
      },
      failed_checks: []
    });
  });
  anomalyDigestRetentionReceiptResult.rows.forEach((row) => {
    const receipt = row.receipt || {};
    if (receipt.watermark !== 'internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipt') return;
    const digestIds = [
      ...(receipt.digests?.retained || []),
      ...(receipt.digests?.eligible || []),
      ...(receipt.digests?.deleted || [])
    ].map((digest) => digest.digest_id).filter(Boolean);
    items.push({
      type: 'anomaly_digest_retention_receipt',
      status: row.executed ? 'pruned' : 'verified',
      id: `anomaly-digest-retention-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
        mode: receipt.action?.mode || (row.executed ? 'prune_execute' : 'verification_dry_run'),
        retention_days: Number(row.retention_days || 0),
        cutoff_at: row.cutoff_at,
        retained_count: Number(row.retained_count || 0),
        eligible_count: Number(row.eligible_count || 0),
        deleted_count: Number(row.deleted_count || 0),
        digest_ids: digestIds,
        watermark: receipt.watermark
      },
      bundle_verification: null,
      failed_checks: []
    });
  });
  bundleVerificationResult.rows.forEach((row) => {
    const checks = row.checks || {};
    const failures = failedChecks(checks);
    const entryFailures = (row.entry_results || [])
      .filter((entry) => entry.sha256_matches === false)
      .map((entry) => `${entry.path || 'entry'}_sha256_matches`);
    items.push({
      type: 'bundle_verification_receipt',
      status: row.valid ? 'verified' : 'anomaly',
      id: `bundle-verification-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      bundle_verification: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        verifier: `${row.verifier_username}:${row.verifier_role}`,
        valid: Boolean(row.valid),
        bundle_manifest_hash: row.bundle_manifest_hash || null,
        bundle_packet_hash: row.bundle_packet_hash || null,
        bundle_requested_by: row.bundle_requested_by || null,
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_verification_receipt'
      },
      failed_checks: [...new Set([...failures, ...entryFailures])]
    });
  });
  bundleExportResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    const manifestEntries = row.manifest_entries || [];
    items.push({
      type: 'bundle_export_receipt',
      status: 'exported',
      id: `bundle-export-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export_review: null,
      bundle_export: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        requester: `${row.requester_username}:${row.requester_role}`,
        bundle_manifest_hash: row.bundle_manifest_hash || null,
        bundle_packet_hash: row.bundle_packet_hash || null,
        manifest_entry_count: manifestEntries.length,
        reference_counts: row.reference_counts || {},
        manifest_paths: manifestEntries.map((entry) => entry.path).filter(Boolean),
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_export_receipt'
      },
      failed_checks: []
    });
  });
  bundleExportReviewResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    const status = row.decision === 'usable' && row.action === 'attested'
      ? 'attested'
      : row.decision || row.action || 'reviewed';
    items.push({
      type: 'bundle_export_review_receipt',
      status,
      id: `bundle-export-review-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: {
        id: row.id,
        bundle_export_id: row.bundle_export_id,
        receipt_hash: row.receipt_hash,
        bundle_export_receipt_hash: row.bundle_export_receipt_hash,
        reviewer: `${row.reviewer_username}:${row.reviewer_role}`,
        action: row.action,
        purpose: row.purpose,
        decision: row.decision,
        note: row.note || '',
        bundle_manifest_hash: row.bundle_manifest_hash || null,
        bundle_packet_hash: row.bundle_packet_hash || null,
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_export_review_receipt'
      },
      failed_checks: []
    });
  });
  bundleDeliveryGateReceiptResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_delivery_gate_receipt',
      status: row.decision === 'allow' ? 'allowed' : 'denied',
      id: `bundle-delivery-gate-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        reason: row.reason,
        can_deliver: Boolean(row.can_deliver),
        readiness_status: row.readiness_status,
        packet_hash: row.packet_hash,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipt'
      },
      failed_checks: []
    });
  });
  bundleHandoffPreviewReceiptResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_handoff_preview_receipt',
      status: row.status === 'ready' && row.can_handoff ? 'ready' : 'blocked',
      id: `bundle-handoff-preview-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        preview_hash: row.preview_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        status: row.status,
        reason: row.reason,
        can_handoff: Boolean(row.can_handoff),
        packet_hash: row.packet_hash,
        manifest_hash: row.manifest_hash || null,
        delivery_gate_receipt_hash: row.delivery_gate_receipt_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_delivery_handoff_preview_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalApprovalReceiptResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_approval_receipt',
      status: row.status === 'ready' && row.can_approve ? 'approved' : 'denied',
      id: `bundle-final-approval-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        approval_preview_hash: row.approval_preview_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        status: row.status,
        reason: row.reason,
        can_approve: Boolean(row.can_approve),
        packet_hash: row.packet_hash,
        manifest_hash: row.manifest_hash || null,
        handoff_preview_receipt_hash: row.handoff_preview_receipt_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalApprovalReviewResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_approval_review_receipt',
      status: row.lifecycle_status || row.action || 'reviewed',
      id: `bundle-final-approval-review-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: {
        id: row.id,
        final_approval_receipt_id: row.final_approval_receipt_id,
        receipt_hash: row.receipt_hash,
        final_approval_receipt_hash: row.final_approval_receipt_hash,
        reviewer: `${row.reviewer_username}:${row.reviewer_role}`,
        action: row.action,
        lifecycle_status: row.lifecycle_status,
        note: row.note || '',
        approval_preview_hash: row.approval_preview_hash,
        decision: row.decision,
        approval_status: row.approval_status,
        packet_hash: row.packet_hash,
        manifest_hash: row.manifest_hash || null,
        handoff_preview_receipt_hash: row.handoff_preview_receipt_hash || null,
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalApprovalPolicyGateResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_approval_policy_gate_receipt',
      status: row.decision === 'allow' ? 'allowed' : 'denied',
      id: `bundle-final-approval-policy-gate-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        policy_status: row.policy_status,
        reason: row.reason,
        can_prepare_delivery: Boolean(row.can_prepare_delivery),
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryDryRunLockResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_dry_run_lock_receipt',
      status: row.decision === 'lock' ? 'locked' : 'blocked',
      id: `bundle-final-delivery-dry-run-lock-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        lock_status: row.lock_status,
        reason: row.reason,
        can_prepare_delivery: Boolean(row.can_prepare_delivery),
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryRehearsalResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_rehearsal_receipt',
      status: row.decision === 'rehearse' ? 'rehearsed' : 'blocked',
      id: `bundle-final-delivery-rehearsal-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        rehearsal_status: row.rehearsal_status,
        reason: row.reason,
        can_execute_dry_run: Boolean(row.can_execute_dry_run),
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryDualControlApprovalResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_dual_control_approval_receipt',
      status: row.decision === 'approve' ? 'approved' : 'blocked',
      id: `bundle-final-delivery-dual-control-approval-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        approval_status: row.approval_status,
        reason: row.reason,
        can_release_after_dual_control: Boolean(row.can_release_after_dual_control),
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryReadinessSealResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_readiness_seal_receipt',
      status: row.decision === 'seal' ? 'sealed' : 'blocked',
      id: `bundle-final-delivery-readiness-seal-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        seal_status: row.seal_status,
        reason: row.reason,
        can_handoff_to_operator: Boolean(row.can_handoff_to_operator),
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliverySealedHandoffReviewResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_sealed_handoff_review_receipt',
      status: row.decision === 'signoff' ? 'signed_off' : 'blocked',
      id: `bundle-final-delivery-sealed-handoff-review-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        review_status: row.review_status,
        reason: row.reason,
        can_release_commander_signoff: Boolean(row.can_release_commander_signoff),
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandEscrowResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_escrow_receipt',
      status: row.decision === 'escrow' ? 'escrowed' : 'blocked',
      id: `bundle-final-delivery-command-escrow-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        escrow_status: row.escrow_status,
        reason: row.reason,
        can_seal_release_command: Boolean(row.can_seal_release_command),
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandRevocationResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_revocation_receipt',
      status: row.decision === 'revoke' ? 'revoked' : 'blocked',
      id: `bundle-final-delivery-command-revocation-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        revocation_status: row.revocation_status,
        reason: row.reason,
        can_rollback_release_command: Boolean(row.can_rollback_release_command),
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandClosureResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_closure_receipt',
      status: row.decision === 'close' ? 'closed' : 'blocked',
      id: `bundle-final-delivery-command-closure-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        closure_status: row.closure_status,
        reason: row.reason,
        can_reinstate_release_command: Boolean(row.can_reinstate_release_command),
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_closure_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailNotarizationResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_notarization_receipt',
      status: row.decision === 'notarize' ? 'notarized' : 'blocked',
      id: `bundle-final-delivery-command-trail-notarization-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        notarization_status: row.notarization_status,
        reason: row.reason,
        can_archive_release_trail: Boolean(row.can_archive_release_trail),
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailCustodyResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_custody_receipt',
      status: row.decision === 'lock' ? 'custody_locked' : 'blocked',
      id: `bundle-final-delivery-command-trail-custody-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        custody_status: row.custody_status,
        reason: row.reason,
        can_retain_release_archive: Boolean(row.can_retain_release_archive),
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailRetentionAttestationResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_retention_attestation_receipt',
      status: row.decision === 'attest' ? 'retention_attested' : 'blocked',
      id: `bundle-final-delivery-command-trail-retention-attestation-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        attestation_status: row.attestation_status,
        reason: row.reason,
        can_continue_release_archive_retention: Boolean(row.can_continue_release_archive_retention),
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        next_review_due_at: row.next_review_due_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailRenewalWindowResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_renewal_window_receipt',
      status: row.decision === 'renew' ? 'renewal_window_scheduled' : 'blocked',
      id: `bundle-final-delivery-command-trail-renewal-window-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: null,
      bundle_final_delivery_command_trail_renewal_window: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        renewal_status: row.renewal_status,
        reason: row.reason,
        can_schedule_next_retention_review: Boolean(row.can_schedule_next_retention_review),
        retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        renewal_window_opens_at: row.renewal_window_opens_at || null,
        expires_at: row.expires_at || null,
        next_review_due_at: row.next_review_due_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailRenewalConfirmationResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_renewal_confirmation_receipt',
      status: row.decision === 'confirm' ? 'renewal_checkpoint_confirmed' : 'blocked',
      id: `bundle-final-delivery-command-trail-renewal-confirmation-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: null,
      bundle_final_delivery_command_trail_renewal_window: null,
      bundle_final_delivery_command_trail_renewal_confirmation: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        confirmation_status: row.confirmation_status,
        reason: row.reason,
        can_continue_archive_renewal: Boolean(row.can_continue_archive_renewal),
        renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
        retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        renewal_window_opens_at: row.renewal_window_opens_at || null,
        checkpoint_at: row.checkpoint_at || null,
        next_review_due_at: row.next_review_due_at || null,
        expires_at: row.expires_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailCheckpointSealResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_checkpoint_seal_receipt',
      status: row.decision === 'seal' ? 'archive_checkpoint_frozen' : 'blocked',
      id: `bundle-final-delivery-command-trail-checkpoint-seal-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: null,
      bundle_final_delivery_command_trail_renewal_window: null,
      bundle_final_delivery_command_trail_renewal_confirmation: null,
      bundle_final_delivery_command_trail_checkpoint_seal: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        seal_status: row.seal_status,
        reason: row.reason,
        can_freeze_archive_checkpoint: Boolean(row.can_freeze_archive_checkpoint),
        renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
        renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
        retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        checkpoint_at: row.checkpoint_at || null,
        frozen_at: row.frozen_at || null,
        next_review_due_at: row.next_review_due_at || null,
        expires_at: row.expires_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailCustodyHandoffResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_custody_handoff_receipt',
      status: row.decision === 'handoff' ? 'archive_custody_transferred' : 'blocked',
      id: `bundle-final-delivery-command-trail-custody-handoff-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: null,
      bundle_final_delivery_command_trail_renewal_window: null,
      bundle_final_delivery_command_trail_renewal_confirmation: null,
      bundle_final_delivery_command_trail_checkpoint_seal: null,
      bundle_final_delivery_command_trail_custody_handoff: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        handoff_status: row.handoff_status,
        reason: row.reason,
        can_transfer_archive_custody: Boolean(row.can_transfer_archive_custody),
        checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
        renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
        renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
        retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        checkpoint_at: row.checkpoint_at || null,
        frozen_at: row.frozen_at || null,
        custody_handoff_at: row.custody_handoff_at || null,
        next_review_due_at: row.next_review_due_at || null,
        expires_at: row.expires_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailArchiveEscrowResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_archive_escrow_receipt',
      status: row.decision === 'escrow' ? 'archive_evidence_locked' : 'blocked',
      id: `bundle-final-delivery-command-trail-archive-escrow-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: null,
      bundle_final_delivery_command_trail_renewal_window: null,
      bundle_final_delivery_command_trail_renewal_confirmation: null,
      bundle_final_delivery_command_trail_checkpoint_seal: null,
      bundle_final_delivery_command_trail_custody_handoff: null,
      bundle_final_delivery_command_trail_archive_escrow: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        escrow_status: row.escrow_status,
        reason: row.reason,
        can_lock_archive_evidence: Boolean(row.can_lock_archive_evidence),
        custody_handoff_receipt_hash: row.custody_handoff_receipt_hash || null,
        checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
        renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
        renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
        retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        custody_handoff_at: row.custody_handoff_at || null,
        escrow_locked_at: row.escrow_locked_at || null,
        next_review_due_at: row.next_review_due_at || null,
        expires_at: row.expires_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailEvidenceSealResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_evidence_seal_receipt',
      status: row.decision === 'seal' ? 'release_evidence_notarized' : 'blocked',
      id: `bundle-final-delivery-command-trail-evidence-seal-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: null,
      bundle_final_delivery_command_trail_renewal_window: null,
      bundle_final_delivery_command_trail_renewal_confirmation: null,
      bundle_final_delivery_command_trail_checkpoint_seal: null,
      bundle_final_delivery_command_trail_custody_handoff: null,
      bundle_final_delivery_command_trail_archive_escrow: null,
      bundle_final_delivery_command_trail_evidence_seal: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        seal_status: row.seal_status,
        reason: row.reason,
        can_notarize_release_evidence: Boolean(row.can_notarize_release_evidence),
        archive_escrow_receipt_hash: row.archive_escrow_receipt_hash || null,
        custody_handoff_receipt_hash: row.custody_handoff_receipt_hash || null,
        checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
        renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
        renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
        retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        escrow_locked_at: row.escrow_locked_at || null,
        evidence_sealed_at: row.evidence_sealed_at || null,
        next_review_due_at: row.next_review_due_at || null,
        expires_at: row.expires_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt'
      },
      failed_checks: []
    });
  });
  bundleFinalDeliveryCommandTrailCustodyCheckpointResult.rows.forEach((row) => {
    if (!row.receipt_hash) return;
    items.push({
      type: 'bundle_final_delivery_command_trail_custody_checkpoint_receipt',
      status: row.decision === 'checkpoint' ? 'sealed_evidence_custody_checkpointed' : 'blocked',
      id: `bundle-final-delivery-command-trail-custody-checkpoint-receipt:${row.id}`,
      at: row.created_at,
      archive: null,
      verification: null,
      retention_receipt: null,
      anomaly_digest_retention_receipt: null,
      bundle_verification: null,
      bundle_export: null,
      bundle_export_review: null,
      bundle_delivery_gate: null,
      bundle_handoff_preview: null,
      bundle_final_approval: null,
      bundle_final_approval_review: null,
      bundle_final_approval_policy_gate: null,
      bundle_final_delivery_dry_run_lock: null,
      bundle_final_delivery_rehearsal: null,
      bundle_final_delivery_dual_control_approval: null,
      bundle_final_delivery_readiness_seal: null,
      bundle_final_delivery_sealed_handoff_review: null,
      bundle_final_delivery_command_escrow: null,
      bundle_final_delivery_command_revocation: null,
      bundle_final_delivery_command_closure: null,
      bundle_final_delivery_command_trail_notarization: null,
      bundle_final_delivery_command_trail_custody: null,
      bundle_final_delivery_command_trail_retention_attestation: null,
      bundle_final_delivery_command_trail_renewal_window: null,
      bundle_final_delivery_command_trail_renewal_confirmation: null,
      bundle_final_delivery_command_trail_checkpoint_seal: null,
      bundle_final_delivery_command_trail_custody_handoff: null,
      bundle_final_delivery_command_trail_archive_escrow: null,
      bundle_final_delivery_command_trail_evidence_seal: null,
      bundle_final_delivery_command_trail_custody_checkpoint: {
        id: row.id,
        receipt_hash: row.receipt_hash,
        recorder: `${row.recorder_username}:${row.recorder_role}`,
        decision: row.decision,
        checkpoint_status: row.checkpoint_status,
        reason: row.reason,
        can_checkpoint_sealed_evidence: Boolean(row.can_checkpoint_sealed_evidence),
        evidence_seal_receipt_hash: row.evidence_seal_receipt_hash || null,
        archive_escrow_receipt_hash: row.archive_escrow_receipt_hash || null,
        custody_handoff_receipt_hash: row.custody_handoff_receipt_hash || null,
        checkpoint_seal_receipt_hash: row.checkpoint_seal_receipt_hash || null,
        renewal_confirmation_receipt_hash: row.renewal_confirmation_receipt_hash || null,
        renewal_window_receipt_hash: row.renewal_window_receipt_hash || null,
        retention_attestation_receipt_hash: row.retention_attestation_receipt_hash || null,
        trail_custody_receipt_hash: row.trail_custody_receipt_hash || null,
        trail_notarization_receipt_hash: row.trail_notarization_receipt_hash || null,
        command_closure_receipt_hash: row.command_closure_receipt_hash || null,
        command_revocation_receipt_hash: row.command_revocation_receipt_hash || null,
        command_escrow_receipt_hash: row.command_escrow_receipt_hash || null,
        sealed_handoff_review_receipt_hash: row.sealed_handoff_review_receipt_hash || null,
        readiness_seal_receipt_hash: row.readiness_seal_receipt_hash || null,
        dual_control_approval_receipt_hash: row.dual_control_approval_receipt_hash || null,
        rehearsal_receipt_hash: row.rehearsal_receipt_hash || null,
        dry_run_lock_receipt_hash: row.dry_run_lock_receipt_hash || null,
        policy_gate_receipt_hash: row.policy_gate_receipt_hash || null,
        final_approval_receipt_hash: row.final_approval_receipt_hash || null,
        lifecycle_review_receipt_hash: row.lifecycle_review_receipt_hash || null,
        packet_hash: row.packet_hash || null,
        manifest_hash: row.manifest_hash || null,
        evidence_sealed_at: row.evidence_sealed_at || null,
        custody_checkpointed_at: row.custody_checkpointed_at || null,
        next_review_due_at: row.next_review_due_at || null,
        expires_at: row.expires_at || null,
        filters: row.filters || {},
        watermark: row.receipt?.watermark || 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt'
      },
      failed_checks: []
    });
  });
  const filteredItems = items.filter((item) => evidenceMatchesFilters(item, filters)).slice(0, normalizedLimit);
  return {
    schema_version: 'phase4-ops-audit-evidence-chain-v1',
    filters: {
      report_id: filters.report_id || '',
      report_hash: filters.report_hash || '',
      receipt_hash: filters.receipt_hash || '',
      verifier: filters.verifier || '',
      failed_check: filters.failed_check || '',
      q: filters.q || ''
    },
    summary: buildEvidenceSummary(filteredItems),
    items: filteredItems
  };
}

export async function getOpsAuditEvidenceCasePacket(filters = {}, actor = {}, client = pool) {
  const evidenceChain = await getOpsAuditEvidenceChain(filters, client);
  const references = casePacketReferences(evidenceChain.items);
  const deliveryReadiness = buildBundleExportDeliveryReadiness(references);
  const deliveryGate = buildBundleExportDeliveryPolicyGate(deliveryReadiness);
  const summary = {
    ...evidenceChain.summary,
    bundle_export_delivery_status: deliveryReadiness.delivery_status,
    bundle_export_delivery_counts: deliveryReadiness.counts,
    bundle_export_delivery_gate_decision: deliveryGate.decision,
    bundle_export_delivery_gate_reason: deliveryGate.reason
  };
  const packet = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-v1',
    generated_at: new Date().toISOString(),
    requested_by: casePacketActor(actor),
    filters: casePacketFilters(filters),
    watermark: 'internal_ops_audit_evidence_case_packet',
    summary,
    references,
    delivery_readiness: deliveryReadiness,
    delivery_gate: deliveryGate,
    recommendations: casePacketRecommendations(summary),
    evidence_chain: evidenceChain
  };
  packet.packet_hash = digestValue({
    schema_version: packet.schema_version,
    requested_by: packet.requested_by,
    filters: packet.filters,
    summary: packet.summary,
    references: packet.references,
    delivery_readiness: packet.delivery_readiness,
    delivery_gate: packet.delivery_gate,
    recommendations: packet.recommendations,
    evidence_chain: packet.evidence_chain,
    watermark: packet.watermark
  });
  return packet;
}

export async function getOpsAuditEvidenceCasePacketBundleExportDeliveryReadiness(filters = {}, actor = {}, client = pool) {
  const packet = await getOpsAuditEvidenceCasePacket(filters, actor, client);
  return packet.delivery_readiness;
}

export async function getOpsAuditEvidenceCasePacketBundleExportDeliveryGate(filters = {}, actor = {}, client = pool) {
  const packet = await getOpsAuditEvidenceCasePacket(filters, actor, client);
  return packet.delivery_gate;
}

export async function recordOpsAuditEvidenceCasePacketBundleDeliveryGateReceipt(
  { filters = {}, recorder = {} } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle delivery gate receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_gate_receipt_recorder_required';
    throw error;
  }
  const packet = await getOpsAuditEvidenceCasePacket(filters, recorder, client);
  const deliveryReadiness = packet.delivery_readiness || buildBundleExportDeliveryReadiness(packet.references || {});
  const deliveryGate = packet.delivery_gate || buildBundleExportDeliveryPolicyGate(deliveryReadiness);
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-gate-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: packet.filters || {},
    packet: {
      packet_hash: packet.packet_hash,
      generated_at: packet.generated_at,
      evidence_item_count: packet.summary?.total_items || 0,
      bundle_export_receipt_count: packet.summary?.bundle_export_receipt_count || 0,
      bundle_export_review_receipt_count: packet.summary?.bundle_export_review_receipt_count || 0,
      bundle_export_delivery_status: packet.summary?.bundle_export_delivery_status || deliveryReadiness.delivery_status,
      bundle_export_delivery_gate_decision: deliveryGate.decision,
      bundle_export_delivery_gate_reason: deliveryGate.reason
    },
    delivery_readiness: {
      schema_version: deliveryReadiness.schema_version,
      delivery_status: deliveryReadiness.delivery_status,
      counts: deliveryReadiness.counts || {}
    },
    delivery_gate: {
      schema_version: deliveryGate.schema_version,
      readiness_status: deliveryGate.readiness_status || 'unknown',
      counts: deliveryGate.counts || {},
      can_deliver: Boolean(deliveryGate.can_deliver),
      decision: deliveryGate.decision,
      reason: deliveryGate.reason,
      explanation: deliveryGate.explanation,
      required_actions: deliveryGate.required_actions || [],
      watermark: deliveryGate.watermark
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipt'
  };
  receipt.receipt_hash = bundleDeliveryGateReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       reason,
       can_deliver,
       readiness_status,
       packet_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, reason, can_deliver,
       readiness_status, packet_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      deliveryGate.decision,
      deliveryGate.reason,
      Boolean(deliveryGate.can_deliver),
      deliveryGate.readiness_status || 'unknown',
      packet.packet_hash,
      JSON.stringify(packet.filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleDeliveryGateReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleDeliveryGateReceipts(
  { limit = 20, decision = '', readiness_status: readinessStatus = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['allow', 'deny'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle delivery gate receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_delivery_gate_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (readinessStatus) {
    const normalizedReadinessStatus = String(readinessStatus).trim().toLowerCase();
    if (!['eligible', 'needs_review', 'blocked', 'no_exports', 'unknown'].includes(normalizedReadinessStatus)) {
      const error = new Error('Evidence case packet bundle delivery gate receipt readiness status is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_delivery_gate_receipt_readiness_invalid';
      throw error;
    }
    params.push(normalizedReadinessStatus);
    where.push(`readiness_status = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, reason, can_deliver,
       readiness_status, packet_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleDeliveryGateReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryGateReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle delivery gate receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_gate_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, reason, can_deliver,
       readiness_status, packet_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_delivery_gate_receipts
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle delivery gate receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_gate_receipt_not_found';
    throw error;
  }
  return normalizeBundleDeliveryGateReceipt(result.rows[0]);
}

function evidenceBundleSignature({ manifest_hash: manifestHash, requested_by: requestedBy, packet_hash: packetHash }, secret) {
  const payload = stableJson({
    manifest_hash: manifestHash,
    packet_hash: packetHash,
    requested_by: requestedBy,
    watermark: 'internal_ops_audit_evidence_case_packet_signed_bundle'
  });
  if (secret) {
    return {
      algorithm: 'hmac-sha256',
      signature: createHmac('sha256', secret).update(payload).digest('hex')
    };
  }
  return {
    algorithm: 'sha256',
    signature: hashText(payload)
  };
}

function bundleManifestEntry(path, type, value) {
  const hashableValue = jsonSafeValue(value);
  return {
    path,
    type,
    sha256: digestValue(hashableValue),
    item_count: Array.isArray(value) ? value.length : undefined
  };
}

function archiveBundleReference(archive) {
  return {
    schema_version: archive.schema_version,
    id: archive.id,
    report_id: archive.report_id,
    report_hash: archive.report_hash,
    event_digest: archive.event_digest,
    html_hash: archive.html_hash,
    evidence_signature: archive.evidence_signature,
    requested_by: archive.requested_by,
    filters: archive.filters || {},
    retention: archive.retention || {},
    date_range: archive.date_range || {},
    summary: archive.summary || {},
    totals: archive.totals || {},
    event_count: archive.event_count,
    created_at: archive.created_at
  };
}

function verificationBundleReceipt(verification) {
  return {
    schema_version: verification.schema_version,
    id: verification.id,
    archive_id: verification.archive_id,
    identifier: verification.identifier,
    verifier: verification.verifier,
    receipt_hash: verification.receipt_hash,
    checks: verification.checks || {},
    receipt: verification.receipt || null,
    created_at: verification.created_at
  };
}

function bundleManifestEntriesFor(bundle) {
  return [
    bundleManifestEntry('packet.json', 'evidence_case_packet', bundle.packet || {}),
    bundleManifestEntry('evidence-chain.json', 'evidence_chain', bundle.packet?.evidence_chain || {}),
    bundleManifestEntry('archives.json', 'archive_references', bundle.archives || []),
    bundleManifestEntry('verification-receipts.json', 'verification_receipts', bundle.verification_receipts || []),
    bundleManifestEntry('retention-receipt-references.json', 'retention_receipt_references', bundle.retention_receipt_references || []),
    bundleManifestEntry(
      'bundle-verification-references.json',
      'bundle_verification_references',
      bundle.bundle_verification_references || []
    ),
    bundleManifestEntry(
      'anomaly-digest-retention-receipt-references.json',
      'anomaly_digest_retention_receipt_references',
      bundle.anomaly_digest_retention_receipt_references || []
    ),
    bundleManifestEntry(
      'bundle-export-references.json',
      'bundle_export_references',
      bundle.bundle_export_references || []
    ),
    bundleManifestEntry(
      'bundle-export-review-references.json',
      'bundle_export_review_references',
      bundle.bundle_export_review_references || []
    ),
    bundleManifestEntry(
      'delivery-readiness-rollup.json',
      'bundle_export_delivery_readiness',
      bundle.delivery_readiness || {}
    ),
    bundleManifestEntry(
      'delivery-policy-gate.json',
      'bundle_export_delivery_gate',
      bundle.delivery_gate || {}
    ),
    bundleManifestEntry(
      'delivery-gate-receipt-references.json',
      'bundle_delivery_gate_receipt_references',
      bundle.bundle_delivery_gate_receipt_references || []
    ),
    bundleManifestEntry(
      'handoff-preview-receipt-references.json',
      'bundle_handoff_preview_receipt_references',
      bundle.bundle_handoff_preview_receipt_references || []
    ),
    bundleManifestEntry(
      'final-approval-receipt-references.json',
      'bundle_final_approval_receipt_references',
      bundle.bundle_final_approval_receipt_references || []
    ),
    bundleManifestEntry(
      'final-approval-review-receipt-references.json',
      'bundle_final_approval_review_references',
      bundle.bundle_final_approval_review_references || []
    ),
    bundleManifestEntry(
      'final-approval-policy-gate-receipt-references.json',
      'bundle_final_approval_policy_gate_references',
      bundle.bundle_final_approval_policy_gate_references || []
    ),
    bundleManifestEntry(
      'final-delivery-dry-run-lock-receipt-references.json',
      'bundle_final_delivery_dry_run_lock_references',
      bundle.bundle_final_delivery_dry_run_lock_references || []
    ),
    bundleManifestEntry(
      'final-delivery-rehearsal-receipt-references.json',
      'bundle_final_delivery_rehearsal_references',
      bundle.bundle_final_delivery_rehearsal_references || []
    ),
    bundleManifestEntry(
      'final-delivery-dual-control-approval-receipt-references.json',
      'bundle_final_delivery_dual_control_approval_references',
      bundle.bundle_final_delivery_dual_control_approval_references || []
    ),
    bundleManifestEntry(
      'final-delivery-readiness-seal-receipt-references.json',
      'bundle_final_delivery_readiness_seal_references',
      bundle.bundle_final_delivery_readiness_seal_references || []
    ),
    bundleManifestEntry(
      'final-delivery-sealed-handoff-review-receipt-references.json',
      'bundle_final_delivery_sealed_handoff_review_references',
      bundle.bundle_final_delivery_sealed_handoff_review_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-escrow-receipt-references.json',
      'bundle_final_delivery_command_escrow_references',
      bundle.bundle_final_delivery_command_escrow_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-revocation-receipt-references.json',
      'bundle_final_delivery_command_revocation_references',
      bundle.bundle_final_delivery_command_revocation_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-closure-receipt-references.json',
      'bundle_final_delivery_command_closure_references',
      bundle.bundle_final_delivery_command_closure_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-notarization-receipt-references.json',
      'bundle_final_delivery_command_trail_notarization_references',
      bundle.bundle_final_delivery_command_trail_notarization_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-custody-receipt-references.json',
      'bundle_final_delivery_command_trail_custody_references',
      bundle.bundle_final_delivery_command_trail_custody_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-retention-attestation-receipt-references.json',
      'bundle_final_delivery_command_trail_retention_attestation_references',
      bundle.bundle_final_delivery_command_trail_retention_attestation_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-renewal-window-receipt-references.json',
      'bundle_final_delivery_command_trail_renewal_window_references',
      bundle.bundle_final_delivery_command_trail_renewal_window_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-renewal-confirmation-receipt-references.json',
      'bundle_final_delivery_command_trail_renewal_confirmation_references',
      bundle.bundle_final_delivery_command_trail_renewal_confirmation_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-checkpoint-seal-receipt-references.json',
      'bundle_final_delivery_command_trail_checkpoint_seal_references',
      bundle.bundle_final_delivery_command_trail_checkpoint_seal_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-custody-handoff-receipt-references.json',
      'bundle_final_delivery_command_trail_custody_handoff_references',
      bundle.bundle_final_delivery_command_trail_custody_handoff_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-archive-escrow-receipt-references.json',
      'bundle_final_delivery_command_trail_archive_escrow_references',
      bundle.bundle_final_delivery_command_trail_archive_escrow_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-evidence-seal-receipt-references.json',
      'bundle_final_delivery_command_trail_evidence_seal_references',
      bundle.bundle_final_delivery_command_trail_evidence_seal_references || []
    ),
    bundleManifestEntry(
      'final-delivery-command-trail-custody-checkpoint-receipt-references.json',
      'bundle_final_delivery_command_trail_custody_checkpoint_references',
      bundle.bundle_final_delivery_command_trail_custody_checkpoint_references || []
    )
  ].map((entry) => Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)));
}

export async function getOpsAuditEvidenceCasePacketBundle(filters = {}, actor = {}, signingSecret, client = pool) {
  const packet = await getOpsAuditEvidenceCasePacket(filters, actor, client);
  const archiveReferences = [];
  for (const archive of packet.references.archives || []) {
    const hydratedArchive = await getOpsAuditReportArchive(archive.id, client);
    archiveReferences.push(archiveBundleReference(hydratedArchive));
  }
  const verificationReceipts = [];
  for (const verification of packet.references.verifications || []) {
    const hydratedVerification = await getOpsAuditReportVerification(verification.receipt_hash || verification.id, client);
    verificationReceipts.push(verificationBundleReceipt(hydratedVerification));
  }
  const retentionReceiptReferences = packet.references.retention_receipts || [];
  const bundleVerificationReferences = packet.references.bundle_verifications || [];
  const anomalyDigestRetentionReceiptReferences = packet.references.anomaly_digest_retention_receipts || [];
  const bundleExportReferences = packet.references.bundle_exports || [];
  const bundleExportReviewReferences = packet.references.bundle_export_reviews || [];
  const bundleDeliveryGateReceiptReferences = packet.references.bundle_delivery_gate_receipts || [];
  const bundleHandoffPreviewReceiptReferences = packet.references.bundle_handoff_preview_receipts || [];
  const bundleFinalApprovalReceiptReferences = packet.references.bundle_final_approval_receipts || [];
  const bundleFinalApprovalReviewReferences = packet.references.bundle_final_approval_reviews || [];
  const bundleFinalApprovalPolicyGateReferences = packet.references.bundle_final_approval_policy_gate_receipts || [];
  const bundleFinalDeliveryDryRunLockReferences = packet.references.bundle_final_delivery_dry_run_lock_receipts || [];
  const bundleFinalDeliveryRehearsalReferences = packet.references.bundle_final_delivery_rehearsal_receipts || [];
  const bundleFinalDeliveryDualControlApprovalReferences = packet.references.bundle_final_delivery_dual_control_approval_receipts || [];
  const bundleFinalDeliveryReadinessSealReferences = packet.references.bundle_final_delivery_readiness_seal_receipts || [];
  const bundleFinalDeliverySealedHandoffReviewReferences = packet.references.bundle_final_delivery_sealed_handoff_review_receipts || [];
  const bundleFinalDeliveryCommandEscrowReferences = packet.references.bundle_final_delivery_command_escrow_receipts || [];
  const bundleFinalDeliveryCommandRevocationReferences = packet.references.bundle_final_delivery_command_revocation_receipts || [];
  const bundleFinalDeliveryCommandClosureReferences = packet.references.bundle_final_delivery_command_closure_receipts || [];
  const bundleFinalDeliveryCommandTrailNotarizationReferences = packet.references.bundle_final_delivery_command_trail_notarization_receipts || [];
  const bundleFinalDeliveryCommandTrailCustodyReferences = packet.references.bundle_final_delivery_command_trail_custody_receipts || [];
  const bundleFinalDeliveryCommandTrailRetentionAttestationReferences = packet.references.bundle_final_delivery_command_trail_retention_attestation_receipts || [];
  const bundleFinalDeliveryCommandTrailRenewalWindowReferences = packet.references.bundle_final_delivery_command_trail_renewal_window_receipts || [];
  const bundleFinalDeliveryCommandTrailRenewalConfirmationReferences = packet.references.bundle_final_delivery_command_trail_renewal_confirmation_receipts || [];
  const bundleFinalDeliveryCommandTrailCheckpointSealReferences = packet.references.bundle_final_delivery_command_trail_checkpoint_seal_receipts || [];
  const bundleFinalDeliveryCommandTrailCustodyHandoffReferences = packet.references.bundle_final_delivery_command_trail_custody_handoff_receipts || [];
  const bundleFinalDeliveryCommandTrailArchiveEscrowReferences = packet.references.bundle_final_delivery_command_trail_archive_escrow_receipts || [];
  const bundleFinalDeliveryCommandTrailEvidenceSealReferences = packet.references.bundle_final_delivery_command_trail_evidence_seal_receipts || [];
  const bundleFinalDeliveryCommandTrailCustodyCheckpointReferences = packet.references.bundle_final_delivery_command_trail_custody_checkpoint_receipts || [];
  const deliveryReadiness = packet.delivery_readiness || buildBundleExportDeliveryReadiness(packet.references || {});
  const deliveryGate = packet.delivery_gate || buildBundleExportDeliveryPolicyGate(deliveryReadiness);
  const entries = bundleManifestEntriesFor({
    packet,
    archives: archiveReferences,
    verification_receipts: verificationReceipts,
    retention_receipt_references: retentionReceiptReferences,
    bundle_verification_references: bundleVerificationReferences,
    anomaly_digest_retention_receipt_references: anomalyDigestRetentionReceiptReferences,
    bundle_export_references: bundleExportReferences,
    bundle_export_review_references: bundleExportReviewReferences,
    bundle_delivery_gate_receipt_references: bundleDeliveryGateReceiptReferences,
    bundle_handoff_preview_receipt_references: bundleHandoffPreviewReceiptReferences,
    bundle_final_approval_receipt_references: bundleFinalApprovalReceiptReferences,
    bundle_final_approval_review_references: bundleFinalApprovalReviewReferences,
    bundle_final_approval_policy_gate_references: bundleFinalApprovalPolicyGateReferences,
    bundle_final_delivery_dry_run_lock_references: bundleFinalDeliveryDryRunLockReferences,
    bundle_final_delivery_rehearsal_references: bundleFinalDeliveryRehearsalReferences,
    bundle_final_delivery_dual_control_approval_references: bundleFinalDeliveryDualControlApprovalReferences,
    bundle_final_delivery_readiness_seal_references: bundleFinalDeliveryReadinessSealReferences,
    bundle_final_delivery_sealed_handoff_review_references: bundleFinalDeliverySealedHandoffReviewReferences,
    bundle_final_delivery_command_escrow_references: bundleFinalDeliveryCommandEscrowReferences,
    bundle_final_delivery_command_revocation_references: bundleFinalDeliveryCommandRevocationReferences,
    bundle_final_delivery_command_closure_references: bundleFinalDeliveryCommandClosureReferences,
    bundle_final_delivery_command_trail_notarization_references: bundleFinalDeliveryCommandTrailNotarizationReferences,
    bundle_final_delivery_command_trail_custody_references: bundleFinalDeliveryCommandTrailCustodyReferences,
    bundle_final_delivery_command_trail_retention_attestation_references: bundleFinalDeliveryCommandTrailRetentionAttestationReferences,
    bundle_final_delivery_command_trail_renewal_window_references: bundleFinalDeliveryCommandTrailRenewalWindowReferences,
    bundle_final_delivery_command_trail_renewal_confirmation_references: bundleFinalDeliveryCommandTrailRenewalConfirmationReferences,
    bundle_final_delivery_command_trail_checkpoint_seal_references: bundleFinalDeliveryCommandTrailCheckpointSealReferences,
    bundle_final_delivery_command_trail_custody_handoff_references: bundleFinalDeliveryCommandTrailCustodyHandoffReferences,
    bundle_final_delivery_command_trail_archive_escrow_references: bundleFinalDeliveryCommandTrailArchiveEscrowReferences,
    bundle_final_delivery_command_trail_evidence_seal_references: bundleFinalDeliveryCommandTrailEvidenceSealReferences,
    bundle_final_delivery_command_trail_custody_checkpoint_references: bundleFinalDeliveryCommandTrailCustodyCheckpointReferences,
    delivery_readiness: deliveryReadiness,
    delivery_gate: deliveryGate
  });
  const manifest = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-manifest-v1',
    entries
  };
  const manifestHash = digestValue(manifest);
  const signature = evidenceBundleSignature(
    {
      manifest_hash: manifestHash,
      packet_hash: packet.packet_hash,
      requested_by: packet.requested_by
    },
    signingSecret
  );
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-signed-bundle-v1',
    generated_at: new Date().toISOString(),
    requested_by: packet.requested_by,
    watermark: 'internal_ops_audit_evidence_case_packet_signed_bundle',
    packet_hash: packet.packet_hash,
    manifest_hash: manifestHash,
    signature,
    manifest,
    packet,
    archives: archiveReferences,
    verification_receipts: verificationReceipts,
    retention_receipt_references: retentionReceiptReferences,
    bundle_verification_references: bundleVerificationReferences,
    anomaly_digest_retention_receipt_references: anomalyDigestRetentionReceiptReferences,
    bundle_export_references: bundleExportReferences,
    bundle_export_review_references: bundleExportReviewReferences,
    bundle_delivery_gate_receipt_references: bundleDeliveryGateReceiptReferences,
    bundle_handoff_preview_receipt_references: bundleHandoffPreviewReceiptReferences,
    bundle_final_approval_receipt_references: bundleFinalApprovalReceiptReferences,
    bundle_final_approval_review_references: bundleFinalApprovalReviewReferences,
    bundle_final_approval_policy_gate_references: bundleFinalApprovalPolicyGateReferences,
    bundle_final_delivery_dry_run_lock_references: bundleFinalDeliveryDryRunLockReferences,
    bundle_final_delivery_rehearsal_references: bundleFinalDeliveryRehearsalReferences,
    bundle_final_delivery_dual_control_approval_references: bundleFinalDeliveryDualControlApprovalReferences,
    bundle_final_delivery_readiness_seal_references: bundleFinalDeliveryReadinessSealReferences,
    bundle_final_delivery_sealed_handoff_review_references: bundleFinalDeliverySealedHandoffReviewReferences,
    bundle_final_delivery_command_escrow_references: bundleFinalDeliveryCommandEscrowReferences,
    bundle_final_delivery_command_revocation_references: bundleFinalDeliveryCommandRevocationReferences,
    bundle_final_delivery_command_closure_references: bundleFinalDeliveryCommandClosureReferences,
    bundle_final_delivery_command_trail_notarization_references: bundleFinalDeliveryCommandTrailNotarizationReferences,
    bundle_final_delivery_command_trail_custody_references: bundleFinalDeliveryCommandTrailCustodyReferences,
    bundle_final_delivery_command_trail_retention_attestation_references: bundleFinalDeliveryCommandTrailRetentionAttestationReferences,
    bundle_final_delivery_command_trail_renewal_window_references: bundleFinalDeliveryCommandTrailRenewalWindowReferences,
    bundle_final_delivery_command_trail_renewal_confirmation_references: bundleFinalDeliveryCommandTrailRenewalConfirmationReferences,
    bundle_final_delivery_command_trail_checkpoint_seal_references: bundleFinalDeliveryCommandTrailCheckpointSealReferences,
    bundle_final_delivery_command_trail_custody_handoff_references: bundleFinalDeliveryCommandTrailCustodyHandoffReferences,
    bundle_final_delivery_command_trail_archive_escrow_references: bundleFinalDeliveryCommandTrailArchiveEscrowReferences,
    bundle_final_delivery_command_trail_evidence_seal_references: bundleFinalDeliveryCommandTrailEvidenceSealReferences,
    bundle_final_delivery_command_trail_custody_checkpoint_references: bundleFinalDeliveryCommandTrailCustodyCheckpointReferences,
    delivery_readiness: deliveryReadiness,
    delivery_gate: deliveryGate
  };
}

function buildDeliveryHandoffRequiredActions({ gateReceipt, verification }) {
  const actions = [];
  if (!gateReceipt) {
    actions.push('record_delivery_gate_receipt');
  } else if (!(gateReceipt.decision === 'allow' && gateReceipt.can_deliver === true)) {
    actions.push('resolve_delivery_gate_denial');
  }
  if (!verification.valid) {
    actions.push('fix_signed_bundle_verification');
  }
  return actions;
}

function buildDeliveryHandoffReason({ gateReceipt, verification }) {
  if (!gateReceipt) return 'missing_delivery_gate_receipt';
  if (!(gateReceipt.decision === 'allow' && gateReceipt.can_deliver === true)) {
    return gateReceipt.reason || 'delivery_gate_denied';
  }
  if (!verification.valid) return 'signed_bundle_verification_failed';
  return 'ready_for_internal_handoff_preview';
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreview(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle delivery handoff preview actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_handoff_preview_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const verification = verifyOpsAuditEvidenceCasePacketBundle(bundle, signingSecret);
  const gateReceipt = (bundle.bundle_delivery_gate_receipt_references || [])[0] || null;
  const requiredActions = buildDeliveryHandoffRequiredActions({ gateReceipt, verification });
  const reason = buildDeliveryHandoffReason({ gateReceipt, verification });
  const canHandoff = requiredActions.length === 0;
  const generatedAt = new Date().toISOString();
  const preview = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-handoff-preview-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    status: canHandoff ? 'ready' : 'blocked',
    can_handoff: canHandoff,
    reason,
    explanation: canHandoff
      ? 'Signed bundle, delivery gate receipt, and verification checks are ready for an internal handoff preview.'
      : 'Internal handoff preview is blocked until the required audit artifacts are complete and valid.',
    required_actions: requiredActions,
    packet: {
      packet_hash: bundle.packet_hash,
      generated_at: bundle.packet?.generated_at || null,
      evidence_item_count: bundle.packet?.summary?.total_items || 0,
      bundle_export_receipt_count: bundle.packet?.summary?.bundle_export_receipt_count || 0,
      bundle_export_review_receipt_count: bundle.packet?.summary?.bundle_export_review_receipt_count || 0,
      bundle_delivery_gate_receipt_count: bundle.packet?.summary?.bundle_delivery_gate_receipt_count || 0,
      bundle_handoff_preview_receipt_count: bundle.packet?.summary?.bundle_handoff_preview_receipt_count || 0
    },
    delivery_readiness: {
      delivery_status: bundle.delivery_readiness?.delivery_status || 'no_exports',
      counts: bundle.delivery_readiness?.counts || {}
    },
    delivery_gate: {
      decision: bundle.delivery_gate?.decision || 'deny',
      reason: bundle.delivery_gate?.reason || 'no_export_receipt',
      can_deliver: Boolean(bundle.delivery_gate?.can_deliver),
      readiness_status: bundle.delivery_gate?.readiness_status || 'no_exports'
    },
    delivery_gate_receipt: gateReceipt
      ? {
          receipt_hash: gateReceipt.receipt_hash,
          recorder: gateReceipt.recorder,
          decision: gateReceipt.decision,
          reason: gateReceipt.reason,
          can_deliver: Boolean(gateReceipt.can_deliver),
          readiness_status: gateReceipt.readiness_status,
          packet_hash: gateReceipt.packet_hash,
          at: gateReceipt.at || gateReceipt.created_at || null
        }
      : null,
    evidence_chain: {
      schema_version: bundle.packet?.evidence_chain?.schema_version || 'phase4-ops-audit-evidence-chain-v1',
      item_count: bundle.packet?.evidence_chain?.items?.length || 0,
      bundle_delivery_gate_receipt_count: bundle.packet?.summary?.bundle_delivery_gate_receipt_count || 0,
      bundle_handoff_preview_receipt_count: bundle.packet?.summary?.bundle_handoff_preview_receipt_count || 0,
      item_types: Array.from(new Set((bundle.packet?.evidence_chain?.items || []).map((item) => item.type))).sort()
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      has_delivery_gate_receipt_references: (bundle.manifest?.entries || []).some(
        (entry) => entry.path === 'delivery-gate-receipt-references.json'
      ),
      has_handoff_preview_receipt_references: (bundle.manifest?.entries || []).some(
        (entry) => entry.path === 'handoff-preview-receipt-references.json'
      ),
      delivery_gate_receipt_reference_count: bundle.bundle_delivery_gate_receipt_references?.length || 0,
      handoff_preview_receipt_reference_count: bundle.bundle_handoff_preview_receipt_references?.length || 0
    },
    bundle_verification: {
      schema_version: verification.schema_version,
      valid: verification.valid,
      checks: verification.checks,
      entry_result_count: verification.entry_results.length,
      manifest_hash: verification.manifest_hash,
      computed_manifest_hash: verification.computed_manifest_hash
    },
    delivery_stub: {
      mode: 'internal_preview_only',
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_handoff_preview'
  };
  preview.preview_hash = bundleDeliveryHandoffPreviewHash(preview);
  return preview;
}

export async function recordOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle delivery handoff preview receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_handoff_preview_receipt_recorder_required';
    throw error;
  }
  const preview = await getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreview(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-handoff-preview-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: preview.filters || filters || {},
    preview: {
      preview_hash: preview.preview_hash,
      generated_at: preview.generated_at,
      status: preview.status,
      can_handoff: Boolean(preview.can_handoff),
      reason: preview.reason,
      explanation: preview.explanation,
      required_actions: preview.required_actions || []
    },
    packet: {
      packet_hash: preview.packet?.packet_hash || null,
      generated_at: preview.packet?.generated_at || null,
      evidence_item_count: preview.packet?.evidence_item_count || 0,
      bundle_delivery_gate_receipt_count: preview.packet?.bundle_delivery_gate_receipt_count || 0
    },
    delivery_readiness: preview.delivery_readiness || {},
    delivery_gate: preview.delivery_gate || {},
    delivery_gate_receipt: preview.delivery_gate_receipt
      ? {
          receipt_hash: preview.delivery_gate_receipt.receipt_hash,
          decision: preview.delivery_gate_receipt.decision,
          reason: preview.delivery_gate_receipt.reason,
          can_deliver: Boolean(preview.delivery_gate_receipt.can_deliver),
          readiness_status: preview.delivery_gate_receipt.readiness_status,
          packet_hash: preview.delivery_gate_receipt.packet_hash
        }
      : null,
    signed_bundle: {
      schema_version: preview.signed_bundle?.schema_version || null,
      packet_hash: preview.signed_bundle?.packet_hash || null,
      manifest_hash: preview.signed_bundle?.manifest_hash || null,
      signature_algorithm: preview.signed_bundle?.signature_algorithm || null,
      manifest_entry_count: preview.signed_bundle?.manifest_entry_count || 0,
      delivery_gate_receipt_reference_count: preview.signed_bundle?.delivery_gate_receipt_reference_count || 0
    },
    bundle_verification: {
      schema_version: preview.bundle_verification?.schema_version || null,
      valid: Boolean(preview.bundle_verification?.valid),
      checks: preview.bundle_verification?.checks || {},
      entry_result_count: preview.bundle_verification?.entry_result_count || 0,
      manifest_hash: preview.bundle_verification?.manifest_hash || null,
      computed_manifest_hash: preview.bundle_verification?.computed_manifest_hash || null
    },
    delivery_stub: {
      mode: preview.delivery_stub?.mode || 'internal_preview_only',
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_handoff_preview_receipt'
  };
  receipt.receipt_hash = bundleDeliveryHandoffPreviewReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts (
       receipt_hash,
       preview_hash,
       recorder_username,
       recorder_role,
       status,
       reason,
       can_handoff,
       packet_hash,
       manifest_hash,
       delivery_gate_receipt_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)
     RETURNING id, receipt_hash, preview_hash, recorder_username, recorder_role, status, reason, can_handoff,
       packet_hash, manifest_hash, delivery_gate_receipt_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      preview.preview_hash,
      recorder.username,
      recorder.role,
      preview.status,
      preview.reason,
      Boolean(preview.can_handoff),
      preview.packet?.packet_hash || null,
      preview.signed_bundle?.manifest_hash || null,
      preview.delivery_gate_receipt?.receipt_hash || null,
      JSON.stringify(preview.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleDeliveryHandoffPreviewReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipts(
  { limit = 20, status = '', can_handoff: canHandoff = '', recorder = '', receipt_hash: receiptHash = '', preview_hash: previewHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    if (!['ready', 'blocked'].includes(normalizedStatus)) {
      const error = new Error('Evidence case packet bundle delivery handoff preview receipt status is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_delivery_handoff_preview_receipt_status_invalid';
      throw error;
    }
    params.push(normalizedStatus);
    where.push(`status = $${params.length}`);
  }
  if (canHandoff !== '' && canHandoff !== undefined && canHandoff !== null) {
    const normalizedCanHandoff = ['true', '1', 'yes', true].includes(canHandoff);
    params.push(normalizedCanHandoff);
    where.push(`can_handoff = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR delivery_gate_receipt_hash ILIKE $${params.length})`);
  }
  if (previewHash) {
    params.push(`%${String(previewHash).trim()}%`);
    where.push(`preview_hash ILIKE $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, preview_hash, recorder_username, recorder_role, status, reason, can_handoff,
       packet_hash, manifest_hash, delivery_gate_receipt_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleDeliveryHandoffPreviewReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle delivery handoff preview receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_handoff_preview_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, preview_hash, recorder_username, recorder_role, status, reason, can_handoff,
       packet_hash, manifest_hash, delivery_gate_receipt_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_handoff_preview_receipts
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle delivery handoff preview receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_handoff_preview_receipt_not_found';
    throw error;
  }
  return normalizeBundleDeliveryHandoffPreviewReceipt(result.rows[0]);
}

function buildDeliveryFinalApprovalRequiredActions({ handoffReceipt, verification }) {
  const actions = [];
  if (!handoffReceipt) {
    actions.push('record_handoff_preview_receipt');
  } else if (!(handoffReceipt.status === 'ready' && handoffReceipt.can_handoff === true)) {
    actions.push('resolve_handoff_preview_blocker');
  }
  if (!verification.valid) {
    actions.push('fix_signed_bundle_verification');
  }
  return actions;
}

function buildDeliveryFinalApprovalReason({ handoffReceipt, verification }) {
  if (!handoffReceipt) return 'missing_handoff_preview_receipt';
  if (!(handoffReceipt.status === 'ready' && handoffReceipt.can_handoff === true)) {
    return handoffReceipt.reason || 'handoff_preview_blocked';
  }
  if (!verification.valid) return 'signed_bundle_verification_failed';
  return 'ready_for_internal_final_approval_preview';
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPreview(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle delivery final approval preview actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_preview_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const verification = verifyOpsAuditEvidenceCasePacketBundle(bundle, signingSecret);
  const handoffReceipt = (bundle.bundle_handoff_preview_receipt_references || [])[0] || null;
  const requiredActions = buildDeliveryFinalApprovalRequiredActions({ handoffReceipt, verification });
  const reason = buildDeliveryFinalApprovalReason({ handoffReceipt, verification });
  const canApprove = requiredActions.length === 0;
  const generatedAt = new Date().toISOString();
  const preview = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-preview-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    status: canApprove ? 'ready' : 'blocked',
    decision: canApprove ? 'approve' : 'deny',
    can_approve: canApprove,
    reason,
    explanation: canApprove
      ? 'Handoff preview receipt chain, signed bundle, and bundle verification are ready for internal final approval preview.'
      : 'Internal final approval preview is blocked until the handoff receipt chain and signed bundle verification are complete and valid.',
    required_actions: requiredActions,
    packet: {
      packet_hash: bundle.packet_hash,
      generated_at: bundle.packet?.generated_at || null,
      evidence_item_count: bundle.packet?.summary?.total_items || 0,
      bundle_delivery_gate_receipt_count: bundle.packet?.summary?.bundle_delivery_gate_receipt_count || 0,
      bundle_handoff_preview_receipt_count: bundle.packet?.summary?.bundle_handoff_preview_receipt_count || 0
    },
    handoff_preview_receipt: handoffReceipt
      ? {
          receipt_hash: handoffReceipt.receipt_hash,
          preview_hash: handoffReceipt.preview_hash,
          recorder: handoffReceipt.recorder,
          status: handoffReceipt.status,
          reason: handoffReceipt.reason,
          can_handoff: Boolean(handoffReceipt.can_handoff),
          packet_hash: handoffReceipt.packet_hash,
          manifest_hash: handoffReceipt.manifest_hash,
          delivery_gate_receipt_hash: handoffReceipt.delivery_gate_receipt_hash,
          at: handoffReceipt.at || handoffReceipt.created_at || null
        }
      : null,
    delivery_gate: {
      decision: bundle.delivery_gate?.decision || 'deny',
      reason: bundle.delivery_gate?.reason || 'no_export_receipt',
      can_deliver: Boolean(bundle.delivery_gate?.can_deliver),
      readiness_status: bundle.delivery_gate?.readiness_status || 'no_exports'
    },
    evidence_chain: {
      schema_version: bundle.packet?.evidence_chain?.schema_version || 'phase4-ops-audit-evidence-chain-v1',
      item_count: bundle.packet?.evidence_chain?.items?.length || 0,
      bundle_delivery_gate_receipt_count: bundle.packet?.summary?.bundle_delivery_gate_receipt_count || 0,
      bundle_handoff_preview_receipt_count: bundle.packet?.summary?.bundle_handoff_preview_receipt_count || 0,
      item_types: Array.from(new Set((bundle.packet?.evidence_chain?.items || []).map((item) => item.type))).sort()
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      has_handoff_preview_receipt_references: (bundle.manifest?.entries || []).some(
        (entry) => entry.path === 'handoff-preview-receipt-references.json'
      ),
      handoff_preview_receipt_reference_count: bundle.bundle_handoff_preview_receipt_references?.length || 0
    },
    bundle_verification: {
      schema_version: verification.schema_version,
      valid: verification.valid,
      checks: verification.checks,
      entry_result_count: verification.entry_results.length,
      manifest_hash: verification.manifest_hash,
      computed_manifest_hash: verification.computed_manifest_hash
    },
    approval_stub: {
      mode: 'internal_final_approval_preview_only',
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      final_delivery: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_preview'
  };
  preview.approval_preview_hash = bundleDeliveryFinalApprovalPreviewHash(preview);
  return preview;
}

export async function recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle delivery final approval receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_receipt_recorder_required';
    throw error;
  }
  const preview = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPreview(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: preview.filters || filters || {},
    final_approval: {
      approval_preview_hash: preview.approval_preview_hash,
      generated_at: preview.generated_at,
      status: preview.status,
      decision: preview.decision,
      can_approve: Boolean(preview.can_approve),
      reason: preview.reason,
      explanation: preview.explanation,
      required_actions: preview.required_actions || []
    },
    packet: {
      packet_hash: preview.packet?.packet_hash || null,
      generated_at: preview.packet?.generated_at || null,
      evidence_item_count: preview.packet?.evidence_item_count || 0,
      bundle_delivery_gate_receipt_count: preview.packet?.bundle_delivery_gate_receipt_count || 0,
      bundle_handoff_preview_receipt_count: preview.packet?.bundle_handoff_preview_receipt_count || 0
    },
    handoff_preview_receipt: preview.handoff_preview_receipt
      ? {
          receipt_hash: preview.handoff_preview_receipt.receipt_hash,
          preview_hash: preview.handoff_preview_receipt.preview_hash,
          status: preview.handoff_preview_receipt.status,
          reason: preview.handoff_preview_receipt.reason,
          can_handoff: Boolean(preview.handoff_preview_receipt.can_handoff),
          packet_hash: preview.handoff_preview_receipt.packet_hash,
          manifest_hash: preview.handoff_preview_receipt.manifest_hash,
          delivery_gate_receipt_hash: preview.handoff_preview_receipt.delivery_gate_receipt_hash
        }
      : null,
    delivery_gate: preview.delivery_gate || {},
    signed_bundle: {
      schema_version: preview.signed_bundle?.schema_version || null,
      packet_hash: preview.signed_bundle?.packet_hash || null,
      manifest_hash: preview.signed_bundle?.manifest_hash || null,
      signature_algorithm: preview.signed_bundle?.signature_algorithm || null,
      manifest_entry_count: preview.signed_bundle?.manifest_entry_count || 0,
      handoff_preview_receipt_reference_count: preview.signed_bundle?.handoff_preview_receipt_reference_count || 0
    },
    bundle_verification: {
      schema_version: preview.bundle_verification?.schema_version || null,
      valid: Boolean(preview.bundle_verification?.valid),
      checks: preview.bundle_verification?.checks || {},
      entry_result_count: preview.bundle_verification?.entry_result_count || 0,
      manifest_hash: preview.bundle_verification?.manifest_hash || null,
      computed_manifest_hash: preview.bundle_verification?.computed_manifest_hash || null
    },
    approval_stub: {
      mode: preview.approval_stub?.mode || 'internal_final_approval_preview_only',
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      final_delivery: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_receipt'
  };
  receipt.receipt_hash = bundleDeliveryFinalApprovalReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts (
       receipt_hash,
       approval_preview_hash,
       recorder_username,
       recorder_role,
       decision,
       status,
       reason,
       can_approve,
       packet_hash,
       manifest_hash,
       handoff_preview_receipt_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
     RETURNING id, receipt_hash, approval_preview_hash, recorder_username, recorder_role, decision, status,
       reason, can_approve, packet_hash, manifest_hash, handoff_preview_receipt_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      preview.approval_preview_hash,
      recorder.username,
      recorder.role,
      preview.decision,
      preview.status,
      preview.reason,
      Boolean(preview.can_approve),
      preview.packet?.packet_hash || null,
      preview.signed_bundle?.manifest_hash || null,
      preview.handoff_preview_receipt?.receipt_hash || null,
      JSON.stringify(preview.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleDeliveryFinalApprovalReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipts(
  { limit = 20, decision = '', status = '', can_approve: canApprove = '', recorder = '', receipt_hash: receiptHash = '', approval_preview_hash: approvalPreviewHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['approve', 'deny'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle delivery final approval receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    if (!['ready', 'blocked'].includes(normalizedStatus)) {
      const error = new Error('Evidence case packet bundle delivery final approval receipt status is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_receipt_status_invalid';
      throw error;
    }
    params.push(normalizedStatus);
    where.push(`status = $${params.length}`);
  }
  if (canApprove !== '' && canApprove !== undefined && canApprove !== null) {
    const normalizedCanApprove = ['true', '1', 'yes', true].includes(canApprove);
    params.push(normalizedCanApprove);
    where.push(`can_approve = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR handoff_preview_receipt_hash ILIKE $${params.length})`);
  }
  if (approvalPreviewHash) {
    params.push(`%${String(approvalPreviewHash).trim()}%`);
    where.push(`approval_preview_hash ILIKE $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, approval_preview_hash, recorder_username, recorder_role, decision, status,
       reason, can_approve, packet_hash, manifest_hash, handoff_preview_receipt_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleDeliveryFinalApprovalReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle delivery final approval receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, approval_preview_hash, recorder_username, recorder_role, decision, status,
       reason, can_approve, packet_hash, manifest_hash, handoff_preview_receipt_hash, filters, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_final_approval_receipts
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle delivery final approval receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_receipt_not_found';
    throw error;
  }
  return normalizeBundleDeliveryFinalApprovalReceipt(result.rows[0]);
}

const FINAL_APPROVAL_REVIEW_ACTIONS = new Set(['confirmed', 'revoked', 'expired']);

function normalizeFinalApprovalReviewAction(action) {
  const normalized = String(action || 'confirmed').trim().toLowerCase();
  if (!FINAL_APPROVAL_REVIEW_ACTIONS.has(normalized)) {
    const error = new Error('Evidence case packet bundle delivery final approval review action is invalid.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_action_invalid';
    throw error;
  }
  return normalized;
}

export async function recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReview(
  {
    final_approval_receipt_hash: finalApprovalReceiptHash = '',
    reviewer = {},
    action = 'confirmed',
    note = ''
  } = {},
  client = pool
) {
  const normalizedFinalApprovalReceiptHash = String(finalApprovalReceiptHash || '').trim();
  if (!normalizedFinalApprovalReceiptHash) {
    const error = new Error('Evidence case packet bundle delivery final approval review requires a final approval receipt hash.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_final_receipt_required';
    throw error;
  }
  if (!reviewer?.username || !reviewer?.role) {
    const error = new Error('Evidence case packet bundle delivery final approval review reviewer is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_reviewer_required';
    throw error;
  }
  const finalApprovalReceipt = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipt(
    normalizedFinalApprovalReceiptHash,
    client
  );
  const normalizedAction = normalizeFinalApprovalReviewAction(action);
  const reviewedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-review-receipt-v1',
    reviewed_at: reviewedAt,
    reviewer: `${reviewer.username}:${reviewer.role}`,
    action: normalizedAction,
    lifecycle_status: normalizedAction,
    note: String(note || '').trim(),
    final_approval_receipt: {
      id: finalApprovalReceipt.id,
      receipt_hash: finalApprovalReceipt.receipt_hash,
      approval_preview_hash: finalApprovalReceipt.approval_preview_hash,
      recorder: finalApprovalReceipt.recorder,
      decision: finalApprovalReceipt.decision,
      status: finalApprovalReceipt.status,
      reason: finalApprovalReceipt.reason,
      can_approve: Boolean(finalApprovalReceipt.can_approve),
      packet_hash: finalApprovalReceipt.packet_hash,
      manifest_hash: finalApprovalReceipt.manifest_hash,
      handoff_preview_receipt_hash: finalApprovalReceipt.handoff_preview_receipt_hash,
      filters: finalApprovalReceipt.filters || {},
      created_at: finalApprovalReceipt.created_at
    },
    lifecycle_stub: {
      mode: 'internal_final_approval_lifecycle_review_only',
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      final_delivery: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_receipt'
  };
  receipt.receipt_hash = bundleDeliveryFinalApprovalReviewReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_bundle_final_approval_reviews (
       final_approval_receipt_id,
       receipt_hash,
       final_approval_receipt_hash,
       reviewer_username,
       reviewer_role,
       action,
       lifecycle_status,
       note,
       approval_preview_hash,
       decision,
       approval_status,
       packet_hash,
       manifest_hash,
       handoff_preview_receipt_hash,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     RETURNING id, final_approval_receipt_id, receipt_hash, final_approval_receipt_hash, reviewer_username,
       reviewer_role, action, lifecycle_status, note, approval_preview_hash, decision, approval_status,
       packet_hash, manifest_hash, handoff_preview_receipt_hash, receipt, created_at`,
    [
      finalApprovalReceipt.id,
      receipt.receipt_hash,
      finalApprovalReceipt.receipt_hash,
      reviewer.username,
      reviewer.role,
      normalizedAction,
      normalizedAction,
      receipt.note,
      finalApprovalReceipt.approval_preview_hash,
      finalApprovalReceipt.decision,
      finalApprovalReceipt.status,
      finalApprovalReceipt.packet_hash,
      finalApprovalReceipt.manifest_hash,
      finalApprovalReceipt.handoff_preview_receipt_hash,
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleDeliveryFinalApprovalReview(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReviews(
  { limit = 20, final_approval_receipt_hash: finalApprovalReceiptHash = '', reviewer = '', action = '', lifecycle_status: lifecycleStatus = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (finalApprovalReceiptHash) {
    params.push(`%${String(finalApprovalReceiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR approval_preview_hash ILIKE $${params.length})`);
  }
  if (reviewer) {
    params.push(String(reviewer).trim());
    where.push(`reviewer_username = $${params.length}`);
  }
  if (action) {
    params.push(normalizeFinalApprovalReviewAction(action));
    where.push(`action = $${params.length}`);
  }
  if (lifecycleStatus) {
    params.push(normalizeFinalApprovalReviewAction(lifecycleStatus));
    where.push(`lifecycle_status = $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, final_approval_receipt_id, receipt_hash, final_approval_receipt_hash, reviewer_username,
       reviewer_role, action, lifecycle_status, note, approval_preview_hash, decision, approval_status,
       packet_hash, manifest_hash, handoff_preview_receipt_hash, receipt, created_at
     FROM internal_ops_audit_bundle_final_approval_reviews
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleDeliveryFinalApprovalReview);
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReview(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle delivery final approval review receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, final_approval_receipt_id, receipt_hash, final_approval_receipt_hash, reviewer_username,
       reviewer_role, action, lifecycle_status, note, approval_preview_hash, decision, approval_status,
       packet_hash, manifest_hash, handoff_preview_receipt_hash, receipt, created_at
     FROM internal_ops_audit_bundle_final_approval_reviews
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle delivery final approval review receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_not_found';
    throw error;
  }
  return normalizeBundleDeliveryFinalApprovalReview(result.rows[0]);
}

function latestReviewByFinalApprovalHash(reviews = []) {
  const latest = new Map();
  reviews.forEach((review) => {
    const hash = review.final_approval_receipt_hash;
    if (!hash) return;
    const current = latest.get(hash);
    const reviewTime = Date.parse(review.created_at || review.at || '') || 0;
    const currentTime = Date.parse(current?.created_at || current?.at || '') || 0;
    if (!current || reviewTime >= currentTime) {
      latest.set(hash, review);
    }
  });
  return latest;
}

function finalApprovalReceiptRank(receipt = {}) {
  return Date.parse(receipt.created_at || receipt.at || '') || 0;
}

function finalApprovalPolicyStatus({ finalApprovalReceipt, latestReview }) {
  if (!finalApprovalReceipt) {
    return {
      decision: 'deny',
      policy_status: 'no_final_approval',
      reason: 'missing_final_approval_receipt',
      can_prepare_delivery: false,
      required_actions: ['record_final_approval_receipt']
    };
  }
  if (!(finalApprovalReceipt.decision === 'approve' && finalApprovalReceipt.status === 'ready' && finalApprovalReceipt.can_approve === true)) {
    return {
      decision: 'deny',
      policy_status: 'blocked',
      reason: finalApprovalReceipt.reason || 'final_approval_not_ready',
      can_prepare_delivery: false,
      required_actions: ['resolve_final_approval_blocker']
    };
  }
  if (!latestReview) {
    return {
      decision: 'deny',
      policy_status: 'needs_lifecycle_review',
      reason: 'missing_final_approval_lifecycle_review',
      can_prepare_delivery: false,
      required_actions: ['confirm_final_approval_lifecycle']
    };
  }
  if (latestReview.lifecycle_status === 'confirmed') {
    return {
      decision: 'allow',
      policy_status: 'eligible',
      reason: 'confirmed_final_approval_lifecycle',
      can_prepare_delivery: true,
      required_actions: []
    };
  }
  if (latestReview.lifecycle_status === 'revoked') {
    return {
      decision: 'deny',
      policy_status: 'revoked',
      reason: 'final_approval_revoked',
      can_prepare_delivery: false,
      required_actions: ['record_new_final_approval_receipt_or_restore_lifecycle']
    };
  }
  if (latestReview.lifecycle_status === 'expired') {
    return {
      decision: 'deny',
      policy_status: 'expired',
      reason: 'final_approval_expired',
      can_prepare_delivery: false,
      required_actions: ['refresh_final_approval_receipt_and_confirm_lifecycle']
    };
  }
  return {
    decision: 'deny',
    policy_status: 'needs_lifecycle_review',
    reason: 'unknown_final_approval_lifecycle',
    can_prepare_delivery: false,
    required_actions: ['confirm_final_approval_lifecycle']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGate(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle delivery final approval policy gate actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const finalApprovals = [...(bundle.bundle_final_approval_receipt_references || [])].sort(
    (a, b) => finalApprovalReceiptRank(b) - finalApprovalReceiptRank(a)
  );
  const reviews = bundle.bundle_final_approval_review_references || [];
  const reviewsByFinalApprovalHash = latestReviewByFinalApprovalHash(reviews);
  let selectedFinalApproval = finalApprovals.find((receipt) => (
    receipt.decision === 'approve' &&
    receipt.status === 'ready' &&
    receipt.can_approve === true
  )) || finalApprovals[0] || null;
  let latestReview = selectedFinalApproval
    ? reviewsByFinalApprovalHash.get(selectedFinalApproval.receipt_hash) || null
    : null;
  if (!selectedFinalApproval && reviews.length) {
    latestReview = [...reviews].sort((a, b) => finalApprovalReceiptRank(b) - finalApprovalReceiptRank(a))[0] || null;
    selectedFinalApproval = latestReview
      ? {
          id: latestReview.final_approval_receipt_id || null,
          receipt_hash: latestReview.final_approval_receipt_hash,
          approval_preview_hash: latestReview.approval_preview_hash || null,
          recorder: null,
          decision: latestReview.decision,
          status: latestReview.approval_status,
          reason: 'derived_from_lifecycle_review_reference',
          can_approve: latestReview.decision === 'approve' && latestReview.approval_status === 'ready',
          packet_hash: latestReview.packet_hash,
          manifest_hash: latestReview.manifest_hash,
          handoff_preview_receipt_hash: latestReview.handoff_preview_receipt_hash,
          filters: {},
          at: latestReview.at || latestReview.created_at || null
        }
      : null;
  }
  const policy = finalApprovalPolicyStatus({
    finalApprovalReceipt: selectedFinalApproval,
    latestReview
  });
  const finalApprovalStatuses = finalApprovals.map((receipt) => {
    const review = reviewsByFinalApprovalHash.get(receipt.receipt_hash) || null;
    const status = finalApprovalPolicyStatus({ finalApprovalReceipt: receipt, latestReview: review });
    return {
      final_approval_receipt_hash: receipt.receipt_hash,
      approval_preview_hash: receipt.approval_preview_hash || null,
      decision: receipt.decision,
      status: receipt.status,
      can_approve: Boolean(receipt.can_approve),
      latest_lifecycle_review_receipt_hash: review?.receipt_hash || null,
      lifecycle_status: review?.lifecycle_status || null,
      reviewer: review?.reviewer || null,
      reviewed_at: review?.at || review?.created_at || null,
      policy_status: status.policy_status,
      can_prepare_delivery: Boolean(status.can_prepare_delivery)
    };
  });
  const counts = {
    total_final_approval_receipts: finalApprovals.length,
    ready_final_approval_receipts: finalApprovals.filter((receipt) => (
      receipt.decision === 'approve' && receipt.status === 'ready' && receipt.can_approve === true
    )).length,
    reviewed_final_approval_receipts: finalApprovalStatuses.filter((item) => item.latest_lifecycle_review_receipt_hash).length,
    unreviewed_final_approval_receipts: finalApprovalStatuses.filter((item) => !item.latest_lifecycle_review_receipt_hash).length,
    confirmed_final_approval_receipts: finalApprovalStatuses.filter((item) => item.lifecycle_status === 'confirmed').length,
    revoked_final_approval_receipts: finalApprovalStatuses.filter((item) => item.lifecycle_status === 'revoked').length,
    expired_final_approval_receipts: finalApprovalStatuses.filter((item) => item.lifecycle_status === 'expired').length
  };
  const generatedAt = new Date().toISOString();
  const gate = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: policy.decision,
    policy_status: policy.policy_status,
    reason: policy.reason,
    can_prepare_delivery: Boolean(policy.can_prepare_delivery),
    explanation: policy.can_prepare_delivery
      ? 'Internal delivery preparation is allowed because the selected final approval receipt is ready and its latest lifecycle review is confirmed.'
      : 'Internal delivery preparation is blocked until final approval lifecycle policy requirements are satisfied.',
    required_actions: policy.required_actions,
    selected_final_approval_receipt: selectedFinalApproval
      ? {
          receipt_hash: selectedFinalApproval.receipt_hash,
          approval_preview_hash: selectedFinalApproval.approval_preview_hash,
          recorder: selectedFinalApproval.recorder,
          decision: selectedFinalApproval.decision,
          status: selectedFinalApproval.status,
          reason: selectedFinalApproval.reason,
          can_approve: Boolean(selectedFinalApproval.can_approve),
          packet_hash: selectedFinalApproval.packet_hash,
          manifest_hash: selectedFinalApproval.manifest_hash,
          handoff_preview_receipt_hash: selectedFinalApproval.handoff_preview_receipt_hash,
          at: selectedFinalApproval.at || selectedFinalApproval.created_at || null
        }
      : null,
    latest_lifecycle_review: latestReview
      ? {
          receipt_hash: latestReview.receipt_hash,
          final_approval_receipt_hash: latestReview.final_approval_receipt_hash,
          reviewer: latestReview.reviewer,
          action: latestReview.action,
          lifecycle_status: latestReview.lifecycle_status,
          note: latestReview.note || '',
          at: latestReview.at || latestReview.created_at || null
        }
      : null,
    lifecycle_summary: {
      counts,
      final_approvals: finalApprovalStatuses
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      final_approval_receipt_reference_count: bundle.bundle_final_approval_receipt_references?.length || 0,
      final_approval_review_reference_count: bundle.bundle_final_approval_review_references?.length || 0
    },
    delivery_preparation_stub: {
      mode: 'internal_delivery_preparation_policy_gate_only',
      delivery_preparation: Boolean(policy.can_prepare_delivery),
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate'
  };
  gate.policy_gate_hash = digestValue(gate);
  return gate;
}

export async function recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle delivery final approval policy gate receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate_receipt_recorder_required';
    throw error;
  }
  const gate = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGate(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: gate.filters || filters || {},
    policy_gate: {
      policy_gate_hash: gate.policy_gate_hash,
      generated_at: gate.generated_at,
      decision: gate.decision,
      policy_status: gate.policy_status,
      reason: gate.reason,
      can_prepare_delivery: Boolean(gate.can_prepare_delivery),
      explanation: gate.explanation,
      required_actions: gate.required_actions || []
    },
    selected_final_approval_receipt: gate.selected_final_approval_receipt,
    latest_lifecycle_review: gate.latest_lifecycle_review,
    lifecycle_summary: gate.lifecycle_summary,
    signed_bundle: gate.signed_bundle,
    delivery_preparation_stub: gate.delivery_preparation_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate_receipt'
  };
  receipt.receipt_hash = bundleDeliveryFinalApprovalPolicyGateReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_approval_policy_gates (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       policy_status,
       reason,
       can_prepare_delivery,
       final_approval_receipt_hash,
       lifecycle_review_receipt_hash,
       packet_hash,
       manifest_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, policy_status, reason,
       can_prepare_delivery, final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash,
       manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      gate.decision,
      gate.policy_status,
      gate.reason,
      Boolean(gate.can_prepare_delivery),
      gate.selected_final_approval_receipt?.receipt_hash || null,
      gate.latest_lifecycle_review?.receipt_hash || null,
      gate.selected_final_approval_receipt?.packet_hash || gate.signed_bundle?.packet_hash || null,
      gate.selected_final_approval_receipt?.manifest_hash || gate.signed_bundle?.manifest_hash || null,
      JSON.stringify(gate.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleDeliveryFinalApprovalPolicyGateReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipts(
  { limit = 20, decision = '', policy_status: policyStatus = '', can_prepare_delivery: canPrepareDelivery = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['allow', 'deny'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle delivery final approval policy gate receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (policyStatus) {
    params.push(String(policyStatus).trim().toLowerCase());
    where.push(`policy_status = $${params.length}`);
  }
  if (canPrepareDelivery !== '' && canPrepareDelivery !== undefined && canPrepareDelivery !== null) {
    const normalizedCanPrepare = ['true', '1', 'yes', true].includes(canPrepareDelivery);
    params.push(normalizedCanPrepare);
    where.push(`can_prepare_delivery = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, policy_status, reason,
       can_prepare_delivery, final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash,
       manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_approval_policy_gates
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleDeliveryFinalApprovalPolicyGateReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle delivery final approval policy gate receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, policy_status, reason,
       can_prepare_delivery, final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash,
       manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_approval_policy_gates
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle delivery final approval policy gate receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_delivery_final_approval_policy_gate_receipt_not_found';
    throw error;
  }
  return normalizeBundleDeliveryFinalApprovalPolicyGateReceipt(result.rows[0]);
}

function finalDeliveryDryRunLockDecision(policyGateReceipt = null) {
  if (!policyGateReceipt) {
    return {
      decision: 'block',
      lock_status: 'missing_policy_gate',
      reason: 'missing_final_approval_policy_gate_receipt',
      can_prepare_delivery: false,
      required_actions: ['record_final_approval_policy_gate_receipt']
    };
  }
  if (policyGateReceipt.decision === 'allow' && policyGateReceipt.policy_status === 'eligible' && policyGateReceipt.can_prepare_delivery === true) {
    return {
      decision: 'lock',
      lock_status: 'prepared',
      reason: 'policy_gate_allows_delivery_preparation',
      can_prepare_delivery: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    lock_status: policyGateReceipt.policy_status || 'blocked',
    reason: policyGateReceipt.reason || 'final_approval_policy_gate_denied',
    can_prepare_delivery: false,
    required_actions: ['resolve_final_approval_policy_gate']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLock(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery dry-run lock actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const policyGateReceipt = (bundle.bundle_final_approval_policy_gate_references || [])[0] || null;
  const lockDecision = finalDeliveryDryRunLockDecision(policyGateReceipt);
  const generatedAt = new Date().toISOString();
  const dryRunLock = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: lockDecision.decision,
    lock_status: lockDecision.lock_status,
    reason: lockDecision.reason,
    can_prepare_delivery: Boolean(lockDecision.can_prepare_delivery),
    explanation: lockDecision.can_prepare_delivery
      ? 'Internal delivery preparation is dry-run locked because the final approval policy gate is eligible.'
      : 'Internal delivery preparation dry-run lock is blocked until the final approval policy gate is eligible.',
    required_actions: lockDecision.required_actions,
    policy_gate_receipt: policyGateReceipt
      ? {
          receipt_hash: policyGateReceipt.receipt_hash,
          recorder: policyGateReceipt.recorder,
          decision: policyGateReceipt.decision,
          policy_status: policyGateReceipt.policy_status,
          reason: policyGateReceipt.reason,
          can_prepare_delivery: Boolean(policyGateReceipt.can_prepare_delivery),
          final_approval_receipt_hash: policyGateReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: policyGateReceipt.lifecycle_review_receipt_hash,
          packet_hash: policyGateReceipt.packet_hash,
          manifest_hash: policyGateReceipt.manifest_hash,
          at: policyGateReceipt.at || policyGateReceipt.created_at || null
        }
      : null,
    final_approval_receipt: policyGateReceipt?.final_approval_receipt_hash
      ? {
          receipt_hash: policyGateReceipt.final_approval_receipt_hash
        }
      : null,
    lifecycle_review_receipt: policyGateReceipt?.lifecycle_review_receipt_hash
      ? {
          receipt_hash: policyGateReceipt.lifecycle_review_receipt_hash
        }
      : null,
    dry_run_plan: {
      mode: 'internal_release_lock_dry_run',
      steps: lockDecision.can_prepare_delivery
        ? [
            'freeze_policy_gate_receipt_hash',
            'freeze_final_approval_receipt_hash',
            'freeze_lifecycle_review_receipt_hash',
            'verify_signed_bundle_manifest',
            'prepare_internal_delivery_execution_plan'
          ]
        : [
            'resolve_policy_gate_before_preparation'
          ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      final_approval_policy_gate_reference_count: bundle.bundle_final_approval_policy_gate_references?.length || 0
    },
    release_lock_stub: {
      mode: 'internal_final_delivery_preparation_dry_run_lock_only',
      dry_run: true,
      release_lock: Boolean(lockDecision.can_prepare_delivery),
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock'
  };
  dryRunLock.dry_run_lock_hash = digestValue(dryRunLock);
  return dryRunLock;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery dry-run lock receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_recorder_required';
    throw error;
  }
  const dryRunLock = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLock(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: dryRunLock.filters || filters || {},
    dry_run_lock: {
      dry_run_lock_hash: dryRunLock.dry_run_lock_hash,
      generated_at: dryRunLock.generated_at,
      decision: dryRunLock.decision,
      lock_status: dryRunLock.lock_status,
      reason: dryRunLock.reason,
      can_prepare_delivery: Boolean(dryRunLock.can_prepare_delivery),
      explanation: dryRunLock.explanation,
      required_actions: dryRunLock.required_actions || []
    },
    policy_gate_receipt: dryRunLock.policy_gate_receipt,
    final_approval_receipt: dryRunLock.final_approval_receipt,
    lifecycle_review_receipt: dryRunLock.lifecycle_review_receipt,
    dry_run_plan: dryRunLock.dry_run_plan,
    signed_bundle: dryRunLock.signed_bundle,
    release_lock_stub: dryRunLock.release_lock_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryDryRunLockReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_dry_run_locks (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       lock_status,
       reason,
       can_prepare_delivery,
       policy_gate_receipt_hash,
       final_approval_receipt_hash,
       lifecycle_review_receipt_hash,
       packet_hash,
       manifest_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, lock_status, reason,
       can_prepare_delivery, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      dryRunLock.decision,
      dryRunLock.lock_status,
      dryRunLock.reason,
      Boolean(dryRunLock.can_prepare_delivery),
      dryRunLock.policy_gate_receipt?.receipt_hash || null,
      dryRunLock.policy_gate_receipt?.final_approval_receipt_hash || null,
      dryRunLock.policy_gate_receipt?.lifecycle_review_receipt_hash || null,
      dryRunLock.dry_run_plan?.packet_hash || null,
      dryRunLock.dry_run_plan?.manifest_hash || null,
      JSON.stringify(dryRunLock.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryDryRunLockReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipts(
  { limit = 20, decision = '', lock_status: lockStatus = '', can_prepare_delivery: canPrepareDelivery = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['lock', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery dry-run lock receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (lockStatus) {
    params.push(String(lockStatus).trim().toLowerCase());
    where.push(`lock_status = $${params.length}`);
  }
  if (canPrepareDelivery !== '' && canPrepareDelivery !== undefined && canPrepareDelivery !== null) {
    const normalizedCanPrepare = ['true', '1', 'yes', true].includes(canPrepareDelivery);
    params.push(normalizedCanPrepare);
    where.push(`can_prepare_delivery = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, lock_status, reason,
       can_prepare_delivery, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_dry_run_locks
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryDryRunLockReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery dry-run lock receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, lock_status, reason,
       can_prepare_delivery, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_dry_run_locks
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery dry-run lock receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryDryRunLockReceipt(result.rows[0]);
}

function finalDeliveryRehearsalDecision(dryRunLockReceipt = null) {
  if (!dryRunLockReceipt) {
    return {
      decision: 'block',
      rehearsal_status: 'missing_dry_run_lock',
      reason: 'missing_final_delivery_dry_run_lock_receipt',
      can_execute_dry_run: false,
      required_actions: ['record_final_delivery_dry_run_lock_receipt']
    };
  }
  if (dryRunLockReceipt.decision === 'lock' && dryRunLockReceipt.lock_status === 'prepared' && dryRunLockReceipt.can_prepare_delivery === true) {
    return {
      decision: 'rehearse',
      rehearsal_status: 'ready',
      reason: 'dry_run_lock_prepared_for_rehearsal',
      can_execute_dry_run: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    rehearsal_status: dryRunLockReceipt.lock_status || 'blocked',
    reason: dryRunLockReceipt.reason || 'final_delivery_dry_run_lock_blocked',
    can_execute_dry_run: false,
    required_actions: ['resolve_final_delivery_dry_run_lock']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsal(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery rehearsal actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const dryRunLockReceipt = (bundle.bundle_final_delivery_dry_run_lock_references || [])[0] || null;
  const rehearsalDecision = finalDeliveryRehearsalDecision(dryRunLockReceipt);
  const generatedAt = new Date().toISOString();
  const rehearsal = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-rehearsal-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: rehearsalDecision.decision,
    rehearsal_status: rehearsalDecision.rehearsal_status,
    reason: rehearsalDecision.reason,
    can_execute_dry_run: Boolean(rehearsalDecision.can_execute_dry_run),
    explanation: rehearsalDecision.can_execute_dry_run
      ? 'Internal final delivery rehearsal is ready because the dry-run release lock is prepared.'
      : 'Internal final delivery rehearsal is blocked until a prepared dry-run release lock is recorded.',
    required_actions: rehearsalDecision.required_actions,
    dry_run_lock_receipt: dryRunLockReceipt
      ? {
          receipt_hash: dryRunLockReceipt.receipt_hash,
          recorder: dryRunLockReceipt.recorder,
          decision: dryRunLockReceipt.decision,
          lock_status: dryRunLockReceipt.lock_status,
          reason: dryRunLockReceipt.reason,
          can_prepare_delivery: Boolean(dryRunLockReceipt.can_prepare_delivery),
          policy_gate_receipt_hash: dryRunLockReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: dryRunLockReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: dryRunLockReceipt.lifecycle_review_receipt_hash,
          packet_hash: dryRunLockReceipt.packet_hash,
          manifest_hash: dryRunLockReceipt.manifest_hash,
          at: dryRunLockReceipt.at || dryRunLockReceipt.created_at || null
        }
      : null,
    policy_gate_receipt: dryRunLockReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: dryRunLockReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: dryRunLockReceipt?.final_approval_receipt_hash
      ? { receipt_hash: dryRunLockReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: dryRunLockReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: dryRunLockReceipt.lifecycle_review_receipt_hash }
      : null,
    rehearsal_plan: {
      mode: 'internal_final_delivery_rehearsal',
      steps: rehearsalDecision.can_execute_dry_run
        ? [
            'validate_release_lock_receipt_hash',
            'verify_signed_bundle_manifest',
            'stage_internal_delivery_payload',
            'simulate_external_delivery_request',
            'simulate_customer_dashboard_noop',
            'record_human_confirmation_checkpoint'
          ]
        : [
            'record_prepared_dry_run_lock_before_rehearsal'
          ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    rollback_plan: {
      checkpoints: [
        'release_lock_receipt_hash',
        'policy_gate_receipt_hash',
        'final_approval_receipt_hash',
        'lifecycle_review_receipt_hash',
        'signed_bundle_manifest_hash'
      ],
      rollback_actions: [
        'discard_staged_payload',
        'clear_internal_execution_plan',
        'retain_audit_receipts',
        'require_new_rehearsal_before_delivery'
      ],
      rollback_required_before_external_delivery: true
    },
    human_confirmation_window: {
      required: Boolean(rehearsalDecision.can_execute_dry_run),
      mode: 'internal_dual_control_confirmation',
      timeout_minutes: 60,
      required_roles: ['admin', 'operator']
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      final_delivery_dry_run_lock_reference_count: bundle.bundle_final_delivery_dry_run_lock_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_rehearsal_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal'
  };
  rehearsal.rehearsal_hash = digestValue(rehearsal);
  return rehearsal;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery rehearsal receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_recorder_required';
    throw error;
  }
  const rehearsal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsal(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-rehearsal-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: rehearsal.filters || filters || {},
    rehearsal: {
      rehearsal_hash: rehearsal.rehearsal_hash,
      generated_at: rehearsal.generated_at,
      decision: rehearsal.decision,
      rehearsal_status: rehearsal.rehearsal_status,
      reason: rehearsal.reason,
      can_execute_dry_run: Boolean(rehearsal.can_execute_dry_run),
      explanation: rehearsal.explanation,
      required_actions: rehearsal.required_actions || []
    },
    dry_run_lock_receipt: rehearsal.dry_run_lock_receipt,
    policy_gate_receipt: rehearsal.policy_gate_receipt,
    final_approval_receipt: rehearsal.final_approval_receipt,
    lifecycle_review_receipt: rehearsal.lifecycle_review_receipt,
    rehearsal_plan: rehearsal.rehearsal_plan,
    rollback_plan: rehearsal.rollback_plan,
    human_confirmation_window: rehearsal.human_confirmation_window,
    signed_bundle: rehearsal.signed_bundle,
    execution_stub: rehearsal.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryRehearsalReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_rehearsals (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       rehearsal_status,
       reason,
       can_execute_dry_run,
       dry_run_lock_receipt_hash,
       policy_gate_receipt_hash,
       final_approval_receipt_hash,
       lifecycle_review_receipt_hash,
       packet_hash,
       manifest_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, rehearsal_status, reason,
       can_execute_dry_run, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      rehearsal.decision,
      rehearsal.rehearsal_status,
      rehearsal.reason,
      Boolean(rehearsal.can_execute_dry_run),
      rehearsal.dry_run_lock_receipt?.receipt_hash || null,
      rehearsal.dry_run_lock_receipt?.policy_gate_receipt_hash || null,
      rehearsal.dry_run_lock_receipt?.final_approval_receipt_hash || null,
      rehearsal.dry_run_lock_receipt?.lifecycle_review_receipt_hash || null,
      rehearsal.rehearsal_plan?.packet_hash || null,
      rehearsal.rehearsal_plan?.manifest_hash || null,
      JSON.stringify(rehearsal.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryRehearsalReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipts(
  { limit = 20, decision = '', rehearsal_status: rehearsalStatus = '', can_execute_dry_run: canExecuteDryRun = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['rehearse', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery rehearsal receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (rehearsalStatus) {
    params.push(String(rehearsalStatus).trim().toLowerCase());
    where.push(`rehearsal_status = $${params.length}`);
  }
  if (canExecuteDryRun !== '' && canExecuteDryRun !== undefined && canExecuteDryRun !== null) {
    const normalizedCanExecute = ['true', '1', 'yes', true].includes(canExecuteDryRun);
    params.push(normalizedCanExecute);
    where.push(`can_execute_dry_run = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, rehearsal_status, reason,
       can_execute_dry_run, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_rehearsals
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryRehearsalReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery rehearsal receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, rehearsal_status, reason,
       can_execute_dry_run, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_rehearsals
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery rehearsal receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryRehearsalReceipt(result.rows[0]);
}

function finalDeliveryDualControlApprovalDecision(rehearsalReceipt = null) {
  if (!rehearsalReceipt) {
    return {
      decision: 'block',
      approval_status: 'missing_rehearsal',
      reason: 'missing_final_delivery_rehearsal_receipt',
      can_release_after_dual_control: false,
      required_actions: ['record_final_delivery_rehearsal_receipt']
    };
  }
  if (
    rehearsalReceipt.decision === 'rehearse' &&
    rehearsalReceipt.rehearsal_status === 'ready' &&
    rehearsalReceipt.can_execute_dry_run === true
  ) {
    return {
      decision: 'approve',
      approval_status: 'approved',
      reason: 'rehearsal_ready_for_dual_control_approval',
      can_release_after_dual_control: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    approval_status: rehearsalReceipt.rehearsal_status || 'blocked',
    reason: rehearsalReceipt.reason || 'final_delivery_rehearsal_not_ready',
    can_release_after_dual_control: false,
    required_actions: ['resolve_final_delivery_rehearsal_before_dual_control_approval']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApproval(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery dual-control approval actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const rehearsalReceipt = (bundle.bundle_final_delivery_rehearsal_references || [])[0] || null;
  const approvalDecision = finalDeliveryDualControlApprovalDecision(rehearsalReceipt);
  const generatedAt = new Date().toISOString();
  const approval = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: approvalDecision.decision,
    approval_status: approvalDecision.approval_status,
    reason: approvalDecision.reason,
    can_release_after_dual_control: Boolean(approvalDecision.can_release_after_dual_control),
    explanation: approvalDecision.can_release_after_dual_control
      ? 'Internal final delivery dual-control checkpoint is approved because the rehearsal receipt is ready.'
      : 'Internal final delivery dual-control checkpoint is blocked until a ready rehearsal receipt is recorded.',
    required_actions: approvalDecision.required_actions,
    rehearsal_receipt: rehearsalReceipt
      ? {
          receipt_hash: rehearsalReceipt.receipt_hash,
          recorder: rehearsalReceipt.recorder,
          decision: rehearsalReceipt.decision,
          rehearsal_status: rehearsalReceipt.rehearsal_status,
          reason: rehearsalReceipt.reason,
          can_execute_dry_run: Boolean(rehearsalReceipt.can_execute_dry_run),
          dry_run_lock_receipt_hash: rehearsalReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: rehearsalReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: rehearsalReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: rehearsalReceipt.lifecycle_review_receipt_hash,
          packet_hash: rehearsalReceipt.packet_hash,
          manifest_hash: rehearsalReceipt.manifest_hash,
          at: rehearsalReceipt.at || rehearsalReceipt.created_at || null
        }
      : null,
    dry_run_lock_receipt: rehearsalReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: rehearsalReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: rehearsalReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: rehearsalReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: rehearsalReceipt?.final_approval_receipt_hash
      ? { receipt_hash: rehearsalReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: rehearsalReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: rehearsalReceipt.lifecycle_review_receipt_hash }
      : null,
    approval_checkpoint: {
      mode: 'internal_dual_control_checkpoint',
      required_roles: ['admin', 'operator'],
      confirmation_window_minutes: 60,
      checks: approvalDecision.can_release_after_dual_control
        ? [
            'confirm_rehearsal_receipt_hash',
            'confirm_release_lock_receipt_hash',
            'confirm_policy_gate_receipt_hash',
            'confirm_signed_bundle_manifest_hash',
            'confirm_no_external_delivery_side_effects'
          ]
        : [
            'record_ready_rehearsal_receipt_before_dual_control_approval'
          ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    release_guard: {
      mode: 'internal_final_delivery_dual_control_guard',
      approved_for_internal_release_step: Boolean(approvalDecision.can_release_after_dual_control),
      requires_separate_real_delivery_instruction: true,
      rollback_required_before_external_delivery: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      final_delivery_rehearsal_reference_count: bundle.bundle_final_delivery_rehearsal_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_dual_control_checkpoint_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval'
  };
  approval.dual_control_approval_hash = digestValue(approval);
  return approval;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery dual-control approval receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_recorder_required';
    throw error;
  }
  const approval = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApproval(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: approval.filters || filters || {},
    dual_control_approval: {
      dual_control_approval_hash: approval.dual_control_approval_hash,
      generated_at: approval.generated_at,
      decision: approval.decision,
      approval_status: approval.approval_status,
      reason: approval.reason,
      can_release_after_dual_control: Boolean(approval.can_release_after_dual_control),
      explanation: approval.explanation,
      required_actions: approval.required_actions || []
    },
    rehearsal_receipt: approval.rehearsal_receipt,
    dry_run_lock_receipt: approval.dry_run_lock_receipt,
    policy_gate_receipt: approval.policy_gate_receipt,
    final_approval_receipt: approval.final_approval_receipt,
    lifecycle_review_receipt: approval.lifecycle_review_receipt,
    approval_checkpoint: approval.approval_checkpoint,
    release_guard: approval.release_guard,
    signed_bundle: approval.signed_bundle,
    execution_stub: approval.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryDualControlApprovalReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_dual_control_approvals (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       approval_status,
       reason,
       can_release_after_dual_control,
       rehearsal_receipt_hash,
       dry_run_lock_receipt_hash,
       policy_gate_receipt_hash,
       final_approval_receipt_hash,
       lifecycle_review_receipt_hash,
       packet_hash,
       manifest_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, approval_status, reason,
       can_release_after_dual_control, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      approval.decision,
      approval.approval_status,
      approval.reason,
      Boolean(approval.can_release_after_dual_control),
      approval.rehearsal_receipt?.receipt_hash || null,
      approval.rehearsal_receipt?.dry_run_lock_receipt_hash || null,
      approval.rehearsal_receipt?.policy_gate_receipt_hash || null,
      approval.rehearsal_receipt?.final_approval_receipt_hash || null,
      approval.rehearsal_receipt?.lifecycle_review_receipt_hash || null,
      approval.approval_checkpoint?.packet_hash || null,
      approval.approval_checkpoint?.manifest_hash || null,
      JSON.stringify(approval.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryDualControlApprovalReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipts(
  { limit = 20, decision = '', approval_status: approvalStatus = '', can_release_after_dual_control: canRelease = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['approve', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery dual-control approval receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (approvalStatus) {
    params.push(String(approvalStatus).trim().toLowerCase());
    where.push(`approval_status = $${params.length}`);
  }
  if (canRelease !== '' && canRelease !== undefined && canRelease !== null) {
    const normalizedCanRelease = ['true', '1', 'yes', true].includes(canRelease);
    params.push(normalizedCanRelease);
    where.push(`can_release_after_dual_control = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, approval_status, reason,
       can_release_after_dual_control, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_dual_control_approvals
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryDualControlApprovalReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery dual-control approval receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, approval_status, reason,
       can_release_after_dual_control, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_dual_control_approvals
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery dual-control approval receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryDualControlApprovalReceipt(result.rows[0]);
}

function finalDeliveryReadinessSealDecision(approvalReceipt = null) {
  if (!approvalReceipt) {
    return {
      decision: 'block',
      seal_status: 'missing_dual_control_approval',
      reason: 'missing_final_delivery_dual_control_approval_receipt',
      can_handoff_to_operator: false,
      required_actions: ['record_final_delivery_dual_control_approval_receipt']
    };
  }
  if (
    approvalReceipt.decision === 'approve' &&
    approvalReceipt.approval_status === 'approved' &&
    approvalReceipt.can_release_after_dual_control === true
  ) {
    return {
      decision: 'seal',
      seal_status: 'sealed',
      reason: 'dual_control_approval_ready_for_operator_handoff',
      can_handoff_to_operator: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    seal_status: approvalReceipt.approval_status || 'blocked',
    reason: approvalReceipt.reason || 'final_delivery_dual_control_approval_not_ready',
    can_handoff_to_operator: false,
    required_actions: ['resolve_final_delivery_dual_control_approval_before_readiness_seal']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSeal(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery readiness seal actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const approvalReceipt = (bundle.bundle_final_delivery_dual_control_approval_references || [])[0] || null;
  const sealDecision = finalDeliveryReadinessSealDecision(approvalReceipt);
  const generatedAt = new Date().toISOString();
  const seal = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-readiness-seal-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: sealDecision.decision,
    seal_status: sealDecision.seal_status,
    reason: sealDecision.reason,
    can_handoff_to_operator: Boolean(sealDecision.can_handoff_to_operator),
    explanation: sealDecision.can_handoff_to_operator
      ? 'Internal final delivery readiness is sealed because dual-control approval is approved.'
      : 'Internal final delivery readiness is blocked until approved dual-control receipt is recorded.',
    required_actions: sealDecision.required_actions,
    dual_control_approval_receipt: approvalReceipt
      ? {
          receipt_hash: approvalReceipt.receipt_hash,
          recorder: approvalReceipt.recorder,
          decision: approvalReceipt.decision,
          approval_status: approvalReceipt.approval_status,
          reason: approvalReceipt.reason,
          can_release_after_dual_control: Boolean(approvalReceipt.can_release_after_dual_control),
          rehearsal_receipt_hash: approvalReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: approvalReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: approvalReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: approvalReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: approvalReceipt.lifecycle_review_receipt_hash,
          packet_hash: approvalReceipt.packet_hash,
          manifest_hash: approvalReceipt.manifest_hash,
          at: approvalReceipt.at || approvalReceipt.created_at || null
        }
      : null,
    rehearsal_receipt: approvalReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: approvalReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: approvalReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: approvalReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: approvalReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: approvalReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: approvalReceipt?.final_approval_receipt_hash
      ? { receipt_hash: approvalReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: approvalReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: approvalReceipt.lifecycle_review_receipt_hash }
      : null,
    operator_handoff: {
      mode: 'internal_operator_handoff_signoff',
      sealed_for_operator_review: Boolean(sealDecision.can_handoff_to_operator),
      handoff_window_minutes: 60,
      required_operator_checks: sealDecision.can_handoff_to_operator
        ? [
            'confirm_dual_control_approval_receipt_hash',
            'confirm_rehearsal_receipt_hash',
            'confirm_release_lock_receipt_hash',
            'confirm_signed_bundle_manifest_hash',
            'confirm_no_external_delivery_side_effects'
          ]
        : ['record_approved_dual_control_receipt_before_readiness_seal'],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    release_guard: {
      mode: 'internal_final_delivery_readiness_seal_guard',
      release_ready_for_internal_operator_handoff: Boolean(sealDecision.can_handoff_to_operator),
      requires_separate_real_delivery_instruction: true,
      requires_operator_release_confirmation: true,
      rollback_required_before_external_delivery: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      dual_control_approval_reference_count: bundle.bundle_final_delivery_dual_control_approval_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_readiness_seal_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal'
  };
  seal.readiness_seal_hash = digestValue(seal);
  return seal;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery readiness seal receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_recorder_required';
    throw error;
  }
  const seal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSeal(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-readiness-seal-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: seal.filters || filters || {},
    readiness_seal: {
      readiness_seal_hash: seal.readiness_seal_hash,
      generated_at: seal.generated_at,
      decision: seal.decision,
      seal_status: seal.seal_status,
      reason: seal.reason,
      can_handoff_to_operator: Boolean(seal.can_handoff_to_operator),
      explanation: seal.explanation,
      required_actions: seal.required_actions || []
    },
    dual_control_approval_receipt: seal.dual_control_approval_receipt,
    rehearsal_receipt: seal.rehearsal_receipt,
    dry_run_lock_receipt: seal.dry_run_lock_receipt,
    policy_gate_receipt: seal.policy_gate_receipt,
    final_approval_receipt: seal.final_approval_receipt,
    lifecycle_review_receipt: seal.lifecycle_review_receipt,
    operator_handoff: seal.operator_handoff,
    release_guard: seal.release_guard,
    signed_bundle: seal.signed_bundle,
    execution_stub: seal.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryReadinessSealReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_readiness_seals (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       seal_status,
       reason,
       can_handoff_to_operator,
       dual_control_approval_receipt_hash,
       rehearsal_receipt_hash,
       dry_run_lock_receipt_hash,
       policy_gate_receipt_hash,
       final_approval_receipt_hash,
       lifecycle_review_receipt_hash,
       packet_hash,
       manifest_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_handoff_to_operator, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      seal.decision,
      seal.seal_status,
      seal.reason,
      Boolean(seal.can_handoff_to_operator),
      seal.dual_control_approval_receipt?.receipt_hash || null,
      seal.dual_control_approval_receipt?.rehearsal_receipt_hash || null,
      seal.dual_control_approval_receipt?.dry_run_lock_receipt_hash || null,
      seal.dual_control_approval_receipt?.policy_gate_receipt_hash || null,
      seal.dual_control_approval_receipt?.final_approval_receipt_hash || null,
      seal.dual_control_approval_receipt?.lifecycle_review_receipt_hash || null,
      seal.operator_handoff?.packet_hash || null,
      seal.operator_handoff?.manifest_hash || null,
      JSON.stringify(seal.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryReadinessSealReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipts(
  { limit = 20, decision = '', seal_status: sealStatus = '', can_handoff_to_operator: canHandoff = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['seal', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery readiness seal receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (sealStatus) {
    params.push(String(sealStatus).trim().toLowerCase());
    where.push(`seal_status = $${params.length}`);
  }
  if (canHandoff !== '' && canHandoff !== undefined && canHandoff !== null) {
    const normalizedCanHandoff = ['true', '1', 'yes', true].includes(canHandoff);
    params.push(normalizedCanHandoff);
    where.push(`can_handoff_to_operator = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_handoff_to_operator, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_readiness_seals
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryReadinessSealReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery readiness seal receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_handoff_to_operator, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_readiness_seals
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery readiness seal receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryReadinessSealReceipt(result.rows[0]);
}

function finalDeliverySealedHandoffReviewDecision(readinessSealReceipt = null) {
  if (!readinessSealReceipt) {
    return {
      decision: 'block',
      review_status: 'missing_readiness_seal',
      reason: 'missing_final_delivery_readiness_seal_receipt',
      can_release_commander_signoff: false,
      required_actions: ['record_final_delivery_readiness_seal_receipt']
    };
  }
  if (
    readinessSealReceipt.decision === 'seal' &&
    readinessSealReceipt.seal_status === 'sealed' &&
    readinessSealReceipt.can_handoff_to_operator === true
  ) {
    return {
      decision: 'signoff',
      review_status: 'release_commander_signed_off',
      reason: 'readiness_seal_ready_for_release_commander_signoff',
      can_release_commander_signoff: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    review_status: readinessSealReceipt.seal_status || 'blocked',
    reason: readinessSealReceipt.reason || 'final_delivery_readiness_seal_not_ready',
    can_release_commander_signoff: false,
    required_actions: ['resolve_final_delivery_readiness_seal_before_handoff_review']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReview(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery sealed handoff review actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const readinessSealReceipt = (bundle.bundle_final_delivery_readiness_seal_references || [])[0] || null;
  const reviewDecision = finalDeliverySealedHandoffReviewDecision(readinessSealReceipt);
  const generatedAt = new Date().toISOString();
  const review = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: reviewDecision.decision,
    review_status: reviewDecision.review_status,
    reason: reviewDecision.reason,
    can_release_commander_signoff: Boolean(reviewDecision.can_release_commander_signoff),
    explanation: reviewDecision.can_release_commander_signoff
      ? 'Internal sealed handoff review is signed off because the readiness seal is sealed for operator handoff.'
      : 'Internal sealed handoff review is blocked until a sealed readiness seal receipt is recorded.',
    required_actions: reviewDecision.required_actions,
    readiness_seal_receipt: readinessSealReceipt
      ? {
          receipt_hash: readinessSealReceipt.receipt_hash,
          recorder: readinessSealReceipt.recorder,
          decision: readinessSealReceipt.decision,
          seal_status: readinessSealReceipt.seal_status,
          reason: readinessSealReceipt.reason,
          can_handoff_to_operator: Boolean(readinessSealReceipt.can_handoff_to_operator),
          dual_control_approval_receipt_hash: readinessSealReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: readinessSealReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: readinessSealReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: readinessSealReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: readinessSealReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: readinessSealReceipt.lifecycle_review_receipt_hash,
          packet_hash: readinessSealReceipt.packet_hash,
          manifest_hash: readinessSealReceipt.manifest_hash,
          at: readinessSealReceipt.at || readinessSealReceipt.created_at || null
        }
      : null,
    dual_control_approval_receipt: readinessSealReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: readinessSealReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: readinessSealReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: readinessSealReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: readinessSealReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: readinessSealReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: readinessSealReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: readinessSealReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: readinessSealReceipt?.final_approval_receipt_hash
      ? { receipt_hash: readinessSealReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: readinessSealReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: readinessSealReceipt.lifecycle_review_receipt_hash }
      : null,
    release_commander_signoff: {
      mode: 'internal_release_commander_signoff',
      signed_off_for_internal_release_command: Boolean(reviewDecision.can_release_commander_signoff),
      handoff_review_window_minutes: 30,
      required_commander_checks: reviewDecision.can_release_commander_signoff
        ? [
            'confirm_readiness_seal_receipt_hash',
            'confirm_dual_control_approval_receipt_hash',
            'confirm_rehearsal_receipt_hash',
            'confirm_signed_bundle_manifest_hash',
            'confirm_no_external_delivery_side_effects'
          ]
        : ['record_sealed_readiness_seal_before_release_commander_signoff'],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    release_guard: {
      mode: 'internal_final_delivery_sealed_handoff_review_guard',
      release_commander_signed_off: Boolean(reviewDecision.can_release_commander_signoff),
      requires_separate_real_delivery_instruction: true,
      requires_operator_release_confirmation: true,
      requires_release_commander_confirmation: true,
      rollback_required_before_external_delivery: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      readiness_seal_reference_count: bundle.bundle_final_delivery_readiness_seal_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_sealed_handoff_review_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review'
  };
  review.sealed_handoff_review_hash = digestValue(review);
  return review;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery sealed handoff review receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_receipt_recorder_required';
    throw error;
  }
  const review = await getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReview(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: review.filters || filters || {},
    sealed_handoff_review: {
      sealed_handoff_review_hash: review.sealed_handoff_review_hash,
      generated_at: review.generated_at,
      decision: review.decision,
      review_status: review.review_status,
      reason: review.reason,
      can_release_commander_signoff: Boolean(review.can_release_commander_signoff),
      explanation: review.explanation,
      required_actions: review.required_actions || []
    },
    readiness_seal_receipt: review.readiness_seal_receipt,
    dual_control_approval_receipt: review.dual_control_approval_receipt,
    rehearsal_receipt: review.rehearsal_receipt,
    dry_run_lock_receipt: review.dry_run_lock_receipt,
    policy_gate_receipt: review.policy_gate_receipt,
    final_approval_receipt: review.final_approval_receipt,
    lifecycle_review_receipt: review.lifecycle_review_receipt,
    release_commander_signoff: review.release_commander_signoff,
    release_guard: review.release_guard,
    signed_bundle: review.signed_bundle,
    execution_stub: review.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliverySealedHandoffReviewReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_handoff_reviews (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       review_status,
       reason,
       can_release_commander_signoff,
       readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash,
       rehearsal_receipt_hash,
       dry_run_lock_receipt_hash,
       policy_gate_receipt_hash,
       final_approval_receipt_hash,
       lifecycle_review_receipt_hash,
       packet_hash,
       manifest_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, review_status, reason,
       can_release_commander_signoff, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      review.decision,
      review.review_status,
      review.reason,
      Boolean(review.can_release_commander_signoff),
      review.readiness_seal_receipt?.receipt_hash || null,
      review.readiness_seal_receipt?.dual_control_approval_receipt_hash || null,
      review.readiness_seal_receipt?.rehearsal_receipt_hash || null,
      review.readiness_seal_receipt?.dry_run_lock_receipt_hash || null,
      review.readiness_seal_receipt?.policy_gate_receipt_hash || null,
      review.readiness_seal_receipt?.final_approval_receipt_hash || null,
      review.readiness_seal_receipt?.lifecycle_review_receipt_hash || null,
      review.release_commander_signoff?.packet_hash || null,
      review.release_commander_signoff?.manifest_hash || null,
      JSON.stringify(review.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliverySealedHandoffReviewReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipts(
  { limit = 20, decision = '', review_status: reviewStatus = '', can_release_commander_signoff: canSignoff = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['signoff', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery sealed handoff review receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (reviewStatus) {
    params.push(String(reviewStatus).trim().toLowerCase());
    where.push(`review_status = $${params.length}`);
  }
  if (canSignoff !== '' && canSignoff !== undefined && canSignoff !== null) {
    const normalizedCanSignoff = ['true', '1', 'yes', true].includes(canSignoff);
    params.push(normalizedCanSignoff);
    where.push(`can_release_commander_signoff = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, review_status, reason,
       can_release_commander_signoff, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_handoff_reviews
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliverySealedHandoffReviewReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery sealed handoff review receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, review_status, reason,
       can_release_commander_signoff, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_handoff_reviews
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery sealed handoff review receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliverySealedHandoffReviewReceipt(result.rows[0]);
}

function finalDeliveryCommandEscrowDecision(sealedHandoffReviewReceipt = null) {
  if (!sealedHandoffReviewReceipt) {
    return {
      decision: 'block',
      escrow_status: 'missing_release_commander_signoff',
      reason: 'missing_final_delivery_sealed_handoff_review_receipt',
      can_seal_release_command: false,
      required_actions: ['record_final_delivery_sealed_handoff_review_receipt']
    };
  }
  if (
    sealedHandoffReviewReceipt.decision === 'signoff' &&
    sealedHandoffReviewReceipt.review_status === 'release_commander_signed_off' &&
    sealedHandoffReviewReceipt.can_release_commander_signoff === true
  ) {
    return {
      decision: 'escrow',
      escrow_status: 'release_command_escrowed',
      reason: 'release_commander_signoff_ready_for_command_escrow',
      can_seal_release_command: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    escrow_status: sealedHandoffReviewReceipt.review_status || 'blocked',
    reason: sealedHandoffReviewReceipt.reason || 'release_commander_signoff_not_ready',
    can_seal_release_command: false,
    required_actions: ['resolve_release_commander_signoff_before_command_escrow']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrow(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command escrow actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const sealedHandoffReviewReceipt = (bundle.bundle_final_delivery_sealed_handoff_review_references || [])[0] || null;
  const escrowDecision = finalDeliveryCommandEscrowDecision(sealedHandoffReviewReceipt);
  const generatedAt = new Date().toISOString();
  const escrow = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-escrow-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: escrowDecision.decision,
    escrow_status: escrowDecision.escrow_status,
    reason: escrowDecision.reason,
    can_seal_release_command: Boolean(escrowDecision.can_seal_release_command),
    explanation: escrowDecision.can_seal_release_command
      ? 'Internal release command packet is escrowed because release commander signoff is complete.'
      : 'Internal release command packet is blocked until release commander signoff is recorded.',
    required_actions: escrowDecision.required_actions,
    sealed_handoff_review_receipt: sealedHandoffReviewReceipt
      ? {
          receipt_hash: sealedHandoffReviewReceipt.receipt_hash,
          recorder: sealedHandoffReviewReceipt.recorder,
          decision: sealedHandoffReviewReceipt.decision,
          review_status: sealedHandoffReviewReceipt.review_status,
          reason: sealedHandoffReviewReceipt.reason,
          can_release_commander_signoff: Boolean(sealedHandoffReviewReceipt.can_release_commander_signoff),
          readiness_seal_receipt_hash: sealedHandoffReviewReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: sealedHandoffReviewReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: sealedHandoffReviewReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: sealedHandoffReviewReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: sealedHandoffReviewReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: sealedHandoffReviewReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: sealedHandoffReviewReceipt.lifecycle_review_receipt_hash,
          packet_hash: sealedHandoffReviewReceipt.packet_hash,
          manifest_hash: sealedHandoffReviewReceipt.manifest_hash,
          at: sealedHandoffReviewReceipt.at || sealedHandoffReviewReceipt.created_at || null
        }
      : null,
    readiness_seal_receipt: sealedHandoffReviewReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: sealedHandoffReviewReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: sealedHandoffReviewReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: sealedHandoffReviewReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: sealedHandoffReviewReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: sealedHandoffReviewReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: sealedHandoffReviewReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: sealedHandoffReviewReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: sealedHandoffReviewReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: sealedHandoffReviewReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: sealedHandoffReviewReceipt?.final_approval_receipt_hash
      ? { receipt_hash: sealedHandoffReviewReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: sealedHandoffReviewReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: sealedHandoffReviewReceipt.lifecycle_review_receipt_hash }
      : null,
    release_command_packet: {
      mode: 'internal_release_command_escrow',
      command_packet_sealed: Boolean(escrowDecision.can_seal_release_command),
      command_packet_ttl_minutes: 30,
      required_operator_checks: escrowDecision.can_seal_release_command
        ? [
            'confirm_release_commander_signoff_receipt_hash',
            'confirm_readiness_seal_receipt_hash',
            'confirm_dual_control_approval_receipt_hash',
            'confirm_signed_bundle_manifest_hash',
            'confirm_no_external_delivery_side_effects'
          ]
        : ['record_release_commander_signoff_before_command_escrow'],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    release_guard: {
      mode: 'internal_final_delivery_command_escrow_guard',
      release_command_escrowed: Boolean(escrowDecision.can_seal_release_command),
      requires_separate_real_delivery_instruction: true,
      requires_operator_release_confirmation: true,
      requires_release_commander_confirmation: true,
      command_packet_is_not_delivery_authorization: true,
      rollback_required_before_external_delivery: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      sealed_handoff_review_reference_count: bundle.bundle_final_delivery_sealed_handoff_review_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_escrow_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow'
  };
  escrow.command_escrow_hash = digestValue(escrow);
  return escrow;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command escrow receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow_receipt_recorder_required';
    throw error;
  }
  const escrow = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrow(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-escrow-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: escrow.filters || filters || {},
    command_escrow: {
      command_escrow_hash: escrow.command_escrow_hash,
      generated_at: escrow.generated_at,
      decision: escrow.decision,
      escrow_status: escrow.escrow_status,
      reason: escrow.reason,
      can_seal_release_command: Boolean(escrow.can_seal_release_command),
      explanation: escrow.explanation,
      required_actions: escrow.required_actions || []
    },
    sealed_handoff_review_receipt: escrow.sealed_handoff_review_receipt,
    readiness_seal_receipt: escrow.readiness_seal_receipt,
    dual_control_approval_receipt: escrow.dual_control_approval_receipt,
    rehearsal_receipt: escrow.rehearsal_receipt,
    dry_run_lock_receipt: escrow.dry_run_lock_receipt,
    policy_gate_receipt: escrow.policy_gate_receipt,
    final_approval_receipt: escrow.final_approval_receipt,
    lifecycle_review_receipt: escrow.lifecycle_review_receipt,
    release_command_packet: escrow.release_command_packet,
    release_guard: escrow.release_guard,
    signed_bundle: escrow.signed_bundle,
    execution_stub: escrow.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandEscrowReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_escrows (
       receipt_hash,
       recorder_username,
       recorder_role,
       decision,
       escrow_status,
       reason,
       can_seal_release_command,
       sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash,
       rehearsal_receipt_hash,
       dry_run_lock_receipt_hash,
       policy_gate_receipt_hash,
       final_approval_receipt_hash,
       lifecycle_review_receipt_hash,
       packet_hash,
       manifest_hash,
       filters,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_seal_release_command, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      escrow.decision,
      escrow.escrow_status,
      escrow.reason,
      Boolean(escrow.can_seal_release_command),
      escrow.sealed_handoff_review_receipt?.receipt_hash || null,
      escrow.sealed_handoff_review_receipt?.readiness_seal_receipt_hash || null,
      escrow.sealed_handoff_review_receipt?.dual_control_approval_receipt_hash || null,
      escrow.sealed_handoff_review_receipt?.rehearsal_receipt_hash || null,
      escrow.sealed_handoff_review_receipt?.dry_run_lock_receipt_hash || null,
      escrow.sealed_handoff_review_receipt?.policy_gate_receipt_hash || null,
      escrow.sealed_handoff_review_receipt?.final_approval_receipt_hash || null,
      escrow.sealed_handoff_review_receipt?.lifecycle_review_receipt_hash || null,
      escrow.release_command_packet?.packet_hash || null,
      escrow.release_command_packet?.manifest_hash || null,
      JSON.stringify(escrow.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandEscrowReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipts(
  { limit = 20, decision = '', escrow_status: escrowStatus = '', can_seal_release_command: canSeal = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['escrow', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command escrow receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (escrowStatus) {
    params.push(String(escrowStatus).trim().toLowerCase());
    where.push(`escrow_status = $${params.length}`);
  }
  if (canSeal !== '' && canSeal !== undefined && canSeal !== null) {
    const normalizedCanSeal = ['true', '1', 'yes', true].includes(canSeal);
    params.push(normalizedCanSeal);
    where.push(`can_seal_release_command = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_seal_release_command, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_escrows
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandEscrowReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command escrow receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_seal_release_command, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_escrows
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command escrow receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_escrow_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandEscrowReceipt(result.rows[0]);
}

function finalDeliveryCommandRevocationDecision(commandEscrowReceipt = null) {
  if (!commandEscrowReceipt) {
    return {
      decision: 'block',
      revocation_status: 'missing_command_escrow',
      reason: 'missing_final_delivery_command_escrow_receipt',
      can_rollback_release_command: false,
      required_actions: ['record_final_delivery_command_escrow_receipt']
    };
  }
  if (
    commandEscrowReceipt.decision === 'escrow' &&
    commandEscrowReceipt.escrow_status === 'release_command_escrowed' &&
    commandEscrowReceipt.can_seal_release_command === true
  ) {
    return {
      decision: 'revoke',
      revocation_status: 'release_command_revoked',
      reason: 'command_escrow_ready_for_rollback',
      can_rollback_release_command: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    revocation_status: commandEscrowReceipt.escrow_status || 'blocked',
    reason: commandEscrowReceipt.reason || 'command_escrow_not_ready',
    can_rollback_release_command: false,
    required_actions: ['resolve_command_escrow_before_revocation']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocation(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command revocation actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const commandEscrowReceipt = (bundle.bundle_final_delivery_command_escrow_references || [])[0] || null;
  const revocationDecision = finalDeliveryCommandRevocationDecision(commandEscrowReceipt);
  const generatedAt = new Date().toISOString();
  const revocation = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-revocation-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: revocationDecision.decision,
    revocation_status: revocationDecision.revocation_status,
    reason: revocationDecision.reason,
    can_rollback_release_command: Boolean(revocationDecision.can_rollback_release_command),
    explanation: revocationDecision.can_rollback_release_command
      ? 'Internal release command escrow is revoked and rollback evidence is sealed.'
      : 'Internal release command revocation is blocked until command escrow is recorded.',
    required_actions: revocationDecision.required_actions,
    command_escrow_receipt: commandEscrowReceipt
      ? {
          receipt_hash: commandEscrowReceipt.receipt_hash,
          recorder: commandEscrowReceipt.recorder,
          decision: commandEscrowReceipt.decision,
          escrow_status: commandEscrowReceipt.escrow_status,
          reason: commandEscrowReceipt.reason,
          can_seal_release_command: Boolean(commandEscrowReceipt.can_seal_release_command),
          sealed_handoff_review_receipt_hash: commandEscrowReceipt.sealed_handoff_review_receipt_hash,
          readiness_seal_receipt_hash: commandEscrowReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: commandEscrowReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: commandEscrowReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: commandEscrowReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: commandEscrowReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: commandEscrowReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: commandEscrowReceipt.lifecycle_review_receipt_hash,
          packet_hash: commandEscrowReceipt.packet_hash,
          manifest_hash: commandEscrowReceipt.manifest_hash,
          at: commandEscrowReceipt.at || commandEscrowReceipt.created_at || null
        }
      : null,
    sealed_handoff_review_receipt: commandEscrowReceipt?.sealed_handoff_review_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.sealed_handoff_review_receipt_hash }
      : null,
    readiness_seal_receipt: commandEscrowReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: commandEscrowReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: commandEscrowReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: commandEscrowReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: commandEscrowReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: commandEscrowReceipt?.final_approval_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: commandEscrowReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: commandEscrowReceipt.lifecycle_review_receipt_hash }
      : null,
    rollback_plan: {
      mode: 'internal_release_command_escrow_rollback',
      release_command_revoked: Boolean(revocationDecision.can_rollback_release_command),
      rollback_window_minutes: 30,
      required_checks: revocationDecision.can_rollback_release_command
        ? [
            'confirm_command_escrow_receipt_hash',
            'confirm_release_commander_signoff_receipt_hash',
            'confirm_no_external_delivery_side_effects',
            'confirm_customer_dashboard_unchanged',
            'confirm_cloudflare_deploy_not_triggered'
          ]
        : ['record_command_escrow_before_revocation'],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    release_guard: {
      mode: 'internal_final_delivery_command_revocation_guard',
      release_command_revoked: Boolean(revocationDecision.can_rollback_release_command),
      revocation_is_not_external_delivery: true,
      requires_separate_real_delivery_instruction: true,
      command_packet_is_not_delivery_authorization: true,
      rollback_recorded_before_external_delivery: Boolean(revocationDecision.can_rollback_release_command)
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      command_escrow_reference_count: bundle.bundle_final_delivery_command_escrow_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_revocation_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation'
  };
  revocation.command_revocation_hash = digestValue(revocation);
  return revocation;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command revocation receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation_receipt_recorder_required';
    throw error;
  }
  const revocation = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocation(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-revocation-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: revocation.filters || filters || {},
    command_revocation: {
      command_revocation_hash: revocation.command_revocation_hash,
      generated_at: revocation.generated_at,
      decision: revocation.decision,
      revocation_status: revocation.revocation_status,
      reason: revocation.reason,
      can_rollback_release_command: Boolean(revocation.can_rollback_release_command),
      explanation: revocation.explanation,
      required_actions: revocation.required_actions || []
    },
    command_escrow_receipt: revocation.command_escrow_receipt,
    sealed_handoff_review_receipt: revocation.sealed_handoff_review_receipt,
    readiness_seal_receipt: revocation.readiness_seal_receipt,
    dual_control_approval_receipt: revocation.dual_control_approval_receipt,
    rehearsal_receipt: revocation.rehearsal_receipt,
    dry_run_lock_receipt: revocation.dry_run_lock_receipt,
    policy_gate_receipt: revocation.policy_gate_receipt,
    final_approval_receipt: revocation.final_approval_receipt,
    lifecycle_review_receipt: revocation.lifecycle_review_receipt,
    rollback_plan: revocation.rollback_plan,
    release_guard: revocation.release_guard,
    signed_bundle: revocation.signed_bundle,
    execution_stub: revocation.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandRevocationReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_revocations (
       receipt_hash, recorder_username, recorder_role, decision, revocation_status, reason,
       can_rollback_release_command, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::jsonb, $20::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, revocation_status, reason,
       can_rollback_release_command, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      revocation.decision,
      revocation.revocation_status,
      revocation.reason,
      Boolean(revocation.can_rollback_release_command),
      revocation.command_escrow_receipt?.receipt_hash || null,
      revocation.command_escrow_receipt?.sealed_handoff_review_receipt_hash || null,
      revocation.command_escrow_receipt?.readiness_seal_receipt_hash || null,
      revocation.command_escrow_receipt?.dual_control_approval_receipt_hash || null,
      revocation.command_escrow_receipt?.rehearsal_receipt_hash || null,
      revocation.command_escrow_receipt?.dry_run_lock_receipt_hash || null,
      revocation.command_escrow_receipt?.policy_gate_receipt_hash || null,
      revocation.command_escrow_receipt?.final_approval_receipt_hash || null,
      revocation.command_escrow_receipt?.lifecycle_review_receipt_hash || null,
      revocation.rollback_plan?.packet_hash || null,
      revocation.rollback_plan?.manifest_hash || null,
      JSON.stringify(revocation.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandRevocationReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipts(
  { limit = 20, decision = '', revocation_status: revocationStatus = '', can_rollback_release_command: canRollback = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['revoke', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command revocation receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (revocationStatus) {
    params.push(String(revocationStatus).trim().toLowerCase());
    where.push(`revocation_status = $${params.length}`);
  }
  if (canRollback !== '' && canRollback !== undefined && canRollback !== null) {
    const normalizedCanRollback = ['true', '1', 'yes', true].includes(canRollback);
    params.push(normalizedCanRollback);
    where.push(`can_rollback_release_command = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, revocation_status, reason,
       can_rollback_release_command, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_revocations
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandRevocationReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command revocation receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, revocation_status, reason,
       can_rollback_release_command, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_revocations
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command revocation receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_revocation_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandRevocationReceipt(result.rows[0]);
}

function finalDeliveryCommandClosureDecision(commandRevocationReceipt = null) {
  if (!commandRevocationReceipt) {
    return {
      decision: 'block',
      closure_status: 'missing_command_revocation',
      reason: 'missing_final_delivery_command_revocation_receipt',
      can_reinstate_release_command: false,
      required_actions: ['record_final_delivery_command_revocation_receipt']
    };
  }
  if (
    commandRevocationReceipt.decision === 'revoke' &&
    commandRevocationReceipt.revocation_status === 'release_command_revoked' &&
    commandRevocationReceipt.can_rollback_release_command === true
  ) {
    return {
      decision: 'close',
      closure_status: 'rollback_closed_reinstatement_reviewed',
      reason: 'command_revocation_ready_for_closure',
      can_reinstate_release_command: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    closure_status: commandRevocationReceipt.revocation_status || 'blocked',
    reason: commandRevocationReceipt.reason || 'command_revocation_not_ready',
    can_reinstate_release_command: false,
    required_actions: ['resolve_command_revocation_before_closure']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosure(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command closure actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_closure_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const commandRevocationReceipt = (bundle.bundle_final_delivery_command_revocation_references || [])[0] || null;
  const closureDecision = finalDeliveryCommandClosureDecision(commandRevocationReceipt);
  const generatedAt = new Date().toISOString();
  const closure = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-closure-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: closureDecision.decision,
    closure_status: closureDecision.closure_status,
    reason: closureDecision.reason,
    can_reinstate_release_command: Boolean(closureDecision.can_reinstate_release_command),
    explanation: closureDecision.can_reinstate_release_command
      ? 'Internal release command rollback is closed and reinstatement review is sealed.'
      : 'Internal release command rollback closure is blocked until command revocation is recorded.',
    required_actions: closureDecision.required_actions,
    command_revocation_receipt: commandRevocationReceipt
      ? {
          receipt_hash: commandRevocationReceipt.receipt_hash,
          recorder: commandRevocationReceipt.recorder,
          decision: commandRevocationReceipt.decision,
          revocation_status: commandRevocationReceipt.revocation_status,
          reason: commandRevocationReceipt.reason,
          can_rollback_release_command: Boolean(commandRevocationReceipt.can_rollback_release_command),
          command_escrow_receipt_hash: commandRevocationReceipt.command_escrow_receipt_hash,
          sealed_handoff_review_receipt_hash: commandRevocationReceipt.sealed_handoff_review_receipt_hash,
          readiness_seal_receipt_hash: commandRevocationReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: commandRevocationReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: commandRevocationReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: commandRevocationReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: commandRevocationReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: commandRevocationReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: commandRevocationReceipt.lifecycle_review_receipt_hash,
          packet_hash: commandRevocationReceipt.packet_hash,
          manifest_hash: commandRevocationReceipt.manifest_hash,
          at: commandRevocationReceipt.at || commandRevocationReceipt.created_at || null
        }
      : null,
    command_escrow_receipt: commandRevocationReceipt?.command_escrow_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.command_escrow_receipt_hash }
      : null,
    sealed_handoff_review_receipt: commandRevocationReceipt?.sealed_handoff_review_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.sealed_handoff_review_receipt_hash }
      : null,
    readiness_seal_receipt: commandRevocationReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: commandRevocationReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: commandRevocationReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: commandRevocationReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: commandRevocationReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: commandRevocationReceipt?.final_approval_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: commandRevocationReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: commandRevocationReceipt.lifecycle_review_receipt_hash }
      : null,
    closure_plan: {
      mode: 'internal_release_command_rollback_closure',
      rollback_closed: Boolean(closureDecision.can_reinstate_release_command),
      closure_window_minutes: 30,
      required_checks: closureDecision.can_reinstate_release_command
        ? [
            'confirm_command_revocation_receipt_hash',
            'confirm_command_escrow_receipt_hash',
            'confirm_release_command_not_externally_delivered',
            'confirm_customer_dashboard_unchanged',
            'confirm_cloudflare_deploy_not_triggered'
          ]
        : ['record_command_revocation_before_closure'],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    reinstatement_review: {
      mode: 'internal_release_command_reinstatement_review',
      reinstatement_reviewed: Boolean(closureDecision.can_reinstate_release_command),
      can_reinstate_release_command: Boolean(closureDecision.can_reinstate_release_command),
      requires_new_command_escrow_before_real_delivery: true,
      reinstatement_is_not_delivery_authorization: true
    },
    release_guard: {
      mode: 'internal_final_delivery_command_closure_guard',
      rollback_closed: Boolean(closureDecision.can_reinstate_release_command),
      closure_is_not_external_delivery: true,
      requires_separate_real_delivery_instruction: true,
      reinstatement_is_internal_review_only: true,
      external_delivery_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      command_revocation_reference_count: bundle.bundle_final_delivery_command_revocation_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_closure_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_closure'
  };
  closure.command_closure_hash = digestValue(closure);
  return closure;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command closure receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_closure_receipt_recorder_required';
    throw error;
  }
  const closure = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosure(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-closure-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: closure.filters || filters || {},
    command_closure: {
      command_closure_hash: closure.command_closure_hash,
      generated_at: closure.generated_at,
      decision: closure.decision,
      closure_status: closure.closure_status,
      reason: closure.reason,
      can_reinstate_release_command: Boolean(closure.can_reinstate_release_command),
      explanation: closure.explanation,
      required_actions: closure.required_actions || []
    },
    command_revocation_receipt: closure.command_revocation_receipt,
    command_escrow_receipt: closure.command_escrow_receipt,
    sealed_handoff_review_receipt: closure.sealed_handoff_review_receipt,
    readiness_seal_receipt: closure.readiness_seal_receipt,
    dual_control_approval_receipt: closure.dual_control_approval_receipt,
    rehearsal_receipt: closure.rehearsal_receipt,
    dry_run_lock_receipt: closure.dry_run_lock_receipt,
    policy_gate_receipt: closure.policy_gate_receipt,
    final_approval_receipt: closure.final_approval_receipt,
    lifecycle_review_receipt: closure.lifecycle_review_receipt,
    closure_plan: closure.closure_plan,
    reinstatement_review: closure.reinstatement_review,
    release_guard: closure.release_guard,
    signed_bundle: closure.signed_bundle,
    execution_stub: closure.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_closure_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandClosureReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_closures (
       receipt_hash, recorder_username, recorder_role, decision, closure_status, reason,
       can_reinstate_release_command, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, closure_status, reason,
       can_reinstate_release_command, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      closure.decision,
      closure.closure_status,
      closure.reason,
      Boolean(closure.can_reinstate_release_command),
      closure.command_revocation_receipt?.receipt_hash || null,
      closure.command_revocation_receipt?.command_escrow_receipt_hash || null,
      closure.command_revocation_receipt?.sealed_handoff_review_receipt_hash || null,
      closure.command_revocation_receipt?.readiness_seal_receipt_hash || null,
      closure.command_revocation_receipt?.dual_control_approval_receipt_hash || null,
      closure.command_revocation_receipt?.rehearsal_receipt_hash || null,
      closure.command_revocation_receipt?.dry_run_lock_receipt_hash || null,
      closure.command_revocation_receipt?.policy_gate_receipt_hash || null,
      closure.command_revocation_receipt?.final_approval_receipt_hash || null,
      closure.command_revocation_receipt?.lifecycle_review_receipt_hash || null,
      closure.closure_plan?.packet_hash || null,
      closure.closure_plan?.manifest_hash || null,
      JSON.stringify(closure.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandClosureReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipts(
  { limit = 20, decision = '', closure_status: closureStatus = '', can_reinstate_release_command: canReinstate = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['close', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command closure receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_closure_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (closureStatus) {
    params.push(String(closureStatus).trim().toLowerCase());
    where.push(`closure_status = $${params.length}`);
  }
  if (canReinstate !== '' && canReinstate !== undefined && canReinstate !== null) {
    const normalizedCanReinstate = ['true', '1', 'yes', true].includes(canReinstate);
    params.push(normalizedCanReinstate);
    where.push(`can_reinstate_release_command = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, closure_status, reason,
       can_reinstate_release_command, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_closures
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandClosureReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command closure receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_closure_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, closure_status, reason,
       can_reinstate_release_command, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_closures
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command closure receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_closure_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandClosureReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailNotarizationDecision(commandClosureReceipt = null) {
  if (
    commandClosureReceipt &&
    commandClosureReceipt.decision === 'close' &&
    commandClosureReceipt.closure_status === 'rollback_closed_reinstatement_reviewed' &&
    commandClosureReceipt.can_reinstate_release_command === true
  ) {
    return {
      decision: 'notarize',
      notarization_status: 'release_trail_notarized',
      reason: 'command_closure_ready_for_release_trail_notarization',
      can_archive_release_trail: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    notarization_status: commandClosureReceipt?.closure_status || 'missing_command_closure',
    reason: commandClosureReceipt?.reason || 'missing_final_delivery_command_closure_receipt',
    can_archive_release_trail: false,
    required_actions: ['record_command_closure_before_trail_notarization']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarization(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail notarization actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const commandClosureReceipt = (bundle.bundle_final_delivery_command_closure_references || [])[0] || null;
  const notarizationDecision = finalDeliveryCommandTrailNotarizationDecision(commandClosureReceipt);
  const generatedAt = new Date().toISOString();
  const trail = [
    ['lifecycle_review', commandClosureReceipt?.lifecycle_review_receipt_hash],
    ['final_approval', commandClosureReceipt?.final_approval_receipt_hash],
    ['policy_gate', commandClosureReceipt?.policy_gate_receipt_hash],
    ['dry_run_lock', commandClosureReceipt?.dry_run_lock_receipt_hash],
    ['rehearsal', commandClosureReceipt?.rehearsal_receipt_hash],
    ['dual_control_approval', commandClosureReceipt?.dual_control_approval_receipt_hash],
    ['readiness_seal', commandClosureReceipt?.readiness_seal_receipt_hash],
    ['sealed_handoff_review', commandClosureReceipt?.sealed_handoff_review_receipt_hash],
    ['command_escrow', commandClosureReceipt?.command_escrow_receipt_hash],
    ['command_revocation', commandClosureReceipt?.command_revocation_receipt_hash],
    ['command_closure', commandClosureReceipt?.receipt_hash]
  ].map(([step, receiptHash], index) => ({ sequence: index + 1, step, receipt_hash: receiptHash || null }));
  const trailHash = digestValue({
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-v1',
    trail,
    packet_hash: bundle.packet_hash,
    manifest_hash: bundle.manifest_hash,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail'
  });
  const notarization = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: notarizationDecision.decision,
    notarization_status: notarizationDecision.notarization_status,
    reason: notarizationDecision.reason,
    can_archive_release_trail: Boolean(notarizationDecision.can_archive_release_trail),
    explanation: notarizationDecision.can_archive_release_trail
      ? 'Internal release trail is frozen and notarized after rollback closure; this is not external delivery authorization.'
      : 'Internal release trail notarization is blocked until command closure is recorded.',
    required_actions: notarizationDecision.required_actions,
    command_closure_receipt: commandClosureReceipt
      ? {
          receipt_hash: commandClosureReceipt.receipt_hash,
          recorder: commandClosureReceipt.recorder,
          decision: commandClosureReceipt.decision,
          closure_status: commandClosureReceipt.closure_status,
          reason: commandClosureReceipt.reason,
          can_reinstate_release_command: Boolean(commandClosureReceipt.can_reinstate_release_command),
          command_revocation_receipt_hash: commandClosureReceipt.command_revocation_receipt_hash,
          command_escrow_receipt_hash: commandClosureReceipt.command_escrow_receipt_hash,
          sealed_handoff_review_receipt_hash: commandClosureReceipt.sealed_handoff_review_receipt_hash,
          readiness_seal_receipt_hash: commandClosureReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: commandClosureReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: commandClosureReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: commandClosureReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: commandClosureReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: commandClosureReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: commandClosureReceipt.lifecycle_review_receipt_hash,
          packet_hash: commandClosureReceipt.packet_hash,
          manifest_hash: commandClosureReceipt.manifest_hash,
          at: commandClosureReceipt.at || commandClosureReceipt.created_at || null
        }
      : null,
    command_revocation_receipt: commandClosureReceipt?.command_revocation_receipt_hash
      ? { receipt_hash: commandClosureReceipt.command_revocation_receipt_hash }
      : null,
    command_escrow_receipt: commandClosureReceipt?.command_escrow_receipt_hash
      ? { receipt_hash: commandClosureReceipt.command_escrow_receipt_hash }
      : null,
    sealed_handoff_review_receipt: commandClosureReceipt?.sealed_handoff_review_receipt_hash
      ? { receipt_hash: commandClosureReceipt.sealed_handoff_review_receipt_hash }
      : null,
    readiness_seal_receipt: commandClosureReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: commandClosureReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: commandClosureReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: commandClosureReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: commandClosureReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: commandClosureReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: commandClosureReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: commandClosureReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: commandClosureReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: commandClosureReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: commandClosureReceipt?.final_approval_receipt_hash
      ? { receipt_hash: commandClosureReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: commandClosureReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: commandClosureReceipt.lifecycle_review_receipt_hash }
      : null,
    notarized_release_trail: {
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-v1',
      trail_hash: trailHash,
      frozen: Boolean(notarizationDecision.can_archive_release_trail),
      receipt_count: trail.filter((item) => item.receipt_hash).length,
      trail,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    freeze_guard: {
      mode: 'internal_release_trail_notarization_freeze',
      freeze_is_internal_only: true,
      notarization_is_not_delivery_authorization: true,
      requires_new_command_escrow_before_real_delivery: true,
      external_delivery_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      command_closure_reference_count: bundle.bundle_final_delivery_command_closure_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_notarization_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization'
  };
  notarization.trail_notarization_hash = digestValue(notarization);
  return notarization;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail notarization receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization_receipt_recorder_required';
    throw error;
  }
  const notarization = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarization(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: notarization.filters || filters || {},
    trail_notarization: {
      trail_notarization_hash: notarization.trail_notarization_hash,
      generated_at: notarization.generated_at,
      decision: notarization.decision,
      notarization_status: notarization.notarization_status,
      reason: notarization.reason,
      can_archive_release_trail: Boolean(notarization.can_archive_release_trail),
      explanation: notarization.explanation,
      required_actions: notarization.required_actions || []
    },
    command_closure_receipt: notarization.command_closure_receipt,
    command_revocation_receipt: notarization.command_revocation_receipt,
    command_escrow_receipt: notarization.command_escrow_receipt,
    sealed_handoff_review_receipt: notarization.sealed_handoff_review_receipt,
    readiness_seal_receipt: notarization.readiness_seal_receipt,
    dual_control_approval_receipt: notarization.dual_control_approval_receipt,
    rehearsal_receipt: notarization.rehearsal_receipt,
    dry_run_lock_receipt: notarization.dry_run_lock_receipt,
    policy_gate_receipt: notarization.policy_gate_receipt,
    final_approval_receipt: notarization.final_approval_receipt,
    lifecycle_review_receipt: notarization.lifecycle_review_receipt,
    notarized_release_trail: notarization.notarized_release_trail,
    freeze_guard: notarization.freeze_guard,
    signed_bundle: notarization.signed_bundle,
    execution_stub: notarization.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailNotarizationReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_notarizations (
       receipt_hash, recorder_username, recorder_role, decision, notarization_status, reason,
       can_archive_release_trail, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, notarization_status, reason,
       can_archive_release_trail, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      notarization.decision,
      notarization.notarization_status,
      notarization.reason,
      Boolean(notarization.can_archive_release_trail),
      notarization.command_closure_receipt?.receipt_hash || null,
      notarization.command_closure_receipt?.command_revocation_receipt_hash || null,
      notarization.command_closure_receipt?.command_escrow_receipt_hash || null,
      notarization.command_closure_receipt?.sealed_handoff_review_receipt_hash || null,
      notarization.command_closure_receipt?.readiness_seal_receipt_hash || null,
      notarization.command_closure_receipt?.dual_control_approval_receipt_hash || null,
      notarization.command_closure_receipt?.rehearsal_receipt_hash || null,
      notarization.command_closure_receipt?.dry_run_lock_receipt_hash || null,
      notarization.command_closure_receipt?.policy_gate_receipt_hash || null,
      notarization.command_closure_receipt?.final_approval_receipt_hash || null,
      notarization.command_closure_receipt?.lifecycle_review_receipt_hash || null,
      notarization.notarized_release_trail?.packet_hash || null,
      notarization.notarized_release_trail?.manifest_hash || null,
      JSON.stringify(notarization.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailNotarizationReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipts(
  { limit = 20, decision = '', notarization_status: notarizationStatus = '', can_archive_release_trail: canArchive = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['notarize', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail notarization receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (notarizationStatus) {
    params.push(String(notarizationStatus).trim().toLowerCase());
    where.push(`notarization_status = $${params.length}`);
  }
  if (canArchive !== '' && canArchive !== undefined && canArchive !== null) {
    const normalizedCanArchive = ['true', '1', 'yes', true].includes(canArchive);
    params.push(normalizedCanArchive);
    where.push(`can_archive_release_trail = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, notarization_status, reason,
       can_archive_release_trail, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_notarizations
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailNotarizationReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail notarization receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, notarization_status, reason,
       can_archive_release_trail, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_notarizations
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail notarization receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_notarization_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailNotarizationReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailCustodyDecision(trailNotarizationReceipt = null) {
  if (
    trailNotarizationReceipt &&
    trailNotarizationReceipt.decision === 'notarize' &&
    trailNotarizationReceipt.notarization_status === 'release_trail_notarized' &&
    trailNotarizationReceipt.can_archive_release_trail === true
  ) {
    return {
      decision: 'lock',
      custody_status: 'release_trail_custody_locked',
      reason: 'trail_notarization_ready_for_custody_lock',
      can_retain_release_archive: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    custody_status: trailNotarizationReceipt?.notarization_status || 'missing_trail_notarization',
    reason: trailNotarizationReceipt?.reason || 'missing_final_delivery_command_trail_notarization_receipt',
    can_retain_release_archive: false,
    required_actions: ['record_trail_notarization_before_custody_lock']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustody(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const trailNotarizationReceipt = (bundle.bundle_final_delivery_command_trail_notarization_references || [])[0] || null;
  const custodyDecision = finalDeliveryCommandTrailCustodyDecision(trailNotarizationReceipt);
  const generatedAt = new Date().toISOString();
  const custody = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: custodyDecision.decision,
    custody_status: custodyDecision.custody_status,
    reason: custodyDecision.reason,
    can_retain_release_archive: Boolean(custodyDecision.can_retain_release_archive),
    explanation: custodyDecision.can_retain_release_archive
      ? 'Internal notarized release trail custody is locked for retention review; this is not external delivery authorization.'
      : 'Internal notarized release trail custody is blocked until trail notarization is recorded.',
    required_actions: custodyDecision.required_actions,
    trail_notarization_receipt: trailNotarizationReceipt
      ? {
          receipt_hash: trailNotarizationReceipt.receipt_hash,
          recorder: trailNotarizationReceipt.recorder,
          decision: trailNotarizationReceipt.decision,
          notarization_status: trailNotarizationReceipt.notarization_status,
          reason: trailNotarizationReceipt.reason,
          can_archive_release_trail: Boolean(trailNotarizationReceipt.can_archive_release_trail),
          command_closure_receipt_hash: trailNotarizationReceipt.command_closure_receipt_hash,
          command_revocation_receipt_hash: trailNotarizationReceipt.command_revocation_receipt_hash,
          command_escrow_receipt_hash: trailNotarizationReceipt.command_escrow_receipt_hash,
          sealed_handoff_review_receipt_hash: trailNotarizationReceipt.sealed_handoff_review_receipt_hash,
          readiness_seal_receipt_hash: trailNotarizationReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: trailNotarizationReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: trailNotarizationReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: trailNotarizationReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: trailNotarizationReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: trailNotarizationReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: trailNotarizationReceipt.lifecycle_review_receipt_hash,
          packet_hash: trailNotarizationReceipt.packet_hash,
          manifest_hash: trailNotarizationReceipt.manifest_hash,
          at: trailNotarizationReceipt.at || trailNotarizationReceipt.created_at || null
        }
      : null,
    command_closure_receipt: trailNotarizationReceipt?.command_closure_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.command_closure_receipt_hash }
      : null,
    command_revocation_receipt: trailNotarizationReceipt?.command_revocation_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.command_revocation_receipt_hash }
      : null,
    command_escrow_receipt: trailNotarizationReceipt?.command_escrow_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.command_escrow_receipt_hash }
      : null,
    sealed_handoff_review_receipt: trailNotarizationReceipt?.sealed_handoff_review_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.sealed_handoff_review_receipt_hash }
      : null,
    readiness_seal_receipt: trailNotarizationReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: trailNotarizationReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: trailNotarizationReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: trailNotarizationReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: trailNotarizationReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: trailNotarizationReceipt?.final_approval_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: trailNotarizationReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: trailNotarizationReceipt.lifecycle_review_receipt_hash }
      : null,
    custody_plan: {
      mode: 'internal_release_trail_custody_lock',
      retention_days: 365,
      archive_custody_locked: Boolean(custodyDecision.can_retain_release_archive),
      immutable_trail_notarization_receipt_hash: trailNotarizationReceipt?.receipt_hash || null,
      required_checks: [
        'trail_notarization_receipt_recorded',
        'release_archive_retention_window_confirmed',
        'external_delivery_disabled',
        'new_command_escrow_required_before_real_delivery'
      ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash
    },
    release_archive_review: {
      mode: 'internal_release_archive_custody_review',
      archive_reviewed: Boolean(custodyDecision.can_retain_release_archive),
      custody_is_not_delivery_authorization: true,
      requires_new_command_escrow_before_real_delivery: true,
      final_delivery_remains_disabled: true
    },
    custody_guard: {
      mode: 'internal_final_delivery_command_trail_custody_only',
      custody_is_internal_only: true,
      custody_is_not_delivery_authorization: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      trail_notarization_reference_count: bundle.bundle_final_delivery_command_trail_notarization_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_custody_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody'
  };
  custody.trail_custody_hash = digestValue(custody);
  return custody;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_receipt_recorder_required';
    throw error;
  }
  const custody = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustody(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: custody.filters || filters || {},
    trail_custody: {
      trail_custody_hash: custody.trail_custody_hash,
      generated_at: custody.generated_at,
      decision: custody.decision,
      custody_status: custody.custody_status,
      reason: custody.reason,
      can_retain_release_archive: Boolean(custody.can_retain_release_archive),
      explanation: custody.explanation,
      required_actions: custody.required_actions || []
    },
    trail_notarization_receipt: custody.trail_notarization_receipt,
    command_closure_receipt: custody.command_closure_receipt,
    command_revocation_receipt: custody.command_revocation_receipt,
    command_escrow_receipt: custody.command_escrow_receipt,
    sealed_handoff_review_receipt: custody.sealed_handoff_review_receipt,
    readiness_seal_receipt: custody.readiness_seal_receipt,
    dual_control_approval_receipt: custody.dual_control_approval_receipt,
    rehearsal_receipt: custody.rehearsal_receipt,
    dry_run_lock_receipt: custody.dry_run_lock_receipt,
    policy_gate_receipt: custody.policy_gate_receipt,
    final_approval_receipt: custody.final_approval_receipt,
    lifecycle_review_receipt: custody.lifecycle_review_receipt,
    custody_plan: custody.custody_plan,
    release_archive_review: custody.release_archive_review,
    custody_guard: custody.custody_guard,
    signed_bundle: custody.signed_bundle,
    execution_stub: custody.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailCustodyReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_custodies (
       receipt_hash, recorder_username, recorder_role, decision, custody_status, reason,
       can_retain_release_archive, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb, $23::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, custody_status, reason,
       can_retain_release_archive, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      custody.decision,
      custody.custody_status,
      custody.reason,
      Boolean(custody.can_retain_release_archive),
      custody.trail_notarization_receipt?.receipt_hash || null,
      custody.trail_notarization_receipt?.command_closure_receipt_hash || null,
      custody.trail_notarization_receipt?.command_revocation_receipt_hash || null,
      custody.trail_notarization_receipt?.command_escrow_receipt_hash || null,
      custody.trail_notarization_receipt?.sealed_handoff_review_receipt_hash || null,
      custody.trail_notarization_receipt?.readiness_seal_receipt_hash || null,
      custody.trail_notarization_receipt?.dual_control_approval_receipt_hash || null,
      custody.trail_notarization_receipt?.rehearsal_receipt_hash || null,
      custody.trail_notarization_receipt?.dry_run_lock_receipt_hash || null,
      custody.trail_notarization_receipt?.policy_gate_receipt_hash || null,
      custody.trail_notarization_receipt?.final_approval_receipt_hash || null,
      custody.trail_notarization_receipt?.lifecycle_review_receipt_hash || null,
      custody.custody_plan?.packet_hash || null,
      custody.custody_plan?.manifest_hash || null,
      JSON.stringify(custody.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailCustodyReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipts(
  { limit = 20, decision = '', custody_status: custodyStatus = '', can_retain_release_archive: canRetain = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['lock', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail custody receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (custodyStatus) {
    params.push(String(custodyStatus).trim().toLowerCase());
    where.push(`custody_status = $${params.length}`);
  }
  if (canRetain !== '' && canRetain !== undefined && canRetain !== null) {
    const normalizedCanRetain = ['true', '1', 'yes', true].includes(canRetain);
    params.push(normalizedCanRetain);
    where.push(`can_retain_release_archive = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, custody_status, reason,
       can_retain_release_archive, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custodies
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailCustodyReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, custody_status, reason,
       can_retain_release_archive, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custodies
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailCustodyReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailRetentionAttestationDecision(trailCustodyReceipt = null) {
  if (
    trailCustodyReceipt &&
    trailCustodyReceipt.decision === 'lock' &&
    trailCustodyReceipt.custody_status === 'release_trail_custody_locked' &&
    trailCustodyReceipt.can_retain_release_archive === true
  ) {
    return {
      decision: 'attest',
      attestation_status: 'release_archive_retention_attested',
      reason: 'trail_custody_ready_for_periodic_retention_attestation',
      can_continue_release_archive_retention: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    attestation_status: trailCustodyReceipt?.custody_status || 'missing_trail_custody',
    reason: trailCustodyReceipt?.reason || 'missing_final_delivery_command_trail_custody_receipt',
    can_continue_release_archive_retention: false,
    required_actions: ['record_trail_custody_before_retention_attestation']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestation(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail retention attestation actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const trailCustodyReceipt = (bundle.bundle_final_delivery_command_trail_custody_references || [])[0] || null;
  const attestationDecision = finalDeliveryCommandTrailRetentionAttestationDecision(trailCustodyReceipt);
  const generatedAt = new Date().toISOString();
  const nextReviewDueAt = new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const attestation = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: attestationDecision.decision,
    attestation_status: attestationDecision.attestation_status,
    reason: attestationDecision.reason,
    can_continue_release_archive_retention: Boolean(attestationDecision.can_continue_release_archive_retention),
    explanation: attestationDecision.can_continue_release_archive_retention
      ? 'Internal release archive retention is attested for periodic review; this is not external delivery authorization.'
      : 'Internal release archive retention attestation is blocked until trail custody is locked.',
    required_actions: attestationDecision.required_actions,
    trail_custody_receipt: trailCustodyReceipt
      ? {
          receipt_hash: trailCustodyReceipt.receipt_hash,
          recorder: trailCustodyReceipt.recorder,
          decision: trailCustodyReceipt.decision,
          custody_status: trailCustodyReceipt.custody_status,
          reason: trailCustodyReceipt.reason,
          can_retain_release_archive: Boolean(trailCustodyReceipt.can_retain_release_archive),
          trail_notarization_receipt_hash: trailCustodyReceipt.trail_notarization_receipt_hash,
          command_closure_receipt_hash: trailCustodyReceipt.command_closure_receipt_hash,
          command_revocation_receipt_hash: trailCustodyReceipt.command_revocation_receipt_hash,
          command_escrow_receipt_hash: trailCustodyReceipt.command_escrow_receipt_hash,
          sealed_handoff_review_receipt_hash: trailCustodyReceipt.sealed_handoff_review_receipt_hash,
          readiness_seal_receipt_hash: trailCustodyReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: trailCustodyReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: trailCustodyReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: trailCustodyReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: trailCustodyReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: trailCustodyReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: trailCustodyReceipt.lifecycle_review_receipt_hash,
          packet_hash: trailCustodyReceipt.packet_hash,
          manifest_hash: trailCustodyReceipt.manifest_hash,
          at: trailCustodyReceipt.at || trailCustodyReceipt.created_at || null
        }
      : null,
    trail_notarization_receipt: trailCustodyReceipt?.trail_notarization_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.trail_notarization_receipt_hash }
      : null,
    command_closure_receipt: trailCustodyReceipt?.command_closure_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.command_closure_receipt_hash }
      : null,
    command_revocation_receipt: trailCustodyReceipt?.command_revocation_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.command_revocation_receipt_hash }
      : null,
    command_escrow_receipt: trailCustodyReceipt?.command_escrow_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.command_escrow_receipt_hash }
      : null,
    sealed_handoff_review_receipt: trailCustodyReceipt?.sealed_handoff_review_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.sealed_handoff_review_receipt_hash }
      : null,
    readiness_seal_receipt: trailCustodyReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: trailCustodyReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: trailCustodyReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: trailCustodyReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: trailCustodyReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: trailCustodyReceipt?.final_approval_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: trailCustodyReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: trailCustodyReceipt.lifecycle_review_receipt_hash }
      : null,
    retention_review: {
      mode: 'internal_release_archive_periodic_retention_review',
      review_interval_days: 90,
      next_review_due_at: nextReviewDueAt,
      retention_days: 365,
      custody_receipt_hash: trailCustodyReceipt?.receipt_hash || null,
      retention_window_confirmed: Boolean(attestationDecision.can_continue_release_archive_retention),
      required_checks: [
        'trail_custody_receipt_locked',
        'retention_window_still_internal_only',
        'external_delivery_disabled',
        'new_command_escrow_required_before_real_delivery'
      ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash
    },
    archive_retention_attestation: {
      mode: 'internal_release_archive_retention_attestation',
      retention_attested: Boolean(attestationDecision.can_continue_release_archive_retention),
      retention_attestation_is_not_delivery_authorization: true,
      requires_new_command_escrow_before_real_delivery: true,
      final_delivery_remains_disabled: true
    },
    retention_guard: {
      mode: 'internal_final_delivery_command_trail_retention_attestation_only',
      retention_is_internal_only: true,
      retention_attestation_is_not_delivery_authorization: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      trail_custody_reference_count: bundle.bundle_final_delivery_command_trail_custody_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_retention_attestation_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation'
  };
  attestation.retention_attestation_hash = digestValue(attestation);
  return attestation;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail retention attestation receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_receipt_recorder_required';
    throw error;
  }
  const attestation = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestation(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: attestation.filters || filters || {},
    retention_attestation: {
      retention_attestation_hash: attestation.retention_attestation_hash,
      generated_at: attestation.generated_at,
      decision: attestation.decision,
      attestation_status: attestation.attestation_status,
      reason: attestation.reason,
      can_continue_release_archive_retention: Boolean(attestation.can_continue_release_archive_retention),
      explanation: attestation.explanation,
      required_actions: attestation.required_actions || []
    },
    trail_custody_receipt: attestation.trail_custody_receipt,
    trail_notarization_receipt: attestation.trail_notarization_receipt,
    command_closure_receipt: attestation.command_closure_receipt,
    command_revocation_receipt: attestation.command_revocation_receipt,
    command_escrow_receipt: attestation.command_escrow_receipt,
    sealed_handoff_review_receipt: attestation.sealed_handoff_review_receipt,
    readiness_seal_receipt: attestation.readiness_seal_receipt,
    dual_control_approval_receipt: attestation.dual_control_approval_receipt,
    rehearsal_receipt: attestation.rehearsal_receipt,
    dry_run_lock_receipt: attestation.dry_run_lock_receipt,
    policy_gate_receipt: attestation.policy_gate_receipt,
    final_approval_receipt: attestation.final_approval_receipt,
    lifecycle_review_receipt: attestation.lifecycle_review_receipt,
    retention_review: attestation.retention_review,
    archive_retention_attestation: attestation.archive_retention_attestation,
    retention_guard: attestation.retention_guard,
    signed_bundle: attestation.signed_bundle,
    execution_stub: attestation.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailRetentionAttestationReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_retention_attestations (
       receipt_hash, recorder_username, recorder_role, decision, attestation_status, reason,
       can_continue_release_archive_retention, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, next_review_due_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24::jsonb, $25::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, attestation_status, reason,
       can_continue_release_archive_retention, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, next_review_due_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      attestation.decision,
      attestation.attestation_status,
      attestation.reason,
      Boolean(attestation.can_continue_release_archive_retention),
      attestation.trail_custody_receipt?.receipt_hash || null,
      attestation.trail_custody_receipt?.trail_notarization_receipt_hash || null,
      attestation.trail_custody_receipt?.command_closure_receipt_hash || null,
      attestation.trail_custody_receipt?.command_revocation_receipt_hash || null,
      attestation.trail_custody_receipt?.command_escrow_receipt_hash || null,
      attestation.trail_custody_receipt?.sealed_handoff_review_receipt_hash || null,
      attestation.trail_custody_receipt?.readiness_seal_receipt_hash || null,
      attestation.trail_custody_receipt?.dual_control_approval_receipt_hash || null,
      attestation.trail_custody_receipt?.rehearsal_receipt_hash || null,
      attestation.trail_custody_receipt?.dry_run_lock_receipt_hash || null,
      attestation.trail_custody_receipt?.policy_gate_receipt_hash || null,
      attestation.trail_custody_receipt?.final_approval_receipt_hash || null,
      attestation.trail_custody_receipt?.lifecycle_review_receipt_hash || null,
      attestation.retention_review?.packet_hash || null,
      attestation.retention_review?.manifest_hash || null,
      attestation.retention_review?.next_review_due_at || null,
      JSON.stringify(attestation.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailRetentionAttestationReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipts(
  { limit = 20, decision = '', attestation_status: attestationStatus = '', can_continue_release_archive_retention: canContinue = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['attest', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail retention attestation receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (attestationStatus) {
    params.push(String(attestationStatus).trim().toLowerCase());
    where.push(`attestation_status = $${params.length}`);
  }
  if (canContinue !== '' && canContinue !== undefined && canContinue !== null) {
    const normalizedCanContinue = ['true', '1', 'yes', true].includes(canContinue);
    params.push(normalizedCanContinue);
    where.push(`can_continue_release_archive_retention = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR trail_custody_receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, attestation_status, reason,
       can_continue_release_archive_retention, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, next_review_due_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_retention_attestations
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailRetentionAttestationReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail retention attestation receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, attestation_status, reason,
       can_continue_release_archive_retention, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, next_review_due_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_retention_attestations
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail retention attestation receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailRetentionAttestationReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailRenewalWindowDecision(retentionAttestationReceipt = null) {
  if (
    retentionAttestationReceipt &&
    retentionAttestationReceipt.decision === 'attest' &&
    retentionAttestationReceipt.attestation_status === 'release_archive_retention_attested' &&
    retentionAttestationReceipt.can_continue_release_archive_retention === true
  ) {
    return {
      decision: 'renew',
      renewal_status: 'retention_renewal_window_scheduled',
      reason: 'retention_attestation_ready_for_renewal_window',
      can_schedule_next_retention_review: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    renewal_status: retentionAttestationReceipt?.attestation_status || 'missing_retention_attestation',
    reason: retentionAttestationReceipt?.reason || 'missing_final_delivery_command_trail_retention_attestation_receipt',
    can_schedule_next_retention_review: false,
    required_actions: ['record_retention_attestation_before_renewal_window']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindow(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal window actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const retentionAttestationReceipt = (bundle.bundle_final_delivery_command_trail_retention_attestation_references || [])[0] || null;
  const renewalDecision = finalDeliveryCommandTrailRenewalWindowDecision(retentionAttestationReceipt);
  const generatedAt = new Date().toISOString();
  const renewalWindowOpensAt = new Date(Date.parse(generatedAt) + 60 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = new Date(Date.parse(generatedAt) + 365 * 24 * 60 * 60 * 1000).toISOString();
  const nextReviewDueAt = new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const renewalWindow = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: renewalDecision.decision,
    renewal_status: renewalDecision.renewal_status,
    reason: renewalDecision.reason,
    can_schedule_next_retention_review: Boolean(renewalDecision.can_schedule_next_retention_review),
    explanation: renewalDecision.can_schedule_next_retention_review
      ? 'Internal release archive renewal window is scheduled; this is not external delivery authorization.'
      : 'Internal release archive renewal window is blocked until retention attestation is recorded.',
    required_actions: renewalDecision.required_actions,
    retention_attestation_receipt: retentionAttestationReceipt
      ? {
          receipt_hash: retentionAttestationReceipt.receipt_hash,
          recorder: retentionAttestationReceipt.recorder,
          decision: retentionAttestationReceipt.decision,
          attestation_status: retentionAttestationReceipt.attestation_status,
          reason: retentionAttestationReceipt.reason,
          can_continue_release_archive_retention: Boolean(retentionAttestationReceipt.can_continue_release_archive_retention),
          trail_custody_receipt_hash: retentionAttestationReceipt.trail_custody_receipt_hash,
          trail_notarization_receipt_hash: retentionAttestationReceipt.trail_notarization_receipt_hash,
          command_closure_receipt_hash: retentionAttestationReceipt.command_closure_receipt_hash,
          command_revocation_receipt_hash: retentionAttestationReceipt.command_revocation_receipt_hash,
          command_escrow_receipt_hash: retentionAttestationReceipt.command_escrow_receipt_hash,
          sealed_handoff_review_receipt_hash: retentionAttestationReceipt.sealed_handoff_review_receipt_hash,
          readiness_seal_receipt_hash: retentionAttestationReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: retentionAttestationReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: retentionAttestationReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: retentionAttestationReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: retentionAttestationReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: retentionAttestationReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: retentionAttestationReceipt.lifecycle_review_receipt_hash,
          packet_hash: retentionAttestationReceipt.packet_hash,
          manifest_hash: retentionAttestationReceipt.manifest_hash,
          next_review_due_at: retentionAttestationReceipt.next_review_due_at,
          at: retentionAttestationReceipt.at || retentionAttestationReceipt.created_at || null
        }
      : null,
    trail_custody_receipt: retentionAttestationReceipt?.trail_custody_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.trail_custody_receipt_hash }
      : null,
    trail_notarization_receipt: retentionAttestationReceipt?.trail_notarization_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.trail_notarization_receipt_hash }
      : null,
    command_closure_receipt: retentionAttestationReceipt?.command_closure_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.command_closure_receipt_hash }
      : null,
    command_revocation_receipt: retentionAttestationReceipt?.command_revocation_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.command_revocation_receipt_hash }
      : null,
    command_escrow_receipt: retentionAttestationReceipt?.command_escrow_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.command_escrow_receipt_hash }
      : null,
    sealed_handoff_review_receipt: retentionAttestationReceipt?.sealed_handoff_review_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.sealed_handoff_review_receipt_hash }
      : null,
    readiness_seal_receipt: retentionAttestationReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: retentionAttestationReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: retentionAttestationReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: retentionAttestationReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: retentionAttestationReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: retentionAttestationReceipt?.final_approval_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: retentionAttestationReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: retentionAttestationReceipt.lifecycle_review_receipt_hash }
      : null,
    renewal_window: {
      mode: 'internal_release_archive_renewal_window',
      retention_attestation_receipt_hash: retentionAttestationReceipt?.receipt_hash || null,
      renewal_window_opens_at: renewalWindowOpensAt,
      expires_at: expiresAt,
      next_review_due_at: nextReviewDueAt,
      renewal_notice_days: 30,
      review_interval_days: 90,
      archive_retention_days: 365,
      renewal_window_confirmed: Boolean(renewalDecision.can_schedule_next_retention_review),
      required_checks: [
        'retention_attestation_recorded',
        'archive_not_expired',
        'renewal_window_internal_only',
        'external_delivery_disabled',
        'new_command_escrow_required_before_real_delivery'
      ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash
    },
    archive_expiry_guard: {
      mode: 'internal_archive_expiry_guard',
      archive_expires_at: expiresAt,
      renewal_required_before_expiry: true,
      expiry_guard_is_not_delivery_authorization: true,
      final_delivery_remains_disabled: true
    },
    renewal_guard: {
      mode: 'internal_final_delivery_command_trail_renewal_window_only',
      renewal_is_internal_only: true,
      renewal_window_is_not_delivery_authorization: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      retention_attestation_reference_count: bundle.bundle_final_delivery_command_trail_retention_attestation_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_renewal_window_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window'
  };
  renewalWindow.renewal_window_hash = digestValue(renewalWindow);
  return renewalWindow;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal window receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_receipt_recorder_required';
    throw error;
  }
  const renewalWindow = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindow(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: renewalWindow.filters || filters || {},
    renewal_window: {
      renewal_window_hash: renewalWindow.renewal_window_hash,
      generated_at: renewalWindow.generated_at,
      decision: renewalWindow.decision,
      renewal_status: renewalWindow.renewal_status,
      reason: renewalWindow.reason,
      can_schedule_next_retention_review: Boolean(renewalWindow.can_schedule_next_retention_review),
      explanation: renewalWindow.explanation,
      required_actions: renewalWindow.required_actions || []
    },
    retention_attestation_receipt: renewalWindow.retention_attestation_receipt,
    trail_custody_receipt: renewalWindow.trail_custody_receipt,
    trail_notarization_receipt: renewalWindow.trail_notarization_receipt,
    command_closure_receipt: renewalWindow.command_closure_receipt,
    command_revocation_receipt: renewalWindow.command_revocation_receipt,
    command_escrow_receipt: renewalWindow.command_escrow_receipt,
    sealed_handoff_review_receipt: renewalWindow.sealed_handoff_review_receipt,
    readiness_seal_receipt: renewalWindow.readiness_seal_receipt,
    dual_control_approval_receipt: renewalWindow.dual_control_approval_receipt,
    rehearsal_receipt: renewalWindow.rehearsal_receipt,
    dry_run_lock_receipt: renewalWindow.dry_run_lock_receipt,
    policy_gate_receipt: renewalWindow.policy_gate_receipt,
    final_approval_receipt: renewalWindow.final_approval_receipt,
    lifecycle_review_receipt: renewalWindow.lifecycle_review_receipt,
    renewal_window_plan: renewalWindow.renewal_window,
    archive_expiry_guard: renewalWindow.archive_expiry_guard,
    renewal_guard: renewalWindow.renewal_guard,
    signed_bundle: renewalWindow.signed_bundle,
    execution_stub: renewalWindow.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailRenewalWindowReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_renewals (
       receipt_hash, recorder_username, recorder_role, decision, renewal_status, reason,
       can_schedule_next_retention_review, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, renewal_window_opens_at, expires_at, next_review_due_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27::jsonb, $28::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, renewal_status, reason,
       can_schedule_next_retention_review, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, renewal_window_opens_at, expires_at, next_review_due_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      renewalWindow.decision,
      renewalWindow.renewal_status,
      renewalWindow.reason,
      Boolean(renewalWindow.can_schedule_next_retention_review),
      renewalWindow.retention_attestation_receipt?.receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.trail_custody_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.trail_notarization_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.command_closure_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.command_revocation_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.command_escrow_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.sealed_handoff_review_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.readiness_seal_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.dual_control_approval_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.rehearsal_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.dry_run_lock_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.policy_gate_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.final_approval_receipt_hash || null,
      renewalWindow.retention_attestation_receipt?.lifecycle_review_receipt_hash || null,
      renewalWindow.renewal_window?.packet_hash || null,
      renewalWindow.renewal_window?.manifest_hash || null,
      renewalWindow.renewal_window?.renewal_window_opens_at || null,
      renewalWindow.renewal_window?.expires_at || null,
      renewalWindow.renewal_window?.next_review_due_at || null,
      JSON.stringify(renewalWindow.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailRenewalWindowReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipts(
  { limit = 20, decision = '', renewal_status: renewalStatus = '', can_schedule_next_retention_review: canSchedule = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['renew', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail renewal window receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (renewalStatus) {
    params.push(String(renewalStatus).trim().toLowerCase());
    where.push(`renewal_status = $${params.length}`);
  }
  if (canSchedule !== '' && canSchedule !== undefined && canSchedule !== null) {
    const normalizedCanSchedule = ['true', '1', 'yes', true].includes(canSchedule);
    params.push(normalizedCanSchedule);
    where.push(`can_schedule_next_retention_review = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR retention_attestation_receipt_hash ILIKE $${params.length} OR trail_custody_receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, renewal_status, reason,
       can_schedule_next_retention_review, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, renewal_window_opens_at, expires_at, next_review_due_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_renewals
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailRenewalWindowReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal window receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, renewal_status, reason,
       can_schedule_next_retention_review, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, renewal_window_opens_at, expires_at, next_review_due_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_renewals
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal window receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailRenewalWindowReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailRenewalConfirmationDecision(renewalWindowReceipt = null) {
  if (
    renewalWindowReceipt &&
    renewalWindowReceipt.decision === 'renew' &&
    renewalWindowReceipt.renewal_status === 'retention_renewal_window_scheduled' &&
    renewalWindowReceipt.can_schedule_next_retention_review === true
  ) {
    return {
      decision: 'confirm',
      confirmation_status: 'archive_renewal_checkpoint_confirmed',
      reason: 'renewal_window_ready_for_archive_checkpoint',
      can_continue_archive_renewal: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    confirmation_status: renewalWindowReceipt?.renewal_status || 'missing_renewal_window',
    reason: renewalWindowReceipt?.reason || 'missing_final_delivery_command_trail_renewal_window_receipt',
    can_continue_archive_renewal: false,
    required_actions: ['record_renewal_window_before_archive_checkpoint']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmation(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal confirmation actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const renewalWindowReceipt = (bundle.bundle_final_delivery_command_trail_renewal_window_references || [])[0] || null;
  const confirmationDecision = finalDeliveryCommandTrailRenewalConfirmationDecision(renewalWindowReceipt);
  const generatedAt = new Date().toISOString();
  const checkpointAt = generatedAt;
  const nextReviewDueAt = renewalWindowReceipt?.next_review_due_at || new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = renewalWindowReceipt?.expires_at || new Date(Date.parse(generatedAt) + 365 * 24 * 60 * 60 * 1000).toISOString();
  const renewalConfirmation = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: confirmationDecision.decision,
    confirmation_status: confirmationDecision.confirmation_status,
    reason: confirmationDecision.reason,
    can_continue_archive_renewal: Boolean(confirmationDecision.can_continue_archive_renewal),
    explanation: confirmationDecision.can_continue_archive_renewal
      ? 'Internal release archive renewal checkpoint is confirmed; this is not external delivery authorization.'
      : 'Internal release archive renewal checkpoint is blocked until renewal window is recorded.',
    required_actions: confirmationDecision.required_actions,
    renewal_window_receipt: renewalWindowReceipt
      ? {
          receipt_hash: renewalWindowReceipt.receipt_hash,
          recorder: renewalWindowReceipt.recorder,
          decision: renewalWindowReceipt.decision,
          renewal_status: renewalWindowReceipt.renewal_status,
          reason: renewalWindowReceipt.reason,
          can_schedule_next_retention_review: Boolean(renewalWindowReceipt.can_schedule_next_retention_review),
          retention_attestation_receipt_hash: renewalWindowReceipt.retention_attestation_receipt_hash,
          trail_custody_receipt_hash: renewalWindowReceipt.trail_custody_receipt_hash,
          trail_notarization_receipt_hash: renewalWindowReceipt.trail_notarization_receipt_hash,
          command_closure_receipt_hash: renewalWindowReceipt.command_closure_receipt_hash,
          command_revocation_receipt_hash: renewalWindowReceipt.command_revocation_receipt_hash,
          command_escrow_receipt_hash: renewalWindowReceipt.command_escrow_receipt_hash,
          sealed_handoff_review_receipt_hash: renewalWindowReceipt.sealed_handoff_review_receipt_hash,
          readiness_seal_receipt_hash: renewalWindowReceipt.readiness_seal_receipt_hash,
          dual_control_approval_receipt_hash: renewalWindowReceipt.dual_control_approval_receipt_hash,
          rehearsal_receipt_hash: renewalWindowReceipt.rehearsal_receipt_hash,
          dry_run_lock_receipt_hash: renewalWindowReceipt.dry_run_lock_receipt_hash,
          policy_gate_receipt_hash: renewalWindowReceipt.policy_gate_receipt_hash,
          final_approval_receipt_hash: renewalWindowReceipt.final_approval_receipt_hash,
          lifecycle_review_receipt_hash: renewalWindowReceipt.lifecycle_review_receipt_hash,
          packet_hash: renewalWindowReceipt.packet_hash,
          manifest_hash: renewalWindowReceipt.manifest_hash,
          renewal_window_opens_at: renewalWindowReceipt.renewal_window_opens_at,
          expires_at: renewalWindowReceipt.expires_at,
          next_review_due_at: renewalWindowReceipt.next_review_due_at,
          at: renewalWindowReceipt.at || renewalWindowReceipt.created_at || null
        }
      : null,
    retention_attestation_receipt: renewalWindowReceipt?.retention_attestation_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.retention_attestation_receipt_hash }
      : null,
    trail_custody_receipt: renewalWindowReceipt?.trail_custody_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.trail_custody_receipt_hash }
      : null,
    trail_notarization_receipt: renewalWindowReceipt?.trail_notarization_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.trail_notarization_receipt_hash }
      : null,
    command_closure_receipt: renewalWindowReceipt?.command_closure_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.command_closure_receipt_hash }
      : null,
    command_revocation_receipt: renewalWindowReceipt?.command_revocation_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.command_revocation_receipt_hash }
      : null,
    command_escrow_receipt: renewalWindowReceipt?.command_escrow_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.command_escrow_receipt_hash }
      : null,
    sealed_handoff_review_receipt: renewalWindowReceipt?.sealed_handoff_review_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.sealed_handoff_review_receipt_hash }
      : null,
    readiness_seal_receipt: renewalWindowReceipt?.readiness_seal_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.readiness_seal_receipt_hash }
      : null,
    dual_control_approval_receipt: renewalWindowReceipt?.dual_control_approval_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.dual_control_approval_receipt_hash }
      : null,
    rehearsal_receipt: renewalWindowReceipt?.rehearsal_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.rehearsal_receipt_hash }
      : null,
    dry_run_lock_receipt: renewalWindowReceipt?.dry_run_lock_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.dry_run_lock_receipt_hash }
      : null,
    policy_gate_receipt: renewalWindowReceipt?.policy_gate_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.policy_gate_receipt_hash }
      : null,
    final_approval_receipt: renewalWindowReceipt?.final_approval_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.final_approval_receipt_hash }
      : null,
    lifecycle_review_receipt: renewalWindowReceipt?.lifecycle_review_receipt_hash
      ? { receipt_hash: renewalWindowReceipt.lifecycle_review_receipt_hash }
      : null,
    archive_renewal_checkpoint: {
      mode: 'internal_release_archive_renewal_checkpoint',
      renewal_window_receipt_hash: renewalWindowReceipt?.receipt_hash || null,
      checkpoint_at: checkpointAt,
      renewal_window_opens_at: renewalWindowReceipt?.renewal_window_opens_at || null,
      next_review_due_at: nextReviewDueAt,
      expires_at: expiresAt,
      archive_checkpoint_confirmed: Boolean(confirmationDecision.can_continue_archive_renewal),
      required_checks: [
        'renewal_window_recorded',
        'archive_not_expired',
        'checkpoint_internal_only',
        'external_delivery_disabled',
        'new_command_escrow_required_before_real_delivery'
      ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash
    },
    renewal_confirmation_guard: {
      mode: 'internal_archive_renewal_checkpoint_guard',
      confirmation_is_internal_only: true,
      checkpoint_is_not_delivery_authorization: true,
      final_delivery_remains_disabled: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      renewal_window_reference_count: bundle.bundle_final_delivery_command_trail_renewal_window_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_renewal_confirmation_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation'
  };
  renewalConfirmation.renewal_confirmation_hash = digestValue(renewalConfirmation);
  return renewalConfirmation;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal confirmation receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_receipt_recorder_required';
    throw error;
  }
  const confirmation = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmation(
    { filters, actor: recorder, signing_secret: signingSecret },
    client
  );
  const recordedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-receipt-v1',
    recorded_at: recordedAt,
    recorder: `${recorder.username}:${recorder.role}`,
    filters: confirmation.filters || filters || {},
    renewal_confirmation: {
      renewal_confirmation_hash: confirmation.renewal_confirmation_hash,
      generated_at: confirmation.generated_at,
      decision: confirmation.decision,
      confirmation_status: confirmation.confirmation_status,
      reason: confirmation.reason,
      can_continue_archive_renewal: Boolean(confirmation.can_continue_archive_renewal),
      explanation: confirmation.explanation,
      required_actions: confirmation.required_actions || []
    },
    renewal_window_receipt: confirmation.renewal_window_receipt,
    retention_attestation_receipt: confirmation.retention_attestation_receipt,
    trail_custody_receipt: confirmation.trail_custody_receipt,
    trail_notarization_receipt: confirmation.trail_notarization_receipt,
    command_closure_receipt: confirmation.command_closure_receipt,
    command_revocation_receipt: confirmation.command_revocation_receipt,
    command_escrow_receipt: confirmation.command_escrow_receipt,
    sealed_handoff_review_receipt: confirmation.sealed_handoff_review_receipt,
    readiness_seal_receipt: confirmation.readiness_seal_receipt,
    dual_control_approval_receipt: confirmation.dual_control_approval_receipt,
    rehearsal_receipt: confirmation.rehearsal_receipt,
    dry_run_lock_receipt: confirmation.dry_run_lock_receipt,
    policy_gate_receipt: confirmation.policy_gate_receipt,
    final_approval_receipt: confirmation.final_approval_receipt,
    lifecycle_review_receipt: confirmation.lifecycle_review_receipt,
    archive_renewal_checkpoint: confirmation.archive_renewal_checkpoint,
    renewal_confirmation_guard: confirmation.renewal_confirmation_guard,
    signed_bundle: confirmation.signed_bundle,
    execution_stub: confirmation.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailRenewalConfirmationReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_renewal_confirmations (
       receipt_hash, recorder_username, recorder_role, decision, confirmation_status, reason,
       can_continue_archive_renewal, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, renewal_window_opens_at,
       checkpoint_at, next_review_due_at, expires_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29::jsonb, $30::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, confirmation_status, reason,
       can_continue_archive_renewal, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, renewal_window_opens_at,
       checkpoint_at, next_review_due_at, expires_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      confirmation.decision,
      confirmation.confirmation_status,
      confirmation.reason,
      Boolean(confirmation.can_continue_archive_renewal),
      confirmation.renewal_window_receipt?.receipt_hash || null,
      confirmation.renewal_window_receipt?.retention_attestation_receipt_hash || null,
      confirmation.renewal_window_receipt?.trail_custody_receipt_hash || null,
      confirmation.renewal_window_receipt?.trail_notarization_receipt_hash || null,
      confirmation.renewal_window_receipt?.command_closure_receipt_hash || null,
      confirmation.renewal_window_receipt?.command_revocation_receipt_hash || null,
      confirmation.renewal_window_receipt?.command_escrow_receipt_hash || null,
      confirmation.renewal_window_receipt?.sealed_handoff_review_receipt_hash || null,
      confirmation.renewal_window_receipt?.readiness_seal_receipt_hash || null,
      confirmation.renewal_window_receipt?.dual_control_approval_receipt_hash || null,
      confirmation.renewal_window_receipt?.rehearsal_receipt_hash || null,
      confirmation.renewal_window_receipt?.dry_run_lock_receipt_hash || null,
      confirmation.renewal_window_receipt?.policy_gate_receipt_hash || null,
      confirmation.renewal_window_receipt?.final_approval_receipt_hash || null,
      confirmation.renewal_window_receipt?.lifecycle_review_receipt_hash || null,
      confirmation.archive_renewal_checkpoint?.packet_hash || null,
      confirmation.archive_renewal_checkpoint?.manifest_hash || null,
      confirmation.archive_renewal_checkpoint?.renewal_window_opens_at || null,
      confirmation.archive_renewal_checkpoint?.checkpoint_at || null,
      confirmation.archive_renewal_checkpoint?.next_review_due_at || null,
      confirmation.archive_renewal_checkpoint?.expires_at || null,
      JSON.stringify(confirmation.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts(
  { limit = 20, decision = '', confirmation_status: confirmationStatus = '', can_continue_archive_renewal: canContinue = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['confirm', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail renewal confirmation receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (confirmationStatus) {
    params.push(String(confirmationStatus).trim().toLowerCase());
    where.push(`confirmation_status = $${params.length}`);
  }
  if (canContinue !== '' && canContinue !== undefined && canContinue !== null) {
    const normalizedCanContinue = ['true', '1', 'yes', true].includes(canContinue);
    params.push(normalizedCanContinue);
    where.push(`can_continue_archive_renewal = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR renewal_window_receipt_hash ILIKE $${params.length} OR retention_attestation_receipt_hash ILIKE $${params.length} OR trail_custody_receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, confirmation_status, reason,
       can_continue_archive_renewal, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, renewal_window_opens_at,
       checkpoint_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_renewal_confirmations
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal confirmation receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, confirmation_status, reason,
       can_continue_archive_renewal, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, renewal_window_opens_at,
       checkpoint_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_renewal_confirmations
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail renewal confirmation receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt(result.rows[0]);
}


function finalDeliveryCommandTrailCheckpointSealDecision(renewalConfirmationReceipt = null) {
  if (
    renewalConfirmationReceipt &&
    renewalConfirmationReceipt.decision === 'confirm' &&
    renewalConfirmationReceipt.confirmation_status === 'archive_renewal_checkpoint_confirmed' &&
    renewalConfirmationReceipt.can_continue_archive_renewal === true
  ) {
    return {
      decision: 'seal',
      seal_status: 'archive_checkpoint_frozen',
      reason: 'renewal_confirmation_ready_for_checkpoint_seal',
      can_freeze_archive_checkpoint: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    seal_status: renewalConfirmationReceipt?.confirmation_status || 'missing_renewal_confirmation',
    reason: renewalConfirmationReceipt?.reason || 'missing_final_delivery_command_trail_renewal_confirmation_receipt',
    can_freeze_archive_checkpoint: false,
    required_actions: ['record_renewal_confirmation_before_checkpoint_seal']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSeal(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail checkpoint seal actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const renewalConfirmationReceipt = (bundle.bundle_final_delivery_command_trail_renewal_confirmation_references || [])[0] || null;
  const sealDecision = finalDeliveryCommandTrailCheckpointSealDecision(renewalConfirmationReceipt);
  const generatedAt = new Date().toISOString();
  const frozenAt = generatedAt;
  const checkpointAt = renewalConfirmationReceipt?.checkpoint_at || generatedAt;
  const nextReviewDueAt = renewalConfirmationReceipt?.next_review_due_at || new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = renewalConfirmationReceipt?.expires_at || new Date(Date.parse(generatedAt) + 365 * 24 * 60 * 60 * 1000).toISOString();
  const checkpointSeal = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: sealDecision.decision,
    seal_status: sealDecision.seal_status,
    reason: sealDecision.reason,
    can_freeze_archive_checkpoint: Boolean(sealDecision.can_freeze_archive_checkpoint),
    explanation: sealDecision.can_freeze_archive_checkpoint
      ? 'Internal release archive checkpoint is frozen under a checkpoint seal; this is not external delivery authorization.'
      : 'Internal release archive checkpoint seal is blocked until a confirmed renewal checkpoint receipt is recorded.',
    required_actions: sealDecision.required_actions,
    renewal_confirmation_receipt: renewalConfirmationReceipt ? { ...renewalConfirmationReceipt } : null,
    renewal_window_receipt: renewalConfirmationReceipt?.renewal_window_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.renewal_window_receipt_hash } : null,
    retention_attestation_receipt: renewalConfirmationReceipt?.retention_attestation_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.retention_attestation_receipt_hash } : null,
    trail_custody_receipt: renewalConfirmationReceipt?.trail_custody_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.trail_custody_receipt_hash } : null,
    trail_notarization_receipt: renewalConfirmationReceipt?.trail_notarization_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.trail_notarization_receipt_hash } : null,
    command_closure_receipt: renewalConfirmationReceipt?.command_closure_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.command_closure_receipt_hash } : null,
    command_revocation_receipt: renewalConfirmationReceipt?.command_revocation_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.command_revocation_receipt_hash } : null,
    command_escrow_receipt: renewalConfirmationReceipt?.command_escrow_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.command_escrow_receipt_hash } : null,
    sealed_handoff_review_receipt: renewalConfirmationReceipt?.sealed_handoff_review_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.sealed_handoff_review_receipt_hash } : null,
    readiness_seal_receipt: renewalConfirmationReceipt?.readiness_seal_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.readiness_seal_receipt_hash } : null,
    dual_control_approval_receipt: renewalConfirmationReceipt?.dual_control_approval_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.dual_control_approval_receipt_hash } : null,
    rehearsal_receipt: renewalConfirmationReceipt?.rehearsal_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.rehearsal_receipt_hash } : null,
    dry_run_lock_receipt: renewalConfirmationReceipt?.dry_run_lock_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.dry_run_lock_receipt_hash } : null,
    policy_gate_receipt: renewalConfirmationReceipt?.policy_gate_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.policy_gate_receipt_hash } : null,
    final_approval_receipt: renewalConfirmationReceipt?.final_approval_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.final_approval_receipt_hash } : null,
    lifecycle_review_receipt: renewalConfirmationReceipt?.lifecycle_review_receipt_hash ? { receipt_hash: renewalConfirmationReceipt.lifecycle_review_receipt_hash } : null,
    archive_checkpoint_freeze: {
      mode: 'internal_release_archive_checkpoint_freeze',
      renewal_confirmation_receipt_hash: renewalConfirmationReceipt?.receipt_hash || null,
      renewal_window_receipt_hash: renewalConfirmationReceipt?.renewal_window_receipt_hash || null,
      checkpoint_at: checkpointAt,
      frozen_at: frozenAt,
      next_review_due_at: nextReviewDueAt,
      expires_at: expiresAt,
      archive_checkpoint_frozen: Boolean(sealDecision.can_freeze_archive_checkpoint),
      required_checks: [
        'renewal_confirmation_recorded',
        'archive_checkpoint_confirmed',
        'checkpoint_freeze_internal_only',
        'external_delivery_disabled',
        'new_command_escrow_required_before_real_delivery'
      ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash
    },
    checkpoint_seal_guard: {
      mode: 'internal_archive_checkpoint_seal_guard',
      checkpoint_seal_is_internal_only: true,
      checkpoint_freeze_is_not_delivery_authorization: true,
      final_delivery_remains_disabled: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      renewal_confirmation_reference_count: bundle.bundle_final_delivery_command_trail_renewal_confirmation_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_checkpoint_seal_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal'
  };
  checkpointSeal.checkpoint_seal_hash = digestValue(checkpointSeal);
  return checkpointSeal;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail checkpoint seal receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_receipt_recorder_required';
    throw error;
  }
  const seal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSeal({ filters, actor: recorder, signing_secret: signingSecret }, client);
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-receipt-v1',
    recorded_at: new Date().toISOString(),
    recorder: `${recorder.username}:${recorder.role}`,
    filters: seal.filters || filters || {},
    checkpoint_seal: {
      checkpoint_seal_hash: seal.checkpoint_seal_hash,
      generated_at: seal.generated_at,
      decision: seal.decision,
      seal_status: seal.seal_status,
      reason: seal.reason,
      can_freeze_archive_checkpoint: Boolean(seal.can_freeze_archive_checkpoint),
      explanation: seal.explanation,
      required_actions: seal.required_actions || []
    },
    renewal_confirmation_receipt: seal.renewal_confirmation_receipt,
    renewal_window_receipt: seal.renewal_window_receipt,
    retention_attestation_receipt: seal.retention_attestation_receipt,
    trail_custody_receipt: seal.trail_custody_receipt,
    trail_notarization_receipt: seal.trail_notarization_receipt,
    command_closure_receipt: seal.command_closure_receipt,
    command_revocation_receipt: seal.command_revocation_receipt,
    command_escrow_receipt: seal.command_escrow_receipt,
    sealed_handoff_review_receipt: seal.sealed_handoff_review_receipt,
    readiness_seal_receipt: seal.readiness_seal_receipt,
    dual_control_approval_receipt: seal.dual_control_approval_receipt,
    rehearsal_receipt: seal.rehearsal_receipt,
    dry_run_lock_receipt: seal.dry_run_lock_receipt,
    policy_gate_receipt: seal.policy_gate_receipt,
    final_approval_receipt: seal.final_approval_receipt,
    lifecycle_review_receipt: seal.lifecycle_review_receipt,
    archive_checkpoint_freeze: seal.archive_checkpoint_freeze,
    checkpoint_seal_guard: seal.checkpoint_seal_guard,
    signed_bundle: seal.signed_bundle,
    execution_stub: seal.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailCheckpointSealReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_checkpoint_seals (
       receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_freeze_archive_checkpoint, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, checkpoint_at, frozen_at,
       next_review_due_at, expires_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30::jsonb, $31::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_freeze_archive_checkpoint, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, checkpoint_at, frozen_at,
       next_review_due_at, expires_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      seal.decision,
      seal.seal_status,
      seal.reason,
      Boolean(seal.can_freeze_archive_checkpoint),
      seal.renewal_confirmation_receipt?.receipt_hash || null,
      seal.renewal_confirmation_receipt?.renewal_window_receipt_hash || null,
      seal.renewal_confirmation_receipt?.retention_attestation_receipt_hash || null,
      seal.renewal_confirmation_receipt?.trail_custody_receipt_hash || null,
      seal.renewal_confirmation_receipt?.trail_notarization_receipt_hash || null,
      seal.renewal_confirmation_receipt?.command_closure_receipt_hash || null,
      seal.renewal_confirmation_receipt?.command_revocation_receipt_hash || null,
      seal.renewal_confirmation_receipt?.command_escrow_receipt_hash || null,
      seal.renewal_confirmation_receipt?.sealed_handoff_review_receipt_hash || null,
      seal.renewal_confirmation_receipt?.readiness_seal_receipt_hash || null,
      seal.renewal_confirmation_receipt?.dual_control_approval_receipt_hash || null,
      seal.renewal_confirmation_receipt?.rehearsal_receipt_hash || null,
      seal.renewal_confirmation_receipt?.dry_run_lock_receipt_hash || null,
      seal.renewal_confirmation_receipt?.policy_gate_receipt_hash || null,
      seal.renewal_confirmation_receipt?.final_approval_receipt_hash || null,
      seal.renewal_confirmation_receipt?.lifecycle_review_receipt_hash || null,
      seal.archive_checkpoint_freeze?.packet_hash || null,
      seal.archive_checkpoint_freeze?.manifest_hash || null,
      seal.archive_checkpoint_freeze?.checkpoint_at || null,
      seal.archive_checkpoint_freeze?.frozen_at || null,
      seal.archive_checkpoint_freeze?.next_review_due_at || null,
      seal.archive_checkpoint_freeze?.expires_at || null,
      JSON.stringify(seal.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailCheckpointSealReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipts(
  { limit = 20, decision = '', seal_status: sealStatus = '', can_freeze_archive_checkpoint: canFreeze = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['seal', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail checkpoint seal receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (sealStatus) {
    params.push(String(sealStatus).trim().toLowerCase());
    where.push(`seal_status = $${params.length}`);
  }
  if (canFreeze !== '' && canFreeze !== undefined && canFreeze !== null) {
    params.push(['true', '1', 'yes', true].includes(canFreeze));
    where.push(`can_freeze_archive_checkpoint = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR renewal_confirmation_receipt_hash ILIKE $${params.length} OR renewal_window_receipt_hash ILIKE $${params.length} OR retention_attestation_receipt_hash ILIKE $${params.length} OR trail_custody_receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_freeze_archive_checkpoint, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, checkpoint_at, frozen_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_checkpoint_seals
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailCheckpointSealReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail checkpoint seal receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_freeze_archive_checkpoint, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, checkpoint_at, frozen_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_checkpoint_seals
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail checkpoint seal receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailCheckpointSealReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailCustodyHandoffDecision(checkpointSealReceipt = null) {
  if (
    checkpointSealReceipt &&
    checkpointSealReceipt.decision === 'seal' &&
    checkpointSealReceipt.seal_status === 'archive_checkpoint_frozen' &&
    checkpointSealReceipt.can_freeze_archive_checkpoint === true
  ) {
    return {
      decision: 'handoff',
      handoff_status: 'archive_custody_transferred',
      reason: 'checkpoint_seal_ready_for_custody_handoff',
      can_transfer_archive_custody: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    handoff_status: checkpointSealReceipt?.seal_status || 'missing_checkpoint_seal',
    reason: checkpointSealReceipt?.reason || 'missing_final_delivery_command_trail_checkpoint_seal_receipt',
    can_transfer_archive_custody: false,
    required_actions: ['record_checkpoint_seal_before_custody_handoff']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoff(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody handoff actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const checkpointSealReceipt = (bundle.bundle_final_delivery_command_trail_checkpoint_seal_references || [])[0] || null;
  const handoffDecision = finalDeliveryCommandTrailCustodyHandoffDecision(checkpointSealReceipt);
  const generatedAt = new Date().toISOString();
  const custodyHandoffAt = generatedAt;
  const checkpointAt = checkpointSealReceipt?.checkpoint_at || generatedAt;
  const frozenAt = checkpointSealReceipt?.frozen_at || generatedAt;
  const nextReviewDueAt = checkpointSealReceipt?.next_review_due_at || new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = checkpointSealReceipt?.expires_at || new Date(Date.parse(generatedAt) + 365 * 24 * 60 * 60 * 1000).toISOString();
  const custodyHandoff = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: handoffDecision.decision,
    handoff_status: handoffDecision.handoff_status,
    reason: handoffDecision.reason,
    can_transfer_archive_custody: Boolean(handoffDecision.can_transfer_archive_custody),
    explanation: handoffDecision.can_transfer_archive_custody
      ? 'Internal release archive freeze custody is handed off for retained archive operations; this is not external delivery authorization.'
      : 'Internal release archive freeze custody handoff is blocked until a checkpoint seal receipt is recorded.',
    required_actions: handoffDecision.required_actions,
    checkpoint_seal_receipt: checkpointSealReceipt ? { ...checkpointSealReceipt } : null,
    renewal_confirmation_receipt: checkpointSealReceipt?.renewal_confirmation_receipt_hash ? { receipt_hash: checkpointSealReceipt.renewal_confirmation_receipt_hash } : null,
    renewal_window_receipt: checkpointSealReceipt?.renewal_window_receipt_hash ? { receipt_hash: checkpointSealReceipt.renewal_window_receipt_hash } : null,
    retention_attestation_receipt: checkpointSealReceipt?.retention_attestation_receipt_hash ? { receipt_hash: checkpointSealReceipt.retention_attestation_receipt_hash } : null,
    trail_custody_receipt: checkpointSealReceipt?.trail_custody_receipt_hash ? { receipt_hash: checkpointSealReceipt.trail_custody_receipt_hash } : null,
    trail_notarization_receipt: checkpointSealReceipt?.trail_notarization_receipt_hash ? { receipt_hash: checkpointSealReceipt.trail_notarization_receipt_hash } : null,
    command_closure_receipt: checkpointSealReceipt?.command_closure_receipt_hash ? { receipt_hash: checkpointSealReceipt.command_closure_receipt_hash } : null,
    command_revocation_receipt: checkpointSealReceipt?.command_revocation_receipt_hash ? { receipt_hash: checkpointSealReceipt.command_revocation_receipt_hash } : null,
    command_escrow_receipt: checkpointSealReceipt?.command_escrow_receipt_hash ? { receipt_hash: checkpointSealReceipt.command_escrow_receipt_hash } : null,
    sealed_handoff_review_receipt: checkpointSealReceipt?.sealed_handoff_review_receipt_hash ? { receipt_hash: checkpointSealReceipt.sealed_handoff_review_receipt_hash } : null,
    readiness_seal_receipt: checkpointSealReceipt?.readiness_seal_receipt_hash ? { receipt_hash: checkpointSealReceipt.readiness_seal_receipt_hash } : null,
    dual_control_approval_receipt: checkpointSealReceipt?.dual_control_approval_receipt_hash ? { receipt_hash: checkpointSealReceipt.dual_control_approval_receipt_hash } : null,
    rehearsal_receipt: checkpointSealReceipt?.rehearsal_receipt_hash ? { receipt_hash: checkpointSealReceipt.rehearsal_receipt_hash } : null,
    dry_run_lock_receipt: checkpointSealReceipt?.dry_run_lock_receipt_hash ? { receipt_hash: checkpointSealReceipt.dry_run_lock_receipt_hash } : null,
    policy_gate_receipt: checkpointSealReceipt?.policy_gate_receipt_hash ? { receipt_hash: checkpointSealReceipt.policy_gate_receipt_hash } : null,
    final_approval_receipt: checkpointSealReceipt?.final_approval_receipt_hash ? { receipt_hash: checkpointSealReceipt.final_approval_receipt_hash } : null,
    lifecycle_review_receipt: checkpointSealReceipt?.lifecycle_review_receipt_hash ? { receipt_hash: checkpointSealReceipt.lifecycle_review_receipt_hash } : null,
    archive_custody_transfer: {
      mode: 'internal_release_archive_freeze_custody_transfer',
      checkpoint_seal_receipt_hash: checkpointSealReceipt?.receipt_hash || null,
      renewal_confirmation_receipt_hash: checkpointSealReceipt?.renewal_confirmation_receipt_hash || null,
      checkpoint_at: checkpointAt,
      frozen_at: frozenAt,
      custody_handoff_at: custodyHandoffAt,
      next_review_due_at: nextReviewDueAt,
      expires_at: expiresAt,
      archive_custody_transferred: Boolean(handoffDecision.can_transfer_archive_custody),
      required_checks: [
        'checkpoint_seal_recorded',
        'archive_checkpoint_frozen',
        'freeze_custody_transfer_internal_only',
        'external_delivery_disabled',
        'new_explicit_delivery_authorization_required'
      ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash
    },
    custody_handoff_guard: {
      mode: 'internal_archive_freeze_custody_handoff_guard',
      custody_handoff_is_internal_only: true,
      archive_custody_transfer_is_not_delivery_authorization: true,
      final_delivery_remains_disabled: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      checkpoint_seal_reference_count: bundle.bundle_final_delivery_command_trail_checkpoint_seal_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_custody_handoff_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff'
  };
  custodyHandoff.custody_handoff_hash = digestValue(custodyHandoff);
  return custodyHandoff;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody handoff receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_recorder_required';
    throw error;
  }
  const handoff = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoff({ filters, actor: recorder, signing_secret: signingSecret }, client);
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-receipt-v1',
    recorded_at: new Date().toISOString(),
    recorder: `${recorder.username}:${recorder.role}`,
    filters: handoff.filters || filters || {},
    custody_handoff: {
      custody_handoff_hash: handoff.custody_handoff_hash,
      generated_at: handoff.generated_at,
      decision: handoff.decision,
      handoff_status: handoff.handoff_status,
      reason: handoff.reason,
      can_transfer_archive_custody: Boolean(handoff.can_transfer_archive_custody),
      explanation: handoff.explanation,
      required_actions: handoff.required_actions || []
    },
    checkpoint_seal_receipt: handoff.checkpoint_seal_receipt,
    renewal_confirmation_receipt: handoff.renewal_confirmation_receipt,
    renewal_window_receipt: handoff.renewal_window_receipt,
    retention_attestation_receipt: handoff.retention_attestation_receipt,
    trail_custody_receipt: handoff.trail_custody_receipt,
    trail_notarization_receipt: handoff.trail_notarization_receipt,
    command_closure_receipt: handoff.command_closure_receipt,
    command_revocation_receipt: handoff.command_revocation_receipt,
    command_escrow_receipt: handoff.command_escrow_receipt,
    sealed_handoff_review_receipt: handoff.sealed_handoff_review_receipt,
    readiness_seal_receipt: handoff.readiness_seal_receipt,
    dual_control_approval_receipt: handoff.dual_control_approval_receipt,
    rehearsal_receipt: handoff.rehearsal_receipt,
    dry_run_lock_receipt: handoff.dry_run_lock_receipt,
    policy_gate_receipt: handoff.policy_gate_receipt,
    final_approval_receipt: handoff.final_approval_receipt,
    lifecycle_review_receipt: handoff.lifecycle_review_receipt,
    archive_custody_transfer: handoff.archive_custody_transfer,
    custody_handoff_guard: handoff.custody_handoff_guard,
    signed_bundle: handoff.signed_bundle,
    execution_stub: handoff.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailCustodyHandoffReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_custody_handoffs (
       receipt_hash, recorder_username, recorder_role, decision, handoff_status, reason,
       can_transfer_archive_custody, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, checkpoint_at, frozen_at, custody_handoff_at,
       next_review_due_at, expires_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32::jsonb, $33::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, handoff_status, reason,
       can_transfer_archive_custody, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, checkpoint_at, frozen_at, custody_handoff_at,
       next_review_due_at, expires_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      handoff.decision,
      handoff.handoff_status,
      handoff.reason,
      Boolean(handoff.can_transfer_archive_custody),
      handoff.checkpoint_seal_receipt?.receipt_hash || null,
      handoff.checkpoint_seal_receipt?.renewal_confirmation_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.renewal_window_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.retention_attestation_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.trail_custody_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.trail_notarization_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.command_closure_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.command_revocation_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.command_escrow_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.sealed_handoff_review_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.readiness_seal_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.dual_control_approval_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.rehearsal_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.dry_run_lock_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.policy_gate_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.final_approval_receipt_hash || null,
      handoff.checkpoint_seal_receipt?.lifecycle_review_receipt_hash || null,
      handoff.archive_custody_transfer?.packet_hash || null,
      handoff.archive_custody_transfer?.manifest_hash || null,
      handoff.archive_custody_transfer?.checkpoint_at || null,
      handoff.archive_custody_transfer?.frozen_at || null,
      handoff.archive_custody_transfer?.custody_handoff_at || null,
      handoff.archive_custody_transfer?.next_review_due_at || null,
      handoff.archive_custody_transfer?.expires_at || null,
      JSON.stringify(handoff.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailCustodyHandoffReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipts(
  { limit = 20, decision = '', handoff_status: handoffStatus = '', can_transfer_archive_custody: canTransfer = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['handoff', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail custody handoff receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (handoffStatus) {
    params.push(String(handoffStatus).trim().toLowerCase());
    where.push(`handoff_status = $${params.length}`);
  }
  if (canTransfer !== '' && canTransfer !== undefined && canTransfer !== null) {
    params.push(['true', '1', 'yes', true].includes(canTransfer));
    where.push(`can_transfer_archive_custody = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR checkpoint_seal_receipt_hash ILIKE $${params.length} OR renewal_confirmation_receipt_hash ILIKE $${params.length} OR renewal_window_receipt_hash ILIKE $${params.length} OR retention_attestation_receipt_hash ILIKE $${params.length} OR trail_custody_receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, handoff_status, reason,
       can_transfer_archive_custody, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, checkpoint_at, frozen_at, custody_handoff_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custody_handoffs
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailCustodyHandoffReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody handoff receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, handoff_status, reason,
       can_transfer_archive_custody, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, checkpoint_at, frozen_at, custody_handoff_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custody_handoffs
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody handoff receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailCustodyHandoffReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailArchiveEscrowDecision(custodyHandoffReceipt = null) {
  if (
    custodyHandoffReceipt &&
    custodyHandoffReceipt.decision === 'handoff' &&
    custodyHandoffReceipt.handoff_status === 'archive_custody_transferred' &&
    custodyHandoffReceipt.can_transfer_archive_custody === true
  ) {
    return {
      decision: 'escrow',
      escrow_status: 'archive_evidence_locked',
      reason: 'custody_handoff_ready_for_archive_escrow',
      can_lock_archive_evidence: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    escrow_status: custodyHandoffReceipt?.handoff_status || 'missing_custody_handoff',
    reason: custodyHandoffReceipt?.reason || 'missing_final_delivery_command_trail_custody_handoff_receipt',
    can_lock_archive_evidence: false,
    required_actions: ['record_custody_handoff_before_archive_escrow']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrow(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail archive escrow actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const custodyHandoffReceipt = (bundle.bundle_final_delivery_command_trail_custody_handoff_references || [])[0] || null;
  const escrowDecision = finalDeliveryCommandTrailArchiveEscrowDecision(custodyHandoffReceipt);
  const generatedAt = new Date().toISOString();
  const escrowLockedAt = generatedAt;
  const custodyHandoffAt = custodyHandoffReceipt?.custody_handoff_at || generatedAt;
  const nextReviewDueAt = custodyHandoffReceipt?.next_review_due_at || new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = custodyHandoffReceipt?.expires_at || new Date(Date.parse(generatedAt) + 365 * 24 * 60 * 60 * 1000).toISOString();
  const archiveEscrow = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: escrowDecision.decision,
    escrow_status: escrowDecision.escrow_status,
    reason: escrowDecision.reason,
    can_lock_archive_evidence: Boolean(escrowDecision.can_lock_archive_evidence),
    explanation: escrowDecision.can_lock_archive_evidence
      ? 'Internal release archive evidence is locked into escrow after custody handoff; this is not external delivery authorization.'
      : 'Internal release archive evidence escrow is blocked until a custody handoff receipt is recorded.',
    required_actions: escrowDecision.required_actions,
    custody_handoff_receipt: custodyHandoffReceipt ? { ...custodyHandoffReceipt } : null,
    checkpoint_seal_receipt: custodyHandoffReceipt?.checkpoint_seal_receipt_hash ? { receipt_hash: custodyHandoffReceipt.checkpoint_seal_receipt_hash } : null,
    renewal_confirmation_receipt: custodyHandoffReceipt?.renewal_confirmation_receipt_hash ? { receipt_hash: custodyHandoffReceipt.renewal_confirmation_receipt_hash } : null,
    renewal_window_receipt: custodyHandoffReceipt?.renewal_window_receipt_hash ? { receipt_hash: custodyHandoffReceipt.renewal_window_receipt_hash } : null,
    retention_attestation_receipt: custodyHandoffReceipt?.retention_attestation_receipt_hash ? { receipt_hash: custodyHandoffReceipt.retention_attestation_receipt_hash } : null,
    trail_custody_receipt: custodyHandoffReceipt?.trail_custody_receipt_hash ? { receipt_hash: custodyHandoffReceipt.trail_custody_receipt_hash } : null,
    trail_notarization_receipt: custodyHandoffReceipt?.trail_notarization_receipt_hash ? { receipt_hash: custodyHandoffReceipt.trail_notarization_receipt_hash } : null,
    command_closure_receipt: custodyHandoffReceipt?.command_closure_receipt_hash ? { receipt_hash: custodyHandoffReceipt.command_closure_receipt_hash } : null,
    command_revocation_receipt: custodyHandoffReceipt?.command_revocation_receipt_hash ? { receipt_hash: custodyHandoffReceipt.command_revocation_receipt_hash } : null,
    command_escrow_receipt: custodyHandoffReceipt?.command_escrow_receipt_hash ? { receipt_hash: custodyHandoffReceipt.command_escrow_receipt_hash } : null,
    sealed_handoff_review_receipt: custodyHandoffReceipt?.sealed_handoff_review_receipt_hash ? { receipt_hash: custodyHandoffReceipt.sealed_handoff_review_receipt_hash } : null,
    readiness_seal_receipt: custodyHandoffReceipt?.readiness_seal_receipt_hash ? { receipt_hash: custodyHandoffReceipt.readiness_seal_receipt_hash } : null,
    dual_control_approval_receipt: custodyHandoffReceipt?.dual_control_approval_receipt_hash ? { receipt_hash: custodyHandoffReceipt.dual_control_approval_receipt_hash } : null,
    rehearsal_receipt: custodyHandoffReceipt?.rehearsal_receipt_hash ? { receipt_hash: custodyHandoffReceipt.rehearsal_receipt_hash } : null,
    dry_run_lock_receipt: custodyHandoffReceipt?.dry_run_lock_receipt_hash ? { receipt_hash: custodyHandoffReceipt.dry_run_lock_receipt_hash } : null,
    policy_gate_receipt: custodyHandoffReceipt?.policy_gate_receipt_hash ? { receipt_hash: custodyHandoffReceipt.policy_gate_receipt_hash } : null,
    final_approval_receipt: custodyHandoffReceipt?.final_approval_receipt_hash ? { receipt_hash: custodyHandoffReceipt.final_approval_receipt_hash } : null,
    lifecycle_review_receipt: custodyHandoffReceipt?.lifecycle_review_receipt_hash ? { receipt_hash: custodyHandoffReceipt.lifecycle_review_receipt_hash } : null,
    archive_evidence_lock: {
      mode: 'internal_release_archive_evidence_escrow_lock',
      custody_handoff_receipt_hash: custodyHandoffReceipt?.receipt_hash || null,
      checkpoint_seal_receipt_hash: custodyHandoffReceipt?.checkpoint_seal_receipt_hash || null,
      custody_handoff_at: custodyHandoffAt,
      escrow_locked_at: escrowLockedAt,
      next_review_due_at: nextReviewDueAt,
      expires_at: expiresAt,
      archive_evidence_locked: Boolean(escrowDecision.can_lock_archive_evidence),
      required_checks: [
        'custody_handoff_recorded',
        'archive_custody_transferred',
        'archive_evidence_lock_internal_only',
        'external_delivery_disabled',
        'new_explicit_delivery_authorization_required'
      ],
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash
    },
    archive_escrow_guard: {
      mode: 'internal_archive_evidence_escrow_guard',
      archive_escrow_is_internal_only: true,
      archive_evidence_lock_is_not_delivery_authorization: true,
      final_delivery_remains_disabled: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      custody_handoff_reference_count: bundle.bundle_final_delivery_command_trail_custody_handoff_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_archive_escrow_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow'
  };
  archiveEscrow.archive_escrow_hash = digestValue(archiveEscrow);
  return archiveEscrow;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail archive escrow receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_recorder_required';
    throw error;
  }
  const escrow = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrow({ filters, actor: recorder, signing_secret: signingSecret }, client);
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-receipt-v1',
    recorded_at: new Date().toISOString(),
    recorder: `${recorder.username}:${recorder.role}`,
    filters: escrow.filters || filters || {},
    archive_escrow: {
      archive_escrow_hash: escrow.archive_escrow_hash,
      generated_at: escrow.generated_at,
      decision: escrow.decision,
      escrow_status: escrow.escrow_status,
      reason: escrow.reason,
      can_lock_archive_evidence: Boolean(escrow.can_lock_archive_evidence),
      explanation: escrow.explanation,
      required_actions: escrow.required_actions || []
    },
    custody_handoff_receipt: escrow.custody_handoff_receipt,
    checkpoint_seal_receipt: escrow.checkpoint_seal_receipt,
    renewal_confirmation_receipt: escrow.renewal_confirmation_receipt,
    renewal_window_receipt: escrow.renewal_window_receipt,
    retention_attestation_receipt: escrow.retention_attestation_receipt,
    trail_custody_receipt: escrow.trail_custody_receipt,
    trail_notarization_receipt: escrow.trail_notarization_receipt,
    command_closure_receipt: escrow.command_closure_receipt,
    command_revocation_receipt: escrow.command_revocation_receipt,
    command_escrow_receipt: escrow.command_escrow_receipt,
    sealed_handoff_review_receipt: escrow.sealed_handoff_review_receipt,
    readiness_seal_receipt: escrow.readiness_seal_receipt,
    dual_control_approval_receipt: escrow.dual_control_approval_receipt,
    rehearsal_receipt: escrow.rehearsal_receipt,
    dry_run_lock_receipt: escrow.dry_run_lock_receipt,
    policy_gate_receipt: escrow.policy_gate_receipt,
    final_approval_receipt: escrow.final_approval_receipt,
    lifecycle_review_receipt: escrow.lifecycle_review_receipt,
    archive_evidence_lock: escrow.archive_evidence_lock,
    archive_escrow_guard: escrow.archive_escrow_guard,
    signed_bundle: escrow.signed_bundle,
    execution_stub: escrow.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailArchiveEscrowReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_archive_escrows (
       receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_lock_archive_evidence, custody_handoff_receipt_hash, checkpoint_seal_receipt_hash,
       renewal_confirmation_receipt_hash, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, custody_handoff_at,
       escrow_locked_at, next_review_due_at, expires_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32::jsonb, $33::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_lock_archive_evidence, custody_handoff_receipt_hash, checkpoint_seal_receipt_hash,
       renewal_confirmation_receipt_hash, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, custody_handoff_at,
       escrow_locked_at, next_review_due_at, expires_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      escrow.decision,
      escrow.escrow_status,
      escrow.reason,
      Boolean(escrow.can_lock_archive_evidence),
      escrow.custody_handoff_receipt?.receipt_hash || null,
      escrow.custody_handoff_receipt?.checkpoint_seal_receipt_hash || null,
      escrow.custody_handoff_receipt?.renewal_confirmation_receipt_hash || null,
      escrow.custody_handoff_receipt?.renewal_window_receipt_hash || null,
      escrow.custody_handoff_receipt?.retention_attestation_receipt_hash || null,
      escrow.custody_handoff_receipt?.trail_custody_receipt_hash || null,
      escrow.custody_handoff_receipt?.trail_notarization_receipt_hash || null,
      escrow.custody_handoff_receipt?.command_closure_receipt_hash || null,
      escrow.custody_handoff_receipt?.command_revocation_receipt_hash || null,
      escrow.custody_handoff_receipt?.command_escrow_receipt_hash || null,
      escrow.custody_handoff_receipt?.sealed_handoff_review_receipt_hash || null,
      escrow.custody_handoff_receipt?.readiness_seal_receipt_hash || null,
      escrow.custody_handoff_receipt?.dual_control_approval_receipt_hash || null,
      escrow.custody_handoff_receipt?.rehearsal_receipt_hash || null,
      escrow.custody_handoff_receipt?.dry_run_lock_receipt_hash || null,
      escrow.custody_handoff_receipt?.policy_gate_receipt_hash || null,
      escrow.custody_handoff_receipt?.final_approval_receipt_hash || null,
      escrow.custody_handoff_receipt?.lifecycle_review_receipt_hash || null,
      escrow.archive_evidence_lock?.packet_hash || null,
      escrow.archive_evidence_lock?.manifest_hash || null,
      escrow.archive_evidence_lock?.custody_handoff_at || null,
      escrow.archive_evidence_lock?.escrow_locked_at || null,
      escrow.archive_evidence_lock?.next_review_due_at || null,
      escrow.archive_evidence_lock?.expires_at || null,
      JSON.stringify(escrow.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailArchiveEscrowReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipts(
  { limit = 20, decision = '', escrow_status: escrowStatus = '', can_lock_archive_evidence: canLock = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['escrow', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail archive escrow receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (escrowStatus) {
    params.push(String(escrowStatus).trim().toLowerCase());
    where.push(`escrow_status = $${params.length}`);
  }
  if (canLock !== '' && canLock !== undefined && canLock !== null) {
    params.push(['true', '1', 'yes', true].includes(canLock));
    where.push(`can_lock_archive_evidence = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR custody_handoff_receipt_hash ILIKE $${params.length} OR checkpoint_seal_receipt_hash ILIKE $${params.length} OR renewal_confirmation_receipt_hash ILIKE $${params.length} OR renewal_window_receipt_hash ILIKE $${params.length} OR retention_attestation_receipt_hash ILIKE $${params.length} OR trail_custody_receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_lock_archive_evidence, custody_handoff_receipt_hash, checkpoint_seal_receipt_hash,
       renewal_confirmation_receipt_hash, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, custody_handoff_at,
       escrow_locked_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_archive_escrows
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailArchiveEscrowReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail archive escrow receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, escrow_status, reason,
       can_lock_archive_evidence, custody_handoff_receipt_hash, checkpoint_seal_receipt_hash,
       renewal_confirmation_receipt_hash, renewal_window_receipt_hash, retention_attestation_receipt_hash,
       trail_custody_receipt_hash, trail_notarization_receipt_hash, command_closure_receipt_hash,
       command_revocation_receipt_hash, command_escrow_receipt_hash, sealed_handoff_review_receipt_hash,
       readiness_seal_receipt_hash, dual_control_approval_receipt_hash, rehearsal_receipt_hash,
       dry_run_lock_receipt_hash, policy_gate_receipt_hash, final_approval_receipt_hash,
       lifecycle_review_receipt_hash, packet_hash, manifest_hash, custody_handoff_at,
       escrow_locked_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_archive_escrows
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail archive escrow receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailArchiveEscrowReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailEvidenceSealDecision(archiveEscrowReceipt = null) {
  if (
    archiveEscrowReceipt &&
    archiveEscrowReceipt.decision === 'escrow' &&
    archiveEscrowReceipt.escrow_status === 'archive_evidence_locked' &&
    archiveEscrowReceipt.can_lock_archive_evidence === true
  ) {
    return {
      decision: 'seal',
      seal_status: 'release_evidence_notarized',
      reason: 'archive_escrow_ready_for_evidence_seal',
      can_notarize_release_evidence: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    seal_status: archiveEscrowReceipt?.escrow_status || 'missing_archive_escrow',
    reason: archiveEscrowReceipt?.reason || 'missing_final_delivery_command_trail_archive_escrow_receipt',
    can_notarize_release_evidence: false,
    required_actions: ['record_archive_escrow_before_evidence_seal']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSeal(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail evidence seal actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const archiveEscrowReceipt = (
    await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipts(
      { ...filters, limit: 1 },
      client
    )
  )[0] || null;
  const sealDecision = finalDeliveryCommandTrailEvidenceSealDecision(archiveEscrowReceipt);
  const generatedAt = new Date().toISOString();
  const evidenceSealedAt = generatedAt;
  const escrowLockedAt = archiveEscrowReceipt?.escrow_locked_at || generatedAt;
  const nextReviewDueAt = archiveEscrowReceipt?.next_review_due_at || new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = archiveEscrowReceipt?.expires_at || new Date(Date.parse(generatedAt) + 365 * 24 * 60 * 60 * 1000).toISOString();
  const evidenceSeal = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: sealDecision.decision,
    seal_status: sealDecision.seal_status,
    reason: sealDecision.reason,
    can_notarize_release_evidence: Boolean(sealDecision.can_notarize_release_evidence),
    explanation: sealDecision.can_notarize_release_evidence
      ? 'Internal release evidence is notarized after archive escrow; this is not external delivery authorization.'
      : 'Internal release evidence seal is blocked until an archive escrow receipt is recorded.',
    required_actions: sealDecision.required_actions,
    archive_escrow_receipt: archiveEscrowReceipt ? { ...archiveEscrowReceipt } : null,
    custody_handoff_receipt: archiveEscrowReceipt?.custody_handoff_receipt_hash ? { receipt_hash: archiveEscrowReceipt.custody_handoff_receipt_hash } : null,
    checkpoint_seal_receipt: archiveEscrowReceipt?.checkpoint_seal_receipt_hash ? { receipt_hash: archiveEscrowReceipt.checkpoint_seal_receipt_hash } : null,
    renewal_confirmation_receipt: archiveEscrowReceipt?.renewal_confirmation_receipt_hash ? { receipt_hash: archiveEscrowReceipt.renewal_confirmation_receipt_hash } : null,
    renewal_window_receipt: archiveEscrowReceipt?.renewal_window_receipt_hash ? { receipt_hash: archiveEscrowReceipt.renewal_window_receipt_hash } : null,
    retention_attestation_receipt: archiveEscrowReceipt?.retention_attestation_receipt_hash ? { receipt_hash: archiveEscrowReceipt.retention_attestation_receipt_hash } : null,
    trail_custody_receipt: archiveEscrowReceipt?.trail_custody_receipt_hash ? { receipt_hash: archiveEscrowReceipt.trail_custody_receipt_hash } : null,
    trail_notarization_receipt: archiveEscrowReceipt?.trail_notarization_receipt_hash ? { receipt_hash: archiveEscrowReceipt.trail_notarization_receipt_hash } : null,
    command_closure_receipt: archiveEscrowReceipt?.command_closure_receipt_hash ? { receipt_hash: archiveEscrowReceipt.command_closure_receipt_hash } : null,
    command_revocation_receipt: archiveEscrowReceipt?.command_revocation_receipt_hash ? { receipt_hash: archiveEscrowReceipt.command_revocation_receipt_hash } : null,
    command_escrow_receipt: archiveEscrowReceipt?.command_escrow_receipt_hash ? { receipt_hash: archiveEscrowReceipt.command_escrow_receipt_hash } : null,
    sealed_handoff_review_receipt: archiveEscrowReceipt?.sealed_handoff_review_receipt_hash ? { receipt_hash: archiveEscrowReceipt.sealed_handoff_review_receipt_hash } : null,
    readiness_seal_receipt: archiveEscrowReceipt?.readiness_seal_receipt_hash ? { receipt_hash: archiveEscrowReceipt.readiness_seal_receipt_hash } : null,
    dual_control_approval_receipt: archiveEscrowReceipt?.dual_control_approval_receipt_hash ? { receipt_hash: archiveEscrowReceipt.dual_control_approval_receipt_hash } : null,
    rehearsal_receipt: archiveEscrowReceipt?.rehearsal_receipt_hash ? { receipt_hash: archiveEscrowReceipt.rehearsal_receipt_hash } : null,
    dry_run_lock_receipt: archiveEscrowReceipt?.dry_run_lock_receipt_hash ? { receipt_hash: archiveEscrowReceipt.dry_run_lock_receipt_hash } : null,
    policy_gate_receipt: archiveEscrowReceipt?.policy_gate_receipt_hash ? { receipt_hash: archiveEscrowReceipt.policy_gate_receipt_hash } : null,
    final_approval_receipt: archiveEscrowReceipt?.final_approval_receipt_hash ? { receipt_hash: archiveEscrowReceipt.final_approval_receipt_hash } : null,
    lifecycle_review_receipt: archiveEscrowReceipt?.lifecycle_review_receipt_hash ? { receipt_hash: archiveEscrowReceipt.lifecycle_review_receipt_hash } : null,
    release_evidence_seal: {
      mode: 'internal_release_evidence_seal_notarization',
      archive_escrow_receipt_hash: archiveEscrowReceipt?.receipt_hash || null,
      custody_handoff_receipt_hash: archiveEscrowReceipt?.custody_handoff_receipt_hash || null,
      escrow_locked_at: escrowLockedAt,
      evidence_sealed_at: evidenceSealedAt,
      next_review_due_at: nextReviewDueAt,
      expires_at: expiresAt,
      release_evidence_notarized: Boolean(sealDecision.can_notarize_release_evidence),
      required_checks: [
        'archive_escrow_recorded',
        'archive_evidence_locked',
        'release_evidence_seal_internal_only',
        'external_delivery_disabled',
        'new_explicit_delivery_authorization_required'
      ],
      packet_hash: archiveEscrowReceipt?.packet_hash || bundle.packet_hash,
      manifest_hash: archiveEscrowReceipt?.manifest_hash || bundle.manifest_hash
    },
    evidence_seal_guard: {
      mode: 'internal_release_evidence_seal_guard',
      evidence_seal_is_internal_only: true,
      release_evidence_seal_is_not_delivery_authorization: true,
      final_delivery_remains_disabled: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      archive_escrow_reference_count: bundle.bundle_final_delivery_command_trail_archive_escrow_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_evidence_seal_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal'
  };
  evidenceSeal.evidence_seal_hash = digestValue(evidenceSeal);
  return evidenceSeal;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail evidence seal receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_recorder_required';
    throw error;
  }
  const seal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSeal({ filters, actor: recorder, signing_secret: signingSecret }, client);
  const archiveEscrowReceipt = seal.archive_escrow_receipt;
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-receipt-v1',
    recorded_at: new Date().toISOString(),
    recorder: `${recorder.username}:${recorder.role}`,
    filters: seal.filters || filters || {},
    evidence_seal: {
      evidence_seal_hash: seal.evidence_seal_hash,
      generated_at: seal.generated_at,
      decision: seal.decision,
      seal_status: seal.seal_status,
      reason: seal.reason,
      can_notarize_release_evidence: Boolean(seal.can_notarize_release_evidence),
      explanation: seal.explanation,
      required_actions: seal.required_actions || []
    },
    archive_escrow_receipt: seal.archive_escrow_receipt,
    custody_handoff_receipt: seal.custody_handoff_receipt,
    checkpoint_seal_receipt: seal.checkpoint_seal_receipt,
    renewal_confirmation_receipt: seal.renewal_confirmation_receipt,
    renewal_window_receipt: seal.renewal_window_receipt,
    retention_attestation_receipt: seal.retention_attestation_receipt,
    trail_custody_receipt: seal.trail_custody_receipt,
    trail_notarization_receipt: seal.trail_notarization_receipt,
    command_closure_receipt: seal.command_closure_receipt,
    command_revocation_receipt: seal.command_revocation_receipt,
    command_escrow_receipt: seal.command_escrow_receipt,
    sealed_handoff_review_receipt: seal.sealed_handoff_review_receipt,
    readiness_seal_receipt: seal.readiness_seal_receipt,
    dual_control_approval_receipt: seal.dual_control_approval_receipt,
    rehearsal_receipt: seal.rehearsal_receipt,
    dry_run_lock_receipt: seal.dry_run_lock_receipt,
    policy_gate_receipt: seal.policy_gate_receipt,
    final_approval_receipt: seal.final_approval_receipt,
    lifecycle_review_receipt: seal.lifecycle_review_receipt,
    release_evidence_seal: seal.release_evidence_seal,
    evidence_seal_guard: seal.evidence_seal_guard,
    signed_bundle: seal.signed_bundle,
    execution_stub: seal.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailEvidenceSealReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_evidence_seals (
       receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_notarize_release_evidence, archive_escrow_receipt_hash, custody_handoff_receipt_hash,
       checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       escrow_locked_at, evidence_sealed_at, next_review_due_at, expires_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33::jsonb, $34::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_notarize_release_evidence, archive_escrow_receipt_hash, custody_handoff_receipt_hash,
       checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       escrow_locked_at, evidence_sealed_at, next_review_due_at, expires_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      seal.decision,
      seal.seal_status,
      seal.reason,
      Boolean(seal.can_notarize_release_evidence),
      archiveEscrowReceipt?.receipt_hash || null,
      archiveEscrowReceipt?.custody_handoff_receipt_hash || null,
      archiveEscrowReceipt?.checkpoint_seal_receipt_hash || null,
      archiveEscrowReceipt?.renewal_confirmation_receipt_hash || null,
      archiveEscrowReceipt?.renewal_window_receipt_hash || null,
      archiveEscrowReceipt?.retention_attestation_receipt_hash || null,
      archiveEscrowReceipt?.trail_custody_receipt_hash || null,
      archiveEscrowReceipt?.trail_notarization_receipt_hash || null,
      archiveEscrowReceipt?.command_closure_receipt_hash || null,
      archiveEscrowReceipt?.command_revocation_receipt_hash || null,
      archiveEscrowReceipt?.command_escrow_receipt_hash || null,
      archiveEscrowReceipt?.sealed_handoff_review_receipt_hash || null,
      archiveEscrowReceipt?.readiness_seal_receipt_hash || null,
      archiveEscrowReceipt?.dual_control_approval_receipt_hash || null,
      archiveEscrowReceipt?.rehearsal_receipt_hash || null,
      archiveEscrowReceipt?.dry_run_lock_receipt_hash || null,
      archiveEscrowReceipt?.policy_gate_receipt_hash || null,
      archiveEscrowReceipt?.final_approval_receipt_hash || null,
      archiveEscrowReceipt?.lifecycle_review_receipt_hash || null,
      seal.release_evidence_seal?.packet_hash || null,
      seal.release_evidence_seal?.manifest_hash || null,
      seal.release_evidence_seal?.escrow_locked_at || null,
      seal.release_evidence_seal?.evidence_sealed_at || null,
      seal.release_evidence_seal?.next_review_due_at || null,
      seal.release_evidence_seal?.expires_at || null,
      JSON.stringify(seal.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailEvidenceSealReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipts(
  { limit = 20, decision = '', seal_status: sealStatus = '', can_notarize_release_evidence: canSeal = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['seal', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail evidence seal receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (sealStatus) {
    params.push(String(sealStatus).trim().toLowerCase());
    where.push(`seal_status = $${params.length}`);
  }
  if (canSeal !== '' && canSeal !== undefined && canSeal !== null) {
    params.push(['true', '1', 'yes', true].includes(canSeal));
    where.push(`can_notarize_release_evidence = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR archive_escrow_receipt_hash ILIKE $${params.length} OR custody_handoff_receipt_hash ILIKE $${params.length} OR checkpoint_seal_receipt_hash ILIKE $${params.length} OR renewal_confirmation_receipt_hash ILIKE $${params.length} OR renewal_window_receipt_hash ILIKE $${params.length} OR retention_attestation_receipt_hash ILIKE $${params.length} OR trail_custody_receipt_hash ILIKE $${params.length} OR trail_notarization_receipt_hash ILIKE $${params.length} OR command_closure_receipt_hash ILIKE $${params.length} OR command_revocation_receipt_hash ILIKE $${params.length} OR command_escrow_receipt_hash ILIKE $${params.length} OR sealed_handoff_review_receipt_hash ILIKE $${params.length} OR readiness_seal_receipt_hash ILIKE $${params.length} OR dual_control_approval_receipt_hash ILIKE $${params.length} OR rehearsal_receipt_hash ILIKE $${params.length} OR dry_run_lock_receipt_hash ILIKE $${params.length} OR policy_gate_receipt_hash ILIKE $${params.length} OR final_approval_receipt_hash ILIKE $${params.length} OR lifecycle_review_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_notarize_release_evidence, archive_escrow_receipt_hash, custody_handoff_receipt_hash,
       checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       escrow_locked_at, evidence_sealed_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_evidence_seals
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailEvidenceSealReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail evidence seal receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, seal_status, reason,
       can_notarize_release_evidence, archive_escrow_receipt_hash, custody_handoff_receipt_hash,
       checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash, renewal_window_receipt_hash,
       retention_attestation_receipt_hash, trail_custody_receipt_hash, trail_notarization_receipt_hash,
       command_closure_receipt_hash, command_revocation_receipt_hash, command_escrow_receipt_hash,
       sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash, dual_control_approval_receipt_hash,
       rehearsal_receipt_hash, dry_run_lock_receipt_hash, policy_gate_receipt_hash,
       final_approval_receipt_hash, lifecycle_review_receipt_hash, packet_hash, manifest_hash,
       escrow_locked_at, evidence_sealed_at, next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_evidence_seals
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail evidence seal receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailEvidenceSealReceipt(result.rows[0]);
}

function finalDeliveryCommandTrailCustodyCheckpointDecision(evidenceSealReceipt = null) {
  if (
    evidenceSealReceipt &&
    evidenceSealReceipt.decision === 'seal' &&
    evidenceSealReceipt.seal_status === 'release_evidence_notarized' &&
    evidenceSealReceipt.can_notarize_release_evidence === true
  ) {
    return {
      decision: 'checkpoint',
      checkpoint_status: 'sealed_evidence_custody_checkpointed',
      reason: 'evidence_seal_ready_for_custody_checkpoint',
      can_checkpoint_sealed_evidence: true,
      required_actions: []
    };
  }
  return {
    decision: 'block',
    checkpoint_status: evidenceSealReceipt?.seal_status || 'missing_evidence_seal',
    reason: evidenceSealReceipt?.reason || 'missing_final_delivery_command_trail_evidence_seal_receipt',
    can_checkpoint_sealed_evidence: false,
    required_actions: ['record_evidence_seal_before_custody_checkpoint']
  };
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpoint(
  { filters = {}, actor = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!actor?.username) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody checkpoint actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_actor_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, actor, signingSecret, client);
  const evidenceSealReceipt = (
    await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipts(
      { ...filters, limit: 1 },
      client
    )
  )[0] || null;
  const checkpointDecision = finalDeliveryCommandTrailCustodyCheckpointDecision(evidenceSealReceipt);
  const generatedAt = new Date().toISOString();
  const evidenceSealedAt = evidenceSealReceipt?.evidence_sealed_at || generatedAt;
  const nextReviewDueAt = evidenceSealReceipt?.next_review_due_at || new Date(Date.parse(generatedAt) + 90 * 24 * 60 * 60 * 1000).toISOString();
  const expiresAt = evidenceSealReceipt?.expires_at || new Date(Date.parse(generatedAt) + 365 * 24 * 60 * 60 * 1000).toISOString();
  const custodyCheckpoint = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-v1',
    generated_at: generatedAt,
    requested_by: `${actor.username}:${actor.role || 'unknown'}`,
    filters: bundle.packet?.filters || filters || {},
    decision: checkpointDecision.decision,
    checkpoint_status: checkpointDecision.checkpoint_status,
    reason: checkpointDecision.reason,
    can_checkpoint_sealed_evidence: Boolean(checkpointDecision.can_checkpoint_sealed_evidence),
    explanation: checkpointDecision.can_checkpoint_sealed_evidence
      ? 'Internal sealed release evidence custody checkpoint is recorded after evidence seal; this is not external delivery authorization.'
      : 'Internal sealed release evidence custody checkpoint is blocked until an evidence seal receipt is recorded.',
    required_actions: checkpointDecision.required_actions,
    evidence_seal_receipt: evidenceSealReceipt ? { ...evidenceSealReceipt } : null,
    archive_escrow_receipt: evidenceSealReceipt?.archive_escrow_receipt_hash ? { receipt_hash: evidenceSealReceipt.archive_escrow_receipt_hash } : null,
    custody_handoff_receipt: evidenceSealReceipt?.custody_handoff_receipt_hash ? { receipt_hash: evidenceSealReceipt.custody_handoff_receipt_hash } : null,
    checkpoint_seal_receipt: evidenceSealReceipt?.checkpoint_seal_receipt_hash ? { receipt_hash: evidenceSealReceipt.checkpoint_seal_receipt_hash } : null,
    renewal_confirmation_receipt: evidenceSealReceipt?.renewal_confirmation_receipt_hash ? { receipt_hash: evidenceSealReceipt.renewal_confirmation_receipt_hash } : null,
    renewal_window_receipt: evidenceSealReceipt?.renewal_window_receipt_hash ? { receipt_hash: evidenceSealReceipt.renewal_window_receipt_hash } : null,
    retention_attestation_receipt: evidenceSealReceipt?.retention_attestation_receipt_hash ? { receipt_hash: evidenceSealReceipt.retention_attestation_receipt_hash } : null,
    trail_custody_receipt: evidenceSealReceipt?.trail_custody_receipt_hash ? { receipt_hash: evidenceSealReceipt.trail_custody_receipt_hash } : null,
    trail_notarization_receipt: evidenceSealReceipt?.trail_notarization_receipt_hash ? { receipt_hash: evidenceSealReceipt.trail_notarization_receipt_hash } : null,
    command_closure_receipt: evidenceSealReceipt?.command_closure_receipt_hash ? { receipt_hash: evidenceSealReceipt.command_closure_receipt_hash } : null,
    command_revocation_receipt: evidenceSealReceipt?.command_revocation_receipt_hash ? { receipt_hash: evidenceSealReceipt.command_revocation_receipt_hash } : null,
    command_escrow_receipt: evidenceSealReceipt?.command_escrow_receipt_hash ? { receipt_hash: evidenceSealReceipt.command_escrow_receipt_hash } : null,
    sealed_handoff_review_receipt: evidenceSealReceipt?.sealed_handoff_review_receipt_hash ? { receipt_hash: evidenceSealReceipt.sealed_handoff_review_receipt_hash } : null,
    readiness_seal_receipt: evidenceSealReceipt?.readiness_seal_receipt_hash ? { receipt_hash: evidenceSealReceipt.readiness_seal_receipt_hash } : null,
    dual_control_approval_receipt: evidenceSealReceipt?.dual_control_approval_receipt_hash ? { receipt_hash: evidenceSealReceipt.dual_control_approval_receipt_hash } : null,
    rehearsal_receipt: evidenceSealReceipt?.rehearsal_receipt_hash ? { receipt_hash: evidenceSealReceipt.rehearsal_receipt_hash } : null,
    dry_run_lock_receipt: evidenceSealReceipt?.dry_run_lock_receipt_hash ? { receipt_hash: evidenceSealReceipt.dry_run_lock_receipt_hash } : null,
    policy_gate_receipt: evidenceSealReceipt?.policy_gate_receipt_hash ? { receipt_hash: evidenceSealReceipt.policy_gate_receipt_hash } : null,
    final_approval_receipt: evidenceSealReceipt?.final_approval_receipt_hash ? { receipt_hash: evidenceSealReceipt.final_approval_receipt_hash } : null,
    lifecycle_review_receipt: evidenceSealReceipt?.lifecycle_review_receipt_hash ? { receipt_hash: evidenceSealReceipt.lifecycle_review_receipt_hash } : null,
    sealed_evidence_custody_checkpoint: {
      mode: 'internal_sealed_evidence_custody_checkpoint',
      evidence_seal_receipt_hash: evidenceSealReceipt?.receipt_hash || null,
      archive_escrow_receipt_hash: evidenceSealReceipt?.archive_escrow_receipt_hash || null,
      evidence_sealed_at: evidenceSealedAt,
      custody_checkpointed_at: generatedAt,
      next_review_due_at: nextReviewDueAt,
      expires_at: expiresAt,
      sealed_evidence_checkpointed: Boolean(checkpointDecision.can_checkpoint_sealed_evidence),
      required_checks: [
        'evidence_seal_recorded',
        'release_evidence_notarized',
        'sealed_evidence_custody_checkpoint_internal_only',
        'external_delivery_disabled',
        'new_explicit_delivery_authorization_required'
      ],
      packet_hash: evidenceSealReceipt?.packet_hash || bundle.packet_hash,
      manifest_hash: evidenceSealReceipt?.manifest_hash || bundle.manifest_hash
    },
    custody_checkpoint_guard: {
      mode: 'internal_sealed_evidence_custody_checkpoint_guard',
      custody_checkpoint_is_internal_only: true,
      custody_checkpoint_is_not_delivery_authorization: true,
      final_delivery_remains_disabled: true,
      external_delivery_remains_disabled: true,
      webhook_remains_disabled: true,
      email_remains_disabled: true,
      customer_dashboard_remains_disabled: true,
      cloudflare_deploy_remains_disabled: true
    },
    signed_bundle: {
      schema_version: bundle.schema_version,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0,
      evidence_seal_reference_count: bundle.bundle_final_delivery_command_trail_evidence_seal_references?.length || 0
    },
    execution_stub: {
      mode: 'internal_final_delivery_command_trail_custody_checkpoint_only',
      dry_run: true,
      execute_delivery: false,
      final_delivery: false,
      external_delivery: false,
      webhook: false,
      email: false,
      customer_dashboard: false,
      cloudflare_deploy: false
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint'
  };
  custodyCheckpoint.custody_checkpoint_hash = digestValue(custodyCheckpoint);
  return custodyCheckpoint;
}

export async function recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt(
  { filters = {}, recorder = {}, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!recorder?.username || !recorder?.role) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody checkpoint receipt recorder is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_recorder_required';
    throw error;
  }
  const checkpoint = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpoint({ filters, actor: recorder, signing_secret: signingSecret }, client);
  const evidenceSealReceipt = checkpoint.evidence_seal_receipt;
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-receipt-v1',
    recorded_at: new Date().toISOString(),
    recorder: `${recorder.username}:${recorder.role}`,
    filters: checkpoint.filters || filters || {},
    custody_checkpoint: {
      custody_checkpoint_hash: checkpoint.custody_checkpoint_hash,
      generated_at: checkpoint.generated_at,
      decision: checkpoint.decision,
      checkpoint_status: checkpoint.checkpoint_status,
      reason: checkpoint.reason,
      can_checkpoint_sealed_evidence: Boolean(checkpoint.can_checkpoint_sealed_evidence),
      explanation: checkpoint.explanation,
      required_actions: checkpoint.required_actions || []
    },
    evidence_seal_receipt: checkpoint.evidence_seal_receipt,
    archive_escrow_receipt: checkpoint.archive_escrow_receipt,
    custody_handoff_receipt: checkpoint.custody_handoff_receipt,
    checkpoint_seal_receipt: checkpoint.checkpoint_seal_receipt,
    renewal_confirmation_receipt: checkpoint.renewal_confirmation_receipt,
    renewal_window_receipt: checkpoint.renewal_window_receipt,
    retention_attestation_receipt: checkpoint.retention_attestation_receipt,
    trail_custody_receipt: checkpoint.trail_custody_receipt,
    trail_notarization_receipt: checkpoint.trail_notarization_receipt,
    command_closure_receipt: checkpoint.command_closure_receipt,
    command_revocation_receipt: checkpoint.command_revocation_receipt,
    command_escrow_receipt: checkpoint.command_escrow_receipt,
    sealed_handoff_review_receipt: checkpoint.sealed_handoff_review_receipt,
    readiness_seal_receipt: checkpoint.readiness_seal_receipt,
    dual_control_approval_receipt: checkpoint.dual_control_approval_receipt,
    rehearsal_receipt: checkpoint.rehearsal_receipt,
    dry_run_lock_receipt: checkpoint.dry_run_lock_receipt,
    policy_gate_receipt: checkpoint.policy_gate_receipt,
    final_approval_receipt: checkpoint.final_approval_receipt,
    lifecycle_review_receipt: checkpoint.lifecycle_review_receipt,
    sealed_evidence_custody_checkpoint: checkpoint.sealed_evidence_custody_checkpoint,
    custody_checkpoint_guard: checkpoint.custody_checkpoint_guard,
    signed_bundle: checkpoint.signed_bundle,
    execution_stub: checkpoint.execution_stub,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt'
  };
  receipt.receipt_hash = bundleFinalDeliveryCommandTrailCustodyCheckpointReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_final_delivery_command_trail_custody_checkpoints (
       receipt_hash, recorder_username, recorder_role, decision, checkpoint_status, reason,
       can_checkpoint_sealed_evidence, evidence_seal_receipt_hash, archive_escrow_receipt_hash,
       custody_handoff_receipt_hash, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, evidence_sealed_at, custody_checkpointed_at,
       next_review_due_at, expires_at, filters, receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34::jsonb, $35::jsonb)
     RETURNING id, receipt_hash, recorder_username, recorder_role, decision, checkpoint_status, reason,
       can_checkpoint_sealed_evidence, evidence_seal_receipt_hash, archive_escrow_receipt_hash,
       custody_handoff_receipt_hash, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, evidence_sealed_at, custody_checkpointed_at,
       next_review_due_at, expires_at, filters, receipt, created_at`,
    [
      receipt.receipt_hash,
      recorder.username,
      recorder.role,
      checkpoint.decision,
      checkpoint.checkpoint_status,
      checkpoint.reason,
      Boolean(checkpoint.can_checkpoint_sealed_evidence),
      evidenceSealReceipt?.receipt_hash || null,
      evidenceSealReceipt?.archive_escrow_receipt_hash || null,
      evidenceSealReceipt?.custody_handoff_receipt_hash || null,
      evidenceSealReceipt?.checkpoint_seal_receipt_hash || null,
      evidenceSealReceipt?.renewal_confirmation_receipt_hash || null,
      evidenceSealReceipt?.renewal_window_receipt_hash || null,
      evidenceSealReceipt?.retention_attestation_receipt_hash || null,
      evidenceSealReceipt?.trail_custody_receipt_hash || null,
      evidenceSealReceipt?.trail_notarization_receipt_hash || null,
      evidenceSealReceipt?.command_closure_receipt_hash || null,
      evidenceSealReceipt?.command_revocation_receipt_hash || null,
      evidenceSealReceipt?.command_escrow_receipt_hash || null,
      evidenceSealReceipt?.sealed_handoff_review_receipt_hash || null,
      evidenceSealReceipt?.readiness_seal_receipt_hash || null,
      evidenceSealReceipt?.dual_control_approval_receipt_hash || null,
      evidenceSealReceipt?.rehearsal_receipt_hash || null,
      evidenceSealReceipt?.dry_run_lock_receipt_hash || null,
      evidenceSealReceipt?.policy_gate_receipt_hash || null,
      evidenceSealReceipt?.final_approval_receipt_hash || null,
      evidenceSealReceipt?.lifecycle_review_receipt_hash || null,
      checkpoint.sealed_evidence_custody_checkpoint?.packet_hash || null,
      checkpoint.sealed_evidence_custody_checkpoint?.manifest_hash || null,
      checkpoint.sealed_evidence_custody_checkpoint?.evidence_sealed_at || null,
      checkpoint.sealed_evidence_custody_checkpoint?.custody_checkpointed_at || null,
      checkpoint.sealed_evidence_custody_checkpoint?.next_review_due_at || null,
      checkpoint.sealed_evidence_custody_checkpoint?.expires_at || null,
      JSON.stringify(checkpoint.filters || filters || {}),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts(
  { limit = 20, decision = '', checkpoint_status: checkpointStatus = '', can_checkpoint_sealed_evidence: canCheckpoint = '', recorder = '', receipt_hash: receiptHash = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (decision) {
    const normalizedDecision = String(decision).trim().toLowerCase();
    if (!['checkpoint', 'block'].includes(normalizedDecision)) {
      const error = new Error('Evidence case packet bundle final delivery command trail custody checkpoint receipt decision is invalid.');
      error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_decision_invalid';
      throw error;
    }
    params.push(normalizedDecision);
    where.push(`decision = $${params.length}`);
  }
  if (checkpointStatus) {
    params.push(String(checkpointStatus).trim().toLowerCase());
    where.push(`checkpoint_status = $${params.length}`);
  }
  if (canCheckpoint !== '' && canCheckpoint !== undefined && canCheckpoint !== null) {
    params.push(['true', '1', 'yes', true].includes(canCheckpoint));
    where.push(`can_checkpoint_sealed_evidence = $${params.length}`);
  }
  if (recorder) {
    params.push(String(recorder).trim());
    where.push(`recorder_username = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR evidence_seal_receipt_hash ILIKE $${params.length} OR archive_escrow_receipt_hash ILIKE $${params.length} OR packet_hash ILIKE $${params.length} OR manifest_hash ILIKE $${params.length})`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, checkpoint_status, reason,
       can_checkpoint_sealed_evidence, evidence_seal_receipt_hash, archive_escrow_receipt_hash,
       custody_handoff_receipt_hash, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, evidence_sealed_at, custody_checkpointed_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custody_checkpoints
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt);
}

export async function getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody checkpoint receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, recorder_username, recorder_role, decision, checkpoint_status, reason,
       can_checkpoint_sealed_evidence, evidence_seal_receipt_hash, archive_escrow_receipt_hash,
       custody_handoff_receipt_hash, checkpoint_seal_receipt_hash, renewal_confirmation_receipt_hash,
       renewal_window_receipt_hash, retention_attestation_receipt_hash, trail_custody_receipt_hash,
       trail_notarization_receipt_hash, command_closure_receipt_hash, command_revocation_receipt_hash,
       command_escrow_receipt_hash, sealed_handoff_review_receipt_hash, readiness_seal_receipt_hash,
       dual_control_approval_receipt_hash, rehearsal_receipt_hash, dry_run_lock_receipt_hash,
       policy_gate_receipt_hash, final_approval_receipt_hash, lifecycle_review_receipt_hash,
       packet_hash, manifest_hash, evidence_sealed_at, custody_checkpointed_at,
       next_review_due_at, expires_at, filters, receipt, created_at
     FROM internal_ops_audit_final_delivery_command_trail_custody_checkpoints
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle final delivery command trail custody checkpoint receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_not_found';
    throw error;
  }
  return normalizeBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt(result.rows[0]);
}

function bundleExportReferenceCounts(bundle) {
  return {
    archives: bundle.archives?.length || 0,
    verification_receipts: bundle.verification_receipts?.length || 0,
    retention_receipt_references: bundle.retention_receipt_references?.length || 0,
    bundle_verification_references: bundle.bundle_verification_references?.length || 0,
    anomaly_digest_retention_receipt_references: bundle.anomaly_digest_retention_receipt_references?.length || 0,
    bundle_export_references: bundle.bundle_export_references?.length || 0,
    bundle_export_review_references: bundle.bundle_export_review_references?.length || 0,
    bundle_delivery_gate_receipt_references: bundle.bundle_delivery_gate_receipt_references?.length || 0,
    bundle_handoff_preview_receipt_references: bundle.bundle_handoff_preview_receipt_references?.length || 0,
    bundle_final_approval_receipt_references: bundle.bundle_final_approval_receipt_references?.length || 0,
    bundle_final_approval_review_references: bundle.bundle_final_approval_review_references?.length || 0,
    bundle_final_approval_policy_gate_references: bundle.bundle_final_approval_policy_gate_references?.length || 0,
    bundle_final_delivery_dry_run_lock_references: bundle.bundle_final_delivery_dry_run_lock_references?.length || 0,
    bundle_final_delivery_rehearsal_references: bundle.bundle_final_delivery_rehearsal_references?.length || 0,
    bundle_final_delivery_dual_control_approval_references: bundle.bundle_final_delivery_dual_control_approval_references?.length || 0,
    bundle_final_delivery_readiness_seal_references: bundle.bundle_final_delivery_readiness_seal_references?.length || 0,
    bundle_final_delivery_sealed_handoff_review_references: bundle.bundle_final_delivery_sealed_handoff_review_references?.length || 0,
    bundle_final_delivery_command_escrow_references: bundle.bundle_final_delivery_command_escrow_references?.length || 0,
    bundle_final_delivery_command_revocation_references: bundle.bundle_final_delivery_command_revocation_references?.length || 0,
    bundle_final_delivery_command_closure_references: bundle.bundle_final_delivery_command_closure_references?.length || 0,
    bundle_final_delivery_command_trail_notarization_references: bundle.bundle_final_delivery_command_trail_notarization_references?.length || 0,
    bundle_final_delivery_command_trail_custody_references: bundle.bundle_final_delivery_command_trail_custody_references?.length || 0,
    bundle_final_delivery_command_trail_retention_attestation_references: bundle.bundle_final_delivery_command_trail_retention_attestation_references?.length || 0,
    bundle_final_delivery_command_trail_renewal_window_references: bundle.bundle_final_delivery_command_trail_renewal_window_references?.length || 0,
    bundle_final_delivery_command_trail_renewal_confirmation_references: bundle.bundle_final_delivery_command_trail_renewal_confirmation_references?.length || 0,
    bundle_final_delivery_command_trail_checkpoint_seal_references: bundle.bundle_final_delivery_command_trail_checkpoint_seal_references?.length || 0,
    bundle_final_delivery_command_trail_custody_handoff_references: bundle.bundle_final_delivery_command_trail_custody_handoff_references?.length || 0,
    bundle_final_delivery_command_trail_archive_escrow_references: bundle.bundle_final_delivery_command_trail_archive_escrow_references?.length || 0,
    bundle_final_delivery_command_trail_evidence_seal_references: bundle.bundle_final_delivery_command_trail_evidence_seal_references?.length || 0,
    bundle_final_delivery_command_trail_custody_checkpoint_references: bundle.bundle_final_delivery_command_trail_custody_checkpoint_references?.length || 0,
    bundle_export_delivery_status: bundle.delivery_readiness?.delivery_status || 'no_exports',
    bundle_export_delivery_gate_decision: bundle.delivery_gate?.decision || 'deny',
    manifest_entries: bundle.manifest?.entries?.length || 0
  };
}

export async function recordOpsAuditEvidenceCasePacketBundleExport(
  { filters = {}, requester, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!requester?.username) {
    const error = new Error('Evidence case packet bundle export requester is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_requester_required';
    throw error;
  }
  const bundle = await getOpsAuditEvidenceCasePacketBundle(filters, requester, signingSecret, client);
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-receipt-v1',
    generated_at: new Date().toISOString(),
    requester: `${requester.username}:${requester.role}`,
    bundle: {
      schema_version: bundle.schema_version,
      requested_by: bundle.requested_by,
      packet_hash: bundle.packet_hash,
      manifest_hash: bundle.manifest_hash,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: bundle.manifest?.entries?.length || 0
    },
    filters: bundle.packet?.filters || filters || {},
    manifest_entries: bundle.manifest?.entries || [],
    reference_counts: bundleExportReferenceCounts(bundle),
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_export_receipt'
  };
  receipt.receipt_hash = bundleExportReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_packet_bundle_exports (
       receipt_hash,
       requester_username,
       requester_role,
       bundle_manifest_hash,
       bundle_packet_hash,
       filters,
       manifest_entries,
       reference_counts,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
     RETURNING id, receipt_hash, requester_username, requester_role, bundle_manifest_hash, bundle_packet_hash,
       filters, manifest_entries, reference_counts, receipt, created_at`,
    [
      receipt.receipt_hash,
      requester.username,
      requester.role,
      bundle.manifest_hash,
      bundle.packet_hash,
      JSON.stringify(receipt.filters || {}),
      JSON.stringify(receipt.manifest_entries || []),
      JSON.stringify(receipt.reference_counts || {}),
      JSON.stringify(receipt)
    ]
  );
  return {
    bundle,
    export_receipt: receipt,
    history: normalizeBundleExport(result.rows[0])
  };
}

export async function listOpsAuditEvidenceCasePacketBundleExports({ limit = 20 } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const result = await client.query(
    `SELECT id, receipt_hash, requester_username, requester_role, bundle_manifest_hash, bundle_packet_hash,
       filters, manifest_entries, reference_counts, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_exports
     ORDER BY created_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows.map(normalizeBundleExport);
}

export async function getOpsAuditEvidenceCasePacketBundleExport(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle export identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, requester_username, requester_role, bundle_manifest_hash, bundle_packet_hash,
       filters, manifest_entries, reference_counts, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_exports
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle export receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_not_found';
    throw error;
  }
  return normalizeBundleExport(result.rows[0]);
}

const BUNDLE_EXPORT_REVIEW_ACTIONS = new Set(['attested', 'rejected', 'revoked']);
const BUNDLE_EXPORT_REVIEW_PURPOSES = new Set(['delivery', 'archive', 'review', 'internal']);
const BUNDLE_EXPORT_REVIEW_DECISIONS = new Set(['usable', 'needs_review', 'rejected']);

function normalizeBundleExportReviewAction(action) {
  const normalized = String(action || 'attested').trim().toLowerCase();
  if (!BUNDLE_EXPORT_REVIEW_ACTIONS.has(normalized)) {
    const error = new Error('Evidence case packet bundle export review action is invalid.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_review_action_invalid';
    throw error;
  }
  return normalized;
}

function normalizeBundleExportReviewPurpose(purpose) {
  const normalized = String(purpose || 'archive').trim().toLowerCase();
  if (!BUNDLE_EXPORT_REVIEW_PURPOSES.has(normalized)) {
    const error = new Error('Evidence case packet bundle export review purpose is invalid.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_review_purpose_invalid';
    throw error;
  }
  return normalized;
}

function normalizeBundleExportReviewDecision(decision) {
  const normalized = String(decision || 'usable').trim().toLowerCase();
  if (!BUNDLE_EXPORT_REVIEW_DECISIONS.has(normalized)) {
    const error = new Error('Evidence case packet bundle export review decision is invalid.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_review_decision_invalid';
    throw error;
  }
  return normalized;
}

export async function recordOpsAuditEvidenceCasePacketBundleExportReview(
  {
    export_receipt_hash: exportReceiptHash = '',
    reviewer = {},
    action = 'attested',
    purpose = 'archive',
    decision = 'usable',
    note = ''
  } = {},
  client = pool
) {
  const normalizedExportReceiptHash = String(exportReceiptHash || '').trim();
  if (!normalizedExportReceiptHash) {
    const error = new Error('Evidence case packet bundle export review requires an export receipt hash.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_review_export_required';
    throw error;
  }
  if (!reviewer?.username || !reviewer?.role) {
    const error = new Error('Evidence case packet bundle export review reviewer is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_review_reviewer_required';
    throw error;
  }
  const bundleExport = await getOpsAuditEvidenceCasePacketBundleExport(normalizedExportReceiptHash, client);
  const normalizedAction = normalizeBundleExportReviewAction(action);
  const normalizedPurpose = normalizeBundleExportReviewPurpose(purpose);
  const normalizedDecision = normalizeBundleExportReviewDecision(decision);
  const reviewedAt = new Date().toISOString();
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-review-receipt-v1',
    reviewed_at: reviewedAt,
    action: normalizedAction,
    purpose: normalizedPurpose,
    decision: normalizedDecision,
    reviewer: `${reviewer.username}:${reviewer.role}`,
    note: String(note || '').trim(),
    export_receipt: {
      id: bundleExport.id,
      receipt_hash: bundleExport.receipt_hash,
      requester: bundleExport.requester,
      bundle_manifest_hash: bundleExport.bundle_manifest_hash,
      bundle_packet_hash: bundleExport.bundle_packet_hash,
      filters: bundleExport.filters || {},
      manifest_entry_count: bundleExport.manifest_entries?.length || 0,
      reference_counts: bundleExport.reference_counts || {},
      created_at: bundleExport.created_at
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_export_review_receipt'
  };
  receipt.receipt_hash = bundleExportReviewReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_packet_bundle_export_reviews (
       bundle_export_id,
       receipt_hash,
       bundle_export_receipt_hash,
       reviewer_username,
       reviewer_role,
       action,
       purpose,
       decision,
       note,
       bundle_manifest_hash,
       bundle_packet_hash,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     RETURNING id, bundle_export_id, receipt_hash, bundle_export_receipt_hash, reviewer_username, reviewer_role,
       action, purpose, decision, note, bundle_manifest_hash, bundle_packet_hash, receipt, created_at`,
    [
      bundleExport.id,
      receipt.receipt_hash,
      bundleExport.receipt_hash,
      reviewer.username,
      reviewer.role,
      normalizedAction,
      normalizedPurpose,
      normalizedDecision,
      receipt.note,
      bundleExport.bundle_manifest_hash,
      bundleExport.bundle_packet_hash,
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleExportReview(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleExportReviews(
  { limit = 20, export_receipt_hash: exportReceiptHash = '', reviewer = '', decision = '', purpose = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (exportReceiptHash) {
    params.push(`%${String(exportReceiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR bundle_export_receipt_hash ILIKE $${params.length})`);
  }
  if (reviewer) {
    params.push(String(reviewer).trim());
    where.push(`reviewer_username = $${params.length}`);
  }
  if (decision) {
    params.push(normalizeBundleExportReviewDecision(decision));
    where.push(`decision = $${params.length}`);
  }
  if (purpose) {
    params.push(normalizeBundleExportReviewPurpose(purpose));
    where.push(`purpose = $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, bundle_export_id, receipt_hash, bundle_export_receipt_hash, reviewer_username, reviewer_role,
       action, purpose, decision, note, bundle_manifest_hash, bundle_packet_hash, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_export_reviews
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeBundleExportReview);
}

export async function getOpsAuditEvidenceCasePacketBundleExportReview(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle export review receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_review_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, bundle_export_id, receipt_hash, bundle_export_receipt_hash, reviewer_username, reviewer_role,
       action, purpose, decision, note, bundle_manifest_hash, bundle_packet_hash, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_export_reviews
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle export review receipt was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_export_review_not_found';
    throw error;
  }
  return normalizeBundleExportReview(result.rows[0]);
}

export function verifyOpsAuditEvidenceCasePacketBundle(bundle = {}, signingSecret) {
  const expectedEntries = bundleManifestEntriesFor(bundle);
  const expectedManifest = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-manifest-v1',
    entries: expectedEntries
  };
  const computedManifestHash = digestValue(expectedManifest);
  const providedEntries = Array.isArray(bundle.manifest?.entries) ? bundle.manifest.entries : [];
  const entryResults = expectedEntries.map((expected, index) => {
    const provided = providedEntries[index] || {};
    return {
      path: expected.path,
      type: expected.type,
      expected_sha256: expected.sha256,
      provided_sha256: provided.sha256 || '',
      expected_item_count: expected.item_count ?? null,
      provided_item_count: provided.item_count ?? null,
      path_matches: provided.path === expected.path,
      type_matches: provided.type === expected.type,
      sha256_matches: provided.sha256 === expected.sha256,
      item_count_matches: (provided.item_count ?? null) === (expected.item_count ?? null)
    };
  });
  const extraEntries = providedEntries.slice(expectedEntries.length).map((entry) => entry.path || 'unknown');
  const expectedSignature = evidenceBundleSignature(
    {
      manifest_hash: computedManifestHash,
      packet_hash: bundle.packet_hash,
      requested_by: bundle.requested_by
    },
    signingSecret
  );
  const checks = {
    bundle_schema_matches: bundle.schema_version === 'phase4-ops-audit-evidence-case-packet-signed-bundle-v1',
    watermark_matches: bundle.watermark === 'internal_ops_audit_evidence_case_packet_signed_bundle',
    packet_hash_matches: Boolean(bundle.packet_hash && bundle.packet_hash === bundle.packet?.packet_hash),
    manifest_schema_matches: bundle.manifest?.schema_version === expectedManifest.schema_version,
    manifest_entries_match: providedEntries.length === expectedEntries.length &&
      entryResults.every((entry) => entry.path_matches && entry.type_matches && entry.item_count_matches) &&
      extraEntries.length === 0,
    entry_hashes_match: entryResults.every((entry) => entry.sha256_matches),
    manifest_hash_matches: bundle.manifest_hash === computedManifestHash,
    signature_algorithm_supported: bundle.signature?.algorithm === expectedSignature.algorithm,
    signature_matches: bundle.signature?.signature === expectedSignature.signature
  };
  const valid = Object.values(checks).every(Boolean);
  return {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-verification-v1',
    verified_at: new Date().toISOString(),
    valid,
    bundle_schema_version: bundle.schema_version || null,
    requested_by: bundle.requested_by || null,
    packet_hash: bundle.packet_hash || null,
    manifest_hash: bundle.manifest_hash || null,
    computed_manifest_hash: computedManifestHash,
    signature_algorithm: bundle.signature?.algorithm || null,
    expected_signature_algorithm: expectedSignature.algorithm,
    checks,
    entry_results: entryResults,
    extra_manifest_entries: extraEntries,
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_verification'
  };
}

export async function recordOpsAuditEvidenceCasePacketBundleVerification(
  { bundle = {}, verifier, signing_secret: signingSecret } = {},
  client = pool
) {
  if (!verifier?.username) {
    const error = new Error('Evidence case packet bundle verification actor is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_verification_actor_required';
    throw error;
  }
  const verification = verifyOpsAuditEvidenceCasePacketBundle(bundle, signingSecret);
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-verification-receipt-v1',
    generated_at: new Date().toISOString(),
    verifier: `${verifier.username}:${verifier.role}`,
    bundle: {
      schema_version: bundle.schema_version || null,
      requested_by: bundle.requested_by || null,
      packet_hash: bundle.packet_hash || null,
      manifest_hash: bundle.manifest_hash || null,
      signature_algorithm: bundle.signature?.algorithm || null,
      manifest_entry_count: Array.isArray(bundle.manifest?.entries) ? bundle.manifest.entries.length : 0
    },
    verification: {
      schema_version: verification.schema_version,
      verified_at: verification.verified_at,
      valid: verification.valid,
      computed_manifest_hash: verification.computed_manifest_hash,
      expected_signature_algorithm: verification.expected_signature_algorithm,
      checks: verification.checks,
      entry_results: verification.entry_results,
      extra_manifest_entries: verification.extra_manifest_entries
    },
    watermark: 'internal_ops_audit_evidence_case_packet_bundle_verification_receipt'
  };
  receipt.receipt_hash = bundleVerificationReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_packet_bundle_verifications (
       receipt_hash,
       verifier_username,
       verifier_role,
       bundle_manifest_hash,
       bundle_packet_hash,
       bundle_requested_by,
       valid,
       checks,
       entry_results,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb)
     RETURNING id, receipt_hash, verifier_username, verifier_role, bundle_manifest_hash, bundle_packet_hash,
       bundle_requested_by, valid, checks, entry_results, receipt, created_at`,
    [
      receipt.receipt_hash,
      verifier.username,
      verifier.role,
      verification.manifest_hash,
      verification.packet_hash,
      verification.requested_by,
      verification.valid,
      JSON.stringify(verification.checks || {}),
      JSON.stringify(verification.entry_results || []),
      JSON.stringify(receipt)
    ]
  );
  return normalizeBundleVerification(result.rows[0]);
}

export async function listOpsAuditEvidenceCasePacketBundleVerifications({ limit = 20, valid } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const validFilter = valid === undefined || valid === null || valid === ''
    ? null
    : ['true', '1', 'yes', true].includes(valid);
  const params = validFilter === null ? [normalizedLimit] : [validFilter, normalizedLimit];
  const result = await client.query(
    validFilter === null
      ? `SELECT id, receipt_hash, verifier_username, verifier_role, bundle_manifest_hash, bundle_packet_hash,
           bundle_requested_by, valid, checks, entry_results, receipt, created_at
         FROM internal_ops_audit_evidence_case_packet_bundle_verifications
         ORDER BY created_at DESC
         LIMIT $1`
      : `SELECT id, receipt_hash, verifier_username, verifier_role, bundle_manifest_hash, bundle_packet_hash,
           bundle_requested_by, valid, checks, entry_results, receipt, created_at
         FROM internal_ops_audit_evidence_case_packet_bundle_verifications
         WHERE valid = $1
         ORDER BY created_at DESC
         LIMIT $2`,
    params
  );
  return result.rows.map(normalizeBundleVerification);
}

export async function getOpsAuditEvidenceCasePacketBundleVerification(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case packet bundle verification identifier is required.');
    error.code = 'ops_audit_evidence_case_packet_bundle_verification_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, receipt_hash, verifier_username, verifier_role, bundle_manifest_hash, bundle_packet_hash,
       bundle_requested_by, valid, checks, entry_results, receipt, created_at
     FROM internal_ops_audit_evidence_case_packet_bundle_verifications
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case packet bundle verification was not found.');
    error.code = 'ops_audit_evidence_case_packet_bundle_verification_not_found';
    throw error;
  }
  return normalizeBundleVerification(result.rows[0]);
}

export function buildOpsAuditEvidenceCasePacketHtml(packet) {
  const rows = (packet.evidence_chain?.items || [])
    .map((item) => {
      const archive = item.archive || {};
      const verification = item.verification || {};
      const retentionReceipt = item.retention_receipt || {};
      const anomalyRetentionReceipt = item.anomaly_digest_retention_receipt || {};
      const bundleVerification = item.bundle_verification || {};
      const bundleExport = item.bundle_export || {};
      const bundleExportReview = item.bundle_export_review || {};
      const bundleDeliveryGate = item.bundle_delivery_gate || {};
      const bundleHandoffPreview = item.bundle_handoff_preview || {};
      const bundleFinalApproval = item.bundle_final_approval || {};
      const failed = item.failed_checks?.length ? item.failed_checks.join(', ') : 'none';
      const reportLabel = item.type === 'bundle_verification_receipt'
        ? `bundle verification ${bundleVerification.valid ? 'valid' : 'failed'}`
        : item.type === 'bundle_export_receipt'
          ? 'bundle export'
          : item.type === 'bundle_export_review_receipt'
            ? `bundle export review ${bundleExportReview.decision || ''}`.trim()
            : item.type === 'bundle_delivery_gate_receipt'
              ? `delivery gate ${bundleDeliveryGate.decision || ''}`.trim()
              : item.type === 'bundle_handoff_preview_receipt'
                ? `handoff preview ${bundleHandoffPreview.status || ''}`.trim()
                : item.type === 'bundle_final_approval_receipt'
                  ? `final approval ${bundleFinalApproval.decision || ''}`.trim()
                  : item.type === 'digest_retention_receipt'
                    ? `digest retention ${retentionReceipt.mode || ''}`.trim()
                    : item.type === 'anomaly_digest_retention_receipt'
                      ? `anomaly digest retention ${anomalyRetentionReceipt.mode || ''}`.trim()
                      : archive.report_id || '';
      const receiptHash = verification.receipt_hash ||
        retentionReceipt.receipt_hash ||
        anomalyRetentionReceipt.receipt_hash ||
        bundleVerification.receipt_hash ||
        bundleExport.receipt_hash ||
        bundleExportReview.receipt_hash ||
        bundleDeliveryGate.receipt_hash ||
        bundleHandoffPreview.receipt_hash ||
        bundleFinalApproval.receipt_hash ||
        '';
      const actor = verification.verifier ||
        retentionReceipt.requested_by ||
        anomalyRetentionReceipt.requested_by ||
        bundleVerification.verifier ||
        bundleExport.requester ||
        bundleExportReview.reviewer ||
        bundleDeliveryGate.recorder ||
        bundleHandoffPreview.recorder ||
        bundleFinalApproval.recorder ||
        '';
      const failedOrCounts = item.type === 'bundle_verification_receipt'
        ? failed
        : item.type === 'bundle_export_receipt'
          ? `entries ${bundleExport.manifest_entry_count || 0}; archives ${bundleExport.reference_counts?.archives || 0}; verifications ${bundleExport.reference_counts?.verification_receipts || 0}; bundle receipts ${bundleExport.reference_counts?.bundle_verification_references || 0}`
          : item.type === 'bundle_export_review_receipt'
            ? `${bundleExportReview.action || 'reviewed'}; ${bundleExportReview.purpose || 'internal'}; export ${String(bundleExportReview.bundle_export_receipt_hash || '').slice(0, 16)}`
            : item.type === 'bundle_delivery_gate_receipt'
              ? `${bundleDeliveryGate.reason || 'delivery_readiness_missing'}; readiness ${bundleDeliveryGate.readiness_status || 'unknown'}; deliver ${bundleDeliveryGate.can_deliver ? 'yes' : 'no'}`
              : item.type === 'bundle_handoff_preview_receipt'
                ? `${bundleHandoffPreview.reason || 'handoff_preview_missing'}; handoff ${bundleHandoffPreview.can_handoff ? 'yes' : 'no'}; preview ${String(bundleHandoffPreview.preview_hash || '').slice(0, 16)}`
                : item.type === 'bundle_final_approval_receipt'
                  ? `${bundleFinalApproval.reason || 'final_approval_missing'}; approve ${bundleFinalApproval.can_approve ? 'yes' : 'no'}; preview ${String(bundleFinalApproval.approval_preview_hash || '').slice(0, 16)}`
                  : item.type === 'digest_retention_receipt'
                    ? `retained ${retentionReceipt.retained_count || 0}; eligible ${retentionReceipt.eligible_count || 0}; deleted ${retentionReceipt.deleted_count || 0}`
                    : item.type === 'anomaly_digest_retention_receipt'
                      ? `retained ${anomalyRetentionReceipt.retained_count || 0}; eligible ${anomalyRetentionReceipt.eligible_count || 0}; deleted ${anomalyRetentionReceipt.deleted_count || 0}`
                      : failed;
      return `
        <tr>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(reportLabel)}</td>
          <td>${escapeHtml(String(archive.report_hash || bundleVerification.bundle_manifest_hash || bundleExport.bundle_manifest_hash || bundleExportReview.bundle_manifest_hash || bundleDeliveryGate.packet_hash || bundleHandoffPreview.packet_hash || bundleFinalApproval.packet_hash || '').slice(0, 16))}</td>
          <td>${escapeHtml(receiptHash ? String(receiptHash).slice(0, 16) : '')}</td>
          <td>${escapeHtml(actor)}</td>
          <td>${escapeHtml(failedOrCounts)}</td>
        </tr>
      `;
    })
    .join('');
  const recommendations = (packet.recommendations || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Evidence Case Packet</title>
  <style>
    body { color: #172018; font-family: Arial, sans-serif; margin: 32px; }
    h1, h2 { margin: 0 0 12px; }
    .meta { border: 1px solid #d8ddd3; display: grid; gap: 6px; margin: 18px 0; padding: 14px; }
    .watermark { color: #51705b; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    table { border-collapse: collapse; margin-top: 12px; width: 100%; }
    th, td { border: 1px solid #d8ddd3; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f5ef; }
    .anomaly { color: #9b2f2f; font-weight: 700; }
  </style>
</head>
<body>
  <p class="watermark">${escapeHtml(packet.watermark)}</p>
  <h1>Evidence Case Packet</h1>
  <div class="meta">
    <span>Generated at: ${escapeHtml(packet.generated_at)}</span>
    <span>Requested by: ${escapeHtml(packet.requested_by)}</span>
    <span>Packet hash: ${escapeHtml(packet.packet_hash)}</span>
    <span>Delivery readiness: ${escapeHtml(packet.delivery_readiness?.delivery_status || 'no_exports')} · Eligible exports: ${escapeHtml(packet.delivery_readiness?.counts?.eligible_exports || 0)} · Needs review: ${escapeHtml(packet.delivery_readiness?.counts?.needs_review_exports || 0)} · Blocked: ${escapeHtml(packet.delivery_readiness?.counts?.blocked_exports || 0)}</span>
    <span>Delivery gate: ${escapeHtml(packet.delivery_gate?.decision || 'deny')} · ${escapeHtml(packet.delivery_gate?.reason || 'delivery_readiness_missing')} · ${escapeHtml(packet.delivery_gate?.explanation || '')}</span>
    <span>Total items: ${escapeHtml(packet.summary?.total_items || 0)} · Verifications: ${escapeHtml(packet.summary?.verification_count || 0)} · Retention receipts: ${escapeHtml(packet.summary?.retention_receipt_count || 0)} · Anomaly retention receipts: ${escapeHtml(packet.summary?.anomaly_digest_retention_receipt_count || 0)} · Bundle exports: ${escapeHtml(packet.summary?.bundle_export_receipt_count || 0)} · Bundle export reviews: ${escapeHtml(packet.summary?.bundle_export_review_receipt_count || 0)} · Delivery gate receipts: ${escapeHtml(packet.summary?.bundle_delivery_gate_receipt_count || 0)} · Handoff receipts: ${escapeHtml(packet.summary?.bundle_handoff_preview_receipt_count || 0)} · Final approval receipts: ${escapeHtml(packet.summary?.bundle_final_approval_receipt_count || 0)} · <span class="anomaly">Anomalies: ${escapeHtml(packet.summary?.anomaly_count || 0)}</span></span>
    <span>Filters: ${escapeHtml(JSON.stringify(packet.filters || {}))}</span>
  </div>
  <h2>Recommendations</h2>
  <ul>${recommendations}</ul>
  <h2>Evidence Chain</h2>
  <table>
    <thead>
      <tr><th>Status</th><th>Report ID</th><th>Report hash</th><th>Receipt hash</th><th>Verifier</th><th>Failed checks</th></tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="6">No evidence chain items matched the filters.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

export async function createOpsAuditEvidenceCaseReview(
  { filters = {}, actor = {}, assignee = null, status = 'open', priority = 'normal', due_at: dueAt = null } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case review actor is required.');
    error.code = 'ops_audit_evidence_case_actor_required';
    throw error;
  }
  const packet = await getOpsAuditEvidenceCasePacket(filters, actor, client);
  const openedBy = actorParts(actor);
  const assigned = normalizeAssignee(assignee);
  const normalizedStatus = normalizeCaseStatus(status);
  const normalizedPriority = normalizeCasePriority(priority);
  const normalizedDueAt = normalizeCaseDueAt(dueAt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_reviews (
       packet_hash,
       packet,
       filters,
       summary,
       status,
       priority,
       due_at,
       assignee_username,
       assignee_role,
       opened_by_username,
       opened_by_role,
       updated_by_username,
       updated_by_role,
       resolved_by_username,
       resolved_by_role,
       resolved_at
     )
     VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13,
       CASE WHEN $5 IN ('resolved', 'dismissed') THEN $10 ELSE NULL END,
       CASE WHEN $5 IN ('resolved', 'dismissed') THEN $11 ELSE NULL END,
       CASE WHEN $5 IN ('resolved', 'dismissed') THEN NOW() ELSE NULL END)
     ON CONFLICT (packet_hash) DO UPDATE
       SET packet = EXCLUDED.packet,
           filters = EXCLUDED.filters,
           summary = EXCLUDED.summary,
           status = EXCLUDED.status,
           priority = EXCLUDED.priority,
           due_at = EXCLUDED.due_at,
           assignee_username = EXCLUDED.assignee_username,
           assignee_role = EXCLUDED.assignee_role,
           updated_by_username = EXCLUDED.updated_by_username,
           updated_by_role = EXCLUDED.updated_by_role,
           resolved_by_username = EXCLUDED.resolved_by_username,
           resolved_by_role = EXCLUDED.resolved_by_role,
           resolved_at = EXCLUDED.resolved_at,
           updated_at = NOW()
     RETURNING id, packet_hash, packet, filters, summary, status, priority, due_at, assignee_username, assignee_role,
       resolution_note, opened_by_username, opened_by_role, updated_by_username, updated_by_role,
       resolved_by_username, resolved_by_role, resolved_at, created_at, updated_at`,
    [
      packet.packet_hash,
      JSON.stringify(packet),
      JSON.stringify(packet.filters || {}),
      JSON.stringify(packet.summary || {}),
      normalizedStatus,
      normalizedPriority,
      normalizedDueAt,
      assigned.username,
      assigned.role,
      openedBy.username,
      openedBy.role,
      openedBy.username,
      openedBy.role
    ]
  );
  return normalizeEvidenceCaseReview(result.rows[0]);
}

export function buildEvidenceCaseReviewSummary(cases = []) {
  return cases.reduce(
    (summary, review) => {
      summary.total_cases += 1;
      summary.by_status[review.status] = (summary.by_status[review.status] || 0) + 1;
      summary.by_priority[review.priority] = (summary.by_priority[review.priority] || 0) + 1;
      summary.by_sla[review.sla.status] = (summary.by_sla[review.sla.status] || 0) + 1;
      if (review.sla.overdue) summary.overdue_count += 1;
      if (review.sla.due_soon) summary.due_soon_count += 1;
      return summary;
    },
    {
      total_cases: 0,
      overdue_count: 0,
      due_soon_count: 0,
      by_status: {},
      by_priority: {},
      by_sla: {}
    }
  );
}

export async function listOpsAuditEvidenceCaseReviews({ limit = 20, status = '', assignee = '', priority = '', sla_status: slaStatus = '' } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (status) {
    params.push(normalizeCaseStatus(status));
    where.push(`status = $${params.length}`);
  }
  if (assignee) {
    params.push(String(assignee).trim());
    where.push(`assignee_username = $${params.length}`);
  }
  if (priority) {
    params.push(normalizeCasePriority(priority));
    where.push(`priority = $${params.length}`);
  }
  params.push(Math.max(normalizedLimit * 3, normalizedLimit));
  const result = await client.query(
    `SELECT id, packet_hash, packet, filters, summary, status, priority, due_at, assignee_username, assignee_role,
       resolution_note, opened_by_username, opened_by_role, updated_by_username, updated_by_role,
       resolved_by_username, resolved_by_role, resolved_at, created_at, updated_at
     FROM internal_ops_audit_evidence_case_reviews
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updated_at DESC
     LIMIT $${params.length}`,
    params
  );
  const reviews = result.rows.map(normalizeEvidenceCaseReview);
  const filtered = slaStatus
    ? reviews.filter((review) => review.sla.status === String(slaStatus).trim().toLowerCase())
    : reviews;
  return filtered.slice(0, normalizedLimit);
}

export async function getOpsAuditEvidenceCaseReview(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case review id is required.');
    error.code = 'ops_audit_evidence_case_id_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, packet_hash, packet, filters, summary, status, priority, due_at, assignee_username, assignee_role,
       resolution_note, opened_by_username, opened_by_role, updated_by_username, updated_by_role,
       resolved_by_username, resolved_by_role, resolved_at, created_at, updated_at
     FROM internal_ops_audit_evidence_case_reviews
     WHERE id::text = $1 OR packet_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case review was not found.');
    error.code = 'ops_audit_evidence_case_not_found';
    throw error;
  }
  return normalizeEvidenceCaseReview(result.rows[0]);
}

export async function updateOpsAuditEvidenceCaseReview(id, updates = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case review actor is required.');
    error.code = 'ops_audit_evidence_case_actor_required';
    throw error;
  }
  const normalizedId = String(id || '').trim();
  if (!normalizedId) {
    const error = new Error('Evidence case review id is required.');
    error.code = 'ops_audit_evidence_case_id_required';
    throw error;
  }
  const actorInfo = actorParts(actor);
  const status = updates.status !== undefined ? normalizeCaseStatus(updates.status) : null;
  const assignee = updates.assignee !== undefined ? normalizeAssignee(updates.assignee) : null;
  const resolutionNote = updates.resolution_note !== undefined ? String(updates.resolution_note || '').trim() : null;
  const priority = updates.priority !== undefined ? normalizeCasePriority(updates.priority) : null;
  const dueAt = updates.due_at !== undefined ? normalizeCaseDueAt(updates.due_at) : undefined;
  const result = await client.query(
    `UPDATE internal_ops_audit_evidence_case_reviews
     SET status = COALESCE($2, status),
         assignee_username = CASE WHEN $3::boolean THEN $4 ELSE assignee_username END,
         assignee_role = CASE WHEN $3::boolean THEN $5 ELSE assignee_role END,
         resolution_note = CASE WHEN $6::boolean THEN $7 ELSE resolution_note END,
         updated_by_username = $8,
         updated_by_role = $9,
         priority = COALESCE($10, priority),
         due_at = CASE WHEN $11::boolean THEN $12 ELSE due_at END,
         resolved_by_username = CASE WHEN COALESCE($2, status) IN ('resolved', 'dismissed') THEN $8 ELSE NULL END,
         resolved_by_role = CASE WHEN COALESCE($2, status) IN ('resolved', 'dismissed') THEN $9 ELSE NULL END,
         resolved_at = CASE
           WHEN COALESCE($2, status) IN ('resolved', 'dismissed') THEN COALESCE(resolved_at, NOW())
           ELSE NULL
         END,
         updated_at = NOW()
     WHERE id::text = $1 OR packet_hash = $1
     RETURNING id, packet_hash, packet, filters, summary, status, priority, due_at, assignee_username, assignee_role,
       resolution_note, opened_by_username, opened_by_role, updated_by_username, updated_by_role,
       resolved_by_username, resolved_by_role, resolved_at, created_at, updated_at`,
    [
      normalizedId,
      status,
      updates.assignee !== undefined,
      assignee?.username || null,
      assignee?.role || null,
      updates.resolution_note !== undefined,
      resolutionNote,
      actorInfo.username,
      actorInfo.role,
      priority,
      updates.due_at !== undefined,
      dueAt
    ]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case review was not found.');
    error.code = 'ops_audit_evidence_case_not_found';
    throw error;
  }
  return normalizeEvidenceCaseReview(result.rows[0]);
}

function caseReviewActionFromStatus(status, fallback = 'updated') {
  if (status === 'resolved') return 'resolved';
  if (status === 'dismissed') return 'dismissed';
  return fallback;
}

function bundleVerificationReferencesForReview(review) {
  return (review.packet?.references?.bundle_verifications || []).map((receipt) => ({
    id: receipt.id,
    receipt_hash: receipt.receipt_hash,
    verifier: receipt.verifier,
    valid: receipt.valid,
    bundle_manifest_hash: receipt.bundle_manifest_hash,
    bundle_packet_hash: receipt.bundle_packet_hash,
    bundle_requested_by: receipt.bundle_requested_by,
    failed_checks: receipt.failed_checks || [],
    at: receipt.at
  }));
}

export async function recordOpsAuditEvidenceCaseReviewReceipt(
  { review, action = 'updated', previous_status: previousStatus = null, reviewer = {}, note = '' } = {},
  client = pool
) {
  if (!review?.id || !review?.packet_hash) {
    const error = new Error('Evidence case review receipt requires a review.');
    error.code = 'ops_audit_evidence_case_review_receipt_review_required';
    throw error;
  }
  if (!reviewer?.username || !reviewer?.role) {
    const error = new Error('Evidence case review receipt reviewer is required.');
    error.code = 'ops_audit_evidence_case_review_receipt_reviewer_required';
    throw error;
  }
  const normalizedAction = String(action || 'updated').trim().toLowerCase();
  if (!new Set(['opened', 'updated', 'resolved', 'dismissed']).has(normalizedAction)) {
    const error = new Error('Evidence case review receipt action is invalid.');
    error.code = 'ops_audit_evidence_case_review_receipt_action_invalid';
    throw error;
  }
  const reviewedAt = new Date().toISOString();
  const bundleVerificationReceipts = bundleVerificationReferencesForReview(review);
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-review-receipt-v1',
    reviewed_at: reviewedAt,
    action: normalizedAction,
    case: {
      id: review.id,
      packet_hash: review.packet_hash,
      status: review.status,
      previous_status: previousStatus || null,
      priority: review.priority,
      due_at: review.due_at,
      sla: review.sla || {},
      assignee: review.assignee,
      filters: review.filters || {},
      summary: review.summary || {},
      resolution_note: review.resolution_note || null,
      resolved_by: review.resolved_by || null,
      resolved_at: review.resolved_at || null
    },
    reviewer: `${reviewer.username}:${reviewer.role}`,
    note: String(note || review.resolution_note || '').trim(),
    references: {
      bundle_verifications: bundleVerificationReceipts
    },
    watermark: 'internal_ops_audit_evidence_case_review_receipt'
  };
  receipt.receipt_hash = evidenceCaseReviewReceiptHash(receipt);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_review_receipts (
       case_id,
       receipt_hash,
       reviewer_username,
       reviewer_role,
       action,
       previous_status,
       status,
       packet_hash,
       bundle_verification_receipts,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
     RETURNING id, case_id, receipt_hash, reviewer_username, reviewer_role, action, previous_status, status,
       packet_hash, bundle_verification_receipts, receipt, created_at`,
    [
      review.id,
      receipt.receipt_hash,
      reviewer.username,
      reviewer.role,
      normalizedAction,
      previousStatus,
      review.status,
      review.packet_hash,
      JSON.stringify(bundleVerificationReceipts),
      JSON.stringify(receipt)
    ]
  );
  return normalizeEvidenceCaseReviewReceipt(result.rows[0]);
}

export async function listOpsAuditEvidenceCaseReviewReceipts(
  { limit = 20, case_id: caseId = '', packet_hash: packetHash = '', receipt_hash: receiptHash = '', status = '', reviewer = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (caseId) {
    params.push(String(caseId).trim());
    where.push(`case_id::text = $${params.length}`);
  }
  if (packetHash) {
    params.push(String(packetHash).trim());
    where.push(`packet_hash = $${params.length}`);
  }
  if (receiptHash) {
    params.push(`%${String(receiptHash).trim()}%`);
    where.push(`(receipt_hash ILIKE $${params.length} OR bundle_verification_receipts::text ILIKE $${params.length})`);
  }
  if (status) {
    params.push(normalizeCaseStatus(status));
    where.push(`status = $${params.length}`);
  }
  if (reviewer) {
    params.push(String(reviewer).trim());
    where.push(`reviewer_username = $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, case_id, receipt_hash, reviewer_username, reviewer_role, action, previous_status, status,
       packet_hash, bundle_verification_receipts, receipt, created_at
     FROM internal_ops_audit_evidence_case_review_receipts
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeEvidenceCaseReviewReceipt);
}

export async function getOpsAuditEvidenceCaseReviewReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case review receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_review_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, case_id, receipt_hash, reviewer_username, reviewer_role, action, previous_status, status,
       packet_hash, bundle_verification_receipts, receipt, created_at
     FROM internal_ops_audit_evidence_case_review_receipts
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case review receipt was not found.');
    error.code = 'ops_audit_evidence_case_review_receipt_not_found';
    throw error;
  }
  return normalizeEvidenceCaseReviewReceipt(result.rows[0]);
}

function evidenceCaseNotificationMessage(review, kind) {
  const due = review.due_at ? ` due ${review.due_at}` : '';
  const assignee = review.assignee ? ` assigned to ${review.assignee}` : ' unassigned';
  const bundleReceipt = firstBundleVerificationReference(review)?.receipt_hash;
  const prefix = bundleReceipt ? `Bundle anomaly review ${bundleReceipt.slice(0, 12)}` : `Evidence case ${review.packet_hash.slice(0, 12)}`;
  return `${prefix} is ${kind}${due}; priority ${review.priority};${assignee}.`;
}

function firstBundleVerificationReference(review) {
  return (review.packet?.references?.bundle_verifications || [])[0] || null;
}

function evidenceCaseNotificationCaseKind(review) {
  return firstBundleVerificationReference(review) ? 'bundle_anomaly_review' : 'evidence_case';
}

function normalizeEvidenceCaseNotification(row) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-notification-v1',
    id: row.id,
    case_id: row.case_id,
    kind: row.kind,
    case_kind: row.case_kind || 'evidence_case',
    status: row.status,
    priority: row.priority || 'normal',
    due_at: row.due_at || null,
    bundle_verification_receipt_hash: row.bundle_verification_receipt_hash || null,
    message: row.message,
    generated_by: `${row.generated_by_username}:${row.generated_by_role}`,
    acknowledged_by: row.acknowledged_by_username ? `${row.acknowledged_by_username}:${row.acknowledged_by_role}` : null,
    acknowledged_at: row.acknowledged_at || null,
    snoozed_until: row.snoozed_until || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    case: row.case_packet_hash
      ? {
          id: row.case_id,
          packet_hash: row.case_packet_hash,
          status: row.case_status,
          assignee: row.case_assignee_username
            ? `${row.case_assignee_username}:${row.case_assignee_role || 'unknown'}`
            : null
        }
      : null
  };
}

export function buildEvidenceCaseNotificationSummary(notifications = []) {
  return notifications.reduce(
    (summary, notification) => {
      summary.total_notifications += 1;
      summary.by_status[notification.status] = (summary.by_status[notification.status] || 0) + 1;
      summary.by_kind[notification.kind] = (summary.by_kind[notification.kind] || 0) + 1;
      summary.by_case_kind[notification.case_kind] = (summary.by_case_kind[notification.case_kind] || 0) + 1;
      if (notification.status === 'open') summary.open_count += 1;
      if (notification.status === 'snoozed') summary.snoozed_count += 1;
      if (notification.case_kind === 'bundle_anomaly_review') summary.bundle_anomaly_count += 1;
      return summary;
    },
    {
      total_notifications: 0,
      open_count: 0,
      snoozed_count: 0,
      bundle_anomaly_count: 0,
      by_status: {},
      by_kind: {},
      by_case_kind: {}
    }
  );
}

export async function generateOpsAuditEvidenceCaseNotifications({ actor = {}, limit = 50, case_kind: caseKind = '' } = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification actor is required.');
    error.code = 'ops_audit_evidence_case_notification_actor_required';
    throw error;
  }
  const normalizedCaseKind = normalizeNotificationCaseKind(caseKind);
  const reviews = await listOpsAuditEvidenceCaseReviews({ limit: Math.max(Number(limit) || 50, 50) }, client);
  const candidates = reviews.filter((review) => {
    if (review.sla.status !== 'overdue' && review.sla.status !== 'due_soon') return false;
    return !normalizedCaseKind || evidenceCaseNotificationCaseKind(review) === normalizedCaseKind;
  });
  const generated = [];
  for (const review of candidates.slice(0, Math.min(Number(limit) || 50, 100))) {
    const kind = review.sla.status;
    const message = evidenceCaseNotificationMessage(review, kind);
    const reviewCaseKind = evidenceCaseNotificationCaseKind(review);
    const bundleReceipt = firstBundleVerificationReference(review);
    const result = await client.query(
      `INSERT INTO internal_ops_audit_evidence_case_notifications (
         case_id,
         kind,
         case_kind,
         status,
         priority,
         due_at,
         bundle_verification_receipt_hash,
         message,
         generated_by_username,
         generated_by_role
       )
       VALUES ($1, $2, $3, 'open', $4, $5, $6, $7, $8, $9)
       ON CONFLICT (case_id, kind) DO UPDATE
         SET case_kind = EXCLUDED.case_kind,
             priority = EXCLUDED.priority,
             due_at = EXCLUDED.due_at,
             bundle_verification_receipt_hash = EXCLUDED.bundle_verification_receipt_hash,
             message = EXCLUDED.message,
             status = CASE
               WHEN internal_ops_audit_evidence_case_notifications.status = 'acked' THEN 'acked'
               WHEN internal_ops_audit_evidence_case_notifications.status = 'snoozed'
                 AND internal_ops_audit_evidence_case_notifications.snoozed_until > NOW()
               THEN 'snoozed'
               ELSE 'open'
             END,
             updated_at = NOW()
       RETURNING id, case_id, kind, case_kind, status, priority, due_at, bundle_verification_receipt_hash, message, generated_by_username, generated_by_role,
         acknowledged_by_username, acknowledged_by_role, acknowledged_at, snoozed_until, created_at, updated_at`,
      [
        review.id,
        kind,
        reviewCaseKind,
        review.priority,
        review.due_at,
        bundleReceipt?.receipt_hash || null,
        message,
        actor.username,
        actor.role
      ]
    );
    generated.push(normalizeEvidenceCaseNotification(result.rows[0]));
  }
  return generated;
}

export async function listOpsAuditEvidenceCaseNotifications({ limit = 20, status = '', kind = '', case_kind: caseKind = '' } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (status) {
    params.push(normalizeNotificationStatus(status));
    where.push(`n.status = $${params.length}`);
  }
  if (kind) {
    params.push(normalizeNotificationKind(kind));
    where.push(`n.kind = $${params.length}`);
  }
  if (caseKind) {
    params.push(normalizeNotificationCaseKind(caseKind));
    where.push(`n.case_kind = $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT n.id, n.case_id, n.kind, n.case_kind, n.status, n.priority, n.due_at,
       n.bundle_verification_receipt_hash, n.message,
       n.generated_by_username, n.generated_by_role, n.acknowledged_by_username, n.acknowledged_by_role,
       n.acknowledged_at, n.snoozed_until, n.created_at, n.updated_at,
       c.packet_hash AS case_packet_hash, c.status AS case_status,
       c.assignee_username AS case_assignee_username, c.assignee_role AS case_assignee_role
     FROM internal_ops_audit_evidence_case_notifications n
     LEFT JOIN internal_ops_audit_evidence_case_reviews c ON c.id = n.case_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY n.updated_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeEvidenceCaseNotification);
}

export async function updateOpsAuditEvidenceCaseNotification(id, updates = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification actor is required.');
    error.code = 'ops_audit_evidence_case_notification_actor_required';
    throw error;
  }
  const normalizedId = String(id || '').trim();
  if (!normalizedId) {
    const error = new Error('Evidence case notification id is required.');
    error.code = 'ops_audit_evidence_case_notification_id_required';
    throw error;
  }
  const status = normalizeNotificationStatus(updates.status);
  const snoozedUntil = status === 'snoozed'
    ? normalizeCaseDueAt(updates.snoozed_until || new Date(Date.now() + 60 * 60 * 1000).toISOString())
    : null;
  const result = await client.query(
    `UPDATE internal_ops_audit_evidence_case_notifications n
     SET status = $2,
         acknowledged_by_username = CASE WHEN $2 = 'acked' THEN $3 ELSE acknowledged_by_username END,
         acknowledged_by_role = CASE WHEN $2 = 'acked' THEN $4 ELSE acknowledged_by_role END,
         acknowledged_at = CASE WHEN $2 = 'acked' THEN NOW() ELSE acknowledged_at END,
         snoozed_until = CASE WHEN $2 = 'snoozed' THEN $5::timestamptz ELSE NULL END,
         updated_at = NOW()
     FROM internal_ops_audit_evidence_case_reviews c
     WHERE n.case_id = c.id
       AND (n.id::text = $1 OR n.case_id::text = $1)
     RETURNING n.id, n.case_id, n.kind, n.case_kind, n.status, n.priority, n.due_at,
       n.bundle_verification_receipt_hash, n.message,
       n.generated_by_username, n.generated_by_role, n.acknowledged_by_username, n.acknowledged_by_role,
       n.acknowledged_at, n.snoozed_until, n.created_at, n.updated_at,
       c.packet_hash AS case_packet_hash, c.status AS case_status,
       c.assignee_username AS case_assignee_username, c.assignee_role AS case_assignee_role`,
    [normalizedId, status, actor.username, actor.role, snoozedUntil]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case notification was not found.');
    error.code = 'ops_audit_evidence_case_notification_not_found';
    throw error;
  }
  return normalizeEvidenceCaseNotification(result.rows[0]);
}

function compactAnomalyNotification(notification = {}) {
  return {
    id: notification.id,
    case_id: notification.case_id,
    kind: notification.kind,
    status: notification.status,
    priority: notification.priority,
    due_at: notification.due_at,
    case_kind: notification.case_kind,
    bundle_verification_receipt_hash: notification.bundle_verification_receipt_hash,
    message: notification.message,
    case: notification.case
      ? {
          id: notification.case.id,
          packet_hash: notification.case.packet_hash,
          status: notification.case.status,
          assignee: notification.case.assignee
        }
      : null,
    created_at: notification.created_at,
    updated_at: notification.updated_at
  };
}

function anomalyNotificationDigestRecommendations(summary = {}) {
  const recommendations = [];
  if ((summary.by_kind?.overdue || 0) > 0) {
    recommendations.push('Review overdue bundle anomaly cases before generating external evidence packets.');
  }
  if ((summary.by_status?.open || 0) > 0) {
    recommendations.push('Assign open bundle anomaly reviews to an owner and set a due_at before the next SLA digest.');
  }
  if ((summary.by_status?.snoozed || 0) > 0) {
    recommendations.push('Check snoozed anomaly notifications and confirm the snooze still has an active reviewer.');
  }
  if (!recommendations.length) {
    recommendations.push('Archive this digest with the related bundle verification and review receipts.');
  }
  return recommendations;
}

export function buildOpsAuditEvidenceCaseAnomalyNotificationDigest(
  notifications = [],
  { actor = {}, filters = {}, now = new Date() } = {}
) {
  const compactNotifications = notifications.map(compactAnomalyNotification);
  const summary = buildEvidenceCaseNotificationSummary(compactNotifications);
  summary.by_case_status = compactNotifications.reduce((acc, notification) => {
    const status = notification.case?.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  summary.closed_case_count = (summary.by_case_status.resolved || 0) + (summary.by_case_status.dismissed || 0);
  const digest = {
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-v1',
    generated_at: now.toISOString(),
    requested_by: casePacketActor(actor),
    filters: {
      limit: filters.limit || '',
      status: filters.status || '',
      kind: filters.kind || '',
      case_kind: 'bundle_anomaly_review'
    },
    summary,
    notifications: compactNotifications,
    recommendations: anomalyNotificationDigestRecommendations(summary),
    watermark: 'internal_ops_audit_evidence_case_anomaly_notification_digest'
  };
  digest.digest_hash = digestValue(digest);
  digest.digest_id = `anomaly-sla-digest-${digest.digest_hash.slice(0, 16)}`;
  return digest;
}

export function buildOpsAuditEvidenceCaseAnomalyNotificationDigestHtml(digest) {
  const rows = (digest.notifications || [])
    .map((notification) => `
      <tr>
        <td>${escapeHtml(notification.kind)}</td>
        <td>${escapeHtml(notification.status)}</td>
        <td>${escapeHtml(notification.priority || '')}</td>
        <td>${escapeHtml(notification.due_at || '')}</td>
        <td>${escapeHtml(String(notification.bundle_verification_receipt_hash || '').slice(0, 16))}</td>
        <td>${escapeHtml(notification.case?.status || '')}</td>
        <td>${escapeHtml(notification.case?.assignee || 'unassigned')}</td>
        <td>${escapeHtml(notification.message || '')}</td>
      </tr>
    `)
    .join('');
  const recommendations = (digest.recommendations || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Anomaly Review SLA Digest</title>
  <style>
    body { color: #172018; font-family: Arial, sans-serif; margin: 32px; }
    h1, h2 { margin: 0 0 12px; }
    .meta { border: 1px solid #d8ddd3; display: grid; gap: 6px; margin: 18px 0; padding: 14px; }
    .watermark { color: #51705b; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    table { border-collapse: collapse; margin-top: 12px; width: 100%; }
    th, td { border: 1px solid #d8ddd3; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f5ef; }
  </style>
</head>
<body>
  <p class="watermark">${escapeHtml(digest.watermark)}</p>
  <h1>Anomaly Review SLA Digest</h1>
  <div class="meta">
    <span>Generated at: ${escapeHtml(digest.generated_at)}</span>
    <span>Requested by: ${escapeHtml(digest.requested_by)}</span>
    <span>Digest hash: ${escapeHtml(digest.digest_hash)}</span>
    <span>Total: ${escapeHtml(digest.summary?.total_notifications || 0)} · Open: ${escapeHtml(digest.summary?.open_count || 0)} · Snoozed: ${escapeHtml(digest.summary?.snoozed_count || 0)} · Bundle anomalies: ${escapeHtml(digest.summary?.bundle_anomaly_count || 0)}</span>
  </div>
  <h2>Recommendations</h2>
  <ul>${recommendations}</ul>
  <h2>Notifications</h2>
  <table>
    <thead>
      <tr><th>Kind</th><th>Status</th><th>Priority</th><th>Due</th><th>Bundle receipt</th><th>Case status</th><th>Assignee</th><th>Message</th></tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="8">No anomaly SLA notifications matched the filters.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

function normalizeAnomalyNotificationDigest(row = {}, { includeDigest = false, includeHtml = false } = {}) {
  const record = {
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-record-v1',
    id: row.id,
    digest_id: row.digest_id,
    digest_hash: row.digest_hash,
    html_hash: row.html_hash,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    filters: row.filters || {},
    summary: row.summary || {},
    recommendations: row.recommendations || [],
    notification_count: Number(row.notification_count || 0),
    created_at: row.created_at
  };
  if (includeDigest) record.digest = row.digest || null;
  if (includeHtml) record.html_snapshot = row.html_snapshot || null;
  return record;
}

export async function createOpsAuditEvidenceCaseAnomalyNotificationDigest(
  { actor = {}, filters = {}, now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case anomaly notification digest actor is required.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_actor_required';
    throw error;
  }
  const notifications = await listOpsAuditEvidenceCaseNotifications(
    {
      limit: filters.limit || 50,
      status: filters.status || '',
      kind: filters.kind || '',
      case_kind: 'bundle_anomaly_review'
    },
    client
  );
  const digest = buildOpsAuditEvidenceCaseAnomalyNotificationDigest(notifications, { actor, filters, now });
  const html = buildOpsAuditEvidenceCaseAnomalyNotificationDigestHtml(digest);
  const htmlHash = hashText(html);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_anomaly_notification_digests (
       digest_id,
       digest_hash,
       html_hash,
       requested_by_username,
       requested_by_role,
       filters,
       summary,
       recommendations,
       digest,
       html_snapshot,
       notification_count
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
     ON CONFLICT (digest_hash) DO UPDATE
       SET html_snapshot = EXCLUDED.html_snapshot
     RETURNING id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role,
       filters, summary, recommendations, digest, html_snapshot, notification_count, created_at`,
    [
      digest.digest_id,
      digest.digest_hash,
      htmlHash,
      actor.username,
      actor.role,
      JSON.stringify(digest.filters || {}),
      JSON.stringify(digest.summary || {}),
      JSON.stringify(digest.recommendations || []),
      JSON.stringify(digest),
      html,
      digest.notifications.length
    ]
  );
  return normalizeAnomalyNotificationDigest(result.rows[0], { includeDigest: true });
}

export async function listOpsAuditEvidenceCaseAnomalyNotificationDigests({ limit = 20 } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const result = await client.query(
    `SELECT id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role,
       filters, summary, recommendations, notification_count, created_at
     FROM internal_ops_audit_evidence_case_anomaly_notification_digests
     ORDER BY created_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows.map((row) => normalizeAnomalyNotificationDigest(row));
}

export async function getOpsAuditEvidenceCaseAnomalyNotificationDigest(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case anomaly notification digest identifier is required.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role,
       filters, summary, recommendations, digest, html_snapshot, notification_count, created_at
     FROM internal_ops_audit_evidence_case_anomaly_notification_digests
     WHERE id::text = $1 OR digest_id = $1 OR digest_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case anomaly notification digest was not found.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_not_found';
    throw error;
  }
  return normalizeAnomalyNotificationDigest(result.rows[0], { includeDigest: true, includeHtml: true });
}

function normalizeAnomalyNotificationDigestSchedule(row = {}) {
  return {
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-schedule-v1',
    enabled: row.enabled !== false,
    interval_minutes: Number(row.interval_minutes ?? 1440),
    notification_limit: Number(row.notification_limit ?? 100),
    retention_days: Number(row.retention_days ?? 90),
    quiet_hours_enabled: row.quiet_hours_enabled === true,
    quiet_hours_start: row.quiet_hours_start || '22:00',
    quiet_hours_end: row.quiet_hours_end || '08:00',
    timezone: row.timezone || 'UTC',
    last_run_at: row.last_run_at || null,
    next_run_at: row.next_run_at || null,
    last_result: row.last_result || {},
    updated_by: row.updated_by_username ? `${row.updated_by_username}:${row.updated_by_role || 'unknown'}` : null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function compactAnomalyNotificationDigestRetentionRow(row = {}) {
  return {
    id: row.id,
    digest_id: row.digest_id,
    digest_hash: row.digest_hash,
    html_hash: row.html_hash,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    notification_count: Number(row.notification_count || 0),
    created_at: row.created_at
  };
}

function anomalyNotificationDigestRetentionReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    verified_at: receipt.verified_at,
    requested_by: receipt.requested_by,
    policy: receipt.policy,
    action: receipt.action,
    totals: receipt.totals,
    digests: receipt.digests,
    watermark: receipt.watermark
  });
}

function buildAnomalyNotificationDigestRetentionReceipt({
  actor = {},
  schedule = {},
  retentionDays,
  cutoff,
  digestRows = [],
  deletedRows = [],
  execute = false,
  now = new Date()
} = {}) {
  const cutoffTime = new Date(cutoff).getTime();
  const allDigests = digestRows.map(compactAnomalyNotificationDigestRetentionRow);
  const eligible = allDigests.filter((digest) => new Date(digest.created_at).getTime() < cutoffTime);
  const retained = allDigests.filter((digest) => new Date(digest.created_at).getTime() >= cutoffTime);
  const deleted = deletedRows.map(compactAnomalyNotificationDigestRetentionRow);
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-retention-receipt-v1',
    verified_at: new Date(now).toISOString(),
    requested_by: `${actor.username}:${actor.role}`,
    policy: {
      retention_days: retentionDays,
      cutoff_at: cutoff,
      schedule_enabled: schedule.enabled !== false,
      schedule_interval_minutes: Number(schedule.interval_minutes ?? 1440),
      schedule_notification_limit: Number(schedule.notification_limit ?? 100),
      schedule_next_run_at: schedule.next_run_at || null,
      schedule_updated_by: schedule.updated_by || null
    },
    action: {
      executed: execute === true,
      mode: execute === true ? 'prune_execute' : 'verification_dry_run'
    },
    totals: {
      scanned_count: allDigests.length,
      retained_count: retained.length,
      eligible_count: eligible.length,
      deleted_count: deleted.length
    },
    digests: {
      retained,
      eligible,
      deleted
    },
    watermark: 'internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipt'
  };
  receipt.receipt_hash = anomalyNotificationDigestRetentionReceiptHash(receipt);
  return receipt;
}

function normalizeAnomalyNotificationDigestRetentionReceipt(row = {}, { includeReceipt = false } = {}) {
  const receipt = {
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-retention-receipt-record-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    retention_days: Number(row.retention_days || 0),
    cutoff_at: row.cutoff_at,
    executed: row.executed === true,
    eligible_count: Number(row.eligible_count || 0),
    retained_count: Number(row.retained_count || 0),
    deleted_count: Number(row.deleted_count || 0),
    created_at: row.created_at
  };
  if (includeReceipt) receipt.receipt = row.receipt || null;
  return receipt;
}

export async function getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(client = pool) {
  const result = await client.query(
    `SELECT *
     FROM internal_ops_audit_evidence_case_anomaly_notification_digest_schedule
     WHERE id = TRUE
     LIMIT 1`
  );
  return normalizeAnomalyNotificationDigestSchedule(result.rows[0] || {});
}

export async function updateOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(input = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case anomaly notification digest schedule actor is required.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_schedule_actor_required';
    throw error;
  }
  const current = await getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(client);
  const intervalMinutes = normalizeScheduleInteger(input.interval_minutes, current.interval_minutes, { min: 15, max: 10080 });
  const notificationLimit = normalizeScheduleInteger(input.notification_limit, current.notification_limit, { min: 1, max: 500 });
  const retentionDays = normalizeScheduleInteger(input.retention_days, current.retention_days, { min: 1, max: 3650 });
  const enabled = input.enabled === undefined ? current.enabled : input.enabled === true;
  const quietHoursEnabled = input.quiet_hours_enabled === undefined ? current.quiet_hours_enabled : input.quiet_hours_enabled === true;
  const quietHoursStart = normalizeReplaySlaScheduleQuietHour(input.quiet_hours_start, current.quiet_hours_start);
  const quietHoursEnd = normalizeReplaySlaScheduleQuietHour(input.quiet_hours_end, current.quiet_hours_end);
  const timezone = String(input.timezone || current.timezone || 'UTC').trim() || 'UTC';
  const nextRunAt = input.next_run_at
    ? new Date(input.next_run_at).toISOString()
    : new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
  const result = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_anomaly_notification_digest_schedule (
       id,
       enabled,
       interval_minutes,
       notification_limit,
       retention_days,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       timezone,
       next_run_at,
       updated_by_username,
       updated_by_role
     )
     VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       interval_minutes = EXCLUDED.interval_minutes,
       notification_limit = EXCLUDED.notification_limit,
       retention_days = EXCLUDED.retention_days,
       quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
       quiet_hours_start = EXCLUDED.quiet_hours_start,
       quiet_hours_end = EXCLUDED.quiet_hours_end,
       timezone = EXCLUDED.timezone,
       next_run_at = EXCLUDED.next_run_at,
       updated_by_username = EXCLUDED.updated_by_username,
       updated_by_role = EXCLUDED.updated_by_role,
       updated_at = NOW()
     RETURNING *`,
    [
      enabled,
      intervalMinutes,
      notificationLimit,
      retentionDays,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      timezone,
      nextRunAt,
      actor.username,
      actor.role
    ]
  );
  return normalizeAnomalyNotificationDigestSchedule(result.rows[0]);
}

export async function runOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(
  { actor = {}, force = false, source = 'manual', now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case anomaly notification digest schedule actor is required.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_schedule_actor_required';
    throw error;
  }
  const schedule = await getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(client);
  const runAt = new Date(now);
  const skipped = (reason) => ({
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-schedule-run-v1',
    status: 'skipped',
    reason,
    source,
    ran_at: runAt.toISOString(),
    schedule,
    digest: null,
    watermark: 'internal_ops_audit_evidence_case_anomaly_notification_digest_schedule_run'
  });
  if (!schedule.enabled && !force) return skipped('schedule_disabled');
  if (isQuietHour(schedule, runAt) && !force) return skipped('quiet_hours');
  if (schedule.next_run_at && new Date(schedule.next_run_at).getTime() > runAt.getTime() && !force) {
    return skipped('not_due');
  }
  const digest = await createOpsAuditEvidenceCaseAnomalyNotificationDigest(
    {
      actor,
      filters: { limit: schedule.notification_limit },
      now: runAt
    },
    client
  );
  const resultPayload = {
    status: 'generated',
    notification_count: digest.notification_count,
    digest_hash: digest.digest_hash,
    source
  };
  const result = await client.query(
    `UPDATE internal_ops_audit_evidence_case_anomaly_notification_digest_schedule
     SET last_run_at = $1,
         next_run_at = $2,
         last_result = $3::jsonb,
         updated_at = NOW()
     WHERE id = TRUE
     RETURNING *`,
    [
      runAt.toISOString(),
      new Date(runAt.getTime() + schedule.interval_minutes * 60 * 1000).toISOString(),
      JSON.stringify(resultPayload)
    ]
  );
  return {
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-schedule-run-v1',
    status: 'generated',
    reason: null,
    source,
    ran_at: runAt.toISOString(),
    schedule: normalizeAnomalyNotificationDigestSchedule(result.rows[0]),
    digest,
    watermark: 'internal_ops_audit_evidence_case_anomaly_notification_digest_schedule_run'
  };
}

export async function listOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipts({ limit = 20 } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const result = await client.query(
    `SELECT id, receipt_hash, requested_by_username, requested_by_role, retention_days, cutoff_at,
       executed, eligible_count, retained_count, deleted_count, created_at
     FROM internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts
     ORDER BY created_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows.map((row) => normalizeAnomalyNotificationDigestRetentionReceipt(row));
}

export async function getOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Evidence case anomaly notification digest retention receipt identifier is required.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_retention_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT *
     FROM internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case anomaly notification digest retention receipt was not found.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_retention_receipt_not_found';
    throw error;
  }
  return normalizeAnomalyNotificationDigestRetentionReceipt(result.rows[0], { includeReceipt: true });
}

export async function pruneOpsAuditEvidenceCaseAnomalyNotificationDigests(
  { retention_days: retentionDays, execute = false, actor = {}, now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case anomaly notification digest prune actor is required.');
    error.code = 'ops_audit_evidence_case_anomaly_notification_digest_schedule_actor_required';
    throw error;
  }
  const schedule = await getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(client);
  const normalizedRetentionDays = normalizeScheduleInteger(retentionDays, schedule.retention_days, { min: 1, max: 3650 });
  const cutoff = new Date(new Date(now).getTime() - normalizedRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const digestResult = await client.query(
    `SELECT id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role, notification_count, created_at
     FROM internal_ops_audit_evidence_case_anomaly_notification_digests
     ORDER BY created_at DESC`
  );
  const eligibleCount = digestResult.rows.filter((row) => new Date(row.created_at).getTime() < new Date(cutoff).getTime()).length;
  let deletedRows = [];
  if (execute && eligibleCount > 0) {
    const deleteResult = await client.query(
      `DELETE FROM internal_ops_audit_evidence_case_anomaly_notification_digests
       WHERE created_at < $1
       RETURNING id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role, notification_count, created_at`,
      [cutoff]
    );
    deletedRows = deleteResult.rows;
  }
  const receipt = buildAnomalyNotificationDigestRetentionReceipt({
    actor,
    schedule,
    retentionDays: normalizedRetentionDays,
    cutoff,
    digestRows: digestResult.rows,
    deletedRows,
    execute,
    now
  });
  const receiptResult = await client.query(
    `INSERT INTO internal_ops_audit_evidence_case_anomaly_notification_digest_retention_receipts (
       receipt_hash,
       requested_by_username,
       requested_by_role,
       retention_days,
       cutoff_at,
       executed,
       eligible_count,
       retained_count,
       deleted_count,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (receipt_hash) DO UPDATE
       SET receipt = EXCLUDED.receipt
     RETURNING *`,
    [
      receipt.receipt_hash,
      actor.username,
      actor.role,
      normalizedRetentionDays,
      cutoff,
      execute === true,
      receipt.totals.eligible_count,
      receipt.totals.retained_count,
      receipt.totals.deleted_count,
      JSON.stringify(receipt)
    ]
  );
  const receiptRecord = normalizeAnomalyNotificationDigestRetentionReceipt(receiptResult.rows[0], { includeReceipt: true });
  return {
    schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-prune-v1',
    requested_by: `${actor.username}:${actor.role}`,
    executed: execute === true,
    retention_days: normalizedRetentionDays,
    cutoff_at: cutoff,
    eligible_count: eligibleCount,
    retained_count: receipt.totals.retained_count,
    deleted_count: deletedRows.length,
    receipt_hash: receipt.receipt_hash,
    receipt: receiptRecord,
    watermark: 'internal_ops_audit_evidence_case_anomaly_notification_digest_prune'
  };
}

export async function createOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipt(
  { retention_days: retentionDays, actor = {}, now = new Date() } = {},
  client = pool
) {
  return pruneOpsAuditEvidenceCaseAnomalyNotificationDigests(
    {
      retention_days: retentionDays,
      execute: false,
      actor,
      now
    },
    client
  ).then((prune) => prune.receipt);
}

export async function countOpsAuditEvidenceCaseAnomalyNotificationDigestsEligibleForRetention(
  { retention_days: retentionDays, now = new Date() } = {},
  client = pool
) {
  const schedule = await getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(client);
  const normalizedRetentionDays = normalizeScheduleInteger(retentionDays, schedule.retention_days, { min: 1, max: 3650 });
  const cutoff = new Date(new Date(now).getTime() - normalizedRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM internal_ops_audit_evidence_case_anomaly_notification_digests
     WHERE created_at < $1`,
    [cutoff]
  );
  return {
    retention_days: normalizedRetentionDays,
    cutoff_at: cutoff,
    eligible_count: Number(countResult.rows[0]?.count || 0)
  };
}

function normalizeNotificationDeliveryAttempt(row) {
  const forceReplayApprovedBy = row.force_replay_approved_by_username
    ? `${row.force_replay_approved_by_username}:${row.force_replay_approved_by_role || 'admin'}`
    : null;
  return {
    schema_version: 'phase4-ops-audit-notification-delivery-attempt-v1',
    id: row.id,
    notification_id: row.notification_id,
    adapter: row.adapter,
    status: row.status,
    destination_label: row.destination_label,
    reason: row.reason || null,
    payload_hash: row.payload_hash,
    rule_id: row.rule_id || null,
    escalation_assignee: row.escalation_assignee_username
      ? `${row.escalation_assignee_username}:${row.escalation_assignee_role || 'operator'}`
      : null,
    repeat_interval_minutes: row.repeat_interval_minutes === null || row.repeat_interval_minutes === undefined
      ? null
      : Number(row.repeat_interval_minutes),
    suppression_window_minutes: row.suppression_window_minutes === null || row.suppression_window_minutes === undefined
      ? null
      : Number(row.suppression_window_minutes),
    attempted_by: `${row.attempted_by_username}:${row.attempted_by_role}`,
    replay_source_attempt_id: row.replay_source_attempt_id || null,
    force_replay: row.force_replay_reason
      ? {
          reason: row.force_replay_reason,
          approved_by: forceReplayApprovedBy
        }
      : null,
    created_at: row.created_at,
    notification: row.notification_kind
      ? {
          kind: row.notification_kind,
          status: row.notification_status,
          priority: row.notification_priority,
          case_id: row.case_id,
          case_packet_hash: row.case_packet_hash || null
        }
      : null
  };
}

function normalizeForceReplayApproval({ force = false, force_reason: forceReason = '', approval_reason: approvalReason = '', approved_by: approvedBy = null } = {}, actor = {}) {
  if (!force) return null;
  const reason = String(forceReason || approvalReason || '').trim();
  if (reason.length < 8) {
    const error = new Error('Force replay requires an approval reason.');
    error.code = 'ops_audit_notification_force_replay_reason_required';
    throw error;
  }
  const approved = normalizeAssignee(approvedBy || actor);
  const fallbackActor = actorParts(actor);
  return {
    reason: reason.slice(0, 500),
    approved_by_username: approved.username || fallbackActor.username,
    approved_by_role: approved.role || fallbackActor.role
  };
}

const INTERNAL_ROLE_RANK = {
  viewer: 1,
  operator: 2,
  admin: 3
};

function roleMeetsMinimum(role, minimumRole) {
  return (INTERNAL_ROLE_RANK[String(role || '').toLowerCase()] || 0) >= (INTERNAL_ROLE_RANK[String(minimumRole || 'admin').toLowerCase()] || 3);
}

function normalizeReviewerAssignment(input = {}) {
  if (typeof input === 'string') {
    const [username, role = 'admin'] = input.split(':');
    return normalizeReviewerAssignment({ username, role });
  }
  const username = String(input.username || input.assigned_reviewer_username || '').trim();
  const role = String(input.role || input.assigned_reviewer_role || 'admin').trim().toLowerCase();
  if (!username) {
    const error = new Error('Replay approval assigned reviewer is required.');
    error.code = 'ops_audit_notification_replay_approval_assignee_required';
    throw error;
  }
  if (!['viewer', 'operator', 'admin'].includes(role)) {
    const error = new Error('Replay approval assigned reviewer role is invalid.');
    error.code = 'ops_audit_notification_replay_approval_assignee_role_invalid';
    throw error;
  }
  return { username, role };
}

function normalizeReplayPolicy(row = {}) {
  return {
    schema_version: 'phase4-ops-audit-notification-replay-policy-v1',
    enabled: row.enabled !== false,
    allow_self_approval: row.allow_self_approval === true,
    required_reviewer_role: row.required_reviewer_role || 'admin',
    request_ttl_minutes: Number(row.request_ttl_minutes) || 1440,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function normalizeReplayPerformanceThresholdPolicy(row = {}) {
  return {
    schema_version: 'phase4-ops-audit-notification-replay-performance-threshold-policy-v1',
    enabled: row.enabled !== false,
    max_expired_backlog_count: Number(row.max_expired_backlog_count ?? 0),
    max_near_expiry_backlog_count: Number(row.max_near_expiry_backlog_count ?? 2),
    max_unassigned_backlog_count: Number(row.max_unassigned_backlog_count ?? 0),
    max_expired_backlog_rate: Number(row.max_expired_backlog_rate ?? 0.25),
    max_average_review_minutes: Number(row.max_average_review_minutes ?? 240),
    max_average_execute_minutes: Number(row.max_average_execute_minutes ?? 120),
    max_average_workload_action_minutes: Number(row.max_average_workload_action_minutes ?? 120),
    updated_by: row.updated_by || (row.updated_by_username ? `${row.updated_by_username}:${row.updated_by_role || 'unknown'}` : null),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function normalizeThresholdInteger(value, fallback, { min = 0, max = 10000 } = {}) {
  const normalized = value === undefined ? fallback : Math.round(Number(value));
  if (!Number.isFinite(normalized) || normalized < min || normalized > max) {
    const error = new Error('Replay performance threshold value is invalid.');
    error.code = 'ops_audit_notification_replay_performance_threshold_invalid';
    throw error;
  }
  return normalized;
}

function normalizeThresholdRate(value, fallback) {
  const normalized = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    const error = new Error('Replay performance threshold rate is invalid.');
    error.code = 'ops_audit_notification_replay_performance_threshold_invalid';
    throw error;
  }
  return Number(normalized.toFixed(4));
}

function isReplayApprovalExpired(approval, now = new Date()) {
  if (!approval?.expires_at || ['rejected', 'executed', 'cancelled'].includes(approval.status)) return false;
  return new Date(approval.expires_at).getTime() <= now.getTime();
}

function normalizeReplayApproval(row) {
  const reviewPolicy = typeof row.review_policy === 'string'
    ? JSON.parse(row.review_policy || '{}')
    : row.review_policy || {};
  const normalized = {
    schema_version: 'phase4-ops-audit-notification-replay-approval-v1',
    id: row.id,
    source_attempt_id: row.source_attempt_id,
    status: row.status,
    force_reason: row.force_reason,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    reviewed_by: row.reviewed_by_username ? `${row.reviewed_by_username}:${row.reviewed_by_role}` : null,
    reviewed_at: row.reviewed_at || null,
    review_note: row.review_note || null,
    rejection_reason: row.rejection_reason || null,
    assigned_reviewer: row.assigned_reviewer_username ? `${row.assigned_reviewer_username}:${row.assigned_reviewer_role || 'admin'}` : null,
    executed_by: row.executed_by_username ? `${row.executed_by_username}:${row.executed_by_role}` : null,
    executed_at: row.executed_at || null,
    replay_attempt_id: row.replay_attempt_id || null,
    expires_at: row.expires_at || null,
    expired_at: row.expired_at || null,
    cleanup_reason: row.cleanup_reason || null,
    workload_action_status: row.workload_action_status || null,
    workload_action_note: row.workload_action_note || null,
    workload_action_by: row.workload_action_by_username ? `${row.workload_action_by_username}:${row.workload_action_by_role || 'operator'}` : null,
    workload_action_at: row.workload_action_at || null,
    review_policy: {
      enabled: reviewPolicy.enabled !== false,
      allow_self_approval: reviewPolicy.allow_self_approval === true,
      required_reviewer_role: reviewPolicy.required_reviewer_role || 'admin',
      request_ttl_minutes: Number(reviewPolicy.request_ttl_minutes) || 1440
    },
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  return {
    ...normalized,
    expired: isReplayApprovalExpired(normalized)
  };
}

const REPLAY_APPROVAL_SELECT_COLUMNS = `id, source_attempt_id, status, force_reason, requested_by_username, requested_by_role,
       reviewed_by_username, reviewed_by_role, reviewed_at, review_note, rejection_reason,
       assigned_reviewer_username, assigned_reviewer_role,
       executed_by_username, executed_by_role, executed_at, replay_attempt_id, expires_at, expired_at, cleanup_reason,
       workload_action_status, workload_action_note, workload_action_by_username, workload_action_by_role, workload_action_at,
       review_policy, created_at, updated_at`;
const REPLAY_APPROVAL_RETURNING_COLUMNS = REPLAY_APPROVAL_SELECT_COLUMNS
  .split(',')
  .map((column) => `approvals.${column.trim()}`)
  .join(', ');

export async function listOpsAuditNotificationRules({ limit = 20, enabled = '' } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (enabled !== '') {
    params.push(enabled === true || enabled === 'true');
    where.push(`enabled = $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT id, name, enabled, kind, priority, adapter, repeat_interval_minutes, suppression_window_minutes,
       escalation_assignee_username, escalation_assignee_role, created_by_username, created_by_role,
       updated_by_username, updated_by_role, created_at, updated_at
     FROM internal_ops_audit_notification_rules
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY enabled DESC,
       CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'normal' THEN 2 ELSE 1 END DESC,
       kind ASC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeNotificationRule);
}

export async function upsertOpsAuditNotificationRule(input = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Notification rule actor is required.');
    error.code = 'ops_audit_notification_rule_actor_required';
    throw error;
  }
  const rule = normalizeNotificationRuleInput(input);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_rules (
       name, enabled, kind, priority, adapter, repeat_interval_minutes, suppression_window_minutes,
       escalation_assignee_username, escalation_assignee_role, created_by_username, created_by_role,
       updated_by_username, updated_by_role
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $10, $11)
     ON CONFLICT (kind, priority) DO UPDATE
       SET name = EXCLUDED.name,
           enabled = EXCLUDED.enabled,
           adapter = EXCLUDED.adapter,
           repeat_interval_minutes = EXCLUDED.repeat_interval_minutes,
           suppression_window_minutes = EXCLUDED.suppression_window_minutes,
           escalation_assignee_username = EXCLUDED.escalation_assignee_username,
           escalation_assignee_role = EXCLUDED.escalation_assignee_role,
           updated_by_username = EXCLUDED.updated_by_username,
           updated_by_role = EXCLUDED.updated_by_role,
           updated_at = NOW()
     RETURNING id, name, enabled, kind, priority, adapter, repeat_interval_minutes, suppression_window_minutes,
       escalation_assignee_username, escalation_assignee_role, created_by_username, created_by_role,
       updated_by_username, updated_by_role, created_at, updated_at`,
    [
      rule.name,
      rule.enabled,
      rule.kind,
      rule.priority,
      rule.adapter,
      rule.repeat_interval_minutes,
      rule.suppression_window_minutes,
      rule.escalation_assignee_username,
      rule.escalation_assignee_role,
      actor.username,
      actor.role
    ]
  );
  return normalizeNotificationRule(result.rows[0]);
}

export async function updateOpsAuditNotificationRule(id, updates = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Notification rule actor is required.');
    error.code = 'ops_audit_notification_rule_actor_required';
    throw error;
  }
  const normalizedId = String(id || '').trim();
  if (!normalizedId) {
    const error = new Error('Notification rule id is required.');
    error.code = 'ops_audit_notification_rule_id_required';
    throw error;
  }
  const existing = await client.query(
    `SELECT id, name, enabled, kind, priority, adapter, repeat_interval_minutes, suppression_window_minutes,
       escalation_assignee_username, escalation_assignee_role
     FROM internal_ops_audit_notification_rules
     WHERE id::text = $1 OR name = $1`,
    [normalizedId]
  );
  if (!existing.rows[0]) {
    const error = new Error('Notification rule was not found.');
    error.code = 'ops_audit_notification_rule_not_found';
    throw error;
  }
  const rule = normalizeNotificationRuleInput(updates, existing.rows[0]);
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_rules
     SET name = $2,
         enabled = $3,
         kind = $4,
         priority = $5,
         adapter = $6,
         repeat_interval_minutes = $7,
         suppression_window_minutes = $8,
         escalation_assignee_username = $9,
         escalation_assignee_role = $10,
         updated_by_username = $11,
         updated_by_role = $12,
         updated_at = NOW()
     WHERE id::text = $1 OR name = $1
     RETURNING id, name, enabled, kind, priority, adapter, repeat_interval_minutes, suppression_window_minutes,
       escalation_assignee_username, escalation_assignee_role, created_by_username, created_by_role,
       updated_by_username, updated_by_role, created_at, updated_at`,
    [
      normalizedId,
      rule.name,
      rule.enabled,
      rule.kind,
      rule.priority,
      rule.adapter,
      rule.repeat_interval_minutes,
      rule.suppression_window_minutes,
      rule.escalation_assignee_username,
      rule.escalation_assignee_role,
      actor.username,
      actor.role
    ]
  );
  return normalizeNotificationRule(result.rows[0]);
}

function notificationInQuietHours(policy, now = new Date()) {
  if (!policy.quiet_hours?.enabled) return false;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [startHour, startMinute] = policy.quiet_hours.start.split(':').map(Number);
  const [endHour, endMinute] = policy.quiet_hours.end.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (start === end) return true;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function minutesSince(dateValue, now = new Date()) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const createdAt = new Date(dateValue);
  if (Number.isNaN(createdAt.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - createdAt.getTime()) / 60000);
}

function notificationDeliveryDecision(
  notification,
  policy,
  adapter,
  { force = false, now = new Date(), rule = null, latestAttempt = null } = {}
) {
  if (['resolved', 'dismissed'].includes(notification.case?.status)) return { status: 'skipped', reason: 'case_closed' };
  if (!policy.enabled) return { status: 'skipped', reason: 'policy_disabled' };
  if (policy.adapters?.[adapter] !== true) return { status: 'skipped', reason: 'adapter_disabled' };
  if (notification.kind === 'overdue' && !policy.notify_overdue) return { status: 'skipped', reason: 'kind_disabled' };
  if (notification.kind === 'due_soon' && !policy.notify_due_soon) return { status: 'skipped', reason: 'kind_disabled' };
  const notificationRank = EVIDENCE_CASE_NOTIFICATION_PRIORITY_RANK[notification.priority || 'normal'] || 2;
  const minimumRank = EVIDENCE_CASE_NOTIFICATION_PRIORITY_RANK[policy.min_priority || 'normal'] || 2;
  if (notificationRank < minimumRank) return { status: 'skipped', reason: 'priority_below_policy' };
  if (!force && notificationInQuietHours(policy, now)) return { status: 'skipped', reason: 'quiet_hours' };
  if (!force && rule && latestAttempt?.status === 'stubbed') {
    const elapsedMinutes = minutesSince(latestAttempt.created_at, now);
    const suppressionWindow = Number(rule.suppression_window_minutes) || 0;
    if (suppressionWindow > 0 && elapsedMinutes < suppressionWindow) {
      return { status: 'skipped', reason: 'suppressed_by_window' };
    }
    const repeatInterval = Number(rule.repeat_interval_minutes) || 0;
    if (repeatInterval > 0 && elapsedMinutes < repeatInterval) {
      return { status: 'skipped', reason: 'repeat_interval_not_elapsed' };
    }
  }
  return { status: 'stubbed', reason: 'delivery_stub_recorded' };
}

function matchingNotificationRule(notification, rules = []) {
  return rules.find((rule) =>
    rule.enabled &&
    rule.kind === notification.kind &&
    rule.priority === notification.priority
  ) || null;
}

export async function getOpsAuditNotificationPolicy(client = pool) {
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_policy (id)
     VALUES ('default')
     ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
     RETURNING enabled, min_priority, notify_overdue, notify_due_soon, quiet_hours_enabled,
       quiet_hours_start, quiet_hours_end, timezone, adapters, updated_by_username, updated_by_role,
       created_at, updated_at`
  );
  return normalizeNotificationPolicy(result.rows[0]);
}

export async function updateOpsAuditNotificationPolicy(updates = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification policy actor is required.');
    error.code = 'ops_audit_notification_policy_actor_required';
    throw error;
  }
  const current = await getOpsAuditNotificationPolicy(client);
  const adapters = {
    webhook: updates.adapters?.webhook !== undefined ? Boolean(updates.adapters.webhook) : current.adapters.webhook,
    email: updates.adapters?.email !== undefined ? Boolean(updates.adapters.email) : current.adapters.email
  };
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_policy
     SET enabled = $1,
         min_priority = $2,
         notify_overdue = $3,
         notify_due_soon = $4,
         quiet_hours_enabled = $5,
         quiet_hours_start = $6,
         quiet_hours_end = $7,
         timezone = $8,
         adapters = $9::jsonb,
         updated_by_username = $10,
         updated_by_role = $11,
         updated_at = NOW()
     WHERE id = 'default'
     RETURNING enabled, min_priority, notify_overdue, notify_due_soon, quiet_hours_enabled,
       quiet_hours_start, quiet_hours_end, timezone, adapters, updated_by_username, updated_by_role,
       created_at, updated_at`,
    [
      updates.enabled !== undefined ? Boolean(updates.enabled) : current.enabled,
      updates.min_priority !== undefined ? normalizeCasePriority(updates.min_priority) : current.min_priority,
      updates.notify_overdue !== undefined ? Boolean(updates.notify_overdue) : current.notify_overdue,
      updates.notify_due_soon !== undefined ? Boolean(updates.notify_due_soon) : current.notify_due_soon,
      updates.quiet_hours?.enabled !== undefined ? Boolean(updates.quiet_hours.enabled) : current.quiet_hours.enabled,
      updates.quiet_hours?.start !== undefined ? normalizeQuietHour(updates.quiet_hours.start, current.quiet_hours.start) : current.quiet_hours.start,
      updates.quiet_hours?.end !== undefined ? normalizeQuietHour(updates.quiet_hours.end, current.quiet_hours.end) : current.quiet_hours.end,
      updates.quiet_hours?.timezone !== undefined ? String(updates.quiet_hours.timezone || 'UTC').trim() || 'UTC' : current.quiet_hours.timezone,
      JSON.stringify(adapters),
      actor.username,
      actor.role
    ]
  );
  return normalizeNotificationPolicy(result.rows[0]);
}

export function buildOpsAuditNotificationDeliverySummary(attempts = []) {
  return attempts.reduce(
    (summary, attempt) => {
      summary.total_attempts += 1;
      summary.by_status[attempt.status] = (summary.by_status[attempt.status] || 0) + 1;
      summary.by_adapter[attempt.adapter] = (summary.by_adapter[attempt.adapter] || 0) + 1;
      const reason = attempt.reason || 'recorded';
      summary.by_reason[reason] = (summary.by_reason[reason] || 0) + 1;
      if (attempt.status === 'stubbed') summary.stubbed_count += 1;
      if (attempt.status === 'skipped') summary.skipped_count += 1;
      return summary;
    },
    {
      total_attempts: 0,
      stubbed_count: 0,
      skipped_count: 0,
      by_status: {},
      by_adapter: {},
      by_reason: {}
    }
  );
}

async function getLatestNotificationDeliveryAttempt(notificationId, adapter, client = pool) {
  const result = await client.query(
    `SELECT id, notification_id, adapter, status, destination_label, reason, payload_hash,
       rule_id, escalation_assignee_username, escalation_assignee_role, repeat_interval_minutes,
       suppression_window_minutes, attempted_by_username, attempted_by_role, replay_source_attempt_id,
       force_replay_reason, force_replay_approved_by_username, force_replay_approved_by_role, created_at
     FROM internal_ops_audit_notification_delivery_attempts
     WHERE notification_id = $1
       AND adapter = $2
       AND status = 'stubbed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [notificationId, adapter]
  );
  return result.rows[0] ? normalizeNotificationDeliveryAttempt(result.rows[0]) : null;
}

export async function deliverOpsAuditEvidenceCaseNotifications(
  {
    actor = {},
    adapter = '',
    notification_id: notificationId = '',
    limit = 20,
    force = false,
    now = new Date(),
    replay_source_attempt_id: replaySourceAttemptId = null,
    force_replay_approval: forceReplayApproval = null
  } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification delivery actor is required.');
    error.code = 'ops_audit_notification_delivery_actor_required';
    throw error;
  }
  const policy = await getOpsAuditNotificationPolicy(client);
  const rules = await listOpsAuditNotificationRules({ enabled: true, limit: 100 }, client);
  const notifications = notificationId
    ? await listOpsAuditEvidenceCaseNotifications({ limit: 100 }, client).then((items) => items.filter((item) => item.id === notificationId))
    : await listOpsAuditEvidenceCaseNotifications({ status: 'open', limit }, client);
  const attempts = [];
  for (const notification of notifications.slice(0, Math.max(1, Math.min(Number(limit) || 20, 100)))) {
    const rule = matchingNotificationRule(notification, rules);
    const normalizedAdapter = normalizeNotificationAdapter(adapter || rule?.adapter || 'webhook');
    const latestAttempt = await getLatestNotificationDeliveryAttempt(notification.id, normalizedAdapter, client);
    const decision = notificationDeliveryDecision(notification, policy, normalizedAdapter, { force, now, rule, latestAttempt });
    const payloadHash = digestValue({
      schema_version: notification.schema_version,
      id: notification.id,
      case_id: notification.case_id,
      kind: notification.kind,
      priority: notification.priority,
      due_at: notification.due_at,
      message: notification.message,
      adapter: normalizedAdapter,
      rule_id: rule?.id || null,
      escalation_assignee: rule?.escalation_assignee || null,
      previous_attempt_id: latestAttempt?.id || null,
      replay_source_attempt_id: replaySourceAttemptId,
      force_replay_approval: forceReplayApproval,
      delivery_decision: decision,
      policy: {
        enabled: policy.enabled,
        min_priority: policy.min_priority,
        notify_overdue: policy.notify_overdue,
        notify_due_soon: policy.notify_due_soon
      }
    });
    const result = await client.query(
      `INSERT INTO internal_ops_audit_notification_delivery_attempts (
         notification_id,
         adapter,
         status,
         destination_label,
         reason,
         payload_hash,
         rule_id,
         escalation_assignee_username,
         escalation_assignee_role,
         repeat_interval_minutes,
         suppression_window_minutes,
         attempted_by_username,
         attempted_by_role,
         replay_source_attempt_id,
         force_replay_reason,
         force_replay_approved_by_username,
         force_replay_approved_by_role
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id, notification_id, adapter, status, destination_label, reason, payload_hash,
         rule_id, escalation_assignee_username, escalation_assignee_role, repeat_interval_minutes,
         suppression_window_minutes, attempted_by_username, attempted_by_role, replay_source_attempt_id,
         force_replay_reason, force_replay_approved_by_username, force_replay_approved_by_role, created_at`,
      [
        notification.id,
        normalizedAdapter,
        decision.status,
        normalizedAdapter === 'webhook' ? 'webhook:stub' : 'email:stub',
        decision.reason,
        payloadHash,
        rule?.id || null,
        rule?.escalation_assignee ? rule.escalation_assignee.split(':')[0] : null,
        rule?.escalation_assignee ? rule.escalation_assignee.split(':')[1] || 'operator' : null,
        rule?.repeat_interval_minutes || null,
        rule?.suppression_window_minutes || null,
        actor.username,
        actor.role,
        replaySourceAttemptId,
        forceReplayApproval?.reason || null,
        forceReplayApproval?.approved_by_username || null,
        forceReplayApproval?.approved_by_role || null
      ]
    );
    attempts.push(normalizeNotificationDeliveryAttempt(result.rows[0]));
  }
  return { policy, attempts };
}

export async function listOpsAuditNotificationDeliveryAttempts(
  { limit = 20, notification_id: notificationId = '', adapter = '', status = '' } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (notificationId) {
    params.push(String(notificationId).trim());
    where.push(`d.notification_id::text = $${params.length}`);
  }
  if (adapter) {
    params.push(normalizeNotificationAdapter(adapter));
    where.push(`d.adapter = $${params.length}`);
  }
  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    if (!['stubbed', 'skipped'].includes(normalizedStatus)) {
      const error = new Error('Evidence case notification delivery status is invalid.');
      error.code = 'ops_audit_notification_delivery_status_invalid';
      throw error;
    }
    params.push(normalizedStatus);
    where.push(`d.status = $${params.length}`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT d.id, d.notification_id, d.adapter, d.status, d.destination_label, d.reason, d.payload_hash,
       d.rule_id, d.escalation_assignee_username, d.escalation_assignee_role, d.repeat_interval_minutes,
       d.suppression_window_minutes, d.attempted_by_username, d.attempted_by_role, d.replay_source_attempt_id,
       d.force_replay_reason, d.force_replay_approved_by_username, d.force_replay_approved_by_role, d.created_at,
       n.kind AS notification_kind, n.status AS notification_status, n.priority AS notification_priority,
       n.case_id, c.packet_hash AS case_packet_hash
     FROM internal_ops_audit_notification_delivery_attempts d
     LEFT JOIN internal_ops_audit_evidence_case_notifications n ON n.id = d.notification_id
     LEFT JOIN internal_ops_audit_evidence_case_reviews c ON c.id = n.case_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY d.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeNotificationDeliveryAttempt);
}

export async function getOpsAuditNotificationDeliveryAttempt(id, client = pool) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) {
    const error = new Error('Evidence case notification delivery attempt id is required.');
    error.code = 'ops_audit_notification_delivery_attempt_id_required';
    throw error;
  }
  const result = await client.query(
    `SELECT d.id, d.notification_id, d.adapter, d.status, d.destination_label, d.reason, d.payload_hash,
       d.rule_id, d.escalation_assignee_username, d.escalation_assignee_role, d.repeat_interval_minutes,
       d.suppression_window_minutes, d.attempted_by_username, d.attempted_by_role, d.replay_source_attempt_id,
       d.force_replay_reason, d.force_replay_approved_by_username, d.force_replay_approved_by_role, d.created_at,
       n.kind AS notification_kind, n.status AS notification_status, n.priority AS notification_priority,
       n.case_id, c.packet_hash AS case_packet_hash
     FROM internal_ops_audit_notification_delivery_attempts d
     LEFT JOIN internal_ops_audit_evidence_case_notifications n ON n.id = d.notification_id
     LEFT JOIN internal_ops_audit_evidence_case_reviews c ON c.id = n.case_id
     WHERE d.id::text = $1
     LIMIT 1`,
    [normalizedId]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case notification delivery attempt was not found.');
    error.code = 'ops_audit_notification_delivery_attempt_not_found';
    throw error;
  }
  return normalizeNotificationDeliveryAttempt(result.rows[0]);
}

export function explainOpsAuditNotificationDeliveryAttempt(attempt) {
  const reason = attempt.reason || 'recorded';
  const reasonMessages = {
    delivery_stub_recorded: 'Delivery would be sent by the selected adapter; this environment records a stub attempt only.',
    suppressed_by_window: 'A matching stubbed delivery already exists inside the rule suppression window.',
    repeat_interval_not_elapsed: 'A matching stubbed delivery exists and the rule repeat interval has not elapsed.',
    case_closed: 'The evidence case is resolved or dismissed, so delivery remains blocked.',
    policy_disabled: 'The notification delivery policy is disabled.',
    adapter_disabled: 'The selected delivery adapter is disabled by policy.',
    kind_disabled: 'The notification kind is disabled by policy.',
    priority_below_policy: 'The notification priority is below the policy minimum.',
    quiet_hours: 'The notification is inside configured quiet hours.'
  };
  const canReplay = attempt.status === 'skipped';
  const canForceReplay = canReplay && reason !== 'case_closed';
  return {
    schema_version: 'phase4-ops-audit-notification-delivery-explanation-v1',
    attempt_id: attempt.id,
    notification_id: attempt.notification_id,
    adapter: attempt.adapter,
    status: attempt.status,
    reason,
    explanation: reasonMessages[reason] || 'Delivery attempt was recorded.',
    can_replay: canReplay,
    can_force_replay: canForceReplay,
    replay_modes: canReplay
      ? [
          'replay',
          ...(canForceReplay ? ['force_replay'] : [])
        ]
      : [],
    rule_id: attempt.rule_id || null,
    escalation_assignee: attempt.escalation_assignee || null,
    repeat_interval_minutes: attempt.repeat_interval_minutes,
    suppression_window_minutes: attempt.suppression_window_minutes,
    notification: attempt.notification,
    created_at: attempt.created_at
  };
}

export async function replayOpsAuditNotificationDeliveryAttempt(
  { id, actor = {}, force = false, now = new Date(), force_reason: forceReason = '', approval_reason: approvalReason = '', approved_by: approvedBy = null } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification replay actor is required.');
    error.code = 'ops_audit_notification_replay_actor_required';
    throw error;
  }
  const sourceAttempt = await getOpsAuditNotificationDeliveryAttempt(id, client);
  const explanation = explainOpsAuditNotificationDeliveryAttempt(sourceAttempt);
  if (!explanation.can_replay) {
    const error = new Error('Only skipped delivery attempts can be replayed.');
    error.code = 'ops_audit_notification_replay_not_skipped';
    throw error;
  }
  if (force && !explanation.can_force_replay) {
    const error = new Error('This skipped delivery attempt cannot be force replayed.');
    error.code = 'ops_audit_notification_force_replay_not_allowed';
    throw error;
  }
  const forceReplayApproval = normalizeForceReplayApproval(
    { force, force_reason: forceReason, approval_reason: approvalReason, approved_by: approvedBy },
    actor
  );
  const delivery = await deliverOpsAuditEvidenceCaseNotifications(
    {
      actor,
      adapter: sourceAttempt.adapter,
      notification_id: sourceAttempt.notification_id,
      limit: 1,
      force,
      now,
      replay_source_attempt_id: sourceAttempt.id,
      force_replay_approval: forceReplayApproval
    },
    client
  );
  return {
    schema_version: 'phase4-ops-audit-notification-delivery-replay-v1',
    source_attempt: sourceAttempt,
    explanation,
    force: Boolean(force),
    approval: forceReplayApproval
      ? {
          reason: forceReplayApproval.reason,
          approved_by: `${forceReplayApproval.approved_by_username}:${forceReplayApproval.approved_by_role}`
        }
      : null,
    policy: delivery.policy,
    summary: buildOpsAuditNotificationDeliverySummary(delivery.attempts),
    attempts: delivery.attempts
  };
}

export async function getOpsAuditNotificationReplayPolicy(client = pool) {
  const result = await client.query(
    `SELECT enabled, allow_self_approval, required_reviewer_role, request_ttl_minutes, created_at, updated_at
     FROM internal_ops_audit_notification_replay_policy
     WHERE id = TRUE
     LIMIT 1`
  );
  if (result.rows[0]) return normalizeReplayPolicy(result.rows[0]);
  const inserted = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_policy (
       id,
       enabled,
       allow_self_approval,
       required_reviewer_role,
       request_ttl_minutes
     )
     VALUES (TRUE, TRUE, FALSE, 'admin', 1440)
     ON CONFLICT (id) DO UPDATE SET updated_at = internal_ops_audit_notification_replay_policy.updated_at
     RETURNING enabled, allow_self_approval, required_reviewer_role, request_ttl_minutes, created_at, updated_at`
  );
  return normalizeReplayPolicy(inserted.rows[0]);
}

export async function updateOpsAuditNotificationReplayPolicy(
  { enabled, allow_self_approval: allowSelfApproval, required_reviewer_role: requiredReviewerRole, request_ttl_minutes: requestTtlMinutes } = {},
  client = pool
) {
  const current = await getOpsAuditNotificationReplayPolicy(client);
  const normalizedRole = requiredReviewerRole === undefined
    ? current.required_reviewer_role
    : String(requiredReviewerRole || '').trim().toLowerCase();
  if (!['viewer', 'operator', 'admin'].includes(normalizedRole)) {
    const error = new Error('Replay approval reviewer role is invalid.');
    error.code = 'ops_audit_notification_replay_policy_role_invalid';
    throw error;
  }
  const normalizedTtl = requestTtlMinutes === undefined
    ? current.request_ttl_minutes
    : Math.round(Number(requestTtlMinutes));
  if (!Number.isFinite(normalizedTtl) || normalizedTtl < 15 || normalizedTtl > 10080) {
    const error = new Error('Replay approval request TTL must be between 15 and 10080 minutes.');
    error.code = 'ops_audit_notification_replay_policy_ttl_invalid';
    throw error;
  }
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_policy (
       id,
       enabled,
       allow_self_approval,
       required_reviewer_role,
       request_ttl_minutes
     )
     VALUES (TRUE, $1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           allow_self_approval = EXCLUDED.allow_self_approval,
           required_reviewer_role = EXCLUDED.required_reviewer_role,
           request_ttl_minutes = EXCLUDED.request_ttl_minutes,
           updated_at = NOW()
     RETURNING enabled, allow_self_approval, required_reviewer_role, request_ttl_minutes, created_at, updated_at`,
    [
      enabled === undefined ? current.enabled : Boolean(enabled),
      allowSelfApproval === undefined ? current.allow_self_approval : Boolean(allowSelfApproval),
      normalizedRole,
      normalizedTtl
    ]
  );
  return normalizeReplayPolicy(result.rows[0]);
}

export async function getOpsAuditNotificationReplayPerformanceThresholdPolicy(client = pool) {
  const result = await client.query(
    `SELECT enabled, max_expired_backlog_count, max_near_expiry_backlog_count,
       max_unassigned_backlog_count, max_expired_backlog_rate,
       max_average_review_minutes, max_average_execute_minutes, max_average_workload_action_minutes,
       updated_by_username, updated_by_role, created_at, updated_at
     FROM internal_ops_audit_notification_replay_performance_thresholds
     WHERE id = 'default'
     LIMIT 1`
  );
  if (result.rows[0]) return normalizeReplayPerformanceThresholdPolicy(result.rows[0]);
  const inserted = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_performance_thresholds (id)
     VALUES ('default')
     ON CONFLICT (id) DO UPDATE SET updated_at = internal_ops_audit_notification_replay_performance_thresholds.updated_at
     RETURNING enabled, max_expired_backlog_count, max_near_expiry_backlog_count,
       max_unassigned_backlog_count, max_expired_backlog_rate,
       max_average_review_minutes, max_average_execute_minutes, max_average_workload_action_minutes,
       updated_by_username, updated_by_role, created_at, updated_at`
  );
  return normalizeReplayPerformanceThresholdPolicy(inserted.rows[0]);
}

export async function updateOpsAuditNotificationReplayPerformanceThresholdPolicy(updates = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay performance threshold policy actor is required.');
    error.code = 'ops_audit_notification_replay_performance_threshold_actor_required';
    throw error;
  }
  const current = await getOpsAuditNotificationReplayPerformanceThresholdPolicy(client);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_performance_thresholds (
       id,
       enabled,
       max_expired_backlog_count,
       max_near_expiry_backlog_count,
       max_unassigned_backlog_count,
       max_expired_backlog_rate,
       max_average_review_minutes,
       max_average_execute_minutes,
       max_average_workload_action_minutes,
       updated_by_username,
       updated_by_role
     )
     VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE
       SET enabled = EXCLUDED.enabled,
           max_expired_backlog_count = EXCLUDED.max_expired_backlog_count,
           max_near_expiry_backlog_count = EXCLUDED.max_near_expiry_backlog_count,
           max_unassigned_backlog_count = EXCLUDED.max_unassigned_backlog_count,
           max_expired_backlog_rate = EXCLUDED.max_expired_backlog_rate,
           max_average_review_minutes = EXCLUDED.max_average_review_minutes,
           max_average_execute_minutes = EXCLUDED.max_average_execute_minutes,
           max_average_workload_action_minutes = EXCLUDED.max_average_workload_action_minutes,
           updated_by_username = EXCLUDED.updated_by_username,
           updated_by_role = EXCLUDED.updated_by_role,
           updated_at = NOW()
     RETURNING enabled, max_expired_backlog_count, max_near_expiry_backlog_count,
       max_unassigned_backlog_count, max_expired_backlog_rate,
       max_average_review_minutes, max_average_execute_minutes, max_average_workload_action_minutes,
       updated_by_username, updated_by_role, created_at, updated_at`,
    [
      updates.enabled === undefined ? current.enabled : Boolean(updates.enabled),
      normalizeThresholdInteger(updates.max_expired_backlog_count, current.max_expired_backlog_count),
      normalizeThresholdInteger(updates.max_near_expiry_backlog_count, current.max_near_expiry_backlog_count),
      normalizeThresholdInteger(updates.max_unassigned_backlog_count, current.max_unassigned_backlog_count),
      normalizeThresholdRate(updates.max_expired_backlog_rate, current.max_expired_backlog_rate),
      normalizeThresholdInteger(updates.max_average_review_minutes, current.max_average_review_minutes, { min: 1, max: 10080 }),
      normalizeThresholdInteger(updates.max_average_execute_minutes, current.max_average_execute_minutes, { min: 1, max: 10080 }),
      normalizeThresholdInteger(updates.max_average_workload_action_minutes, current.max_average_workload_action_minutes, { min: 1, max: 10080 }),
      actor.username,
      actor.role
    ]
  );
  return normalizeReplayPerformanceThresholdPolicy(result.rows[0]);
}

export async function createOpsAuditNotificationReplayApproval(
  { source_attempt_id: sourceAttemptId = '', force_reason: forceReason = '', actor = {}, now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification replay approval actor is required.');
    error.code = 'ops_audit_notification_replay_approval_actor_required';
    throw error;
  }
  const sourceAttempt = await getOpsAuditNotificationDeliveryAttempt(sourceAttemptId, client);
  const explanation = explainOpsAuditNotificationDeliveryAttempt(sourceAttempt);
  if (!explanation.can_force_replay) {
    const error = new Error('This delivery attempt cannot request force replay approval.');
      error.code = 'ops_audit_notification_replay_approval_not_allowed';
    throw error;
  }
  const policy = await getOpsAuditNotificationReplayPolicy(client);
  if (!policy.enabled) {
    const error = new Error('Replay approval policy is disabled.');
    error.code = 'ops_audit_notification_replay_policy_disabled';
    throw error;
  }
  const approval = normalizeForceReplayApproval({ force: true, force_reason: forceReason }, actor);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_approvals (
       source_attempt_id,
       status,
       force_reason,
       requested_by_username,
       requested_by_role,
       expires_at,
       review_policy
     )
     VALUES ($1, 'requested', $2, $3, $4, $5::timestamptz + ($6::int * interval '1 minute'), $7::jsonb)
     RETURNING ${REPLAY_APPROVAL_SELECT_COLUMNS}`,
    [
      sourceAttempt.id,
      approval.reason,
      actor.username,
      actor.role,
      new Date(now).toISOString(),
      policy.request_ttl_minutes,
      JSON.stringify({
        enabled: policy.enabled,
        allow_self_approval: policy.allow_self_approval,
        required_reviewer_role: policy.required_reviewer_role,
        request_ttl_minutes: policy.request_ttl_minutes
      })
    ]
  );
  return normalizeReplayApproval(result.rows[0]);
}

export async function listOpsAuditNotificationReplayApprovals(
  {
    limit = 20,
    status = '',
    source_attempt_id: sourceAttemptId = '',
    requested_by: requestedBy = '',
    reviewed_by: reviewedBy = '',
    assigned_reviewer: assignedReviewer = '',
    q = '',
    expired = ''
  } = {},
  client = pool
) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const params = [];
  const where = [];
  if (status) {
    const normalizedStatus = String(status).trim().toLowerCase();
    if (!['requested', 'approved', 'rejected', 'executed', 'cancelled'].includes(normalizedStatus)) {
      const error = new Error('Evidence case notification replay approval status is invalid.');
      error.code = 'ops_audit_notification_replay_approval_status_invalid';
      throw error;
    }
    params.push(normalizedStatus);
    where.push(`status = $${params.length}`);
  }
  if (sourceAttemptId) {
    params.push(String(sourceAttemptId).trim());
    where.push(`source_attempt_id::text = $${params.length}`);
  }
  if (requestedBy) {
    params.push(`%${String(requestedBy).trim().toLowerCase()}%`);
    where.push(`LOWER(requested_by_username || ':' || requested_by_role) LIKE $${params.length}`);
  }
  if (reviewedBy) {
    params.push(`%${String(reviewedBy).trim().toLowerCase()}%`);
    where.push(`LOWER(COALESCE(reviewed_by_username, '') || ':' || COALESCE(reviewed_by_role, '')) LIKE $${params.length}`);
  }
  if (assignedReviewer) {
    params.push(`%${String(assignedReviewer).trim().toLowerCase()}%`);
    where.push(`LOWER(COALESCE(assigned_reviewer_username, '') || ':' || COALESCE(assigned_reviewer_role, '')) LIKE $${params.length}`);
  }
  if (q) {
    params.push(`%${String(q).trim().toLowerCase()}%`);
    where.push(`(
      LOWER(force_reason) LIKE $${params.length}
      OR LOWER(COALESCE(rejection_reason, '')) LIKE $${params.length}
      OR LOWER(requested_by_username || ':' || requested_by_role) LIKE $${params.length}
      OR LOWER(COALESCE(reviewed_by_username, '') || ':' || COALESCE(reviewed_by_role, '')) LIKE $${params.length}
      OR LOWER(COALESCE(assigned_reviewer_username, '') || ':' || COALESCE(assigned_reviewer_role, '')) LIKE $${params.length}
      OR source_attempt_id::text LIKE $${params.length}
      OR id::text LIKE $${params.length}
    )`);
  }
  if (expired !== '') {
    const wantsExpired = expired === true || expired === 'true';
    where.push(`${wantsExpired ? '' : 'NOT '}((status IN ('requested', 'approved')) AND expires_at IS NOT NULL AND expires_at <= NOW())`);
  }
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT ${REPLAY_APPROVAL_SELECT_COLUMNS}
     FROM internal_ops_audit_notification_replay_approvals
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeReplayApproval);
}

export async function getOpsAuditNotificationReplayApproval(id, client = pool) {
  const normalizedId = String(id || '').trim();
  if (!normalizedId) {
    const error = new Error('Evidence case notification replay approval id is required.');
    error.code = 'ops_audit_notification_replay_approval_id_required';
    throw error;
  }
  const result = await client.query(
    `SELECT ${REPLAY_APPROVAL_SELECT_COLUMNS}
     FROM internal_ops_audit_notification_replay_approvals
     WHERE id::text = $1
     LIMIT 1`,
    [normalizedId]
  );
  if (!result.rows[0]) {
    const error = new Error('Evidence case notification replay approval was not found.');
    error.code = 'ops_audit_notification_replay_approval_not_found';
    throw error;
  }
  return normalizeReplayApproval(result.rows[0]);
}

export async function assignOpsAuditNotificationReplayApproval(
  { id, assigned_reviewer: assignedReviewer, actor = {} } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification replay approval assigner is required.');
    error.code = 'ops_audit_notification_replay_approval_actor_required';
    throw error;
  }
  const current = await getOpsAuditNotificationReplayApproval(id, client);
  if (!['requested', 'approved'].includes(current.status)) {
    const error = new Error('Only open replay approvals can be assigned.');
    error.code = 'ops_audit_notification_replay_approval_not_assignable';
    throw error;
  }
  const assignee = normalizeReviewerAssignment(assignedReviewer);
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_replay_approvals
     SET assigned_reviewer_username = $2,
         assigned_reviewer_role = $3,
         updated_at = NOW()
     WHERE id::text = $1
     RETURNING ${REPLAY_APPROVAL_SELECT_COLUMNS}`,
    [current.id, assignee.username, assignee.role]
  );
  return normalizeReplayApproval(result.rows[0]);
}

export async function updateOpsAuditNotificationReplayWorkloadAction(
  { id, action = '', note = '', assigned_reviewer: assignedReviewer = null, actor = {} } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification replay approval workload actor is required.');
    error.code = 'ops_audit_notification_replay_approval_actor_required';
    throw error;
  }
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!['acknowledged', 'reassigned', 'resolved'].includes(normalizedAction)) {
    const error = new Error('Replay approval workload action is invalid.');
    error.code = 'ops_audit_notification_replay_workload_action_invalid';
    throw error;
  }
  const current = await getOpsAuditNotificationReplayApproval(id, client);
  if (!['requested', 'approved'].includes(current.status)) {
    const error = new Error('Only open replay approval workload items can be updated.');
    error.code = 'ops_audit_notification_replay_workload_action_not_open';
    throw error;
  }
  const normalizedNote = String(note || '').trim().slice(0, 500) || null;
  let assignee = null;
  if (normalizedAction === 'reassigned') {
    assignee = normalizeReviewerAssignment(assignedReviewer);
  }
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_replay_approvals
     SET assigned_reviewer_username = CASE WHEN $2 = 'reassigned' THEN $6 ELSE assigned_reviewer_username END,
         assigned_reviewer_role = CASE WHEN $2 = 'reassigned' THEN $7 ELSE assigned_reviewer_role END,
         status = CASE WHEN $2 = 'resolved' THEN 'cancelled' ELSE status END,
         cleanup_reason = CASE WHEN $2 = 'resolved' THEN COALESCE($5, cleanup_reason, 'Resolved replay approval workload item.') ELSE cleanup_reason END,
         rejection_reason = CASE WHEN $2 = 'resolved' THEN COALESCE($5, rejection_reason, 'Resolved replay approval workload item.') ELSE rejection_reason END,
         review_note = COALESCE($5, review_note),
         workload_action_status = $2,
         workload_action_by_username = $3,
         workload_action_by_role = $4,
         workload_action_note = $5,
         workload_action_at = NOW(),
         updated_at = NOW()
     WHERE id::text = $1
     RETURNING ${REPLAY_APPROVAL_SELECT_COLUMNS}`,
    [
      current.id,
      normalizedAction,
      actor.username,
      actor.role,
      normalizedNote,
      assignee?.username || null,
      assignee?.role || null
    ]
  );
  return normalizeReplayApproval(result.rows[0]);
}

export async function cleanupExpiredOpsAuditNotificationReplayApprovals(
  { actor = {}, limit = 50, now = new Date(), cleanup_reason: cleanupReason = '' } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification replay approval cleanup actor is required.');
    error.code = 'ops_audit_notification_replay_approval_actor_required';
    throw error;
  }
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const normalizedReason = String(cleanupReason || 'Expired replay approval cleanup.').trim().slice(0, 500) || 'Expired replay approval cleanup.';
  const result = await client.query(
    `WITH expired AS (
       SELECT id
       FROM internal_ops_audit_notification_replay_approvals
       WHERE status IN ('requested', 'approved')
         AND expires_at IS NOT NULL
         AND expires_at <= $1::timestamptz
       ORDER BY expires_at ASC
       LIMIT $2
     )
     UPDATE internal_ops_audit_notification_replay_approvals approvals
     SET status = 'cancelled',
         expired_at = $1::timestamptz,
         cleanup_reason = $3,
         review_note = COALESCE(review_note, $3),
         rejection_reason = COALESCE(rejection_reason, $3),
         updated_at = NOW()
     FROM expired
     WHERE approvals.id = expired.id
     RETURNING ${REPLAY_APPROVAL_RETURNING_COLUMNS}`,
    [new Date(now).toISOString(), normalizedLimit, normalizedReason]
  );
  const approvals = result.rows.map(normalizeReplayApproval);
  return {
    schema_version: 'phase4-ops-audit-notification-replay-approval-cleanup-v1',
    cleanup_reason: normalizedReason,
    cleaned_count: approvals.length,
    approvals
  };
}

function compactReplayApprovalForWorkload(approval, nowMs, dueSoonMs) {
  const isOpen = ['requested', 'approved'].includes(approval.status);
  const expiresMs = approval.expires_at ? new Date(approval.expires_at).getTime() : null;
  const expired = isOpen && expiresMs !== null && expiresMs <= nowMs;
  const near_expiry = isOpen && expiresMs !== null && expiresMs > nowMs && expiresMs <= dueSoonMs;
  return {
    id: approval.id,
    status: approval.status,
    assigned_reviewer: approval.assigned_reviewer || null,
    requested_by: approval.requested_by,
    reviewed_by: approval.reviewed_by || null,
    executed_by: approval.executed_by || null,
    source_attempt_id: approval.source_attempt_id,
    expires_at: approval.expires_at,
    expired,
    near_expiry,
    workload_action_status: approval.workload_action_status || null,
    workload_action_by: approval.workload_action_by || null,
    workload_action_at: approval.workload_action_at || null,
    age_minutes: approval.created_at
      ? Math.max(0, Math.round((nowMs - new Date(approval.created_at).getTime()) / 60000))
      : null,
    reason_preview: String(approval.rejection_reason || approval.review_note || approval.force_reason || '').slice(0, 120)
  };
}

export function buildOpsAuditNotificationReplayWorkload(
  approvals = [],
  { due_soon_hours: dueSoonHours = 4, now = new Date() } = {}
) {
  const generatedAt = new Date(now);
  const nowMs = generatedAt.getTime();
  const normalizedDueSoonHours = Math.max(1, Math.min(Number(dueSoonHours) || 4, 168));
  const dueSoonMs = nowMs + normalizedDueSoonHours * 60 * 60 * 1000;
  const groups = new Map();
  const summary = {
    total_approvals: approvals.length,
    active_count: 0,
    requested_count: 0,
    approved_count: 0,
    expired_count: 0,
    near_expiry_count: 0,
    unassigned_count: 0,
    assigned_reviewer_count: 0
  };

  for (const approval of approvals) {
    const compact = compactReplayApprovalForWorkload(approval, nowMs, dueSoonMs);
    const reviewer = compact.assigned_reviewer || 'unassigned';
    if (!groups.has(reviewer)) {
      groups.set(reviewer, {
        reviewer,
        assigned: reviewer !== 'unassigned',
        active_count: 0,
        requested_count: 0,
        approved_count: 0,
        expired_count: 0,
        near_expiry_count: 0,
        newest_request_at: null,
        oldest_expiry_at: null,
        approvals: []
      });
    }
    const group = groups.get(reviewer);
    const isOpen = ['requested', 'approved'].includes(compact.status);
    if (isOpen) {
      group.active_count += 1;
      summary.active_count += 1;
    }
    if (compact.status === 'requested') {
      group.requested_count += 1;
      summary.requested_count += 1;
    }
    if (compact.status === 'approved') {
      group.approved_count += 1;
      summary.approved_count += 1;
    }
    if (compact.expired) {
      group.expired_count += 1;
      summary.expired_count += 1;
    }
    if (compact.near_expiry) {
      group.near_expiry_count += 1;
      summary.near_expiry_count += 1;
    }
    if (reviewer === 'unassigned' && isOpen) summary.unassigned_count += 1;
    if (reviewer !== 'unassigned' && isOpen) summary.assigned_reviewer_count += 1;
    if (approval.created_at && (!group.newest_request_at || new Date(approval.created_at) > new Date(group.newest_request_at))) {
      group.newest_request_at = approval.created_at;
    }
    if (approval.expires_at && isOpen && (!group.oldest_expiry_at || new Date(approval.expires_at) < new Date(group.oldest_expiry_at))) {
      group.oldest_expiry_at = approval.expires_at;
    }
    group.approvals.push(compact);
  }

  const reviewers = Array.from(groups.values())
    .filter((group) => group.active_count > 0 || group.approvals.length > 0)
    .map((group) => ({
      ...group,
      escalation_needed: group.expired_count > 0 || group.near_expiry_count > 0 || (group.reviewer === 'unassigned' && group.active_count > 0),
      approvals: group.approvals
        .sort((a, b) => {
          if (a.expired !== b.expired) return a.expired ? -1 : 1;
          if (a.near_expiry !== b.near_expiry) return a.near_expiry ? -1 : 1;
          return new Date(a.expires_at || a.created_at || 0) - new Date(b.expires_at || b.created_at || 0);
        })
        .slice(0, 10)
    }))
    .sort((a, b) =>
      b.expired_count - a.expired_count ||
      b.near_expiry_count - a.near_expiry_count ||
      b.active_count - a.active_count ||
      a.reviewer.localeCompare(b.reviewer)
    );

  summary.reviewer_count = reviewers.filter((group) => group.assigned).length;
  summary.escalation_reviewer_count = reviewers.filter((group) => group.escalation_needed).length;
  return {
    schema_version: 'phase4-ops-audit-notification-replay-workload-v1',
    generated_at: generatedAt.toISOString(),
    due_soon_hours: normalizedDueSoonHours,
    summary,
    reviewers
  };
}

export async function getOpsAuditNotificationReplayWorkload(
  { limit = 100, assigned_reviewer: assignedReviewer = '', due_soon_hours: dueSoonHours = 4, now = new Date() } = {},
  client = pool
) {
  const approvals = await listOpsAuditNotificationReplayApprovals(
    {
      limit,
      assigned_reviewer: assignedReviewer
    },
    client
  );
  return buildOpsAuditNotificationReplayWorkload(approvals, {
    due_soon_hours: dueSoonHours,
    now
  });
}

export function buildOpsAuditNotificationReplayEscalationReport(workload, { actor = {} } = {}) {
  const reviewers = (workload.reviewers || []).filter((reviewer) => reviewer.escalation_needed);
  const recommendations = [];
  if (workload.summary?.expired_count > 0) recommendations.push('Clean up or reject expired replay approvals before any force replay execution.');
  if (workload.summary?.near_expiry_count > 0) recommendations.push('Prioritize near-expiry approvals before the request TTL closes.');
  if (workload.summary?.unassigned_count > 0) recommendations.push('Assign unassigned requested approvals to a reviewer to preserve dual-control accountability.');
  if (!recommendations.length) recommendations.push('No escalation required; continue monitoring assigned reviewer workload.');
  const report = {
    schema_version: 'phase4-ops-audit-notification-replay-escalation-report-v1',
    generated_at: new Date().toISOString(),
    requested_by: actor?.username ? `${actor.username}:${actor.role || 'unknown'}` : 'unknown:unknown',
    workload_summary: workload.summary || {},
    due_soon_hours: workload.due_soon_hours,
    reviewers,
    recommendations,
    watermark: 'internal_ops_audit_notification_replay_escalation_report'
  };
  return {
    ...report,
    report_hash: digestValue(report)
  };
}

export function buildOpsAuditNotificationReplayEscalationReportHtml(report) {
  const rows = (report.reviewers || [])
    .map((reviewer) => `
      <tr>
        <td>${escapeHtml(reviewer.reviewer)}</td>
        <td>${escapeHtml(reviewer.active_count)}</td>
        <td>${escapeHtml(reviewer.expired_count)}</td>
        <td>${escapeHtml(reviewer.near_expiry_count)}</td>
        <td>${escapeHtml(reviewer.oldest_expiry_at || 'none')}</td>
      </tr>
    `)
    .join('');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Replay Approval Escalation Report</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; margin-top: 18px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 13px; }
      th { background: #f3f4f6; }
      .meta, li { font-size: 13px; color: #374151; }
      .watermark { margin-top: 24px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>Replay Approval Escalation Report</h1>
    <div class="meta">Generated ${escapeHtml(report.generated_at)} by ${escapeHtml(report.requested_by)}</div>
    <div class="meta">Report hash ${escapeHtml(report.report_hash)}</div>
    <h2>Summary</h2>
    <div class="meta">
      Active ${escapeHtml(report.workload_summary.active_count || 0)} ·
      Expired ${escapeHtml(report.workload_summary.expired_count || 0)} ·
      Near expiry ${escapeHtml(report.workload_summary.near_expiry_count || 0)} ·
      Unassigned ${escapeHtml(report.workload_summary.unassigned_count || 0)}
    </div>
    <h2>Recommendations</h2>
    <ul>${(report.recommendations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <h2>Reviewer Workload</h2>
    <table>
      <thead><tr><th>Reviewer</th><th>Active</th><th>Expired</th><th>Near expiry</th><th>Oldest expiry</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">No escalation workload</td></tr>'}</tbody>
    </table>
    <div class="watermark">${escapeHtml(report.watermark)}</div>
  </body>
</html>`;
}

function minutesBetween(start, end) {
  if (!start || !end) return null;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

function createReplayPerformanceReviewer(reviewer) {
  return {
    reviewer,
    assigned_active_count: 0,
    requested_backlog_count: 0,
    approved_backlog_count: 0,
    expired_backlog_count: 0,
    near_expiry_backlog_count: 0,
    approved_count: 0,
    rejected_count: 0,
    executed_count: 0,
    acknowledged_count: 0,
    reassigned_count: 0,
    resolved_count: 0,
    review_latency_minutes: [],
    execute_latency_minutes: [],
    workload_action_latency_minutes: []
  };
}

function reviewerRow(rows, reviewer) {
  const normalizedReviewer = reviewer || 'unassigned';
  if (!rows.has(normalizedReviewer)) rows.set(normalizedReviewer, createReplayPerformanceReviewer(normalizedReviewer));
  return rows.get(normalizedReviewer);
}

function average(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (!filtered.length) return null;
  return Math.round(filtered.reduce((sum, value) => sum + value, 0) / filtered.length);
}

function finalizeReplayPerformanceReviewer(row) {
  const active = row.assigned_active_count;
  const totalClosedActions = row.approved_count + row.rejected_count + row.executed_count + row.resolved_count;
  return {
    reviewer: row.reviewer,
    assigned_active_count: row.assigned_active_count,
    requested_backlog_count: row.requested_backlog_count,
    approved_backlog_count: row.approved_backlog_count,
    expired_backlog_count: row.expired_backlog_count,
    near_expiry_backlog_count: row.near_expiry_backlog_count,
    approved_count: row.approved_count,
    rejected_count: row.rejected_count,
    executed_count: row.executed_count,
    acknowledged_count: row.acknowledged_count,
    reassigned_count: row.reassigned_count,
    resolved_count: row.resolved_count,
    closed_action_count: totalClosedActions,
    expired_backlog_rate: active ? Number((row.expired_backlog_count / active).toFixed(4)) : 0,
    average_review_minutes: average(row.review_latency_minutes),
    average_execute_minutes: average(row.execute_latency_minutes),
    average_workload_action_minutes: average(row.workload_action_latency_minutes),
    accountability_risk: row.expired_backlog_count > 0 || row.near_expiry_backlog_count > 0 || (row.reviewer === 'unassigned' && active > 0)
  };
}

function replayPerformanceAlert({ severity, scope, reviewer = null, metric, value, threshold, message }) {
  return { severity, scope, reviewer, metric, value, threshold, message };
}

function buildReplayPerformanceThresholdAlerts(summary, reviewers, policy) {
  const normalizedPolicy = normalizeReplayPerformanceThresholdPolicy(policy);
  if (!normalizedPolicy.enabled) {
    return {
      alert_summary: {
        status: 'disabled',
        alert_count: 0,
        critical_count: 0,
        warning_count: 0
      },
      alerts: [],
      reviewers: reviewers.map((reviewer) => ({ ...reviewer, threshold_status: 'disabled', threshold_alerts: [] }))
    };
  }
  const alerts = [];
  if (summary.expired_backlog_count > normalizedPolicy.max_expired_backlog_count) {
    alerts.push(replayPerformanceAlert({
      severity: 'critical',
      scope: 'summary',
      metric: 'expired_backlog_count',
      value: summary.expired_backlog_count,
      threshold: normalizedPolicy.max_expired_backlog_count,
      message: 'Expired replay approval backlog exceeds the SLA threshold.'
    }));
  }
  if (summary.near_expiry_backlog_count > normalizedPolicy.max_near_expiry_backlog_count) {
    alerts.push(replayPerformanceAlert({
      severity: 'warning',
      scope: 'summary',
      metric: 'near_expiry_backlog_count',
      value: summary.near_expiry_backlog_count,
      threshold: normalizedPolicy.max_near_expiry_backlog_count,
      message: 'Near-expiry replay approval backlog exceeds the SLA threshold.'
    }));
  }
  if (summary.unassigned_backlog_count > normalizedPolicy.max_unassigned_backlog_count) {
    alerts.push(replayPerformanceAlert({
      severity: 'warning',
      scope: 'summary',
      metric: 'unassigned_backlog_count',
      value: summary.unassigned_backlog_count,
      threshold: normalizedPolicy.max_unassigned_backlog_count,
      message: 'Unassigned replay approval backlog exceeds the accountability threshold.'
    }));
  }

  const reviewersWithAlerts = reviewers.map((reviewer) => {
    const reviewerAlerts = [];
    if (reviewer.expired_backlog_count > normalizedPolicy.max_expired_backlog_count) {
      reviewerAlerts.push(replayPerformanceAlert({
        severity: 'critical',
        scope: 'reviewer',
        reviewer: reviewer.reviewer,
        metric: 'expired_backlog_count',
        value: reviewer.expired_backlog_count,
        threshold: normalizedPolicy.max_expired_backlog_count,
        message: 'Reviewer has expired replay approval backlog above threshold.'
      }));
    }
    if (reviewer.near_expiry_backlog_count > normalizedPolicy.max_near_expiry_backlog_count) {
      reviewerAlerts.push(replayPerformanceAlert({
        severity: 'warning',
        scope: 'reviewer',
        reviewer: reviewer.reviewer,
        metric: 'near_expiry_backlog_count',
        value: reviewer.near_expiry_backlog_count,
        threshold: normalizedPolicy.max_near_expiry_backlog_count,
        message: 'Reviewer has near-expiry replay approvals above threshold.'
      }));
    }
    if (reviewer.expired_backlog_rate > normalizedPolicy.max_expired_backlog_rate) {
      reviewerAlerts.push(replayPerformanceAlert({
        severity: 'critical',
        scope: 'reviewer',
        reviewer: reviewer.reviewer,
        metric: 'expired_backlog_rate',
        value: reviewer.expired_backlog_rate,
        threshold: normalizedPolicy.max_expired_backlog_rate,
        message: 'Reviewer expired backlog rate exceeds threshold.'
      }));
    }
    if (reviewer.average_review_minutes !== null && reviewer.average_review_minutes > normalizedPolicy.max_average_review_minutes) {
      reviewerAlerts.push(replayPerformanceAlert({
        severity: 'warning',
        scope: 'reviewer',
        reviewer: reviewer.reviewer,
        metric: 'average_review_minutes',
        value: reviewer.average_review_minutes,
        threshold: normalizedPolicy.max_average_review_minutes,
        message: 'Reviewer average review latency exceeds threshold.'
      }));
    }
    if (reviewer.average_execute_minutes !== null && reviewer.average_execute_minutes > normalizedPolicy.max_average_execute_minutes) {
      reviewerAlerts.push(replayPerformanceAlert({
        severity: 'warning',
        scope: 'reviewer',
        reviewer: reviewer.reviewer,
        metric: 'average_execute_minutes',
        value: reviewer.average_execute_minutes,
        threshold: normalizedPolicy.max_average_execute_minutes,
        message: 'Reviewer average execute latency exceeds threshold.'
      }));
    }
    if (reviewer.average_workload_action_minutes !== null && reviewer.average_workload_action_minutes > normalizedPolicy.max_average_workload_action_minutes) {
      reviewerAlerts.push(replayPerformanceAlert({
        severity: 'warning',
        scope: 'reviewer',
        reviewer: reviewer.reviewer,
        metric: 'average_workload_action_minutes',
        value: reviewer.average_workload_action_minutes,
        threshold: normalizedPolicy.max_average_workload_action_minutes,
        message: 'Reviewer average workload action latency exceeds threshold.'
      }));
    }
    alerts.push(...reviewerAlerts);
    return {
      ...reviewer,
      threshold_status: reviewerAlerts.some((alert) => alert.severity === 'critical') ? 'critical' : (reviewerAlerts.length ? 'warning' : 'ok'),
      threshold_alerts: reviewerAlerts
    };
  });
  const criticalCount = alerts.filter((alert) => alert.severity === 'critical').length;
  const warningCount = alerts.filter((alert) => alert.severity === 'warning').length;
  return {
    alert_summary: {
      status: criticalCount > 0 ? 'critical' : (warningCount > 0 ? 'warning' : 'ok'),
      alert_count: alerts.length,
      critical_count: criticalCount,
      warning_count: warningCount
    },
    alerts,
    reviewers: reviewersWithAlerts
  };
}

export function buildOpsAuditNotificationReplayPerformanceReport(
  approvals = [],
  { due_soon_hours: dueSoonHours = 4, now = new Date(), actor = {}, threshold_policy: thresholdPolicy = {} } = {}
) {
  const generatedAt = new Date(now);
  const workload = buildOpsAuditNotificationReplayWorkload(approvals, { due_soon_hours: dueSoonHours, now: generatedAt });
  const rows = new Map();
  for (const approval of approvals) {
    const assignedReviewer = approval.assigned_reviewer || 'unassigned';
    const assigned = reviewerRow(rows, assignedReviewer);
    const isOpen = ['requested', 'approved'].includes(approval.status);
    if (isOpen) {
      assigned.assigned_active_count += 1;
      if (approval.status === 'requested') assigned.requested_backlog_count += 1;
      if (approval.status === 'approved') assigned.approved_backlog_count += 1;
      if (isReplayApprovalExpired(approval, generatedAt)) assigned.expired_backlog_count += 1;
      const expiresMs = approval.expires_at ? new Date(approval.expires_at).getTime() : null;
      const dueSoonMs = generatedAt.getTime() + workload.due_soon_hours * 60 * 60 * 1000;
      if (expiresMs && expiresMs > generatedAt.getTime() && expiresMs <= dueSoonMs) assigned.near_expiry_backlog_count += 1;
    }

    if (approval.reviewed_by) {
      const reviewer = reviewerRow(rows, approval.reviewed_by);
      if (approval.status === 'approved' || approval.executed_by) reviewer.approved_count += 1;
      if (approval.status === 'rejected') reviewer.rejected_count += 1;
      const reviewLatency = minutesBetween(approval.created_at, approval.reviewed_at);
      if (reviewLatency !== null) reviewer.review_latency_minutes.push(reviewLatency);
    }
    if (approval.executed_by) {
      const executor = reviewerRow(rows, approval.executed_by);
      executor.executed_count += 1;
      const executeLatency = minutesBetween(approval.reviewed_at || approval.created_at, approval.executed_at);
      if (executeLatency !== null) executor.execute_latency_minutes.push(executeLatency);
    }
    if (approval.workload_action_by) {
      const actorRow = reviewerRow(rows, approval.workload_action_by);
      if (approval.workload_action_status === 'acknowledged') actorRow.acknowledged_count += 1;
      if (approval.workload_action_status === 'reassigned') actorRow.reassigned_count += 1;
      if (approval.workload_action_status === 'resolved') actorRow.resolved_count += 1;
      const actionLatency = minutesBetween(approval.created_at, approval.workload_action_at);
      if (actionLatency !== null) actorRow.workload_action_latency_minutes.push(actionLatency);
    }
  }

  const reviewers = Array.from(rows.values())
    .map(finalizeReplayPerformanceReviewer)
    .sort((a, b) =>
      b.expired_backlog_count - a.expired_backlog_count ||
      b.near_expiry_backlog_count - a.near_expiry_backlog_count ||
      b.assigned_active_count - a.assigned_active_count ||
      b.closed_action_count - a.closed_action_count ||
      a.reviewer.localeCompare(b.reviewer)
    );

  const recommendations = [];
  if (workload.summary.expired_count > 0) recommendations.push('Clear expired reviewer backlog before any force replay execution.');
  if (workload.summary.near_expiry_count > 0) recommendations.push('Prioritize near-expiry reviewer approvals and record acknowledgement before the TTL closes.');
  if (workload.summary.unassigned_count > 0) recommendations.push('Assign unassigned approvals to reviewers for explicit accountability.');
  if (!recommendations.length) recommendations.push('Reviewer SLA posture is clean; continue monitoring closed-action latency.');

  const summary = {
    total_approvals: approvals.length,
    active_backlog_count: workload.summary.active_count,
    requested_backlog_count: workload.summary.requested_count,
    approved_backlog_count: workload.summary.approved_count,
    expired_backlog_count: workload.summary.expired_count,
    near_expiry_backlog_count: workload.summary.near_expiry_count,
    unassigned_backlog_count: workload.summary.unassigned_count,
    reviewer_count: reviewers.filter((row) => row.reviewer !== 'unassigned').length,
    accountability_risk_count: reviewers.filter((row) => row.accountability_risk).length,
    closed_action_count: reviewers.reduce((sum, row) => sum + row.closed_action_count, 0),
    acknowledgement_count: reviewers.reduce((sum, row) => sum + row.acknowledged_count, 0),
    reassignment_count: reviewers.reduce((sum, row) => sum + row.reassigned_count, 0),
    resolution_count: reviewers.reduce((sum, row) => sum + row.resolved_count, 0)
  };
  const thresholdPolicySnapshot = normalizeReplayPerformanceThresholdPolicy(thresholdPolicy);
  const thresholdAlerts = buildReplayPerformanceThresholdAlerts(summary, reviewers, thresholdPolicySnapshot);
  if (thresholdAlerts.alert_summary.critical_count > 0) {
    recommendations.push('Escalate critical reviewer SLA alerts before any force replay execution.');
  } else if (thresholdAlerts.alert_summary.warning_count > 0) {
    recommendations.push('Review warning-level reviewer SLA alerts before the next approval cycle.');
  }

  const report = {
    schema_version: 'phase4-ops-audit-notification-replay-performance-report-v1',
    generated_at: generatedAt.toISOString(),
    requested_by: actor?.username ? `${actor.username}:${actor.role || 'unknown'}` : 'unknown:unknown',
    due_soon_hours: workload.due_soon_hours,
    threshold_policy: thresholdPolicySnapshot,
    alert_summary: thresholdAlerts.alert_summary,
    summary,
    reviewers: thresholdAlerts.reviewers,
    alerts: thresholdAlerts.alerts.slice(0, 100),
    recommendations,
    watermark: 'internal_ops_audit_notification_replay_performance_report'
  };
  return {
    ...report,
    report_hash: digestValue(report)
  };
}

export async function getOpsAuditNotificationReplayPerformanceReport(
  { limit = 100, assigned_reviewer: assignedReviewer = '', due_soon_hours: dueSoonHours = 4, now = new Date(), actor = {} } = {},
  client = pool
) {
  const thresholdPolicy = await getOpsAuditNotificationReplayPerformanceThresholdPolicy(client);
  const approvals = await listOpsAuditNotificationReplayApprovals(
    {
      limit,
      assigned_reviewer: assignedReviewer
    },
    client
  );
  return buildOpsAuditNotificationReplayPerformanceReport(approvals, {
    due_soon_hours: dueSoonHours,
    now,
    actor,
    threshold_policy: thresholdPolicy
  });
}

export function buildOpsAuditNotificationReplayPerformanceReportHtml(report) {
  const rows = (report.reviewers || [])
    .map((reviewer) => `
      <tr>
        <td>${escapeHtml(reviewer.reviewer)}</td>
        <td>${escapeHtml(reviewer.assigned_active_count)}</td>
        <td>${escapeHtml(reviewer.expired_backlog_count)}</td>
        <td>${escapeHtml(reviewer.near_expiry_backlog_count)}</td>
        <td>${escapeHtml(reviewer.closed_action_count)}</td>
        <td>${escapeHtml(reviewer.threshold_status || 'ok')}</td>
        <td>${escapeHtml(reviewer.average_review_minutes ?? 'n/a')}</td>
        <td>${escapeHtml(reviewer.average_execute_minutes ?? 'n/a')}</td>
        <td>${escapeHtml(reviewer.average_workload_action_minutes ?? 'n/a')}</td>
      </tr>
    `)
    .join('');
  const alerts = (report.alerts || [])
    .map((alert) => `<li>${escapeHtml(alert.severity)} · ${escapeHtml(alert.scope)} · ${escapeHtml(alert.reviewer || 'all')} · ${escapeHtml(alert.metric)} ${escapeHtml(alert.value)} / ${escapeHtml(alert.threshold)}</li>`)
    .join('');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Replay Reviewer Performance Report</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; margin-top: 18px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 13px; }
      th { background: #f3f4f6; }
      .meta, li { font-size: 13px; color: #374151; }
      .watermark { margin-top: 24px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>Replay Reviewer Performance Report</h1>
    <div class="meta">Generated ${escapeHtml(report.generated_at)} by ${escapeHtml(report.requested_by)}</div>
    <div class="meta">Report hash ${escapeHtml(report.report_hash)}</div>
    <h2>Summary</h2>
    <div class="meta">
      Active backlog ${escapeHtml(report.summary.active_backlog_count || 0)} ·
      Expired ${escapeHtml(report.summary.expired_backlog_count || 0)} ·
      Near expiry ${escapeHtml(report.summary.near_expiry_backlog_count || 0)} ·
      Closed actions ${escapeHtml(report.summary.closed_action_count || 0)} ·
      Alert status ${escapeHtml(report.alert_summary?.status || 'ok')}
    </div>
    <h2>Threshold Snapshot</h2>
    <div class="meta">
      Enabled ${escapeHtml(report.threshold_policy?.enabled !== false)} ·
      Max expired ${escapeHtml(report.threshold_policy?.max_expired_backlog_count ?? 0)} ·
      Max near expiry ${escapeHtml(report.threshold_policy?.max_near_expiry_backlog_count ?? 0)} ·
      Max unassigned ${escapeHtml(report.threshold_policy?.max_unassigned_backlog_count ?? 0)} ·
      Max expired rate ${escapeHtml(report.threshold_policy?.max_expired_backlog_rate ?? 0)}
    </div>
    <h2>SLA Alerts</h2>
    <ul>${alerts || '<li>No reviewer SLA alerts</li>'}</ul>
    <h2>Recommendations</h2>
    <ul>${(report.recommendations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <h2>Reviewer Accountability</h2>
    <table>
      <thead><tr><th>Reviewer</th><th>Active</th><th>Expired</th><th>Near expiry</th><th>Closed actions</th><th>Threshold</th><th>Avg review min</th><th>Avg execute min</th><th>Avg action min</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="9">No reviewer performance rows</td></tr>'}</tbody>
    </table>
    <div class="watermark">${escapeHtml(report.watermark)}</div>
  </body>
</html>`;
}

function reviewerParts(value) {
  const [username, role = 'admin'] = String(value || '').split(':');
  return {
    username: username || null,
    role: username ? role || 'admin' : null
  };
}

function replaySlaAlertKey(alert) {
  return [
    'phase4.51',
    alert.scope || 'summary',
    alert.reviewer || 'all',
    alert.metric || 'unknown'
  ].join('|');
}

function normalizeReplaySlaAlert(row = {}) {
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-v1',
    id: row.id,
    alert_key: row.alert_key,
    status: row.status,
    severity: row.severity,
    scope: row.scope,
    reviewer: row.reviewer_username ? `${row.reviewer_username}:${row.reviewer_role || 'admin'}` : null,
    metric: row.metric,
    value: row.value_numeric === null || row.value_numeric === undefined ? null : Number(row.value_numeric),
    threshold: row.threshold_numeric === null || row.threshold_numeric === undefined ? null : Number(row.threshold_numeric),
    message: row.message,
    report_hash: row.report_hash || null,
    threshold_policy: row.threshold_policy || {},
    source_alert: row.source_alert || {},
    generated_by: `${row.generated_by_username}:${row.generated_by_role}`,
    routed_to: row.routed_to_username ? `${row.routed_to_username}:${row.routed_to_role || 'operator'}` : null,
    acknowledged_by: row.acknowledged_by_username ? `${row.acknowledged_by_username}:${row.acknowledged_by_role || 'operator'}` : null,
    acknowledged_at: row.acknowledged_at || null,
    snoozed_until: row.snoozed_until || null,
    resolved_by: row.resolved_by_username ? `${row.resolved_by_username}:${row.resolved_by_role || 'operator'}` : null,
    resolved_at: row.resolved_at || null,
    action_note: row.action_note || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export async function listOpsAuditNotificationReplaySlaAlerts(
  { limit = 50, status = '', severity = '', reviewer = '', metric = '' } = {},
  client = pool
) {
  const clauses = [];
  const params = [];
  const normalizedStatus = String(status || '').trim().toLowerCase();
  const normalizedSeverity = String(severity || '').trim().toLowerCase();
  const normalizedReviewer = String(reviewer || '').trim();
  const normalizedMetric = String(metric || '').trim();
  if (normalizedStatus) {
    params.push(normalizedStatus);
    clauses.push(`status = $${params.length}`);
  }
  if (normalizedSeverity) {
    params.push(normalizedSeverity);
    clauses.push(`severity = $${params.length}`);
  }
  if (normalizedReviewer) {
    const parts = reviewerParts(normalizedReviewer);
    params.push(parts.username);
    clauses.push(`reviewer_username = $${params.length}`);
  }
  if (normalizedMetric) {
    params.push(normalizedMetric);
    clauses.push(`metric = $${params.length}`);
  }
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  params.push(normalizedLimit);
  const result = await client.query(
    `SELECT *
     FROM internal_ops_audit_notification_replay_sla_alerts
     ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
     ORDER BY
       CASE status WHEN 'open' THEN 0 WHEN 'snoozed' THEN 1 WHEN 'acked' THEN 2 ELSE 3 END,
       CASE severity WHEN 'critical' THEN 0 ELSE 1 END,
       updated_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows.map(normalizeReplaySlaAlert);
}

export function buildOpsAuditNotificationReplaySlaAlertSummary(alerts = []) {
  const active = alerts.filter((alert) => ['open', 'snoozed'].includes(alert.status));
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-summary-v1',
    total_count: alerts.length,
    active_count: active.length,
    open_count: alerts.filter((alert) => alert.status === 'open').length,
    snoozed_count: alerts.filter((alert) => alert.status === 'snoozed').length,
    acked_count: alerts.filter((alert) => alert.status === 'acked').length,
    resolved_count: alerts.filter((alert) => alert.status === 'resolved').length,
    critical_count: active.filter((alert) => alert.severity === 'critical').length,
    warning_count: active.filter((alert) => alert.severity === 'warning').length
  };
}

export async function generateOpsAuditNotificationReplaySlaAlerts(
  { limit = 100, assigned_reviewer: assignedReviewer = '', due_soon_hours: dueSoonHours = 4, actor = {} } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert generation actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_actor_required';
    throw error;
  }
  const report = await getOpsAuditNotificationReplayPerformanceReport(
    { limit, assigned_reviewer: assignedReviewer, due_soon_hours: dueSoonHours, actor },
    client
  );
  const generatedAlerts = [];
  for (const alert of report.alerts || []) {
    const reviewer = reviewerParts(alert.reviewer);
    const routedTo = reviewer.username && reviewer.username !== 'unassigned'
      ? reviewer
      : { username: actor.username, role: actor.role };
    const result = await client.query(
      `INSERT INTO internal_ops_audit_notification_replay_sla_alerts (
         alert_key,
         status,
         severity,
         scope,
         reviewer_username,
         reviewer_role,
         metric,
         value_numeric,
         threshold_numeric,
         message,
         report_hash,
         threshold_policy,
         source_alert,
         generated_by_username,
         generated_by_role,
         routed_to_username,
         routed_to_role
       )
       VALUES ($1, 'open', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14, $15, $16)
       ON CONFLICT (alert_key) DO UPDATE SET
         severity = EXCLUDED.severity,
         scope = EXCLUDED.scope,
         reviewer_username = EXCLUDED.reviewer_username,
         reviewer_role = EXCLUDED.reviewer_role,
         metric = EXCLUDED.metric,
         value_numeric = EXCLUDED.value_numeric,
         threshold_numeric = EXCLUDED.threshold_numeric,
         message = EXCLUDED.message,
         report_hash = EXCLUDED.report_hash,
         threshold_policy = EXCLUDED.threshold_policy,
         source_alert = EXCLUDED.source_alert,
         generated_by_username = EXCLUDED.generated_by_username,
         generated_by_role = EXCLUDED.generated_by_role,
         routed_to_username = EXCLUDED.routed_to_username,
         routed_to_role = EXCLUDED.routed_to_role,
         status = CASE
           WHEN internal_ops_audit_notification_replay_sla_alerts.status = 'resolved' THEN 'open'
           WHEN internal_ops_audit_notification_replay_sla_alerts.status = 'snoozed'
            AND internal_ops_audit_notification_replay_sla_alerts.snoozed_until <= NOW() THEN 'open'
           ELSE internal_ops_audit_notification_replay_sla_alerts.status
         END,
         updated_at = NOW()
       RETURNING *`,
      [
        replaySlaAlertKey(alert),
        alert.severity,
        alert.scope,
        reviewer.username,
        reviewer.role,
        alert.metric,
        alert.value,
        alert.threshold,
        alert.message,
        report.report_hash,
        JSON.stringify(report.threshold_policy || {}),
        JSON.stringify(alert),
        actor.username,
        actor.role,
        routedTo.username,
        routedTo.role
      ]
    );
    generatedAlerts.push(normalizeReplaySlaAlert(result.rows[0]));
  }
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-generation-v1',
    generated_at: report.generated_at,
    generated_by: `${actor.username}:${actor.role}`,
    report_hash: report.report_hash,
    alert_summary: report.alert_summary,
    persisted_summary: buildOpsAuditNotificationReplaySlaAlertSummary(generatedAlerts),
    alerts: generatedAlerts,
    watermark: 'internal_ops_audit_notification_replay_sla_alert_generation'
  };
}

export async function updateOpsAuditNotificationReplaySlaAlert(
  id,
  { status = '', note = '', snoozed_until: snoozedUntil = null, snooze_minutes: snoozeMinutes = 60 } = {},
  actor = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_actor_required';
    throw error;
  }
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!['acked', 'snoozed', 'resolved'].includes(normalizedStatus)) {
    const error = new Error('Replay SLA alert action is invalid.');
    error.code = 'ops_audit_notification_replay_sla_alert_status_invalid';
    throw error;
  }
  const normalizedNote = String(note || '').trim().slice(0, 500);
  const snoozeUntil = normalizedStatus === 'snoozed'
    ? (snoozedUntil ? new Date(snoozedUntil) : new Date(Date.now() + Math.max(1, Number(snoozeMinutes) || 60) * 60 * 1000))
    : null;
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_replay_sla_alerts
     SET status = $2,
         acknowledged_by_username = CASE WHEN $2 = 'acked' THEN $3 ELSE acknowledged_by_username END,
         acknowledged_by_role = CASE WHEN $2 = 'acked' THEN $4 ELSE acknowledged_by_role END,
         acknowledged_at = CASE WHEN $2 = 'acked' THEN NOW() ELSE acknowledged_at END,
         snoozed_until = CASE WHEN $2 = 'snoozed' THEN $5 ELSE snoozed_until END,
         resolved_by_username = CASE WHEN $2 = 'resolved' THEN $3 ELSE resolved_by_username END,
         resolved_by_role = CASE WHEN $2 = 'resolved' THEN $4 ELSE resolved_by_role END,
         resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE resolved_at END,
         action_note = $6,
         updated_at = NOW()
     WHERE id::text = $1
     RETURNING *`,
    [id, normalizedStatus, actor.username, actor.role, snoozeUntil ? snoozeUntil.toISOString() : null, normalizedNote]
  );
  if (!result.rows.length) {
    const error = new Error('Replay SLA alert was not found.');
    error.code = 'ops_audit_notification_replay_sla_alert_not_found';
    throw error;
  }
  return normalizeReplaySlaAlert(result.rows[0]);
}

function normalizeReplaySlaAlertSchedule(row = {}) {
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-schedule-v1',
    enabled: row.enabled !== false,
    interval_minutes: Number(row.interval_minutes ?? 60),
    due_soon_hours: Number(row.due_soon_hours ?? 4),
    alert_limit: Number(row.alert_limit ?? 100),
    quiet_hours_enabled: row.quiet_hours_enabled === true,
    quiet_hours_start: row.quiet_hours_start || '22:00',
    quiet_hours_end: row.quiet_hours_end || '08:00',
    timezone: row.timezone || 'UTC',
    last_run_at: row.last_run_at || null,
    next_run_at: row.next_run_at || null,
    last_result: row.last_result || {},
    updated_by: row.updated_by_username ? `${row.updated_by_username}:${row.updated_by_role || 'unknown'}` : null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

function normalizeScheduleInteger(value, fallback, { min = 1, max = 10080 } = {}) {
  const normalized = value === undefined ? fallback : Math.round(Number(value));
  if (!Number.isFinite(normalized) || normalized < min || normalized > max) {
    const error = new Error('Replay SLA alert schedule value is invalid.');
    error.code = 'ops_audit_notification_replay_sla_alert_schedule_invalid';
    throw error;
  }
  return normalized;
}

function normalizeReplaySlaScheduleQuietHour(value, fallback) {
  const normalized = String(value ?? fallback).trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    const error = new Error('Replay SLA alert schedule quiet hour is invalid.');
    error.code = 'ops_audit_notification_replay_sla_alert_schedule_invalid';
    throw error;
  }
  const [hour, minute] = normalized.split(':').map(Number);
  if (hour > 23 || minute > 59) {
    const error = new Error('Replay SLA alert schedule quiet hour is invalid.');
    error.code = 'ops_audit_notification_replay_sla_alert_schedule_invalid';
    throw error;
  }
  return normalized;
}

function minutesOfDay(value) {
  const [hour, minute] = String(value).split(':').map(Number);
  return hour * 60 + minute;
}

function isQuietHour(schedule, now = new Date()) {
  if (!schedule.quiet_hours_enabled) return false;
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = minutesOfDay(schedule.quiet_hours_start);
  const end = minutesOfDay(schedule.quiet_hours_end);
  if (start === end) return false;
  return start < end ? minute >= start && minute < end : minute >= start || minute < end;
}

export async function getOpsAuditNotificationReplaySlaAlertSchedule(client = pool) {
  const result = await client.query(
    `SELECT *
     FROM internal_ops_audit_notification_replay_sla_alert_schedule
     WHERE id = TRUE
     LIMIT 1`
  );
  return normalizeReplaySlaAlertSchedule(result.rows[0] || {});
}

export async function updateOpsAuditNotificationReplaySlaAlertSchedule(input = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert schedule actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_schedule_actor_required';
    throw error;
  }
  const current = await getOpsAuditNotificationReplaySlaAlertSchedule(client);
  const intervalMinutes = normalizeScheduleInteger(input.interval_minutes, current.interval_minutes, { min: 5, max: 10080 });
  const dueSoonHours = normalizeScheduleInteger(input.due_soon_hours, current.due_soon_hours, { min: 1, max: 168 });
  const alertLimit = normalizeScheduleInteger(input.alert_limit, current.alert_limit, { min: 1, max: 500 });
  const enabled = input.enabled === undefined ? current.enabled : input.enabled === true;
  const quietHoursEnabled = input.quiet_hours_enabled === undefined ? current.quiet_hours_enabled : input.quiet_hours_enabled === true;
  const quietHoursStart = normalizeReplaySlaScheduleQuietHour(input.quiet_hours_start, current.quiet_hours_start);
  const quietHoursEnd = normalizeReplaySlaScheduleQuietHour(input.quiet_hours_end, current.quiet_hours_end);
  const timezone = String(input.timezone || current.timezone || 'UTC').trim() || 'UTC';
  const nextRunAt = input.next_run_at
    ? new Date(input.next_run_at).toISOString()
    : new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_sla_alert_schedule (
       id,
       enabled,
       interval_minutes,
       due_soon_hours,
       alert_limit,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       timezone,
       next_run_at,
       updated_by_username,
       updated_by_role
     )
     VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       interval_minutes = EXCLUDED.interval_minutes,
       due_soon_hours = EXCLUDED.due_soon_hours,
       alert_limit = EXCLUDED.alert_limit,
       quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
       quiet_hours_start = EXCLUDED.quiet_hours_start,
       quiet_hours_end = EXCLUDED.quiet_hours_end,
       timezone = EXCLUDED.timezone,
       next_run_at = EXCLUDED.next_run_at,
       updated_by_username = EXCLUDED.updated_by_username,
       updated_by_role = EXCLUDED.updated_by_role,
       updated_at = NOW()
     RETURNING *`,
    [
      enabled,
      intervalMinutes,
      dueSoonHours,
      alertLimit,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      timezone,
      nextRunAt,
      actor.username,
      actor.role
    ]
  );
  return normalizeReplaySlaAlertSchedule(result.rows[0]);
}

export async function runOpsAuditNotificationReplaySlaAlertSchedule(
  { actor = {}, force = false, source = 'manual', now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert schedule actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_schedule_actor_required';
    throw error;
  }
  const schedule = await getOpsAuditNotificationReplaySlaAlertSchedule(client);
  const runAt = new Date(now);
  const skipped = (reason) => ({
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-schedule-run-v1',
    status: 'skipped',
    reason,
    source,
    ran_at: runAt.toISOString(),
    schedule,
    generation: null,
    watermark: 'internal_ops_audit_notification_replay_sla_alert_schedule_run'
  });
  if (!schedule.enabled && !force) return skipped('schedule_disabled');
  if (isQuietHour(schedule, runAt) && !force) return skipped('quiet_hours');
  if (schedule.next_run_at && new Date(schedule.next_run_at).getTime() > runAt.getTime() && !force) {
    return skipped('not_due');
  }
  const generation = await generateOpsAuditNotificationReplaySlaAlerts(
    {
      actor,
      limit: schedule.alert_limit,
      due_soon_hours: schedule.due_soon_hours
    },
    client
  );
  const resultPayload = {
    status: 'generated',
    alert_count: generation.alerts.length,
    report_hash: generation.report_hash,
    source
  };
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_replay_sla_alert_schedule
     SET last_run_at = $1,
         next_run_at = $2,
         last_result = $3::jsonb,
         updated_at = NOW()
     WHERE id = TRUE
     RETURNING *`,
    [
      runAt.toISOString(),
      new Date(runAt.getTime() + schedule.interval_minutes * 60 * 1000).toISOString(),
      JSON.stringify(resultPayload)
    ]
  );
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-schedule-run-v1',
    status: 'generated',
    reason: null,
    source,
    ran_at: runAt.toISOString(),
    schedule: normalizeReplaySlaAlertSchedule(result.rows[0]),
    generation,
    watermark: 'internal_ops_audit_notification_replay_sla_alert_schedule_run'
  };
}

function compactReplaySlaAlertForDigest(alert) {
  return {
    id: alert.id,
    status: alert.status,
    severity: alert.severity,
    scope: alert.scope,
    reviewer: alert.reviewer,
    routed_to: alert.routed_to,
    metric: alert.metric,
    value: alert.value,
    threshold: alert.threshold,
    message: alert.message,
    report_hash: alert.report_hash,
    generated_by: alert.generated_by,
    acknowledged_by: alert.acknowledged_by,
    acknowledged_at: alert.acknowledged_at,
    snoozed_until: alert.snoozed_until,
    resolved_by: alert.resolved_by,
    resolved_at: alert.resolved_at,
    updated_at: alert.updated_at
  };
}

function incrementCounter(target, key, amount = 1) {
  const normalizedKey = key || 'unknown';
  target[normalizedKey] = Number(target[normalizedKey] || 0) + amount;
}

function buildReplaySlaAlertDigestReviewerRoutes(alerts = []) {
  const rows = new Map();
  for (const alert of alerts) {
    const routeKey = alert.routed_to || alert.reviewer || 'unassigned';
    if (!rows.has(routeKey)) {
      rows.set(routeKey, {
        route: routeKey,
        total_count: 0,
        active_count: 0,
        open_count: 0,
        snoozed_count: 0,
        acked_count: 0,
        resolved_count: 0,
        critical_count: 0,
        warning_count: 0,
        metrics: {}
      });
    }
    const row = rows.get(routeKey);
    row.total_count += 1;
    if (['open', 'snoozed'].includes(alert.status)) row.active_count += 1;
    if (alert.status === 'open') row.open_count += 1;
    if (alert.status === 'snoozed') row.snoozed_count += 1;
    if (alert.status === 'acked') row.acked_count += 1;
    if (alert.status === 'resolved') row.resolved_count += 1;
    if (alert.severity === 'critical') row.critical_count += 1;
    if (alert.severity === 'warning') row.warning_count += 1;
    incrementCounter(row.metrics, alert.metric);
  }
  return Array.from(rows.values()).sort((a, b) =>
    b.critical_count - a.critical_count ||
    b.active_count - a.active_count ||
    b.total_count - a.total_count ||
    a.route.localeCompare(b.route)
  );
}

function buildReplaySlaAlertDigestRecommendations(summary) {
  const recommendations = [];
  if (summary.critical_active_count > 0) {
    recommendations.push('Escalate critical active replay SLA alerts before the next replay approval cycle.');
  }
  if (summary.open_count > 0) {
    recommendations.push('Route open replay SLA alerts to accountable reviewers and record acknowledgement.');
  }
  if (summary.snoozed_count > 0) {
    recommendations.push('Review snoozed replay SLA alerts before their snooze window expires.');
  }
  if (summary.acked_count > 0 && summary.resolved_count === 0) {
    recommendations.push('Convert acknowledged replay SLA alerts into resolved items once remediation is complete.');
  }
  if (!recommendations.length) {
    recommendations.push('No active replay SLA alert delivery digest action is required.');
  }
  return recommendations;
}

export function buildOpsAuditNotificationReplaySlaAlertDigest(
  alerts = [],
  { actor = {}, filters = {}, now = new Date() } = {}
) {
  const generatedAt = new Date(now).toISOString();
  const compactAlerts = alerts.map(compactReplaySlaAlertForDigest);
  const byStatus = {};
  const bySeverity = {};
  const byMetric = {};
  for (const alert of compactAlerts) {
    incrementCounter(byStatus, alert.status);
    incrementCounter(bySeverity, alert.severity);
    incrementCounter(byMetric, alert.metric);
  }
  const active = compactAlerts.filter((alert) => ['open', 'snoozed'].includes(alert.status));
  const summary = {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-summary-v1',
    total_count: compactAlerts.length,
    active_count: active.length,
    open_count: compactAlerts.filter((alert) => alert.status === 'open').length,
    snoozed_count: compactAlerts.filter((alert) => alert.status === 'snoozed').length,
    acked_count: compactAlerts.filter((alert) => alert.status === 'acked').length,
    resolved_count: compactAlerts.filter((alert) => alert.status === 'resolved').length,
    critical_count: compactAlerts.filter((alert) => alert.severity === 'critical').length,
    warning_count: compactAlerts.filter((alert) => alert.severity === 'warning').length,
    critical_active_count: active.filter((alert) => alert.severity === 'critical').length,
    warning_active_count: active.filter((alert) => alert.severity === 'warning').length,
    by_status: byStatus,
    by_severity: bySeverity,
    by_metric: byMetric
  };
  const digest = {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-v1',
    digest_id: `replay-sla-alert-digest-${generatedAt.replace(/[:.]/g, '-')}`,
    generated_at: generatedAt,
    requested_by: actor?.username ? `${actor.username}:${actor.role || 'unknown'}` : 'unknown:unknown',
    filters,
    summary,
    reviewer_routes: buildReplaySlaAlertDigestReviewerRoutes(compactAlerts),
    alerts: compactAlerts,
    recommendations: buildReplaySlaAlertDigestRecommendations(summary),
    watermark: 'internal_ops_audit_notification_replay_sla_alert_digest'
  };
  return {
    ...digest,
    digest_hash: digestValue(digest)
  };
}

export function buildOpsAuditNotificationReplaySlaAlertDigestHtml(digest) {
  const routeRows = (digest.reviewer_routes || [])
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.route)}</td>
        <td>${escapeHtml(row.active_count)}</td>
        <td>${escapeHtml(row.open_count)}</td>
        <td>${escapeHtml(row.snoozed_count)}</td>
        <td>${escapeHtml(row.critical_count)}</td>
        <td>${escapeHtml(Object.keys(row.metrics || {}).join(', ') || 'none')}</td>
      </tr>
    `)
    .join('');
  const alertRows = (digest.alerts || [])
    .map((alert) => `
      <tr>
        <td>${escapeHtml(alert.status)}</td>
        <td>${escapeHtml(alert.severity)}</td>
        <td>${escapeHtml(alert.metric)}</td>
        <td>${escapeHtml(alert.reviewer || 'summary')}</td>
        <td>${escapeHtml(alert.routed_to || 'unrouted')}</td>
        <td>${escapeHtml(alert.message)}</td>
      </tr>
    `)
    .join('');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Replay SLA Alert Delivery Digest</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #111827; }
      h1 { font-size: 24px; margin-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; margin-top: 18px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 13px; vertical-align: top; }
      th { background: #f3f4f6; }
      .meta, li { font-size: 13px; color: #374151; }
      .watermark { margin-top: 24px; font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>Replay SLA Alert Delivery Digest</h1>
    <div class="meta">Generated ${escapeHtml(digest.generated_at)} by ${escapeHtml(digest.requested_by)}</div>
    <div class="meta">Digest hash ${escapeHtml(digest.digest_hash)}</div>
    <h2>Summary</h2>
    <div class="meta">
      Total ${escapeHtml(digest.summary?.total_count || 0)} ·
      Active ${escapeHtml(digest.summary?.active_count || 0)} ·
      Open ${escapeHtml(digest.summary?.open_count || 0)} ·
      Snoozed ${escapeHtml(digest.summary?.snoozed_count || 0)} ·
      Critical active ${escapeHtml(digest.summary?.critical_active_count || 0)}
    </div>
    <h2>Recommendations</h2>
    <ul>${(digest.recommendations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    <h2>Routes</h2>
    <table>
      <thead><tr><th>Route</th><th>Active</th><th>Open</th><th>Snoozed</th><th>Critical</th><th>Metrics</th></tr></thead>
      <tbody>${routeRows || '<tr><td colspan="6">No routed SLA alerts</td></tr>'}</tbody>
    </table>
    <h2>Alerts</h2>
    <table>
      <thead><tr><th>Status</th><th>Severity</th><th>Metric</th><th>Reviewer</th><th>Routed to</th><th>Message</th></tr></thead>
      <tbody>${alertRows || '<tr><td colspan="6">No SLA alerts in digest</td></tr>'}</tbody>
    </table>
    <div class="watermark">${escapeHtml(digest.watermark)}</div>
  </body>
</html>`;
}

function normalizeReplaySlaAlertDigest(row = {}, { includeDigest = false, includeHtml = false } = {}) {
  const digest = {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-record-v1',
    id: row.id,
    digest_id: row.digest_id,
    digest_hash: row.digest_hash,
    html_hash: row.html_hash,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    filters: row.filters || {},
    summary: row.summary || {},
    alert_count: Number(row.alert_count || 0),
    created_at: row.created_at
  };
  if (includeDigest) digest.digest = row.digest || null;
  if (includeHtml) digest.html_snapshot = row.html_snapshot || '';
  return digest;
}

function compactReplaySlaAlertDigestRetentionRow(row = {}) {
  return {
    id: row.id,
    digest_id: row.digest_id,
    digest_hash: row.digest_hash,
    html_hash: row.html_hash,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    alert_count: Number(row.alert_count || 0),
    created_at: row.created_at
  };
}

function replaySlaAlertDigestRetentionReceiptHash(receipt) {
  return digestValue({
    schema_version: receipt.schema_version,
    verified_at: receipt.verified_at,
    requested_by: receipt.requested_by,
    policy: receipt.policy,
    action: receipt.action,
    totals: receipt.totals,
    digests: receipt.digests,
    watermark: receipt.watermark
  });
}

function buildReplaySlaAlertDigestRetentionReceipt({
  actor = {},
  schedule = {},
  retentionDays,
  cutoff,
  digestRows = [],
  deletedRows = [],
  execute = false,
  now = new Date()
} = {}) {
  const cutoffTime = new Date(cutoff).getTime();
  const allDigests = digestRows.map(compactReplaySlaAlertDigestRetentionRow);
  const eligible = allDigests.filter((digest) => new Date(digest.created_at).getTime() < cutoffTime);
  const retained = allDigests.filter((digest) => new Date(digest.created_at).getTime() >= cutoffTime);
  const deleted = deletedRows.map(compactReplaySlaAlertDigestRetentionRow);
  const receipt = {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-retention-receipt-v1',
    verified_at: new Date(now).toISOString(),
    requested_by: `${actor.username}:${actor.role}`,
    policy: {
      retention_days: retentionDays,
      cutoff_at: cutoff,
      schedule_enabled: schedule.enabled !== false,
      schedule_interval_minutes: Number(schedule.interval_minutes ?? 1440),
      schedule_next_run_at: schedule.next_run_at || null,
      schedule_updated_by: schedule.updated_by || null
    },
    action: {
      executed: execute === true,
      mode: execute === true ? 'prune_execute' : 'verification_dry_run'
    },
    totals: {
      scanned_count: allDigests.length,
      retained_count: retained.length,
      eligible_count: eligible.length,
      deleted_count: deleted.length
    },
    digests: {
      retained,
      eligible,
      deleted
    },
    watermark: 'internal_ops_audit_notification_replay_sla_alert_digest_retention_receipt'
  };
  receipt.receipt_hash = replaySlaAlertDigestRetentionReceiptHash(receipt);
  return receipt;
}

function normalizeReplaySlaAlertDigestRetentionReceipt(row = {}, { includeReceipt = false } = {}) {
  const receipt = {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-retention-receipt-record-v1',
    id: row.id,
    receipt_hash: row.receipt_hash,
    requested_by: `${row.requested_by_username}:${row.requested_by_role}`,
    retention_days: Number(row.retention_days || 0),
    cutoff_at: row.cutoff_at,
    executed: row.executed === true,
    eligible_count: Number(row.eligible_count || 0),
    retained_count: Number(row.retained_count || 0),
    deleted_count: Number(row.deleted_count || 0),
    created_at: row.created_at
  };
  if (includeReceipt) receipt.receipt = row.receipt || null;
  return receipt;
}

export async function createOpsAuditNotificationReplaySlaAlertDigest(
  { actor = {}, limit = 100, status = '', severity = '', reviewer = '', metric = '', now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert digest actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_actor_required';
    throw error;
  }
  const filters = {
    limit: Math.max(1, Math.min(Number(limit) || 100, 200)),
    status: String(status || '').trim().toLowerCase(),
    severity: String(severity || '').trim().toLowerCase(),
    reviewer: String(reviewer || '').trim(),
    metric: String(metric || '').trim()
  };
  const alerts = await listOpsAuditNotificationReplaySlaAlerts(filters, client);
  const digest = buildOpsAuditNotificationReplaySlaAlertDigest(alerts, { actor, filters, now });
  const html = buildOpsAuditNotificationReplaySlaAlertDigestHtml(digest);
  const htmlHash = hashText(html);
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_sla_alert_digests (
       digest_id,
       digest_hash,
       html_hash,
       requested_by_username,
       requested_by_role,
       filters,
       summary,
       digest,
       html_snapshot,
       alert_count
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)
     RETURNING *`,
    [
      digest.digest_id,
      digest.digest_hash,
      htmlHash,
      actor.username,
      actor.role,
      JSON.stringify(filters),
      JSON.stringify(digest.summary || {}),
      JSON.stringify(digest),
      html,
      digest.alerts.length
    ]
  );
  return normalizeReplaySlaAlertDigest(result.rows[0], { includeDigest: true });
}

export async function listOpsAuditNotificationReplaySlaAlertDigests({ limit = 20 } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const result = await client.query(
    `SELECT id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role,
       filters, summary, alert_count, created_at
     FROM internal_ops_audit_notification_replay_sla_alert_digests
     ORDER BY created_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows.map((row) => normalizeReplaySlaAlertDigest(row));
}

export async function getOpsAuditNotificationReplaySlaAlertDigest(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Replay SLA alert digest identifier is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT *
     FROM internal_ops_audit_notification_replay_sla_alert_digests
     WHERE id::text = $1 OR digest_id = $1 OR digest_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows.length) {
    const error = new Error('Replay SLA alert digest was not found.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_not_found';
    throw error;
  }
  return normalizeReplaySlaAlertDigest(result.rows[0], { includeDigest: true, includeHtml: true });
}

export async function listOpsAuditNotificationReplaySlaAlertDigestRetentionReceipts({ limit = 20 } = {}, client = pool) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const result = await client.query(
    `SELECT id, receipt_hash, requested_by_username, requested_by_role, retention_days, cutoff_at,
       executed, eligible_count, retained_count, deleted_count, created_at
     FROM internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts
     ORDER BY created_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows.map((row) => normalizeReplaySlaAlertDigestRetentionReceipt(row));
}

export async function getOpsAuditNotificationReplaySlaAlertDigestRetentionReceipt(identifier, client = pool) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (!normalizedIdentifier) {
    const error = new Error('Replay SLA alert digest retention receipt identifier is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_retention_receipt_identifier_required';
    throw error;
  }
  const result = await client.query(
    `SELECT *
     FROM internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts
     WHERE id::text = $1 OR receipt_hash = $1
     LIMIT 1`,
    [normalizedIdentifier]
  );
  if (!result.rows.length) {
    const error = new Error('Replay SLA alert digest retention receipt was not found.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_retention_receipt_not_found';
    throw error;
  }
  return normalizeReplaySlaAlertDigestRetentionReceipt(result.rows[0], { includeReceipt: true });
}

function normalizeReplaySlaAlertDigestSchedule(row = {}) {
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-schedule-v1',
    enabled: row.enabled !== false,
    interval_minutes: Number(row.interval_minutes ?? 1440),
    alert_limit: Number(row.alert_limit ?? 100),
    retention_days: Number(row.retention_days ?? 90),
    quiet_hours_enabled: row.quiet_hours_enabled === true,
    quiet_hours_start: row.quiet_hours_start || '22:00',
    quiet_hours_end: row.quiet_hours_end || '08:00',
    timezone: row.timezone || 'UTC',
    last_run_at: row.last_run_at || null,
    next_run_at: row.next_run_at || null,
    last_result: row.last_result || {},
    updated_by: row.updated_by_username ? `${row.updated_by_username}:${row.updated_by_role || 'unknown'}` : null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null
  };
}

export async function getOpsAuditNotificationReplaySlaAlertDigestSchedule(client = pool) {
  const result = await client.query(
    `SELECT *
     FROM internal_ops_audit_notification_replay_sla_alert_digest_schedule
     WHERE id = TRUE
     LIMIT 1`
  );
  return normalizeReplaySlaAlertDigestSchedule(result.rows[0] || {});
}

export async function updateOpsAuditNotificationReplaySlaAlertDigestSchedule(input = {}, actor = {}, client = pool) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert digest schedule actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_schedule_actor_required';
    throw error;
  }
  const current = await getOpsAuditNotificationReplaySlaAlertDigestSchedule(client);
  const intervalMinutes = normalizeScheduleInteger(input.interval_minutes, current.interval_minutes, { min: 15, max: 10080 });
  const alertLimit = normalizeScheduleInteger(input.alert_limit, current.alert_limit, { min: 1, max: 500 });
  const retentionDays = normalizeScheduleInteger(input.retention_days, current.retention_days, { min: 1, max: 3650 });
  const enabled = input.enabled === undefined ? current.enabled : input.enabled === true;
  const quietHoursEnabled = input.quiet_hours_enabled === undefined ? current.quiet_hours_enabled : input.quiet_hours_enabled === true;
  const quietHoursStart = normalizeReplaySlaScheduleQuietHour(input.quiet_hours_start, current.quiet_hours_start);
  const quietHoursEnd = normalizeReplaySlaScheduleQuietHour(input.quiet_hours_end, current.quiet_hours_end);
  const timezone = String(input.timezone || current.timezone || 'UTC').trim() || 'UTC';
  const nextRunAt = input.next_run_at
    ? new Date(input.next_run_at).toISOString()
    : new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
  const result = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_sla_alert_digest_schedule (
       id,
       enabled,
       interval_minutes,
       alert_limit,
       retention_days,
       quiet_hours_enabled,
       quiet_hours_start,
       quiet_hours_end,
       timezone,
       next_run_at,
       updated_by_username,
       updated_by_role
     )
     VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       interval_minutes = EXCLUDED.interval_minutes,
       alert_limit = EXCLUDED.alert_limit,
       retention_days = EXCLUDED.retention_days,
       quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
       quiet_hours_start = EXCLUDED.quiet_hours_start,
       quiet_hours_end = EXCLUDED.quiet_hours_end,
       timezone = EXCLUDED.timezone,
       next_run_at = EXCLUDED.next_run_at,
       updated_by_username = EXCLUDED.updated_by_username,
       updated_by_role = EXCLUDED.updated_by_role,
       updated_at = NOW()
     RETURNING *`,
    [
      enabled,
      intervalMinutes,
      alertLimit,
      retentionDays,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd,
      timezone,
      nextRunAt,
      actor.username,
      actor.role
    ]
  );
  return normalizeReplaySlaAlertDigestSchedule(result.rows[0]);
}

export async function runOpsAuditNotificationReplaySlaAlertDigestSchedule(
  { actor = {}, force = false, source = 'manual', now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert digest schedule actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_schedule_actor_required';
    throw error;
  }
  const schedule = await getOpsAuditNotificationReplaySlaAlertDigestSchedule(client);
  const runAt = new Date(now);
  const skipped = (reason) => ({
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-schedule-run-v1',
    status: 'skipped',
    reason,
    source,
    ran_at: runAt.toISOString(),
    schedule,
    digest: null,
    watermark: 'internal_ops_audit_notification_replay_sla_alert_digest_schedule_run'
  });
  if (!schedule.enabled && !force) return skipped('schedule_disabled');
  if (isQuietHour(schedule, runAt) && !force) return skipped('quiet_hours');
  if (schedule.next_run_at && new Date(schedule.next_run_at).getTime() > runAt.getTime() && !force) {
    return skipped('not_due');
  }
  const digest = await createOpsAuditNotificationReplaySlaAlertDigest(
    {
      actor,
      limit: schedule.alert_limit,
      now: runAt
    },
    client
  );
  const resultPayload = {
    status: 'generated',
    alert_count: digest.alert_count,
    digest_hash: digest.digest_hash,
    source
  };
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_replay_sla_alert_digest_schedule
     SET last_run_at = $1,
         next_run_at = $2,
         last_result = $3::jsonb,
         updated_at = NOW()
     WHERE id = TRUE
     RETURNING *`,
    [
      runAt.toISOString(),
      new Date(runAt.getTime() + schedule.interval_minutes * 60 * 1000).toISOString(),
      JSON.stringify(resultPayload)
    ]
  );
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-schedule-run-v1',
    status: 'generated',
    reason: null,
    source,
    ran_at: runAt.toISOString(),
    schedule: normalizeReplaySlaAlertDigestSchedule(result.rows[0]),
    digest,
    watermark: 'internal_ops_audit_notification_replay_sla_alert_digest_schedule_run'
  };
}

export async function pruneOpsAuditNotificationReplaySlaAlertDigests(
  { retention_days: retentionDays, execute = false, actor = {}, now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Replay SLA alert digest prune actor is required.');
    error.code = 'ops_audit_notification_replay_sla_alert_digest_schedule_actor_required';
    throw error;
  }
  const schedule = await getOpsAuditNotificationReplaySlaAlertDigestSchedule(client);
  const normalizedRetentionDays = normalizeScheduleInteger(retentionDays, schedule.retention_days, { min: 1, max: 3650 });
  const cutoff = new Date(new Date(now).getTime() - normalizedRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const digestResult = await client.query(
    `SELECT id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role, alert_count, created_at
     FROM internal_ops_audit_notification_replay_sla_alert_digests
     ORDER BY created_at DESC`
  );
  const eligibleCount = digestResult.rows.filter((row) => new Date(row.created_at).getTime() < new Date(cutoff).getTime()).length;
  let deletedRows = [];
  if (execute && eligibleCount > 0) {
    const deleteResult = await client.query(
      `DELETE FROM internal_ops_audit_notification_replay_sla_alert_digests
       WHERE created_at < $1
       RETURNING id, digest_id, digest_hash, html_hash, requested_by_username, requested_by_role, alert_count, created_at`,
      [cutoff]
    );
    deletedRows = deleteResult.rows;
  }
  const receipt = buildReplaySlaAlertDigestRetentionReceipt({
    actor,
    schedule,
    retentionDays: normalizedRetentionDays,
    cutoff,
    digestRows: digestResult.rows,
    deletedRows,
    execute,
    now
  });
  const receiptResult = await client.query(
    `INSERT INTO internal_ops_audit_notification_replay_sla_alert_digest_retention_receipts (
       receipt_hash,
       requested_by_username,
       requested_by_role,
       retention_days,
       cutoff_at,
       executed,
       eligible_count,
       retained_count,
       deleted_count,
       receipt
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (receipt_hash) DO UPDATE
       SET receipt = EXCLUDED.receipt
     RETURNING *`,
    [
      receipt.receipt_hash,
      actor.username,
      actor.role,
      normalizedRetentionDays,
      cutoff,
      execute === true,
      receipt.totals.eligible_count,
      receipt.totals.retained_count,
      receipt.totals.deleted_count,
      JSON.stringify(receipt)
    ]
  );
  const receiptRecord = normalizeReplaySlaAlertDigestRetentionReceipt(receiptResult.rows[0], { includeReceipt: true });
  return {
    schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-prune-v1',
    requested_by: `${actor.username}:${actor.role}`,
    executed: execute === true,
    retention_days: normalizedRetentionDays,
    cutoff_at: cutoff,
    eligible_count: eligibleCount,
    retained_count: receipt.totals.retained_count,
    deleted_count: deletedRows.length,
    receipt_hash: receipt.receipt_hash,
    receipt: receiptRecord,
    watermark: 'internal_ops_audit_notification_replay_sla_alert_digest_prune'
  };
}

export async function createOpsAuditNotificationReplaySlaAlertDigestRetentionReceipt(
  { retention_days: retentionDays, actor = {}, now = new Date() } = {},
  client = pool
) {
  return pruneOpsAuditNotificationReplaySlaAlertDigests(
    {
      retention_days: retentionDays,
      execute: false,
      actor,
      now
    },
    client
  ).then((prune) => prune.receipt);
}

export async function countOpsAuditNotificationReplaySlaAlertDigestsEligibleForRetention(
  { retention_days: retentionDays, now = new Date() } = {},
  client = pool
) {
  const schedule = await getOpsAuditNotificationReplaySlaAlertDigestSchedule(client);
  const normalizedRetentionDays = normalizeScheduleInteger(retentionDays, schedule.retention_days, { min: 1, max: 3650 });
  const cutoff = new Date(new Date(now).getTime() - normalizedRetentionDays * 24 * 60 * 60 * 1000).toISOString();
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM internal_ops_audit_notification_replay_sla_alert_digests
     WHERE created_at < $1`,
    [cutoff]
  );
  return {
    retention_days: normalizedRetentionDays,
    cutoff_at: cutoff,
    eligible_count: Number(countResult.rows[0]?.count || 0)
  };
}

export async function reviewOpsAuditNotificationReplayApproval(
  { id, status = '', review_note: reviewNote = '', rejection_reason: rejectionReason = '', actor = {}, now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification replay approval reviewer is required.');
    error.code = 'ops_audit_notification_replay_approval_actor_required';
    throw error;
  }
  const normalizedStatus = String(status || '').trim().toLowerCase();
  if (!['approved', 'rejected'].includes(normalizedStatus)) {
    const error = new Error('Replay approval review status must be approved or rejected.');
    error.code = 'ops_audit_notification_replay_approval_status_invalid';
    throw error;
  }
  const current = await getOpsAuditNotificationReplayApproval(id, client);
  if (current.status !== 'requested') {
    const error = new Error('Only requested replay approvals can be reviewed.');
    error.code = 'ops_audit_notification_replay_approval_not_reviewable';
    throw error;
  }
  const policy = await getOpsAuditNotificationReplayPolicy(client);
  if (!policy.enabled) {
    const error = new Error('Replay approval policy is disabled.');
    error.code = 'ops_audit_notification_replay_policy_disabled';
    throw error;
  }
  if (isReplayApprovalExpired(current, now)) {
    const error = new Error('Replay approval request is expired.');
    error.code = 'ops_audit_notification_replay_approval_expired';
    throw error;
  }
  if (!roleMeetsMinimum(actor.role, policy.required_reviewer_role)) {
    const error = new Error('Replay approval reviewer role is insufficient.');
    error.code = 'ops_audit_notification_replay_approval_reviewer_role_required';
    throw error;
  }
  const requesterUsername = current.requested_by.split(':')[0];
  if (!policy.allow_self_approval && requesterUsername === actor.username) {
    const error = new Error('Replay approval requester cannot review their own request.');
    error.code = 'ops_audit_notification_replay_approval_self_review_not_allowed';
    throw error;
  }
  const normalizedReviewNote = String(reviewNote || '').trim().slice(0, 500) || null;
  const normalizedRejectionReason = String(rejectionReason || reviewNote || '').trim().slice(0, 500) || null;
  if (normalizedStatus === 'rejected' && (!normalizedRejectionReason || normalizedRejectionReason.length < 8)) {
    const error = new Error('Replay approval rejection requires a reason.');
    error.code = 'ops_audit_notification_replay_approval_rejection_reason_required';
    throw error;
  }
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_replay_approvals
     SET status = $2,
         reviewed_by_username = $3,
         reviewed_by_role = $4,
         reviewed_at = NOW(),
         review_note = $5,
         rejection_reason = $6,
         updated_at = NOW()
     WHERE id::text = $1
     RETURNING ${REPLAY_APPROVAL_SELECT_COLUMNS}`,
    [
      current.id,
      normalizedStatus,
      actor.username,
      actor.role,
      normalizedReviewNote,
      normalizedStatus === 'rejected' ? normalizedRejectionReason : null
    ]
  );
  return normalizeReplayApproval(result.rows[0]);
}

export async function executeOpsAuditNotificationReplayApproval(
  { id, actor = {}, now = new Date() } = {},
  client = pool
) {
  if (!actor?.username || !actor?.role) {
    const error = new Error('Evidence case notification replay approval executor is required.');
    error.code = 'ops_audit_notification_replay_approval_actor_required';
    throw error;
  }
  const approval = await getOpsAuditNotificationReplayApproval(id, client);
  if (approval.status !== 'approved') {
    const error = new Error('Only approved replay approvals can be executed.');
    error.code = 'ops_audit_notification_replay_approval_not_executable';
    throw error;
  }
  if (isReplayApprovalExpired(approval, now)) {
    const error = new Error('Replay approval request is expired.');
    error.code = 'ops_audit_notification_replay_approval_expired';
    throw error;
  }
  const reviewer = approval.reviewed_by
    ? { username: approval.reviewed_by.split(':')[0], role: approval.reviewed_by.split(':')[1] || 'admin' }
    : actor;
  const replay = await replayOpsAuditNotificationDeliveryAttempt(
    {
      id: approval.source_attempt_id,
      actor,
      force: true,
      force_reason: approval.force_reason,
      approved_by: reviewer,
      now
    },
    client
  );
  const replayAttempt = replay.attempts[0] || null;
  const result = await client.query(
    `UPDATE internal_ops_audit_notification_replay_approvals
     SET status = 'executed',
         executed_by_username = $2,
         executed_by_role = $3,
         executed_at = NOW(),
         replay_attempt_id = $4,
         updated_at = NOW()
     WHERE id::text = $1
     RETURNING ${REPLAY_APPROVAL_SELECT_COLUMNS}`,
    [approval.id, actor.username, actor.role, replayAttempt?.id || null]
  );
  return {
    approval: normalizeReplayApproval(result.rows[0]),
    replay
  };
}

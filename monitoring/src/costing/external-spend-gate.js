import { randomUUID } from 'node:crypto';
import { createProviderError } from '../errors.js';
import { PHASE0_GUEST_ROUTE_CONTRACT } from '../poc/frozen-observation-contract.js';

export const EXTERNAL_SPEND_MODES = Object.freeze({
  DENY: 'deny',
  ALLOW: 'allow'
});

const transportPermitRegistry = new Map();

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function positiveInteger(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new TypeError(`${name} must be a positive integer`);
  return value;
}

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function evidenceReference(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return (
    /^sha256:[a-f0-9]{64}$/.test(trimmed) ||
    /^(ticket|archive):[A-Za-z0-9][A-Za-z0-9._:/#-]{2,255}$/.test(trimmed)
  );
}

function supplierPreparationBlockers(config = {}) {
  const blockers = [];
  const budgetMicroUsd = Number(config.pocBudgetMicroUsd || 0);
  const supplierCaps = config.pocSupplierBudgetMicroUsd || {};
  if (!present(config.pocScopeId)) blockers.push('poc_scope_id_missing');
  if (!present(config.pocBudgetApprovalId)) blockers.push('poc_budget_approval_id_missing');
  if (!Number.isSafeInteger(budgetMicroUsd) || budgetMicroUsd <= 0) {
    blockers.push('poc_budget_cap_zero_or_invalid');
  }
  for (const supplier of ['bright_data', 'serpapi', 'other']) {
    const cap = Number(supplierCaps[supplier] || 0);
    if (!Number.isSafeInteger(cap) || cap <= 0) blockers.push(`${supplier}_budget_cap_zero_or_invalid`);
  }
  const supplierCapTotal = ['bright_data', 'serpapi', 'other'].reduce(
    (sum, supplier) => sum + Number(supplierCaps[supplier] || 0),
    0
  );
  if (Number.isSafeInteger(budgetMicroUsd) && budgetMicroUsd > 0 && supplierCapTotal !== budgetMicroUsd) {
    blockers.push('supplier_budget_caps_must_sum_to_total_cap');
  }
  if (!present(config.pocBrightDataAccountId)) blockers.push('poc_bright_data_account_id_missing');
  if (!present(config.pocBrightDataProjectId)) blockers.push('poc_bright_data_project_id_missing');
  if (!present(config.pocBrightDataZoneChatgpt)) blockers.push('poc_bright_data_chatgpt_zone_missing');
  if (!present(config.pocBrightDataZonePerplexity)) blockers.push('poc_bright_data_perplexity_zone_missing');
  if (!present(config.pocSerpapiAccountId)) blockers.push('poc_serpapi_account_id_missing');
  if (config.pocCommercialRatesVerified !== true) blockers.push('poc_pricing_evidence_not_verified');
  for (const [field, blocker] of [
    ['pocBrightDataPricingEvidenceRef', 'bright_data_pricing_evidence_missing_or_invalid'],
    ['pocSerpapiPricingEvidenceRef', 'serpapi_pricing_evidence_missing_or_invalid'],
    ['pocSupplierPolicyEvidenceRef', 'supplier_policy_evidence_missing_or_invalid'],
    ['pocTargetPolicyEvidenceRef', 'target_policy_evidence_missing_or_invalid']
  ]) {
    if (!evidenceReference(config[field])) blockers.push(blocker);
  }
  return blockers;
}

function transportDenied(code, message, details = {}) {
  throw createProviderError({
    code,
    message,
    retryable: false,
    details
  });
}

export function assertExternalTransportAllowed({ config = {}, supplier = 'unknown', transport_permit } = {}) {
  if (config.externalSpendMode !== EXTERNAL_SPEND_MODES.ALLOW) {
    transportDenied('external_spend_globally_denied', `External supplier transport is disabled for ${supplier}`, {
      supplier,
      external_spend_mode: config.externalSpendMode || EXTERNAL_SPEND_MODES.DENY
    });
  }
  const permitId = transport_permit?.permit_id;
  const permitState = permitId ? transportPermitRegistry.get(permitId) : null;
  if (!permitState || permitState.permit !== transport_permit) {
    transportDenied('external_transport_permit_required', `A reserved spend permit is required for ${supplier}`, {
      supplier,
      permit_present: Boolean(transport_permit),
      permit_valid: false
    });
  }
  if (permitState.gate?.commercialLiveProvider === true) {
    if (permitState.transportStarted) {
      transportDenied('external_transport_permit_already_used', `Spend permit has already started a transport`, {
        supplier,
        permit_id: permitId
      });
    }
    if (transport_permit.transport_supplier !== supplier) {
      transportDenied('external_transport_permit_supplier_mismatch', `Spend permit is not valid for ${supplier}`, {
        supplier,
        permitted_supplier: transport_permit.transport_supplier
      });
    }
    permitState.transportStarted = true;
    return Object.freeze({
      allowed: true,
      supplier,
      permit_id: permitId,
      attempt_id: transport_permit.attempt_id,
      scope_id: transport_permit.scope_id
    });
  }
  if (permitState.gate.stopped) {
    transportDenied('poc_budget_hard_stop_active', `POC budget hard stop is active: ${permitState.gate.stopReason}`, {
      supplier,
      stop_reason: permitState.gate.stopReason
    });
  }
  if (permitState.transportStarted) {
    transportDenied('external_transport_permit_already_used', `Spend permit has already started a transport`, {
      supplier,
      permit_id: permitId
    });
  }
  if (transport_permit.transport_supplier !== supplier) {
    transportDenied('external_transport_permit_supplier_mismatch', `Spend permit is not valid for ${supplier}`, {
      supplier,
      permitted_supplier: transport_permit.transport_supplier
    });
  }
  if (
    config.pocScopeId !== transport_permit.scope_id ||
    config.pocBudgetApprovalId !== transport_permit.budget_approval_id
  ) {
    transportDenied('external_transport_permit_scope_mismatch', 'Spend permit does not match the active POC scope', {
      supplier,
      scope_matches: config.pocScopeId === transport_permit.scope_id,
      approval_matches: config.pocBudgetApprovalId === transport_permit.budget_approval_id
    });
  }
  permitState.transportStarted = true;
  return Object.freeze({
    allowed: true,
    supplier,
    permit_id: permitId,
    attempt_id: transport_permit.attempt_id,
    scope_id: transport_permit.scope_id
  });
}

export class CommercialLiveProviderBudgetGate {
  constructor({ trackingRunId, capMicroUsd } = {}) {
    if (!present(trackingRunId)) throw new TypeError('trackingRunId must be a non-empty string');
    this.trackingRunId = trackingRunId;
    this.totalCapMicroUsd = positiveInteger(capMicroUsd, 'capMicroUsd');
    this.commercialLiveProvider = true;
    this.reservations = new Map();
    this.attemptIds = new Set();
    this.spentMicroUsd = 0;
    this.reservedMicroUsd = 0;
  }

  reserve({ attempt_id, transport_supplier, max_cost_micro_usd } = {}) {
    if (!present(attempt_id)) throw new TypeError('attempt_id must be a non-empty string');
    if (!present(transport_supplier)) throw new TypeError('transport_supplier must be a non-empty string');
    const maximum = positiveInteger(max_cost_micro_usd, 'max_cost_micro_usd');
    if (this.attemptIds.has(attempt_id)) throw new Error(`attempt_id already reserved: ${attempt_id}`);
    if (this.spentMicroUsd + this.reservedMicroUsd + maximum > this.totalCapMicroUsd) {
      transportDenied('commercial_monitoring_run_budget_exceeded', 'Commercial monitoring run budget would be exceeded', {
        tracking_run_id: this.trackingRunId,
        cap_micro_usd: this.totalCapMicroUsd
      });
    }
    const permit = Object.freeze({
      permit_id: randomUUID(),
      scope_id: `commercial-monitoring:${this.trackingRunId}`,
      budget_approval_id: 'commercial-live-provider-plan-budget',
      attempt_id,
      supplier: 'other',
      transport_supplier,
      max_cost_micro_usd: maximum,
      status: 'reserved'
    });
    this.attemptIds.add(attempt_id);
    this.reservations.set(permit.permit_id, permit);
    this.reservedMicroUsd += maximum;
    transportPermitRegistry.set(permit.permit_id, {
      gate: this,
      permit,
      transportStarted: false,
      actualCostExceeded: false
    });
    return permit;
  }

  settle({ permit_id, actual_cost_micro_usd } = {}) {
    const permit = this.reservations.get(permit_id);
    const permitState = transportPermitRegistry.get(permit_id);
    if (!permit || !permitState || permitState.gate !== this) throw new Error('unknown commercial spend permit');
    if (!permitState.transportStarted) throw new Error('commercial spend permit cannot settle before transport starts');
    const actual = nonNegativeInteger(actual_cost_micro_usd, 'actual_cost_micro_usd');
    if (actual > permit.max_cost_micro_usd) {
      this.reservations.delete(permit_id);
      transportPermitRegistry.delete(permit_id);
      this.reservedMicroUsd -= permit.max_cost_micro_usd;
      this.spentMicroUsd += actual;
      transportDenied('commercial_actual_cost_exceeded_reservation', 'Commercial provider cost exceeded reservation', {
        permit_id,
        actual_cost_micro_usd: actual,
        max_cost_micro_usd: permit.max_cost_micro_usd,
        reconciliation_required: true
      });
    }
    this.reservations.delete(permit_id);
    transportPermitRegistry.delete(permit_id);
    this.reservedMicroUsd -= permit.max_cost_micro_usd;
    this.spentMicroUsd += actual;
    return Object.freeze({ ...permit, actual_cost_micro_usd: actual, status: 'settled' });
  }

  snapshot() {
    return Object.freeze({
      schema_version: 'commercial-live-provider-run-budget-v1',
      tracking_run_id: this.trackingRunId,
      cap_micro_usd: this.totalCapMicroUsd,
      spent_micro_usd: this.spentMicroUsd,
      reserved_micro_usd: this.reservedMicroUsd,
      remaining_micro_usd: Math.max(0, this.totalCapMicroUsd - this.spentMicroUsd - this.reservedMicroUsd)
    });
  }
}

export function buildPocBudgetReadiness({ config = {}, requested_surfaces = [] } = {}) {
  const blockers = supplierPreparationBlockers(config);
  const budgetMicroUsd = Number(config.pocBudgetMicroUsd || 0);
  const supplierCaps = config.pocSupplierBudgetMicroUsd || {};
  const includesLogin = requested_surfaces.some((surface) => ['deepseek_ui', 'mistral_vibe_ui'].includes(surface));
  const guestSurfaceScopeMatches =
    JSON.stringify(requested_surfaces) === JSON.stringify(PHASE0_GUEST_ROUTE_CONTRACT.starter_surfaces);

  if (config.externalSpendMode !== EXTERNAL_SPEND_MODES.ALLOW) blockers.push('external_spend_mode_denied');
  if (config.pocPaidRunEnabled !== true) blockers.push('poc_paid_run_not_enabled');
  if (!guestSurfaceScopeMatches) blockers.push('phase0_guest_route_surface_scope_mismatch');
  if (includesLogin) blockers.push('phase0_guest_route_excludes_login_managed_surfaces');

  return Object.freeze({
    schema_version: 'poc-budget-readiness-v2-guest-self-service',
    status: blockers.length ? 'blocked' : 'ready',
    allowed: blockers.length === 0,
    route_mode: PHASE0_GUEST_ROUTE_CONTRACT.exit_scope,
    residential_proxy_allowed: false,
    authenticated_session_allowed: false,
    scope_id: config.pocScopeId || null,
    budget_micro_usd: Number.isInteger(budgetMicroUsd) ? budgetMicroUsd : 0,
    supplier_caps_micro_usd: Object.freeze({
      bright_data: Number(supplierCaps.bright_data || 0),
      serpapi: Number(supplierCaps.serpapi || 0),
      other: Number(supplierCaps.other || 0)
    }),
    dedicated_vendor_scope: Object.freeze({
      bright_data_project_id_present: present(config.pocBrightDataProjectId),
      bright_data_chatgpt_zone_present: present(config.pocBrightDataZoneChatgpt),
      bright_data_perplexity_zone_present: present(config.pocBrightDataZonePerplexity),
      serpapi_account_id_present: present(config.pocSerpapiAccountId)
    }),
    requested_surfaces: Object.freeze([...requested_surfaces]),
    blockers: Object.freeze([...new Set(blockers)]),
    secrets_exposed: false
  });
}

export function buildPhase0GuestExitReadiness({ config = {}, requested_surfaces = [] } = {}) {
  const blockers = [];
  const expectedSurfaces = PHASE0_GUEST_ROUTE_CONTRACT.starter_surfaces;
  if (JSON.stringify(requested_surfaces) !== JSON.stringify(expectedSurfaces)) {
    blockers.push('phase0_starter_surface_scope_mismatch');
  }
  if (config.externalSpendMode !== EXTERNAL_SPEND_MODES.DENY) {
    blockers.push('phase0_exit_requires_external_spend_denied');
  }
  if (config.pocPaidRunEnabled !== false) blockers.push('phase0_exit_requires_paid_poc_disarmed');
  if (config.liveProviderTestingEnabled !== false) blockers.push('phase0_exit_requires_live_provider_testing_disabled');
  if (config.schedulerProviderMode !== 'mock') {
    blockers.push('phase0_exit_requires_mock_scheduler_provider');
  }
  if (config.schedulerAllowPaidProvider !== false) {
    blockers.push('phase0_exit_requires_scheduler_paid_provider_disabled');
  }

  return Object.freeze({
    schema_version: 'phase0-guest-exit-readiness-v1',
    status: blockers.length ? 'blocked' : 'ready_guest_mode_poc_disarmed',
    allowed: blockers.length === 0,
    route_mode: PHASE0_GUEST_ROUTE_CONTRACT.exit_scope,
    kyc_required_for_phase0_exit: false,
    supplier_outreach_required_for_phase0_exit: false,
    pricing_evidence_required_for_phase0_exit: false,
    residential_proxy_allowed_in_phase0: false,
    password_entry_allowed_in_phase0: false,
    authenticated_session_state_allowed_in_phase0: false,
    ephemeral_guest_session_state_allowed_in_phase0: true,
    requested_surfaces: Object.freeze([...requested_surfaces]),
    phase0_exit_authorizes_transport: false,
    external_spend_armed: config.externalSpendMode === EXTERNAL_SPEND_MODES.ALLOW,
    paid_poc_armed: config.pocPaidRunEnabled === true,
    blockers: Object.freeze([...new Set(blockers)]),
    evidence_references_exposed: false
  });
}

export function buildPhase0ExternalExitReadiness(args = {}) {
  return buildPhase0GuestExitReadiness(args);
}

export class LocalPocBudgetGate {
  constructor({ config = {}, requested_surfaces = [] } = {}) {
    this.config = config;
    this.readiness = buildPocBudgetReadiness({ config, requested_surfaces });
    this.reservations = new Map();
    this.attemptIds = new Set();
    this.spentBySupplier = new Map();
    this.reservedBySupplier = new Map();
    this.stopped = false;
    this.stopReason = null;
  }

  reserve({ attempt_id, supplier, transport_supplier = supplier, max_cost_micro_usd } = {}) {
    if (!this.readiness.allowed) {
      throw createProviderError({
        code: 'poc_budget_gate_not_ready',
        message: `POC budget gate is blocked: ${this.readiness.blockers[0] || 'unknown'}`,
        retryable: false,
        details: this.readiness
      });
    }
    if (this.stopped) {
      throw createProviderError({
        code: 'poc_budget_hard_stop_active',
        message: `POC budget hard stop is active: ${this.stopReason}`,
        retryable: false
      });
    }
    if (!present(attempt_id)) throw new TypeError('attempt_id must be a non-empty string');
    if (!['bright_data', 'serpapi', 'other'].includes(supplier)) throw new RangeError('supplier is not budgeted');
    if (!present(transport_supplier)) throw new TypeError('transport_supplier must be a non-empty string');
    const maxCost = positiveInteger(max_cost_micro_usd, 'max_cost_micro_usd');
    if (this.attemptIds.has(attempt_id)) throw new Error(`attempt_id already reserved: ${attempt_id}`);

    const totalCommitted = this.totalSpentMicroUsd() + this.totalReservedMicroUsd();
    if (totalCommitted + maxCost > this.readiness.budget_micro_usd) {
      this.stopped = true;
      this.stopReason = 'total_budget_cap_would_be_exceeded';
      throw createProviderError({
        code: 'poc_budget_cap_exceeded',
        message: 'POC total budget cap would be exceeded',
        retryable: false
      });
    }
    const supplierCommitted =
      (this.spentBySupplier.get(supplier) || 0) + (this.reservedBySupplier.get(supplier) || 0);
    if (supplierCommitted + maxCost > this.readiness.supplier_caps_micro_usd[supplier]) {
      this.stopped = true;
      this.stopReason = `${supplier}_budget_cap_would_be_exceeded`;
      throw createProviderError({
        code: 'poc_supplier_budget_cap_exceeded',
        message: `POC ${supplier} budget cap would be exceeded`,
        retryable: false
      });
    }

    const permit = Object.freeze({
      permit_id: randomUUID(),
      scope_id: this.readiness.scope_id,
      budget_approval_id: this.config.pocBudgetApprovalId,
      attempt_id,
      supplier,
      transport_supplier,
      max_cost_micro_usd: maxCost,
      status: 'reserved'
    });
    this.attemptIds.add(attempt_id);
    this.reservations.set(permit.permit_id, permit);
    transportPermitRegistry.set(permit.permit_id, {
      gate: this,
      permit,
      transportStarted: false,
      actualCostExceeded: false
    });
    this.reservedBySupplier.set(supplier, (this.reservedBySupplier.get(supplier) || 0) + maxCost);
    return permit;
  }

  settle({ permit_id, actual_cost_micro_usd } = {}) {
    const permit = this.reservations.get(permit_id);
    const permitState = transportPermitRegistry.get(permit_id);
    if (!permit || !permitState || permitState.gate !== this) {
      throw new Error('unknown or already finalized spend permit');
    }
    if (!permitState.transportStarted) throw new Error('spend permit cannot settle before transport starts');
    if (permitState.actualCostExceeded) {
      throw new Error('spend permit is permanently blocked after actual cost exceeded its reservation');
    }
    const actual = nonNegativeInteger(actual_cost_micro_usd, 'actual_cost_micro_usd');
    if (actual > permit.max_cost_micro_usd) {
      this.stopped = true;
      this.stopReason = 'actual_cost_exceeded_reserved_maximum';
      permitState.actualCostExceeded = true;
      throw createProviderError({
        code: 'poc_actual_cost_exceeded_reservation',
        message: 'Actual supplier cost exceeded the reserved maximum',
        retryable: false
      });
    }
    this.reservations.delete(permit_id);
    transportPermitRegistry.delete(permit_id);
    this.reservedBySupplier.set(
      permit.supplier,
      (this.reservedBySupplier.get(permit.supplier) || 0) - permit.max_cost_micro_usd
    );
    this.spentBySupplier.set(permit.supplier, (this.spentBySupplier.get(permit.supplier) || 0) + actual);
    return Object.freeze({ ...permit, actual_cost_micro_usd: actual, status: 'settled' });
  }

  release({ permit_id } = {}) {
    const permit = this.reservations.get(permit_id);
    const permitState = transportPermitRegistry.get(permit_id);
    if (!permit || !permitState || permitState.gate !== this) {
      throw new Error('unknown or already finalized spend permit');
    }
    if (permitState.transportStarted) {
      throw new Error('started transport cost must settle or remain reserved until reconciled');
    }
    this.reservations.delete(permit_id);
    transportPermitRegistry.delete(permit_id);
    this.reservedBySupplier.set(
      permit.supplier,
      (this.reservedBySupplier.get(permit.supplier) || 0) - permit.max_cost_micro_usd
    );
    return Object.freeze({ ...permit, status: 'released' });
  }

  totalSpentMicroUsd() {
    return [...this.spentBySupplier.values()].reduce((sum, value) => sum + value, 0);
  }

  totalReservedMicroUsd() {
    return [...this.reservedBySupplier.values()].reduce((sum, value) => sum + value, 0);
  }

  snapshot() {
    return Object.freeze({
      schema_version: 'local-poc-budget-ledger-v1',
      scope_id: this.readiness.scope_id,
      spent_micro_usd: this.totalSpentMicroUsd(),
      reserved_micro_usd: this.totalReservedMicroUsd(),
      remaining_micro_usd: Math.max(
        0,
        this.readiness.budget_micro_usd - this.totalSpentMicroUsd() - this.totalReservedMicroUsd()
      ),
      spent_by_supplier: Object.freeze(Object.fromEntries(this.spentBySupplier)),
      reserved_by_supplier: Object.freeze(Object.fromEntries(this.reservedBySupplier)),
      active_reservations: this.reservations.size,
      transports_started: [...this.reservations.keys()].filter(
        (permitId) => transportPermitRegistry.get(permitId)?.transportStarted === true
      ).length,
      stopped: this.stopped,
      stop_reason: this.stopReason
    });
  }
}

/**
 * Phase 6 uses the same one-shot transport registry as the frozen POC gate,
 * but its approved surface set and supplier allocation are independent from
 * the Starter-only Phase 0 readiness contract.
 */
export class Phase6TransportBudgetGate {
  constructor({
    scopeId,
    budgetApprovalId,
    totalCapMicroUsd,
    supplierCapsMicroUsd = {}
  } = {}) {
    if (!present(scopeId)) throw new TypeError('scopeId must be a non-empty string');
    if (!present(budgetApprovalId)) throw new TypeError('budgetApprovalId must be a non-empty string');
    this.scopeId = scopeId;
    this.budgetApprovalId = budgetApprovalId;
    this.totalCapMicroUsd = positiveInteger(totalCapMicroUsd, 'totalCapMicroUsd');
    this.supplierCapsMicroUsd = Object.freeze(Object.fromEntries(
      ['bright_data', 'serpapi', 'other'].map((supplier) => [
        supplier,
        nonNegativeInteger(Number(supplierCapsMicroUsd[supplier] || 0), `${supplier} cap`)
      ])
    ));
    const capTotal = Object.values(this.supplierCapsMicroUsd).reduce((sum, value) => sum + value, 0);
    if (capTotal !== this.totalCapMicroUsd) {
      throw new RangeError('Phase 6 supplier caps must sum to the approved total cap');
    }
    this.reservations = new Map();
    this.attemptIds = new Set();
    this.spentBySupplier = new Map();
    this.reservedBySupplier = new Map();
    this.stopped = false;
    this.stopReason = null;
  }

  reserve({ attempt_id, supplier, transport_supplier = supplier, max_cost_micro_usd } = {}) {
    if (this.stopped) {
      transportDenied('phase6_budget_hard_stop_active', 'Phase 6 budget hard stop is active', {
        stop_reason: this.stopReason
      });
    }
    if (!present(attempt_id)) throw new TypeError('attempt_id must be a non-empty string');
    if (!['bright_data', 'serpapi', 'other'].includes(supplier)) {
      throw new RangeError('supplier is not budgeted');
    }
    if (!present(transport_supplier)) throw new TypeError('transport_supplier must be a non-empty string');
    const maximum = positiveInteger(max_cost_micro_usd, 'max_cost_micro_usd');
    if (this.attemptIds.has(attempt_id)) throw new Error(`attempt_id already reserved: ${attempt_id}`);

    const totalCommitted = this.totalSpentMicroUsd() + this.totalReservedMicroUsd();
    const supplierCommitted =
      (this.spentBySupplier.get(supplier) || 0) + (this.reservedBySupplier.get(supplier) || 0);
    if (totalCommitted + maximum > this.totalCapMicroUsd) {
      this.stopped = true;
      this.stopReason = 'total_budget_cap_would_be_exceeded';
      transportDenied('phase6_budget_cap_exceeded', 'Phase 6 total budget cap would be exceeded');
    }
    if (supplierCommitted + maximum > this.supplierCapsMicroUsd[supplier]) {
      this.stopped = true;
      this.stopReason = `${supplier}_budget_cap_would_be_exceeded`;
      transportDenied(
        'phase6_supplier_budget_cap_exceeded',
        `Phase 6 ${supplier} budget cap would be exceeded`
      );
    }

    const permit = Object.freeze({
      permit_id: randomUUID(),
      scope_id: this.scopeId,
      budget_approval_id: this.budgetApprovalId,
      attempt_id,
      supplier,
      transport_supplier,
      max_cost_micro_usd: maximum,
      status: 'reserved'
    });
    this.attemptIds.add(attempt_id);
    this.reservations.set(permit.permit_id, permit);
    this.reservedBySupplier.set(supplier, (this.reservedBySupplier.get(supplier) || 0) + maximum);
    transportPermitRegistry.set(permit.permit_id, {
      gate: this,
      permit,
      transportStarted: false,
      actualCostExceeded: false
    });
    return permit;
  }

  settle({ permit_id, actual_cost_micro_usd } = {}) {
    const permit = this.reservations.get(permit_id);
    const permitState = transportPermitRegistry.get(permit_id);
    if (!permit || !permitState || permitState.gate !== this) {
      throw new Error('unknown or already finalized Phase 6 permit');
    }
    if (!permitState.transportStarted) throw new Error('Phase 6 permit cannot settle before transport starts');
    const actual = nonNegativeInteger(actual_cost_micro_usd, 'actual_cost_micro_usd');
    if (actual > permit.max_cost_micro_usd) {
      this.stopped = true;
      this.stopReason = 'actual_cost_exceeded_reserved_maximum';
      permitState.actualCostExceeded = true;
      this.reservations.delete(permit_id);
      transportPermitRegistry.delete(permit_id);
      this.reservedBySupplier.set(
        permit.supplier,
        (this.reservedBySupplier.get(permit.supplier) || 0) - permit.max_cost_micro_usd
      );
      this.spentBySupplier.set(
        permit.supplier,
        (this.spentBySupplier.get(permit.supplier) || 0) + actual
      );
      transportDenied(
        'phase6_actual_cost_exceeded_reservation',
        'Actual Phase 6 supplier cost exceeded its reservation',
        {
          permit_id,
          actual_cost_micro_usd: actual,
          max_cost_micro_usd: permit.max_cost_micro_usd,
          reconciliation_required: true
        }
      );
    }
    this.reservations.delete(permit_id);
    transportPermitRegistry.delete(permit_id);
    this.reservedBySupplier.set(
      permit.supplier,
      (this.reservedBySupplier.get(permit.supplier) || 0) - permit.max_cost_micro_usd
    );
    this.spentBySupplier.set(
      permit.supplier,
      (this.spentBySupplier.get(permit.supplier) || 0) + actual
    );
    return Object.freeze({ ...permit, actual_cost_micro_usd: actual, status: 'settled' });
  }

  release({ permit_id } = {}) {
    const permit = this.reservations.get(permit_id);
    const permitState = transportPermitRegistry.get(permit_id);
    if (!permit || !permitState || permitState.gate !== this) {
      throw new Error('unknown or already finalized Phase 6 permit');
    }
    if (permitState.transportStarted) {
      throw new Error('started Phase 6 transport must settle or remain reserved for reconciliation');
    }
    this.reservations.delete(permit_id);
    transportPermitRegistry.delete(permit_id);
    this.reservedBySupplier.set(
      permit.supplier,
      (this.reservedBySupplier.get(permit.supplier) || 0) - permit.max_cost_micro_usd
    );
    return Object.freeze({ ...permit, status: 'released' });
  }

  totalSpentMicroUsd() {
    return [...this.spentBySupplier.values()].reduce((sum, value) => sum + value, 0);
  }

  totalReservedMicroUsd() {
    return [...this.reservedBySupplier.values()].reduce((sum, value) => sum + value, 0);
  }

  snapshot() {
    return Object.freeze({
      schema_version: 'phase6-local-budget-ledger-v1',
      scope_id: this.scopeId,
      budget_approval_id: this.budgetApprovalId,
      approved_budget_micro_usd: this.totalCapMicroUsd,
      spent_micro_usd: this.totalSpentMicroUsd(),
      reserved_micro_usd: this.totalReservedMicroUsd(),
      remaining_micro_usd: Math.max(
        0,
        this.totalCapMicroUsd - this.totalSpentMicroUsd() - this.totalReservedMicroUsd()
      ),
      spent_by_supplier: Object.freeze(Object.fromEntries(this.spentBySupplier)),
      reserved_by_supplier: Object.freeze(Object.fromEntries(this.reservedBySupplier)),
      active_reservations: this.reservations.size,
      stopped: this.stopped,
      stop_reason: this.stopReason
    });
  }
}

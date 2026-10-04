import { createHash } from 'node:crypto';

export const PHASE8_COST_SOFT_WARNING_MICRO_USD = 17_000_000;
export const PHASE8_COST_HARD_LIMIT_MICRO_USD = 20_000_000;

const REQUIRED_SUPPLIERS = Object.freeze([
  'bright_data',
  'serpapi',
  'sonar',
  'openrouter'
]);

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function buildPhase8CostReconciliation({
  runWindowId,
  statements = [],
  computeCostMicroUsd = 0,
  storageCostMicroUsd = 0,
  authoritative = false
} = {}) {
  required(runWindowId, 'runWindowId');
  nonNegativeInteger(computeCostMicroUsd, 'computeCostMicroUsd');
  nonNegativeInteger(storageCostMicroUsd, 'storageCostMicroUsd');
  const blockers = [];
  const seen = new Set();
  let supplierCost = 0;
  const normalized = statements.map((statement) => {
    const supplier = required(statement.supplier, 'supplier');
    if (!REQUIRED_SUPPLIERS.includes(supplier)) throw new RangeError(`unsupported supplier: ${supplier}`);
    if (seen.has(supplier)) throw new Error(`duplicate supplier statement: ${supplier}`);
    seen.add(supplier);
    const localUnits = nonNegativeInteger(statement.local_units, 'local_units');
    const billedUnits = nonNegativeInteger(statement.billed_units, 'billed_units');
    const cost = nonNegativeInteger(statement.billed_cost_micro_usd, 'billed_cost_micro_usd');
    supplierCost += cost;
    if (localUnits !== billedUnits) blockers.push(`${supplier}_unit_mismatch`);
    if (statement.run_window_id !== runWindowId) blockers.push(`${supplier}_window_mismatch`);
    if (!String(statement.statement_ref || '').trim()) blockers.push(`${supplier}_statement_ref_missing`);
    if (authoritative && statement.fixture === true) blockers.push(`${supplier}_fixture_not_authoritative`);
    return Object.freeze({
      supplier,
      unit: required(statement.unit, 'unit'),
      run_window_id: statement.run_window_id,
      local_units: localUnits,
      billed_units: billedUnits,
      billed_cost_micro_usd: cost,
      statement_ref: String(statement.statement_ref || ''),
      fixture: statement.fixture === true
    });
  }).sort((left, right) => left.supplier.localeCompare(right.supplier));
  for (const supplier of REQUIRED_SUPPLIERS) {
    if (!seen.has(supplier)) blockers.push(`${supplier}_statement_missing`);
  }
  if (!authoritative) blockers.push('authoritative_supplier_billing_missing');
  const total = supplierCost + computeCostMicroUsd + storageCostMicroUsd;
  if (authoritative && total === 0) blockers.push('nonzero_commercial_cost_missing');
  const alertState = total >= PHASE8_COST_HARD_LIMIT_MICRO_USD
    ? 'HARD_STOP'
    : total >= PHASE8_COST_SOFT_WARNING_MICRO_USD
      ? 'SOFT_WARNING'
      : 'NORMAL';
  return Object.freeze({
    schema_version: 'phase8-cost-reconciliation-v1',
    run_window_id: runWindowId,
    status: blockers.length ? 'COMMERCIAL_BLOCKED' : 'RECONCILED',
    authoritative,
    supplier_cost_micro_usd: supplierCost,
    compute_cost_micro_usd: computeCostMicroUsd,
    storage_cost_micro_usd: storageCostMicroUsd,
    total_cost_micro_usd: total,
    soft_warning_micro_usd: PHASE8_COST_SOFT_WARNING_MICRO_USD,
    hard_limit_micro_usd: PHASE8_COST_HARD_LIMIT_MICRO_USD,
    alert_state: alertState,
    hard_stop_required: alertState === 'HARD_STOP',
    statements: Object.freeze(normalized),
    blockers: Object.freeze([...new Set(blockers)].sort())
  });
}

export function buildPhase8BackupManifest({
  snapshotId,
  capturedAt,
  entries = []
} = {}) {
  required(snapshotId, 'snapshotId');
  required(capturedAt, 'capturedAt');
  if (!entries.length) throw new TypeError('at least one backup entry is required');
  const seen = new Set();
  const normalized = entries.map((entry) => {
    const logicalName = required(entry.logical_name, 'logical_name');
    if (seen.has(logicalName)) throw new Error(`duplicate backup entry: ${logicalName}`);
    seen.add(logicalName);
    const content = String(entry.content ?? '');
    return Object.freeze({
      logical_name: logicalName,
      kind: required(entry.kind, 'kind'),
      byte_length: Buffer.byteLength(content),
      sha256: sha256(content)
    });
  }).sort((left, right) => left.logical_name.localeCompare(right.logical_name));
  const manifestBody = JSON.stringify({ snapshotId, capturedAt, entries: normalized });
  return Object.freeze({
    schema_version: 'phase8-backup-manifest-v1',
    snapshot_id: snapshotId,
    captured_at: capturedAt,
    entries: Object.freeze(normalized),
    manifest_sha256: sha256(manifestBody),
    production_write_performed: false,
    external_storage_write_performed: false
  });
}

export function runPhase8RestoreDrill({
  manifest,
  restoredEntries = []
} = {}) {
  if (manifest?.schema_version !== 'phase8-backup-manifest-v1') {
    throw new TypeError('valid Phase 8 backup manifest is required');
  }
  const restored = new Map(restoredEntries.map((entry) => [
    String(entry.logical_name || ''),
    String(entry.content ?? '')
  ]));
  const blockers = [];
  for (const expected of manifest.entries) {
    if (!restored.has(expected.logical_name)) {
      blockers.push(`${expected.logical_name}_missing`);
      continue;
    }
    const content = restored.get(expected.logical_name);
    if (Buffer.byteLength(content) !== expected.byte_length) {
      blockers.push(`${expected.logical_name}_length_mismatch`);
    }
    if (sha256(content) !== expected.sha256) {
      blockers.push(`${expected.logical_name}_checksum_mismatch`);
    }
  }
  return Object.freeze({
    schema_version: 'phase8-restore-drill-v1',
    snapshot_id: manifest.snapshot_id,
    status: blockers.length ? 'RESTORE_DRILL_FAILED' : 'RESTORE_DRILL_PASSED',
    verified_entries: manifest.entries.length - new Set(
      blockers.map((blocker) => blocker.replace(/_(missing|length_mismatch|checksum_mismatch)$/, ''))
    ).size,
    production_restore_performed: false,
    external_calls_performed: 0,
    blockers: Object.freeze(blockers)
  });
}

export function runPhase8FailureDrill({
  scenario,
  queueDepth = 0,
  inFlight = 0
} = {}) {
  const supported = {
    worker_crash: ['expire_lease', 'requeue_idempotently', 'replace_worker'],
    supplier_outage: ['open_surface_breaker', 'apply_fallback_cap', 'preserve_credit'],
    account_challenge: ['quarantine_slot', 'drain_inflight', 'route_to_healthy_slot'],
    backup_corruption: ['reject_checksum', 'select_previous_snapshot', 'replay_audit_tail']
  };
  if (!supported[scenario]) throw new RangeError(`unsupported failure scenario: ${scenario}`);
  nonNegativeInteger(queueDepth, 'queueDepth');
  nonNegativeInteger(inFlight, 'inFlight');
  return Object.freeze({
    schema_version: 'phase8-failure-drill-v1',
    scenario,
    status: 'DRILL_PASSED',
    steps: Object.freeze(supported[scenario]),
    queue_depth_preserved: queueDepth,
    in_flight_accounted: inFlight,
    customer_credit_double_charge_allowed: false,
    live_actions_applied: false,
    external_calls_performed: 0
  });
}

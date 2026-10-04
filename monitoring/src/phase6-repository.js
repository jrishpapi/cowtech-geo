import { createHash } from 'node:crypto';
import { pool } from './db.js';
import { withTransaction } from './db-transaction.js';
import {
  classifyPhase6ControlledRetry,
  hashPhase6ReplaySelection
} from './phase6-replay-contract.js';

export function phase6ManifestHash(manifest) {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

export async function planPhase6Smoke(manifest, { approvedBudgetMicroUsd = 0, client = pool } = {}) {
  const options = typeof client.connect === 'function' ? { pool: client } : { client };
  return withTransaction(options, async (tx) => {
    const runResult = await tx.query(
      `INSERT INTO phase6_smoke_runs (
         status,runs_per_surface,planned_attempts,approved_budget_micro_usd,
         manifest_sha256,contract_version
       ) VALUES ('external_blocked',$1,$2,$3,$4,$5)
       RETURNING *`,
      [
        manifest.runs_per_surface,
        manifest.planned_attempts,
        approvedBudgetMicroUsd,
        phase6ManifestHash(manifest),
        manifest.schema_version
      ]
    );
    const run = runResult.rows[0];
    for (const item of manifest.items) {
      await tx.query(
         `INSERT INTO phase6_smoke_items (
           smoke_run_id,item_key,surface,session_mode,resource_policy,acquisition_mode,
           prompt_sha256,route_policy,selected_route,official_api_supplier,status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'planned')`,
        [
          run.id,
          item.item_key,
          item.surface,
          item.session_mode,
          item.resource_policy,
          item.acquisition_mode,
          item.prompt_sha256 || null,
          item.route_policy || null,
          item.route || null,
          item.official_api_supplier || null
        ]
      );
    }
    return run;
  });
}

export async function armPhase6SmokeRun(smokeRunId, client = pool) {
  const updated = await client.query(
    `UPDATE phase6_smoke_runs
        SET status='running'
      WHERE id=$1 AND status='external_blocked'
      RETURNING *`,
    [smokeRunId]
  );
  if (updated.rowCount !== 1) throw new Error('Phase 6 smoke run cannot be armed');
  return updated.rows[0];
}

export async function startPhase6SmokeItem({
  smokeRunId,
  itemKey,
  permit,
  replayBatchId = null
}, client = pool) {
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const itemResult = await tx.query(
        `UPDATE phase6_smoke_items
            SET status='running',transport_permit_id=$3,updated_at=NOW()
          WHERE smoke_run_id=$1 AND item_key=$2 AND status='planned'
            AND ($4::uuid IS NULL OR current_replay_batch_id=$4)
          RETURNING *`,
        [smokeRunId, itemKey, permit.permit_id, replayBatchId]
      );
      if (itemResult.rowCount !== 1) throw new Error('Phase 6 smoke item cannot start');
      await tx.query(
        `INSERT INTO phase6_budget_permits(
           id,smoke_run_id,smoke_item_id,supplier,transport_supplier,
           max_cost_micro_usd,status,replay_batch_id,replay_sequence
         ) VALUES ($1,$2,$3,$4,$5,$6,'reserved',$7,$8)`,
        [
          permit.permit_id,
          smokeRunId,
          itemResult.rows[0].id,
          permit.supplier,
          permit.transport_supplier,
          permit.max_cost_micro_usd,
          replayBatchId,
          Number(itemResult.rows[0].replay_attempt_count || 0)
        ]
      );
      if (replayBatchId) {
        await tx.query(
          `UPDATE phase6_replay_items
              SET status='running'
            WHERE replay_batch_id=$1 AND smoke_item_id=$2 AND status='selected'`,
          [replayBatchId, itemResult.rows[0].id]
        );
      }
      return itemResult.rows[0];
    }
  );
}

export async function finalizePhase6Permit({
  permitId,
  status,
  settledCostMicroUsd = null,
  costBasis = null
}, client = pool) {
  const updated = await client.query(
    `UPDATE phase6_budget_permits
        SET status=$2,settled_cost_micro_usd=$3,cost_basis=$4,finalized_at=NOW()
      WHERE id=$1 AND status IN ('reserved','started','reconciliation_required')
      RETURNING *`,
    [permitId, status, settledCostMicroUsd, costBasis]
  );
  if (updated.rowCount !== 1) throw new Error('Phase 6 permit cannot be finalized');
  return updated.rows[0];
}

export async function preparePhase6EvidenceReceipt({
  smokeRunId,
  itemKey,
  objectPath,
  contentSha256,
  contentSizeBytes,
  retentionUntil = null,
  metadata = {}
}, client = pool) {
  const inserted = await client.query(
    `INSERT INTO phase6_evidence_receipts(
       smoke_run_id,smoke_item_id,object_path,content_sha256,content_size_bytes,
       retention_until,metadata,status
     )
     SELECT $1,id,$3,$4,$5,$6,$7::jsonb,'prepared'
       FROM phase6_smoke_items
      WHERE smoke_run_id=$1 AND item_key=$2
     RETURNING *`,
    [
      smokeRunId,
      itemKey,
      objectPath,
      contentSha256,
      contentSizeBytes,
      retentionUntil,
      JSON.stringify(metadata)
    ]
  );
  if (inserted.rowCount !== 1) throw new Error('Phase 6 evidence receipt cannot be prepared');
  return inserted.rows[0];
}

export async function verifyPhase6EvidenceReceipt({
  receiptId,
  objectPath,
  contentSha256,
  contentSizeBytes
}, client = pool) {
  const updated = await client.query(
    `UPDATE phase6_evidence_receipts
        SET status='verified',verified_at=NOW()
      WHERE id=$1 AND status='prepared' AND object_path=$2
        AND content_sha256=$3 AND content_size_bytes=$4
      RETURNING *`,
    [receiptId, objectPath, contentSha256, contentSizeBytes]
  );
  if (updated.rowCount !== 1) throw new Error('Phase 6 evidence receipt verification mismatch');
  await client.query(
    `UPDATE phase6_smoke_items
        SET evidence_verified=TRUE,updated_at=NOW()
      WHERE id=$1`,
    [updated.rows[0].smoke_item_id]
  );
  return updated.rows[0];
}

export async function recordPhase6Reconciliation({
  smokeRunId,
  supplier,
  beforeUnits = null,
  afterUnits = null,
  billedCostMicroUsd = null,
  reconciliationStatus,
  evidenceRef = null,
  payload = {}
}, client = pool) {
  const result = await client.query(
    `INSERT INTO phase6_supplier_reconciliations(
       smoke_run_id,supplier,before_units,after_units,billed_cost_micro_usd,
       reconciliation_status,evidence_ref,payload,completed_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW())
     ON CONFLICT (smoke_run_id,supplier) DO UPDATE SET
       before_units=EXCLUDED.before_units,after_units=EXCLUDED.after_units,
       billed_cost_micro_usd=EXCLUDED.billed_cost_micro_usd,
       reconciliation_status=EXCLUDED.reconciliation_status,
       evidence_ref=EXCLUDED.evidence_ref,payload=EXCLUDED.payload,completed_at=NOW()
     RETURNING *`,
    [
      smokeRunId,
      supplier,
      beforeUnits,
      afterUnits,
      billedCostMicroUsd,
      reconciliationStatus,
      evidenceRef,
      JSON.stringify(payload)
    ]
  );
  return result.rows[0];
}

export async function finalizePhase6SmokeRun({
  smokeRunId,
  status,
  technicalStatus,
  commercialStatus
}, client = pool) {
  const result = await client.query(
    `UPDATE phase6_smoke_runs
        SET status=$2,technical_status=$3,commercial_status=$4,completed_at=NOW()
      WHERE id=$1 AND status='running'
      RETURNING *`,
    [smokeRunId, status, technicalStatus, commercialStatus]
  );
  if (result.rowCount !== 1) throw new Error('Phase 6 smoke run cannot be finalized');
  return result.rows[0];
}

export async function recordPhase6SmokeResult({ smokeRunId, itemKey, status, result }, client = pool) {
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const updated = await tx.query(
        `UPDATE phase6_smoke_items
            SET status=$3,result_payload=$4::jsonb,updated_at=NOW()
          WHERE smoke_run_id=$1 AND item_key=$2
          RETURNING *`,
        [smokeRunId, itemKey, status, JSON.stringify(result || {})]
      );
      if (updated.rowCount !== 1) throw new Error('Phase 6 smoke item not found');
      const row = updated.rows[0];
      if (row.current_replay_batch_id) {
        await tx.query(
          `UPDATE phase6_replay_items
              SET status=$3,completed_at=NOW()
            WHERE replay_batch_id=$1 AND smoke_item_id=$2
              AND status IN ('selected','running')`,
          [row.current_replay_batch_id, row.id, status]
        );
      }
      return row;
    }
  );
}

export async function reconcilePhase6PermitOverrun({
  smokeRunId,
  permitId,
  authorityRef,
  expectedActualCostMicroUsd
}, client = pool) {
  if (!String(authorityRef || '').trim()) throw new Error('permit reconciliation authority is required');
  const expected = Number(expectedActualCostMicroUsd);
  if (!Number.isSafeInteger(expected) || expected <= 0) throw new Error('expected actual cost is invalid');
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const selected = await tx.query(
        `SELECT p.*,i.status AS item_status,i.item_key
           FROM phase6_budget_permits p
           JOIN phase6_smoke_items i ON i.id=p.smoke_item_id
          WHERE p.id=$1 AND p.smoke_run_id=$2
          FOR UPDATE OF p,i`,
        [permitId, smokeRunId]
      );
      if (selected.rowCount !== 1) throw new Error('Phase 6 reconciliation permit not found');
      const permit = selected.rows[0];
      if (permit.status === 'reconciled_overrun') {
        if (
          Number(permit.settled_cost_micro_usd) !== expected ||
          permit.reconciliation_authority_ref !== authorityRef
        ) throw new Error('existing Phase 6 permit reconciliation does not match request');
        return permit;
      }
      if (
        permit.status !== 'reconciliation_required' ||
        permit.item_status !== 'completed' ||
        Number(permit.settled_cost_micro_usd) !== expected ||
        expected <= Number(permit.max_cost_micro_usd)
      ) throw new Error('Phase 6 permit is not an eligible completed overrun');
      const updated = await tx.query(
        `UPDATE phase6_budget_permits
            SET status='reconciled_overrun',
                reconciliation_authority_ref=$2,
                overrun_micro_usd=settled_cost_micro_usd-max_cost_micro_usd,
                reconciled_at=NOW(),finalized_at=COALESCE(finalized_at,NOW())
          WHERE id=$1 AND status='reconciliation_required'
          RETURNING *`,
        [permitId, authorityRef]
      );
      return updated.rows[0];
    }
  );
}

export async function preparePhase6SelectiveReplay({
  smokeRunId,
  authorityRef,
  expectedExternalBlockedCount,
  expectedCompletedCount,
  expectedFailedCount,
  expectedManifestSha256
}, client = pool) {
  if (!String(authorityRef || '').trim()) throw new Error('selective replay authority is required');
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const runResult = await tx.query(
        `SELECT * FROM phase6_smoke_runs WHERE id=$1 FOR UPDATE`,
        [smokeRunId]
      );
      if (runResult.rowCount !== 1) throw new Error('Phase 6 replay run not found');
      const run = runResult.rows[0];
      if (expectedManifestSha256 && run.manifest_sha256 !== expectedManifestSha256) {
        throw new Error('Phase 6 replay manifest hash mismatch');
      }
      const existing = await tx.query(
        `SELECT * FROM phase6_replay_batches
          WHERE smoke_run_id=$1 AND authority_ref=$2 AND status IN ('prepared','running')
          ORDER BY created_at DESC LIMIT 1`,
        [smokeRunId, authorityRef]
      );
      if (existing.rowCount === 1) {
        const itemRows = await tx.query(
          `SELECT item_key FROM phase6_replay_items WHERE replay_batch_id=$1 ORDER BY item_key`,
          [existing.rows[0].id]
        );
        return Object.freeze({ run, batch: existing.rows[0], item_keys: itemRows.rows.map((r) => r.item_key) });
      }
      if (run.status !== 'failed') throw new Error('Phase 6 selective replay requires a failed run');
      const countsResult = await tx.query(
        `SELECT status,count(*)::integer AS count
           FROM phase6_smoke_items WHERE smoke_run_id=$1 GROUP BY status`,
        [smokeRunId]
      );
      const counts = Object.fromEntries(countsResult.rows.map((row) => [row.status, Number(row.count)]));
      if (
        counts.external_blocked !== expectedExternalBlockedCount ||
        counts.completed !== expectedCompletedCount ||
        counts.failed !== expectedFailedCount
      ) throw new Error('Phase 6 replay protected terminal counts changed');
      const selected = await tx.query(
        `SELECT * FROM phase6_smoke_items
          WHERE smoke_run_id=$1 AND status='external_blocked'
          ORDER BY item_key FOR UPDATE`,
        [smokeRunId]
      );
      const itemKeys = selected.rows.map((row) => row.item_key);
      if (itemKeys.length !== expectedExternalBlockedCount) throw new Error('Phase 6 replay selection count mismatch');
      const selectionSha256 = hashPhase6ReplaySelection(itemKeys);
      const batchResult = await tx.query(
        `INSERT INTO phase6_replay_batches(
           smoke_run_id,selection_kind,authority_ref,selection_sha256,selected_count,
           protected_completed_count,protected_failed_count,status,metadata,started_at
         ) VALUES ($1,'external_blocked',$2,$3,$4,$5,$6,'running',$7::jsonb,NOW())
         RETURNING *`,
        [
          smokeRunId,
          authorityRef,
          selectionSha256,
          itemKeys.length,
          expectedCompletedCount,
          expectedFailedCount,
          JSON.stringify({ expected_manifest_sha256: expectedManifestSha256 || run.manifest_sha256 })
        ]
      );
      const batch = batchResult.rows[0];
      for (const item of selected.rows) {
        await tx.query(
          `INSERT INTO phase6_replay_items(
             replay_batch_id,smoke_item_id,item_key,previous_status,
             previous_result_payload,error_code,retry_classification
           ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,'not_started')`,
          [
            batch.id,
            item.id,
            item.item_key,
            item.status,
            JSON.stringify(item.result_payload || {}),
            item.result_payload?.error_code || null
          ]
        );
      }
      const armedItems = await tx.query(
        `UPDATE phase6_smoke_items
            SET status='planned',replay_attempt_count=replay_attempt_count+1,
                current_replay_batch_id=$2,updated_at=NOW()
          WHERE smoke_run_id=$1 AND status='external_blocked'
          RETURNING item_key`,
        [smokeRunId, batch.id]
      );
      if (armedItems.rowCount !== itemKeys.length) throw new Error('Phase 6 selective replay arm count mismatch');
      const armedRun = await tx.query(
        `UPDATE phase6_smoke_runs
            SET status='running',technical_status='pending',commercial_status='blocked',completed_at=NULL
          WHERE id=$1 AND status='failed' RETURNING *`,
        [smokeRunId]
      );
      if (armedRun.rowCount !== 1) throw new Error('Phase 6 selective replay run cannot be armed');
      return Object.freeze({ run: armedRun.rows[0], batch, item_keys: itemKeys });
    }
  );
}

export async function preparePhase6ControlledFailedRetry({
  smokeRunId,
  authorityRef,
  retryClassification = 'transient',
  expectedSelectedCount,
  expectedCompletedCount,
  expectedFailedCount,
  expectedManifestSha256,
  prerequisiteCanaryRef = null
}, client = pool) {
  if (!String(authorityRef || '').trim()) throw new Error('controlled retry authority is required');
  if (!['transient', 'structural_hold'].includes(retryClassification)) {
    throw new Error('unsupported controlled retry classification');
  }
  if (retryClassification === 'structural_hold' && !String(prerequisiteCanaryRef || '').trim()) {
    throw new Error('structural retry requires a fresh canary reference');
  }
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const runResult = await tx.query(
        `SELECT * FROM phase6_smoke_runs WHERE id=$1 FOR UPDATE`,
        [smokeRunId]
      );
      if (runResult.rowCount !== 1) throw new Error('Phase 6 controlled retry run not found');
      const run = runResult.rows[0];
      if (run.status !== 'failed') throw new Error('Phase 6 controlled retry requires a failed run');
      if (expectedManifestSha256 && run.manifest_sha256 !== expectedManifestSha256) {
        throw new Error('Phase 6 controlled retry manifest hash mismatch');
      }
      const countsResult = await tx.query(
        `SELECT status,count(*)::integer AS count
           FROM phase6_smoke_items WHERE smoke_run_id=$1 GROUP BY status`,
        [smokeRunId]
      );
      const counts = Object.fromEntries(countsResult.rows.map((row) => [row.status, Number(row.count)]));
      if (
        Number(counts.completed || 0) !== Number(expectedCompletedCount) ||
        Number(counts.failed || 0) !== Number(expectedFailedCount) ||
        Number(counts.external_blocked || 0) !== 0 ||
        Number(counts.planned || 0) !== 0 ||
        Number(counts.running || 0) !== 0
      ) throw new Error('Phase 6 controlled retry protected terminal counts changed');
      const failed = await tx.query(
        `SELECT * FROM phase6_smoke_items
          WHERE smoke_run_id=$1 AND status='failed'
          ORDER BY item_key FOR UPDATE`,
        [smokeRunId]
      );
      const selectedRows = failed.rows.filter((item) => {
        const rule = classifyPhase6ControlledRetry(item.result_payload);
        return rule.classification === retryClassification &&
          rule.max_retries === 1 && Number(item.replay_attempt_count || 0) === 0;
      });
      if (selectedRows.length !== Number(expectedSelectedCount)) {
        throw new Error('Phase 6 controlled retry selection count mismatch');
      }
      let prerequisiteCanary = null;
      if (retryClassification === 'structural_hold') {
        const canaryResult = await tx.query(
          `SELECT * FROM phase6_retry_canaries
            WHERE id=$1::uuid AND smoke_run_id=$2 AND surface='chatgpt_ui' AND status='passed'`,
          [prerequisiteCanaryRef, smokeRunId]
        );
        if (canaryResult.rowCount !== 1) {
          throw new Error('structural retry prerequisite canary is not passed');
        }
        prerequisiteCanary = canaryResult.rows[0];
      }
      const itemKeys = selectedRows.map((row) => row.item_key);
      const selectionSha256 = hashPhase6ReplaySelection(itemKeys);
      const batchResult = await tx.query(
        `INSERT INTO phase6_replay_batches(
           smoke_run_id,selection_kind,authority_ref,selection_sha256,selected_count,
           protected_completed_count,protected_failed_count,status,metadata,started_at
         ) VALUES ($1,'controlled_failed',$2,$3,$4,$5,$6,'running',$7::jsonb,NOW())
         RETURNING *`,
        [
          smokeRunId,
          authorityRef,
          selectionSha256,
          itemKeys.length,
          expectedCompletedCount,
          expectedFailedCount - itemKeys.length,
          JSON.stringify({
            expected_manifest_sha256: expectedManifestSha256 || run.manifest_sha256,
            retry_classification: retryClassification,
            prerequisite_canary_ref: prerequisiteCanary?.id || null,
            prerequisite_canary_authority_ref: prerequisiteCanary?.authority_ref || null,
            prerequisite_canary_adapter_version: prerequisiteCanary?.adapter_version || null,
            prerequisite_canary_requested_geo: prerequisiteCanary?.requested_geo || null
          })
        ]
      );
      const batch = batchResult.rows[0];
      for (const item of selectedRows) {
        await tx.query(
          `INSERT INTO phase6_replay_items(
             replay_batch_id,smoke_item_id,item_key,previous_status,
             previous_result_payload,error_code,retry_classification
           ) VALUES ($1,$2,$3,'failed',$4::jsonb,$5,$6)`,
          [
            batch.id,
            item.id,
            item.item_key,
            JSON.stringify(item.result_payload || {}),
            item.result_payload?.error_code || null,
            retryClassification
          ]
        );
      }
      const armedItems = await tx.query(
        `UPDATE phase6_smoke_items
            SET status='planned',replay_attempt_count=replay_attempt_count+1,
                current_replay_batch_id=$2,updated_at=NOW()
          WHERE smoke_run_id=$1 AND id=ANY($3::uuid[]) AND status='failed'
            AND replay_attempt_count=0
          RETURNING item_key`,
        [smokeRunId, batch.id, selectedRows.map((row) => row.id)]
      );
      if (armedItems.rowCount !== itemKeys.length) {
        throw new Error('Phase 6 controlled retry arm count mismatch');
      }
      const armedRun = await tx.query(
        `UPDATE phase6_smoke_runs
            SET status='running',technical_status='pending',commercial_status='blocked',completed_at=NULL
          WHERE id=$1 AND status='failed' RETURNING *`,
        [smokeRunId]
      );
      if (armedRun.rowCount !== 1) throw new Error('Phase 6 controlled retry run cannot be armed');
      return Object.freeze({ run: armedRun.rows[0], batch, item_keys: itemKeys });
    }
  );
}

export async function completePhase6ReplayBatch({ replayBatchId }, client = pool) {
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const batchResult = await tx.query(
        `SELECT * FROM phase6_replay_batches WHERE id=$1 AND status='running' FOR UPDATE`,
        [replayBatchId]
      );
      if (batchResult.rowCount !== 1) throw new Error('Phase 6 replay batch is not running');
      const batch = batchResult.rows[0];
      const countsResult = await tx.query(
        `SELECT i.status,count(*)::integer AS count
           FROM phase6_replay_items r JOIN phase6_smoke_items i ON i.id=r.smoke_item_id
          WHERE r.replay_batch_id=$1 GROUP BY i.status`,
        [replayBatchId]
      );
      const counts = Object.fromEntries(countsResult.rows.map((row) => [row.status, Number(row.count)]));
      if ((counts.planned || 0) > 0 || (counts.running || 0) > 0 || (counts.external_blocked || 0) > 0) {
        throw new Error('Phase 6 replay batch still has non-terminal selected items');
      }
      await tx.query(
        `UPDATE phase6_replay_items r SET status=i.status,completed_at=NOW()
           FROM phase6_smoke_items i
          WHERE r.replay_batch_id=$1 AND i.id=r.smoke_item_id`,
        [replayBatchId]
      );
      const updated = await tx.query(
        `UPDATE phase6_replay_batches SET status='completed',completed_at=NOW(),
          metadata=metadata || $2::jsonb WHERE id=$1 RETURNING *`,
        [replayBatchId, JSON.stringify({ terminal_counts: counts })]
      );
      await tx.query(
        `UPDATE phase6_smoke_items SET current_replay_batch_id=NULL
          WHERE current_replay_batch_id=$1`,
        [replayBatchId]
      );
      return updated.rows[0];
    }
  );
}

export async function failPhase6ReplayBatch({ replayBatchId, errorCode }, client = pool) {
  if (!replayBatchId) return null;
  const result = await client.query(
    `UPDATE phase6_replay_batches SET status='failed',completed_at=NOW(),
       metadata=metadata || $2::jsonb
     WHERE id=$1 AND status='running' RETURNING *`,
    [replayBatchId, JSON.stringify({ error_code: errorCode || 'phase6_replay_failed' })]
  );
  return result.rows[0] || null;
}

export async function preparePhase6RetryCanary({
  smokeRunId,
  authorityRef,
  sourceItemKey,
  routePolicy,
  selectedRoute,
  adapterVersion,
  requestedGeo,
  promptSha256
}, client = pool) {
  if (!String(authorityRef || '').trim()) throw new Error('retry canary authority is required');
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const source = await tx.query(
        `SELECT i.*,r.status AS run_status
           FROM phase6_smoke_items i
           JOIN phase6_smoke_runs r ON r.id=i.smoke_run_id
          WHERE i.smoke_run_id=$1 AND i.item_key=$2
          FOR UPDATE OF i,r`,
        [smokeRunId, sourceItemKey]
      );
      if (source.rowCount !== 1) throw new Error('retry canary source item not found');
      const item = source.rows[0];
      if (
        item.run_status !== 'failed' || item.status !== 'failed' ||
        item.surface !== 'chatgpt_ui' || item.result_payload?.error_code !== 'surface_login_wall' ||
        Number(item.replay_attempt_count || 0) !== 0 || item.route_policy !== routePolicy ||
        item.selected_route !== selectedRoute || item.prompt_sha256 !== promptSha256
      ) throw new Error('retry canary source item contract mismatch');
      const activeBatch = await tx.query(
        `SELECT 1 FROM phase6_replay_batches
          WHERE smoke_run_id=$1 AND status IN ('prepared','running') LIMIT 1`,
        [smokeRunId]
      );
      if (activeBatch.rowCount) throw new Error('retry canary requires no active replay batch');
      const inserted = await tx.query(
        `INSERT INTO phase6_retry_canaries(
           smoke_run_id,authority_ref,surface,source_item_key,route_policy,
           selected_route,adapter_version,requested_geo,prompt_sha256,status
         ) VALUES ($1,$2,'chatgpt_ui',$3,$4,$5,$6,$7::jsonb,$8,'prepared')
         RETURNING *`,
        [
          smokeRunId, authorityRef, sourceItemKey, routePolicy, selectedRoute,
          adapterVersion, JSON.stringify(requestedGeo || {}), promptSha256
        ]
      );
      return inserted.rows[0];
    }
  );
}

export async function startPhase6RetryCanary({ canaryId, permit }, client = pool) {
  const result = await client.query(
    `UPDATE phase6_retry_canaries SET
       status='running',permit_id=$2,max_cost_micro_usd=$3,started_at=NOW()
     WHERE id=$1 AND status='prepared' RETURNING *`,
    [canaryId, permit.permit_id, permit.max_cost_micro_usd]
  );
  if (result.rowCount !== 1) throw new Error('Phase 6 retry canary cannot start');
  return result.rows[0];
}

export async function finalizePhase6RetryCanaryPermit({
  canaryId,
  permitId,
  settledCostMicroUsd,
  costBasis
}, client = pool) {
  const result = await client.query(
    `UPDATE phase6_retry_canaries SET settled_cost_micro_usd=$3,cost_basis=$4
      WHERE id=$1 AND permit_id=$2 AND status='running' RETURNING *`,
    [canaryId, permitId, settledCostMicroUsd, costBasis]
  );
  if (result.rowCount !== 1) throw new Error('Phase 6 retry canary permit cannot finalize');
  return result.rows[0];
}

export async function preparePhase6RetryCanaryEvidence({
  canaryId,
  objectPath,
  contentSha256,
  contentSizeBytes,
  retentionUntil = null,
  metadata = {}
}, client = pool) {
  const result = await client.query(
    `INSERT INTO phase6_retry_canary_evidence_receipts(
       canary_id,object_path,content_sha256,content_size_bytes,retention_until,metadata,status
     ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,'prepared') RETURNING *`,
    [
      canaryId, objectPath, contentSha256, contentSizeBytes, retentionUntil,
      JSON.stringify(metadata)
    ]
  );
  return result.rows[0];
}

export async function verifyPhase6RetryCanaryEvidence({
  receiptId,
  objectPath,
  contentSha256,
  contentSizeBytes
}, client = pool) {
  const result = await client.query(
    `UPDATE phase6_retry_canary_evidence_receipts SET status='verified',verified_at=NOW()
      WHERE id=$1 AND status='prepared' AND object_path=$2
        AND content_sha256=$3 AND content_size_bytes=$4 RETURNING *`,
    [receiptId, objectPath, contentSha256, contentSizeBytes]
  );
  if (result.rowCount !== 1) throw new Error('Phase 6 retry canary evidence mismatch');
  return result.rows[0];
}

export async function completePhase6RetryCanary({ canaryId, result }, client = pool) {
  return withTransaction(
    typeof client.connect === 'function' ? { pool: client } : { client },
    async (tx) => {
      const current = await tx.query(
        `SELECT * FROM phase6_retry_canaries WHERE id=$1 AND status='running' FOR UPDATE`,
        [canaryId]
      );
      if (current.rowCount !== 1) throw new Error('Phase 6 retry canary cannot complete');
      const requestedGeo = current.rows[0].requested_geo || {};
      const providerGeo = result?.provider_result?.actual_geo || {};
      const evidenceGeo = result?.evidence_manifest?.actual_geo || {};
      const exactGeo = ['region', 'language', 'device'].every((field) =>
        String(providerGeo[field] || '').toLowerCase() ===
          String(requestedGeo[field] || '').toLowerCase() &&
        String(evidenceGeo[field] || '').toLowerCase() ===
          String(requestedGeo[field] || '').toLowerCase()
      );
      const passed = result?.delivery_valid === true && result?.native_valid === true &&
        result?.evidence_verified === true && result?.acquisition_mode === 'web_ui' &&
        result?.surface === 'chatgpt_ui' && exactGeo;
      const updated = await tx.query(
        `UPDATE phase6_retry_canaries SET status=$2,result_payload=$3::jsonb,completed_at=NOW()
          WHERE id=$1 AND status='running' RETURNING *`,
        [canaryId, passed ? 'passed' : 'failed', JSON.stringify(result || {})]
      );
      if (updated.rowCount !== 1) throw new Error('Phase 6 retry canary cannot complete');
      return updated.rows[0];
    }
  );
}

export async function failPhase6RetryCanary({ canaryId, error }, client = pool) {
  if (!canaryId) return null;
  const resultPayload = {
    terminal: true,
    delivery_valid: false,
    native_valid: false,
    evidence_verified: false,
    surface: 'chatgpt_ui',
    acquisition_mode: 'web_ui',
    error_code: error?.code || error?.name || 'retry_canary_failed',
    failure_detail: String(error?.message || error || 'retry canary failed').slice(0, 4000)
  };
  const updated = await client.query(
    `UPDATE phase6_retry_canaries SET status='failed',result_payload=$2::jsonb,completed_at=NOW()
      WHERE id=$1 AND status IN ('prepared','running') RETURNING *`,
    [canaryId, JSON.stringify(resultPayload)]
  );
  return updated.rows[0] || null;
}

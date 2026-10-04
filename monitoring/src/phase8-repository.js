import { pool } from './db.js';
import { withTransaction } from './db-transaction.js';

function optionsFor(client) {
  return typeof client.connect === 'function' ? { pool: client } : { client };
}

export async function planPhase8Engineering({
  accountPool,
  migrationPlan,
  canaryPlan
} = {}, { client = pool } = {}) {
  if (
    accountPool?.live_binding_allowed !== false ||
    migrationPlan?.production_apply_allowed !== false ||
    migrationPlan?.rollback_apply_allowed !== false ||
    canaryPlan?.live_start_allowed !== false
  ) {
    throw new Error('Phase 8 engineering repository accepts live-frozen plans only');
  }
  return withTransaction(optionsFor(client), async (tx) => {
    await tx.query(
      `INSERT INTO phase8_logical_account_slots (
         slot_key,surface,region,compliance_policy_ref,state,max_concurrency,
         real_account_bound,credential_material_present
       )
       SELECT slot_key,surface,region,compliance_policy_ref,'live_frozen',
              max_concurrency,FALSE,FALSE
       FROM jsonb_to_recordset($1::jsonb) AS slot(
         slot_key TEXT,surface TEXT,region TEXT,compliance_policy_ref TEXT,
         max_concurrency INTEGER
       )
       ON CONFLICT (slot_key) DO UPDATE SET
         surface=EXCLUDED.surface,
         region=EXCLUDED.region,
         compliance_policy_ref=EXCLUDED.compliance_policy_ref,
         state='live_frozen',
         real_account_bound=FALSE,
         credential_material_present=FALSE,
         updated_at=NOW()`,
      [JSON.stringify(accountPool.slots)]
    );
    const runResult = await tx.query(
      `INSERT INTO phase8_customer_migration_runs (
         authority_ref,plan_sha256,status,production_apply_allowed,
         rollback_apply_allowed,planned_customers
       ) VALUES ($1,$2,'dry_run_only',FALSE,FALSE,$3)
       RETURNING *`,
      [
        migrationPlan.engineering_authority_ref,
        migrationPlan.plan_sha256,
        migrationPlan.planned_customers
      ]
    );
    const migrationRun = runResult.rows[0];
    await tx.query(
      `INSERT INTO phase8_customer_migration_items (
         migration_run_id,customer_id,plan_code,action,target_contract,
         rollback_snapshot,idempotency_key,status
       )
       SELECT $1,customer_id::uuid,plan_code,action,target::jsonb,
              rollback_snapshot::jsonb,idempotency_key,'dry_run_only'
       FROM jsonb_to_recordset($2::jsonb) AS item(
         customer_id TEXT,plan_code TEXT,action TEXT,target JSONB,
         rollback_snapshot JSONB,idempotency_key TEXT
       )`,
      [migrationRun.id, JSON.stringify(migrationPlan.items)]
    );
    const canaryResult = await tx.query(
      `INSERT INTO phase8_canary_runs (
         cohort_id,authority_ref,status,current_percent,live_start_allowed,
         phase7_authoritative_go,approved_budget_micro_usd
       ) VALUES ($1,$2,'live_frozen',0,FALSE,FALSE,0)
       RETURNING *`,
      [canaryPlan.cohort_id, canaryPlan.engineering_authority_ref]
    );
    const canaryRun = canaryResult.rows[0];
    await tx.query(
      `INSERT INTO phase8_canary_stages (
         canary_run_id,percent,customer_count,customer_ids,status
       )
       SELECT $1,percent,customer_count,customer_ids,'live_frozen'
       FROM jsonb_to_recordset($2::jsonb) AS stage(
         percent INTEGER,customer_count INTEGER,customer_ids JSONB
       )`,
      [canaryRun.id, JSON.stringify(canaryPlan.stages)]
    );
    return Object.freeze({
      migration_run: migrationRun,
      canary_run: canaryRun,
      status: 'PHASE8_ENGINEERING_PLANNED_LIVE_FROZEN'
    });
  });
}

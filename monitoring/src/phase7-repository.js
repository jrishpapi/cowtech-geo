import { pool } from './db.js';
import { withTransaction } from './db-transaction.js';

export async function planPhase7Poc(plan, { client = pool } = {}) {
  if (plan?.live_execution_allowed !== false || plan?.approved_budget_micro_usd !== 0) {
    throw new Error('Phase 7 engineering plan must remain live-frozen and budget-zero');
  }
  const options = typeof client.connect === 'function' ? { pool: client } : { client };
  return withTransaction(options, async (tx) => {
    const runResult = await tx.query(
      `INSERT INTO phase7_poc_runs (
         cohort_id,status,dataset_sha256,plan_sha256,planned_demands,planned_batches,
         engineering_authority_ref,phase6_freeze_decision_ref,phase6_exit_passed,
         approved_budget_micro_usd
       ) VALUES ($1,'live_frozen',$2,$3,$4,$5,$6,$7,FALSE,0)
       RETURNING *`,
      [
        plan.cohort_id,
        plan.dataset_sha256,
        plan.plan_sha256,
        plan.planned_demands,
        plan.planned_batches,
        plan.engineering_authority_ref,
        plan.phase6_freeze_decision_ref
      ]
    );
    const run = runResult.rows[0];
    await tx.query(
      `INSERT INTO phase7_poc_batches (
         poc_run_id,batch_key,stage,status,planned_demands,surfaces
       )
       SELECT $1,batch_key,stage,'live_frozen',planned_demands,surfaces
       FROM jsonb_to_recordset($2::jsonb) AS batch(
         batch_key TEXT,stage TEXT,planned_demands INTEGER,surfaces JSONB
       )`,
      [run.id, JSON.stringify(plan.batches)]
    );
    await tx.query(
      `INSERT INTO phase7_poc_items (
         poc_run_id,poc_batch_id,item_key,sequence,surface,prompt_id,prompt_sha256,
         original_prompt_text,daily_bucket,workload_class,acquisition_mode,
         surface_ordinal,session_mode,session_cycle,session_ordinal,
         session_checkpoint,no_cache,customer_credit_units,status
       )
       SELECT $1,b.id,item.item_key,item.sequence,item.surface,item.prompt_id,
              item.prompt_sha256,item.prompt_text,item.daily_bucket,item.workload_class,
              item.acquisition_mode,item.surface_ordinal,item.session_mode,item.session_cycle,item.session_ordinal,
              item.session_checkpoint,item.no_cache,item.customer_credit_units,
              'live_frozen'
       FROM jsonb_to_recordset($2::jsonb) AS item(
         item_key TEXT,sequence INTEGER,batch_key TEXT,surface TEXT,prompt_id TEXT,
         prompt_sha256 TEXT,prompt_text TEXT,daily_bucket TEXT,workload_class TEXT,
         acquisition_mode TEXT,surface_ordinal INTEGER,session_mode TEXT,
         session_cycle INTEGER,session_ordinal INTEGER,
         session_checkpoint INTEGER,no_cache BOOLEAN,customer_credit_units INTEGER
       )
       JOIN phase7_poc_batches b
         ON b.poc_run_id=$1 AND b.batch_key=item.batch_key`,
      [run.id, JSON.stringify(plan.items)]
    );
    return run;
  });
}

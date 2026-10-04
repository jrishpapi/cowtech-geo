export async function planPhase9Engineering(repository, { plan, checkpoint, evaluation, drills }) {
  if (!repository?.query) throw new TypeError('repository.query required');
  await repository.query('BEGIN');
  try {
    const run = await repository.query(
      `INSERT INTO phase9_soak_runs
       (soak_key,authority_ref,plan_sha256,target_days,maximum_days,status,live_start_allowed)
       VALUES ($1,$2,$3,$4,$5,'live_frozen',FALSE)
       ON CONFLICT (soak_key) DO UPDATE SET plan_sha256=EXCLUDED.plan_sha256
       RETURNING id`,
      [plan.soak_id, plan.authority_ref, plan.plan_sha256, plan.target_days, plan.maximum_days]
    );
    const runId = run.rows[0].id;
    for (const day of plan.timeline) {
      await repository.query(
        `INSERT INTO phase9_soak_days
         (soak_run_id,day_number,day_date,status,authoritative)
         VALUES ($1,$2,$3,'live_frozen',FALSE)
         ON CONFLICT (soak_run_id,day_number) DO NOTHING`,
        [runId, day.day, day.date]
      );
    }
    await repository.query(
      `INSERT INTO phase9_soak_checkpoints
       (soak_run_id,completed_days,next_day,checkpoint_payload,live_resume_allowed)
       VALUES ($1,$2,$3,$4::jsonb,FALSE)`,
      [runId, checkpoint.completed_days, checkpoint.next_day, JSON.stringify(checkpoint)]
    );
    for (const drill of drills) {
      await repository.query(
        `INSERT INTO phase9_failure_drills
         (soak_run_id,scenario,status,result_payload)
         VALUES ($1,$2,$3,$4::jsonb)`,
        [runId, drill.scenario, drill.status, JSON.stringify(drill)]
      );
    }
    await repository.query(
      `INSERT INTO phase9_launch_gate_reviews
       (soak_run_id,soak_decision,status,launch_allowed,review_payload)
       VALUES ($1,$2,'commercial_launch_frozen',FALSE,$3::jsonb)`,
      [runId, evaluation.decision, JSON.stringify(evaluation)]
    );
    await repository.query('COMMIT');
    return Object.freeze({ run_id: runId, planned_days: plan.timeline.length, persisted: true });
  } catch (error) {
    await repository.query('ROLLBACK');
    throw error;
  }
}

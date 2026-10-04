import { pool } from './db.js';

export async function getMonthlyProviderUsage({ customer_id, now = new Date() }) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const result = await pool.query(
    `SELECT COUNT(*)::int AS provider_calls,
            COALESCE(SUM(cost_estimate_usd), 0)::numeric AS cost_estimate_usd
     FROM usage_ledger
     WHERE customer_id = $1
       AND event_type = 'provider_call'
       AND created_at >= $2`,
    [customer_id, monthStart.toISOString()]
  );

  return {
    provider_calls: result.rows[0]?.provider_calls || 0,
    cost_estimate_usd: Number(result.rows[0]?.cost_estimate_usd || 0),
    month_start: monthStart.toISOString()
  };
}

export async function assertMonthlyProviderCallLimit({ customer_id, plan, additional_calls }) {
  if (!plan.monthly_provider_call_limit || plan.monthly_provider_call_limit <= 0) {
    return { allowed: true, skipped: true };
  }

  if (additional_calls > plan.monthly_provider_call_limit) {
    const error = new Error(
      `monthly provider call limit exceeded: ${additional_calls}/${plan.monthly_provider_call_limit}`
    );
    error.code = 'monthly_provider_call_limit_exceeded';
    error.details = {
      additional_calls,
      projected: additional_calls,
      limit: plan.monthly_provider_call_limit
    };
    throw error;
  }

  const usage = await getMonthlyProviderUsage({ customer_id });
  const projected = usage.provider_calls + additional_calls;

  if (projected > plan.monthly_provider_call_limit) {
    const error = new Error(
      `monthly provider call limit exceeded: ${projected}/${plan.monthly_provider_call_limit}`
    );
    error.code = 'monthly_provider_call_limit_exceeded';
    error.details = {
      usage,
      additional_calls,
      projected,
      limit: plan.monthly_provider_call_limit
    };
    throw error;
  }

  return {
    allowed: true,
    usage,
    additional_calls,
    projected,
    limit: plan.monthly_provider_call_limit
  };
}

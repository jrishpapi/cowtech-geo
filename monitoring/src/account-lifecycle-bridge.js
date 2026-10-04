export const ACCOUNT_LIFECYCLE_SCHEMA = 'r10-3-account-lifecycle-bridge-v1';
export const DASHBOARD_AUTH_SURFACE_SCHEMA = 'r10-3-customer-dashboard-auth-surface-v1';

const LIFECYCLE_STATES = new Set(['active', 'trialing', 'past_due', 'canceled', 'paused', 'comped']);

function normalizeStatus(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  return LIFECYCLE_STATES.has(normalized) ? normalized : 'unknown';
}

function planCode(plan = {}, customer = {}) {
  return plan?.id || customer?.plan_code || null;
}

function lifecyclePolicy(status) {
  const normalized = normalizeStatus(status);
  const base = {
    subscription_state: normalized,
    data_retention: 'preserve_customer_history',
    historical_results_visible: true,
    current_period_behavior: 'preserve_existing_results',
    lifecycle_mutation_executed: false
  };

  if (normalized === 'active') {
    return {
      ...base,
      customer_access: 'active',
      dashboard_access: 'full',
      future_scheduled_jobs_policy: 'allow_future_jobs',
      additions_policy: 'allow_with_quota_enforcement',
      blocker: null,
      next_operator_action: 'No billing lifecycle action required.'
    };
  }

  if (normalized === 'trialing') {
    return {
      ...base,
      customer_access: 'trial',
      dashboard_access: 'full',
      future_scheduled_jobs_policy: 'allow_future_jobs',
      additions_policy: 'allow_with_trial_entitlement',
      blocker: null,
      next_operator_action: 'Monitor trial conversion before production billing launch.'
    };
  }

  if (normalized === 'comped') {
    return {
      ...base,
      customer_access: 'active_comped',
      dashboard_access: 'full',
      future_scheduled_jobs_policy: 'allow_future_jobs',
      additions_policy: 'allow_with_admin_entitlement',
      blocker: null,
      next_operator_action: 'Review comped account owner and expiry policy.'
    };
  }

  if (normalized === 'past_due') {
    return {
      ...base,
      customer_access: 'restricted',
      dashboard_access: 'read_only',
      future_scheduled_jobs_policy: 'pause_future_jobs_after_payment_failure',
      additions_policy: 'block_new_paid_work_until_payment_resolved',
      blocker: 'past_due_payment',
      next_operator_action: 'Resolve payment status before allowing future scheduled jobs.'
    };
  }

  if (normalized === 'paused') {
    return {
      ...base,
      customer_access: 'paused',
      dashboard_access: 'read_only',
      future_scheduled_jobs_policy: 'pause_future_jobs',
      additions_policy: 'block_new_paid_work_until_account_resumed',
      blocker: 'paused_subscription',
      next_operator_action: 'Confirm resume approval before future jobs are allowed.'
    };
  }

  if (normalized === 'canceled') {
    return {
      ...base,
      customer_access: 'canceled',
      dashboard_access: 'read_only',
      future_scheduled_jobs_policy: 'stop_future_scheduled_jobs_after_current_period_policy',
      additions_policy: 'block_new_paid_work',
      blocker: 'canceled_subscription',
      next_operator_action: 'Confirm cancellation effective date and stop future scheduled jobs.'
    };
  }

  return {
    ...base,
    customer_access: 'unknown',
    dashboard_access: 'read_only',
    future_scheduled_jobs_policy: 'block_until_customer_status_mapped',
    additions_policy: 'block_new_paid_work_until_status_mapped',
    blocker: 'unknown_customer_status',
    next_operator_action: 'Map customer lifecycle status before enabling account access.'
  };
}

export function buildDashboardAuthSurface({ customer = {}, lifecycle = null } = {}) {
  const policy = lifecycle || lifecyclePolicy(customer?.status);
  const identityLinked = Boolean(customer?.external_customer_id || customer?.email);
  const authBlockers = [
    !identityLinked ? 'missing_public_account_identity' : null,
    policy.blocker
  ].filter(Boolean);

  return {
    schema_version: DASHBOARD_AUTH_SURFACE_SCHEMA,
    mode: 'customer_safe_auth_surface',
    status: authBlockers.length ? 'restricted' : 'active',
    public_account_identity: {
      external_customer_id_present: Boolean(customer?.external_customer_id),
      email_present: Boolean(customer?.email),
      identity_linked: identityLinked
    },
    dashboard_access: policy.dashboard_access,
    customer_access: policy.customer_access,
    auth_behavior_changed: false,
    session_behavior_changed: false,
    production_account_created: false,
    production_auth_mutation_allowed: false,
    blockers: authBlockers,
    next_customer_safe_message:
      policy.dashboard_access === 'full'
        ? 'Account access is active for the current plan.'
        : 'Account is read-only until billing or account status is resolved.'
  };
}

export function buildAccountLifecycleBridge({ customer = {}, brand = null, plan = null, usage = {} } = {}) {
  const policy = lifecyclePolicy(customer?.status);
  const authSurface = buildDashboardAuthSurface({ customer, lifecycle: policy });
  const quotaStatus = usage?.quota_status || 'unknown';
  const blockers = [
    policy.blocker,
    !customer?.external_customer_id && !customer?.email ? 'missing_public_account_identity' : null,
    quotaStatus === 'over_quota' ? 'quota_exceeded' : null
  ].filter(Boolean);
  const warnings = [
    !customer?.external_customer_id ? 'missing_external_customer_id' : null,
    !customer?.email ? 'missing_customer_email' : null,
    'real_payment_provider_not_connected_in_r10_3',
    'production_auth_behavior_not_changed_in_r10_3'
  ].filter(Boolean);

  return {
    schema_version: ACCOUNT_LIFECYCLE_SCHEMA,
    auth_surface_schema_version: DASHBOARD_AUTH_SURFACE_SCHEMA,
    mode: 'account_lifecycle_bridge',
    status: blockers.length ? 'blocked' : warnings.length ? 'active_with_warnings' : 'active',
    source_of_truth: {
      customer_status_source: 'customers.status',
      public_account_identity_source: 'customers.external_customer_id/customers.email',
      plan_source: 'customers.plan_code',
      payment_provider_connected: false,
      real_subscription_webhook_connected: false
    },
    customer: {
      id: customer?.id || null,
      external_customer_id: customer?.external_customer_id || null,
      email: customer?.email || null,
      status: normalizeStatus(customer?.status)
    },
    brand: brand
      ? {
          id: brand.id || null,
          name: brand.name || null
        }
      : null,
    plan: {
      id: planCode(plan, customer),
      status: plan?.status || 'unknown'
    },
    lifecycle: policy,
    dashboard_auth_surface: authSurface,
    downgrade_policy: {
      historical_results_preserved: true,
      over_quota_additions_blocked: true,
      quota_enforcement_source: 'r10-2-quota-bridge',
      downgrade_mutation_executed: false
    },
    job_policy: {
      future_scheduled_jobs_policy: policy.future_scheduled_jobs_policy,
      job_pause_resume_allowed: false,
      scheduler_mutation_executed: false,
      requires_operator_action: Boolean(policy.blocker)
    },
    blockers,
    warnings,
    next_operator_action: policy.next_operator_action,
    gates: {
      payment_provider_connected: false,
      subscription_webhook_connected: false,
      auth_behavior_changed: false,
      session_behavior_changed: false,
      production_account_created: false,
      production_auth_mutation_allowed: false,
      production_billing_mutation_allowed: false,
      job_pause_resume_allowed: false,
      webhook_email_allowed: false
    },
    guardrails: [
      'R10.3 maps account lifecycle state but does not connect a real payment provider.',
      'R10.3 does not change production auth/session behavior.',
      'R10.3 does not create production customer accounts.',
      'R10.3 does not pause, resume, cancel, or enqueue jobs.',
      'R10.3 preserves historical results and relies on R10.2 quota enforcement for over-quota additions.'
    ]
  };
}

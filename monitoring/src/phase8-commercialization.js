import { createHash } from 'node:crypto';

export const PHASE8_COMMERCIAL_CONTRACT_VERSION =
  'phase8-phase4-commercialization-v1';

export const PHASE4_FEATURE_KEYS = Object.freeze([
  'page_readiness',
  'company_intake',
  'evidence_prompt_discovery',
  'evidence_backlog',
  'remediation_tools',
  'report_qa'
]);

const ALL_ARTIFACTS = Object.freeze([
  'json_ld',
  'llms_txt',
  'geo_title_pack',
  'knowledge_base_draft'
]);

export const PHASE8_PHASE4_PLAN_MATRIX = Object.freeze({
  starter: Object.freeze({
    page_readiness: Object.freeze({ enabled: true, monthly_page_assessments: 10 }),
    company_intake: Object.freeze({ enabled: true, max_source_pages: 3, brands: 1 }),
    evidence_prompt_discovery: Object.freeze({ enabled: true, candidate_limit: 44 }),
    evidence_backlog: Object.freeze({ enabled: true, active_item_limit: 30 }),
    remediation_tools: Object.freeze({
      enabled: true,
      monthly_artifact_versions: 4,
      artifact_types: ALL_ARTIFACTS,
      real_publish_included: false
    }),
    report_qa: Object.freeze({ enabled: true, monthly_questions: 50 })
  }),
  pro: Object.freeze({
    page_readiness: Object.freeze({ enabled: true, monthly_page_assessments: 30 }),
    company_intake: Object.freeze({ enabled: true, max_source_pages: 3, brands: 1 }),
    evidence_prompt_discovery: Object.freeze({ enabled: true, candidate_limit: 66 }),
    evidence_backlog: Object.freeze({ enabled: true, active_item_limit: 100 }),
    remediation_tools: Object.freeze({
      enabled: true,
      monthly_artifact_versions: 16,
      artifact_types: ALL_ARTIFACTS,
      real_publish_included: false
    }),
    report_qa: Object.freeze({ enabled: true, monthly_questions: 250 })
  }),
  god: Object.freeze({
    page_readiness: Object.freeze({ enabled: true, monthly_page_assessments: 100 }),
    company_intake: Object.freeze({ enabled: true, max_source_pages: 3, brands: 1 }),
    evidence_prompt_discovery: Object.freeze({ enabled: true, candidate_limit: 104 }),
    evidence_backlog: Object.freeze({ enabled: true, active_item_limit: 300 }),
    remediation_tools: Object.freeze({
      enabled: true,
      monthly_artifact_versions: 50,
      artifact_types: ALL_ARTIFACTS,
      real_publish_included: false
    }),
    report_qa: Object.freeze({ enabled: true, monthly_questions: 1000 })
  })
});

function required(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function activeSubscription(status) {
  return ['active', 'trialing', 'comped'].includes(String(status || '').toLowerCase());
}

export function buildPhase8Phase4PlanContract(planCode) {
  const featureContract = PHASE8_PHASE4_PLAN_MATRIX[planCode];
  if (!featureContract) throw new RangeError(`unsupported planCode: ${planCode}`);
  return Object.freeze({
    schema_version: 'phase8-phase4-plan-contract-v1',
    contract_version: PHASE8_COMMERCIAL_CONTRACT_VERSION,
    plan_code: planCode,
    feature_contract: featureContract,
    enabled_features: Object.freeze(
      PHASE4_FEATURE_KEYS.filter((key) => featureContract[key]?.enabled === true)
    ),
    external_crawl_requires_live_gate: true,
    geoflow_dispatch_requires_live_gate: true,
    real_publish_requires_per_order_approval: true,
    commercial_activation_allowed: false,
    contract_sha256: sha256({ planCode, featureContract })
  });
}

export function buildPhase8BillingEntitlementCommand({
  customerId,
  planCode,
  subscriptionStatus,
  subscriptionRef,
  billingEventRef
} = {}) {
  const contract = buildPhase8Phase4PlanContract(planCode);
  const granted = activeSubscription(subscriptionStatus);
  const features = Object.fromEntries(
    PHASE4_FEATURE_KEYS.map((key) => [`${key}_enabled`, granted && contract.feature_contract[key].enabled])
  );
  return Object.freeze({
    schema_version: 'phase8-billing-phase4-entitlement-command-v1',
    contract_version: PHASE8_COMMERCIAL_CONTRACT_VERSION,
    customer_id: required(customerId, 'customerId'),
    plan_code: planCode,
    subscription_status: required(subscriptionStatus, 'subscriptionStatus').toLowerCase(),
    subscription_ref: required(subscriptionRef, 'subscriptionRef'),
    billing_event_ref: required(billingEventRef, 'billingEventRef'),
    entitlement_source: 'plan',
    status: granted ? 'grant' : 'revoke',
    idempotency_key: `phase8-entitlement:${billingEventRef}`,
    features: Object.freeze(features),
    quotas: contract.feature_contract,
    database_apply_allowed: false,
    reason: 'phase8_live_and_production_migration_frozen'
  });
}

export function buildPhase8ServiceWiringPlan({
  customerId,
  brandId,
  planCode,
  approvedFactIds = [],
  intakeId = 'pending',
  externalCrawlApproved = false,
  geoFlowDispatchApproved = false,
  realPublishApproved = false
} = {}) {
  const contract = buildPhase8Phase4PlanContract(planCode);
  const identity = {
    customer_id: required(customerId, 'customerId'),
    brand_id: required(brandId, 'brandId'),
    intake_id: required(intakeId, 'intakeId')
  };
  const approvedFacts = Object.freeze([...new Set(approvedFactIds.map(String))].sort());
  const stages = Object.freeze([
    Object.freeze({
      stage: 'company_page_acquisition',
      target: 'phase4_company_intakes.source_pages',
      mode: externalCrawlApproved ? 'live_gate_required' : 'snapshot_or_fixture_only',
      apply_allowed: false
    }),
    Object.freeze({
      stage: 'approved_intake_projection',
      targets: Object.freeze([
        'brands.brand_profile',
        'phase8_customer_knowledge_chunks',
        'prompt_seeds',
        'phase8_geoflow_materials'
      ]),
      approved_fact_ids: approvedFacts,
      human_review_required: true,
      apply_allowed: false
    }),
    Object.freeze({
      stage: 'evidence_backlog_to_geoflow',
      source: 'phase4_geoflow_backlog_items',
      target: 'article_production_handoffs',
      mode: geoFlowDispatchApproved ? 'live_gate_required' : 'dry_run_only',
      apply_allowed: false
    }),
    Object.freeze({
      stage: 'reviewed_artifact_publication',
      source: 'phase4_artifact_versions',
      target: 'customer_site_or_cms',
      mode: realPublishApproved ? 'per_order_gate_required' : 'published_dry_run_only',
      apply_allowed: false
    }),
    Object.freeze({
      stage: 'aivgl_retest_and_customer_report',
      source: 'retest_handoff',
      target: 'customer_dashboard_report',
      mode: 'requires_observed_post_publish_evidence',
      apply_allowed: false
    })
  ]);
  return Object.freeze({
    schema_version: 'phase8-phase4-service-wiring-plan-v1',
    contract_version: PHASE8_COMMERCIAL_CONTRACT_VERSION,
    ...identity,
    plan_code: planCode,
    plan_contract_sha256: contract.contract_sha256,
    stages,
    production_writes_performed: 0,
    external_calls_performed: 0,
    real_publish_performed: false,
    geoflow_dispatch_performed: false,
    status: 'PHASE8_SERVICE_WIRING_DRY_RUN_COMPLETE_LIVE_FROZEN'
  });
}

export function evaluatePhase8RealOrderAcceptance({
  orderId,
  paymentVerified = false,
  entitlementApplied = false,
  realSiteCrawlVerified = false,
  intakeProjectionVerified = false,
  humanReviewVerified = false,
  geoFlowExecutionVerified = false,
  realPublishVerified = false,
  aivglRetestVerified = false,
  customerReportVerified = false,
  rollbackVerified = false,
  evidenceRefs = []
} = {}) {
  required(orderId, 'orderId');
  const checks = Object.freeze({
    payment_verified: paymentVerified,
    entitlement_applied: entitlementApplied,
    real_site_crawl_verified: realSiteCrawlVerified,
    intake_projection_verified: intakeProjectionVerified,
    human_review_verified: humanReviewVerified,
    geoflow_execution_verified: geoFlowExecutionVerified,
    real_publish_verified: realPublishVerified,
    aivgl_retest_verified: aivglRetestVerified,
    customer_report_verified: customerReportVerified,
    rollback_verified: rollbackVerified
  });
  const blockers = Object.entries(checks)
    .filter(([, passed]) => passed !== true)
    .map(([key]) => key.replace(/_verified$|_applied$/u, '') + '_missing');
  const refs = [...new Set(evidenceRefs.filter(Boolean).map(String))].sort();
  if (!refs.length) blockers.push('acceptance_evidence_missing');
  return Object.freeze({
    schema_version: 'phase8-real-order-acceptance-v1',
    order_id: orderId,
    authoritative: blockers.length === 0,
    status: blockers.length ? 'COMMERCIAL_BLOCKED' : 'PHASE8_REAL_ORDER_ACCEPTED',
    checks,
    evidence_refs: Object.freeze(refs),
    blockers: Object.freeze(blockers.sort())
  });
}

export function buildPhase8CommercializationReadiness({
  planCatalog,
  billingCommand,
  serviceWiring,
  orderAcceptance
} = {}) {
  const blockers = [];
  const plans = planCatalog?.plans || [];
  for (const planCode of Object.keys(PHASE8_PHASE4_PLAN_MATRIX)) {
    const plan = plans.find((item) => item.plan_code === planCode);
    if (!plan?.phase4_service_contract) blockers.push(`${planCode}_phase4_contract_missing`);
  }
  if (billingCommand?.schema_version !== 'phase8-billing-phase4-entitlement-command-v1') {
    blockers.push('billing_entitlement_command_missing');
  }
  if (serviceWiring?.schema_version !== 'phase8-phase4-service-wiring-plan-v1') {
    blockers.push('service_wiring_plan_missing');
  }
  if (orderAcceptance?.status !== 'COMMERCIAL_BLOCKED') {
    blockers.push('fixture_order_must_remain_commercial_blocked');
  }
  return Object.freeze({
    schema_version: 'phase8-phase4-commercialization-readiness-v1',
    status: blockers.length
      ? 'PHASE8_COMMERCIALIZATION_ENGINEERING_BLOCKED'
      : 'PHASE8_COMMERCIALIZATION_ENGINEERING_COMPLETE_LIVE_FROZEN',
    engineering_complete: blockers.length === 0,
    commercial_launch_allowed: false,
    production_apply_allowed: false,
    blockers: Object.freeze(blockers.sort())
  });
}

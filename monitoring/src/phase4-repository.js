import { pool } from './db.js';
import { withTransaction } from './db-transaction.js';
import { answerReportQuestion, runPhase4DarkLoop } from './phase4-product-loop.js';

const ENTITLEMENT_FIELDS = [
  'page_readiness_enabled',
  'company_intake_enabled',
  'evidence_prompt_discovery_enabled',
  'evidence_backlog_enabled',
  'remediation_tools_enabled',
  'report_qa_enabled'
];

function json(value) {
  return JSON.stringify(value ?? {});
}

function enabledFeatures(entitlement = {}) {
  return ENTITLEMENT_FIELDS.filter((field) => entitlement[field] === true);
}

export function buildPhase4Entitlement(entitlement = null) {
  const normalized = Object.fromEntries(
    ENTITLEMENT_FIELDS.map((field) => [field, entitlement?.[field] === true])
  );
  const enabled = enabledFeatures(normalized);
  return {
    schema_version: 'phase4-customer-entitlement-v1',
    ...normalized,
    entitlement_source: entitlement?.entitlement_source || 'not_entitled',
    status: enabled.length === ENTITLEMENT_FIELDS.length
      ? 'entitled'
      : enabled.length
        ? 'partially_entitled'
        : 'not_entitled',
    enabled_features: enabled,
    missing_features: ENTITLEMENT_FIELDS.filter((field) => !enabled.includes(field)),
    live_transport_allowed: false,
    real_publish_allowed: false
  };
}

export function evidenceOnlyPromptDiscovery(payload) {
  if (!payload) return null;
  const candidates = (payload.candidates || []).map((candidate) => {
    const metricEvidence = Array.isArray(candidate.metric_evidence)
      ? candidate.metric_evidence.filter((item) => item.provider && item.collected_at && item.sample_scope)
      : [];
    const priority = metricEvidence.length && Number.isFinite(Number(candidate.evidence_priority))
      ? Number(candidate.evidence_priority)
      : null;
    return {
      ...candidate,
      priority_score: priority,
      priority_band: priority === null ? 'Unavailable' : priority >= 75 ? 'High' : priority >= 55 ? 'Medium' : 'Low',
      priority_status: priority === null ? 'unavailable' : 'available',
      score_version: priority === null ? null : 'phase4-evidence-priority-v1',
      score_components: priority === null ? null : candidate.score_components,
      commercial_intent: metricEvidence.some((item) => item.metric === 'commercial')
        ? candidate.commercial_intent
        : 'Unavailable',
      metric_evidence: metricEvidence,
      scoring_notice: priority === null
        ? 'No qualifying real metric evidence is available; no score is shown.'
        : 'Priority is calculated only from timestamped provider evidence.'
    };
  });
  return {
    ...payload,
    schema_version: 'phase4-evidence-only-prompt-discovery-v1',
    candidates,
    scoring_contract: {
      synthetic_template_scores_allowed: false,
      hash_scores_allowed: false,
      missing_metrics_display: 'unavailable',
      allowed_providers: ['gsc', 'dataforseo', 'serp', 'aivgl_observation', 'site_coverage', 'competitor_gap']
    }
  };
}

async function resolveWorkspace(input, client) {
  const values = [];
  let predicate;
  if (input.brand_id) {
    values.push(input.brand_id);
    predicate = `b.id=$${values.length}`;
  } else if (input.run_id) {
    values.push(input.run_id);
    predicate = `EXISTS (SELECT 1 FROM tracking_runs tr WHERE tr.id=$${values.length} AND tr.brand_id=b.id)`;
  } else if (input.brand_name) {
    values.push(input.brand_name);
    predicate = `LOWER(b.name)=LOWER($${values.length})`;
  } else {
    return null;
  }
  const result = await client.query(
    `SELECT b.id AS brand_id, b.customer_id, b.name AS brand_name, b.website_url,
            c.external_customer_id,
            c.id AS tenant_id
       FROM brands b
       JOIN customers c ON c.id=b.customer_id
      WHERE ${predicate}
      ORDER BY b.updated_at DESC
      LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

async function latestJson(client, sql, values, field) {
  const result = await client.query(sql, values);
  return result.rows[0]?.[field] || null;
}

export async function getPhase4DashboardPayload(input = {}, client = pool) {
  const workspace = await resolveWorkspace(input, client);
  if (!workspace) return null;
  const [entitlementRow, intake, readiness, discovery, backlog, artifacts, conversations, audit] = await Promise.all([
    client.query(`SELECT * FROM phase4_customer_entitlements WHERE customer_id=$1`, [workspace.customer_id]),
    latestJson(client, `SELECT jsonb_build_object('id',id,'status',status,'facts',facts,'destinations',destinations,'updated_at',updated_at) AS payload FROM phase4_company_intakes WHERE tenant_id=$1 AND brand_id=$2 ORDER BY updated_at DESC LIMIT 1`, [workspace.tenant_id, workspace.brand_id], 'payload'),
    latestJson(client, `SELECT assessment AS payload FROM phase4_page_readiness_snapshots WHERE tenant_id=$1 AND brand_id=$2 ORDER BY created_at DESC LIMIT 1`, [workspace.tenant_id, workspace.brand_id], 'payload'),
    latestJson(client, `SELECT jsonb_build_object('dimensions',dimensions,'candidates',candidates,'created_at',created_at) AS payload FROM phase4_prompt_discovery_snapshots WHERE tenant_id=$1 AND brand_id=$2 ORDER BY created_at DESC LIMIT 1`, [workspace.tenant_id, workspace.brand_id], 'payload'),
    client.query(`SELECT item_payload FROM phase4_geoflow_backlog_items WHERE tenant_id=$1 AND brand_id=$2 ORDER BY created_at DESC LIMIT 100`, [workspace.tenant_id, workspace.brand_id]),
    client.query(`SELECT artifact_type,version_number,state,content_sha256,review_payload,created_at FROM phase4_artifact_versions WHERE tenant_id=$1 AND brand_id=$2 ORDER BY created_at DESC LIMIT 40`, [workspace.tenant_id, workspace.brand_id]),
    client.query(`SELECT id,title,export_enabled,created_at,updated_at FROM phase4_report_conversations WHERE tenant_id=$1 AND brand_id=$2 ORDER BY updated_at DESC LIMIT 20`, [workspace.tenant_id, workspace.brand_id]),
    client.query(`SELECT action,actor,resource_type,resource_id,evidence_refs,created_at FROM phase4_audit_events WHERE tenant_id=$1 AND brand_id=$2 ORDER BY created_at DESC LIMIT 30`, [workspace.tenant_id, workspace.brand_id])
  ]);
  return {
    schema_version: 'phase4-cowtech-dashboard-v1',
    workspace: {
      tenant_id: workspace.tenant_id,
      customer_id: workspace.customer_id,
      brand_id: workspace.brand_id,
      brand_name: workspace.brand_name,
      website_url: workspace.website_url
    },
    entitlement: buildPhase4Entitlement(entitlementRow.rows[0]),
    modules: {
      company_intake: intake,
      page_readiness: readiness,
      prompt_discovery: discovery,
      geoflow_backlog: backlog.rows.map((row) => row.item_payload),
      remediation_artifacts: artifacts.rows,
      report_conversations: conversations.rows
    },
    audit_events: audit.rows,
    safety: {
      external_calls_executed: false,
      real_publish_executed: false,
      live_transport_allowed: false
    }
  };
}

export async function recordPhase4AuditEvent(event, client = pool) {
  const result = await client.query(
    `INSERT INTO phase4_audit_events (
       tenant_id,customer_id,brand_id,action,actor,resource_type,resource_id,
       before_payload,after_payload,evidence_refs,metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb)
     RETURNING *`,
    [
      event.tenant_id,
      event.customer_id || null,
      event.brand_id || null,
      event.action,
      event.actor,
      event.resource_type,
      event.resource_id || null,
      json(event.before_payload),
      json(event.after_payload),
      JSON.stringify(event.evidence_refs || []),
      json(event.metadata)
    ]
  );
  return result.rows[0];
}

export async function setPhase4CustomerEntitlement(input, { actor, client = pool } = {}) {
  if (!input.customer_id) {
    throw Object.assign(new Error('phase4_customer_required'), { code: 'phase4_customer_required' });
  }
  if (!actor) {
    throw Object.assign(new Error('phase4_entitlement_actor_required'), { code: 'phase4_entitlement_actor_required' });
  }
  const transactionOptions = typeof client.connect === 'function' ? { pool: client } : { client };
  return withTransaction(transactionOptions, async (transactionClient) => {
    const beforeResult = await transactionClient.query(
      `SELECT * FROM phase4_customer_entitlements WHERE customer_id=$1 FOR UPDATE`,
      [input.customer_id]
    );
    const source = input.entitlement_source || 'admin_override';
    const values = ENTITLEMENT_FIELDS.map((field) => input[field] === true);
    const result = await transactionClient.query(
      `INSERT INTO phase4_customer_entitlements(
         customer_id,${ENTITLEMENT_FIELDS.join(',')},entitlement_source,metadata
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT(customer_id) DO UPDATE SET
         ${ENTITLEMENT_FIELDS.map((field, index) => `${field}=$${index + 2}`).join(',')},
         entitlement_source=$8,metadata=$9::jsonb,updated_at=NOW()
       RETURNING *`,
      [input.customer_id, ...values, source, JSON.stringify(input.metadata || {})]
    );
    const customer = await transactionClient.query(
      `SELECT id,external_customer_id FROM customers WHERE id=$1`,
      [input.customer_id]
    );
    await recordPhase4AuditEvent({
      tenant_id: input.customer_id,
      customer_id: input.customer_id,
      brand_id: input.brand_id || null,
      action: 'phase4_entitlement_updated',
      actor,
      resource_type: 'phase4_customer_entitlement',
      resource_id: input.customer_id,
      before_payload: buildPhase4Entitlement(beforeResult.rows[0]),
      after_payload: buildPhase4Entitlement(result.rows[0]),
      metadata: {
        external_customer_id: customer.rows[0]?.external_customer_id || null,
        entitlement_source: source
      }
    }, transactionClient);
    return buildPhase4Entitlement(result.rows[0]);
  });
}

export async function createPhase4ReportAnswer(input, { actor = 'customer_dashboard', client = pool } = {}) {
  const workspace = await resolveWorkspace(input, client);
  if (!workspace) throw Object.assign(new Error('phase4_workspace_not_found'), { code: 'phase4_workspace_not_found' });
  const entitlementResult = await client.query(
    `SELECT * FROM phase4_customer_entitlements WHERE customer_id=$1`,
    [workspace.customer_id]
  );
  if (!buildPhase4Entitlement(entitlementResult.rows[0]).report_qa_enabled) {
    throw Object.assign(new Error('phase4_report_qa_entitlement_required'), { code: 'phase4_report_qa_entitlement_required' });
  }
  const transactionOptions = typeof client.connect === 'function' ? { pool: client } : { client };
  return withTransaction(transactionOptions, async (transactionClient) => {
    let conversationId = input.conversation_id || null;
    if (conversationId) {
      const existing = await transactionClient.query(
        `SELECT id FROM phase4_report_conversations WHERE id=$1 AND tenant_id=$2 AND brand_id=$3`,
        [conversationId, workspace.tenant_id, workspace.brand_id]
      );
      if (!existing.rowCount) {
        throw Object.assign(new Error('phase4_conversation_not_found'), { code: 'phase4_conversation_not_found' });
      }
    } else {
      const created = await transactionClient.query(
        `INSERT INTO phase4_report_conversations(tenant_id,brand_id,title)
         VALUES($1,$2,$3) RETURNING id`,
        [workspace.tenant_id, workspace.brand_id, String(input.question || '').slice(0, 120)]
      );
      conversationId = created.rows[0].id;
    }
    const messageRows = await transactionClient.query(
      `SELECT role,content,citations FROM phase4_report_messages
       WHERE conversation_id=$1 AND tenant_id=$2 ORDER BY created_at`,
      [conversationId, workspace.tenant_id]
    );
    const readinessRow = await transactionClient.query(
      `SELECT assessment FROM phase4_page_readiness_snapshots
       WHERE tenant_id=$1 AND brand_id=$2 ORDER BY created_at DESC LIMIT 1`,
      [workspace.tenant_id, workspace.brand_id]
    );
    const backlogRows = await transactionClient.query(
      `SELECT item_key,item_payload FROM phase4_geoflow_backlog_items
       WHERE tenant_id=$1 AND brand_id=$2 ORDER BY created_at DESC LIMIT 100`,
      [workspace.tenant_id, workspace.brand_id]
    );
    const readiness = readinessRow.rows[0]?.assessment;
    const contextDocuments = [
      ...(readiness?.recommendations || []).map((item) => ({
        id: `readiness:${item.rule}`,
        tenant_id: workspace.tenant_id,
        source_type: 'page_readiness',
        source_ref: item.rule,
        text: item.recommendation,
        evidence_sha256: item.evidence_sha256
      })),
      ...backlogRows.rows.map((row) => ({
        id: `backlog:${row.item_key}`,
        tenant_id: workspace.tenant_id,
        source_type: 'geoflow_backlog',
        source_ref: row.item_key,
        text: `${row.item_payload.priority || 'pending'} priority: ${row.item_payload.title}. Acceptance: ${row.item_payload.acceptance_metric || 'pending'}`,
        evidence_sha256: row.item_payload.evidence_refs?.[0]
      }))
    ];
    const response = answerReportQuestion({
      tenantId: workspace.tenant_id,
      conversationId,
      question: input.question,
      contextDocuments,
      history: messageRows.rows.map((row) => ({
        role: row.role,
        content: row.content,
        citations: row.citations
      }))
    });
    await transactionClient.query(
      `INSERT INTO phase4_report_messages(conversation_id,tenant_id,role,content,citations)
       VALUES($1,$2,'user',$3,'[]'::jsonb),($1,$2,'assistant',$4,$5::jsonb)`,
      [conversationId, workspace.tenant_id, input.question, response.answer, JSON.stringify(response.citations)]
    );
    await transactionClient.query(
      `UPDATE phase4_report_conversations SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
      [conversationId, workspace.tenant_id]
    );
    await recordPhase4AuditEvent({
      tenant_id: workspace.tenant_id,
      customer_id: workspace.customer_id,
      brand_id: workspace.brand_id,
      action: 'phase4_report_question_answered',
      actor,
      resource_type: 'phase4_report_conversation',
      resource_id: conversationId,
      after_payload: {
        status: response.status,
        citation_count: response.citations.length,
        suggested_task_status: response.suggested_task?.status || null
      },
      evidence_refs: response.citations.map((citation) => citation.evidence_sha256)
    }, transactionClient);
    return response;
  });
}

export async function persistPhase4DarkLoop(input, { actor = 'customer_dashboard', client = pool } = {}) {
  const workspace = await resolveWorkspace(input, client);
  if (!workspace) throw Object.assign(new Error('phase4_workspace_not_found'), { code: 'phase4_workspace_not_found' });
  const entitlementResult = await client.query(
    `SELECT * FROM phase4_customer_entitlements WHERE customer_id=$1`,
    [workspace.customer_id]
  );
  const entitlement = buildPhase4Entitlement(entitlementResult.rows[0]);
  if (entitlement.status !== 'entitled') {
    throw Object.assign(new Error('phase4_entitlement_required'), { code: 'phase4_entitlement_required' });
  }
  const flags = await client.query(`SELECT * FROM phase4_feature_flags WHERE scope_key='global'`);
  if (!flags.rows[0]?.dry_run_execution_enabled) {
    throw Object.assign(new Error('phase4_dry_run_feature_disabled'), { code: 'phase4_dry_run_feature_disabled' });
  }
  const result = runPhase4DarkLoop({
    tenantId: workspace.tenant_id,
    brandId: workspace.brand_id,
    pages: input.pages,
    metricEvidence: input.metric_evidence || [],
    observations: input.observations || [],
    plan: input.plan || {},
    reviewerId: input.reviewer_id || actor
  });
  const transactionOptions = typeof client.connect === 'function' ? { pool: client } : { client };
  await withTransaction(transactionOptions, async (transactionClient) => {
    const intake = result.stages.intake;
    await transactionClient.query(
      `INSERT INTO phase4_company_intakes(tenant_id,brand_id,status,source_pages,facts,destinations)
       VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)`,
      [workspace.tenant_id, workspace.brand_id, intake.status, JSON.stringify(input.pages.map((page) => ({ final_url: page.final_url, fetched_at: page.fetched_at, content_sha256: page.content_sha256 }))), JSON.stringify(intake.facts), JSON.stringify(intake.destinations)]
    );
    const readiness = result.stages.readiness;
    await transactionClient.query(
      `INSERT INTO phase4_page_readiness_snapshots(tenant_id,brand_id,page_url,score,snapshot_sha256,assessment)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
      [workspace.tenant_id, workspace.brand_id, readiness.url, readiness.score, readiness.source_snapshot.snapshot_sha256, JSON.stringify(readiness)]
    );
    const discovery = result.stages.prompt_discovery;
    await transactionClient.query(
      `INSERT INTO phase4_prompt_discovery_snapshots(tenant_id,brand_id,dimensions,candidates,metric_evidence)
       VALUES($1,$2,$3::jsonb,$4::jsonb,$5::jsonb)`,
      [workspace.tenant_id, workspace.brand_id, JSON.stringify(discovery.dimensions), JSON.stringify(discovery.candidates), JSON.stringify(input.metric_evidence || [])]
    );
    for (const item of result.stages.backlog.items) {
      await transactionClient.query(
        `INSERT INTO phase4_geoflow_backlog_items(tenant_id,brand_id,item_key,item_payload,state)
         VALUES($1,$2,$3,$4::jsonb,'draft')
         ON CONFLICT(tenant_id,brand_id,item_key) DO UPDATE SET item_payload=EXCLUDED.item_payload,updated_at=NOW()`,
        [workspace.tenant_id, workspace.brand_id, item.id, JSON.stringify(item)]
      );
    }
    for (const artifact of result.stages.artifacts) {
      await transactionClient.query(
        `INSERT INTO phase4_artifact_versions(tenant_id,brand_id,artifact_type,version_number,state,content,content_sha256,review_payload)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
         ON CONFLICT(tenant_id,brand_id,artifact_type,version_number) DO UPDATE SET state=EXCLUDED.state,content=EXCLUDED.content,content_sha256=EXCLUDED.content_sha256,review_payload=EXCLUDED.review_payload`,
        [workspace.tenant_id, workspace.brand_id, artifact.type, artifact.version, artifact.state, artifact.content, artifact.content_sha256, JSON.stringify({ history: artifact.history, validation: artifact.validation })]
      );
    }
    await recordPhase4AuditEvent({
      tenant_id: workspace.tenant_id,
      customer_id: workspace.customer_id,
      brand_id: workspace.brand_id,
      action: 'phase4_dark_loop_persisted',
      actor,
      resource_type: 'phase4_workspace',
      resource_id: workspace.brand_id,
      after_payload: {
        readiness_score: readiness.score,
        candidate_count: discovery.candidates.length,
        backlog_count: result.stages.backlog.items.length,
        artifact_count: result.stages.artifacts.length
      },
      evidence_refs: readiness.evidence.map((item) => item.source.evidence_sha256),
      metadata: { external_calls_executed: false, real_publish_executed: false }
    }, transactionClient);
  });
  return result;
}

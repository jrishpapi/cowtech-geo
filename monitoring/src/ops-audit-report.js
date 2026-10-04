import { createHash } from 'node:crypto';
import { getOpsAuditLog } from './ops-audit-log.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function reportDigest(input) {
  return createHash('sha256').update(stableJson(input)).digest('hex');
}

function filterEntries(filters = {}) {
  return Object.entries(filters).filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== 'all');
}

function summarizeDateRange(events = []) {
  const timestamps = events.map((event) => new Date(event.at)).filter((date) => !Number.isNaN(date.getTime()));
  if (!timestamps.length) return { from: null, to: null };
  const sorted = timestamps.sort((a, b) => a - b);
  return {
    from: sorted[0].toISOString(),
    to: sorted[sorted.length - 1].toISOString()
  };
}

export function buildOpsAuditComplianceReport(auditLog, { requestedBy = null } = {}) {
  const requestedAt = new Date().toISOString();
  const eventDigest = reportDigest(
    (auditLog.events || []).map((event) => ({
      event_id: event.event_id,
      at: event.at,
      category: event.category,
      action: event.action,
      actor: event.actor,
      from: event.from,
      to: event.to,
      target: event.payload_summary?.target_username || event.ids?.publish_handoff_id || null
    }))
  );
  const reportInput = {
    schema_version: 'phase4-ops-audit-compliance-report-v1',
    requested_at: requestedAt,
    requested_by: requestedBy?.username ? `${requestedBy.username}:${requestedBy.role}` : null,
    filters: auditLog.filters,
    retention: auditLog.retention,
    generated_audit_at: auditLog.generated_at,
    event_count: auditLog.events?.length || 0,
    event_digest: eventDigest
  };
  const reportHash = reportDigest(reportInput);

  return {
    ...reportInput,
    report_id: `audit-report-${reportHash.slice(0, 16)}`,
    report_hash: reportHash,
    event_digest: eventDigest,
    date_range: summarizeDateRange(auditLog.events || []),
    summary: auditLog.summary,
    totals: {
      total_before_filters: auditLog.total_before_filters,
      total_after_filters: auditLog.total_after_filters,
      included_events: auditLog.events?.length || 0
    },
    export_metadata: {
      ...auditLog.export_metadata,
      compliance_watermark: 'internal_ops_audit_compliance_report'
    },
    events: auditLog.events || [],
    guardrails: [
      'This report is generated from the internal ops audit API using the visible filters and retention policy.',
      'The report hash covers report metadata and event digest so exported copies can be compared later.',
      'Password hashes, plaintext passwords, and full article bodies are intentionally excluded.'
    ]
  };
}

function fact(label, value) {
  return `
    <div class="fact">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || 'Not set')}</strong>
    </div>
  `;
}

function tableRow(event) {
  return `
    <tr>
      <td>${escapeHtml(event.at)}</td>
      <td>${escapeHtml(event.category)}</td>
      <td>${escapeHtml(event.action)}</td>
      <td>${escapeHtml(event.actor)}</td>
      <td>${escapeHtml(event.from || '')}</td>
      <td>${escapeHtml(event.to || '')}</td>
      <td>${escapeHtml(event.payload_summary?.target_username || event.ids?.publish_handoff_id || '')}</td>
      <td>${escapeHtml(event.brand?.name || '')}</td>
      <td>${escapeHtml(event.article?.title || '')}</td>
      <td>${escapeHtml(event.event_id)}</td>
    </tr>
  `;
}

export function buildOpsAuditComplianceReportHtml(report) {
  const filters = filterEntries(report.filters);
  const filterText = filters.length ? filters.map(([key, value]) => `${key}: ${value}`).join(' | ') : 'none';
  const rows = report.events.map(tableRow).join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ops Audit Compliance Report</title>
    <style>
      :root { color-scheme: light; font-family: Inter, Arial, sans-serif; color: #111813; background: #f7f5ee; }
      body { margin: 0; padding: 32px; }
      main { max-width: 1180px; margin: 0 auto; background: #fffdf7; border: 1px solid #d8d2c1; }
      header { padding: 28px; border-bottom: 1px solid #d8d2c1; }
      h1 { margin: 0; font-size: 32px; letter-spacing: 0; }
      .eyebrow { margin: 0 0 8px; text-transform: uppercase; font-size: 12px; font-weight: 800; color: #426b55; }
      .facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-bottom: 1px solid #d8d2c1; }
      .fact { padding: 16px; border-right: 1px solid #d8d2c1; }
      .fact:last-child { border-right: 0; }
      .fact span { display: block; text-transform: uppercase; font-size: 11px; font-weight: 800; color: #697469; }
      .fact strong { display: block; margin-top: 6px; overflow-wrap: anywhere; }
      section { padding: 22px 28px; border-bottom: 1px solid #d8d2c1; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border-bottom: 1px solid #e7e2d4; padding: 8px; text-align: left; vertical-align: top; }
      th { text-transform: uppercase; color: #697469; font-size: 10px; }
      .hash { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
      @media print {
        body { background: #fff; padding: 0; }
        main { border: 0; }
        .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">Internal Ops Audit</p>
        <h1>Compliance Report</h1>
      </header>
      <div class="facts">
        ${fact('Report ID', report.report_id)}
        ${fact('Requested by', report.requested_by)}
        ${fact('Requested at', report.requested_at)}
        ${fact('Events included', report.totals.included_events)}
        ${fact('Date from', report.date_range.from)}
        ${fact('Date to', report.date_range.to)}
        ${fact('Retention days', report.retention?.retention_days)}
        ${fact('Filters', filterText)}
      </div>
      <section>
        <h2>Integrity</h2>
        <p>Report hash</p>
        <p class="hash">${escapeHtml(report.report_hash)}</p>
        <p>Event digest</p>
        <p class="hash">${escapeHtml(report.event_digest)}</p>
        <p>Watermark: ${escapeHtml(report.export_metadata.compliance_watermark)}</p>
      </section>
      <section>
        <h2>Events</h2>
        <table>
          <thead>
            <tr>
              <th>At</th>
              <th>Category</th>
              <th>Action</th>
              <th>Actor</th>
              <th>From</th>
              <th>To</th>
              <th>Target</th>
              <th>Brand</th>
              <th>Article</th>
              <th>Event ID</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

export async function getOpsAuditComplianceReport(options = {}) {
  const auditLog = await getOpsAuditLog(options);
  return buildOpsAuditComplianceReport(auditLog, {
    requestedBy: options.export_actor || null
  });
}

import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import { pool } from './db.js';

const GOD_REPORT_TYPES = new Set(['competitor_deep_report', 'strategy_memo']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PDF_COLORS = {
  ink: '#17201b',
  forest: '#385642',
  teal: '#0f766e',
  muted: '#64716a',
  border: '#d8dfd9',
  paper: '#ffffff',
  wash: '#f7f8f4',
  amber: '#9a6b18',
  red: '#b42318'
};

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function textValue(value, fallback = '', maxLength = 4000) {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim().slice(0, maxLength);
  return text || fallback;
}

function markdownText(value) {
  return textValue(value).replace(/([\\`*_{}\[\]<>])/gu, '\\$1');
}

function markdownUrl(value) {
  const url = textValue(value);
  return /^https?:\/\//iu.test(url) ? url.replace(/[()\s]/gu, '') : '';
}

function label(value) {
  return textValue(value, 'not reported').replaceAll('_', ' ');
}

function scoreLine(name, card = {}) {
  const delta = card.delta_from_previous_run;
  const deltaLabel = delta === null || delta === undefined ? 'no prior-run comparison' : `${numberValue(delta) >= 0 ? '+' : ''}${numberValue(delta)} vs previous`;
  return `- **${name}:** ${numberValue(card.score)}/100 · ${label(card.band)} · ${label(card.direction)} · ${deltaLabel}`;
}

function evidenceLine(item = {}) {
  const parts = [
    item.model ? `${item.provider || 'provider'} / ${item.model}` : item.provider,
    item.category,
    item.brand_mentioned === true ? 'brand mentioned' : 'brand not mentioned',
    `${numberValue(item.competitor_mentions)} competitor mentions`,
    `${numberValue(item.source_url_count)} sources`
  ].filter(Boolean);
  return `${markdownText(item.prompt || 'Measured prompt')} — ${parts.join(' · ')}`;
}

function markdownHeader(payload) {
  const measurement = objectValue(payload.measurement);
  const scorecards = objectValue(payload.scorecards);
  const trend = objectValue(payload.trend);
  const brand = objectValue(payload.brand);
  const lines = [
    `# ${markdownText(payload.title || 'CowTech God Mode Report')}`,
    '',
    `> **Report state:** ${label(payload.status)} · **Generated:** ${markdownText(payload.generated_at || '')}`,
    '',
    markdownText(payload.executive_summary || ''),
    '',
    '## Executive scorecard',
    '',
    scoreLine('Visibility', scorecards.visibility),
    scoreLine('Source quality', scorecards.source_quality),
    scoreLine('Competitor pressure', scorecards.competitor_pressure),
    `- **Brand share of voice:** ${numberValue(trend.brand_share_of_voice)}%`,
    '',
    '## Measurement frame',
    '',
    `- **Brand:** ${markdownText(brand.name || 'Unknown brand')}`,
    `- **Website:** ${markdownUrl(brand.website_url) || 'not reported'}`,
    `- **Measurement mode:** ${label(measurement.mode)}`,
    `- **Score meaning:** ${label(measurement.score_meaning)}`,
    `- **Sample:** ${numberValue(measurement.parsed_answer_count)} parsed of ${numberValue(measurement.answer_count)} answer results`,
    `- **Coverage:** ${numberValue(measurement.model_count)} model rows across ${numberValue(measurement.category_count)} prompt categories`,
    `- **Average parser confidence:** ${numberValue(measurement.average_parser_confidence).toFixed(2)}`,
    ''
  ];

  if (payload.customer_delivery_ready !== true) {
    lines.push(
      '> **Evidence warning:** This report is not marked customer-delivery-ready. Read the measurement mode and guardrails before using its recommendations.',
      ''
    );
  }
  return lines;
}

function competitorMarkdown(payload) {
  const summary = objectValue(payload.competitive_summary);
  const lines = [
    '## Competitive pressure summary',
    '',
    `- **Configured competitors:** ${numberValue(summary.tracked_competitors)}`,
    `- **Brand mentions:** ${numberValue(summary.brand_mentions)}`,
    `- **Competitor mentions:** ${numberValue(summary.competitor_mentions)}`,
    `- **Competitor-owned sources:** ${numberValue(summary.competitor_sources)}`,
    `- **Brand share of voice:** ${numberValue(summary.brand_share_of_voice_percent)}%`,
    `- **Pressure:** ${numberValue(summary.pressure_score)}/100 · ${label(summary.pressure_band)}`,
    '',
    '## Competitor scoreboard',
    ''
  ];

  for (const competitor of arrayValue(payload.competitors).slice(0, 10)) {
    lines.push(
      `### ${numberValue(competitor.rank)}. ${markdownText(competitor.name)}`,
      '',
      `- Mentions: ${numberValue(competitor.mention_count)} across ${numberValue(competitor.mentioned_answer_count)} answers`,
      `- Answer coverage: ${numberValue(competitor.answer_coverage_percent)}%`,
      `- Share of voice: ${numberValue(competitor.share_of_voice_percent)}%`,
      `- Pressure level: ${label(competitor.pressure_level)}`,
      `- Evidence: ${markdownText(competitor.evidence_note)}`,
      competitor.website_url ? `- Website: ${markdownUrl(competitor.website_url)}` : '',
      ''
    );
  }

  lines.push('## Prompt-level evidence', '');
  const evidence = arrayValue(payload.evidence_highlights);
  if (!evidence.length) lines.push('- No customer-safe answer excerpt was available for this run.', '');
  for (const item of evidence.slice(0, 6)) {
    lines.push(`### ${evidenceLine(item)}`, '', `> ${markdownText(item.answer_excerpt || 'No excerpt available.')}`, '');
  }

  lines.push('## Priority gaps', '');
  for (const gap of arrayValue(payload.priority_gaps).slice(0, 5)) {
    lines.push(
      `### ${numberValue(gap.order)}. ${markdownText(gap.title)}`,
      '',
      `- Priority: ${label(gap.priority)}`,
      `- Recommended format: ${markdownText(gap.recommended_format || 'not specified')}`,
      `- Why it matters: ${markdownText(gap.description)}`,
      `- Success measure: ${markdownText(gap.success_measure)}`,
      '- Evidence:'
    );
    for (const evidenceItem of arrayValue(gap.evidence)) lines.push(`  - ${markdownText(evidenceItem)}`);
    lines.push('');
  }

  lines.push('## 90-day competitive action plan', '');
  for (const action of arrayValue(payload.action_plan).slice(0, 3)) {
    lines.push(
      `### ${label(action.phase)}`,
      '',
      `- **Priority:** ${label(action.priority)}`,
      `- **Owner:** ${markdownText(action.owner)}`,
      `- **Action:** ${markdownText(action.action)}`,
      `- **Deliverable:** ${markdownText(action.deliverable)}`,
      `- **Success metric:** ${markdownText(action.success_metric)}`,
      '- **Evidence basis:**'
    );
    for (const item of arrayValue(action.evidence_basis)) lines.push(`  - ${markdownText(item)}`);
    lines.push('');
  }
  return lines;
}

function strategyMarkdown(payload) {
  const brief = objectValue(payload.decision_brief);
  const lines = [
    '## Decision brief',
    '',
    `- **Current position:** ${markdownText(brief.current_position)}`,
    `- **Primary constraint:** ${markdownText(brief.primary_constraint)}`,
    `- **Strategic thesis:** ${markdownText(brief.strategic_thesis)}`,
    `- **First decision:** ${markdownText(brief.first_decision)}`,
    '',
    '## Strategic priorities',
    ''
  ];

  for (const priority of arrayValue(payload.strategic_priorities).slice(0, 3)) {
    lines.push(
      `### ${label(priority.priority)}`,
      '',
      `- Baseline: ${numberValue(priority.baseline)}/100 · ${label(priority.signal)}`,
      `- Objective: ${markdownText(priority.objective)}`,
      `- Deliverable: ${markdownText(priority.deliverable)}`,
      `- Success metric: ${markdownText(priority.success_metric)}`,
      '- Evidence:'
    );
    for (const item of arrayValue(priority.evidence)) lines.push(`  - ${markdownText(item)}`);
    if (arrayValue(priority.actions).length) {
      lines.push('- Actions:');
      for (const item of arrayValue(priority.actions)) lines.push(`  - ${markdownText(item)}`);
    }
    lines.push('');
  }

  lines.push('## Risk register', '');
  for (const risk of arrayValue(payload.risk_register).slice(0, 8)) {
    lines.push(
      `### ${label(risk.severity)} · ${markdownText(risk.risk)}`,
      '',
      `- Evidence: ${markdownText(risk.evidence)}`,
      `- Mitigation: ${markdownText(risk.mitigation)}`,
      ''
    );
  }

  lines.push('## 90-day operating roadmap', '');
  for (const phase of arrayValue(payload.roadmap_90_days).slice(0, 3)) {
    lines.push(
      `### ${label(phase.phase)}`,
      '',
      `- Objective: ${markdownText(phase.objective)}`,
      `- Owner: ${markdownText(phase.owner)}`,
      `- Deliverable: ${markdownText(phase.deliverable)}`,
      `- Success metric: ${markdownText(phase.success_metric)}`,
      '- Actions:'
    );
    for (const action of arrayValue(phase.actions)) lines.push(`  - ${markdownText(action)}`);
    lines.push('');
  }

  lines.push('## Evidence register', '');
  for (const evidence of arrayValue(payload.evidence_register).slice(0, 10)) {
    lines.push(
      `### ${markdownText(evidence.evidence_id)} · ${label(evidence.type)}`,
      '',
      `- Evidence: ${markdownText(evidence.statement)}`,
      `- Observation: ${markdownText(evidence.observation)}`,
      evidence.model ? `- Model: ${markdownText(evidence.model)}` : '',
      ''
    );
  }
  return lines;
}

function markdownFooter(payload) {
  const lines = ['## Methodology and claim boundary', ''];
  for (const item of arrayValue(payload.measurement?.methodology)) lines.push(`- ${markdownText(item)}`);
  for (const item of arrayValue(payload.guardrails)) lines.push(`- ${markdownText(item)}`);
  lines.push('', '---', '', 'Generated by CowTech AIVGL · God Mode executive reporting', '');
  return lines;
}

export function buildGodReportMarkdown(payload = {}) {
  if (!GOD_REPORT_TYPES.has(payload.deliverable_type)) {
    throw new Error('unsupported God report type');
  }
  const lines = [
    ...markdownHeader(payload),
    ...(payload.deliverable_type === 'competitor_deep_report' ? competitorMarkdown(payload) : strategyMarkdown(payload)),
    ...markdownFooter(payload)
  ];
  return `${lines.filter((line) => line !== undefined).join('\n').replace(/\n{4,}/gu, '\n\n\n').trim()}\n`;
}

function pdfFont() {
  const candidates = [
    process.env.GOD_REPORT_PDF_FONT,
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function registerPdfFont(doc) {
  const font = pdfFont();
  if (!font) {
    throw new Error('God report PDF font is not installed; refusing to generate a potentially corrupted PDF.');
  }
  if (font.endsWith('.ttc')) {
    doc.registerFont('CowTechReport', font, 'WenQuanYiZenHei');
  } else {
    doc.registerFont('CowTechReport', font);
  }
  return 'CowTechReport';
}

function addPageBackground(doc) {
  doc.save().rect(0, 0, doc.page.width, doc.page.height).fill(PDF_COLORS.paper).restore();
  doc.save().rect(0, 0, 10, doc.page.height).fill(PDF_COLORS.teal).restore();
}

function ensureSpace(doc, height, fontName) {
  if (doc.y + height < doc.page.height - 58) return;
  doc.addPage();
  doc.font(fontName).fillColor(PDF_COLORS.ink);
}

function pdfSection(doc, title, fontName) {
  ensureSpace(doc, 58, fontName);
  doc.x = doc.page.margins.left;
  doc.moveDown(0.6);
  doc.font(fontName).fontSize(8).fillColor(PDF_COLORS.teal).text('COWTECH · GOD MODE', { characterSpacing: 1.2 });
  doc.moveDown(0.25).fontSize(18).fillColor(PDF_COLORS.ink).text(textValue(title));
  doc.moveDown(0.25).strokeColor(PDF_COLORS.border).lineWidth(1).moveTo(doc.x, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
  doc.moveDown(0.6);
}

function pdfParagraph(doc, text, fontName, options = {}) {
  const body = textValue(text);
  if (!body) return;
  ensureSpace(doc, 44, fontName);
  doc.font(fontName).fontSize(options.size || 9.5).fillColor(options.color || PDF_COLORS.forest).text(body, {
    lineGap: options.lineGap ?? 3,
    paragraphGap: options.paragraphGap ?? 7,
    align: options.align || 'left'
  });
  doc.x = doc.page.margins.left;
}

function pdfBullet(doc, text, fontName, options = {}) {
  const body = textValue(text);
  if (!body) return;
  ensureSpace(doc, 32, fontName);
  const x = doc.x;
  const y = doc.y;
  doc.save().circle(x + 3, y + 6, 2).fill(options.dotColor || PDF_COLORS.teal).restore();
  doc.font(fontName).fontSize(options.size || 9).fillColor(options.color || PDF_COLORS.forest).text(body, x + 13, y, {
    width: doc.page.width - (x + 13) - 48,
    lineGap: 2.5,
    paragraphGap: 4
  });
  doc.x = doc.page.margins.left;
}

function pdfSubheading(doc, text, fontName, meta = '') {
  ensureSpace(doc, 48, fontName);
  doc.font(fontName).fontSize(12.5).fillColor(PDF_COLORS.ink).text(textValue(text));
  if (meta) doc.moveDown(0.12).fontSize(8.5).fillColor(PDF_COLORS.muted).text(textValue(meta));
  doc.moveDown(0.35);
  doc.x = doc.page.margins.left;
}

function drawScorecards(doc, payload, fontName) {
  ensureSpace(doc, 98, fontName);
  const cards = objectValue(payload.scorecards);
  const entries = [
    ['VISIBILITY', cards.visibility],
    ['SOURCE QUALITY', cards.source_quality],
    ['COMPETITOR PRESSURE', cards.competitor_pressure]
  ];
  const startX = doc.x;
  const startY = doc.y;
  const gap = 8;
  const width = (doc.page.width - startX - 48 - gap * 2) / 3;
  for (const [index, [title, card]] of entries.entries()) {
    const x = startX + index * (width + gap);
    doc.save().roundedRect(x, startY, width, 80, 6).fill(PDF_COLORS.wash).restore();
    doc.font(fontName).fontSize(7.2).fillColor(PDF_COLORS.muted).text(title, x + 10, startY + 10, { width: width - 20 });
    doc.fontSize(25).fillColor(PDF_COLORS.ink).text(`${numberValue(card?.score)}`, x + 10, startY + 27, { width: width - 20 });
    doc.fontSize(7.8).fillColor(PDF_COLORS.teal).text(`${label(card?.band)} · ${label(card?.direction)}`, x + 10, startY + 62, {
      width: width - 20
    });
  }
  doc.x = doc.page.margins.left;
  doc.y = startY + 90;
}

function drawCover(doc, payload, fontName) {
  addPageBackground(doc);
  doc.font(fontName).fillColor(PDF_COLORS.teal).fontSize(9).text('COWTECH AIVGL · GOD MODE', 48, 52, { characterSpacing: 1.5 });
  doc.moveDown(2.5).fillColor(PDF_COLORS.ink).fontSize(30).text(textValue(payload.title, 'Executive report'), {
    width: doc.page.width - 96,
    lineGap: 5
  });
  doc.moveDown(0.8).fontSize(12).fillColor(PDF_COLORS.forest).text(textValue(payload.executive_summary), {
    width: doc.page.width - 110,
    lineGap: 4
  });
  doc.moveDown(1.2);
  const measurement = objectValue(payload.measurement);
  const details = [
    ['REPORT STATE', label(payload.status)],
    ['GENERATED', textValue(payload.generated_at)],
    ['MEASUREMENT', label(measurement.score_meaning)],
    ['SAMPLE', `${numberValue(measurement.parsed_answer_count)} parsed answers`]
  ];
  for (const [title, value] of details) {
    const y = doc.y;
    doc.fontSize(7.5).fillColor(PDF_COLORS.muted).text(title, 48, y, { width: 92 });
    doc.fontSize(9.5).fillColor(PDF_COLORS.ink).text(value, 148, y, { width: doc.page.width - 196 });
    doc.y = Math.max(doc.y, y + 23);
  }
  if (payload.customer_delivery_ready !== true) {
    doc.moveDown(0.8);
    const y = doc.y;
    doc.save().roundedRect(48, y, doc.page.width - 96, 58, 6).fill('#fff8e7').restore();
    doc.fontSize(8).fillColor(PDF_COLORS.amber).text('EVIDENCE WARNING', 60, y + 11, { characterSpacing: 1 });
    doc.fontSize(9).fillColor(PDF_COLORS.ink).text(
      'This report is not marked customer-delivery-ready. Confirm the measurement mode and guardrails before using its recommendations.',
      60,
      y + 28,
      { width: doc.page.width - 120, lineGap: 2 }
    );
    doc.y = y + 70;
  }
  doc.moveDown(1.2);
  doc.x = doc.page.margins.left;
  drawScorecards(doc, payload, fontName);
}

function drawMeasurement(doc, payload, fontName) {
  pdfSection(doc, 'Measurement frame', fontName);
  const measurement = objectValue(payload.measurement);
  const trend = objectValue(payload.trend);
  pdfBullet(doc, `Mode: ${label(measurement.mode)} · score meaning: ${label(measurement.score_meaning)}`, fontName);
  pdfBullet(
    doc,
    `Sample: ${numberValue(measurement.parsed_answer_count)} parsed of ${numberValue(measurement.answer_count)} results across ${numberValue(measurement.model_count)} model rows and ${numberValue(measurement.category_count)} categories.`,
    fontName
  );
  pdfBullet(doc, `Average parser confidence: ${numberValue(measurement.average_parser_confidence).toFixed(2)}.`, fontName);
  pdfBullet(doc, `Brand share of voice: ${numberValue(trend.brand_share_of_voice)}%.`, fontName);
  for (const item of arrayValue(measurement.methodology)) pdfBullet(doc, item, fontName, { dotColor: PDF_COLORS.muted });
}

function drawCompetitorReport(doc, payload, fontName) {
  pdfSection(doc, 'Competitor scoreboard', fontName);
  const profiles = arrayValue(payload.competitors);
  if (!profiles.length) pdfParagraph(doc, 'No configured competitor profile was available for this run.', fontName);
  for (const competitor of profiles.slice(0, 10)) {
    pdfSubheading(
      doc,
      `${numberValue(competitor.rank)}. ${textValue(competitor.name)}`,
      fontName,
      `${numberValue(competitor.mention_count)} mentions · ${numberValue(competitor.answer_coverage_percent)}% answer coverage · ${label(competitor.pressure_level)}`
    );
    pdfParagraph(doc, competitor.evidence_note, fontName, { size: 8.8 });
  }

  pdfSection(doc, 'Prompt-level evidence', fontName);
  const highlights = arrayValue(payload.evidence_highlights);
  if (!highlights.length) pdfParagraph(doc, 'No customer-safe answer excerpt was available for this run.', fontName);
  for (const item of highlights.slice(0, 6)) {
    pdfSubheading(doc, textValue(item.prompt, 'Measured prompt'), fontName, `${item.provider || 'provider'} · ${item.model || 'model'} · ${item.category || 'category'}`);
    pdfParagraph(doc, item.answer_excerpt || 'No excerpt available.', fontName, { size: 8.8, color: PDF_COLORS.forest });
    pdfBullet(
      doc,
      `${item.brand_mentioned ? 'Brand mentioned' : 'Brand not mentioned'} · ${numberValue(item.competitor_mentions)} competitor mentions · ${numberValue(item.source_url_count)} sources.`,
      fontName,
      { size: 8.2 }
    );
  }

  pdfSection(doc, 'Priority gaps', fontName);
  for (const gap of arrayValue(payload.priority_gaps).slice(0, 5)) {
    pdfSubheading(doc, `${numberValue(gap.order)}. ${textValue(gap.title)}`, fontName, `${label(gap.priority)} · ${textValue(gap.recommended_format)}`);
    pdfParagraph(doc, gap.description, fontName);
    for (const item of arrayValue(gap.evidence)) pdfBullet(doc, item, fontName);
    pdfBullet(doc, `Success measure: ${textValue(gap.success_measure)}`, fontName, { dotColor: PDF_COLORS.amber });
  }

  pdfSection(doc, '90-day competitive action plan', fontName);
  for (const action of arrayValue(payload.action_plan).slice(0, 3)) {
    pdfSubheading(doc, label(action.phase), fontName, `${label(action.priority)} · ${textValue(action.owner)}`);
    pdfParagraph(doc, action.action, fontName, { size: 10, color: PDF_COLORS.ink });
    pdfBullet(doc, `Deliverable: ${textValue(action.deliverable)}`, fontName);
    for (const item of arrayValue(action.evidence_basis)) pdfBullet(doc, item, fontName, { dotColor: PDF_COLORS.muted });
    pdfBullet(doc, `Success metric: ${textValue(action.success_metric)}`, fontName, { dotColor: PDF_COLORS.amber });
  }
}

function drawStrategyMemo(doc, payload, fontName) {
  pdfSection(doc, 'Decision brief', fontName);
  const brief = objectValue(payload.decision_brief);
  pdfSubheading(doc, 'Current position', fontName);
  pdfParagraph(doc, brief.current_position, fontName);
  pdfSubheading(doc, 'Primary constraint', fontName);
  pdfParagraph(doc, brief.primary_constraint, fontName);
  pdfSubheading(doc, 'Strategic thesis', fontName);
  pdfParagraph(doc, brief.strategic_thesis, fontName, { size: 11, color: PDF_COLORS.ink });
  pdfBullet(doc, `First decision: ${textValue(brief.first_decision)}`, fontName, { dotColor: PDF_COLORS.amber });

  pdfSection(doc, 'Strategic priorities', fontName);
  for (const priority of arrayValue(payload.strategic_priorities).slice(0, 3)) {
    pdfSubheading(doc, label(priority.priority), fontName, `${numberValue(priority.baseline)}/100 · ${label(priority.signal)}`);
    pdfParagraph(doc, priority.objective, fontName);
    for (const item of arrayValue(priority.evidence)) pdfBullet(doc, item, fontName);
    for (const item of arrayValue(priority.actions)) pdfBullet(doc, item, fontName, { dotColor: PDF_COLORS.forest });
    pdfBullet(doc, `Deliverable: ${textValue(priority.deliverable)}`, fontName, { dotColor: PDF_COLORS.amber });
    pdfBullet(doc, `Success metric: ${textValue(priority.success_metric)}`, fontName, { dotColor: PDF_COLORS.amber });
  }

  pdfSection(doc, 'Risk register', fontName);
  for (const risk of arrayValue(payload.risk_register).slice(0, 8)) {
    pdfSubheading(doc, textValue(risk.risk), fontName, label(risk.severity));
    pdfBullet(doc, `Evidence: ${textValue(risk.evidence)}`, fontName);
    pdfBullet(doc, `Mitigation: ${textValue(risk.mitigation)}`, fontName, { dotColor: PDF_COLORS.amber });
  }

  pdfSection(doc, '90-day operating roadmap', fontName);
  for (const phase of arrayValue(payload.roadmap_90_days).slice(0, 3)) {
    pdfSubheading(doc, label(phase.phase), fontName, textValue(phase.owner));
    pdfParagraph(doc, phase.objective, fontName, { size: 10, color: PDF_COLORS.ink });
    for (const action of arrayValue(phase.actions)) pdfBullet(doc, action, fontName);
    pdfBullet(doc, `Deliverable: ${textValue(phase.deliverable)}`, fontName, { dotColor: PDF_COLORS.amber });
    pdfBullet(doc, `Success metric: ${textValue(phase.success_metric)}`, fontName, { dotColor: PDF_COLORS.amber });
  }

  pdfSection(doc, 'Evidence register', fontName);
  for (const evidence of arrayValue(payload.evidence_register).slice(0, 10)) {
    pdfSubheading(doc, `${textValue(evidence.evidence_id)} · ${label(evidence.type)}`, fontName, textValue(evidence.model));
    pdfParagraph(doc, evidence.statement, fontName, { size: 9.5, color: PDF_COLORS.ink });
    pdfParagraph(doc, evidence.observation, fontName, { size: 8.8 });
  }
}

function drawGuardrails(doc, payload, fontName) {
  pdfSection(doc, 'Methodology and claim boundary', fontName);
  for (const item of arrayValue(payload.measurement?.methodology)) pdfBullet(doc, item, fontName);
  for (const item of arrayValue(payload.guardrails)) pdfBullet(doc, item, fontName, { dotColor: PDF_COLORS.amber });
}

function addPdfFooters(doc, fontName) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const text = `CowTech AIVGL · God Mode · ${index + 1} / ${range.count}`;
    const previous = {
      x: doc.x,
      y: doc.y,
      bottomMargin: doc.page.margins.bottom
    };
    doc.page.margins.bottom = 0;
    doc.font(fontName).fontSize(7).fillColor(PDF_COLORS.muted).text(text, 48, doc.page.height - 32, {
      width: doc.page.width - 96,
      align: 'right',
      lineBreak: false
    });
    doc.page.margins.bottom = previous.bottomMargin;
    doc.x = previous.x;
    doc.y = previous.y;
  }
}

export async function buildGodReportPdf(payload = {}) {
  if (!GOD_REPORT_TYPES.has(payload.deliverable_type)) {
    throw new Error('unsupported God report type');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 48, right: 48, bottom: 52, left: 48 },
      bufferPages: true,
      info: {
        Title: textValue(payload.title, 'CowTech God Mode report'),
        Author: 'CowTech AIVGL',
        Subject: label(payload.deliverable_type),
        Keywords: 'CowTech, AIVGL, GEO, God Mode'
      }
    });
    const chunks = [];
    doc.on('pageAdded', () => {
      addPageBackground(doc);
      doc.x = doc.page.margins.left;
    });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length > 5 * 1024 * 1024) {
        reject(new Error('God report PDF exceeded the 5 MB output limit.'));
        return;
      }
      resolve(buffer);
    });

    try {
      const fontName = registerPdfFont(doc);
      drawCover(doc, payload, fontName);
      doc.addPage();
      doc.x = doc.page.margins.left;
      drawMeasurement(doc, payload, fontName);
      if (payload.deliverable_type === 'competitor_deep_report') {
        drawCompetitorReport(doc, payload, fontName);
      } else {
        drawStrategyMemo(doc, payload, fontName);
      }
      drawGuardrails(doc, payload, fontName);
      addPdfFooters(doc, fontName);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function safeSlug(value) {
  const slug = textValue(value)
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase()
    .slice(0, 60);
  return slug || 'cowtech-report';
}

function exportFilename(row, format) {
  const payload = objectValue(row.result_payload);
  const type = row.item_type === 'competitor_deep_report' ? 'competitor-deep-report' : 'strategy-memo';
  const brand = safeSlug(payload.brand?.name || 'cowtech');
  const cycle = safeSlug(row.cycle_month || String(payload.generated_at || '').slice(0, 7) || 'current');
  return `${brand}-${cycle}-${type}.${format}`;
}

export async function getGodReportExport({ item_id: itemId, tracking_run_id: trackingRunId, format } = {}) {
  const normalizedFormat = format === 'markdown' ? 'md' : textValue(format).toLowerCase();
  if (!UUID_PATTERN.test(textValue(itemId)) || !UUID_PATTERN.test(textValue(trackingRunId))) return null;
  if (!['md', 'pdf'].includes(normalizedFormat)) return null;

  const result = await pool.query(
    `SELECT id,
            tracking_run_id,
            cycle_month,
            item_type,
            status,
            result_payload
     FROM customer_monthly_fulfillment_items
     WHERE id = $1
       AND tracking_run_id = $2
       AND plan_code = 'god'
       AND item_type = ANY($3::text[])
       AND status = 'completed'
     LIMIT 1`,
    [itemId, trackingRunId, [...GOD_REPORT_TYPES]]
  );
  const row = result.rows[0];
  const payload = objectValue(row?.result_payload);
  if (!row || !GOD_REPORT_TYPES.has(payload.deliverable_type) || payload.deliverable_type !== row.item_type) return null;

  if (normalizedFormat === 'md') {
    return {
      filename: exportFilename(row, 'md'),
      content_type: 'text/markdown; charset=utf-8',
      body: buildGodReportMarkdown(payload)
    };
  }

  return {
    filename: exportFilename(row, 'pdf'),
    content_type: 'application/pdf',
    body: await buildGodReportPdf(payload)
  };
}

const DEFAULT_LANG = 'zh';
const savedLang = localStorage.getItem('customerDashboardLang');

const ZH_TEXT = {
  'GEO Growth': 'GEO 增长',
  'Cowtech Visibility': 'Cowtech 可见度',
  'Article delivery': '文章交付',
  'AI engine tracking': 'AI 引擎追踪',
  'AI Engine Visibility': 'AI 引擎可见度',
  'AI Engine Visibility Overview': 'AI 引擎可见度总览',
  'AI Search Visibility': 'AI 搜索可见度',
  'Share of Voice': '声量份额',
  'Citation Footprint': '引用覆盖',
  'Competitor Gap': '竞品差距',
  'Next Growth Move': '下一步增长动作',
  'Major AI engines': '主流 AI 引擎',
  'Customer-ready visibility signal across major AI answer engines.':
    '面向客户的主流 AI 答案引擎可见度信号。',
  'Engine coverage': '引擎覆盖',
  'Prompt movement': 'Prompt 变化',
  'Citation movement': '引用变化',
  'Action plan': '行动计划',
  'No customer-facing AI engine data is ready yet.': '客户可见的 AI 引擎数据尚未就绪。',
  'Safe test cycle': '安全测试轮次',
  'AI engine cycle': 'AI 引擎轮次',
  Dashboard: '客户 Dashboard',
  'Tracking run': '追踪运行',
  'Setup readiness': '配置就绪度',
  Readiness: '就绪度',
  Plan: '套餐',
  Prompts: 'Prompts',
  Models: '模型',
  Competitors: '竞品',
  Quota: '额度',
  'Calls / run': '每次运行调用',
  'Monthly estimate': '月度预估',
  Remaining: '剩余',
  Account: '账户',
  Access: '访问权限',
  Lifecycle: '生命周期',
  'Provider calls': 'Provider 调用',
  Auth: '认证',
  'Tracking inputs': '追踪输入',
  'No competitors configured.': '尚未配置竞品。',
  'No prompts configured.': '尚未配置 prompts。',
  'No models selected.': '尚未选择模型。',
  'Prompt Discovery': 'Prompt 发现',
  'Prompt Library': 'Prompt 库',
  'Industry prompt generation': '行业 Prompt 生成',
  'Intent layers': '意图分层',
  'Prompt clusters': 'Prompt 聚类',
  'Priority queue': '优先级队列',
  'Prompt-level opportunities': 'Prompt 级机会',
  'Commercial intent': '商业意图',
  'Target metric': '目标指标',
  'No discovery run yet': '还没有发现运行',
  'Candidate prompts will appear here after a deterministic discovery run exists for this brand.':
    '品牌有确定性发现运行后，候选 prompts 会显示在这里。',
  'Review candidate prompts before tracking': '追踪前审核候选 prompts',
  Candidates: '候选项',
  Confirmed: '已确认',
  Discovery: '发现',
  Selection: '选择',
  Tracking: '追踪',
  Review: '审核',
  Warnings: '警告',
  'No selection warnings.': '没有选择警告。',
  'Plan limit': '套餐上限',
  Selected: '已选择',
  'Candidate impact': '候选项影响',
  'Library clusters': 'Prompt 聚类',
  'High priority': '高优先级',
  'Prompt opportunities': 'Prompt 机会',
  'Confirmation impact': '确认影响',
  Counts: '计入额度',
  'No quota': '不计额度',
  'No candidates in this group.': '这个分组没有候选项。',
  Status: '状态',
  Intent: '意图',
  Funnel: '漏斗阶段',
  Gap: '缺口',
  'Duplicate risk': '重复风险',
  'Quota impact': '额度影响',
  'Recommendation reason': '推荐原因',
  Tags: '标签',
  'Customer actions': '客户操作',
  Select: '选择',
  Confirm: '确认',
  Reject: '拒绝',
  'Save edit': '保存编辑',
  'Select a candidate to inspect details.': '选择一个候选项查看详情。',
  'Select or save an edit before confirmation.': '确认前请先选择或保存编辑。',
  'Plan prompt limit reached. Confirmation is blocked.': '套餐 prompt 上限已达到，无法确认。',
  'Prompt confirmed for tracking.': 'Prompt 已确认进入追踪。',
  'Prompt edit saved.': 'Prompt 编辑已保存。',
  'Candidate rejected.': '候选项已拒绝。',
  'Candidate selected.': '候选项已选择。',
  'Confirmed prompts': '已确认 prompts',
  'Confirmed prompts appear here after customer confirmation. Candidates do not enter tracking until confirmed.':
    '客户确认后，已确认 prompts 会显示在这里。候选项在确认前不会进入追踪。',
  'Visibility report': '可见度报告',
  'AI visibility': 'AI 可见度',
  'Visibility Score': '可见度分数',
  'Source Quality Score': '来源质量分数',
  'Competitor Pressure Score': '竞品压力分数',
  'Scores are based on measured prompt results.': '分数基于已测量的 prompt 结果。',
  'Scores are deterministic MVP heuristics based on parsed answers.': '分数来自基于已解析答案的确定性 MVP 规则。',
  Coverage: '覆盖',
  'Parsed answers': '已解析答案',
  'Brand mentions': '品牌提及',
  'Official sources': '官方来源',
  'Competitor mentions': '竞品提及',
  'Model breakdown': '模型拆分',
  'AI Engine breakdown': 'AI 引擎拆分',
  'Category breakdown': '分类拆分',
  'Top cited domains': '高频引用域名',
  'Source Intelligence': '来源智能',
  'Top cited URLs': '高频引用 URL',
  'Citation gaps': '引用缺口',
  'Competitor source leakage': '竞品来源泄漏',
  'Recurring monitoring': '周期监控',
  'Configure monitoring': '配置监控',
  'Pause monitoring': '暂停监控',
  'Locked prompt set': '锁定 Prompt Set',
  'Alerts': '告警',
  'Open alerts': '未处理告警',
  'Baseline': '基准线',
  'Current': '当前',
  'Previous': '上一轮',
  'Trend': '趋势',
  'Next cycle': '下一轮',
  'Prompt gaps': 'Prompt 缺口',
  'Owned citations': '自有引用',
  'Earned citations': '第三方引用',
  'Directory citations': '目录引用',
  'Competitor citations': '竞品引用',
  'Competitor pressure': '竞品压力',
  'Highlighted answers': '重点答案',
  'AI Engine SOV': 'AI 引擎 SOV',
  'AI Engine SOV trend': 'AI 引擎 SOV 趋势',
  'Content opportunities': '内容机会',
  'Prioritized recommendations': '优先建议',
  'View linked brief': '查看关联 brief',
  'Execution binding': '执行绑定',
  'Triggering prompts': '触发 prompts',
  'Weakness evidence': '弱点证据',
  'Page type': '页面类型',
  'Title suggestion': '标题建议',
  'Must answer': '必须回答',
  'Must include facts': '必须包含事实',
  'Source / citation requirements': 'Source / citation 要求',
  'Competitor angle': '竞品角度',
  'No customer opportunities are ready yet.': '还没有可用的客户机会。',
  'Content briefs': '内容 briefs',
  'Brief detail': 'Brief 详情',
  'No content briefs are ready yet.': '还没有可用的内容 brief。',
  'Monthly report': '月度报告',
  'Executive summary': '执行摘要',
  'Score movement': '分数变化',
  'What changed': '变化说明',
  'Recommended next moves': '建议下一步',
  'Monthly report appears after enough tracking history exists.': '有足够追踪历史后会显示月报。',
  'Publish handoff': '发布交接',
  'Manual publication tracking': '手动发布追踪',
  'Publish handoff appears after article approval.': '文章批准后会显示发布交接。',
  'Mark published': '标记已发布',
  'External URL': '外部 URL',
  Instructions: '说明',
  'Publication state': '发布状态',
  'Retest appears after publish handoff.': '发布交接后会显示复测。',
  'R6.2 retest': 'R6.2 复测',
  Scheduled: '已安排',
  Due: '到期',
  Reports: '报告',
  Schedule: '计划',
  State: '状态',
  'Target metric': '目标指标',
  'Retest run': '复测运行',
  'Schedule retest': '安排复测',
  'Run due retest': '运行到期复测',
  'Run due retest is controlled mock mode only from this surface.': '这个页面上的到期复测只会以受控 mock 模式运行。',
  'Before / after report': '前后对比报告',
  'Before/after report appears after a due retest is executed and compared.': '到期复测执行并完成对比后会显示前后报告。',
  'Article workflow': '文章工作流',
  Production: '生产',
  'Review package': '审核包',
  'Select an article': '选择文章',
  Timeline: '时间线',
  'Delivery state': '交付状态',
  Approval: '审批',
  Retest: '复测',
  'Measured result': '测量结果',
  Article: '文章',
  Publish: '发布',
  Missing: '缺失项',
  'Preview not available.': '预览不可用。',
  Download: '下载',
  bytes: '字节',
  'Current stage': '当前阶段',
  Source: '来源',
  Next: '下一步',
  'Draft ID': '草稿 ID',
  'Brief approved': 'Brief 已批准',
  'The article brief is linked to validated prompts.': '文章 brief 已关联验证过的 prompts。',
  'Sent to production': '已发送生产',
  'Prepared in workspace': '已在工作区准备',
  'Connector dry-run only.': '仅 connector dry-run。',
  'Waiting for production handoff.': '等待生产交接。',
  'Article generated': '文章已生成',
  'Draft content is available for review.': '草稿内容可供审核。',
  'Draft content is not back yet.': '草稿内容尚未返回。',
  'Quality review': '质量审核',
  'Ready for approval': '可提交审批',
  'Package is ready for customer review.': '包已可供客户审核。',
  'Package is still being assembled.': '包仍在组装中。',
  'Growth Loop workspace': 'Growth Loop 工作区',
  'GeoFlow production engine': 'GeoFlow 生产引擎',
  'Monitor next cycle': '观察下一轮',
  'Delivery timeline will appear after the package and retest records are ready.': '包和复测记录就绪后会显示交付时间线。',
  'Request changes': '要求修改',
  'Approve handoff': '批准交接',
  'Sends the article back to the team for revision.': '把文章退回团队修改。',
  'Approves the article for later manual publish handoff. Nothing is published automatically.':
    '批准文章进入后续手动发布交接。不会自动发布。',
  'Updates the customer review state.': '更新客户审核状态。',
  'Customer review': '客户审核',
  'Changes requested': '已要求修改',
  'Approved for handoff': '已批准交接',
  'Handoff prepared': '交接已准备',
  'Published externally': '外部已发布',
  'Retest scheduled': '复测已安排',
  'Not published': '未发布',
  'Approve or request changes': '批准或要求修改',
  'Team revision in progress': '团队正在修改',
  'Team prepares publish handoff': '团队准备发布交接',
  'Waiting for publish confirmation': '等待发布确认',
  'Schedule retest': '安排复测',
  'Waiting for retest': '等待复测',
  'Customer actions will appear after the review package is ready.': '审核包就绪后会显示客户操作。',
  'No customer action is needed right now.': '当前不需要客户操作。',
  'Retest starts after external publication is confirmed and scheduled in R6.2.': '确认外部发布并在 R6.2 安排后，复测才会开始。',
  'No tracking runs found.': '没有找到追踪运行。',
  'No tracking runs found for this brand yet.': '这个品牌还没有追踪运行。',
  'No article dashboard payload is available for this run.': '这次运行没有可用的文章 dashboard 数据。',
  'ready for dashboard': '可在 dashboard 查看',
  'ready for tracking': '可进入追踪',
  blocked: '已阻止',
  pending: '待处理',
  'in progress': '进行中',
  complete: '完成',
  completed: '完成',
  improved: '已提升',
  unchanged: '无变化',
  failed: '失败',
  declined: '已拒绝',
  scheduled: '已安排',
  'not started': '未开始',
  none: '无',
  unknown: '未知',
  active: '启用',
  'not connected': '未连接',
  'ready for download': '可下载',
  'approved for export': '已批准导出',
  'production completed': '生产完成',
  'published externally': '外部已发布',
  'pending schedule': '待安排',
  'customer review': '客户审核',
  'changes requested': '已要求修改',
  'approved for publish handoff': '已批准发布交接',
  'request changes saved.': '要求修改已保存。',
  'approve handoff saved.': '批准交接已保存。',
  'External publication confirmed.': '外部发布已确认。',
  'Retest scheduled.': '复测已安排。',
  'Due retest completed in mock-safe mode.': '到期复测已用 mock-safe 模式完成。',
  ready: '就绪',
  full: '完整',
  'ready for selection': '可选择',
  shortlisted: '已入选',
  recommended: '推荐',
  Recommended: '推荐',
  Awareness: '认知',
  'Problem-led': '问题导向',
  Comparison: '对比',
  'Purchase intent': '购买意图',
  'Brand defense': '品牌防守',
  'Source seeking': '来源寻找',
  'Geo / language': '地域/语言',
  Rejected: '已拒绝',
  High: '高',
  Medium: '中',
  Low: '低',
  strong: '强',
  good: '良好',
  'medium pressure': '中等压力',
  'higher is better': '越高越好',
  'lower is better': '越低越好',
  'strong · higher is better': '强 · 越高越好',
  'good · higher is better': '良好 · 越高越好',
  'medium pressure · lower is better': '中等压力 · 越低越好',
  comparison: '对比',
  decision: '决策',
  'purchase intent': '购买意图',
  'alternative search': '替代方案搜索',
  'competitor pressure': '竞品压力',
  'Competitor gap': '竞品缺口',
  'From your setup': '来自你的配置',
  'Existing opportunity': '已有机会',
  'Category template': '分类模板',
  'Review and confirm candidate prompts before tracking.': '追踪前请审核并确认候选 prompts。',
  'Ready to run tracking.': '已可运行追踪。',
  'Selecting or editing does not count against quota. Confirmation uses 1 prompt slot.':
    '选择或编辑不会占用额度；确认会使用 1 个 prompt 名额。'
};

function currentLang() {
  return savedLang || DEFAULT_LANG;
}

function isZh() {
  return currentLang() === 'zh';
}

function t(value) {
  if (!isZh()) return value;
  return ZH_TEXT[value] || value;
}

function translateTextNodeContent(value) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized && ZH_TEXT[normalized] ? ZH_TEXT[normalized] : value;
}

function applyChineseText(root = document.body) {
  if (!isZh()) return;
  document.documentElement.lang = 'zh-CN';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const translated = translateTextNodeContent(node.nodeValue);
    if (translated !== node.nodeValue) node.nodeValue = translated;
  });
  root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach((element) => {
    for (const attribute of ['placeholder', 'title', 'aria-label']) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const translated = translateTextNodeContent(current);
      if (translated !== current) element.setAttribute(attribute, translated);
    }
  });
}

function scheduleChineseText(root = document.body) {
  if (!isZh()) return;
  window.requestAnimationFrame(() => applyChineseText(root));
}

function setDashboardLanguage(lang) {
  localStorage.setItem('customerDashboardLang', lang);
  window.location.reload();
}

function renderLanguageChrome() {
  document.documentElement.lang = isZh() ? 'zh-CN' : 'en';
  const button = document.querySelector('#langToggle');
  if (!button) return;
  button.textContent = isZh() ? 'EN' : '中文';
  button.setAttribute('aria-label', isZh() ? 'Switch to English' : '切换到中文');
}

function startChineseObserver() {
  if (!isZh()) return;
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(() => {
      pending = false;
      applyChineseText();
    });
  });
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

const state = {
  runs: [],
  dashboard: null,
  setup: null,
  phase4: null,
  phase4ConversationId: null,
  phase4QaResponse: null,
  phase4QaPending: false,
  promptDiscovery: null,
  visibility: null,
  monitoring: null,
  sourceTypeFilter: 'all',
  opportunities: null,
  briefs: null,
  monthlyReport: null,
  publishHandoff: null,
  retest: null,
  selectedPromptGroup: 'recommended',
  selectedCandidateId: null,
  promptActionPending: false,
  promptActionMessage: null,
  selectedBriefId: null,
  selectedArticleId: null,
  actionPending: false,
  actionMessage: null
};

const els = {
  runSelect: document.querySelector('#runSelect'),
  articleList: document.querySelector('#articleList'),
  brandLine: document.querySelector('#brandLine'),
  pageTitle: document.querySelector('#pageTitle'),
  summaryStrip: document.querySelector('#summaryStrip'),
  aiOverviewBoard: document.querySelector('#aiOverviewBoard'),
  setupBoard: document.querySelector('#setupBoard'),
  phase4Board: document.querySelector('#phase4Board'),
  promptDiscoveryBoard: document.querySelector('#promptDiscoveryBoard'),
  visibilityBoard: document.querySelector('#visibilityBoard'),
  monitoringBoard: document.querySelector('#monitoringBoard'),
  opportunityBoard: document.querySelector('#opportunityBoard'),
  briefBoard: document.querySelector('#briefBoard'),
  monthlyReportBoard: document.querySelector('#monthlyReportBoard'),
  publishHandoffBoard: document.querySelector('#publishHandoffBoard'),
  retestReportBoard: document.querySelector('#retestReportBoard'),
  langToggle: document.querySelector('#langToggle'),
  statusBand: document.querySelector('#statusBand'),
  articleTitle: document.querySelector('#articleTitle'),
  articleMeta: document.querySelector('#articleMeta'),
  productionSummary: document.querySelector('#productionSummary'),
  productionRail: document.querySelector('#productionRail'),
  packagePreview: document.querySelector('#packagePreview'),
  fileTable: document.querySelector('#fileTable'),
  timelineList: document.querySelector('#timelineList'),
  handoffState: document.querySelector('#handoffState'),
  actionGrid: document.querySelector('#actionGrid'),
  retestCard: document.querySelector('#retestCard')
};

function text(value, fallback = 'Not available') {
  return value === null || value === undefined || value === '' ? fallback : String(value);
}

function formatStatus(value) {
  const formatted = text(value, 'pending').replaceAll('_', ' ');
  return t(formatted);
}

function pillClass(status) {
  if (['ready_for_dashboard', 'complete', 'completed', 'improved', 'published_externally'].includes(status)) {
    return 'is-good';
  }
  if (['pending', 'in_progress', 'partially_ready', 'unchanged'].includes(status)) return 'is-waiting';
  if (['declined', 'blocked', 'failed'].includes(status)) return 'is-alert';
  return 'is-info';
}

function chip(label, value, extra = '') {
  return `<div class="status-chip ${extra || pillClass(value)}"><span class="chip-label">${t(label)}</span><span class="chip-value">${formatStatus(value)}</span></div>`;
}

function metric(label, value) {
  return `<div class="metric"><span class="metric-label">${t(label)}</span><span class="metric-value">${text(value, '0')}</span></div>`;
}

function compactNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : text(value, '0');
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body.message || body.error || message;
    } catch (_error) {
      // Keep the transport message when the response is not JSON.
    }
    throw new Error(message);
  }
  return response.json();
}

async function loadRuns() {
  const { rows } = await fetchJson('/internal/tracking/runs?limit=20');
  const params = new URLSearchParams(location.search);
  const requested = params.get('run_id');
  const requestedBrandId = params.get('brand_id');
  const requestedBrandName = params.get('brand_name');
  const allRuns = rows || [];
  const hasBrandFilter = Boolean(requestedBrandId || requestedBrandName);
  state.runs = hasBrandFilter
    ? allRuns.filter((run) => {
        if (requestedBrandId && run.brand_id === requestedBrandId) return true;
        if (requestedBrandName && String(run.brand_name || '').toLowerCase() === requestedBrandName.toLowerCase()) return true;
        return false;
      })
    : allRuns;

  els.runSelect.innerHTML = state.runs
    .map((run) => `<option value="${run.id}">${run.brand_name || run.brand_id} · ${run.run_type}</option>`)
    .join('');

  if (requested) {
    els.runSelect.value = requested;
    await loadDashboard(requested);
    return;
  }

  const firstRun = state.runs[0];
  if (firstRun) {
    els.runSelect.value = firstRun.id;
    await loadDashboard(firstRun.id);
  } else {
    await loadSetup();
    await loadPhase4();
    await loadPromptDiscovery();
    renderEmpty(hasBrandFilter ? 'No tracking runs found for this brand yet.' : 'No tracking runs found.');
  }
}

async function loadDashboard(runId, preferredArticleId = null) {
  await loadSetup({ runId });
  await loadPhase4({ runId });
  await loadPromptDiscovery();
  await loadVisibility({ runId });
  await loadMonitoring({ runId });
  await loadOpportunities({ runId });
  await loadBriefs({ runId });
  await loadMonthlyReport({ runId });
  await loadPublishHandoff({ runId });
  await loadRetest({ runId });
  const { article_review: articleReview } = await fetchJson(`/dashboard/article-review-data?run_id=${encodeURIComponent(runId)}`);
  state.dashboard = articleReview;
  const preferred = articleReview.articles.find((item) => item.article.article_draft_id === preferredArticleId);
  state.selectedArticleId = preferred?.article.article_draft_id || articleReview.articles[0]?.article.article_draft_id || null;
  renderDashboard();
}

async function loadSetup({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const { setup } = await fetchJson(`/dashboard/setup-data${suffix}`);
  state.setup = setup;
  renderSetup();
}

async function loadPhase4({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id') || state.setup?.brand?.id;
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (!brandId && brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const { phase4 } = await fetchJson(`/dashboard/phase4-data${suffix}`);
    state.phase4 = phase4;
  } catch (_error) {
    state.phase4 = null;
  }
  renderPhase4();
}

function safeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function phase4ModuleState(value, entitled) {
  if (!entitled) return 'not_entitled';
  return value ? 'ready' : 'awaiting_evidence';
}

function renderPhase4() {
  const payload = state.phase4;
  if (!payload) {
    els.phase4Board.innerHTML = '';
    return;
  }
  const modules = payload.modules || {};
  const entitlement = payload.entitlement || {};
  const readiness = modules.page_readiness;
  const intake = modules.company_intake;
  const discovery = modules.prompt_discovery;
  const backlog = modules.geoflow_backlog || [];
  const artifacts = modules.remediation_artifacts || [];
  const conversations = modules.report_conversations || [];
  const featureEnabled = (key) => entitlement[key] === true;
  const moduleCards = [
    {
      key: 'page_readiness_enabled',
      index: '01',
      title: 'Page readiness',
      state: phase4ModuleState(readiness, featureEnabled('page_readiness_enabled')),
      value: readiness ? `${compactNumber(readiness.score)} / 100` : 'Unavailable',
      note: 'Schema 30 · Content 30 · Meta 20 · Citation 20'
    },
    {
      key: 'company_intake_enabled',
      index: '02',
      title: 'Company intake',
      state: phase4ModuleState(intake, featureEnabled('company_intake_enabled')),
      value: intake ? `${compactNumber(intake.facts?.length || 0)} sourced facts` : 'Awaiting review',
      note: 'Lineage, confidence and human approval'
    },
    {
      key: 'evidence_prompt_discovery_enabled',
      index: '03',
      title: 'Prompt discovery',
      state: phase4ModuleState(discovery, featureEnabled('evidence_prompt_discovery_enabled')),
      value: discovery ? `${compactNumber(discovery.dimensions?.length || 0)} dimensions` : 'Metrics unavailable',
      note: 'Real provider evidence only'
    },
    {
      key: 'evidence_backlog_enabled',
      index: '04',
      title: 'GeoFlow backlog',
      state: phase4ModuleState(backlog.length ? backlog : null, featureEnabled('evidence_backlog_enabled')),
      value: `${compactNumber(backlog.length)} actions`,
      note: 'Owner · evidence · acceptance · retest'
    },
    {
      key: 'remediation_tools_enabled',
      index: '05',
      title: 'Remediation studio',
      state: phase4ModuleState(artifacts.length ? artifacts : null, featureEnabled('remediation_tools_enabled')),
      value: `${compactNumber(new Set(artifacts.map((item) => item.artifact_type)).size)} / 4 tools`,
      note: 'Versioned, reviewed and dry-run only'
    },
    {
      key: 'report_qa_enabled',
      index: '06',
      title: 'Report Q&A',
      state: phase4ModuleState(conversations.length ? conversations : null, featureEnabled('report_qa_enabled')),
      value: `${compactNumber(conversations.length)} conversations`,
      note: 'Tenant-scoped answers with citations'
    }
  ];
  const topBacklog = backlog.slice(0, 3);
  els.phase4Board.innerHTML = `
    <article class="phase4-command">
      <div class="phase4-command-copy">
        <span class="panel-kicker">CowTech execution studio</span>
        <h2>Evidence enters once. Every action leaves a trace.</h2>
        <p>Readiness, prompt intelligence and remediation now share one reviewable customer workflow—without blending page quality into measured AI visibility.</p>
      </div>
      <div class="phase4-contract">
        <span>Access</span>
        <strong>${formatStatus(entitlement.status)}</strong>
        <small>Live transport off · real publish off</small>
      </div>
    </article>
    <div class="phase4-module-grid">
      ${moduleCards.map((card) => `
        <article class="phase4-module" data-phase4-state="${safeHtml(card.state)}">
          <div class="phase4-module-index">${card.index}</div>
          <div>
            <span class="phase4-state">${formatStatus(card.state)}</span>
            <h3>${safeHtml(card.title)}</h3>
            <strong>${safeHtml(card.value)}</strong>
            <p>${safeHtml(card.note)}</p>
          </div>
        </article>
      `).join('')}
    </div>
    <article class="phase4-ledger">
      <div>
        <span class="panel-kicker">Next controlled actions</span>
        <h3>${topBacklog.length ? 'Evidence-backed backlog' : 'No reviewed backlog yet'}</h3>
      </div>
      <div class="phase4-ledger-items">
        ${topBacklog.length ? topBacklog.map((item) => `
          <div>
            <span>${safeHtml(item.priority || 'pending')}</span>
            <strong>${safeHtml(item.title)}</strong>
            <small>${safeHtml(item.acceptance_metric || 'Acceptance metric pending')}</small>
          </div>
        `).join('') : '<p>Run the entitled dark workflow after evidence is reviewed. Nothing is published automatically.</p>'}
      </div>
    </article>
    <article class="phase4-qa">
      <div>
        <span class="panel-kicker">Evidence Q&A</span>
        <h3>Ask this report</h3>
        <p>Answers are limited to this workspace and cite the evidence used.</p>
      </div>
      <form class="phase4-qa-form" id="phase4QaForm">
        <label for="phase4Question">Question</label>
        <div>
          <input id="phase4Question" name="question" maxlength="500" placeholder="What should we fix first?" ${featureEnabled('report_qa_enabled') ? '' : 'disabled'} />
          <button type="submit" ${state.phase4QaPending || !featureEnabled('report_qa_enabled') ? 'disabled' : ''}>${state.phase4QaPending ? 'Checking evidence…' : 'Ask'}</button>
        </div>
      </form>
      ${state.phase4QaResponse ? `
        <div class="phase4-qa-answer">
          <strong>${safeHtml(state.phase4QaResponse.answer)}</strong>
          <div>${(state.phase4QaResponse.citations || []).map((citation) => `<span>[${safeHtml(citation.ref)}] ${safeHtml(citation.source_type)}</span>`).join('')}</div>
        </div>
      ` : ''}
    </article>
  `;
  document.querySelector('#phase4QaForm')?.addEventListener('submit', submitPhase4Question);
}

async function submitPhase4Question(event) {
  event.preventDefault();
  const question = new FormData(event.currentTarget).get('question');
  if (!String(question || '').trim()) return;
  state.phase4QaPending = true;
  renderPhase4();
  const params = new URLSearchParams(location.search);
  try {
    const { response } = await fetchJson('/dashboard/phase4/report-qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: state.dashboard?.tracking_run_id || null,
        brand_id: params.get('brand_id') || state.setup?.brand?.id,
        brand_name: params.get('brand_name') || null,
        conversation_id: state.phase4ConversationId,
        question,
        actor: 'customer_dashboard'
      })
    });
    state.phase4ConversationId = response.conversation_id;
    state.phase4QaResponse = response;
  } catch (error) {
    state.phase4QaResponse = {
      answer: error.message,
      citations: []
    };
  } finally {
    state.phase4QaPending = false;
    renderPhase4();
  }
}

async function loadPromptDiscovery() {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const discoveryRunId = params.get('discovery_run_id');
  const brandId = params.get('brand_id') || state.setup?.brand?.id;
  const brandName = params.get('brand_name');
  if (discoveryRunId) query.set('discovery_run_id', discoveryRunId);
  if (!discoveryRunId && brandId) query.set('brand_id', brandId);
  if (!discoveryRunId && !brandId && brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';

  try {
    const { prompt_discovery: promptDiscovery } = await fetchJson(`/dashboard/prompt-discovery-data${suffix}`);
    state.promptDiscovery = promptDiscovery;
    const activeGroup =
      promptDiscovery.groups.find((group) => group.id === state.selectedPromptGroup && group.count > 0) ||
      promptDiscovery.groups.find((group) => group.id === 'recommended' && group.count > 0) ||
      promptDiscovery.groups.find((group) => group.count > 0);
    state.selectedPromptGroup = activeGroup?.id || 'recommended';
    const candidateIds = new Set(activeGroup?.candidate_ids || []);
    const activeCandidate =
      promptDiscovery.candidates.find((candidate) => candidate.id === state.selectedCandidateId && candidateIds.has(candidate.id)) ||
      promptDiscovery.candidates.find((candidate) => candidateIds.has(candidate.id)) ||
      promptDiscovery.candidates[0];
    state.selectedCandidateId = activeCandidate?.id || null;
  } catch (_error) {
    state.promptDiscovery = null;
    state.selectedCandidateId = null;
  }
  renderPromptDiscovery();
}

async function loadVisibility({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const { visibility } = await fetchJson(`/dashboard/visibility-data${suffix}`);
  state.visibility = visibility;
  renderVisibility();
}

async function loadMonitoring({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const { monitoring } = await fetchJson(`/dashboard/monitoring-data${suffix}`);
    state.monitoring = monitoring;
  } catch (_error) {
    state.monitoring = null;
  }
  renderMonitoring();
}

async function loadOpportunities({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const { opportunities } = await fetchJson(`/dashboard/opportunities-data${suffix}`);
  state.opportunities = opportunities;
  renderOpportunities();
}

async function loadBriefs({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const { briefs } = await fetchJson(`/dashboard/briefs-data${suffix}`);
  state.briefs = briefs;
  state.selectedBriefId = briefs.briefs?.[0]?.id || null;
  renderBriefs();
}

async function loadMonthlyReport({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const { monthly_report: monthlyReport } = await fetchJson(`/dashboard/monthly-report-data${suffix}`);
    state.monthlyReport = monthlyReport;
  } catch (error) {
    state.monthlyReport = null;
  }
  renderMonthlyReport();
}

async function loadPublishHandoff({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const { publish_handoff: publishHandoff } = await fetchJson(`/dashboard/publish-handoff-data${suffix}`);
    state.publishHandoff = publishHandoff;
  } catch (error) {
    state.publishHandoff = null;
  }
  renderPublishHandoff();
}

async function loadRetest({ runId } = {}) {
  const params = new URLSearchParams(location.search);
  const query = new URLSearchParams();
  const brandId = params.get('brand_id');
  const brandName = params.get('brand_name');
  if (runId) query.set('run_id', runId);
  if (brandId) query.set('brand_id', brandId);
  if (brandName) query.set('brand_name', brandName);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  try {
    const { retest } = await fetchJson(`/dashboard/retest-data${suffix}`);
    state.retest = retest;
  } catch (error) {
    state.retest = null;
  }
  renderRetestBoard();
}

function selectedArticle() {
  return state.dashboard?.articles.find((item) => item.article.article_draft_id === state.selectedArticleId);
}

function selectedPublishHandoff() {
  return state.publishHandoff?.handoffs.find((item) => item.article.article_draft_id === state.selectedArticleId);
}

function selectedRetest() {
  return state.retest?.retests.find((item) => item.article.article_draft_id === state.selectedArticleId);
}

function renderSetup() {
  const setup = state.setup;
  if (!setup) {
    els.setupBoard.innerHTML = '';
    return;
  }

  const plan = setup.plan;
  const quota = setup.quota;
  const competitors = setup.setup.competitors;
  const prompts = setup.setup.prompts;
  const models = setup.setup.model_targets;
  const billingAuth = setup.billing_auth || {};
  const entitlement = billingAuth.entitlement || {};
  const billingUsage = billingAuth.usage || {};
  const accountLifecycle = billingAuth.account_lifecycle || {};
  const authSurface = billingAuth.dashboard_auth_surface || {};

  els.setupBoard.innerHTML = `
    <article class="setup-panel setup-overview">
      <div>
        <span class="panel-kicker">Setup readiness</span>
        <h2>${setup.brand.name}</h2>
        <p>${setup.brand.website_url} · ${formatStatus(setup.brand.vertical)} · ${setup.brand.locale}</p>
      </div>
      <div class="setup-readiness">
        ${chip('Readiness', setup.readiness.status)}
        <small>${setup.readiness.next_step}</small>
      </div>
    </article>

    <article class="setup-panel">
      <span class="panel-kicker">Plan</span>
      <h2>${plan.name}</h2>
      <div class="setup-list">
        <div><span>Prompts</span><strong>${prompts.selected_count}/${plan.limits.prompts}</strong></div>
        <div><span>Models</span><strong>${models.selected_count}/${plan.limits.models}</strong></div>
        <div><span>Competitors</span><strong>${competitors.selected_count}/${plan.limits.competitors}</strong></div>
      </div>
    </article>

    <article class="setup-panel">
      <span class="panel-kicker">Quota</span>
      <h2>${formatStatus(quota.status)}</h2>
      <div class="setup-list">
        <div><span>Calls / run</span><strong>${compactNumber(quota.tracking_calls_per_run)}</strong></div>
        <div><span>Monthly estimate</span><strong>${compactNumber(quota.estimated_monthly_provider_calls)}</strong></div>
        <div><span>Remaining</span><strong>${quota.provider_calls_remaining_this_month === null ? 'Not capped' : compactNumber(quota.provider_calls_remaining_this_month)}</strong></div>
      </div>
    </article>

    <article class="setup-panel">
      <span class="panel-kicker">Account</span>
      <h2>${formatStatus(authSurface.dashboard_access || entitlement.state || billingAuth.status || 'unknown')}</h2>
      <div class="setup-list">
        <div><span>Access</span><strong>${formatStatus(entitlement.customer_access || 'unknown')}</strong></div>
        <div><span>Lifecycle</span><strong>${formatStatus(accountLifecycle.lifecycle?.subscription_state || setup.customer.status)}</strong></div>
        <div><span>Provider calls</span><strong>${compactNumber(billingUsage.provider_calls_used || 0)}/${billingUsage.provider_calls_limit || 'n/a'}</strong></div>
        <div><span>Auth</span><strong>${formatStatus(authSurface.status || 'not connected')}</strong></div>
      </div>
    </article>

    <article class="setup-panel setup-wide">
      <span class="panel-kicker">Tracking inputs</span>
      <div class="setup-columns">
        <div>
          <h2>Competitors</h2>
          <p>${competitors.items.map((item) => item.name).join(', ') || 'No competitors configured.'}</p>
        </div>
        <div>
          <h2>Prompts</h2>
          <p>${prompts.categories.map((item) => `${formatStatus(item.category)} (${item.count})`).join(', ') || 'No prompts configured.'}</p>
        </div>
        <div>
          <h2>Models</h2>
          <p>${models.items.map((item) => item.display_name).join(', ') || 'No models selected.'}</p>
        </div>
      </div>
    </article>
  `;
}

function activePromptDiscoveryCandidates(payload) {
  const group = payload.groups.find((item) => item.id === state.selectedPromptGroup) || payload.groups[0];
  const ids = new Set(group?.candidate_ids || []);
  return payload.candidates.filter((candidate) => ids.has(candidate.id));
}

function candidateIsLocked(candidate) {
  return ['confirmed', 'rejected', 'archived'].includes(candidate?.status);
}

function candidateIsSelected(candidate) {
  return ['shortlisted', 'approved', 'edited'].includes(candidate?.status);
}

function promptActionNotice() {
  return state.promptActionMessage ? `<div class="action-notice prompt-action-notice">${state.promptActionMessage}</div>` : '';
}

function promptActionButton({ action, label, candidate, secondary = false, disabled = false }) {
  return `
    <button
      class="action-button prompt-action-button ${secondary ? 'is-secondary' : ''}"
      data-prompt-action="${action}"
      data-prompt-candidate-id="${candidate.id}"
      ${state.promptActionPending || disabled ? 'disabled' : ''}
    >
      ${label}
    </button>
  `;
}

function renderPromptCandidateActions(candidate, payload) {
  if (!candidate) return '';
  const locked = candidateIsLocked(candidate);
  const selected = candidateIsSelected(candidate);
  const confirmDisabled = (!selected || payload.quota.remaining_prompt_slots <= 0) && candidate.status !== 'confirmed';

  return `
    <section class="prompt-detail-section prompt-action-section">
      <h3>Customer actions</h3>
      <div class="prompt-action-grid">
        ${!selected && !locked ? promptActionButton({ action: 'select', label: 'Select', candidate }) : ''}
        ${!locked ? promptActionButton({ action: 'confirm', label: 'Confirm', candidate, disabled: confirmDisabled }) : ''}
        ${!locked ? promptActionButton({ action: 'reject', label: 'Reject', candidate, secondary: true }) : ''}
      </div>
      ${
        !locked
          ? `
            <div class="prompt-edit-box">
              <textarea
                data-prompt-edit-text="${candidate.id}"
                rows="4"
                ${state.promptActionPending ? 'disabled' : ''}
              >${candidate.candidate_text}</textarea>
              <button
                class="action-button is-secondary prompt-action-button"
                data-prompt-action="edit"
                data-prompt-candidate-id="${candidate.id}"
                ${state.promptActionPending ? 'disabled' : ''}
              >
                Save edit
              </button>
            </div>
          `
          : `<div class="empty">This candidate is ${formatStatus(candidate.status)} and cannot be changed from the customer dashboard.</div>`
      }
      <p class="monthly-muted">Selecting or editing does not count against quota. Confirmation uses ${compactNumber(candidate.quota_impact)} prompt slot.</p>
      ${!selected && !locked ? '<div class="action-notice">Select or save an edit before confirmation.</div>' : ''}
      ${selected && payload.quota.remaining_prompt_slots <= 0 ? '<div class="action-notice">Plan prompt limit reached. Confirmation is blocked.</div>' : ''}
      ${promptActionNotice()}
    </section>
  `;
}

async function refreshPromptDiscoveryFromResult(result) {
  if (result?.prompt_discovery) {
    state.promptDiscovery = result.prompt_discovery;
    const candidateStillVisible = state.promptDiscovery.candidates.some((candidate) => candidate.id === state.selectedCandidateId);
    if (!candidateStillVisible) {
      state.selectedCandidateId = state.promptDiscovery.candidates[0]?.id || null;
    }
    renderPromptDiscovery();
    return;
  }
  await loadPromptDiscovery();
}

async function submitPromptCandidateAction(candidateId, action) {
  const candidate = state.promptDiscovery?.candidates.find((item) => item.id === candidateId);
  if (!candidate) return;

  let payload = {
    action,
    actor: 'customer_dashboard',
    note: `Customer ${action} action from dashboard.`
  };
  let endpoint = `/dashboard/prompt-discovery/candidates/${encodeURIComponent(candidateId)}/action`;

  if (action === 'edit') {
    const textArea = els.promptDiscoveryBoard.querySelector(`[data-prompt-edit-text="${candidateId}"]`);
    payload.edited_text = textArea?.value || '';
  }

  if (action === 'confirm') {
    const remaining = state.promptDiscovery.quota.remaining_prompt_slots;
    const message = `Confirm this prompt for tracking? It will use ${candidate.quota_impact} of ${remaining} remaining prompt slots.`;
    if (!window.confirm(message)) return;
    endpoint = '/dashboard/prompt-discovery/confirm';
    payload = {
      candidate_ids: [candidateId],
      discovery_run_id: state.promptDiscovery.discovery_run?.id,
      actor: 'customer_dashboard',
      note: 'Customer confirmed this prompt for tracking from the dashboard.'
    };
  }

  state.promptActionPending = true;
  state.promptActionMessage = null;
  renderPromptDiscovery();

  try {
    const { result } = await fetchJson(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    state.promptActionMessage =
      action === 'confirm'
        ? 'Prompt confirmed for tracking.'
        : action === 'edit'
          ? 'Prompt edit saved.'
          : action === 'reject'
            ? 'Candidate rejected.'
            : 'Candidate selected.';
    await refreshPromptDiscoveryFromResult(result);
  } catch (error) {
    state.promptActionMessage = error.message;
    renderPromptDiscovery();
  } finally {
    state.promptActionPending = false;
    renderPromptDiscovery();
  }
}

function renderPromptLibrary(payload) {
  const library = payload.prompt_library;
  if (!library) return '';
  const clusters = library.clusters || [];
  const intentLayers = library.intent_layers || [];
  const priorityQueue = library.priority_queue || [];
  const opportunities = library.prompt_level_opportunities || [];
  const sourceMix = library.industry_prompt_generation?.source_mix || {};

  return `
    <article class="prompt-discovery-panel prompt-library-header">
      <div>
        <span class="panel-kicker">Prompt Library</span>
        <h2>Industry prompt generation, clustering, priority, and opportunity mapping</h2>
        <p>Candidate prompts are organized by buyer intent and scored into trackable prompt-level opportunities before they enter monitoring.</p>
      </div>
      <div class="prompt-library-counts">
        ${metric('Library clusters', library.summary.cluster_count)}
        ${metric('High priority', library.summary.high_priority_count)}
        ${metric('Prompt opportunities', library.summary.prompt_level_opportunity_count)}
      </div>
    </article>

    <article class="prompt-discovery-panel prompt-library-source">
      <span class="panel-kicker">Industry prompt generation</span>
      <div class="prompt-source-grid">
        ${Object.entries(sourceMix)
          .map(([label, count]) => `<div><span>${label}</span><strong>${compactNumber(count)}</strong></div>`)
          .join('')}
      </div>
      <p class="monthly-muted">${library.industry_prompt_generation.generated_from.join(', ')}</p>
    </article>

    <article class="prompt-discovery-panel prompt-library-wide">
      <div class="prompt-library-columns">
        <section>
          <span class="panel-kicker">Prompt clusters</span>
          <div class="prompt-cluster-list">
            ${
              clusters.length
                ? clusters
                    .slice(0, 6)
                    .map(
                      (cluster) => `
                        <div class="prompt-cluster-row">
                          <strong>${cluster.label}</strong>
                          <span>${compactNumber(cluster.candidate_count)} prompts · ${compactNumber(cluster.high_priority_count)} high priority · ${formatStatus(cluster.target_metric)}</span>
                          <small>avg priority ${compactNumber(cluster.avg_priority_score)} · selected ${compactNumber(cluster.selected_count)} · confirmed ${compactNumber(cluster.confirmed_count)}</small>
                        </div>
                      `
                    )
                    .join('')
                : '<div class="empty">No prompt clusters are ready yet.</div>'
            }
          </div>
        </section>

        <section>
          <span class="panel-kicker">Intent layers</span>
          <div class="prompt-intent-stack">
            ${
              intentLayers.length
                ? intentLayers
                    .map(
                      (layer) => `
                        <div class="prompt-intent-row">
                          <strong>${layer.label}</strong>
                          <span>${compactNumber(layer.candidate_count)} prompts · ${compactNumber(layer.high_priority_count)} high priority</span>
                        </div>
                      `
                    )
                    .join('')
                : '<div class="empty">No intent layers are ready yet.</div>'
            }
          </div>
        </section>
      </div>
    </article>

    <article class="prompt-discovery-panel prompt-library-wide">
      <div class="prompt-library-columns">
        <section>
          <span class="panel-kicker">Priority queue</span>
          <div class="prompt-priority-list">
            ${
              priorityQueue.length
                ? priorityQueue
                    .slice(0, 5)
                    .map(
                      (item) => `
                        <div class="prompt-priority-row">
                          <span class="pill ${priorityClass(item.priority_band?.toLowerCase())}">${item.priority_band}</span>
                          <strong>${item.candidate_text}</strong>
                          <small>${item.cluster.label} · ${item.commercial_intent} · score ${compactNumber(item.priority_score)}</small>
                        </div>
                      `
                    )
                    .join('')
                : '<div class="empty">No priority queue is ready yet.</div>'
            }
          </div>
        </section>

        <section>
          <span class="panel-kicker">Prompt-level opportunities</span>
          <div class="prompt-opportunity-list">
            ${
              opportunities.length
                ? opportunities
                    .slice(0, 5)
                    .map(
                      (opportunity) => `
                        <div class="prompt-opportunity-row">
                          <strong>${opportunity.cluster_label}</strong>
                          <span>${formatStatus(opportunity.opportunity_type)} · ${formatStatus(opportunity.target_metric)}</span>
                          <small>${opportunity.recommended_action}</small>
                        </div>
                      `
                    )
                    .join('')
                : '<div class="empty">No prompt-level opportunities are ready yet.</div>'
            }
          </div>
        </section>
      </div>
    </article>
  `;
}

function renderEvidenceCollection(evidenceCollection) {
  if (!evidenceCollection?.provider_runs?.length) return '';
  const summary = evidenceCollection.summary || {};
  return `
    <article class="prompt-discovery-panel prompt-discovery-wide">
      <div class="prompt-detail-head">
        <div>
          <span class="panel-kicker">Evidence collection</span>
          <h2>Provider coverage and skipped sources</h2>
        </div>
        <span class="pill is-info">${compactNumber(summary.evidence_item_count || 0)} evidence items</span>
      </div>
      <div class="prompt-detail-grid">
        ${evidenceCollection.provider_runs
          .map(
            (run) => `
              <div>
                <span>${formatStatus(run.provider)}</span>
                <strong>${formatStatus(run.status)}</strong>
                <small>${run.reason ? formatStatus(run.reason) : `${compactNumber(run.item_count || 0)} items`}</small>
              </div>
            `
          )
          .join('')}
      </div>
    </article>
  `;
}

function renderPromptDiscovery() {
  const payload = state.promptDiscovery;
  if (!payload) {
    els.promptDiscoveryBoard.innerHTML = `
      <article class="prompt-discovery-panel prompt-discovery-empty">
        <span class="panel-kicker">Prompt Discovery</span>
        <h2>No discovery run yet</h2>
        <p>Candidate prompts will appear here after a deterministic discovery run exists for this brand.</p>
      </article>
    `;
    return;
  }

  const candidates = activePromptDiscoveryCandidates(payload);
  const selected = candidates.find((candidate) => candidate.id === state.selectedCandidateId) || candidates[0] || payload.candidates[0];
  if (selected && state.selectedCandidateId !== selected.id) state.selectedCandidateId = selected.id;
  const warningCopy = payload.warnings?.length ? payload.warnings.map(formatStatus).join(', ') : 'No selection warnings.';

  els.promptDiscoveryBoard.innerHTML = `
    <article class="prompt-discovery-panel prompt-discovery-header">
      <div>
        <span class="panel-kicker">Prompt Discovery</span>
        <h2>Review candidate prompts before tracking</h2>
        <p>${payload.readiness.next_step}</p>
      </div>
      <div class="prompt-discovery-counts">
        ${metric('Candidates', payload.candidates.length)}
        ${metric('Confirmed', payload.quota.confirmed_prompt_count)}
        ${metric('Remaining', payload.quota.remaining_prompt_slots)}
      </div>
    </article>

    <article class="prompt-discovery-panel prompt-readiness">
      ${chip('Discovery', payload.readiness.status)}
      ${chip('Selection', payload.readiness.selection_status)}
      ${chip('Tracking', payload.readiness.can_enter_tracking ? 'ready_for_tracking' : 'blocked')}
      ${chip('Review', payload.discovery_run?.status || 'not_started')}
      <div class="prompt-warning">
        <span class="panel-kicker">Warnings</span>
        <strong>${warningCopy}</strong>
      </div>
    </article>

    ${renderEvidenceCollection(payload.evidence_collection)}

    <article class="prompt-discovery-panel prompt-quota">
      <span class="panel-kicker">Quota</span>
      <div class="prompt-quota-grid">
        <div><span>Plan limit</span><strong>${compactNumber(payload.quota.plan_prompt_limit)}</strong></div>
        <div><span>Selected</span><strong>${compactNumber(payload.quota.selected_candidate_count)}</strong></div>
        <div><span>Confirmed</span><strong>${compactNumber(payload.quota.confirmed_prompt_count)}</strong></div>
        <div><span>Candidate impact</span><strong>${payload.quota.candidate_selection_counts_quota ? 'Counts' : 'No quota'}</strong></div>
        <div><span>Confirmation impact</span><strong>${payload.quota.confirmation_counts_quota ? 'Counts' : 'No quota'}</strong></div>
      </div>
    </article>

    ${renderPromptLibrary(payload)}

    <article class="prompt-discovery-panel prompt-discovery-wide">
      <nav class="prompt-group-tabs" aria-label="Prompt candidate groups">
        ${payload.groups
          .map(
            (group) => `
              <button class="prompt-group-tab ${group.id === state.selectedPromptGroup ? 'is-active' : ''}" data-prompt-group="${group.id}">
                <span>${group.label}</span>
                <strong>${compactNumber(group.count)}</strong>
              </button>
            `
          )
          .join('')}
      </nav>
    </article>

    <div class="prompt-discovery-layout">
      <article class="prompt-discovery-panel prompt-candidate-list">
        <span class="panel-kicker">Candidates</span>
        ${
          candidates.length
            ? candidates
                .map(
                  (candidate) => `
                    <button class="prompt-candidate-row ${candidate.id === state.selectedCandidateId ? 'is-active' : ''}" data-candidate-id="${candidate.id}">
                      <span class="pill ${priorityClass(candidate.priority_band?.toLowerCase())}">${candidate.priority_band}</span>
                      <strong>${candidate.candidate_text}</strong>
                      <small>${candidate.cluster?.label || formatStatus(candidate.intent)} · ${candidate.commercial_intent || formatStatus(candidate.funnel_stage)} · ${candidate.evidence_summary?.evidence_backed ? 'Evidence-backed' : candidate.source_label}</small>
                    </button>
                  `
                )
                .join('')
            : '<div class="empty">No candidates in this group.</div>'
        }
      </article>

      <article class="prompt-discovery-panel prompt-candidate-detail">
        ${
          selected
            ? `
              <div class="prompt-detail-head">
                <div>
                  <span class="panel-kicker">${selected.source_label}</span>
                  <h2>${selected.candidate_text}</h2>
                </div>
                <span class="pill ${priorityClass(selected.priority_band?.toLowerCase())}">${selected.priority_band}</span>
              </div>
              <div class="prompt-detail-grid">
                <div><span>Status</span><strong>${formatStatus(selected.status)}</strong></div>
                <div><span>Cluster</span><strong>${selected.cluster?.label || formatStatus(selected.intent)}</strong></div>
                <div><span>Commercial intent</span><strong>${selected.commercial_intent || formatStatus(selected.intent)}</strong></div>
                <div><span>Funnel</span><strong>${formatStatus(selected.funnel_stage)}</strong></div>
                <div><span>Gap</span><strong>${formatStatus(selected.gap_type)}</strong></div>
                <div><span>Priority score</span><strong>${scoreValue(selected.priority_score)}</strong></div>
                <div><span>Quota impact</span><strong>${compactNumber(selected.quota_impact)}</strong></div>
              </div>
              <section class="prompt-detail-section">
                <h3>Prompt-level opportunity</h3>
                <p>${selected.prompt_level_opportunity?.recommended_action || 'Use this prompt to create a measurable visibility opportunity.'}</p>
                <div class="prompt-detail-grid">
                  <div><span>Target metric</span><strong>${formatStatus(selected.prompt_level_opportunity?.target_metric || 'visibility_score')}</strong></div>
                  <div><span>Retest metric</span><strong>${formatStatus(selected.prompt_level_opportunity?.expected_retest_metric || 'visibility_score')}</strong></div>
                  <div><span>Opportunity</span><strong>${formatStatus(selected.prompt_level_opportunity?.opportunity_type || selected.gap_type)}</strong></div>
                </div>
              </section>
              ${
                selected.evidence_summary?.evidence_backed
                  ? `
                    <section class="prompt-detail-section">
                      <h3>Market evidence</h3>
                      <p>This prompt is backed by live web/search evidence, not only local rules.</p>
                      <div class="prompt-evidence-list">
                        ${
                          selected.evidence_summary.source_urls?.length
                            ? selected.evidence_summary.source_urls
                                .map(
                                  (url) => `
                                    <a href="${url}" target="_blank" rel="noreferrer">${domainFromUrl(url) || url}</a>
                                  `
                                )
                                .join('')
                            : '<span class="pill is-info">Evidence source captured</span>'
                        }
                      </div>
                    </section>
                  `
                  : ''
              }
              <section class="prompt-detail-section">
                <h3>Recommendation reason</h3>
                <p>${selected.recommendation_reason}</p>
                <small>${selected.scoring_notice || 'Metrics without qualifying provider evidence are unavailable.'}</small>
              </section>
              <section class="prompt-detail-section">
                <h3>Tags</h3>
                <div class="prompt-tag-list">${selected.tags.map((tag) => `<span class="pill is-info">${tag.name}</span>`).join('')}</div>
              </section>
              ${renderPromptCandidateActions(selected, payload)}
            `
            : '<div class="empty">Select a candidate to inspect details.</div>'
        }
      </article>

      <article class="prompt-discovery-panel prompt-confirmed-panel">
        <span class="panel-kicker">Confirmed prompts</span>
        ${
          payload.confirmed_prompts.length
            ? payload.confirmed_prompts
                .map(
                  (prompt) => `
                    <div class="confirmed-prompt-row">
                      <strong>${prompt.prompt_text}</strong>
                      <span>${formatStatus(prompt.category)} · ${formatStatus(prompt.status)} · quota ${compactNumber(prompt.quota_unit)}</span>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">Confirmed prompts appear here after customer confirmation. Candidates do not enter tracking until confirmed.</div>'
        }
      </article>
    </div>
  `;

  for (const button of els.promptDiscoveryBoard.querySelectorAll('[data-prompt-group]')) {
    button.addEventListener('click', () => {
      state.selectedPromptGroup = button.dataset.promptGroup;
      const next = activePromptDiscoveryCandidates(payload)[0] || payload.candidates[0];
      state.selectedCandidateId = next?.id || null;
      renderPromptDiscovery();
    });
  }

  for (const button of els.promptDiscoveryBoard.querySelectorAll('[data-candidate-id]')) {
    button.addEventListener('click', () => {
      state.selectedCandidateId = button.dataset.candidateId;
      renderPromptDiscovery();
    });
  }

  for (const button of els.promptDiscoveryBoard.querySelectorAll('[data-prompt-action]')) {
    button.addEventListener('click', async () => {
      await submitPromptCandidateAction(button.dataset.promptCandidateId, button.dataset.promptAction);
    });
  }
}

function scoreValue(score) {
  return score === null || score === undefined ? 'Not ready' : compactNumber(score);
}

function percentValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(number % 1 === 0 ? 0 : 1)}%` : '0%';
}

function externalEngineLabel(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('google_aio') || raw.includes('google ai overview') || raw.includes('ai overview')) return 'Google AI Overview';
  if (raw.includes('perplexity') || raw.includes('sonar')) return 'Perplexity';
  if (raw.includes('chatgpt') || raw.includes('openai') || raw.includes('gpt-')) return 'ChatGPT';
  if (raw.includes('gemini') || raw.includes('google/')) return 'Gemini';
  if (raw.includes('claude') || raw.includes('anthropic')) return 'Claude';
  if (raw.includes('grok') || raw.includes('x-ai')) return 'Grok';
  if (raw.includes('deepseek')) return 'DeepSeek';
  if (raw.includes('qwen') || raw.includes('qianwen')) return 'Qwen';
  if (raw.includes('llama') || raw.includes('mistral') || raw.includes('mock')) return 'Other AI Engine';
  return value ? text(value) : 'AI Engine';
}

function domainFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./u, '');
  } catch {
    return null;
  }
}

function engineInitial(label) {
  return String(label || 'AI').split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase();
}

function engineRowsFromVisibility(report) {
  const byEngine = new Map();
  for (const row of report?.breakdowns?.models || []) {
    const label = externalEngineLabel(row.model_id);
    const existing =
      byEngine.get(label) ||
      {
        label,
        count: 0,
        brandRateTotal: 0,
        sourceRateTotal: 0,
        competitorRateTotal: 0
      };
    existing.count += 1;
    existing.brandRateTotal += Number(row.brand_mention_rate || 0);
    existing.sourceRateTotal += Number(row.source_coverage_rate || 0);
    existing.competitorRateTotal += Number(row.competitor_source_rate || 0);
    byEngine.set(label, existing);
  }

  return [...byEngine.values()].map((row) => ({
    label: row.label,
    brand_mention_label: percentValue(row.brandRateTotal / row.count),
    source_coverage_label: percentValue(row.sourceRateTotal / row.count),
    competitor_source_label: percentValue(row.competitorRateTotal / row.count)
  }));
}

function engineRowsFromMonitoring(monitoring) {
  const byEngine = new Map();
  for (const row of monitoring?.current?.model_share_of_voice || []) {
    const label = externalEngineLabel(row.model_id);
    const existing =
      byEngine.get(label) ||
      {
        label,
        result_count: 0,
        total_voice_mentions: 0,
        brandSovTotal: 0,
        count: 0,
        competitors: []
      };
    existing.count += 1;
    existing.result_count += Number(row.result_count || 0);
    existing.total_voice_mentions += Number(row.total_voice_mentions || 0);
    existing.brandSovTotal += Number(row.brand_share_of_voice || 0);
    existing.competitors.push(...(row.competitors || []));
    byEngine.set(label, existing);
  }

  return [...byEngine.values()]
    .map((row) => ({
      ...row,
      brand_share_of_voice: row.count ? Number((row.brandSovTotal / row.count).toFixed(2)) : 0,
      competitors: row.competitors.sort((a, b) => Number(b.share_of_voice || 0) - Number(a.share_of_voice || 0)).slice(0, 3)
    }))
    .sort((a, b) => b.brand_share_of_voice - a.brand_share_of_voice);
}

function primaryActionTitle() {
  return (
    state.opportunities?.opportunities?.[0]?.recommendation?.title ||
    state.opportunities?.opportunities?.[0]?.title ||
    state.visibility?.next_actions?.[0]?.title ||
    state.monthlyReport?.recommended_next_moves?.[0]?.title ||
    'Review the highest-pressure prompts and ship the next content asset.'
  );
}

function visibilityMentionRate(report) {
  const parsed = Number(report?.coverage?.parsed_answers || 0);
  if (!parsed) return 0;
  return Number(((Number(report?.coverage?.brand_mentions || 0) / parsed) * 100).toFixed(1));
}

function competitorGapLabel(competitor) {
  if (!competitor) return 'No gap';
  if (competitor.share_of_voice !== undefined && competitor.share_of_voice !== null) {
    return `${competitor.name} ${percentValue(competitor.share_of_voice)}`;
  }
  return `${competitor.name} ${compactNumber(competitor.mention_count || 0)} mentions`;
}

function sourceTypeLabel(type) {
  const labels = {
    owned: 'Owned',
    earned: 'Earned',
    competitor: 'Competitor',
    directory: 'Directory',
    unknown: 'Unknown'
  };
  return labels[type] || formatStatus(type || 'unknown');
}

function filteredSources(sources = []) {
  if (state.sourceTypeFilter === 'all') return sources;
  return sources.filter((source) => source.source_type === state.sourceTypeFilter);
}

function renderSourceTypeFilters(mix = {}) {
  const filters = [
    ['all', 'All'],
    ['owned', `Owned ${compactNumber(mix.owned || 0)}`],
    ['earned', `Earned ${compactNumber(mix.earned || 0)}`],
    ['competitor', `Competitor ${compactNumber(mix.competitor || 0)}`],
    ['directory', `Directory ${compactNumber(mix.directory || 0)}`]
  ];
  return `
    <nav class="source-filter-tabs" aria-label="Source type filters">
      ${filters
        .map(
          ([value, label]) => `
            <button class="source-filter-tab ${state.sourceTypeFilter === value ? 'is-active' : ''}" data-source-filter="${value}">
              ${label}
            </button>
          `
        )
        .join('')}
    </nav>
  `;
}

function renderSourceIntelligence(report) {
  const sourceIntel = report.source_intelligence || {};
  const summary = sourceIntel.summary || {};
  const decision = sourceIntel.citation_gap_decision_layer || {};
  const topUrls = filteredSources(sourceIntel.top_urls || []).slice(0, 8);
  const gaps = sourceIntel.missing_official_citation_opportunities || [];
  const leakage = sourceIntel.competitor_leakage || [];

  return `
    <article class="visibility-panel visibility-wide source-intelligence-panel">
      <div class="section-head">
        <div>
          <span class="panel-kicker">Source Intelligence</span>
          <h2>URL and domain-level citation analysis</h2>
        </div>
        <div class="source-intel-metrics">
          ${metric('Top cited URLs', summary.cited_url_count || 0)}
          ${metric('Prompt gaps', summary.prompt_gap_count || 0)}
          ${metric('Owned citations', summary.owned_citation_count || 0)}
          ${metric('Competitor citations', summary.competitor_citation_count || 0)}
        </div>
      </div>
      ${renderSourceTypeFilters(sourceIntel.source_type_mix || {})}
      <div class="source-intelligence-grid">
        <section>
          <h3>Top cited URLs</h3>
          ${
            topUrls.length
              ? topUrls
                  .map(
                    (source) => `
                      <div class="source-url-row">
                        <div>
                          <span class="pill is-info">${sourceTypeLabel(source.source_type)}</span>
                          <strong>${source.domain || source.source_name || 'Unknown domain'}</strong>
                          <small>${source.url || 'Domain-level source'} · ${compactNumber(source.prompt_count)} prompts · ${compactNumber(source.model_count)} models</small>
                        </div>
                        <em>${(source.prompts || []).slice(0, 2).join(' · ')}</em>
                      </div>
                    `
                  )
                  .join('')
              : '<div class="empty">No cited URLs match this filter.</div>'
          }
        </section>
        <section>
          <h3>Citation gaps</h3>
          ${
            gaps.length
              ? gaps
                  .slice(0, 5)
                  .map(
                    (gap) => `
                      <div class="source-gap-row">
                        <strong>${gap.prompt_text}</strong>
                        <span>${formatStatus(gap.category)} · ${externalEngineLabel(gap.model_id)} · ${gap.reason}</span>
                        <small>${gap.recommended_asset}</small>
                      </div>
                    `
                  )
                  .join('')
              : '<div class="empty">No missing official citation gaps detected.</div>'
          }
        </section>
        <section>
          <h3>Competitor source leakage</h3>
          ${
            leakage.length
              ? leakage
                  .slice(0, 5)
                  .map(
                    (item) => `
                      <div class="source-gap-row">
                        <strong>${item.source_name || item.domain || 'Competitor source'}</strong>
                        <span>${item.prompt_text}</span>
                        <small>${item.domain} · ${externalEngineLabel(item.model_id)}</small>
                      </div>
                    `
                  )
                  .join('')
              : '<div class="empty">No competitor-owned source leakage detected.</div>'
          }
        </section>
      </div>
      <div class="citation-decision-layer">
        <div class="section-head">
          <div>
            <span class="panel-kicker">Source / Citation Gap</span>
            <h3>Unified growth moves</h3>
            <p>${decision.unified_customer_summary || 'Source influence, target placements, competitor pages, and next actions are summarized here after measurement.'}</p>
          </div>
        </div>
        <div class="source-intelligence-grid">
          <section>
            <h3>Influential sources</h3>
            ${
              (decision.influential_sources || []).length
                ? decision.influential_sources
                    .slice(0, 5)
                    .map(
                      (source) => `
                        <div class="source-gap-row">
                          <strong>${source.domain || source.source_name || 'Measured source'}</strong>
                          <span>${sourceTypeLabel(source.source_type)} · influence ${compactNumber(source.influence_score)} · ${compactNumber(source.prompt_count)} prompts</span>
                          <small>${source.why_it_matters || 'This source appears in measured AI answer evidence.'}</small>
                        </div>
                      `
                    )
                    .join('')
                : '<div class="empty">Influential sources will appear after cited answers are measured.</div>'
            }
          </section>
          <section>
            <h3>Sources to win</h3>
            ${
              (decision.target_sources_to_win || []).length
                ? decision.target_sources_to_win
                    .slice(0, 5)
                    .map(
                      (source) => `
                        <div class="source-gap-row">
                          <strong>${source.domain || source.source_name || 'Target source'}</strong>
                          <span>${formatStatus(source.action_type)} · priority ${compactNumber(source.priority_score)}</span>
                          <small>${source.recommendation || 'Win this source as a citation or proof point.'}</small>
                        </div>
                      `
                    )
                    .join('')
                : '<div class="empty">No target source placement is required from this cycle.</div>'
            }
          </section>
          <section>
            <h3>Competitor shaping pages</h3>
            ${
              (decision.competitor_shaping_pages || []).length
                ? decision.competitor_shaping_pages
                    .slice(0, 5)
                    .map(
                      (source) => `
                        <div class="source-gap-row">
                          <strong>${source.domain || source.source_name || 'Competitor source'}</strong>
                          <span>${source.url || 'Competitor-owned page'} · ${compactNumber(source.prompt_count)} prompts</span>
                          <small>${source.recommended_response || 'Create or strengthen a comparison response.'}</small>
                        </div>
                      `
                    )
                    .join('')
                : '<div class="empty">No competitor shaping pages were detected.</div>'
            }
          </section>
        </div>
        <div class="recommended-action-list">
          ${
            (decision.recommended_actions || []).length
              ? decision.recommended_actions
                  .slice(0, 6)
                  .map(
                    (action) => `
                      <div class="recommended-action-row">
                        <span class="pill is-info">${formatStatus(action.action_type)}</span>
                        <strong>${action.title}</strong>
                        <small>${action.rationale} Success: ${action.success_measure}</small>
                      </div>
                    `
                  )
                  .join('')
              : '<div class="empty">Recommended source actions will appear after source gaps are detected.</div>'
          }
        </div>
      </div>
    </article>
  `;
}

function renderAiOverview() {
  const report = state.visibility;
  if (!els.aiOverviewBoard) return;
  if (!report) {
    els.aiOverviewBoard.innerHTML = '';
    return;
  }

  const measurement = report.measurement || {};
  const isMock = measurement.score_meaning === 'pipeline_validation' || measurement.mode === 'mock';
  const scoreMap = new Map((report.scorecards || []).map((score) => [score.key, score]));
  const currentSov = state.monitoring?.current?.share_of_voice || {};
  const engineRows = engineRowsFromMonitoring(state.monitoring);
  const fallbackEngines = engineRowsFromVisibility(report);
  const engines = engineRows.length
    ? engineRows
    : fallbackEngines.map((engine) => ({
        label: engine.label,
        brand_share_of_voice: Number.parseFloat(engine.brand_mention_label) || 0,
        result_count: report.coverage?.parsed_answers || 0,
        total_voice_mentions: report.coverage?.brand_mentions + report.coverage?.competitor_mentions || 0,
        competitors: []
      }));
  const sourceSummary = report.source_intelligence?.summary || {};
  const topCompetitor = state.monitoring?.current?.share_of_voice?.competitors?.[0] || report.competitor_pressure?.competitors?.[0];
  const firstAction = primaryActionTitle();
  const promptMovement = state.monitoring?.deltas?.vs_previous?.visibility_score;
  const citationMovement = state.monitoring?.deltas?.vs_previous?.source_quality_score;

  els.aiOverviewBoard.innerHTML = `
    <article class="ai-overview-hero">
      <div class="ai-hero-copy">
        <span class="panel-kicker">AI Engine Visibility Overview</span>
        <h2>${report.brand.name} ${isMock ? 'has a safe test-cycle view ready.' : 'is being measured across major AI answer engines.'}</h2>
        <p>${isMock ? 'Customer-facing layout is ready; live AI engine scoring can be enabled from controlled gates later.' : 'Customer-ready visibility signal across major AI answer engines.'}</p>
      </div>
      <div class="ai-hero-metrics">
        <div>
          <span>AI Search Visibility</span>
          <strong>${scoreValue(scoreMap.get('visibility')?.score)}</strong>
        </div>
        <div>
          <span>Share of Voice</span>
          <strong>${percentValue(currentSov.brand_share_of_voice ?? visibilityMentionRate(report))}</strong>
        </div>
        <div>
          <span>Citation Footprint</span>
          <strong>${compactNumber(report.coverage?.source_urls || 0)}</strong>
        </div>
        <div>
          <span>Competitor Gap</span>
          <strong>${competitorGapLabel(topCompetitor)}</strong>
        </div>
      </div>
    </article>

    <article class="ai-overview-panel ai-engine-map">
      <div class="ai-panel-head">
        <span class="panel-kicker">Major AI engines</span>
        <strong>ChatGPT · Perplexity · Google AI Overview · Gemini · Claude · Grok</strong>
      </div>
      <div class="ai-engine-grid">
        ${
          engines.length
            ? engines
                .slice(0, 6)
                .map(
                  (engine) => `
                    <div class="ai-engine-card">
                      <span class="ai-engine-mark">${engineInitial(engine.label)}</span>
                      <div>
                        <strong>${engine.label}</strong>
                        <small>${percentValue(engine.brand_share_of_voice)} SOV · ${compactNumber(engine.result_count || 0)} answers</small>
                      </div>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">No customer-facing AI engine data is ready yet.</div>'
        }
      </div>
    </article>

    <article class="ai-overview-panel">
      <span class="panel-kicker">Prompt movement</span>
      <strong class="ai-panel-number">${promptMovement ?? 'n/a'}</strong>
      <p>${formatStatus(state.monitoring?.deltas?.vs_previous?.visibility_status || 'not_enough_history')}</p>
    </article>

    <article class="ai-overview-panel">
      <span class="panel-kicker">Citation movement</span>
      <strong class="ai-panel-number">${citationMovement ?? 'n/a'}</strong>
      <p>${compactNumber(sourceSummary.unique_domains || report.source_mix?.top_domains?.length || 0)} domains watched</p>
    </article>

    <article class="ai-overview-panel ai-action-panel">
      <span class="panel-kicker">Next Growth Move</span>
      <strong>${firstAction}</strong>
      <p>${state.opportunities?.summary?.ready_count || report.next_actions?.length || 0} measured actions ready</p>
    </article>
  `;
  scheduleChineseText(els.aiOverviewBoard);
}

function renderVisibility() {
  const report = state.visibility;
  if (!report) {
    els.visibilityBoard.innerHTML = '';
    renderAiOverview();
    return;
  }

  const measurement = report.measurement || {};
  const isMock = measurement.score_meaning === 'pipeline_validation' || measurement.mode === 'mock';
  els.brandLine.textContent = `${report.brand.name} · AI Engine Visibility · ${isMock ? 'Safe test cycle' : 'AI engine cycle'}`;
  els.pageTitle.textContent = 'AI Engine Visibility';
  els.summaryStrip.innerHTML = report.scorecards
    .map((score) => metric(score.label, scoreValue(score.score)))
    .join('');

  const engines = engineRowsFromVisibility(report).slice(0, 6);
  const categories = report.breakdowns.categories.slice(0, 5);
  const sources = report.source_mix.top_domains.slice(0, 5);
  const competitors = report.competitor_pressure.competitors.slice(0, 5);
  const answers = report.highlighted_answers.slice(0, 4);

  els.visibilityBoard.innerHTML = `
    <article class="visibility-panel visibility-summary">
      <span class="panel-kicker">${isMock ? 'Mock validation' : 'AI visibility'}</span>
      <h2>${isMock ? 'Pipeline validation completed. Live AI visibility has not been measured for this run.' : report.headline}</h2>
      <div class="measurement-banner ${isMock ? 'is-mock' : 'is-live'}">
        <strong>${measurement.label || (isMock ? 'Mock pipeline validation' : 'Live provider measurement')}</strong>
        <span>${measurement.caveat || 'Measurement metadata was not available for this report.'}</span>
      </div>
      <div class="visibility-score-grid">
        ${report.scorecards
          .map(
            (score) => `
              <div class="visibility-score ${pillClass(score.status)}">
                <span>${score.label}</span>
                <strong>${scoreValue(score.score)}</strong>
                <small>${
                  isMock ? 'pipeline check only' : formatStatus(score.status)
                } · ${score.direction === 'lower_is_better' ? 'lower is better' : 'higher is better'}</small>
              </div>
            `
          )
          .join('')}
      </div>
      <p class="visibility-caveat">${report.caveats[0] || 'Scores are based on measured prompt results.'}</p>
    </article>

    <article class="visibility-panel">
      <span class="panel-kicker">Coverage</span>
      <div class="visibility-facts">
        <div><span>Parsed answers</span><strong>${compactNumber(report.coverage.parsed_answers)}</strong></div>
        <div><span>Brand mentions</span><strong>${compactNumber(report.coverage.brand_mentions)}</strong></div>
        <div><span>Competitor mentions</span><strong>${compactNumber(report.coverage.competitor_mentions)}</strong></div>
        <div><span>Source URLs</span><strong>${compactNumber(report.coverage.source_urls)}</strong></div>
      </div>
    </article>

    <article class="visibility-panel">
      <span class="panel-kicker">AI Engine breakdown</span>
      ${renderRows(engines, (item) => item.label, (item) => `${item.brand_mention_label} brand · ${item.source_coverage_label} sourced`)}
    </article>

    <article class="visibility-panel">
      <span class="panel-kicker">Prompt categories</span>
      ${renderRows(categories, (item) => formatStatus(item.category), (item) => `${item.brand_mention_label} brand · ${item.competitor_source_label} competitor sources`)}
    </article>

    <article class="visibility-panel">
      <span class="panel-kicker">Source mix</span>
      ${renderRows(sources, (item) => item.domain || item.source_name || 'Unknown source', (item) => `${formatStatus(item.source_type)} · ${compactNumber(item.result_count)} answers`)}
    </article>

    <article class="visibility-panel">
      <span class="panel-kicker">Competitor pressure</span>
      ${renderRows(competitors, (item) => item.name, (item) => `${compactNumber(item.mention_count)} mentions · ${compactNumber(item.mentioned_result_count)} answers`)}
    </article>

    ${renderSourceIntelligence(report)}

    <article class="visibility-panel visibility-wide">
      <span class="panel-kicker">Representative answers</span>
      <div class="answer-grid">
        ${answers
          .map(
            (item) => `
              <div class="answer-card">
                <strong>${formatStatus(item.category)} · ${externalEngineLabel(item.model_id || item.provider_id)}</strong>
                <p>${item.prompt_text}</p>
                <blockquote>${item.answer_excerpt || 'Answer excerpt not available.'}</blockquote>
                <small>${item.brand_mentioned ? 'Brand mentioned' : 'Brand missing'} · ${compactNumber(item.competitor_mentions)} competitor mentions · ${compactNumber(item.source_url_count)} source URLs</small>
              </div>
            `
          )
          .join('')}
      </div>
    </article>

    <article class="visibility-panel visibility-wide">
      <span class="panel-kicker">Measured next actions</span>
      <div class="next-action-list">
        ${report.next_actions
          .map(
            (action) => `
              <div class="next-action">
                <span class="pill ${action.priority === 'high' ? 'is-alert' : 'is-info'}">${formatStatus(action.priority)}</span>
                <strong>${action.title}</strong>
                ${renderActionEvidence(action)}
                ${renderActionPrompts(action)}
                ${renderActionSteps(action)}
                ${
                  action.deliverable || action.success_measure
                    ? `
                      <div class="action-outcome">
                        ${action.deliverable ? `<span><b>Deliverable</b>${action.deliverable}</span>` : ''}
                        ${action.success_measure ? `<span><b>Success measure</b>${action.success_measure}</span>` : ''}
                      </div>
                    `
                    : ''
                }
                <small>${action.note}</small>
              </div>
            `
          )
          .join('')}
      </div>
    </article>
  `;

  for (const button of els.visibilityBoard.querySelectorAll('[data-source-filter]')) {
    button.addEventListener('click', () => {
      state.sourceTypeFilter = button.dataset.sourceFilter;
      renderVisibility();
    });
  }
  renderAiOverview();
}

function renderMonitoring() {
  const monitoring = state.monitoring;
  if (!els.monitoringBoard) return;
  if (!monitoring) {
    els.monitoringBoard.innerHTML = '';
    renderAiOverview();
    return;
  }
  const current = monitoring.current || {};
  const previous = monitoring.previous;
  const baseline = monitoring.baseline || {};
  const deltas = monitoring.deltas?.vs_previous || {};
  const points = monitoring.trend_points || [];
  const config = monitoring.configuration || {};
  const alerts = monitoring.alerts || [];
  const segmentation = monitoring.segmentation || {};
  const currentSov = current.share_of_voice || {};
  const competitorSov = currentSov.competitors || [];
  const engineSov = engineRowsFromMonitoring(monitoring);
  const modelSovTrend = buildModelSovTrend(points);
  const isConfigured = config.status === 'active';
  const productionCycle = monitoring.production_cycle || {};
  const surfaces = productionCycle.surfaces || [];

  els.monitoringBoard.innerHTML = `
    <article class="monitoring-panel monitoring-header">
      <div>
        <span class="panel-kicker">Recurring monitoring</span>
        <h2>${monitoring.readiness?.next_step || 'Baseline and recurring retest state is ready.'}</h2>
        <p class="monthly-muted">
          ${isConfigured ? `Locked prompt set: ${config.locked_prompt_set_id || 'current run prompt set'} · ${segmentation.region || config.region || 'US'} · next cycle ${config.next_run_at || monitoring.cadence?.next_retest_window_start || 'not scheduled'}` : 'Configure monitoring to lock this run as the baseline and schedule future recurring cycles.'}
        </p>
      </div>
      <div class="monitoring-counts">
        ${metric('Baseline', baseline.visibility_score ?? 'n/a')}
        ${metric('Current', current.visibility_score ?? 'n/a')}
        ${metric('Previous', previous?.visibility_score ?? 'n/a')}
        ${metric('Brand SOV', `${compactNumber(currentSov.brand_share_of_voice ?? 0)}%`)}
      </div>
    </article>
    <article class="monitoring-panel monitoring-config">
      <span class="panel-kicker">Configure monitoring</span>
      <div class="monitoring-form">
        <label>
          <span>Cadence days</span>
          <input id="monitoringCadenceDays" type="number" min="1" max="90" value="${config.cadence_days || monitoring.cadence?.recommended_days || 30}" ${state.actionPending ? 'disabled' : ''} />
        </label>
        <label>
          <span>Monitoring mode</span>
          <select id="monitoringProviderMode" ${state.actionPending ? 'disabled' : ''}>
            <option value="mock" ${config.provider_mode !== 'openrouter' ? 'selected' : ''}>Safe test cycle</option>
            <option value="openrouter" ${config.provider_mode === 'openrouter' ? 'selected' : ''}>AI engine cycle</option>
          </select>
        </label>
        <label>
          <span>Region</span>
          <select id="monitoringRegion" ${state.actionPending ? 'disabled' : ''}>
            <option value="US" ${(config.region || segmentation.region || 'US') === 'US' ? 'selected' : ''}>US</option>
          </select>
        </label>
        <button class="action-button" data-monitoring-action="configure" ${state.actionPending ? 'disabled' : ''}>Configure monitoring</button>
        ${isConfigured ? `<button class="action-button is-secondary" data-monitoring-action="pause" ${state.actionPending ? 'disabled' : ''}>Pause monitoring</button>` : ''}
      </div>
    </article>
    <article class="monitoring-panel monitoring-wide">
      <span class="panel-kicker">Multi-engine production cycle</span>
      <h3>${productionCycle.customer_positioning || 'Each AI answer surface is tracked separately and rolled into one customer-facing view.'}</h3>
      <div class="surface-cycle-grid">
        ${
          surfaces.length
            ? surfaces
                .map(
                  (surface) => `
                    <div class="surface-cycle-card">
                      <strong>${surface.label}</strong>
                      <span>${formatStatus(surface.status)} · every ${compactNumber(surface.cadence_days)} days · ${surface.region || 'US'}</span>
                      <small>${formatStatus(surface.provider_mode)} · next ${surface.next_run_at || 'not scheduled'} · key ${surface.required_key || 'n/a'}</small>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">Configure monitoring to create ChatGPT, Perplexity, Google AIO, Gemini, Claude, and Grok cycles.</div>'
        }
      </div>
    </article>
    <article class="monitoring-panel">
      <span class="panel-kicker">Score movement</span>
      <div class="monitoring-deltas">
        <div><span>Visibility</span><strong>${deltas.visibility_score ?? 'n/a'}</strong><small>${formatStatus(deltas.visibility_status || 'not_enough_history')}</small></div>
        <div><span>Source quality</span><strong>${deltas.source_quality_score ?? 'n/a'}</strong><small>${formatStatus(deltas.source_quality_status || 'not_enough_history')}</small></div>
        <div><span>Competitor pressure</span><strong>${deltas.competitor_pressure_score ?? 'n/a'}</strong><small>${formatStatus(deltas.competitor_pressure_status || 'not_enough_history')}</small></div>
        <div><span>Brand SOV</span><strong>${deltas.brand_share_of_voice ?? 'n/a'}</strong><small>${formatStatus(deltas.brand_share_of_voice_status || 'not_enough_history')}</small></div>
      </div>
    </article>
    <article class="monitoring-panel">
      <span class="panel-kicker">Share of voice</span>
      <div class="sov-stack">
        <div class="sov-row is-brand">
          <span>${monitoring.brand?.name || 'Brand'}</span>
          <strong>${compactNumber(currentSov.brand_share_of_voice ?? 0)}%</strong>
        </div>
        ${
          competitorSov.length
            ? competitorSov
                .slice(0, 4)
                .map(
                  (competitor) => `
                    <div class="sov-row">
                      <span>${competitor.name}</span>
                      <strong>${compactNumber(competitor.share_of_voice)}%</strong>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">No competitor voice detected in this cycle.</div>'
        }
      </div>
      <p class="monthly-muted">${compactNumber(currentSov.total_voice_mentions || 0)} total brand + competitor mentions in ${formatStatus(segmentation.region || 'US')}.</p>
    </article>
    <article class="monitoring-panel monitoring-wide">
      <span class="panel-kicker">AI Engine SOV</span>
      <div class="model-sov-grid">
        ${
          engineSov.length
            ? engineSov
                .map(
                  (engine) => `
                    <div class="model-sov-card">
                      <strong>${engine.label}</strong>
                      <div class="model-sov-score">
                        <span>Brand SOV</span>
                        <b>${compactNumber(engine.brand_share_of_voice)}%</b>
                      </div>
                      <small>${compactNumber(engine.result_count)} answers · ${compactNumber(engine.total_voice_mentions)} voice mentions</small>
                      <div class="model-sov-competitors">
                        ${
                          engine.competitors?.length
                            ? engine.competitors
                                .slice(0, 3)
                                .map((competitor) => `<span>${competitor.name} ${compactNumber(competitor.share_of_voice)}%</span>`)
                                .join('')
                            : '<span>No competitor voice</span>'
                        }
                      </div>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">No AI engine SOV is available for this cycle.</div>'
        }
      </div>
    </article>
    <article class="monitoring-panel monitoring-wide">
      <span class="panel-kicker">AI Engine SOV trend</span>
      <div class="model-trend-table">
        ${
          modelSovTrend.length
            ? modelSovTrend
                .map(
                  (row) => `
                    <div class="model-trend-row">
                      <strong>${row.model_id}</strong>
                      <span>${row.points.map((point) => `${point.date}: ${compactNumber(point.brand_share_of_voice)}%`).join(' · ')}</span>
                      <small>latest ${compactNumber(row.latest)}% · ${formatStatus(row.status)}</small>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">AI engine SOV trend will appear after scored cycles exist.</div>'
        }
      </div>
    </article>
    <article class="monitoring-panel monitoring-wide">
      <span class="panel-kicker">Trend</span>
      <div class="trend-list">
        ${
          points.length
            ? points
                .map(
                  (point) => `
                    <div class="trend-row">
                      <strong>${new Date(point.created_at).toLocaleDateString('en-US')}</strong>
                      <span>V ${compactNumber(point.visibility_score)} · SOV ${compactNumber(point.share_of_voice?.brand_share_of_voice ?? 0)}% · C ${compactNumber(point.competitor_pressure_score)}</span>
                      <small>${formatStatus(point.run_type)} · ${point.region || 'US'} · ${compactNumber(point.source_url_count)} URLs</small>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">No scored tracking history yet.</div>'
        }
      </div>
    </article>
    <article class="monitoring-panel monitoring-wide">
      <span class="panel-kicker">Alerts</span>
      <div class="alert-list">
        ${
          alerts.length
            ? alerts
                .map(
                  (alert) => `
                    <div class="alert-row ${alert.severity === 'high' ? 'is-alert' : ''}">
                      <span class="pill ${alert.severity === 'high' ? 'is-alert' : 'is-waiting'}">${formatStatus(alert.severity)}</span>
                      <strong>${alert.title}</strong>
                      <span>${alert.message}</span>
                      <small>${formatStatus(alert.metric_key)} · ${alert.delta_value ?? 'n/a'} · ${formatStatus(alert.status)}</small>
                    </div>
                  `
                )
                .join('')
            : '<div class="empty">No monitoring alerts are open for this brand.</div>'
        }
      </div>
    </article>
  `;

  for (const button of els.monitoringBoard.querySelectorAll('[data-monitoring-action]')) {
    button.addEventListener('click', async () => {
      await submitMonitoringAction(button.dataset.monitoringAction);
    });
  }
  renderAiOverview();
}

function buildModelSovTrend(points = []) {
  const byModel = new Map();
  for (const point of points) {
    const date = point.created_at ? new Date(point.created_at).toLocaleDateString('en-US') : 'cycle';
    for (const model of point.model_share_of_voice || []) {
      const engineLabel = externalEngineLabel(model.model_id);
      const row =
        byModel.get(engineLabel) ||
        {
          model_id: engineLabel,
          points: []
        };
      row.points.push({
        date,
        brand_share_of_voice: model.brand_share_of_voice || 0
      });
      byModel.set(engineLabel, row);
    }
  }

  return [...byModel.values()]
    .map((row) => {
      const first = row.points[0]?.brand_share_of_voice;
      const latest = row.points[row.points.length - 1]?.brand_share_of_voice;
      return {
        ...row,
        latest,
        status: first === undefined || latest === undefined ? 'not_enough_history' : latest > first ? 'improved' : latest < first ? 'declined' : 'unchanged'
      };
    })
    .sort((a, b) => b.latest - a.latest);
}

async function submitMonitoringAction(action) {
  const runId = els.runSelect.value;
  state.actionPending = true;
  renderMonitoring();
  try {
    if (action === 'configure') {
      const cadenceDays = Number(document.querySelector('#monitoringCadenceDays')?.value || 30);
      const providerMode = document.querySelector('#monitoringProviderMode')?.value || 'mock';
      const region = document.querySelector('#monitoringRegion')?.value || 'US';
      const { monitoring } = await fetchJson('/dashboard/monitoring/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          run_id: runId,
          cadence_days: cadenceDays,
          provider_mode: providerMode,
          engine_group: state.monitoring?.configuration?.engine_group || state.monitoring?.segmentation?.engine_group || 'openrouter_llm',
          region,
          language: 'en',
          allow_paid_provider: false,
          status: 'active',
          surface_cycle: buildDefaultSurfaceCycle(cadenceDays, region)
        })
      });
      state.monitoring = monitoring;
    } else if (action === 'pause') {
      const { monitoring } = await fetchJson('/dashboard/monitoring/pause', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          run_id: runId
        })
      });
      state.monitoring = monitoring;
    }
  } catch (error) {
    window.alert(error.message);
  } finally {
    state.actionPending = false;
    renderMonitoring();
  }
}

function buildDefaultSurfaceCycle(cadenceDays, region) {
  return [
    ['chatgpt', 'chatgpt_api_like', 'chatgpt_api_like'],
    ['perplexity', 'perplexity', 'perplexity_search'],
    ['google_aio', 'google_ai_overview', 'google_aio'],
    ['gemini', 'gemini_api_like', 'gemini_api_like'],
    ['claude', 'claude_api_like', 'claude_api_like'],
    ['grok', 'grok_api_like', 'grok_api_like']
  ].map(([surface_key, provider_mode, engine_group]) => ({
    surface_key,
    provider_mode,
    engine_group,
    cadence_days: Math.max(1, Math.min(90, Number(cadenceDays || 7))),
    allow_paid_provider: false,
    status: 'active',
    region,
    language: 'en'
  }));
}

function renderActionEvidence(action) {
  if (!action.evidence?.length) return '';
  return `
    <div class="action-evidence">
      ${action.evidence.map((item) => `<span>${item}</span>`).join('')}
    </div>
  `;
}

function renderActionPrompts(action) {
  if (!action.focus_prompts?.length) return '';
  return `
    <div class="action-prompts">
      <b>Target prompts</b>
      ${action.focus_prompts
        .map(
          (prompt) => `
            <span>
              ${prompt.prompt_text}
              <small>${formatStatus(prompt.category)} · ${externalEngineLabel(prompt.model_id)} · ${prompt.brand_mentioned ? 'brand mentioned' : 'brand missing'}</small>
            </span>
          `
        )
        .join('')}
    </div>
  `;
}

function renderActionSteps(action) {
  if (!action.recommended_steps?.length) return '';
  return `
    <ol class="action-steps">
      ${action.recommended_steps.map((step) => `<li>${step}</li>`).join('')}
    </ol>
  `;
}

function renderRows(items, titleFn, detailFn) {
  if (!items.length) return '<div class="empty">No measured data yet.</div>';
  return `
    <div class="visibility-rows">
      ${items
        .map(
          (item) => `
            <div class="visibility-row">
              <strong>${titleFn(item)}</strong>
              <span>${detailFn(item)}</span>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderOpportunityTriggers(item) {
  const prompts = item.triggering_evidence || [];
  if (!prompts.length) return '';
  return `
    <div class="trigger-list">
      <strong>Triggering prompts</strong>
      ${prompts
        .map(
          (prompt) => `
            <span>
              ${prompt.prompt_text}
              <small>${formatStatus(prompt.category)} · ${externalEngineLabel(prompt.model_id)} · ${prompt.brand_mentioned ? 'brand mentioned' : 'brand missing'} · official sources ${compactNumber(prompt.official_source_count)}</small>
              ${prompt.answer_excerpt ? `<em>${prompt.answer_excerpt}</em>` : ''}
            </span>
          `
        )
        .join('')}
    </div>
  `;
}

function renderExecutionBinding(item) {
  const binding = item.execution_binding || {};
  return `
    <div class="execution-binding">
      <strong>Execution binding</strong>
      <span>${formatStatus(binding.status || 'unknown')}</span>
      ${binding.title ? `<small>${binding.title}</small>` : ''}
      ${binding.next_step ? `<small>${binding.next_step}</small>` : ''}
    </div>
  `;
}

function priorityClass(priority) {
  if (priority === 'high') return 'is-alert';
  if (priority === 'medium') return 'is-waiting';
  return 'is-info';
}

function renderOpportunities() {
  const payload = state.opportunities;
  if (!payload) {
    els.opportunityBoard.innerHTML = '';
    renderAiOverview();
    return;
  }

  const opportunities = payload.opportunities || [];
  els.opportunityBoard.innerHTML = `
    <article class="opportunity-panel opportunity-header">
      <div>
        <span class="panel-kicker">Content opportunities</span>
        <h2>Prioritized actions from measured visibility gaps</h2>
        <p>Each opportunity can now be checked against its R4.2 brief and validated prompt bindings.</p>
      </div>
      <div class="opportunity-counts">
        ${metric('Opportunities', payload.summary.opportunity_count)}
        ${metric('High priority', payload.summary.high_priority_count)}
        ${metric('Medium', payload.summary.medium_priority_count)}
      </div>
    </article>
    <div class="opportunity-grid">
      ${
        opportunities.length
          ? opportunities
              .map(
                (item) => `
                  <article class="opportunity-card ${state.briefs?.briefs?.some((brief) => brief.linked_opportunity.id === item.id) ? 'has-brief' : ''}">
                    <div class="opportunity-card-head">
                      <span class="pill ${priorityClass(item.priority)}">${formatStatus(item.priority)}</span>
                      <span class="pill is-info">${formatStatus(item.opportunity_type)}</span>
                    </div>
                    <h2>${item.title}</h2>
                    <p>${item.description}</p>
                    <div class="opportunity-meta">
                      <div><span>Recommended format</span><strong>${formatStatus(item.recommended_format)}</strong></div>
                      <div><span>Status</span><strong>${formatStatus(item.status)}</strong></div>
                      <div><span>Primary metric</span><strong>${formatStatus(item.expected_impact.primary_metric)}</strong></div>
                    </div>
                    <div class="evidence-list">
                      <strong>Why this matters</strong>
                      ${(item.weakness_evidence || item.evidence_summary || []).map((line) => `<span>${line}</span>`).join('')}
                    </div>
                    ${renderOpportunityTriggers(item)}
                    ${renderExecutionBinding(item)}
                    <div class="target-list">
                      <strong>Target categories</strong>
                      <span>${item.target_categories.map(formatStatus).join(', ') || 'No specific category target.'}</span>
                    </div>
                    <button class="text-action" data-opportunity-key="${item.opportunity_key}">View linked brief</button>
                    <small>${item.measured_only_caveat}</small>
                  </article>
                `
              )
              .join('')
          : '<div class="empty">No content opportunities have been generated for this run yet.</div>'
      }
    </div>
  `;

  for (const button of els.opportunityBoard.querySelectorAll('[data-opportunity-key]')) {
    button.addEventListener('click', () => {
      const brief = state.briefs?.briefs?.find((item) => item.linked_opportunity.opportunity_key === button.dataset.opportunityKey);
      if (brief) {
        state.selectedBriefId = brief.id;
        renderBriefs();
        els.briefBoard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  renderAiOverview();
}

function briefStatusClass(brief) {
  return brief.article_readiness.ready_for_article_workflow ? 'is-good' : 'is-waiting';
}

function renderBullets(items, fallback) {
  if (!items?.length) return `<div class="empty">${fallback}</div>`;
  return `<ul class="brief-list">${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function renderLinkTargets(items) {
  if (!items?.length) return '<div class="empty">No internal link targets specified.</div>';
  return `
    <div class="brief-link-list">
      ${items
        .map(
          (item) => `
            <div>
              <strong>${item.label || item.url}</strong>
              <span>${item.url || 'No URL provided'} · ${item.reason || 'Supporting source'}</span>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderBriefExecutionRequirements(brief) {
  const execution = brief.execution_brief || {};
  return `
    <section class="brief-section execution-brief-section">
      <h3>Execution brief</h3>
      <div class="brief-meta-grid">
        <div><span>Page type</span><strong>${formatStatus(execution.page_type || brief.content_type)}</strong></div>
        <div><span>Title suggestion</span><strong>${execution.title_suggestion || brief.title}</strong></div>
        <div><span>Competitor angle</span><strong>${execution.competitor_comparison_angle || 'No direct competitor angle required.'}</strong></div>
      </div>
    </section>
    <section class="brief-section">
      <h3>Must answer</h3>
      ${renderBullets(execution.must_answer_questions || brief.target_prompts, 'No must-answer questions are available.')}
    </section>
    <section class="brief-section">
      <h3>Must include facts</h3>
      ${renderBullets(brief.must_include_facts, 'No required facts are available.')}
    </section>
    <section class="brief-section">
      <h3>Source / citation requirements</h3>
      ${renderBullets(execution.source_citation_requirements || brief.evidence_requirements, 'No citation requirements are available.')}
    </section>
  `;
}

function renderPromptBindings(binding) {
  const prompts = [binding.primary_prompt, ...(binding.supporting_prompts || [])].filter(Boolean);
  if (!prompts.length) {
    return '<div class="empty">No validated opportunity prompts are linked to this brief yet.</div>';
  }
  return `
    <div class="prompt-binding-list">
      ${prompts
        .map(
          (prompt) => `
            <div class="prompt-binding">
              <span class="pill ${prompt.link_role === 'primary' ? 'is-good' : 'is-info'}">${formatStatus(prompt.link_role)}</span>
              <strong>${prompt.prompt_text}</strong>
              <small>${formatStatus(prompt.prompt_category)} · score ${compactNumber(prompt.opportunity_prompt_score)}</small>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderBriefs() {
  const payload = state.briefs;
  if (!payload) {
    els.briefBoard.innerHTML = '';
    return;
  }

  const briefs = payload.briefs || [];
  const selected = briefs.find((brief) => brief.id === state.selectedBriefId) || briefs[0];
  if (selected && selected.id !== state.selectedBriefId) state.selectedBriefId = selected.id;

  els.briefBoard.innerHTML = `
    <article class="brief-panel brief-header">
      <div>
        <span class="panel-kicker">Brief detail</span>
        <h2>Content briefs tied to validated opportunity prompts</h2>
        <p>R4.2 shows the customer-safe brief, prompt bindings, readiness state, and retest plan before any article workflow begins.</p>
      </div>
      <div class="brief-counts">
        ${metric('Briefs', payload.summary.brief_count)}
        ${metric('Article-ready', payload.summary.article_ready_count)}
        ${metric('Validated prompts', payload.summary.validated_prompt_binding_count)}
      </div>
    </article>
    ${
      briefs.length
        ? `
          <div class="brief-layout">
            <nav class="brief-tabs" aria-label="Content briefs">
              ${briefs
                .map(
                  (brief) => `
                    <button class="brief-tab ${brief.id === state.selectedBriefId ? 'is-active' : ''}" data-brief-id="${brief.id}">
                      <span class="pill ${briefStatusClass(brief)}">${formatStatus(brief.article_readiness.status)}</span>
                      <strong>${brief.title}</strong>
                      <small>${formatStatus(brief.linked_opportunity.opportunity_type)} · ${brief.validated_prompt_binding.validated_prompt_count} validated prompts</small>
                    </button>
                  `
                )
                .join('')}
            </nav>
            <article class="brief-detail">
              <div class="brief-detail-head">
                <div>
                  <span class="panel-kicker">${formatStatus(selected.linked_opportunity.priority)} priority</span>
                  <h2>${selected.title}</h2>
                  <p>${selected.objective}</p>
                </div>
                <div class="brief-status-stack">
                  <span class="pill ${briefStatusClass(selected)}">${formatStatus(selected.article_readiness.status)}</span>
                  <span class="pill is-info">${formatStatus(selected.content_type)}</span>
                </div>
              </div>
              <div class="brief-meta-grid">
                <div><span>Opportunity</span><strong>${selected.linked_opportunity.title}</strong></div>
                <div><span>Recommended format</span><strong>${formatStatus(selected.linked_opportunity.recommended_format)}</strong></div>
                <div><span>Target metric</span><strong>${formatStatus(selected.retest_plan.target_metric)}</strong></div>
              </div>
              <section class="brief-section">
                <h3>Validated prompt bindings</h3>
                ${renderPromptBindings(selected.validated_prompt_binding)}
              </section>
              <section class="brief-section">
                <h3>Readiness</h3>
                <p>${selected.article_readiness.next_step}</p>
                ${renderBullets(selected.article_readiness.blockers, 'No blockers for article workflow handoff.')}
              </section>
              ${renderBriefExecutionRequirements(selected)}
              <section class="brief-section">
                <h3>Outline</h3>
                ${renderBullets(selected.outline, 'No outline is available.')}
              </section>
              <section class="brief-section">
                <h3>Evidence requirements</h3>
                ${renderBullets(selected.evidence_requirements, 'No evidence requirements are available.')}
              </section>
              <section class="brief-section">
                <h3>Guardrails</h3>
                ${renderBullets(selected.guardrails, 'No guardrails are available.')}
              </section>
              <section class="brief-section">
                <h3>Internal links</h3>
                ${renderLinkTargets(selected.internal_link_targets)}
              </section>
              <section class="brief-section">
                <h3>Retest plan</h3>
                <p>${formatStatus(selected.retest_plan.desired_direction)} after ${formatStatus(selected.retest_plan.retest_after)}.</p>
                ${renderBullets(selected.retest_plan.prompt_samples, 'No retest prompt samples are available.')}
              </section>
              <small class="brief-caveat">${selected.measured_only_caveat}</small>
            </article>
          </div>
        `
        : '<div class="empty">No content briefs have been generated for this run yet.</div>'
    }
  `;

  for (const button of els.briefBoard.querySelectorAll('[data-brief-id]')) {
    button.addEventListener('click', () => {
      state.selectedBriefId = button.dataset.briefId;
      renderBriefs();
    });
  }
}

function renderMonthlyReport() {
  const report = state.monthlyReport;
  if (!report) {
    els.monthlyReportBoard.innerHTML = `
      <article class="monthly-panel">
        <span class="panel-kicker">Monthly report</span>
        <h2>No customer monthly report yet</h2>
        <p class="monthly-muted">The R4.3 report surface will appear after a monthly report exists for this brand or tracking run.</p>
      </article>
    `;
    return;
  }

  els.monthlyReportBoard.innerHTML = `
    <article class="monthly-panel monthly-header">
      <div>
        <span class="panel-kicker">Monthly report · ${report.report_month}</span>
        <h2>${report.headline}</h2>
        <p>${report.customer_summary.join(' ')}</p>
      </div>
      <div class="monthly-counts">
        ${metric('Ready briefs', report.content_recommendations.article_ready_brief_count)}
        ${metric('Blocked', report.content_recommendations.blocked_brief_count)}
        ${metric('Promoted prompts', report.prompt_strategy.promoted_prompt_count)}
      </div>
    </article>

    <article class="monthly-panel monthly-wide">
      <span class="panel-kicker">Score narratives</span>
      <div class="monthly-score-grid">
        ${report.score_narratives
          .map(
            (score) => `
              <div class="monthly-score">
                <span>${score.title}</span>
                <strong>${compactNumber(score.score)}</strong>
                <small>${score.customer_copy}</small>
              </div>
            `
          )
          .join('')}
      </div>
    </article>

    <article class="monthly-panel">
      <span class="panel-kicker">Risks</span>
      ${renderMonthlyRows(report.risk_explanations, (risk) => risk.title, (risk) => `${formatStatus(risk.severity)} · ${risk.customer_copy}`)}
    </article>

    <article class="monthly-panel">
      <span class="panel-kicker">Content recommendations</span>
      <p>${report.content_recommendations.primary_action}</p>
      ${renderMonthlyRows(report.content_recommendations.expected_impacts.map((item) => ({ title: item, detail: 'Expected impact for next measured cycle' })), (item) => item.title, (item) => item.detail)}
      ${renderMonthlyRows(report.content_recommendations.blocked_notes.map((item) => ({ title: item, detail: 'Blocked until validated prompt binding is ready' })), (item) => item.title, (item) => item.detail)}
    </article>

    <article class="monthly-panel">
      <span class="panel-kicker">Execution order</span>
      ${renderMonthlyRows(report.execution_order, (item) => `${item.order}. ${formatStatus(item.type)}`, (item) => item.customer_copy)}
    </article>

    <article class="monthly-panel">
      <span class="panel-kicker">Prompt strategy</span>
      <p>${report.prompt_strategy.summary}</p>
      ${renderMonthlyRows(report.prompt_strategy.top_validated_prompts, (prompt) => prompt.prompt_text, (prompt) => `${formatStatus(prompt.status)} · score ${compactNumber(prompt.score)}`)}
    </article>

    <article class="monthly-panel monthly-wide">
      <span class="panel-kicker">Retest watchlist</span>
      <p>${report.retest_watchlist.summary}</p>
      ${renderMonthlyRows(report.prompt_strategy.next_watchlist.map((prompt) => ({ title: prompt, detail: 'Watch in the next measured cycle' })), (item) => item.title, (item) => item.detail)}
      <p class="monthly-muted">${report.retest_watchlist.guardrail}</p>
      <p class="monthly-muted">${report.caveats.join(' ')}</p>
    </article>
  `;
}

function renderMonthlyRows(items, titleFn, detailFn) {
  if (!items?.length) return '<div class="empty">No customer-safe monthly report items yet.</div>';
  return `
    <div class="monthly-rows">
      ${items
        .map(
          (item) => `
            <div class="monthly-row">
              <strong>${titleFn(item)}</strong>
              <span>${detailFn(item)}</span>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

async function submitMarkPublished(handoffId) {
  const articleId = state.selectedArticleId;
  const url = document.querySelector('#publishedUrl')?.value?.trim();
  const externalReference = document.querySelector('#publishedReference')?.value?.trim();
  state.actionPending = true;
  state.actionMessage = null;
  renderPublishHandoff();

  try {
    await fetchJson(`/dashboard/publish-handoffs/${handoffId}/mark-published`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        external_reference: externalReference,
        actor: 'customer_dashboard',
        note: 'External publication confirmed from the customer dashboard.'
      })
    });
    state.actionMessage = 'Published state saved.';
    await loadPublishHandoff({ runId: state.dashboard.tracking_run_id });
    await loadRetest({ runId: state.dashboard.tracking_run_id });
    await loadDashboard(state.dashboard.tracking_run_id, articleId);
  } catch (error) {
    state.actionMessage = error.message;
    renderPublishHandoff();
  } finally {
    state.actionPending = false;
    renderPublishHandoff();
  }
}

function renderPublishHandoff() {
  const payload = state.publishHandoff;
  if (!payload) {
    els.publishHandoffBoard.innerHTML = '';
    return;
  }

  const item = selectedPublishHandoff() || payload.handoffs[0];
  if (!item) {
    els.publishHandoffBoard.innerHTML = '<article class="publish-panel"><div class="empty">Publish handoff appears after article approval.</div></article>';
    return;
  }

  const handoff = item.publish_handoff;
  const canMarkPublished = item.customer_actions.some((action) => action.type === 'mark_published_externally');
  els.publishHandoffBoard.innerHTML = `
    <article class="publish-panel publish-header">
      <div>
        <span class="panel-kicker">Publish handoff</span>
        <h2>${text(item.article.title)}</h2>
        <p>${handoff.next_step}</p>
      </div>
      <div class="publish-metrics">
        ${metric('Handoffs', payload.summary.handoff_count)}
        ${metric('Prepared', payload.summary.prepared_count)}
        ${metric('Published', payload.summary.published_count)}
      </div>
    </article>
    <article class="publish-panel">
      <span class="panel-kicker">State</span>
      <div class="state-block">
        <div class="state-line"><span>Handoff</span><strong>${customerStateValue('State', handoff.status)}</strong></div>
        <div class="state-line"><span>Publish</span><strong>${customerStateValue('Publish', handoff.publish_status)}</strong></div>
        <div class="state-line"><span>Channel</span><strong>${text(handoff.handoff_preparation.channel)}</strong></div>
        <div class="state-line"><span>Published URL</span><strong>${text(handoff.external_publish.url || handoff.external_publish.external_reference)}</strong></div>
      </div>
    </article>
    <article class="publish-panel publish-wide">
      <span class="panel-kicker">Confirm publication</span>
      ${
        canMarkPublished
          ? `
            <div class="publish-form">
              <input id="publishedUrl" type="url" placeholder="https://example.com/published-article" ${state.actionPending ? 'disabled' : ''} />
              <input id="publishedReference" type="text" placeholder="External reference if no URL" ${state.actionPending ? 'disabled' : ''} />
              <button class="action-button" data-mark-published="${handoff.id}" ${state.actionPending ? 'disabled' : ''}>Mark published</button>
            </div>
            <p class="monthly-muted">Recording publication does not schedule retest or claim improvement.</p>
          `
          : `<div class="empty">${state.actionMessage || handoff.next_step}</div>`
      }
      ${state.actionMessage ? `<div class="action-notice">${state.actionMessage}</div>` : ''}
    </article>
  `;

  const button = els.publishHandoffBoard.querySelector('[data-mark-published]');
  if (button) {
    button.addEventListener('click', async () => {
      await submitMarkPublished(button.dataset.markPublished);
    });
  }
}

async function submitScheduleRetest(handoffId) {
  const articleId = state.selectedArticleId;
  const scheduledFor = document.querySelector('#retestScheduledFor')?.value;
  state.actionPending = true;
  state.actionMessage = null;
  renderRetestBoard();

  try {
    await fetchJson(`/dashboard/publish-handoffs/${handoffId}/schedule-retest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scheduled_for: scheduledFor,
        actor: 'customer_dashboard',
        note: 'Post-publish retest scheduled from the customer dashboard.'
      })
    });
    state.actionMessage = 'Retest schedule saved.';
    await loadRetest({ runId: state.dashboard.tracking_run_id });
    await loadPublishHandoff({ runId: state.dashboard.tracking_run_id });
    await loadDashboard(state.dashboard.tracking_run_id, articleId);
  } catch (error) {
    state.actionMessage = error.message;
    renderRetestBoard();
  } finally {
    state.actionPending = false;
    renderRetestBoard();
  }
}

async function submitRunDueRetests() {
  const articleId = state.selectedArticleId;
  state.actionPending = true;
  state.actionMessage = null;
  renderRetestBoard();

  try {
    await fetchJson('/dashboard/retests/run-due', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        due_at: new Date().toISOString(),
        limit: 10
      })
    });
    state.actionMessage = 'Due retest completed in mock-safe mode.';
    await loadRetest({ runId: state.dashboard.tracking_run_id });
    await loadDashboard(state.dashboard.tracking_run_id, articleId);
  } catch (error) {
    state.actionMessage = error.message;
    renderRetestBoard();
  } finally {
    state.actionPending = false;
    renderRetestBoard();
  }
}

function renderRetestBoard() {
  const payload = state.retest;
  if (!payload) {
    els.retestReportBoard.innerHTML = '';
    return;
  }

  const item = selectedRetest() || payload.retests[0];
  if (!item) {
    els.retestReportBoard.innerHTML = '<article class="retest-panel-wide"><div class="empty">Retest appears after publish handoff.</div></article>';
    return;
  }

  const schedule = item.retest_schedule;
  const report = item.retest_report;
  const canSchedule = item.customer_actions.some((action) => action.type === 'schedule_retest');
  const canRunDue = payload.summary.due_count > 0;
  els.retestReportBoard.innerHTML = `
    <article class="retest-panel-wide retest-header">
      <div>
        <span class="panel-kicker">R6.2 retest</span>
        <h2>${text(item.article.title)}</h2>
        <p>Post-publish retest uses persisted baseline and retest scores. It reports measured deltas only.</p>
      </div>
      <div class="retest-metrics">
        ${metric('Scheduled', payload.summary.scheduled_count)}
        ${metric('Due', payload.summary.due_count)}
        ${metric('Reports', payload.summary.report_ready_count)}
      </div>
    </article>
    <article class="retest-panel-wide">
      <span class="panel-kicker">Schedule</span>
      <div class="state-block">
        <div class="state-line"><span>Status</span><strong>${customerStateValue('State', schedule.status)}</strong></div>
        <div class="state-line"><span>Due</span><strong>${text(schedule.scheduled_for)}</strong></div>
        <div class="state-line"><span>Target metric</span><strong>${formatStatus(schedule.target_metric)}</strong></div>
        <div class="state-line"><span>Retest run</span><strong>${text(schedule.retest_tracking_run_id)}</strong></div>
      </div>
      ${
        canSchedule
          ? `
            <div class="retest-form">
              <input id="retestScheduledFor" type="datetime-local" ${state.actionPending ? 'disabled' : ''} />
              <button class="action-button" data-schedule-retest="${item.publish_handoff.id}" ${state.actionPending ? 'disabled' : ''}>Schedule retest</button>
            </div>
          `
          : ''
      }
      ${
        canRunDue
          ? `<button class="action-button" data-run-due-retests ${state.actionPending ? 'disabled' : ''}>Run due retest</button>`
          : ''
      }
      ${state.actionMessage ? `<div class="action-notice">${state.actionMessage}</div>` : ''}
      <p class="monthly-muted">Run due retest is controlled mock mode only from this surface.</p>
    </article>
    <article class="retest-panel-wide">
      <span class="panel-kicker">Before / after report</span>
      ${
        report
          ? `
            <h2>${text(report.headline)}</h2>
            <div class="retest-score-grid">
              ${report.scorecards
                .map(
                  (score) => `
                    <div class="retest-score">
                      <span>${score.title}</span>
                      <strong>${score.after}</strong>
                      <small>${score.before} before · ${score.delta} delta · ${formatStatus(score.outcome)}</small>
                    </div>
                  `
                )
                .join('')}
            </div>
            <div class="next-action-list">
              ${(report.customer_report?.next_actions || [])
                .map(
                  (action) => `
                    <div class="next-action">
                      <span class="pill ${priorityClass(action.priority)}">${formatStatus(action.priority)}</span>
                      <strong>${action.title}</strong>
                    </div>
                  `
                )
                .join('')}
            </div>
            <p class="monthly-muted">${(report.customer_report?.evidence_caveats || []).join(' ')}</p>
          `
          : '<div class="empty">Before/after report appears after a due retest is executed and compared.</div>'
      }
    </article>
  `;

  const scheduleButton = els.retestReportBoard.querySelector('[data-schedule-retest]');
  if (scheduleButton) {
    scheduleButton.addEventListener('click', async () => {
      await submitScheduleRetest(scheduleButton.dataset.scheduleRetest);
    });
  }

  const runDueButton = els.retestReportBoard.querySelector('[data-run-due-retests]');
  if (runDueButton) {
    runDueButton.addEventListener('click', submitRunDueRetests);
  }
}

function renderDashboard() {
  const dashboard = state.dashboard;
  if (!dashboard) return;

  els.articleList.innerHTML = dashboard.articles
    .map(
      (item) => `
        <button class="article-button ${item.article.article_draft_id === state.selectedArticleId ? 'is-active' : ''}"
          data-article-id="${item.article.article_draft_id}">
          <span class="article-title">${text(item.article.title)}</span>
          <span class="article-subtitle">${formatStatus(item.article.current_stage)} · ${formatStatus(item.status)}</span>
          <span class="pill ${pillClass(item.status)}">${formatStatus(item.status)}</span>
        </button>
      `
    )
    .join('');

  for (const button of els.articleList.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      state.selectedArticleId = button.dataset.articleId;
      renderDashboard();
    });
  }

  renderPublishHandoff();
  renderRetestBoard();
  renderArticle(selectedArticle());
}

function renderArticle(item) {
  if (!item) {
    renderEmpty('No article dashboard payload is available for this run.');
    return;
  }

  const pkg = item.dashboard_package;
  const production = item.production_handoff;
  const handoff = item.publish_handoff;
  const report = item.retest_report;
  const timeline = item.delivery_timeline?.payload;
  const productionState = productionWorkflow(item);
  const retestState = retestStatus({ timeline, handoff, report });

  els.statusBand.innerHTML = [
    chip('Article', item.status),
    chip('Production', productionState.status),
    chip('Review', pkg?.summary?.quality_review_status || 'not_started'),
    chip('Publish', handoff?.publish_status || 'not_started'),
    chip('Retest', retestState),
    chip('Missing', item.integrity.missing_sections.length ? item.integrity.missing_sections.length : 'none', item.integrity.missing_sections.length ? 'is-alert' : 'is-good')
  ].join('');

  els.articleTitle.textContent = text(item.article.title);
  els.articleMeta.innerHTML = [
    `<span class="pill is-info">${formatStatus(item.article.content_type)}</span>`,
    `<span class="pill ${pillClass(item.article.current_stage)}">${formatStatus(item.article.current_stage)}</span>`,
    `<span class="pill ${pillClass(item.article.next_action)}">${formatStatus(item.article.next_action)}</span>`
  ].join('');

  els.packagePreview.textContent = pkg?.preview?.markdown || pkg?.preview?.html || 'Preview not available.';
  els.fileTable.innerHTML = (pkg?.files || [])
    .map(
      (file) => `
        <div class="file-row">
          <strong>${file.filename}</strong>
          <span>${file.content_type}</span>
          <span>${text(file.size_bytes, 0)} bytes</span>
          ${file.download_url ? `<a class="file-download" href="${file.download_url}">Download</a>` : ''}
        </div>
      `
    )
    .join('');

  renderProduction(item, productionState);
  renderTimeline(timeline);
  renderHandoff(handoff, item.customer_actions);
  renderRetest(report, handoff);
}

function isDone(status) {
  return ['done', 'ready_for_dashboard', 'ready_for_download', 'approved_for_export', 'production_completed'].includes(status);
}

function productionWorkflow(item) {
  const pkg = item.dashboard_package;
  const production = item.production_handoff;
  const metadata = pkg?.metadata || {};
  const source = metadata.production_source || production?.provider || 'growth_loop';
  const dispatchStatus = production?.provider_result?.dispatch_status || null;
  const providerJobId = metadata.source_provider_job_id || production?.provider_result?.provider_job_id || null;
  const generated = production?.status === 'production_completed' || Boolean(metadata.source_provider_job_id) || Boolean(pkg);
  const reviewStatus = pkg?.summary?.quality_review_status || metadata.quality_review_status || 'not_started';
  const packageReady = pkg?.status === 'ready_for_dashboard';
  const sent = ['submitted_to_geoflow', 'production_completed'].includes(production?.status) || source === 'geoflow';

  const steps = [
    {
      key: 'brief',
      label: 'Brief approved',
      status: 'done',
      detail: 'The article brief is linked to validated prompts.'
    },
    {
      key: 'production',
      label: source === 'geoflow' ? 'Sent to production' : 'Prepared in workspace',
      status: sent || source !== 'geoflow' ? 'done' : 'pending',
      detail: dispatchStatus === 'dry_run' ? 'Connector dry-run only.' : providerJobId ? `Job ${providerJobId}` : 'Waiting for production handoff.'
    },
    {
      key: 'generated',
      label: 'Article generated',
      status: generated ? 'done' : 'pending',
      detail: generated ? 'Draft content is available for review.' : 'Draft content is not back yet.'
    },
    {
      key: 'review',
      label: 'Quality review',
      status: reviewStatus === 'approved_for_export' ? 'done' : reviewStatus === 'not_started' ? 'pending' : 'waiting',
      detail: formatStatus(reviewStatus)
    },
    {
      key: 'ready',
      label: 'Ready for approval',
      status: packageReady ? 'done' : 'pending',
      detail: packageReady ? 'Package is ready for customer review.' : 'Package is still being assembled.'
    }
  ];

  const current = [...steps].reverse().find((step) => isDone(step.status)) || steps[0];
  const waiting = steps.find((step) => !isDone(step.status));
  return {
    source,
    status: packageReady ? 'ready_for_dashboard' : generated || sent ? 'in_progress' : waiting?.status || 'pending',
    current,
    next: waiting || null,
    providerJobId,
    steps
  };
}

function renderProduction(item, workflow) {
  const sourceLabel = workflow.source === 'geoflow' ? 'GeoFlow production engine' : 'Growth Loop workspace';
  const nextLabel = workflow.next ? workflow.next.label : 'Monitor next cycle';
  els.productionSummary.innerHTML = `
    <div class="production-current">
      <span class="chip-label">Current stage</span>
      <strong>${workflow.current.label}</strong>
      <small>${workflow.current.detail}</small>
    </div>
    <div class="production-meta">
      <div><span>Source</span><strong>${sourceLabel}</strong></div>
      <div><span>Next</span><strong>${nextLabel}</strong></div>
      <div><span>Draft ID</span><strong>${text(item.article.article_draft_id)}</strong></div>
    </div>
  `;
  els.productionRail.innerHTML = workflow.steps
    .map(
      (step, index) => `
        <li class="production-step ${isDone(step.status) ? 'is-complete' : step.status === 'waiting' ? 'is-waiting-step' : ''}">
          <span class="step-index">${index + 1}</span>
          <div>
            <strong>${step.label}</strong>
            <small>${step.detail}</small>
          </div>
        </li>
      `
    )
    .join('');
}

function renderTimeline(timeline) {
  const stages = timeline?.stages || [];
  if (!stages.length) {
    els.timelineList.innerHTML = '<li class="empty">Delivery timeline will appear after the package and retest records are ready.</li>';
    return;
  }
  els.timelineList.innerHTML = stages
    .map(
      (stage, index) => `
        <li class="timeline-item">
          <span class="timeline-dot ${pillClass(stage.status)}">${index + 1}</span>
          <div class="timeline-copy">
            <strong>${stage.label}</strong>
            <small>${formatStatus(stage.status)} · ${text(stage.summary, stage.source_status || '')}</small>
          </div>
        </li>
      `
    )
    .join('');
}

function retestStatus({ timeline, handoff, report }) {
  if (report?.status === 'ready_for_dashboard') return 'ready_for_dashboard';
  if (timeline?.dashboard_summary?.retest_status) return timeline.dashboard_summary.retest_status;
  if (handoff?.status === 'retest_scheduled' || handoff?.retest_schedule?.scheduled) return 'scheduled';
  if (handoff?.status === 'published_externally') return 'pending_schedule';
  return 'not_started';
}

function customerActionLabel(type) {
  const labels = {
    request_changes: 'Request changes',
    approve_for_publish_handoff: 'Approve handoff'
  };
  return t(labels[type]) || formatStatus(type);
}

function customerActionNote(type) {
  const notes = {
    request_changes: 'Sends the article back to the team for revision.',
    approve_for_publish_handoff: 'Approves the article for later manual publish handoff. Nothing is published automatically.'
  };
  return t(notes[type] || 'Updates the customer review state.');
}

function customerActions(actions) {
  const allowed = new Set(['request_changes', 'approve_for_publish_handoff']);
  return (actions || []).filter((action) => allowed.has(action.type) && action.enabled);
}

function customerStateValue(label, value) {
  if (!value) return text(value);
  const map = {
    customer_review: 'Customer review',
    changes_requested: 'Changes requested',
    approved_for_publish_handoff: 'Approved for handoff',
    handoff_prepared: 'Handoff prepared',
    published_externally: 'Published externally',
    retest_scheduled: 'Retest scheduled',
    not_published: 'Not published',
    customer_approval_or_changes: 'Approve or request changes',
    revise_export_package_then_resume_review: 'Team revision in progress',
    prepare_manual_or_cms_handoff: 'Team prepares publish handoff',
    wait_for_external_publish_confirmation: 'Waiting for publish confirmation',
    schedule_retest: 'Schedule retest',
    wait_for_retest_run: 'Waiting for retest'
  };
  if (label === 'URL') return text(value);
  return map[value] || formatStatus(value);
}

async function submitCustomerAction(handoffId, actionType) {
  const articleId = state.selectedArticleId;
  state.actionPending = true;
  state.actionMessage = null;
  renderArticle(selectedArticle());

  try {
    await fetchJson(`/internal/article-publish-handoffs/${handoffId}/customer-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: actionType,
        actor: 'customer_dashboard',
        note: customerActionNote(actionType)
      })
    });
    state.actionMessage =
      actionType === 'request_changes'
        ? t('request changes saved.')
        : actionType === 'approve_for_publish_handoff'
          ? t('approve handoff saved.')
          : `${customerActionLabel(actionType)} ${t('saved')}.`;
    await loadDashboard(state.dashboard.tracking_run_id, articleId);
  } catch (error) {
    state.actionMessage = error.message;
    renderArticle(selectedArticle());
  } finally {
    state.actionPending = false;
    renderArticle(selectedArticle());
  }
}

function renderHandoff(handoff, actions) {
  els.handoffState.innerHTML = [
    ['State', handoff?.status],
    ['Publish', handoff?.publish_status],
    ['Next', handoff?.state_machine?.next_step],
    ['URL', handoff?.external_publish?.url]
  ]
    .map(([label, value]) => `<div class="state-line"><span>${label}</span><strong>${customerStateValue(label, value)}</strong></div>`)
    .join('');

  if (!handoff) {
    els.actionGrid.innerHTML = '<div class="empty">Customer actions will appear after the review package is ready.</div>';
    return;
  }

  const availableActions = customerActions(actions);
  if (!availableActions.length) {
    els.actionGrid.innerHTML = [
      state.actionMessage ? `<div class="action-notice">${state.actionMessage}</div>` : '',
      '<div class="empty">No customer action is needed right now.</div>'
    ].join('');
    return;
  }

  els.actionGrid.innerHTML = [
    ...availableActions.map(
      (action) => `
        <button class="action-button ${action.type === 'request_changes' ? 'is-secondary' : ''}"
          data-customer-action="${action.type}"
          ${state.actionPending ? 'disabled' : ''}
          title="${customerActionNote(action.type)}">
          ${customerActionLabel(action.type)}
        </button>
      `
    ),
    state.actionMessage ? `<div class="action-notice">${state.actionMessage}</div>` : ''
  ].join('');

  for (const button of els.actionGrid.querySelectorAll('[data-customer-action]')) {
    button.addEventListener('click', async () => {
      await submitCustomerAction(handoff.id, button.dataset.customerAction);
    });
  }
}

function renderRetest(report, handoff) {
  const customerRetest = selectedRetest();
  if (!report && customerRetest?.retest_report) {
    report = {
      status: customerRetest.retest_report.status,
      dashboard_card: {
        headline: customerRetest.retest_report.headline,
        scorecards: customerRetest.retest_report.scorecards
      }
    };
  }
  if (!report) {
    if (customerRetest?.retest_schedule?.scheduled_for) {
      els.retestCard.innerHTML = `
        <div class="empty">Retest is scheduled for ${text(customerRetest.retest_schedule.scheduled_for)}. Results will appear after the post-publish check runs.</div>
      `;
      return;
    }
    if (handoff?.retest_schedule?.scheduled) {
      els.retestCard.innerHTML = `
        <div class="empty">Retest is scheduled for ${text(handoff.retest_schedule.scheduled_for)}. Results will appear after the post-publish check runs.</div>
      `;
      return;
    }
    els.retestCard.innerHTML = '<div class="empty">Retest starts after external publication is confirmed and scheduled in R6.2.</div>';
    return;
  }

  const card = report.dashboard_card || {};
  const scores = card.scorecards || [];
  els.retestCard.innerHTML = `
    <p>${text(card.headline)}</p>
    <div class="score-grid">
      ${scores
        .map(
          (score) => `
            <div class="score-box">
              <span class="metric-label">${score.title}</span>
              <strong>${score.after}</strong>
              <span class="pill ${pillClass(score.outcome)}">${formatStatus(score.outcome)} · ${score.delta}</span>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderEmpty(message) {
  if (!state.visibility) {
    els.pageTitle.textContent = 'Visibility report';
    els.summaryStrip.innerHTML = '';
    els.visibilityBoard.innerHTML = '';
    els.opportunityBoard.innerHTML = '';
    els.briefBoard.innerHTML = '';
    els.monthlyReportBoard.innerHTML = '';
    els.publishHandoffBoard.innerHTML = '';
  }
  els.articleList.innerHTML = '';
  els.statusBand.innerHTML = '';
  els.articleTitle.textContent = message;
  els.articleMeta.innerHTML = '';
  els.packagePreview.textContent = '';
  els.productionSummary.innerHTML = '';
  els.productionRail.innerHTML = '';
  els.fileTable.innerHTML = '';
  els.timelineList.innerHTML = '';
  els.handoffState.innerHTML = '';
  els.actionGrid.innerHTML = '';
  els.retestCard.innerHTML = '';
  scheduleChineseText();
}

els.langToggle?.addEventListener('click', () => setDashboardLanguage(isZh() ? 'en' : 'zh'));

els.runSelect.addEventListener('change', async (event) => {
  state.actionMessage = null;
  await loadDashboard(event.target.value);
});

renderLanguageChrome();
applyChineseText();
startChineseObserver();

loadRuns().catch((error) => {
  renderEmpty(error.message);
});

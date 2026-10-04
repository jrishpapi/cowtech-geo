const DEFAULT_LANG = 'zh';
const savedLang = localStorage.getItem('opsDashboardLang');

const ZH_TEXT = {
  'Growth Ops': '增长运营',
  'Internal queue': '内部队列',
  Status: '状态',
  Loading: '加载中',
  'Waiting for aggregate': '等待汇总数据',
  'R8.3 · Product ops GeoFlow live gate': 'R8.3 · 产品运营与 GeoFlow 真实调用闸门',
  'Product ops': '产品运营',
  'Checking session': '检查会话',
  'Session unavailable': '会话不可用',
  Refresh: '刷新',
  Refreshing: '刷新中',
  Logout: '退出',
  Total: '总数',
  High: '高优先级',
  Medium: '中优先级',
  Low: '低优先级',
  'Product queue': '产品队列',
  Urgent: '紧急',
  'GeoFlow readiness': 'GeoFlow 就绪',
  'Due retests': '到期复测',
  'Provider calls 30d': '30天 Provider 调用',
  'Ops Control Center': '运营控制中心',
  'Live testing and intake controls': '连通性试跑、完整追踪与客户录入控制',
  'Loading control center': '正在加载控制中心',
  'Runtime': '运行配置',
  'Testing defaults': '测试默认值',
  'Bounded live provider testing': '启用受控真实 Provider 测试',
  'Default mode': '默认模式',
  'Max estimated cost': '最大预估成本',
  'Default brand': '默认品牌',
  'Prompt index': 'Prompt 序号',
  'Model index': '模型序号',
  'Save settings': '保存配置',
  Saving: '保存中',
  'Provider Connectivity Pilot': 'Provider 连通性试跑',
  'One-call live gate': '单次真实调用闸门',
  Brand: '品牌',
  Model: '模型',
  Budget: '预算',
  'Fixture name': 'Fixture 名称',
  'Execute one live OpenRouter call': '执行 1 次真实 OpenRouter 调用',
  'Run connectivity pilot': '运行连通性试跑',
  Running: '运行中',
  'Unchecked submit returns readiness/blocked state only. Checked submit can spend up to the budget.':
    '不勾选只返回就绪/阻止状态；勾选后可能按预算产生真实费用。',
  'Full GEO Test / Tracking Run': '完整 GEO 测试 / Tracking Run',
  'Tracking, parser, scoring': 'Tracking Run、解析、评分',
  'Provider mode': 'Provider 模式',
  'Execute full live OpenRouter matrix': '执行完整真实 OpenRouter 矩阵',
  'Run full GEO test': '运行完整 GEO 测试',
  'Run full mock test': '运行完整 mock 测试',
  'Mock is free. OpenRouter runs all active prompts across all active model targets and can spend up to the budget.':
    'Mock 不产生费用；OpenRouter 会运行全部 active prompts × active model targets，可能按预算产生真实费用。',
  'Matrix preview': '矩阵预览',
  'Planned calls': '计划调用',
  'Estimated cost': '预估成本',
  'Questions to ask': '将要提问的问题',
  'Models to call': '将要调用的模型',
  'Default template prompts detected': '检测到默认模板题库',
  'No matrix preview available': '暂无矩阵预览',
  'Recent full Tracking Runs': '最近完整 Tracking Run',
  'No full GEO tests yet': '还没有完整 GEO 测试',
  'Open customer report': '打开客户报告',
  'Open raw results': '打开原始结果',
  'Customer Intake': '客户录入',
  'New brand workspace': '新建品牌工作区',
  'Customer email': '客户邮箱',
  Plan: '套餐',
  Website: '网站',
  Vertical: '行业',
  'Custom vertical': '自定义行业',
  Locale: '语言/地区',
  Competitors: '竞品',
  Prompts: 'Prompts',
  'One question per line, or category | question': '每行一个问题，或 category | question',
  'Create customer + brand': '创建客户与品牌',
  Creating: '创建中',
  Ledger: '调用账本',
  'Recent provider connectivity pilots': '最近 Provider 连通性试跑',
  'No paid provider pilot ledger events yet': '还没有 Provider 连通性试跑账本记录',
  'Test question': '测试问题',
  'Test process': '测试过程',
  'Evaluation criteria': '判定基准',
  'Provider answer preview': 'Provider 回答摘要',
  'Result summary': '结果摘要',
  'Live call executed': '已执行真实调用',
  'No live call': '未执行真实调用',
  'Answer saved': '回答摘要已保存',
  'Answer missing': '回答正文不可恢复',
  'Cost within budget': '成本在预算内',
  'Budget unknown': '预算未记录',
  'Safety passed': '安全检查通过',
  'This is the connectivity pilot result card. It includes the single prompt, cost, tokens, response id, answer status, process, and benchmark.':
    '这是连通性试跑结果卡，只包含单条 prompt、成本、tokens、响应 ID、回答状态、过程和判定基准。',
  'Answer preview unavailable': '回答摘要不可用',
  'The earlier pilot was recorded before answer previews were persisted. Fixture files inside rebuilt containers may no longer exist.':
    '这次测试发生时还没有持久化回答摘要；容器重建后，容器内 fixture 文件可能已经不存在。',
  'Response id': '响应 ID',
  'Fixture': 'Fixture',
  'Actual cost': '实际成本',
  'Budget cap': '预算上限',
  'Input tokens': '输入 tokens',
  'Output tokens': '输出 tokens',
  'Secret exposure': '密钥暴露',
  'Raw payload exposure': '原始 payload 暴露',
  'not exposed': '未暴露',
  exposed: '已暴露',
  'Brand Directory': '品牌列表',
  'Recent created brands': '最近创建品牌',
  'No brands yet': '还没有品牌',
  'Setup page': '配置页',
  'Customer workspace': '客户工作台',
  'Open setup': '打开配置',
  'Open workspace': '打开工作台',
  Website: '网站',
  'Tracking runs': '追踪运行',
  'No runs yet': '还没有运行',
  'OpenRouter key ready': 'OpenRouter key 已就绪',
  'OpenRouter key missing': 'OpenRouter key 缺失',
  'mock default': '默认 mock',
  'openrouter default': '默认 openrouter',
  'continuous paid jobs off': '连续付费任务关闭',
  'Runtime testing settings saved.': '运行测试配置已保存。',
  'Prompt Discovery': 'Prompt 发现',
  'Candidate queue': '候选队列',
  'Loading prompt discovery queue': '正在加载 Prompt 发现队列',
  Runs: '运行',
  'Queue items': '队列项',
  'Blocked brands': '被阻止品牌',
  'Duplicate risk': '重复风险',
  'Low confidence': '低置信度',
  'Competitor gaps': '竞品缺口',
  'Recent runs': '最近运行',
  'No discovery runs yet': '还没有发现运行',
  'Ops reason / note': '运营原因/备注',
  'Edit or replacement text': '编辑或替换文本',
  Shortlist: '加入短名单',
  Approve: '批准',
  Reject: '拒绝',
  'Save edit': '保存编辑',
  Replace: '替换',
  Confirm: '确认',
  Block: '阻止',
  'Override quota': '覆盖配额',
  Working: '处理中',
  'Queues': '队列',
  'All active work': '全部进行中工作',
  'Audit log': '审计日志',
  'Latest activity': '最新活动',
  Category: '分类',
  All: '全部',
  Workflow: '工作流',
  'Admin users': '管理员用户',
  Action: '动作',
  Actor: '操作者',
  Target: '目标',
  Search: '搜索',
  Apply: '应用',
  Reset: '重置',
  Archive: '归档',
  'Report JSON': '报告 JSON',
  'Report HTML': '报告 HTML',
  'Saved view': '保存视图',
  'No saved view': '无保存视图',
  'View name': '视图名称',
  Load: '加载',
  'Save view': '保存视图',
  Delete: '删除',
  'Verification idle': '验证空闲',
  'Verification history loading': '验证历史加载中',
  'Evidence search': '证据搜索',
  'Failed check': '失败检查',
  'All checks': '全部检查',
  'Any failure': '任意失败',
  'Search chain': '搜索链路',
  'Case JSON': '案件 JSON',
  'Case HTML': '案件 HTML',
  'Case bundle': '案件包',
  'Verify bundle': '验证包',
  'Bundle exports': '包导出',
  'Export receipt': '导出回执',
  'Review export': '审核导出',
  'Export reviews': '导出审核',
  'Ready for production': '可进入生产',
  'Production failed': '生产失败',
  'Import needed': '需要导入',
  'Changes requested': '要求修改',
  'Needs quality review': '需要质量审核',
  'Sent to production': '已发送生产',
  'Awaiting customer review': '等待客户审核',
  'Awaiting handoff': '等待交接',
  'Awaiting publish confirmation': '等待发布确认',
  'Ready to schedule retest': '可安排复测',
  'Retest scheduled': '复测已安排',
  'Active tracking runs': '活跃追踪运行',
  'Jobs and failures': '任务与失败',
  'Pending customer reviews': '待客户审核',
  'Publish handoffs': '发布交接',
  'Provider and cost usage': 'Provider 与成本用量',
  'No operator action available': '无可用运营动作',
  'No Prompt Discovery queue items.': '没有 Prompt 发现队列项。',
  'No duplicate, low confidence, over-limit, or competitor-gap candidates need Product Ops review.':
    '没有重复、低置信、超限或竞品缺口候选项需要产品运营审核。',
  'Ops aggregate is unavailable.': '运营汇总不可用。',
  'Check API readiness before using the page.': '使用页面前请检查 API 就绪状态。'
};

function currentLang() {
  return savedLang || DEFAULT_LANG;
}

function isZh() {
  return currentLang() === 'zh';
}

function t(text) {
  if (!isZh()) return text;
  return ZH_TEXT[text] || text;
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
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((input) => {
    const translated = translateTextNodeContent(input.getAttribute('placeholder'));
    if (translated !== input.getAttribute('placeholder')) input.setAttribute('placeholder', translated);
  });
}

function setDashboardLanguage(lang) {
  localStorage.setItem('opsDashboardLang', lang);
  window.location.reload();
}

function renderLanguageChrome() {
  document.documentElement.lang = isZh() ? 'zh-CN' : 'en';
  if (els.langToggle) {
    els.langToggle.textContent = isZh() ? 'EN' : '中文';
    els.langToggle.setAttribute('aria-label', isZh() ? 'Switch to English' : '切换到中文');
  }
}

const state = {
  dashboard: null,
  controlCenter: null,
  controlCenterNotice: null,
  controlCenterBusy: null,
  fullTestBrandName: null,
  promptDiscoveryQueue: null,
  promptDiscoveryNotice: null,
  promptDiscoveryBusy: null,
  promptDiscoveryBrandName: null,
  auditLog: null,
  auditSavedViews: [],
  auditRetention: null,
  auditEvidenceChain: null,
  auditEvidenceCaseBundle: null,
  auditEvidenceCaseBundleExportReceipt: null,
  auditEvidenceCaseBundleExports: [],
  auditEvidenceCaseBundleExportReviews: [],
  auditEvidenceCaseBundleDeliveryReadiness: null,
  auditEvidenceCaseBundleDeliveryGate: null,
  auditEvidenceCaseBundleDeliveryGateReceipts: [],
  auditEvidenceCaseBundleDeliveryHandoffPreview: null,
  auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts: [],
  auditEvidenceCaseBundleDeliveryFinalApprovalPreview: null,
  auditEvidenceCaseBundleDeliveryFinalApprovalReceipts: [],
  auditEvidenceCaseBundleDeliveryFinalApprovalReviews: [],
  auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGate: null,
  auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryDryRunLock: null,
  auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryRehearsal: null,
  auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryDualControlApproval: null,
  auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryReadinessSeal: null,
  auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts: [],
  auditEvidenceCaseBundleFinalDeliverySealedHandoffReview: null,
  auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandEscrow: null,
  auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandRevocation: null,
  auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandClosure: null,
  auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarization: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCustody: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestation: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindow: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmation: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSeal: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoff: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrow: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSeal: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts: [],
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpoint: null,
  auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts: [],
  auditEvidenceCaseBundleVerifications: [],
  auditEvidenceCaseReviewReceipts: [],
  auditEvidenceCaseAnomalyNotificationDigests: [],
  auditEvidenceCaseAnomalyNotificationDigestSchedule: null,
  auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts: [],
  auditEvidenceCases: [],
  auditEvidenceNotifications: [],
  auditNotificationPolicy: null,
  auditNotificationReplayPolicy: null,
  auditNotificationReplayWorkload: null,
  auditNotificationReplayEscalationReport: null,
  auditNotificationReplayPerformanceReport: null,
  auditNotificationReplayPerformanceThresholdPolicy: null,
  auditNotificationReplaySlaAlerts: [],
  auditNotificationReplaySlaAlertSchedule: null,
  auditNotificationReplaySlaAlertDigests: [],
  auditNotificationReplaySlaAlertDigestSchedule: null,
  auditNotificationReplaySlaAlertDigestRetentionReceipts: [],
  auditNotificationRules: [],
  auditNotificationDeliveries: [],
  auditNotificationReplayApprovals: [],
  auditReportArchives: [],
  auditReportVerifications: [],
  auditVerificationReceipt: null,
  adminUsers: [],
  auditFilters: {
    category: 'all',
    action: '',
    actor: '',
    target: '',
    q: ''
  },
  activeQueue: 'all',
  selectedKey: null,
  drawerItemKey: null,
  drawerActionType: null,
  notice: null
};

const els = {
  refreshButton: document.querySelector('#refreshButton'),
  healthBlock: document.querySelector('#healthBlock'),
  queueNav: document.querySelector('#queueNav'),
  summaryGrid: document.querySelector('#summaryGrid'),
  controlCenterPanel: document.querySelector('#controlCenterPanel'),
  promptDiscoveryQueue: document.querySelector('#promptDiscoveryQueue'),
  activeQueueTitle: document.querySelector('#activeQueueTitle'),
  queueList: document.querySelector('#queueList'),
  detailPanel: document.querySelector('#detailPanel'),
  activityList: document.querySelector('#activityList'),
  auditFilterForm: document.querySelector('#auditFilterForm'),
  auditFilterStatus: document.querySelector('#auditFilterStatus'),
  auditResetButton: document.querySelector('#auditResetButton'),
  auditJsonButton: document.querySelector('#auditJsonButton'),
  auditCsvButton: document.querySelector('#auditCsvButton'),
  auditReportJsonButton: document.querySelector('#auditReportJsonButton'),
  auditReportHtmlButton: document.querySelector('#auditReportHtmlButton'),
  auditArchiveButton: document.querySelector('#auditArchiveButton'),
  auditArchiveStatus: document.querySelector('#auditArchiveStatus'),
  auditVerifyInput: document.querySelector('#auditVerifyInput'),
  auditVerifyButton: document.querySelector('#auditVerifyButton'),
  auditTamperButton: document.querySelector('#auditTamperButton'),
  auditLoadReceiptButton: document.querySelector('#auditLoadReceiptButton'),
  auditReceiptButton: document.querySelector('#auditReceiptButton'),
  auditVerifyStatus: document.querySelector('#auditVerifyStatus'),
  auditVerificationHistory: document.querySelector('#auditVerificationHistory'),
  auditEvidenceSearchInput: document.querySelector('#auditEvidenceSearchInput'),
  auditEvidenceFailedCheckSelect: document.querySelector('#auditEvidenceFailedCheckSelect'),
  auditEvidenceSearchButton: document.querySelector('#auditEvidenceSearchButton'),
  auditCaseJsonButton: document.querySelector('#auditCaseJsonButton'),
  auditCaseHtmlButton: document.querySelector('#auditCaseHtmlButton'),
  auditCaseBundleButton: document.querySelector('#auditCaseBundleButton'),
  auditCaseVerifyBundleButton: document.querySelector('#auditCaseVerifyBundleButton'),
  auditCaseBundleExportsButton: document.querySelector('#auditCaseBundleExportsButton'),
  auditCaseBundleExportReceiptJsonButton: document.querySelector('#auditCaseBundleExportReceiptJsonButton'),
  auditCaseBundleExportReviewButton: document.querySelector('#auditCaseBundleExportReviewButton'),
  auditCaseBundleExportReviewsButton: document.querySelector('#auditCaseBundleExportReviewsButton'),
  auditCaseBundleDeliveryReadinessButton: document.querySelector('#auditCaseBundleDeliveryReadinessButton'),
  auditCaseBundleDeliveryGateButton: document.querySelector('#auditCaseBundleDeliveryGateButton'),
  auditCaseBundleDeliveryGateReceiptButton: document.querySelector('#auditCaseBundleDeliveryGateReceiptButton'),
  auditCaseBundleDeliveryGateReceiptsButton: document.querySelector('#auditCaseBundleDeliveryGateReceiptsButton'),
  auditCaseBundleDeliveryGateReceiptJsonButton: document.querySelector('#auditCaseBundleDeliveryGateReceiptJsonButton'),
  auditCaseBundleDeliveryHandoffPreviewButton: document.querySelector('#auditCaseBundleDeliveryHandoffPreviewButton'),
  auditCaseBundleDeliveryHandoffPreviewReceiptButton: document.querySelector('#auditCaseBundleDeliveryHandoffPreviewReceiptButton'),
  auditCaseBundleDeliveryHandoffPreviewReceiptsButton: document.querySelector('#auditCaseBundleDeliveryHandoffPreviewReceiptsButton'),
  auditCaseBundleDeliveryHandoffPreviewReceiptJsonButton: document.querySelector('#auditCaseBundleDeliveryHandoffPreviewReceiptJsonButton'),
  auditCaseBundleDeliveryFinalApprovalPreviewButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalPreviewButton'),
  auditCaseBundleDeliveryFinalApprovalReceiptButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalReceiptButton'),
  auditCaseBundleDeliveryFinalApprovalReceiptsButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalReceiptsButton'),
  auditCaseBundleDeliveryFinalApprovalReceiptJsonButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalReceiptJsonButton'),
  auditCaseBundleDeliveryFinalApprovalConfirmButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalConfirmButton'),
  auditCaseBundleDeliveryFinalApprovalRevokeButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalRevokeButton'),
  auditCaseBundleDeliveryFinalApprovalExpireButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalExpireButton'),
  auditCaseBundleDeliveryFinalApprovalReviewsButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalReviewsButton'),
  auditCaseBundleDeliveryFinalApprovalReviewJsonButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalReviewJsonButton'),
  auditCaseBundleDeliveryFinalApprovalPolicyGateButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalPolicyGateButton'),
  auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton'),
  auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptsButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptsButton'),
  auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptJsonButton: document.querySelector('#auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptJsonButton'),
  auditCaseBundleFinalDeliveryDryRunLockButton: document.querySelector('#auditCaseBundleFinalDeliveryDryRunLockButton'),
  auditCaseBundleFinalDeliveryDryRunLockReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryDryRunLockReceiptButton'),
  auditCaseBundleFinalDeliveryDryRunLockReceiptsButton: document.querySelector('#auditCaseBundleFinalDeliveryDryRunLockReceiptsButton'),
  auditCaseBundleFinalDeliveryDryRunLockReceiptJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryDryRunLockReceiptJsonButton'),
  auditCaseBundleFinalDeliveryRehearsalButton: document.querySelector('#auditCaseBundleFinalDeliveryRehearsalButton'),
  auditCaseBundleFinalDeliveryRehearsalReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryRehearsalReceiptButton'),
  auditCaseBundleFinalDeliveryRehearsalsButton: document.querySelector('#auditCaseBundleFinalDeliveryRehearsalsButton'),
  auditCaseBundleFinalDeliveryRehearsalJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryRehearsalJsonButton'),
  auditCaseBundleFinalDeliveryDualControlApprovalButton: document.querySelector('#auditCaseBundleFinalDeliveryDualControlApprovalButton'),
  auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton'),
  auditCaseBundleFinalDeliveryDualControlApprovalsButton: document.querySelector('#auditCaseBundleFinalDeliveryDualControlApprovalsButton'),
  auditCaseBundleFinalDeliveryDualControlApprovalJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryDualControlApprovalJsonButton'),
  auditCaseBundleFinalDeliveryReadinessSealButton: document.querySelector('#auditCaseBundleFinalDeliveryReadinessSealButton'),
  auditCaseBundleFinalDeliveryReadinessSealReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryReadinessSealReceiptButton'),
  auditCaseBundleFinalDeliveryReadinessSealsButton: document.querySelector('#auditCaseBundleFinalDeliveryReadinessSealsButton'),
  auditCaseBundleFinalDeliveryReadinessSealJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryReadinessSealJsonButton'),
  auditCaseBundleFinalDeliverySealedHandoffReviewButton: document.querySelector('#auditCaseBundleFinalDeliverySealedHandoffReviewButton'),
  auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton: document.querySelector('#auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton'),
  auditCaseBundleFinalDeliverySealedHandoffReviewsButton: document.querySelector('#auditCaseBundleFinalDeliverySealedHandoffReviewsButton'),
  auditCaseBundleFinalDeliverySealedHandoffReviewJsonButton: document.querySelector('#auditCaseBundleFinalDeliverySealedHandoffReviewJsonButton'),
  auditCaseBundleFinalDeliveryCommandEscrowButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandEscrowButton'),
  auditCaseBundleFinalDeliveryCommandEscrowReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandEscrowReceiptButton'),
  auditCaseBundleFinalDeliveryCommandEscrowsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandEscrowsButton'),
  auditCaseBundleFinalDeliveryCommandEscrowJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandEscrowJsonButton'),
  auditCaseBundleFinalDeliveryCommandRevocationButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandRevocationButton'),
  auditCaseBundleFinalDeliveryCommandRevocationReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandRevocationReceiptButton'),
  auditCaseBundleFinalDeliveryCommandRevocationsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandRevocationsButton'),
  auditCaseBundleFinalDeliveryCommandRevocationJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandRevocationJsonButton'),
  auditCaseBundleFinalDeliveryCommandClosureButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandClosureButton'),
  auditCaseBundleFinalDeliveryCommandClosureReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandClosureReceiptButton'),
  auditCaseBundleFinalDeliveryCommandClosuresButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandClosuresButton'),
  auditCaseBundleFinalDeliveryCommandClosureJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandClosureJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailNotarizationButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailNotarizationButton'),
  auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailNotarizationsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailNotarizationsButton'),
  auditCaseBundleFinalDeliveryCommandTrailNotarizationJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailNotarizationJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodiesButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodiesButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton'),
  auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationsButton'),
  auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalWindowsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalWindowsButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalWindowJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalWindowJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationsButton'),
  auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton'),
  auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailCheckpointSealsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCheckpointSealsButton'),
  auditCaseBundleFinalDeliveryCommandTrailCheckpointSealJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCheckpointSealJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffsButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton'),
  auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowsButton'),
  auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton'),
  auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailEvidenceSealsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailEvidenceSealsButton'),
  auditCaseBundleFinalDeliveryCommandTrailEvidenceSealJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailEvidenceSealJsonButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointsButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointsButton'),
  auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointJsonButton: document.querySelector('#auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointJsonButton'),
  auditCaseBundleExportReviewReceiptJsonButton: document.querySelector('#auditCaseBundleExportReviewReceiptJsonButton'),
  auditCaseBundleReceiptsButton: document.querySelector('#auditCaseBundleReceiptsButton'),
  auditCaseBundleReceiptJsonButton: document.querySelector('#auditCaseBundleReceiptJsonButton'),
  auditEvidenceChain: document.querySelector('#auditEvidenceChain'),
  auditCaseAssigneeInput: document.querySelector('#auditCaseAssigneeInput'),
  auditCasePrioritySelect: document.querySelector('#auditCasePrioritySelect'),
  auditCaseDueHoursInput: document.querySelector('#auditCaseDueHoursInput'),
  auditCaseSlaFilterSelect: document.querySelector('#auditCaseSlaFilterSelect'),
  auditCaseResolutionInput: document.querySelector('#auditCaseResolutionInput'),
  auditOpenCaseButton: document.querySelector('#auditOpenCaseButton'),
  auditOpenAnomalyCaseButton: document.querySelector('#auditOpenAnomalyCaseButton'),
  auditResolveCaseButton: document.querySelector('#auditResolveCaseButton'),
  auditCaseReviewReceiptsButton: document.querySelector('#auditCaseReviewReceiptsButton'),
  auditCaseReviewReceiptJsonButton: document.querySelector('#auditCaseReviewReceiptJsonButton'),
  auditAnomalyNotificationGenerateButton: document.querySelector('#auditAnomalyNotificationGenerateButton'),
  auditAnomalyDigestGenerateButton: document.querySelector('#auditAnomalyDigestGenerateButton'),
  auditAnomalyDigestHtmlButton: document.querySelector('#auditAnomalyDigestHtmlButton'),
  auditAnomalyDigestScheduleIntervalInput: document.querySelector('#auditAnomalyDigestScheduleIntervalInput'),
  auditAnomalyDigestRetentionInput: document.querySelector('#auditAnomalyDigestRetentionInput'),
  auditAnomalyDigestScheduleSaveButton: document.querySelector('#auditAnomalyDigestScheduleSaveButton'),
  auditAnomalyDigestScheduleRunButton: document.querySelector('#auditAnomalyDigestScheduleRunButton'),
  auditAnomalyDigestPruneButton: document.querySelector('#auditAnomalyDigestPruneButton'),
  auditAnomalyDigestReceiptButton: document.querySelector('#auditAnomalyDigestReceiptButton'),
  auditEvidenceCaseStatus: document.querySelector('#auditEvidenceCaseStatus'),
  auditNotificationGenerateButton: document.querySelector('#auditNotificationGenerateButton'),
  auditNotificationDeliverButton: document.querySelector('#auditNotificationDeliverButton'),
  auditNotificationForceReasonInput: document.querySelector('#auditNotificationForceReasonInput'),
  auditNotificationReviewNoteInput: document.querySelector('#auditNotificationReviewNoteInput'),
  auditNotificationAssignedReviewerInput: document.querySelector('#auditNotificationAssignedReviewerInput'),
  auditNotificationApprovalStatusSelect: document.querySelector('#auditNotificationApprovalStatusSelect'),
  auditNotificationApprovalExpiredSelect: document.querySelector('#auditNotificationApprovalExpiredSelect'),
  auditNotificationExplainButton: document.querySelector('#auditNotificationExplainButton'),
  auditNotificationReplayButton: document.querySelector('#auditNotificationReplayButton'),
  auditNotificationForceReplayButton: document.querySelector('#auditNotificationForceReplayButton'),
  auditNotificationRequestReplayButton: document.querySelector('#auditNotificationRequestReplayButton'),
  auditNotificationApproveReplayButton: document.querySelector('#auditNotificationApproveReplayButton'),
  auditNotificationRejectReplayButton: document.querySelector('#auditNotificationRejectReplayButton'),
  auditNotificationExecuteReplayButton: document.querySelector('#auditNotificationExecuteReplayButton'),
  auditNotificationAssignReplayButton: document.querySelector('#auditNotificationAssignReplayButton'),
  auditNotificationCleanupExpiredButton: document.querySelector('#auditNotificationCleanupExpiredButton'),
  auditNotificationWorkloadJsonButton: document.querySelector('#auditNotificationWorkloadJsonButton'),
  auditNotificationEscalationHtmlButton: document.querySelector('#auditNotificationEscalationHtmlButton'),
  auditNotificationPerformanceJsonButton: document.querySelector('#auditNotificationPerformanceJsonButton'),
  auditNotificationPerformanceHtmlButton: document.querySelector('#auditNotificationPerformanceHtmlButton'),
  auditReplayThresholdExpiredInput: document.querySelector('#auditReplayThresholdExpiredInput'),
  auditReplayThresholdNearInput: document.querySelector('#auditReplayThresholdNearInput'),
  auditReplayThresholdReviewInput: document.querySelector('#auditReplayThresholdReviewInput'),
  auditReplaySlaScheduleIntervalInput: document.querySelector('#auditReplaySlaScheduleIntervalInput'),
  auditReplaySlaScheduleDueSoonInput: document.querySelector('#auditReplaySlaScheduleDueSoonInput'),
  auditReplaySlaDigestScheduleIntervalInput: document.querySelector('#auditReplaySlaDigestScheduleIntervalInput'),
  auditReplaySlaDigestRetentionInput: document.querySelector('#auditReplaySlaDigestRetentionInput'),
  auditReplayThresholdSaveButton: document.querySelector('#auditReplayThresholdSaveButton'),
  auditReplaySlaAlertGenerateButton: document.querySelector('#auditReplaySlaAlertGenerateButton'),
  auditReplaySlaScheduleSaveButton: document.querySelector('#auditReplaySlaScheduleSaveButton'),
  auditReplaySlaScheduleRunButton: document.querySelector('#auditReplaySlaScheduleRunButton'),
  auditReplaySlaDigestGenerateButton: document.querySelector('#auditReplaySlaDigestGenerateButton'),
  auditReplaySlaDigestHtmlButton: document.querySelector('#auditReplaySlaDigestHtmlButton'),
  auditReplaySlaDigestScheduleSaveButton: document.querySelector('#auditReplaySlaDigestScheduleSaveButton'),
  auditReplaySlaDigestScheduleRunButton: document.querySelector('#auditReplaySlaDigestScheduleRunButton'),
  auditReplaySlaDigestPruneButton: document.querySelector('#auditReplaySlaDigestPruneButton'),
  auditReplaySlaDigestReceiptButton: document.querySelector('#auditReplaySlaDigestReceiptButton'),
  auditReplaySlaAlertAckButton: document.querySelector('#auditReplaySlaAlertAckButton'),
  auditReplaySlaAlertSnoozeButton: document.querySelector('#auditReplaySlaAlertSnoozeButton'),
  auditNotificationWorkloadAckButton: document.querySelector('#auditNotificationWorkloadAckButton'),
  auditNotificationWorkloadReassignButton: document.querySelector('#auditNotificationWorkloadReassignButton'),
  auditNotificationWorkloadResolveButton: document.querySelector('#auditNotificationWorkloadResolveButton'),
  auditNotificationAckButton: document.querySelector('#auditNotificationAckButton'),
  auditNotificationSnoozeButton: document.querySelector('#auditNotificationSnoozeButton'),
  auditNotificationStatus: document.querySelector('#auditNotificationStatus'),
  auditNotificationPolicyStatus: document.querySelector('#auditNotificationPolicyStatus'),
  auditNotificationReplayWorkloadStatus: document.querySelector('#auditNotificationReplayWorkloadStatus'),
  auditReplayThresholdStatus: document.querySelector('#auditReplayThresholdStatus'),
  auditReplaySlaAlertStatus: document.querySelector('#auditReplaySlaAlertStatus'),
  auditReplaySlaScheduleStatus: document.querySelector('#auditReplaySlaScheduleStatus'),
  auditReplaySlaDigestStatus: document.querySelector('#auditReplaySlaDigestStatus'),
  auditReplaySlaDigestScheduleStatus: document.querySelector('#auditReplaySlaDigestScheduleStatus'),
  auditReplaySlaDigestReceiptStatus: document.querySelector('#auditReplaySlaDigestReceiptStatus'),
  auditRuleNameInput: document.querySelector('#auditRuleNameInput'),
  auditRuleKindSelect: document.querySelector('#auditRuleKindSelect'),
  auditRulePrioritySelect: document.querySelector('#auditRulePrioritySelect'),
  auditRuleAdapterSelect: document.querySelector('#auditRuleAdapterSelect'),
  auditRuleRepeatInput: document.querySelector('#auditRuleRepeatInput'),
  auditRuleSuppressInput: document.querySelector('#auditRuleSuppressInput'),
  auditRuleAssigneeInput: document.querySelector('#auditRuleAssigneeInput'),
  auditRuleSaveButton: document.querySelector('#auditRuleSaveButton'),
  auditNotificationRuleStatus: document.querySelector('#auditNotificationRuleStatus'),
  auditNotificationDeliveryStatus: document.querySelector('#auditNotificationDeliveryStatus'),
  auditSavedViewSelect: document.querySelector('#auditSavedViewSelect'),
  auditSavedViewName: document.querySelector('#auditSavedViewName'),
  auditLoadViewButton: document.querySelector('#auditLoadViewButton'),
  auditSaveViewButton: document.querySelector('#auditSaveViewButton'),
  auditDeleteViewButton: document.querySelector('#auditDeleteViewButton'),
  auditRetentionStatus: document.querySelector('#auditRetentionStatus'),
  adminUsersList: document.querySelector('#adminUsersList'),
  adminUserForm: document.querySelector('#adminUserForm'),
  adminNotice: document.querySelector('#adminNotice'),
  sessionPill: document.querySelector('#sessionPill'),
  langToggle: document.querySelector('#langToggle'),
  logoutButton: document.querySelector('#logoutButton')
};

const ACTION_BY_QUEUE = {
  changes_requested: {
    action: 'resume_customer_review',
    label: 'Resume review',
    title: 'Resume customer review',
    submit: 'Resume review',
    description: 'Moves the package back to customer review after revisions are ready.'
  },
  awaiting_handoff: {
    action: 'prepare_handoff',
    label: 'Prepare handoff',
    title: 'Prepare publish handoff',
    submit: 'Prepare handoff',
    description: 'Records manual publishing instructions without publishing automatically.'
  },
  awaiting_publish_confirmation: {
    action: 'mark_published_externally',
    label: 'Confirm publish',
    title: 'Confirm external publish',
    submit: 'Confirm publish',
    description: 'Records a published URL or external reference before retest planning.'
  },
  retest_ready_to_schedule: {
    action: 'schedule_retest',
    label: 'Schedule retest',
    title: 'Schedule post-publish retest',
    submit: 'Schedule retest',
    description: 'Creates a pending retest schedule only. It does not queue an LLM run.'
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function humanDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '$0.000000';
  return `$${number.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function localDateTimeValue(offsetDays = 7) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function priorityClass(priority) {
  return `priority-${priority || 'medium'}`;
}

function flattenItems(dashboard) {
  const queues = dashboard?.product_ops?.queues || dashboard?.queues;
  if (!queues) return [];
  return Object.values(queues)
    .flatMap((queue) => queue.items || [])
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
}

function visibleItems() {
  const all = flattenItems(state.dashboard);
  if (state.activeQueue === 'all') return all;
  return all.filter((item) => item.queue === state.activeQueue);
}

function selectedItem() {
  return flattenItems(state.dashboard).find((item) => itemKey(item) === state.selectedKey) || visibleItems()[0] || null;
}

function queueTitle(key) {
  if (key === 'all') return 'All active work';
  return state.dashboard?.product_ops?.queues?.[key]?.label || state.dashboard?.queues?.[key]?.label || key;
}

function queueForHandoffStatus(status) {
  const map = {
    changes_requested: 'changes_requested',
    customer_review: 'awaiting_customer_review',
    approved_for_publish_handoff: 'awaiting_handoff',
    handoff_prepared: 'awaiting_publish_confirmation',
    published_externally: 'retest_ready_to_schedule',
    retest_scheduled: 'retest_scheduled'
  };
  return map[status] || null;
}

async function fetchDashboard() {
  const response = await fetch('/internal/ops/dashboard?limit=300&limit_per_queue=75');
  if (!response.ok) {
    throw new Error(`Ops dashboard returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.dashboard;
}

async function fetchControlCenter() {
  const response = await fetch('/internal/ops/control-center');
  if (!response.ok) {
    throw new Error(`Ops control center returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.control_center;
}

async function fetchPromptDiscoveryQueue() {
  const response = await fetch('/internal/ops/prompt-discovery?limit=50&limit_per_run=30');
  if (!response.ok) {
    throw new Error(`Prompt discovery queue returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.prompt_discovery_queue;
}

function auditQuery({ format = null, limit = 60 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  Object.entries(state.auditFilters).forEach(([key, value]) => {
    if (value && !(key === 'category' && value === 'all')) params.set(key, value);
  });
  if (format) params.set('format', format);
  return params.toString();
}

async function fetchAuditLog() {
  const response = await fetch(`/internal/ops/audit-log?${auditQuery({ limit: 60 })}`);
  if (!response.ok) {
    throw new Error(`Ops audit log returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.audit_log;
}

async function fetchAdminUsers() {
  const response = await fetch('/internal/ops/admin-users');
  if (response.status === 403) return { forbidden: true, users: [] };
  if (!response.ok) {
    throw new Error(`Admin users returned ${response.status}`);
  }
  const payload = await response.json();
  return { forbidden: false, users: payload.users || [] };
}

async function fetchAuditSavedViews() {
  const response = await fetch('/internal/ops/audit-views');
  if (!response.ok) {
    throw new Error(`Audit saved views returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.views || [];
}

async function fetchAuditRetention() {
  const response = await fetch('/internal/ops/audit-retention');
  if (!response.ok) {
    throw new Error(`Audit retention returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.retention;
}

async function fetchAuditReportArchives() {
  const response = await fetch('/internal/ops/audit-report-archives?limit=5');
  if (!response.ok) {
    throw new Error(`Audit report archives returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.archives || [];
}

async function fetchAuditReportVerifications() {
  const response = await fetch('/internal/ops/audit-report-verifications?limit=5');
  if (!response.ok) {
    throw new Error(`Audit report verifications returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.verifications || [];
}

async function fetchAuditEvidenceChain() {
  const params = evidenceChainQuery({ limit: 8 });
  const response = await fetch(`/internal/ops/audit-evidence-chain?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Audit evidence chain returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.evidence_chain;
}

async function fetchAuditEvidenceCases() {
  const params = new URLSearchParams({ limit: '5' });
  const slaStatus = els.auditCaseSlaFilterSelect.value;
  if (slaStatus) params.set('sla_status', slaStatus);
  const response = await fetch(`/internal/ops/audit-evidence-cases?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Audit evidence cases returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.cases || [];
}

async function fetchAuditEvidenceCaseReviewReceipts() {
  const latestCase = state.auditEvidenceCases[0];
  const params = new URLSearchParams({ limit: '5' });
  if (latestCase?.id) params.set('case_id', latestCase.id);
  const response = await fetch(`/internal/ops/audit-evidence-case-review-receipts?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Audit evidence case review receipts returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.receipts || [];
}

async function fetchAuditEvidenceCaseAnomalyNotificationDigests() {
  const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digests?limit=5');
  if (!response.ok) {
    throw new Error(`Audit anomaly notification digests returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.digests || [];
}

async function fetchAuditEvidenceCaseAnomalyNotificationDigestSchedule() {
  const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule');
  if (!response.ok) {
    throw new Error(`Audit anomaly notification digest schedule returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.schedule;
}

async function fetchAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digest-retention-receipts?limit=5');
  if (!response.ok) {
    throw new Error(`Audit anomaly notification digest retention receipts returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.receipts || [];
}

async function fetchAuditEvidenceNotifications() {
  const response = await fetch('/internal/ops/audit-evidence-case-notifications?limit=5');
  if (!response.ok) {
    throw new Error(`Audit evidence notifications returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.notifications || [];
}

async function fetchAuditNotificationPolicy() {
  const response = await fetch('/internal/ops/audit-notification-policy');
  if (!response.ok) {
    throw new Error(`Audit notification policy returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.policy;
}

async function fetchAuditNotificationRules() {
  const response = await fetch('/internal/ops/audit-notification-rules?limit=5');
  if (!response.ok) {
    throw new Error(`Audit notification rules returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.rules || [];
}

async function fetchAuditNotificationDeliveries() {
  const response = await fetch('/internal/ops/audit-notification-deliveries?limit=5');
  if (!response.ok) {
    throw new Error(`Audit notification deliveries returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.attempts || [];
}

async function fetchAuditNotificationReplayApprovals() {
  const params = new URLSearchParams({ limit: '5' });
  const status = els.auditNotificationApprovalStatusSelect?.value || '';
  const expired = els.auditNotificationApprovalExpiredSelect?.value || '';
  const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
  if (status) params.set('status', status);
  if (expired) params.set('expired', expired);
  if (assignedReviewer) params.set('assigned_reviewer', assignedReviewer);
  const response = await fetch(`/internal/ops/audit-notification-replay-approvals?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Audit notification replay approvals returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.approvals || [];
}

async function fetchAuditNotificationReplayWorkload() {
  const params = new URLSearchParams({ limit: '100', due_soon_hours: '4' });
  const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
  if (assignedReviewer) params.set('assigned_reviewer', assignedReviewer);
  const response = await fetch(`/internal/ops/audit-notification-replay-workload?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Audit notification replay workload returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.workload;
}

async function fetchAuditNotificationReplayPerformanceReport() {
  const params = new URLSearchParams({ limit: '100', due_soon_hours: '4' });
  const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
  if (assignedReviewer) params.set('assigned_reviewer', assignedReviewer);
  const response = await fetch(`/internal/ops/audit-notification-replay-performance-report?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Audit notification replay performance returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.report;
}

async function fetchAuditNotificationReplayPerformanceThresholdPolicy() {
  const response = await fetch('/internal/ops/audit-notification-replay-performance-thresholds');
  if (!response.ok) {
    throw new Error(`Audit notification replay performance thresholds returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.policy;
}

async function fetchAuditNotificationReplaySlaAlerts() {
  const params = new URLSearchParams({ limit: '50' });
  const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
  if (assignedReviewer) params.set('reviewer', assignedReviewer);
  const response = await fetch(`/internal/ops/audit-notification-replay-sla-alerts?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Audit notification replay SLA alerts returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.alerts || [];
}

async function fetchAuditNotificationReplaySlaAlertSchedule() {
  const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-schedule');
  if (!response.ok) {
    throw new Error(`Audit notification replay SLA schedule returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.schedule;
}

async function fetchAuditNotificationReplaySlaAlertDigests() {
  const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digests?limit=10');
  if (!response.ok) {
    throw new Error(`Audit notification replay SLA digests returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.digests || [];
}

async function fetchAuditNotificationReplaySlaAlertDigestSchedule() {
  const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digest-schedule');
  if (!response.ok) {
    throw new Error(`Audit notification replay SLA digest schedule returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.schedule;
}

async function fetchAuditNotificationReplaySlaAlertDigestRetentionReceipts() {
  const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digest-retention-receipts?limit=5');
  if (!response.ok) {
    throw new Error(`Audit notification replay SLA digest retention receipts returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.receipts || [];
}

async function fetchAuditNotificationReplayPolicy() {
  const response = await fetch('/internal/ops/audit-notification-replay-policy');
  if (!response.ok) {
    throw new Error(`Audit notification replay policy returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.policy;
}

function evidenceChainQuery(overrides = {}) {
  const params = new URLSearchParams({ limit: String(overrides.limit || 50) });
  const q = els.auditEvidenceSearchInput.value.trim();
  const failedCheck = els.auditEvidenceFailedCheckSelect.value;
  if (q) params.set('q', q);
  if (failedCheck) params.set('failed_check', failedCheck);
  if (overrides.format) params.set('format', overrides.format);
  return params;
}

async function fetchSession() {
  const response = await fetch('/internal/ops/session');
  if (!response.ok) {
    throw new Error(`Ops session returned ${response.status}`);
  }
  const payload = await response.json();
  return payload.user;
}

async function refreshSession() {
  try {
    const user = await fetchSession();
    els.sessionPill.textContent = `${user.display_name || user.username} · ${user.role}`;
  } catch {
    els.sessionPill.textContent = t('Session unavailable');
  }
}

async function logout() {
  els.logoutButton.disabled = true;
  try {
    await fetch('/internal/ops/session/logout', { method: 'POST' });
  } finally {
    window.location.href = '/internal/ops/login';
  }
}

async function postOpsAction(item, payload) {
  const isProductAction = payload.product_ops_action === true;
  const endpoint = isProductAction ? '/internal/ops/product-actions' : item.route_hints.ops_action_endpoint;
  if (!endpoint) {
    throw new Error('This item has no ops action endpoint.');
  }
  delete payload.product_ops_action;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Ops action returned ${response.status}`);
  }
  return body.result;
}

async function postAdminUser(payload) {
  const response = await fetch('/internal/ops/admin-users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Create admin user returned ${response.status}`);
  }
  return body.user;
}

async function patchAdminUser(username, payload) {
  const response = await fetch(`/internal/ops/admin-users/${encodeURIComponent(username)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Update admin user returned ${response.status}`);
  }
  return body.user;
}

async function refreshDashboard({ preserveSelection = false, preserveHandoffId = null } = {}) {
  els.refreshButton.disabled = true;
  els.refreshButton.textContent = t('Refreshing');
  try {
    const previousKey = state.selectedKey;
    const [
      dashboard,
      controlCenter,
      promptDiscoveryQueue,
      auditLog,
      adminUsersResult,
      auditSavedViews,
      auditRetention,
      auditReportArchives,
      auditReportVerifications,
      auditEvidenceChain,
      auditEvidenceCases,
      auditEvidenceCaseReviewReceipts,
      auditEvidenceCaseAnomalyNotificationDigests,
      auditEvidenceCaseAnomalyNotificationDigestSchedule,
      auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts,
      auditEvidenceNotifications,
      auditNotificationPolicy,
      auditNotificationReplayPolicy,
      auditNotificationReplayWorkload,
      auditNotificationReplayPerformanceReport,
      auditNotificationReplayPerformanceThresholdPolicy,
      auditNotificationReplaySlaAlerts,
      auditNotificationReplaySlaAlertSchedule,
      auditNotificationReplaySlaAlertDigests,
      auditNotificationReplaySlaAlertDigestSchedule,
      auditNotificationReplaySlaAlertDigestRetentionReceipts,
      auditNotificationRules,
      auditNotificationDeliveries,
      auditNotificationReplayApprovals
    ] = await Promise.all([
      fetchDashboard(),
      fetchControlCenter(),
      fetchPromptDiscoveryQueue(),
      fetchAuditLog(),
      fetchAdminUsers(),
      fetchAuditSavedViews(),
      fetchAuditRetention(),
      fetchAuditReportArchives(),
      fetchAuditReportVerifications(),
      fetchAuditEvidenceChain(),
      fetchAuditEvidenceCases(),
      fetchAuditEvidenceCaseReviewReceipts(),
      fetchAuditEvidenceCaseAnomalyNotificationDigests(),
      fetchAuditEvidenceCaseAnomalyNotificationDigestSchedule(),
      fetchAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipts(),
      fetchAuditEvidenceNotifications(),
      fetchAuditNotificationPolicy(),
      fetchAuditNotificationReplayPolicy(),
      fetchAuditNotificationReplayWorkload(),
      fetchAuditNotificationReplayPerformanceReport(),
      fetchAuditNotificationReplayPerformanceThresholdPolicy(),
      fetchAuditNotificationReplaySlaAlerts(),
      fetchAuditNotificationReplaySlaAlertSchedule(),
      fetchAuditNotificationReplaySlaAlertDigests(),
      fetchAuditNotificationReplaySlaAlertDigestSchedule(),
      fetchAuditNotificationReplaySlaAlertDigestRetentionReceipts(),
      fetchAuditNotificationRules(),
      fetchAuditNotificationDeliveries(),
      fetchAuditNotificationReplayApprovals()
    ]);
    state.dashboard = dashboard;
    state.controlCenter = controlCenter;
    state.promptDiscoveryQueue = promptDiscoveryQueue;
    state.auditLog = auditLog;
    state.adminUsers = adminUsersResult.users;
    state.adminUsersForbidden = adminUsersResult.forbidden;
    state.auditSavedViews = auditSavedViews;
    state.auditRetention = auditRetention;
    state.auditReportArchives = auditReportArchives;
    state.auditReportVerifications = auditReportVerifications;
    state.auditEvidenceChain = auditEvidenceChain;
    state.auditEvidenceCases = auditEvidenceCases;
    state.auditEvidenceCaseReviewReceipts = auditEvidenceCaseReviewReceipts;
    state.auditEvidenceCaseAnomalyNotificationDigests = auditEvidenceCaseAnomalyNotificationDigests;
    state.auditEvidenceCaseAnomalyNotificationDigestSchedule = auditEvidenceCaseAnomalyNotificationDigestSchedule;
    state.auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts = auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts;
    state.auditEvidenceNotifications = auditEvidenceNotifications;
    state.auditNotificationPolicy = auditNotificationPolicy;
    state.auditNotificationReplayPolicy = auditNotificationReplayPolicy;
    state.auditNotificationReplayWorkload = auditNotificationReplayWorkload;
    state.auditNotificationReplayPerformanceReport = auditNotificationReplayPerformanceReport;
    state.auditNotificationReplayPerformanceThresholdPolicy = auditNotificationReplayPerformanceThresholdPolicy;
    state.auditNotificationReplaySlaAlerts = auditNotificationReplaySlaAlerts;
    state.auditNotificationReplaySlaAlertSchedule = auditNotificationReplaySlaAlertSchedule;
    state.auditNotificationReplaySlaAlertDigests = auditNotificationReplaySlaAlertDigests;
    state.auditNotificationReplaySlaAlertDigestSchedule = auditNotificationReplaySlaAlertDigestSchedule;
    state.auditNotificationReplaySlaAlertDigestRetentionReceipts = auditNotificationReplaySlaAlertDigestRetentionReceipts;
    state.auditNotificationRules = auditNotificationRules;
    state.auditNotificationDeliveries = auditNotificationDeliveries;
    state.auditNotificationReplayApprovals = auditNotificationReplayApprovals;
    const flattened = flattenItems(state.dashboard);
    const nextSelected = preserveHandoffId
      ? flattened.find((item) => item.ids?.publish_handoff_id === preserveHandoffId)
      : preserveSelection
        ? flattened.find((item) => itemKey(item) === previousKey)
        : visibleItems()[0] || flattened[0];
    state.selectedKey = nextSelected ? itemKey(nextSelected) : null;
    render();
  } catch (error) {
    els.healthBlock.innerHTML = `
      <span class="label">Status</span>
      <strong>Load failed</strong>
      <small>${escapeHtml(error.message)}</small>
    `;
    els.queueList.innerHTML = emptyState('Ops aggregate is unavailable.', 'Check API readiness before using the page.');
  } finally {
    els.refreshButton.disabled = false;
    els.refreshButton.textContent = t('Refresh');
  }
}

function itemKey(item) {
  const ids = item.ids || {};
  const article = item.article || {};
  return `${item.item_type || item.queue}:${ids.publish_handoff_id || ids.production_handoff_id || ids.retest_schedule_id || article.article_draft_id || item.tracking_run_id || item.brand?.id || item.label}`;
}

function actionForItem(item) {
  if (Array.isArray(item?.available_actions) && item.available_actions.length) {
    const selected = item.available_actions.find((entry) => entry.type === state.drawerActionType) || item.available_actions[0];
    return {
      action: selected.type,
      label: selected.label,
      title: selected.label,
      submit: selected.label,
      description: selected.customer_visible_impact || selected.precondition || 'Runs a controlled R7.2 product ops action.',
      product_ops_action: true
    };
  }
  if (!item?.ids?.publish_handoff_id) return null;
  return ACTION_BY_QUEUE[item.queue] || null;
}

function renderSummary() {
  const summary = state.dashboard?.summary || {};
  const product = state.dashboard?.product_ops?.summary || null;
  const metric = (label, value) => `
    <div class="metric">
      <span class="label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? 0)}</strong>
    </div>
  `;
  els.summaryGrid.innerHTML = product
    ? [
        metric('Product queue', product.total_product_queue_items),
        metric('Urgent', product.urgent_count),
        metric('GeoFlow readiness', product.geoflow_readiness || 0),
        metric('Due retests', product.due_retests),
        metric('Provider calls 30d', product.provider_calls_30d)
      ].join('')
    : [
        metric('Total', summary.total_items),
        metric('High', summary.high_priority),
        metric('Medium', summary.medium_priority),
        metric('Low', summary.low_priority)
      ].join('');
}

function renderPilotDetailList(title, items = []) {
  const safeItems = items.length ? items : ['No details recorded'];
  return `
    <div class="pilot-detail-block">
      <strong>${escapeHtml(title)}</strong>
      <ol>
        ${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ol>
    </div>
  `;
}

function renderProviderPilotRow(pilot) {
  const usage = pilot.usage || {};
  const hasAnswerPreview = Boolean(pilot.answer_preview);
  const answerPreview = pilot.answer_preview
    ? `<p class="pilot-answer">${escapeHtml(pilot.answer_preview)}</p>`
    : `<p class="pilot-answer muted-answer">${escapeHtml(
        'The earlier pilot was recorded before answer previews were persisted. Fixture files inside rebuilt containers may no longer exist.'
      )}</p>`;
  const cost = pilot.actual_cost_estimate_usd || pilot.cost_estimate_usd || 0;
  const budget = pilot.budget_max_estimated_cost_usd || 0;
  const secretExposure = pilot.openrouter_api_key_exposed ? 'exposed' : 'not exposed';
  const rawExposure = pilot.raw_provider_payload_exposed ? 'exposed' : 'not exposed';
  const executed = pilot.event_type === 'provider_call' || Boolean(pilot.provider_response_id);
  const withinBudget = budget ? Number(cost) <= Number(budget) : null;
  const safe = !pilot.openrouter_api_key_exposed && !pilot.raw_provider_payload_exposed;

  return `
    <div class="provider-pilot-row">
      <div class="pilot-head">
        <div>
          <strong>${escapeHtml(pilot.brand_name || 'Unknown brand')}</strong>
          <span>${escapeHtml(pilot.brand_vertical || 'vertical n/a')} · ${escapeHtml(
            pilot.model_display_name || pilot.model_id || 'model n/a'
          )}</span>
        </div>
        <span class="badge priority-low">${escapeHtml(pilot.event_type || 'provider_call')}</span>
      </div>
      <div class="pilot-result-summary" aria-label="Result summary">
        <div class="pilot-summary-copy">
          <span class="label">Result summary</span>
          <strong>${escapeHtml(pilot.prompt_text || 'Prompt text unavailable')}</strong>
          <p>This is the connectivity pilot result card. It includes the single prompt, cost, tokens, response id, answer status, process, and benchmark.</p>
        </div>
        <div class="pilot-summary-pills">
          <span class="result-pill ${executed ? 'is-good' : 'is-muted'}">${executed ? 'Live call executed' : 'No live call'}</span>
          <span class="result-pill ${hasAnswerPreview ? 'is-good' : 'is-warning'}">${hasAnswerPreview ? 'Answer saved' : 'Answer missing'}</span>
          <span class="result-pill ${withinBudget === null ? 'is-muted' : withinBudget ? 'is-good' : 'is-danger'}">${
            withinBudget === null ? 'Budget unknown' : 'Cost within budget'
          }</span>
          <span class="result-pill ${safe ? 'is-good' : 'is-danger'}">Safety passed</span>
        </div>
      </div>
      <dl class="pilot-meta-grid">
        <div><dt>Test question</dt><dd>${escapeHtml(pilot.prompt_text || 'Prompt text unavailable')}</dd></div>
        <div><dt>Actual cost</dt><dd>${escapeHtml(money(cost))}</dd></div>
        <div><dt>Budget cap</dt><dd>${budget ? escapeHtml(money(budget)) : 'n/a'}</dd></div>
        <div><dt>Input tokens</dt><dd>${escapeHtml(usage.input_tokens || 0)}</dd></div>
        <div><dt>Output tokens</dt><dd>${escapeHtml(usage.output_tokens || 0)}</dd></div>
        <div><dt>Response id</dt><dd>${escapeHtml(pilot.provider_response_id || 'n/a')}</dd></div>
        <div><dt>Fixture</dt><dd>${escapeHtml(pilot.fixture_path || 'n/a')}</dd></div>
        <div><dt>Secret exposure</dt><dd>${escapeHtml(secretExposure)}</dd></div>
        <div><dt>Raw payload exposure</dt><dd>${escapeHtml(rawExposure)}</dd></div>
      </dl>
      <div class="pilot-answer-block">
        <strong>Provider answer preview</strong>
        ${answerPreview}
      </div>
      <div class="pilot-detail-grid">
        ${renderPilotDetailList('Test process', pilot.test_process)}
        ${renderPilotDetailList('Evaluation criteria', pilot.evaluation_criteria)}
      </div>
    </div>
  `;
}

function renderFullTrackingTestRow(test) {
  const scores = test.scores || {};
  const isMock = (test.provider_mode || 'mock') === 'mock' || test.score_meaning === 'pipeline_validation';
  const scoreLabel = (label) => (isMock ? `Mock ${label}` : label);
  const visibility = scores.visibility_score ?? 'n/a';
  const sourceQuality = scores.source_quality_score ?? 'n/a';
  const competitorPressure = scores.competitor_pressure_score ?? 'n/a';
  const customerUrl = test.customer_dashboard_url || `/dashboard/articles?run_id=${encodeURIComponent(test.id || '')}`;
  const resultsUrl = test.internal_results_url || `/internal/tracking/runs/${encodeURIComponent(test.id || '')}/results`;
  return `
    <div class="full-test-row">
      <div class="pilot-head">
        <div>
          <strong>${escapeHtml(test.brand_name || 'Unknown brand')}</strong>
          <span>${escapeHtml(test.brand_vertical || 'vertical n/a')} · ${escapeHtml(test.status || 'status n/a')} · ${escapeHtml(
            test.id || 'run n/a'
          )}</span>
        </div>
        <div class="pilot-summary-pills compact-pills">
          <span class="result-pill ${isMock ? 'is-warning' : 'is-good'}">${isMock ? 'Mock validation' : 'Live provider measurement'}</span>
          <span class="result-pill ${test.paid_provider_call_executed ? 'is-good' : 'is-muted'}">${
            test.paid_provider_call_executed ? 'Paid call executed' : 'No paid provider call'
          }</span>
        </div>
      </div>
      <div class="measurement-warning ${isMock ? 'is-mock' : 'is-live'}">
        ${
          isMock
            ? 'This run used simulated provider answers. Metrics below validate the pipeline only; they are not real OpenRouter/GPT/Gemini/Llama visibility scores.'
            : 'This run used live provider answers. Metrics below are real measured AI visibility results for the selected matrix.'
        }
      </div>
      <div class="full-test-metrics">
        ${renderMiniMetric('Prompts', test.prompt_count || 0)}
        ${renderMiniMetric('Models', test.model_count || 0)}
        ${renderMiniMetric('Answers', test.completed_count || 0)}
        ${renderMiniMetric('Parsed', test.parsed_count || 0)}
        ${renderMiniMetric(scoreLabel('Visibility'), visibility)}
        ${renderMiniMetric(scoreLabel('Source quality'), sourceQuality)}
        ${renderMiniMetric(scoreLabel('Competitor pressure'), competitorPressure)}
      </div>
      <div class="brand-directory-actions full-test-actions">
        <a href="${escapeHtml(customerUrl)}" target="_blank" rel="noreferrer">Open customer report</a>
        <a href="${escapeHtml(resultsUrl)}" target="_blank" rel="noreferrer">Open raw results</a>
      </div>
    </div>
  `;
}

function renderMiniMetric(label, value) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderFullTrackingMatrixPreview(preview) {
  if (!preview) {
    return '<div class="control-readonly">No matrix preview available</div>';
  }

  const prompts = preview.prompts || [];
  const models = preview.models || [];
  const promptRows = prompts.length
    ? prompts
        .map(
          (prompt) => `
            <li>
              <span>${escapeHtml((prompt.index ?? 0) + 1)}. ${escapeHtml(prompt.category || 'prompt')} · ${escapeHtml(
                prompt.prompt_source || 'source n/a'
              )}${prompt.default_template_match ? ' · default template' : ''}</span>
              <strong>${escapeHtml(prompt.prompt_text || '')}</strong>
            </li>
          `
        )
        .join('')
    : '<li><span>0</span><strong>No matrix preview available</strong></li>';
  const modelRows = models.length
    ? models
        .map(
          (model) => `
            <li>
              <span>${escapeHtml((model.index ?? 0) + 1)}. ${escapeHtml(model.provider_id || 'openrouter')}</span>
              <strong>${escapeHtml(model.display_name || model.model_id || '')}</strong>
              <small>${escapeHtml(model.model_id || '')}</small>
            </li>
          `
        )
        .join('')
    : '<li><span>0</span><strong>No matrix preview available</strong></li>';

  return `
    <div class="matrix-preview">
      <div class="matrix-preview-head">
        <span class="label">Matrix preview</span>
        ${
          preview.has_default_template_prompts
            ? '<span class="badge priority-high">Default template prompts detected</span>'
            : ''
        }
        <div class="matrix-preview-metrics">
          ${renderMiniMetric('Planned calls', preview.planned_calls || 0)}
          ${renderMiniMetric('Estimated cost', money(preview.estimated_cost_usd || 0))}
        </div>
      </div>
      <div class="matrix-preview-columns">
        <div>
          <strong>Questions to ask</strong>
          <ul>${promptRows}</ul>
        </div>
        <div>
          <strong>Models to call</strong>
          <ul>${modelRows}</ul>
        </div>
      </div>
    </div>
  `;
}

function renderControlCenter() {
  if (!els.controlCenterPanel) return;
  const control = state.controlCenter;
  if (!control) {
    els.controlCenterPanel.innerHTML = `
      <div class="section-title">
        <span class="label">Ops Control Center</span>
        <strong>Live testing and intake controls</strong>
      </div>
      <div class="control-center-loading">Loading control center</div>
    `;
    applyChineseText(els.controlCenterPanel);
    return;
  }

  const settings = control.settings || {};
  const config = control.runtime_config_preview || {};
  const brands = control.brands || [];
  const pilots = control.recent_paid_provider_pilots || [];
  const fullTests = control.recent_full_tracking_tests || [];
  const selectedFullBrand = state.fullTestBrandName || settings.default_brand_name || brands[0]?.name || '';
  const fullPreview = (control.full_tracking_previews || []).find(
    (preview) => String(preview.brand_name || '').toLowerCase() === String(selectedFullBrand || '').toLowerCase()
  );
  const brandOptions = brands.length
    ? brands
        .map(
          (brand) =>
            `<option value="${escapeHtml(brand.name)}" ${brand.name === selectedFullBrand ? 'selected' : ''}>${escapeHtml(
              brand.name
            )} · ${escapeHtml(brand.plan_code || 'plan')}</option>`
        )
        .join('')
    : `<option value="${escapeHtml(settings.default_brand_name || '')}">${escapeHtml(settings.default_brand_name || '')}</option>`;
  const modelOptions = (control.model_targets || [])
    .map(
      (model, index) =>
        `<option value="${escapeHtml(index)}" ${Number(settings.default_model_index || 0) === index ? 'selected' : ''}>${escapeHtml(
          model.display_name || model.model_id
        )}</option>`
    )
    .join('');
  const recent = pilots.length
    ? pilots
        .slice(0, 5)
        .map((pilot) => renderProviderPilotRow(pilot))
        .join('')
    : '<div class="control-ledger-row">No paid provider pilot ledger events yet</div>';
  const recentFullTests = fullTests.length
    ? fullTests
        .slice(0, 5)
        .map((test) => renderFullTrackingTestRow(test))
        .join('')
    : '<div class="control-ledger-row">No full GEO tests yet</div>';
  const brandDirectory = brands.length
    ? brands
        .slice(0, 10)
        .map((brand) => {
          const setupUrl = brand.dashboard_urls?.setup || `/dashboard/setup?brand_name=${encodeURIComponent(brand.name || '')}`;
          const articlesUrl =
            brand.dashboard_urls?.articles || `/dashboard/articles?brand_name=${encodeURIComponent(brand.name || '')}`;
          const runCount = Number(brand.tracking_run_count || 0);
          return `
            <div class="brand-directory-row">
              <div class="brand-directory-main">
                <strong>${escapeHtml(brand.name || 'Unknown brand')}</strong>
                <span>${escapeHtml(brand.vertical || 'vertical n/a')} · ${escapeHtml(brand.plan_code || 'plan n/a')} · ${escapeHtml(
                  brand.email || 'email n/a'
                )}</span>
                <small>${escapeHtml(brand.website_url || 'No site')}</small>
              </div>
              <div class="brand-directory-stats">
                <span>${escapeHtml(brand.prompt_count || 0)} prompts</span>
                <span>${escapeHtml(brand.competitor_count || 0)} competitors</span>
                <span>${runCount ? `${escapeHtml(runCount)} runs` : 'No runs yet'}</span>
              </div>
              <div class="brand-directory-actions">
                <a href="${escapeHtml(setupUrl)}" target="_blank" rel="noreferrer">Open setup</a>
                <a href="${escapeHtml(articlesUrl)}" target="_blank" rel="noreferrer">Open workspace</a>
              </div>
            </div>
          `;
        })
        .join('')
    : '<div class="brand-directory-row empty-brand-row">No brands yet</div>';

  els.controlCenterPanel.innerHTML = `
    <div class="section-title">
      <span class="label">Ops Control Center</span>
      <strong>Live testing and intake controls</strong>
    </div>
    ${state.controlCenterNotice ? `<div class="notice ${state.controlCenterNotice.type}">${escapeHtml(state.controlCenterNotice.message)}</div>` : ''}
    <div class="control-status-strip">
      <span class="badge ${config.openrouter_api_key_present ? 'priority-low' : 'priority-high'}">OpenRouter ${
        config.openrouter_api_key_present ? 'key ready' : 'key missing'
      }</span>
      <span class="badge ${settings.default_provider_mode === 'openrouter' ? 'priority-medium' : 'priority-low'}">${escapeHtml(
        settings.default_provider_mode || 'mock'
      )} default</span>
      <span class="badge priority-low">scheduler ${escapeHtml(config.scheduler_provider_mode || 'mock')}</span>
      <span class="badge priority-low">continuous paid jobs off</span>
    </div>
    <div class="control-center-grid">
      <form class="control-card" id="controlSettingsForm">
        <div class="mini-title">
          <span class="label">Runtime</span>
          <strong>Testing defaults</strong>
        </div>
        <label class="toggle-row">
          <input name="live_provider_testing_enabled" type="checkbox" ${settings.live_provider_testing_enabled ? 'checked' : ''} />
          <span>Bounded live provider testing</span>
        </label>
        <label class="field compact-field">
          <span>Default mode</span>
          <select name="default_provider_mode">
            <option value="mock" ${settings.default_provider_mode === 'mock' ? 'selected' : ''}>mock</option>
            <option value="openrouter" ${settings.default_provider_mode === 'openrouter' ? 'selected' : ''}>openrouter</option>
          </select>
        </label>
        <label class="field compact-field">
          <span>Max estimated cost</span>
          <input name="max_estimated_cost_usd" type="number" step="0.001" min="0" max="5" value="${escapeHtml(
            settings.max_estimated_cost_usd ?? 0.05
          )}" />
        </label>
        <label class="field compact-field">
          <span>Default brand</span>
          <input name="default_brand_name" value="${escapeHtml(settings.default_brand_name || '')}" />
        </label>
        <div class="split-fields">
          <label class="field compact-field">
            <span>Prompt index</span>
            <input name="default_prompt_index" type="number" min="0" value="${escapeHtml(settings.default_prompt_index || 0)}" />
          </label>
          <label class="field compact-field">
            <span>Model index</span>
            <input name="default_model_index" type="number" min="0" value="${escapeHtml(settings.default_model_index || 0)}" />
          </label>
        </div>
        <button class="small-submit" type="submit">${state.controlCenterBusy === 'settings' ? 'Saving' : 'Save settings'}</button>
      </form>

      <form class="control-card" id="controlPilotForm">
        <div class="mini-title">
          <span class="label">Provider Connectivity Pilot</span>
          <strong>One-call live gate</strong>
        </div>
        <label class="field compact-field">
          <span>Brand</span>
          <select name="brand_name">${brandOptions}</select>
        </label>
        <label class="field compact-field">
          <span>Model</span>
          <select name="model_index">${modelOptions}</select>
        </label>
        <div class="split-fields">
          <label class="field compact-field">
            <span>Prompt index</span>
            <input name="prompt_index" type="number" min="0" value="${escapeHtml(settings.default_prompt_index || 0)}" />
          </label>
          <label class="field compact-field">
            <span>Budget</span>
            <input name="max_estimated_cost_usd" type="number" step="0.001" min="0" max="5" value="${escapeHtml(
              settings.max_estimated_cost_usd ?? 0.05
            )}" />
          </label>
        </div>
        <label class="field compact-field">
          <span>Fixture name</span>
          <input name="fixture_name" placeholder="optional-fixture-name" />
        </label>
        <label class="toggle-row danger-toggle">
          <input name="execute_live" type="checkbox" />
          <span>Execute one live OpenRouter call</span>
        </label>
        <button class="refresh-button control-run" type="submit">${
          state.controlCenterBusy === 'pilot' ? 'Running' : 'Run connectivity pilot'
        }</button>
        <div class="control-readonly">Unchecked submit returns readiness/blocked state only. Checked submit can spend up to the budget.</div>
      </form>

      <form class="control-card" id="controlFullTestForm">
        <div class="mini-title">
          <span class="label">Full GEO Test / Tracking Run</span>
          <strong>Tracking, parser, scoring</strong>
        </div>
        <label class="field compact-field">
          <span>Brand</span>
          <select name="brand_name">${brandOptions}</select>
        </label>
        <label class="field compact-field">
          <span>Provider mode</span>
          <select name="provider_mode">
            <option value="mock" selected>mock</option>
            <option value="openrouter">openrouter</option>
          </select>
        </label>
        <label class="field compact-field">
          <span>Budget</span>
          <input name="max_estimated_cost_usd" type="number" step="0.001" min="0" max="5" value="${escapeHtml(
            settings.max_estimated_cost_usd ?? 0.05
          )}" />
        </label>
        ${renderFullTrackingMatrixPreview(fullPreview)}
        <label class="toggle-row danger-toggle">
          <input name="execute_live" type="checkbox" />
          <span>Execute full live OpenRouter matrix</span>
        </label>
        <div class="control-readonly">Mock is free. OpenRouter runs all active prompts across all active model targets and can spend up to the budget.</div>
        <button class="small-submit" type="submit">${state.controlCenterBusy === 'full' ? 'Running' : 'Run full GEO test'}</button>
      </form>

      <form class="control-card intake-card" id="controlIntakeForm">
        <div class="mini-title">
          <span class="label">Customer Intake</span>
          <strong>New brand workspace</strong>
        </div>
        <div class="split-fields">
          <label class="field compact-field">
            <span>Customer email</span>
            <input name="email" placeholder="client@example.com" />
          </label>
          <label class="field compact-field">
            <span>Plan</span>
            <select name="plan_code">
              <option value="basic">basic</option>
              <option value="pro">pro</option>
              <option value="god">god</option>
            </select>
          </label>
        </div>
        <div class="split-fields">
          <label class="field compact-field">
            <span>Brand</span>
            <input name="brand_name" required placeholder="Acme AI" />
          </label>
          <label class="field compact-field">
            <span>Website</span>
            <input name="website_url" required placeholder="https://example.com" />
          </label>
        </div>
        <div class="split-fields">
          <label class="field compact-field">
            <span>Vertical</span>
            <input name="vertical" list="verticalSuggestions" value="b2b_saas" placeholder="custom vertical" />
            <datalist id="verticalSuggestions">
              <option value="b2b_saas"></option>
              <option value="dtc"></option>
              <option value="healthcare"></option>
              <option value="insurance"></option>
              <option value="fintech"></option>
              <option value="legaltech"></option>
              <option value="edtech"></option>
              <option value="cybersecurity"></option>
              <option value="real_estate"></option>
              <option value="local_services"></option>
            </datalist>
          </label>
          <label class="field compact-field">
            <span>Locale</span>
            <input name="locale" value="en" />
          </label>
        </div>
        <label class="field compact-field">
          <span>Competitors</span>
          <textarea name="competitors" rows="3" placeholder="HockeyStack | https://hockeystack.com | Hockey Stack"></textarea>
        </label>
        <label class="field compact-field">
          <span>Prompts</span>
          <textarea name="prompts" rows="4" placeholder="One question per line, or category | question"></textarea>
        </label>
        <button class="small-submit" type="submit">${state.controlCenterBusy === 'intake' ? 'Creating' : 'Create customer + brand'}</button>
      </form>

      <aside class="control-card ledger-card">
        <div class="mini-title">
          <span class="label">Ledger</span>
          <strong>Recent provider connectivity pilots</strong>
        </div>
        ${recent}
      </aside>

      <aside class="control-card full-test-card">
        <div class="mini-title">
          <span class="label">Full GEO Test / Tracking Run</span>
          <strong>Recent full Tracking Runs</strong>
        </div>
        ${recentFullTests}
      </aside>

      <aside class="control-card brand-directory-card">
        <div class="mini-title">
          <span class="label">Brand Directory</span>
          <strong>Recent created brands</strong>
        </div>
        ${brandDirectory}
      </aside>
    </div>
  `;

  els.controlCenterPanel.querySelector('#controlSettingsForm')?.addEventListener('submit', submitControlSettings);
  els.controlCenterPanel.querySelector('#controlPilotForm')?.addEventListener('submit', submitControlPilot);
  els.controlCenterPanel.querySelector('#controlFullTestForm')?.addEventListener('submit', submitControlFullTest);
  els.controlCenterPanel.querySelector('#controlFullTestForm select[name="brand_name"]')?.addEventListener('change', (event) => {
    state.fullTestBrandName = event.currentTarget.value;
    renderControlCenter();
  });
  els.controlCenterPanel.querySelector('#controlIntakeForm')?.addEventListener('submit', submitControlIntake);
  applyChineseText(els.controlCenterPanel);
}

function parseCompetitorLines(value = '') {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, website_url, aliases = ''] = line.split('|').map((part) => part.trim());
      return {
        name,
        website_url,
        aliases: aliases.split(',').map((alias) => alias.trim()).filter(Boolean)
      };
    })
    .filter((entry) => entry.name);
}

function parsePromptLines(value = '') {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!line.includes('|')) {
        return {
          category: 'custom',
          prompt_text: line
        };
      }
      const [category, ...rest] = line.split('|');
      return {
        category: (category || 'brand-awareness').trim(),
        prompt_text: rest.join('|').trim()
      };
    })
    .filter((entry) => entry.prompt_text);
}

async function submitControlSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.controlCenterBusy = 'settings';
  state.controlCenterNotice = null;
  renderControlCenter();
  try {
    const response = await fetch('/internal/ops/control-center/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        live_provider_testing_enabled: data.get('live_provider_testing_enabled') === 'on',
        default_provider_mode: data.get('default_provider_mode'),
        max_estimated_cost_usd: data.get('max_estimated_cost_usd'),
        default_brand_name: data.get('default_brand_name'),
        default_prompt_index: data.get('default_prompt_index'),
        default_model_index: data.get('default_model_index')
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `Settings returned ${response.status}`);
    state.controlCenter = body.control_center;
    state.controlCenterNotice = { type: 'success', message: t('Runtime testing settings saved.') };
  } catch (error) {
    state.controlCenterNotice = { type: 'error', message: error.message };
  } finally {
    state.controlCenterBusy = null;
    renderControlCenter();
  }
}

async function submitControlPilot(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.controlCenterBusy = 'pilot';
  state.controlCenterNotice = null;
  renderControlCenter();
  try {
    const executeLive = data.get('execute_live') === 'on';
    const response = await fetch('/internal/ops/control-center/paid-provider-pilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider_mode: executeLive ? 'openrouter' : 'mock',
        brand_name: data.get('brand_name'),
        prompt_index: data.get('prompt_index'),
        model_index: data.get('model_index'),
        max_estimated_cost_usd: data.get('max_estimated_cost_usd'),
        fixture_name: data.get('fixture_name'),
        execute_live: executeLive
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `Pilot returned ${response.status}`);
    state.controlCenter = body.control_center || (await fetchControlCenter());
    const result = body.paid_provider_pilot || {};
    state.controlCenterNotice = {
      type: result.status === 'completed' ? 'success' : 'error',
      message: isZh()
        ? `测试 ${result.status || 'returned'} · 是否调用 ${result.provider_call_executed ? '是' : '否'} · 阻止原因 ${result.blocker || '无'}`
        : `Pilot ${result.status || 'returned'} · call executed ${result.provider_call_executed ? 'yes' : 'no'} · blocker ${result.blocker || 'none'}`
    };
    await refreshDashboard({ preserveSelection: true });
  } catch (error) {
    state.controlCenterNotice = { type: 'error', message: error.message };
    renderControlCenter();
  } finally {
    state.controlCenterBusy = null;
    renderControlCenter();
  }
}

async function submitControlFullTest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.controlCenterBusy = 'full';
  state.controlCenterNotice = null;
  renderControlCenter();
  try {
    const providerMode = data.get('provider_mode') || 'mock';
    const executeLive = data.get('execute_live') === 'on';
    state.fullTestBrandName = data.get('brand_name');
    const response = await fetch('/internal/ops/control-center/full-tracking-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brand_name: data.get('brand_name'),
        provider_mode: providerMode,
        execute_live: executeLive,
        max_estimated_cost_usd: data.get('max_estimated_cost_usd')
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `Full test returned ${response.status}`);
    state.controlCenter = body.control_center || (await fetchControlCenter());
    const result = body.full_tracking_test || {};
    const scoring = result.scoring || {};
    const isMockResult = (result.provider_mode || 'mock') === 'mock' || result.paid_provider_call_executed !== true;
    state.controlCenterNotice = {
      type: 'success',
      message: isZh()
        ? `${isMockResult ? '模拟链路验证完成' : '真实 OpenRouter 矩阵完成'} · ${result.provider_mode || 'mock'} · run ${
            result.tracking_run_id || 'n/a'
          } · prompts ${result.tracking?.prompt_count || 0} · models ${
            result.tracking?.model_count || 0
          } · cost ${money(result.budget?.estimated_cost_usd || 0)} · ${isMockResult ? 'mock visibility' : 'visibility'} ${
            scoring.visibility_score ?? 'n/a'
          }`
        : `${isMockResult ? 'Mock pipeline validation completed' : 'Live OpenRouter matrix completed'} · ${result.provider_mode || 'mock'} · run ${
            result.tracking_run_id || 'n/a'
          } · prompts ${result.tracking?.prompt_count || 0} · models ${
            result.tracking?.model_count || 0
          } · cost ${money(result.budget?.estimated_cost_usd || 0)} · ${isMockResult ? 'mock visibility' : 'visibility'} ${
            scoring.visibility_score ?? 'n/a'
          }`
    };
    await refreshDashboard({ preserveSelection: true });
  } catch (error) {
    state.controlCenterNotice = { type: 'error', message: error.message };
    renderControlCenter();
  } finally {
    state.controlCenterBusy = null;
    renderControlCenter();
  }
}

async function submitControlIntake(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.controlCenterBusy = 'intake';
  state.controlCenterNotice = null;
  renderControlCenter();
  try {
    const response = await fetch('/internal/ops/control-center/customers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customer: {
          email: data.get('email'),
          plan_code: data.get('plan_code')
        },
        brand: {
          name: data.get('brand_name'),
          website_url: data.get('website_url'),
          vertical: data.get('vertical'),
          locale: data.get('locale')
        },
        competitors: parseCompetitorLines(data.get('competitors') || ''),
        prompts: parsePromptLines(data.get('prompts') || '')
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || `Intake returned ${response.status}`);
    state.controlCenter = body.control_center;
    state.controlCenterNotice = {
      type: 'success',
      message: isZh()
        ? `已创建 ${body.intake?.brand?.name || 'brand'} · 行业 ${body.intake?.brand?.vertical || 'n/a'} · prompts ${body.intake?.counts?.prompts || 0} · 竞品 ${body.intake?.counts?.competitors || 0} · 客户页 ${body.intake?.dashboard_urls?.articles || ''}`
        : `Created ${body.intake?.brand?.name || 'brand'} · vertical ${body.intake?.brand?.vertical || 'n/a'} · prompts ${body.intake?.counts?.prompts || 0} · competitors ${body.intake?.counts?.competitors || 0} · customer dashboard ${body.intake?.dashboard_urls?.articles || ''}`
    };
    form.reset();
  } catch (error) {
    state.controlCenterNotice = { type: 'error', message: error.message };
  } finally {
    state.controlCenterBusy = null;
    renderControlCenter();
  }
}

function renderPromptDiscoveryQueue() {
  const queue = state.promptDiscoveryQueue;
  if (!els.promptDiscoveryQueue) return;
  if (!queue) {
    els.promptDiscoveryQueue.innerHTML = `
      <div class="section-title">
        <span class="label">Prompt Discovery</span>
        <strong>Candidate queue</strong>
      </div>
      <div class="prompt-discovery-loading">Loading prompt discovery queue</div>
    `;
    applyChineseText(els.promptDiscoveryQueue);
    return;
  }

  const summary = queue.summary || {};
  const items = queue.items || [];
  const runs = queue.runs || [];
  const brands = state.controlCenter?.brands || [];
  const selectedBrand = state.promptDiscoveryBrandName || brands[0]?.name || 'lintmitless';
  const brandOptions = brands.length
    ? brands
        .map(
          (brand) =>
            `<option value="${escapeHtml(brand.name)}" ${brand.name === selectedBrand ? 'selected' : ''}>${escapeHtml(
              brand.name
            )} · ${escapeHtml(brand.plan_code || 'plan')}</option>`
        )
        .join('')
    : `<option value="${escapeHtml(selectedBrand)}">${escapeHtml(selectedBrand)}</option>`;
  const metric = (label, value) => `
    <div class="prompt-discovery-metric">
      <span class="label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? 0)}</strong>
    </div>
  `;
  const itemRows = items.length
    ? items
        .slice(0, 8)
        .map((item) => {
          const candidate = item.candidate || {};
          const blockers = item.operator_blockers?.length ? item.operator_blockers.join(', ') : 'No blocker';
          const score = item.score_components?.priority_score ?? 'n/a';
          const source = candidate.source_confidence == null ? candidate.source_label : `${candidate.source_label} · ${candidate.source_confidence}`;
          const actions = Array.isArray(item.available_actions) ? item.available_actions : [];
          const actionButtons = actions.length
            ? actions
                .map(
                  (entry) =>
                    `<button type="button" data-prompt-discovery-action="${escapeHtml(entry.type)}" data-candidate-id="${escapeHtml(candidate.id)}">${escapeHtml(
                      state.promptDiscoveryBusy === `${candidate.id}:${entry.type}` ? 'Working' : entry.label
                    )}</button>`
                )
                .join('')
            : '<span class="prompt-discovery-readonly">No operator action available</span>';
          return `
            <article class="prompt-discovery-item">
              <div>
                <span class="badge ${priorityClass(item.priority)}">${escapeHtml(item.priority)} priority</span>
                <strong>${escapeHtml(candidate.candidate_text || 'Prompt candidate')}</strong>
                <small>${escapeHtml(item.brand?.name || 'Unknown brand')} · ${escapeHtml(candidate.status || 'unknown')} · score ${escapeHtml(score)}</small>
              </div>
              <p>${escapeHtml(item.next_operator_action || 'Review candidate context.')}</p>
              <dl>
                <div><dt>Source</dt><dd>${escapeHtml(source || 'n/a')}</dd></div>
                <div><dt>Gap</dt><dd>${escapeHtml(candidate.gap_type || 'n/a')}</dd></div>
                <div><dt>Blockers</dt><dd>${escapeHtml(blockers)}</dd></div>
                <div><dt>Events</dt><dd>${escapeHtml(item.selection_events?.length || 0)}</dd></div>
              </dl>
              <label class="prompt-discovery-note">
                <span>Ops reason / note</span>
                <textarea rows="2" data-prompt-discovery-note="${escapeHtml(candidate.id)}" placeholder="Reason required for block or quota override."></textarea>
              </label>
              <label class="prompt-discovery-note">
                <span>Edit or replacement text</span>
                <textarea rows="2" data-prompt-discovery-text="${escapeHtml(candidate.id)}">${escapeHtml(candidate.candidate_text || '')}</textarea>
              </label>
              <div class="prompt-discovery-actions">${actionButtons}</div>
              <div class="prompt-discovery-readonly">PD8 controlled actions · no tracking, paid provider, deployment, CMS, webhook, email, or GeoFlow dispatch</div>
            </article>
          `;
        })
        .join('')
    : emptyState('No Prompt Discovery queue items.', 'No duplicate, low confidence, over-limit, or competitor-gap candidates need Product Ops review.');

  const runRows = runs.length
    ? runs
        .slice(0, 4)
        .map(
          (run) => `
            <div class="prompt-discovery-run">
              <strong>${escapeHtml(run.brand?.name || 'Unknown brand')}</strong>
              <span>${escapeHtml(run.readiness?.status || 'unknown')} · ${escapeHtml(run.counts?.candidates || 0)} candidates · ${escapeHtml(run.counts?.confirmed || 0)} confirmed</span>
            </div>
          `
        )
        .join('')
    : '<div class="prompt-discovery-run">No discovery runs yet</div>';

  els.promptDiscoveryQueue.innerHTML = `
    <div class="section-title">
      <span class="label">Prompt Discovery</span>
      <strong>Candidate queue</strong>
    </div>
    ${state.promptDiscoveryNotice ? `<div class="notice ${state.promptDiscoveryNotice.type}">${escapeHtml(state.promptDiscoveryNotice.message)}</div>` : ''}
    <form class="prompt-discovery-generate" id="promptDiscoveryGenerateForm">
      <label class="field compact-field">
        <span>Brand</span>
        <select name="brand_name">${brandOptions}</select>
      </label>
      <label class="field compact-field">
        <span>Candidates</span>
        <input name="candidate_count" type="number" min="5" max="40" value="20" />
      </label>
      <button class="small-submit" type="submit" ${state.promptDiscoveryBusy === 'generate:minimax' ? 'disabled' : ''}>
        ${escapeHtml(state.promptDiscoveryBusy === 'generate:minimax' ? 'Generating' : 'Generate with MiniMax')}
      </button>
      <small>MiniMax is a pre-OpenRouter discovery gate. It creates review candidates only; it does not run tracking or paid OpenRouter matrix calls.</small>
    </form>
    <div class="prompt-discovery-status">
      <span>${escapeHtml(queue.mode)}</span>
      <strong>${escapeHtml(queue.status)}</strong>
      <small>${escapeHtml(humanDate(queue.generated_at))}</small>
    </div>
    <div class="prompt-discovery-metrics">
      ${metric('Runs', summary.discovery_runs)}
      ${metric('Queue items', summary.queue_items)}
      ${metric('Blocked brands', summary.blocked_brands)}
      ${metric('Duplicate risk', summary.duplicate_risk_candidates)}
      ${metric('Low confidence', summary.low_confidence_candidates)}
      ${metric('Competitor gaps', summary.competitor_gap_candidates)}
    </div>
    <div class="prompt-discovery-layout">
      <div class="prompt-discovery-items">${itemRows}</div>
      <aside class="prompt-discovery-runs">
        <span class="label">Recent runs</span>
        ${runRows}
      </aside>
    </div>
  `;
  els.promptDiscoveryQueue.querySelectorAll('[data-prompt-discovery-action]').forEach((button) => {
    button.addEventListener('click', () => submitPromptDiscoveryAction(button));
  });
  els.promptDiscoveryQueue.querySelector('#promptDiscoveryGenerateForm')?.addEventListener('submit', submitPromptDiscoveryGenerate);
  applyChineseText(els.promptDiscoveryQueue);
}

async function submitPromptDiscoveryGenerate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const brandName = data.get('brand_name') || '';
  state.promptDiscoveryBrandName = brandName;
  state.promptDiscoveryBusy = 'generate:minimax';
  state.promptDiscoveryNotice = null;
  renderPromptDiscoveryQueue();
  try {
    const response = await fetch('/internal/ops/prompt-discovery/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand_name: brandName,
        candidate_count: Number(data.get('candidate_count') || 20)
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      throw new Error(body.error || body.message || `Prompt discovery generation returned ${response.status}`);
    }
    const count = body.prompt_discovery?.candidates?.length || 0;
    state.promptDiscoveryNotice = { type: 'success', message: `MiniMax generated ${count} prompt candidates for review.` };
    state.promptDiscoveryQueue = await fetchPromptDiscoveryQueue();
  } catch (error) {
    state.promptDiscoveryNotice = { type: 'error', message: error.message };
  } finally {
    state.promptDiscoveryBusy = null;
    renderPromptDiscoveryQueue();
  }
}

async function submitPromptDiscoveryAction(button) {
  const candidateId = button.getAttribute('data-candidate-id');
  const action = button.getAttribute('data-prompt-discovery-action');
  const note = els.promptDiscoveryQueue.querySelector(`[data-prompt-discovery-note="${CSS.escape(candidateId)}"]`)?.value.trim() || '';
  const text = els.promptDiscoveryQueue.querySelector(`[data-prompt-discovery-text="${CSS.escape(candidateId)}"]`)?.value.trim() || '';
  if ((action === 'block_confirmation' || action === 'override_quota') && !note) {
    state.promptDiscoveryNotice = { type: 'error', message: 'Reason is required for block or quota override.' };
    renderPromptDiscoveryQueue();
    return;
  }
  const payload = {
    action,
    actor: 'ops_dashboard_ui',
    reason: note || undefined,
    note: note || undefined,
    idempotency_key: `ops-dashboard-ui:${candidateId}:${action}:${Date.now()}`
  };
  if (action === 'edit') payload.edited_text = text;
  if (action === 'replace') payload.replacement_text = text;
  if (action === 'confirm' && note.toLowerCase().includes('override quota')) {
    payload.override_quota = true;
  }
  state.promptDiscoveryBusy = `${candidateId}:${action}`;
  state.promptDiscoveryNotice = null;
  renderPromptDiscoveryQueue();
  try {
    const response = await fetch(`/internal/ops/prompt-discovery/candidates/${encodeURIComponent(candidateId)}/action`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || body.error || `Prompt Discovery action returned ${response.status}`);
    }
    state.promptDiscoveryNotice = {
      type: 'success',
      message: `${body.result?.action || action} accepted for Prompt Discovery candidate.`
    };
    state.promptDiscoveryQueue = await fetchPromptDiscoveryQueue();
  } catch (error) {
    state.promptDiscoveryNotice = { type: 'error', message: error.message };
  } finally {
    state.promptDiscoveryBusy = null;
    renderPromptDiscoveryQueue();
  }
}

function renderActivity() {
  const events = state.auditLog?.events || [];
  renderAuditSavedViews();
  renderAuditRetention();
  renderAuditReportArchives();
  renderAuditVerificationReceipt();
  renderAuditVerificationHistory();
  renderAuditEvidenceChain();
  renderAuditEvidenceCases();
  renderAuditEvidenceNotifications();
  renderAuditNotificationPolicy();
  renderAuditNotificationReplayWorkload();
  renderAuditReplayThresholds();
  renderAuditReplaySlaAlerts();
  renderAuditReplaySlaAlertSchedule();
  renderAuditReplaySlaAlertDigests();
  renderAuditReplaySlaAlertDigestSchedule();
  renderAuditReplaySlaAlertDigestRetentionReceipts();
  renderAuditNotificationRules();
  renderAuditNotificationDeliveries();
  renderAuditFilterStatus();
  if (!events.length) {
    els.activityList.innerHTML = emptyState('No audit activity found.', 'Adjust filters or wait for workflow transitions.');
    return;
  }
  els.activityList.innerHTML = events.map(activityRow).join('');
}

function filtersEqual(a, b) {
  return ['category', 'action', 'actor', 'target', 'q'].every((key) => (a?.[key] || '') === (b?.[key] || ''));
}

function renderAuditSavedViews() {
  const selected = state.auditSavedViews.find((view) => filtersEqual(view.filters, state.auditFilters));
  els.auditSavedViewSelect.innerHTML = [
    '<option value="">No saved view</option>',
    ...state.auditSavedViews.map(
      (view) =>
        `<option value="${escapeHtml(view.id)}"${selected?.id === view.id ? ' selected' : ''}>${escapeHtml(view.name)}</option>`
    )
  ].join('');
  if (selected) {
    els.auditSavedViewName.value = selected.name;
  }
}

function renderAuditRetention() {
  if (!state.auditRetention) {
    els.auditRetentionStatus.textContent = 'Retention policy loading';
    return;
  }
  els.auditRetentionStatus.textContent =
    `Retention ${state.auditRetention.retention_days} days` +
    ` · cutoff ${humanDate(state.auditRetention.cutoff_at)}` +
    ' · admin rows prunable by explicit retention run';
}

function renderAuditReportArchives() {
  const latest = state.auditReportArchives[0];
  if (!latest) {
    els.auditArchiveStatus.textContent = 'No archived compliance reports yet';
    return;
  }
  els.auditArchiveStatus.textContent =
    `Latest archive ${latest.report_id}` +
    ` · ${latest.event_count} events` +
    ` · ${humanDate(latest.created_at)}` +
    ` · signature ${String(latest.evidence_signature || '').slice(0, 12)}`;
}

function renderAuditVerificationReceipt() {
  const receipt = state.auditVerificationReceipt;
  if (!receipt) {
    els.auditVerifyStatus.textContent = 'Verification idle';
    return;
  }
  const checks = receipt.checks || {};
  const suppliedOk = checks.supplied_signature_matches !== false;
  const ok =
    checks.archive_found &&
    checks.html_hash_matches &&
    checks.evidence_signature_matches &&
    checks.report_hash_matches &&
    checks.event_digest_matches &&
    suppliedOk;
  els.auditVerifyStatus.textContent =
    `${ok ? 'Verified' : 'Verification failed'}` +
    ` · ${receipt.archive.report_id}` +
    ` · receipt ${String(receipt.receipt_hash || '').slice(0, 12)}` +
    ` · html ${checks.html_hash_matches ? 'match' : 'mismatch'}` +
    ` · signature ${checks.evidence_signature_matches ? 'match' : 'mismatch'}` +
    (checks.supplied_signature_matches === false ? ' · supplied mismatch' : '') +
    (receipt.drill?.mode ? ` · drill ${receipt.drill.mode}` : '');
}

function renderAuditVerificationHistory() {
  const latest = state.auditReportVerifications[0];
  if (!latest) {
    els.auditVerificationHistory.textContent = 'No verification receipts yet';
    return;
  }
  const checks = latest.checks || {};
  els.auditVerificationHistory.textContent =
    `Latest verification ${latest.receipt_hash.slice(0, 12)}` +
    ` · ${latest.verifier}` +
    ` · ${humanDate(latest.created_at)}` +
    ` · html ${checks.html_hash_matches ? 'match' : 'mismatch'}` +
    ` · signature ${checks.evidence_signature_matches ? 'match' : 'mismatch'}` +
    (checks.supplied_signature_matches === false ? ' · supplied mismatch' : '');
}

function renderAuditEvidenceChain() {
  const chain = state.auditEvidenceChain;
  if (!chain) {
    els.auditEvidenceChain.textContent = 'Evidence chain loading';
    return;
  }
  const items = chain.items || [];
  const summary = chain.summary || {};
  if (!items.length) {
    els.auditEvidenceChain.innerHTML = emptyState('No evidence chain items found.', 'Adjust search terms or failed-check filter.');
    return;
  }
  const rows = items
    .map((item) => {
      const archive = item.archive || {};
      const verification = item.verification || {};
      const retentionReceipt = item.retention_receipt || {};
      const anomalyRetentionReceipt = item.anomaly_digest_retention_receipt || {};
      const bundleVerification = item.bundle_verification || {};
      const bundleExport = item.bundle_export || {};
      const bundleExportReview = item.bundle_export_review || {};
      const bundleDeliveryGate = item.bundle_delivery_gate || {};
      const bundleHandoffPreview = item.bundle_handoff_preview || {};
      const bundleFinalApproval = item.bundle_final_approval || {};
      const bundleFinalApprovalReview = item.bundle_final_approval_review || {};
      const bundleFinalApprovalPolicyGate = item.bundle_final_approval_policy_gate || {};
      const bundleFinalDeliveryDryRunLock = item.bundle_final_delivery_dry_run_lock || {};
      const bundleFinalDeliveryRehearsal = item.bundle_final_delivery_rehearsal || {};
      const bundleFinalDeliveryDualControlApproval = item.bundle_final_delivery_dual_control_approval || {};
      const bundleFinalDeliveryReadinessSeal = item.bundle_final_delivery_readiness_seal || {};
      const bundleFinalDeliverySealedHandoffReview = item.bundle_final_delivery_sealed_handoff_review || {};
      const bundleFinalDeliveryCommandEscrow = item.bundle_final_delivery_command_escrow || {};
      const bundleFinalDeliveryCommandRevocation = item.bundle_final_delivery_command_revocation || {};
      const bundleFinalDeliveryCommandClosure = item.bundle_final_delivery_command_closure || {};
      const bundleFinalDeliveryCommandTrailNotarization = item.bundle_final_delivery_command_trail_notarization || {};
      const bundleFinalDeliveryCommandTrailCustody = item.bundle_final_delivery_command_trail_custody || {};
      const bundleFinalDeliveryCommandTrailRetentionAttestation = item.bundle_final_delivery_command_trail_retention_attestation || {};
      const bundleFinalDeliveryCommandTrailRenewalWindow = item.bundle_final_delivery_command_trail_renewal_window || {};
      const bundleFinalDeliveryCommandTrailRenewalConfirmation = item.bundle_final_delivery_command_trail_renewal_confirmation || {};
      const bundleFinalDeliveryCommandTrailCheckpointSeal = item.bundle_final_delivery_command_trail_checkpoint_seal || {};
      const bundleFinalDeliveryCommandTrailCustodyHandoff = item.bundle_final_delivery_command_trail_custody_handoff || {};
      const bundleFinalDeliveryCommandTrailArchiveEscrow = item.bundle_final_delivery_command_trail_archive_escrow || {};
      const bundleFinalDeliveryCommandTrailEvidenceSeal = item.bundle_final_delivery_command_trail_evidence_seal || {};
      const bundleFinalDeliveryCommandTrailCustodyCheckpoint = item.bundle_final_delivery_command_trail_custody_checkpoint || {};
      const failed = item.failed_checks?.length ? ` · failed ${item.failed_checks.join(', ')}` : '';
      const drill = verification.drill?.mode ? ` · drill ${verification.drill.mode}` : '';
      let headline = archive.report_id;
      let detail = `${String(archive.report_hash || '').slice(0, 12)} · ${archive.event_count || 0} events`;
      if (item.type === 'verification') {
        headline = `${String(verification.receipt_hash || '').slice(0, 12)} · ${verification.verifier}`;
        detail = `${archive.report_id} · ${String(verification.identifier || '').slice(0, 12)}${failed}${drill}`;
      }
      if (item.type === 'digest_retention_receipt') {
        headline = `${String(retentionReceipt.receipt_hash || '').slice(0, 12)} · ${retentionReceipt.requested_by}`;
        detail =
          `${retentionReceipt.mode || 'retention'} · retained ${retentionReceipt.retained_count || 0}` +
          ` · eligible ${retentionReceipt.eligible_count || 0}` +
          ` · deleted ${retentionReceipt.deleted_count || 0}`;
      }
      if (item.type === 'anomaly_digest_retention_receipt') {
        headline = `${String(anomalyRetentionReceipt.receipt_hash || '').slice(0, 12)} · ${anomalyRetentionReceipt.requested_by}`;
        detail =
          `anomaly ${anomalyRetentionReceipt.mode || 'retention'} · retained ${anomalyRetentionReceipt.retained_count || 0}` +
          ` · eligible ${anomalyRetentionReceipt.eligible_count || 0}` +
          ` · deleted ${anomalyRetentionReceipt.deleted_count || 0}`;
      }
      if (item.type === 'bundle_verification_receipt') {
        headline = `${String(bundleVerification.receipt_hash || '').slice(0, 12)} · ${bundleVerification.verifier}`;
        detail =
          `bundle ${bundleVerification.valid ? 'valid' : 'failed'}` +
          ` · manifest ${String(bundleVerification.bundle_manifest_hash || '').slice(0, 12)}` +
          ` · packet ${String(bundleVerification.bundle_packet_hash || '').slice(0, 12)}${failed}`;
      }
      if (item.type === 'bundle_export_receipt') {
        headline = `${String(bundleExport.receipt_hash || '').slice(0, 12)} · ${bundleExport.requester}`;
        detail =
          `bundle export · manifest ${String(bundleExport.bundle_manifest_hash || '').slice(0, 12)}` +
          ` · packet ${String(bundleExport.bundle_packet_hash || '').slice(0, 12)}` +
          ` · entries ${bundleExport.manifest_entry_count || 0}`;
      }
      if (item.type === 'bundle_export_review_receipt') {
        headline = `${String(bundleExportReview.receipt_hash || '').slice(0, 12)} · ${bundleExportReview.reviewer}`;
        detail =
          `export review ${bundleExportReview.purpose || 'internal'}/${bundleExportReview.decision || 'reviewed'}` +
          ` · action ${bundleExportReview.action || 'attested'}` +
          ` · export ${String(bundleExportReview.bundle_export_receipt_hash || '').slice(0, 12)}` +
          ` · manifest ${String(bundleExportReview.bundle_manifest_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_delivery_gate_receipt') {
        headline = `${String(bundleDeliveryGate.receipt_hash || '').slice(0, 12)} · ${bundleDeliveryGate.recorder}`;
        detail =
          `delivery gate ${bundleDeliveryGate.decision || 'deny'}` +
          ` · ${bundleDeliveryGate.reason || 'delivery_readiness_missing'}` +
          ` · readiness ${bundleDeliveryGate.readiness_status || 'unknown'}` +
          ` · packet ${String(bundleDeliveryGate.packet_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_handoff_preview_receipt') {
        headline = `${String(bundleHandoffPreview.receipt_hash || '').slice(0, 12)} · ${bundleHandoffPreview.recorder}`;
        detail =
          `handoff preview ${bundleHandoffPreview.status || 'blocked'}` +
          ` · ${bundleHandoffPreview.reason || 'handoff_preview_missing'}` +
          ` · ${bundleHandoffPreview.can_handoff ? 'ready' : 'blocked'}` +
          ` · preview ${String(bundleHandoffPreview.preview_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_approval_receipt') {
        headline = `${String(bundleFinalApproval.receipt_hash || '').slice(0, 12)} · ${bundleFinalApproval.recorder}`;
        detail =
          `final approval ${bundleFinalApproval.decision || 'deny'}` +
          ` · ${bundleFinalApproval.reason || 'final_approval_missing'}` +
          ` · ${bundleFinalApproval.can_approve ? 'ready' : 'blocked'}` +
          ` · preview ${String(bundleFinalApproval.approval_preview_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_approval_review_receipt') {
        headline = `${String(bundleFinalApprovalReview.receipt_hash || '').slice(0, 12)} · ${bundleFinalApprovalReview.reviewer}`;
        detail =
          `final lifecycle ${bundleFinalApprovalReview.lifecycle_status || 'confirmed'}` +
          ` · action ${bundleFinalApprovalReview.action || 'confirmed'}` +
          ` · final ${String(bundleFinalApprovalReview.final_approval_receipt_hash || '').slice(0, 12)}` +
          ` · decision ${bundleFinalApprovalReview.decision || 'approve'}`;
      }
      if (item.type === 'bundle_final_approval_policy_gate_receipt') {
        headline = `${String(bundleFinalApprovalPolicyGate.receipt_hash || '').slice(0, 12)} · ${bundleFinalApprovalPolicyGate.recorder}`;
        detail =
          `policy gate ${bundleFinalApprovalPolicyGate.decision || 'deny'}` +
          ` · ${bundleFinalApprovalPolicyGate.policy_status || 'needs_lifecycle_review'}` +
          ` · ${bundleFinalApprovalPolicyGate.reason || 'missing_final_approval_lifecycle_review'}` +
          ` · final ${String(bundleFinalApprovalPolicyGate.final_approval_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_dry_run_lock_receipt') {
        headline = `${String(bundleFinalDeliveryDryRunLock.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryDryRunLock.recorder}`;
        detail =
          `dry-run lock ${bundleFinalDeliveryDryRunLock.decision || 'block'}` +
          ` · ${bundleFinalDeliveryDryRunLock.lock_status || 'missing_policy_gate'}` +
          ` · ${bundleFinalDeliveryDryRunLock.reason || 'missing_final_approval_policy_gate_receipt'}` +
          ` · policy ${String(bundleFinalDeliveryDryRunLock.policy_gate_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_rehearsal_receipt') {
        headline = `${String(bundleFinalDeliveryRehearsal.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryRehearsal.recorder}`;
        detail =
          `rehearsal ${bundleFinalDeliveryRehearsal.decision || 'block'}` +
          ` · ${bundleFinalDeliveryRehearsal.rehearsal_status || 'missing_dry_run_lock'}` +
          ` · ${bundleFinalDeliveryRehearsal.reason || 'missing_final_delivery_dry_run_lock_receipt'}` +
          ` · lock ${String(bundleFinalDeliveryRehearsal.dry_run_lock_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_dual_control_approval_receipt') {
        headline = `${String(bundleFinalDeliveryDualControlApproval.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryDualControlApproval.recorder}`;
        detail =
          `dual approval ${bundleFinalDeliveryDualControlApproval.decision || 'block'}` +
          ` · ${bundleFinalDeliveryDualControlApproval.approval_status || 'missing_rehearsal'}` +
          ` · ${bundleFinalDeliveryDualControlApproval.reason || 'missing_final_delivery_rehearsal_receipt'}` +
          ` · rehearsal ${String(bundleFinalDeliveryDualControlApproval.rehearsal_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_readiness_seal_receipt') {
        headline = `${String(bundleFinalDeliveryReadinessSeal.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryReadinessSeal.recorder}`;
        detail =
          `readiness seal ${bundleFinalDeliveryReadinessSeal.decision || 'block'}` +
          ` · ${bundleFinalDeliveryReadinessSeal.seal_status || 'missing_dual_control_approval'}` +
          ` · ${bundleFinalDeliveryReadinessSeal.reason || 'missing_final_delivery_dual_control_approval_receipt'}` +
          ` · dual ${String(bundleFinalDeliveryReadinessSeal.dual_control_approval_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_sealed_handoff_review_receipt') {
        headline = `${String(bundleFinalDeliverySealedHandoffReview.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliverySealedHandoffReview.recorder}`;
        detail =
          `handoff review ${bundleFinalDeliverySealedHandoffReview.decision || 'block'}` +
          ` · ${bundleFinalDeliverySealedHandoffReview.review_status || 'missing_readiness_seal'}` +
          ` · ${bundleFinalDeliverySealedHandoffReview.reason || 'missing_final_delivery_readiness_seal_receipt'}` +
          ` · seal ${String(bundleFinalDeliverySealedHandoffReview.readiness_seal_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_escrow_receipt') {
        headline = `${String(bundleFinalDeliveryCommandEscrow.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandEscrow.recorder}`;
        detail =
          `command escrow ${bundleFinalDeliveryCommandEscrow.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandEscrow.escrow_status || 'missing_release_commander_signoff'}` +
          ` · ${bundleFinalDeliveryCommandEscrow.reason || 'missing_final_delivery_sealed_handoff_review_receipt'}` +
          ` · signoff ${String(bundleFinalDeliveryCommandEscrow.sealed_handoff_review_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_revocation_receipt') {
        headline = `${String(bundleFinalDeliveryCommandRevocation.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandRevocation.recorder}`;
        detail =
          `command revocation ${bundleFinalDeliveryCommandRevocation.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandRevocation.revocation_status || 'missing_command_escrow'}` +
          ` · ${bundleFinalDeliveryCommandRevocation.reason || 'missing_final_delivery_command_escrow_receipt'}` +
          ` · escrow ${String(bundleFinalDeliveryCommandRevocation.command_escrow_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_closure_receipt') {
        headline = `${String(bundleFinalDeliveryCommandClosure.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandClosure.recorder}`;
        detail =
          `command closure ${bundleFinalDeliveryCommandClosure.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandClosure.closure_status || 'missing_command_revocation'}` +
          ` · ${bundleFinalDeliveryCommandClosure.reason || 'missing_final_delivery_command_revocation_receipt'}` +
          ` · revocation ${String(bundleFinalDeliveryCommandClosure.command_revocation_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_notarization_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailNotarization.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailNotarization.recorder}`;
        detail =
          `trail notarization ${bundleFinalDeliveryCommandTrailNotarization.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailNotarization.notarization_status || 'missing_command_closure'}` +
          ` · ${bundleFinalDeliveryCommandTrailNotarization.reason || 'missing_final_delivery_command_closure_receipt'}` +
          ` · closure ${String(bundleFinalDeliveryCommandTrailNotarization.command_closure_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_custody_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailCustody.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailCustody.recorder}`;
        detail =
          `trail custody ${bundleFinalDeliveryCommandTrailCustody.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailCustody.custody_status || 'missing_trail_notarization'}` +
          ` · ${bundleFinalDeliveryCommandTrailCustody.reason || 'missing_final_delivery_command_trail_notarization_receipt'}` +
          ` · trail ${String(bundleFinalDeliveryCommandTrailCustody.trail_notarization_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_retention_attestation_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailRetentionAttestation.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailRetentionAttestation.recorder}`;
        detail =
          `retention attestation ${bundleFinalDeliveryCommandTrailRetentionAttestation.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailRetentionAttestation.attestation_status || 'missing_trail_custody'}` +
          ` · ${bundleFinalDeliveryCommandTrailRetentionAttestation.reason || 'missing_final_delivery_command_trail_custody_receipt'}` +
          ` · custody ${String(bundleFinalDeliveryCommandTrailRetentionAttestation.trail_custody_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_renewal_window_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailRenewalWindow.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailRenewalWindow.recorder}`;
        detail =
          `renewal window ${bundleFinalDeliveryCommandTrailRenewalWindow.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailRenewalWindow.renewal_status || 'missing_retention_attestation'}` +
          ` · ${bundleFinalDeliveryCommandTrailRenewalWindow.reason || 'missing_final_delivery_command_trail_retention_attestation_receipt'}` +
          ` · retention ${String(bundleFinalDeliveryCommandTrailRenewalWindow.retention_attestation_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_renewal_confirmation_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailRenewalConfirmation.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailRenewalConfirmation.recorder}`;
        detail =
          `renewal checkpoint ${bundleFinalDeliveryCommandTrailRenewalConfirmation.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailRenewalConfirmation.confirmation_status || 'missing_renewal_window'}` +
          ` · ${bundleFinalDeliveryCommandTrailRenewalConfirmation.reason || 'missing_final_delivery_command_trail_renewal_window_receipt'}` +
          ` · renewal ${String(bundleFinalDeliveryCommandTrailRenewalConfirmation.renewal_window_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_checkpoint_seal_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailCheckpointSeal.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailCheckpointSeal.recorder}`;
        detail =
          `checkpoint seal ${bundleFinalDeliveryCommandTrailCheckpointSeal.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailCheckpointSeal.seal_status || 'missing_renewal_confirmation'}` +
          ` · ${bundleFinalDeliveryCommandTrailCheckpointSeal.reason || 'missing_final_delivery_command_trail_renewal_confirmation_receipt'}` +
          ` · confirmation ${String(bundleFinalDeliveryCommandTrailCheckpointSeal.renewal_confirmation_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_custody_handoff_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailCustodyHandoff.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailCustodyHandoff.recorder}`;
        detail =
          `custody handoff ${bundleFinalDeliveryCommandTrailCustodyHandoff.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailCustodyHandoff.handoff_status || 'missing_checkpoint_seal'}` +
          ` · ${bundleFinalDeliveryCommandTrailCustodyHandoff.reason || 'missing_final_delivery_command_trail_checkpoint_seal_receipt'}` +
          ` · seal ${String(bundleFinalDeliveryCommandTrailCustodyHandoff.checkpoint_seal_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_archive_escrow_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailArchiveEscrow.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailArchiveEscrow.recorder}`;
        detail =
          `archive escrow ${bundleFinalDeliveryCommandTrailArchiveEscrow.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailArchiveEscrow.escrow_status || 'missing_custody_handoff'}` +
          ` · ${bundleFinalDeliveryCommandTrailArchiveEscrow.reason || 'missing_final_delivery_command_trail_custody_handoff_receipt'}` +
          ` · handoff ${String(bundleFinalDeliveryCommandTrailArchiveEscrow.custody_handoff_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_evidence_seal_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailEvidenceSeal.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailEvidenceSeal.recorder}`;
        detail =
          `evidence seal ${bundleFinalDeliveryCommandTrailEvidenceSeal.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailEvidenceSeal.seal_status || 'missing_archive_escrow'}` +
          ` · ${bundleFinalDeliveryCommandTrailEvidenceSeal.reason || 'missing_final_delivery_command_trail_archive_escrow_receipt'}` +
          ` · escrow ${String(bundleFinalDeliveryCommandTrailEvidenceSeal.archive_escrow_receipt_hash || '').slice(0, 12)}`;
      }
      if (item.type === 'bundle_final_delivery_command_trail_custody_checkpoint_receipt') {
        headline = `${String(bundleFinalDeliveryCommandTrailCustodyCheckpoint.receipt_hash || '').slice(0, 12)} · ${bundleFinalDeliveryCommandTrailCustodyCheckpoint.recorder}`;
        detail =
          `custody checkpoint ${bundleFinalDeliveryCommandTrailCustodyCheckpoint.decision || 'block'}` +
          ` · ${bundleFinalDeliveryCommandTrailCustodyCheckpoint.checkpoint_status || 'missing_evidence_seal'}` +
          ` · ${bundleFinalDeliveryCommandTrailCustodyCheckpoint.reason || 'missing_final_delivery_command_trail_evidence_seal_receipt'}` +
          ` · evidence ${String(bundleFinalDeliveryCommandTrailCustodyCheckpoint.evidence_seal_receipt_hash || '').slice(0, 12)}`;
      }
      return `
        <div class="audit-evidence-item ${item.status === 'anomaly' ? 'is-anomaly' : ''}">
          <strong>${escapeHtml(item.status)} · ${escapeHtml(headline)}</strong>
          <span>${escapeHtml(detail)} · ${escapeHtml(humanDate(item.at))}</span>
        </div>
      `;
    })
    .join('');
  els.auditEvidenceChain.innerHTML = `
    <div class="audit-evidence-summary">
      ${escapeHtml(summary.total_items || 0)} items ·
      ${escapeHtml(summary.verification_count || 0)} verifications ·
      ${escapeHtml(summary.retention_receipt_count || 0)} retention receipts ·
      ${escapeHtml(summary.anomaly_digest_retention_receipt_count || 0)} anomaly retention receipts ·
      ${escapeHtml(summary.bundle_verification_receipt_count || 0)} bundle receipts ·
      ${escapeHtml(summary.bundle_export_receipt_count || 0)} bundle exports ·
      ${escapeHtml(summary.bundle_export_review_receipt_count || 0)} export reviews ·
      ${escapeHtml(summary.bundle_delivery_gate_receipt_count || 0)} gate receipts ·
      ${escapeHtml(summary.bundle_handoff_preview_receipt_count || 0)} handoff receipts ·
      ${escapeHtml(summary.bundle_final_approval_receipt_count || 0)} final receipts ·
      ${escapeHtml(summary.bundle_final_approval_review_receipt_count || 0)} lifecycle receipts ·
      ${escapeHtml(summary.bundle_final_approval_policy_gate_receipt_count || 0)} policy receipts ·
      ${escapeHtml(summary.bundle_final_delivery_dry_run_lock_receipt_count || 0)} lock receipts ·
      ${escapeHtml(summary.bundle_final_delivery_rehearsal_receipt_count || 0)} rehearsal receipts ·
      ${escapeHtml(summary.bundle_final_delivery_dual_control_approval_receipt_count || 0)} dual approvals ·
      ${escapeHtml(summary.bundle_final_delivery_readiness_seal_receipt_count || 0)} readiness seals ·
      ${escapeHtml(summary.bundle_final_delivery_sealed_handoff_review_receipt_count || 0)} handoff signoffs ·
      ${escapeHtml(summary.bundle_final_delivery_command_escrow_receipt_count || 0)} command escrows ·
      ${escapeHtml(summary.bundle_final_delivery_command_revocation_receipt_count || 0)} command revocations ·
      ${escapeHtml(summary.bundle_final_delivery_command_closure_receipt_count || 0)} command closures ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_notarization_receipt_count || 0)} trail notarizations ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_custody_receipt_count || 0)} trail custodies ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_retention_attestation_receipt_count || 0)} retention attestations ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_renewal_window_receipt_count || 0)} renewal windows ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_renewal_confirmation_receipt_count || 0)} checkpoints ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_checkpoint_seal_receipt_count || 0)} seals ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_custody_handoff_receipt_count || 0)} handoffs ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_archive_escrow_receipt_count || 0)} escrows ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_evidence_seal_receipt_count || 0)} evidence seals ·
      ${escapeHtml(summary.bundle_final_delivery_command_trail_custody_checkpoint_receipt_count || 0)} custody checkpoints ·
      ${escapeHtml(summary.anomaly_count || 0)} anomalies
    </div>
    ${rows}
  `;
}

function renderAuditEvidenceCases() {
  const latest = state.auditEvidenceCases[0];
  if (!latest) {
    els.auditEvidenceCaseStatus.textContent = 'No evidence cases yet';
    return;
  }
  const latestReceipt = state.auditEvidenceCaseReviewReceipts[0];
  els.auditEvidenceCaseStatus.textContent =
    `Latest case ${latest.packet_hash.slice(0, 12)}` +
    ` · ${latest.status}` +
    ` · ${latest.priority || 'normal'}` +
    ` · SLA ${latest.sla?.status || 'unscheduled'}` +
    (latest.due_at ? ` · due ${humanDate(latest.due_at)}` : '') +
    ` · ${latest.assignee || 'unassigned'}` +
    ` · anomalies ${latest.summary?.anomaly_count || 0}` +
    (latestReceipt ? ` · review receipt ${String(latestReceipt.receipt_hash || '').slice(0, 12)}` : '') +
    (latest.resolution_note ? ` · ${latest.resolution_note}` : '');
}

function renderAuditEvidenceNotifications() {
  const latest = state.auditEvidenceNotifications[0];
  const latestDigest = state.auditEvidenceCaseAnomalyNotificationDigests[0];
  const schedule = state.auditEvidenceCaseAnomalyNotificationDigestSchedule;
  const latestReceipt = state.auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts[0];
  if (schedule) {
    els.auditAnomalyDigestScheduleIntervalInput.value = schedule.interval_minutes || 1440;
    els.auditAnomalyDigestRetentionInput.value = schedule.retention_days || 90;
  }
  const scheduleText = schedule
    ? ` · schedule ${schedule.enabled ? 'on' : 'off'} every ${schedule.interval_minutes || 1440}m retain ${schedule.retention_days || 90}d`
    : '';
  const receiptText = latestReceipt ? ` · retention ${String(latestReceipt.receipt_hash || '').slice(0, 12)}` : '';
  if (!latest) {
    els.auditNotificationStatus.textContent = latestDigest
      ? `Latest anomaly digest ${String(latestDigest.digest_hash || '').slice(0, 12)} · ${latestDigest.notification_count || 0} notifications${scheduleText}${receiptText}`
      : 'No evidence notifications yet';
    return;
  }
  els.auditNotificationStatus.textContent =
    `Latest alert ${latest.kind}` +
    ` · ${latest.case_kind || 'evidence_case'}` +
    ` · ${latest.status}` +
    ` · ${latest.priority || 'normal'}` +
    (latest.due_at ? ` · due ${humanDate(latest.due_at)}` : '') +
    (latest.bundle_verification_receipt_hash ? ` · bundle ${String(latest.bundle_verification_receipt_hash).slice(0, 12)}` : '') +
    ` · case ${String(latest.case?.packet_hash || latest.case_id || '').slice(0, 12)}` +
    (latestDigest ? ` · digest ${String(latestDigest.digest_hash || '').slice(0, 12)}` : '') +
    scheduleText +
    receiptText +
    (latest.snoozed_until ? ` · snoozed until ${humanDate(latest.snoozed_until)}` : '') +
    (latest.acknowledged_by ? ` · acked by ${latest.acknowledged_by}` : '');
}

function renderAuditNotificationPolicy() {
  const policy = state.auditNotificationPolicy;
  if (!policy) {
    els.auditNotificationPolicyStatus.textContent = 'Notification policy loading';
    return;
  }
  const adapters = Object.entries(policy.adapters || {})
    .filter(([, enabled]) => enabled)
    .map(([adapter]) => adapter)
    .join(', ') || 'none';
  els.auditNotificationPolicyStatus.textContent =
    `Policy ${policy.enabled ? 'enabled' : 'disabled'}` +
    ` · min ${policy.min_priority}` +
    ` · overdue ${policy.notify_overdue ? 'on' : 'off'}` +
    ` · due soon ${policy.notify_due_soon ? 'on' : 'off'}` +
    ` · adapters ${adapters}` +
    (policy.quiet_hours?.enabled
      ? ` · quiet ${policy.quiet_hours.start}-${policy.quiet_hours.end} ${policy.quiet_hours.timezone}`
      : ' · quiet off');
  const replayPolicy = state.auditNotificationReplayPolicy;
  if (replayPolicy) {
    els.auditNotificationPolicyStatus.textContent +=
      ` · replay approvals ${replayPolicy.enabled ? 'on' : 'off'}` +
      ` · reviewer ${replayPolicy.required_reviewer_role}` +
      ` · self ${replayPolicy.allow_self_approval ? 'allowed' : 'blocked'}` +
      ` · ttl ${replayPolicy.request_ttl_minutes}m`;
  }
}

function renderAuditNotificationReplayWorkload() {
  const workload = state.auditNotificationReplayWorkload;
  if (!workload) {
    els.auditNotificationReplayWorkloadStatus.textContent = 'Replay approval workload loading';
    return;
  }
  const summary = workload.summary || {};
  const firstEscalation = (workload.reviewers || []).find((reviewer) => reviewer.escalation_needed);
  els.auditNotificationReplayWorkloadStatus.textContent =
    `Replay workload active ${summary.active_count || 0}` +
    ` · requested ${summary.requested_count || 0}` +
    ` · approved ${summary.approved_count || 0}` +
    ` · expired ${summary.expired_count || 0}` +
    ` · near expiry ${summary.near_expiry_count || 0}` +
    ` · unassigned ${summary.unassigned_count || 0}` +
    (firstEscalation ? ` · escalate ${firstEscalation.reviewer}` : ' · no escalation');
}

function renderAuditReplayThresholds() {
  const policy = state.auditNotificationReplayPerformanceThresholdPolicy;
  const report = state.auditNotificationReplayPerformanceReport;
  if (!policy) {
    els.auditReplayThresholdStatus.textContent = 'Replay SLA thresholds loading';
    return;
  }
  if (document.activeElement !== els.auditReplayThresholdExpiredInput) {
    els.auditReplayThresholdExpiredInput.value = String(policy.max_expired_backlog_count ?? 0);
  }
  if (document.activeElement !== els.auditReplayThresholdNearInput) {
    els.auditReplayThresholdNearInput.value = String(policy.max_near_expiry_backlog_count ?? 2);
  }
  if (document.activeElement !== els.auditReplayThresholdReviewInput) {
    els.auditReplayThresholdReviewInput.value = String(policy.max_average_review_minutes ?? 240);
  }
  const alerts = report?.alert_summary || {};
  els.auditReplayThresholdStatus.textContent =
    `Replay SLA ${alerts.status || 'ok'}` +
    ` · alerts ${alerts.alert_count || 0}` +
    ` · critical ${alerts.critical_count || 0}` +
    ` · warning ${alerts.warning_count || 0}` +
    ` · expired>${policy.max_expired_backlog_count}` +
    ` · near>${policy.max_near_expiry_backlog_count}` +
    ` · review>${policy.max_average_review_minutes}m`;
}

function renderAuditReplaySlaAlerts() {
  const alerts = state.auditNotificationReplaySlaAlerts || [];
  if (!alerts.length) {
    els.auditReplaySlaAlertStatus.textContent = 'Replay SLA alert inbox empty';
    return;
  }
  const open = alerts.filter((alert) => alert.status === 'open');
  const snoozed = alerts.filter((alert) => alert.status === 'snoozed');
  const critical = alerts.filter((alert) => ['open', 'snoozed'].includes(alert.status) && alert.severity === 'critical');
  const latest = open[0] || snoozed[0] || alerts[0];
  els.auditReplaySlaAlertStatus.textContent =
    `Replay SLA inbox ${alerts.length}` +
    ` · open ${open.length}` +
    ` · snoozed ${snoozed.length}` +
    ` · critical ${critical.length}` +
    ` · latest ${latest.severity} ${latest.metric}` +
    (latest.reviewer ? ` · ${latest.reviewer}` : ' · summary') +
    (latest.routed_to ? ` · routed ${latest.routed_to}` : '') +
    ` · ${latest.status}`;
}

function renderAuditReplaySlaAlertSchedule() {
  const schedule = state.auditNotificationReplaySlaAlertSchedule;
  if (!schedule) {
    els.auditReplaySlaScheduleStatus.textContent = 'Replay SLA schedule loading';
    return;
  }
  if (document.activeElement !== els.auditReplaySlaScheduleIntervalInput) {
    els.auditReplaySlaScheduleIntervalInput.value = String(schedule.interval_minutes ?? 60);
  }
  if (document.activeElement !== els.auditReplaySlaScheduleDueSoonInput) {
    els.auditReplaySlaScheduleDueSoonInput.value = String(schedule.due_soon_hours ?? 4);
  }
  els.auditReplaySlaScheduleStatus.textContent =
    `Replay SLA schedule ${schedule.enabled ? 'enabled' : 'disabled'}` +
    ` · every ${schedule.interval_minutes}m` +
    ` · due soon ${schedule.due_soon_hours}h` +
    (schedule.next_run_at ? ` · next ${humanDate(schedule.next_run_at)}` : ' · next unset') +
    (schedule.last_run_at ? ` · last ${humanDate(schedule.last_run_at)}` : ' · not run') +
    (schedule.last_result?.status ? ` · ${schedule.last_result.status}` : '');
}

function renderAuditReplaySlaAlertDigests() {
  const digests = state.auditNotificationReplaySlaAlertDigests || [];
  if (!digests.length) {
    els.auditReplaySlaDigestStatus.textContent = 'Replay SLA digest empty';
    return;
  }
  const latest = digests[0];
  els.auditReplaySlaDigestStatus.textContent =
    `Replay SLA digest ${digests.length}` +
    ` · latest ${latest.alert_count || 0} alerts` +
    ` · active ${latest.summary?.active_count || 0}` +
    ` · critical active ${latest.summary?.critical_active_count || 0}` +
    ` · ${humanDate(latest.created_at)}`;
}

function renderAuditReplaySlaAlertDigestSchedule() {
  const schedule = state.auditNotificationReplaySlaAlertDigestSchedule;
  if (!schedule) {
    els.auditReplaySlaDigestScheduleStatus.textContent = 'Replay SLA digest schedule loading';
    return;
  }
  if (document.activeElement !== els.auditReplaySlaDigestScheduleIntervalInput) {
    els.auditReplaySlaDigestScheduleIntervalInput.value = String(schedule.interval_minutes ?? 1440);
  }
  if (document.activeElement !== els.auditReplaySlaDigestRetentionInput) {
    els.auditReplaySlaDigestRetentionInput.value = String(schedule.retention_days ?? 90);
  }
  els.auditReplaySlaDigestScheduleStatus.textContent =
    `Replay SLA digest schedule ${schedule.enabled ? 'enabled' : 'disabled'}` +
    ` · every ${schedule.interval_minutes}m` +
    ` · retain ${schedule.retention_days}d` +
    (schedule.next_run_at ? ` · next ${humanDate(schedule.next_run_at)}` : ' · next unset') +
    (schedule.last_run_at ? ` · last ${humanDate(schedule.last_run_at)}` : ' · not run') +
    (schedule.last_result?.status ? ` · ${schedule.last_result.status}` : '');
}

function renderAuditReplaySlaAlertDigestRetentionReceipts() {
  const receipts = state.auditNotificationReplaySlaAlertDigestRetentionReceipts || [];
  if (!receipts.length) {
    els.auditReplaySlaDigestReceiptStatus.textContent = 'Replay SLA digest retention receipts empty';
    return;
  }
  const latest = receipts[0];
  els.auditReplaySlaDigestReceiptStatus.textContent =
    `Retention receipts ${receipts.length}` +
    ` · latest ${latest.executed ? 'executed' : 'verified'}` +
    ` · retained ${latest.retained_count || 0}` +
    ` · eligible ${latest.eligible_count || 0}` +
    ` · deleted ${latest.deleted_count || 0}` +
    ` · ${humanDate(latest.created_at)}`;
}

function renderAuditNotificationRules() {
  const latest = state.auditNotificationRules[0];
  if (!latest) {
    els.auditNotificationRuleStatus.textContent = 'No notification rules yet';
    return;
  }
  els.auditNotificationRuleStatus.textContent =
    `Latest rule ${latest.name}` +
    ` · ${latest.kind}` +
    ` · ${latest.priority}` +
    ` · ${latest.adapter}` +
    ` · repeat ${latest.repeat_interval_minutes}m` +
    ` · suppress ${latest.suppression_window_minutes}m` +
    (latest.escalation_assignee ? ` · escalate ${latest.escalation_assignee}` : '');
}

function renderAuditNotificationDeliveries() {
  const latest = state.auditNotificationDeliveries[0];
  if (!latest) {
    els.auditNotificationDeliveryStatus.textContent = 'No delivery attempts yet';
    return;
  }
  els.auditNotificationDeliveryStatus.textContent =
    `Latest delivery ${latest.adapter}` +
    ` · ${latest.status}` +
    ` · ${latest.reason || 'recorded'}` +
    (latest.rule_id ? ` · rule ${String(latest.rule_id).slice(0, 8)}` : '') +
    (latest.escalation_assignee ? ` · escalate ${latest.escalation_assignee}` : '') +
    (latest.force_replay ? ` · approved ${latest.force_replay.approved_by}` : '') +
    ` · ${String(latest.payload_hash || '').slice(0, 12)}` +
    ` · ${humanDate(latest.created_at)}`;
  const latestApproval = state.auditNotificationReplayApprovals[0];
  if (latestApproval) {
    els.auditNotificationDeliveryStatus.textContent +=
      ` · replay approval ${latestApproval.status}` +
      (latestApproval.expired ? ' · expired' : '') +
      (latestApproval.assigned_reviewer ? ` · assigned ${latestApproval.assigned_reviewer}` : '') +
      (latestApproval.reviewed_by ? ` · reviewer ${latestApproval.reviewed_by}` : '') +
      (latestApproval.expires_at ? ` · expires ${humanDate(latestApproval.expires_at)}` : '') +
      (latestApproval.workload_action_status ? ` · workload ${latestApproval.workload_action_status}` : '') +
      (latestApproval.workload_action_by ? ` by ${latestApproval.workload_action_by}` : '') +
      (latestApproval.cleanup_reason ? ` · cleanup ${String(latestApproval.cleanup_reason).slice(0, 32)}` : '') +
      ` · ${String(latestApproval.rejection_reason || latestApproval.force_reason || '').slice(0, 32)}`;
  }
}

function renderAuditFilterStatus() {
  const audit = state.auditLog;
  if (!audit) {
    els.auditFilterStatus.textContent = 'Loading audit activity';
    return;
  }
  const parts = [];
  if (audit.filters?.category && audit.filters.category !== 'all') parts.push(`category:${audit.filters.category}`);
  ['action', 'actor', 'target', 'q'].forEach((key) => {
    if (audit.filters?.[key]) parts.push(`${key}:${audit.filters[key]}`);
  });
  els.auditFilterStatus.textContent = `${audit.total_after_filters ?? audit.events.length} matching events` +
    ` · ${audit.total_before_filters ?? audit.events.length} total indexed` +
    (parts.length ? ` · ${parts.join(' · ')}` : '');
}

function renderAdminUsers() {
  if (state.adminUsersForbidden) {
    els.adminUsersList.innerHTML = emptyState('Admin-only panel.', 'Your role can read queues but cannot manage internal users.');
    els.adminUserForm.hidden = true;
    return;
  }
  els.adminUserForm.hidden = false;
  if (!state.adminUsers.length) {
    els.adminUsersList.innerHTML = emptyState('No admin users found.', 'Create an internal user to grant dashboard access.');
    return;
  }
  els.adminUsersList.innerHTML = state.adminUsers.map(adminUserRow).join('');
  els.adminUsersList.querySelectorAll('form[data-admin-user]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitAdminUserUpdate(form);
    });
  });
}

function adminUserRow(user) {
  const disabled = user.disabled;
  return `
    <form class="admin-user-row${disabled ? ' is-disabled' : ''}" data-admin-user="${escapeHtml(user.username)}">
      <div class="admin-user-main">
        <strong>${escapeHtml(user.display_name || user.username)}</strong>
        <span>${escapeHtml(user.username)} · ${escapeHtml(user.role)} · ${disabled ? 'disabled' : 'active'}</span>
        <small>Last login: ${escapeHtml(humanDate(user.last_login_at))}</small>
      </div>
      <label class="field compact-field">
        <span>Role</span>
        <select name="role">
          ${roleOption('viewer', user.role)}
          ${roleOption('operator', user.role)}
          ${roleOption('admin', user.role)}
        </select>
      </label>
      <label class="field compact-field">
        <span>Display</span>
        <input name="display_name" value="${escapeHtml(user.display_name || user.username)}" />
      </label>
      <label class="field compact-field">
        <span>New password</span>
        <input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Leave blank" />
      </label>
      <label class="toggle-line">
        <input name="disabled" type="checkbox" ${disabled ? 'checked' : ''} />
        <span>Disabled</span>
      </label>
      <button class="small-submit" type="submit">Save</button>
    </form>
  `;
}

function roleOption(role, currentRole) {
  return `<option value="${escapeHtml(role)}" ${role === currentRole ? 'selected' : ''}>${escapeHtml(role)}</option>`;
}

function activityRow(event) {
  return `
    <article class="activity-row">
      <div>
        <span class="badge">${escapeHtml(event.action)}</span>
        <span class="badge audit-category">${escapeHtml(event.category || 'workflow')}</span>
        <strong>${escapeHtml(event.article.title || 'Untitled article')}</strong>
        <p>${escapeHtml(event.brand.name)} · ${escapeHtml(event.from || 'start')} -> ${escapeHtml(event.to || 'unknown')}</p>
      </div>
      <div class="activity-meta">
        <span>${escapeHtml(event.actor)}</span>
        <time>${escapeHtml(humanDate(event.at))}</time>
      </div>
      ${payloadSummaryBlock(event.payload_summary)}
    </article>
  `;
}

function payloadSummaryBlock(summary = {}) {
  const entries = Object.entries(summary).filter(([, value]) => value);
  if (!entries.length) return '';
  return `
    <dl class="payload-summary">
      ${entries
        .map(
          ([key, value]) => `
            <div>
              <dt>${escapeHtml(key.replaceAll('_', ' '))}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `
        )
        .join('')}
    </dl>
  `;
}

function renderHealth() {
  const dashboard = state.dashboard;
  els.healthBlock.innerHTML = `
    <span class="label">Status</span>
    <strong>${escapeHtml(dashboard.status)}</strong>
    <small>${escapeHtml(humanDate(dashboard.generated_at))}</small>
  `;
}

function renderNav() {
  const productOps = state.dashboard.product_ops;
  const queues = Object.values(productOps?.queues || state.dashboard.queues);
  const total = productOps?.summary?.total_product_queue_items ?? state.dashboard.summary.total_items;
  els.queueNav.innerHTML = [
    queueTab({ key: 'all', label: 'All active work', priority: 'mixed', count: total }),
    ...queues.map(queueTab)
  ].join('');

  els.queueNav.querySelectorAll('button[data-queue]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeQueue = button.dataset.queue;
      const first = visibleItems()[0];
      state.selectedKey = first ? itemKey(first) : null;
      state.drawerItemKey = null;
      state.notice = null;
      render();
    });
  });
}

function queueTab(queue) {
  const active = state.activeQueue === queue.key ? ' is-active' : '';
  return `
    <button class="queue-tab${active}" type="button" data-queue="${escapeHtml(queue.key)}">
      <span>
        <b>${escapeHtml(queue.label)}</b>
        <small>${escapeHtml(queue.priority)} priority</small>
      </span>
      <strong>${escapeHtml(queue.count)}</strong>
    </button>
  `;
}

function renderItems() {
  const items = visibleItems();
  els.activeQueueTitle.textContent = queueTitle(state.activeQueue);
  if (!items.length) {
    els.queueList.innerHTML = emptyState('No work in this queue.', 'The aggregate is clean for this stage.');
    renderDetail(null);
    return;
  }

  els.queueList.innerHTML = items.map(queueCard).join('');
  els.queueList.querySelectorAll('button[data-key]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedKey = button.dataset.key;
      state.drawerItemKey = null;
      state.notice = null;
      renderItems();
    });
  });

  const selected = items.find((item) => itemKey(item) === state.selectedKey) || items[0];
  state.selectedKey = itemKey(selected);
  renderDetail(selected);
}

function queueCard(item) {
  const key = itemKey(item);
  const active = key === state.selectedKey ? ' is-active' : '';
  const articleTitle = item.article?.title || item.run?.type || item.label || 'Product ops item';
  const brandName = item.brand?.name || 'Unknown brand';
  const nextAction = item.next_operator_action || item.next_action || 'Review product state.';
  const scheduleOrUsage = item.scheduled_for
    ? humanDate(item.scheduled_for)
    : item.provider_calls !== undefined
      ? `${item.provider_calls} calls`
      : humanDate(item.updated_at);
  return `
    <button class="queue-card${active}" type="button" data-key="${escapeHtml(key)}">
      <span>
        <span class="card-title">
          <strong>${escapeHtml(articleTitle)}</strong>
          <span class="badge ${priorityClass(item.priority)}">${escapeHtml(item.label)}</span>
        </span>
        <span class="meta-grid">
          <span><span class="meta-label">Brand</span><br /><strong>${escapeHtml(brandName)}</strong></span>
          <span><span class="meta-label">Next</span><br /><strong>${escapeHtml(nextAction)}</strong></span>
          <span><span class="meta-label">Signal</span><br /><strong>${escapeHtml(scheduleOrUsage)}</strong></span>
        </span>
      </span>
      <time>${escapeHtml(humanDate(item.updated_at))}</time>
    </button>
  `;
}

function renderDetail(item) {
  if (!item) {
    els.detailPanel.innerHTML = emptyState('Select a queue item.', 'Details appear here for internal ops only.');
    return;
  }

  const customerUrl = item.route_hints?.customer_dashboard_url;
  const productLink = item.customer_product_link || customerUrl;
  const endpoint = item.route_hints?.ops_action_endpoint;
  const action = actionForItem(item);
  const drawerOpen = state.drawerItemKey === itemKey(item);
  const articleTitle = item.article?.title || item.run?.type || item.label || 'Product ops item';
  const brandName = item.brand?.name || 'Unknown brand';
  const websiteUrl = item.brand?.website_url || 'No site';
  const statuses = item.statuses || {};
  const productActions = Array.isArray(item.available_actions) ? item.available_actions : [];
  const geoflowReadiness = item.geoflow_readiness || null;
  const geoflowLiveGate = item.geoflow_live_gate || null;
  els.detailPanel.innerHTML = `
    <div class="detail-head">
      <span class="badge ${priorityClass(item.priority)}">${escapeHtml(item.priority)} priority</span>
      <h2>${escapeHtml(articleTitle)}</h2>
      <p>${escapeHtml(item.next_operator_action || item.next_action || 'Review product state.')}</p>
      ${state.notice ? `<div class="notice ${state.notice.type}">${escapeHtml(state.notice.message)}</div>` : ''}
    </div>
    <div class="detail-list">
      ${detailRow('Brand', `${brandName} · ${websiteUrl}`)}
      ${detailRow('Queue', item.label)}
      ${detailRow('Blocker', item.blocker || 'No blocker recorded')}
      ${detailRow('Run', item.run ? `${item.run.type} · ${item.run.status}` : item.tracking_run_id || 'No run linked')}
      ${detailRow('Production', statuses.production || 'n/a')}
      ${detailRow('Quality', statuses.quality_review || 'n/a')}
      ${detailRow('Package', statuses.package || 'n/a')}
      ${detailRow('Publish handoff', statuses.publish_handoff || 'n/a')}
      ${detailRow('Published URL', item.published_url || 'Not confirmed')}
      ${detailRow('Provider job', item.provider_job_id || item.provider || 'Not assigned')}
      ${geoflowReadiness ? geoflowReadinessRows(geoflowReadiness) : ''}
      ${geoflowLiveGate ? geoflowLiveGateRows(geoflowLiveGate) : ''}
      ${detailRow('Provider calls', item.provider_calls ?? 'n/a')}
      ${detailRow('Estimated cost', item.cost_estimate_usd === undefined ? 'n/a' : `$${item.cost_estimate_usd}`)}
      ${detailRow('Scheduled retest', humanDate(item.scheduled_for))}
    </div>
    <div class="link-list">
      ${productLink ? `<a href="${escapeHtml(productLink)}">Open customer dashboard context</a>` : ''}
      ${endpoint ? `<span class="endpoint">${escapeHtml(endpoint)}</span>` : ''}
    </div>
    <div class="ops-action-zone">
      ${
        action
          ? productActions.length
            ? `<div class="product-action-list">${productActions
                .map(
                  (entry) =>
                    `<button class="action-open" type="button" data-product-action="${escapeHtml(entry.type)}">${escapeHtml(
                      drawerOpen && state.drawerActionType === entry.type ? 'Close action drawer' : entry.label
                    )}</button>`
                )
                .join('')}</div>`
            : `<button class="action-open" type="button" data-action-open="${escapeHtml(itemKey(item))}">${escapeHtml(drawerOpen ? 'Close action drawer' : action.label)}</button>`
          : '<div class="locked-action">No R7.2 controlled action is currently available for this queue item.</div>'
      }
      ${drawerOpen && action ? actionDrawer(item, action) : ''}
    </div>
  `;

  els.detailPanel.querySelectorAll('[data-product-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextType = button.getAttribute('data-product-action');
      const closeCurrent = drawerOpen && state.drawerActionType === nextType;
      state.drawerItemKey = closeCurrent ? null : itemKey(item);
      state.drawerActionType = closeCurrent ? null : nextType;
      state.notice = null;
      renderDetail(item);
    });
  });

  const openButton = els.detailPanel.querySelector('[data-action-open]');
  if (openButton) {
    openButton.addEventListener('click', () => {
      state.drawerItemKey = drawerOpen ? null : itemKey(item);
      state.drawerActionType = null;
      state.notice = null;
      renderDetail(item);
    });
  }

  const form = els.detailPanel.querySelector('form[data-ops-action]');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitActionForm(item, actionForItem(item), form);
    });
  }
}

function geoflowReadinessRows(readiness) {
  const missing = Array.isArray(readiness.missing_config) && readiness.missing_config.length ? readiness.missing_config.join(', ') : 'None';
  const blockers = Array.isArray(readiness.blockers) && readiness.blockers.length ? readiness.blockers.join('; ') : 'None';
  const contract = readiness.contract_comparison?.ok ? 'Passed' : 'Blocked';
  return [
    detailRow('GeoFlow readiness', readiness.status || 'n/a'),
    detailRow('GeoFlow dry-run', readiness.request_plan?.dry_run ? 'Plan ready' : 'Not ready'),
    detailRow('Live dispatch', readiness.live_dispatch_allowed ? 'Allowed' : 'Blocked by default'),
    detailRow('GeoFlow endpoint', readiness.request_plan?.endpoint || 'Missing'),
    detailRow('Missing GeoFlow config', missing),
    detailRow('Contract comparison', contract),
    detailRow('Readiness blockers', blockers)
  ].join('');
}

function geoflowLiveGateRows(gate) {
  const blockers = Array.isArray(gate.blockers) && gate.blockers.length ? gate.blockers.join('; ') : 'None';
  const requirements = Object.values(gate.requirements || {}).filter((item) => item?.ok).length;
  const totalRequirements = Object.values(gate.requirements || {}).length;
  return [
    detailRow('R8.3 live gate', gate.status || 'n/a'),
    detailRow('Live pilot allowed', gate.live_dispatch_allowed ? 'Allowed' : 'Blocked'),
    detailRow('Pilot limit', `${gate.requested_pilot_jobs || 0}/${gate.pilot_limit || 1}`),
    detailRow('Gate requirements', `${requirements}/${totalRequirements} passed`),
    detailRow('Approval phrase', gate.approval_phrase_required || 'Required'),
    detailRow('Gate blockers', blockers)
  ].join('');
}

function actionDrawer(item, action) {
  return `
    <form class="action-drawer" data-ops-action="${escapeHtml(action.action)}">
      <div class="drawer-head">
        <span class="label">Ops action</span>
        <strong>${escapeHtml(action.title)}</strong>
        <p>${escapeHtml(action.description)}</p>
      </div>
      ${actionFields(action.action)}
      <label class="confirm-line">
        <input type="checkbox" name="confirmed" required />
        <span>I confirm this is an internal ops action for ${escapeHtml(item.ids?.publish_handoff_id || item.tracking_run_id || item.ids?.retest_schedule_id || item.label)}.</span>
      </label>
      <button class="action-submit" type="submit">${escapeHtml(action.submit)}</button>
    </form>
  `;
}

function actionFields(action) {
  if (action === 'resume_customer_review') {
    return `
      <label class="field">
        <span>Ops note</span>
        <textarea name="note" rows="3" placeholder="Revisions are ready for customer review."></textarea>
      </label>
    `;
  }
  if (action === 'prepare_handoff') {
    return `
      <label class="field">
        <span>Channel</span>
        <select name="channel">
          <option value="manual">Manual</option>
          <option value="cms">CMS handoff</option>
          <option value="email">Email handoff</option>
        </select>
      </label>
      <label class="field">
        <span>Instructions</span>
        <textarea name="instructions" rows="4" required>Use the exported Markdown, HTML, and metadata package for manual publication.</textarea>
      </label>
    `;
  }
  if (action === 'mark_published_externally') {
    return `
      <label class="field">
        <span>Published URL</span>
        <input name="url" type="url" placeholder="https://example.com/article" />
      </label>
      <label class="field">
        <span>External reference</span>
        <input name="external_reference" type="text" placeholder="CMS post id, doc link, or other reference" />
      </label>
      <label class="field">
        <span>Published at</span>
        <input name="published_at" type="datetime-local" />
      </label>
    `;
  }
  if (action === 'schedule_retest') {
    return `
      <label class="field">
        <span>Scheduled for</span>
        <input name="scheduled_for" type="datetime-local" value="${escapeHtml(localDateTimeValue(7))}" required />
      </label>
      <label class="field">
        <span>Ops note</span>
        <textarea name="note" rows="3" placeholder="Pending post-publish retest schedule only."></textarea>
      </label>
    `;
  }
  if (action === 'retry_tracking_run_mock') {
    return `
      <label class="field">
        <span>Ops note</span>
        <textarea name="note" rows="3" placeholder="Retrying failed tracking run through mock-safe R7.2 action surface."></textarea>
      </label>
    `;
  }
  if (action === 'run_due_retests_mock') {
    return `
      <label class="field">
        <span>Due at</span>
        <input name="due_at" type="datetime-local" value="${escapeHtml(localDateTimeValue(0))}" />
      </label>
      <label class="field">
        <span>Limit</span>
        <input name="limit" type="number" min="1" max="50" value="20" />
      </label>
    `;
  }
  if (action === 'acknowledge_product_failure') {
    return `
      <label class="field">
        <span>Triage note</span>
        <textarea name="note" rows="3" required placeholder="Failure reviewed; next operator action is clear."></textarea>
      </label>
    `;
  }
  return '';
}

function buildActionPayload(action, form, item) {
  const data = new FormData(form);
  const payload = {
    action: action.action,
    actor: 'ops_dashboard_ui'
  };
  if (action.product_ops_action) {
    payload.product_ops_action = true;
    payload.publish_handoff_id = item.ids?.publish_handoff_id || undefined;
    payload.tracking_run_id = item.tracking_run_id || undefined;
    payload.retest_schedule_id = item.ids?.retest_schedule_id || undefined;
    payload.target_type = item.item_type || item.queue || undefined;
    payload.target_id =
      item.tracking_run_id || item.ids?.publish_handoff_id || item.ids?.retest_schedule_id || item.ids?.production_handoff_id || undefined;
  }
  const note = data.get('note')?.trim();
  if (note) payload.note = note;

  if (action.action === 'prepare_handoff') {
    payload.channel = data.get('channel') || 'manual';
    payload.instructions = data.get('instructions')?.trim();
  }
  if (action.action === 'mark_published_externally') {
    const url = data.get('url')?.trim();
    const externalReference = data.get('external_reference')?.trim();
    const publishedAt = data.get('published_at')?.trim();
    if (!url && !externalReference) {
      throw new Error('Published URL or external reference is required.');
    }
    if (url) payload.url = url;
    if (externalReference) payload.external_reference = externalReference;
    if (publishedAt) payload.published_at = new Date(publishedAt).toISOString();
  }
  if (action.action === 'schedule_retest') {
    const scheduledFor = data.get('scheduled_for')?.trim();
    if (!scheduledFor) {
      throw new Error('Scheduled for is required.');
    }
    payload.scheduled_for = new Date(scheduledFor).toISOString();
  }
  if (action.action === 'run_due_retests_mock') {
    const dueAt = data.get('due_at')?.trim();
    const limit = data.get('limit')?.trim();
    if (dueAt) payload.due_at = new Date(dueAt).toISOString();
    if (limit) payload.limit = Number(limit);
  }
  return payload;
}

async function submitActionForm(item, action, form) {
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Working';
  try {
    const payload = buildActionPayload(action, form, item);
    const result = await postOpsAction(item, payload);
    if (result.schema_version === 'r7-2-product-ops-action-result-v1') {
      state.notice = {
        type: 'success',
        message: `${result.action.label} accepted. Result: ${result.result_state}.`
      };
      state.drawerItemKey = null;
      state.drawerActionType = null;
      await refreshDashboard({ preserveHandoffId: item.ids?.publish_handoff_id });
      return;
    }
    state.notice = {
      type: 'success',
      message: `${result.ops_action.label} accepted. New status: ${result.handoff.status}.`
    };
    state.activeQueue = queueForHandoffStatus(result.handoff.status) || state.activeQueue;
    state.drawerItemKey = null;
    state.drawerActionType = null;
    await refreshDashboard({ preserveHandoffId: item.ids?.publish_handoff_id });
  } catch (error) {
    state.notice = { type: 'error', message: error.message };
    renderDetail(selectedItem());
  } finally {
    submit.disabled = false;
    submit.textContent = action.submit;
  }
}

function detailRow(label, value) {
  return `
    <div class="detail-row">
      <span class="meta-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function emptyState(title, copy) {
  return `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span class="empty-copy">${escapeHtml(copy)}</span>
    </div>
  `;
}

function auditExportFilename(extension) {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  return `ops-audit-${stamp}.${extension}`;
}

function auditReportFilename(extension) {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  return `ops-audit-compliance-${stamp}.${extension}`;
}

function auditCasePacketFilename(extension) {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  return `ops-audit-case-packet-${stamp}.${extension}`;
}

function auditCaseBundleFilename(extension) {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  return `ops-audit-case-bundle-${stamp}.${extension}`;
}

function auditReplayWorkloadFilename(extension) {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  return `ops-audit-replay-workload-${stamp}.${extension}`;
}

function auditReplayPerformanceFilename(extension) {
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19);
  return `ops-audit-replay-performance-${stamp}.${extension}`;
}

function selectedSavedView() {
  const id = els.auditSavedViewSelect.value;
  return state.auditSavedViews.find((view) => view.id === id) || null;
}

function applyAuditFiltersToForm(filters = {}) {
  els.auditFilterForm.elements.category.value = filters.category || 'all';
  els.auditFilterForm.elements.action.value = filters.action || '';
  els.auditFilterForm.elements.actor.value = filters.actor || '';
  els.auditFilterForm.elements.target.value = filters.target || '';
  els.auditFilterForm.elements.q.value = filters.q || '';
}

async function saveAuditView() {
  const existing = selectedSavedView();
  const name = els.auditSavedViewName.value.trim() || existing?.name;
  const payload = {
    name,
    filters: readAuditFilters()
  };
  const endpoint = existing ? `/internal/ops/audit-views/${encodeURIComponent(existing.id)}` : '/internal/ops/audit-views';
  const response = await fetch(endpoint, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Save audit view returned ${response.status}`);
  }
  state.auditFilters = payload.filters;
  await refreshDashboard({ preserveSelection: true });
  els.auditSavedViewSelect.value = body.view.id;
  els.auditSavedViewName.value = body.view.name;
}

async function deleteAuditView() {
  const existing = selectedSavedView();
  if (!existing) {
    throw new Error('Select a saved view before deleting.');
  }
  const response = await fetch(`/internal/ops/audit-views/${encodeURIComponent(existing.id)}`, { method: 'DELETE' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `Delete audit view returned ${response.status}`);
  }
  els.auditSavedViewName.value = '';
  await refreshDashboard({ preserveSelection: true });
}

function downloadBlob({ content, type, filename }) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportAudit(format) {
  const response = await fetch(`/internal/ops/audit-log?${auditQuery({ format, limit: 200 })}`);
  if (!response.ok) {
    throw new Error(`Audit ${format} export returned ${response.status}`);
  }
  if (format === 'csv') {
    downloadBlob({
      content: await response.text(),
      type: 'text/csv',
      filename: auditExportFilename('csv')
    });
    return;
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.audit_log, null, 2),
    type: 'application/json',
    filename: auditExportFilename('json')
  });
}

async function exportAuditReport(format) {
  const response = await fetch(`/internal/ops/audit-report?${auditQuery({ format, limit: 200 })}`);
  if (!response.ok) {
    throw new Error(`Audit report ${format} returned ${response.status}`);
  }
  if (format === 'html') {
    downloadBlob({
      content: await response.text(),
      type: 'text/html',
      filename: auditReportFilename('html')
    });
    return;
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.report, null, 2),
    type: 'application/json',
    filename: auditReportFilename('json')
  });
}

async function exportAuditEvidenceCasePacket(format) {
  const response = await fetch(`/internal/ops/audit-evidence-case-packet?${evidenceChainQuery({ format, limit: 100 })}`);
  if (!response.ok) {
    throw new Error(`Evidence case packet ${format} returned ${response.status}`);
  }
  if (format === 'html') {
    downloadBlob({
      content: await response.text(),
      type: 'text/html',
      filename: auditCasePacketFilename('html')
    });
    return;
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.packet, null, 2),
    type: 'application/json',
    filename: auditCasePacketFilename('json')
  });
}

async function exportAuditEvidenceCaseBundle() {
  const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle?${evidenceChainQuery({ limit: 100 })}`);
  if (!response.ok) {
    throw new Error(`Evidence case bundle returned ${response.status}`);
  }
  const payload = await response.json();
  const bundle = payload.bundle || {};
  state.auditEvidenceCaseBundle = bundle;
  state.auditEvidenceCaseBundleExportReceipt = payload.export_receipt || null;
  if (payload.history) {
    state.auditEvidenceCaseBundleExports = [
      payload.history,
      ...state.auditEvidenceCaseBundleExports.filter((item) => item.id !== payload.history.id)
    ].slice(0, 20);
  }
  downloadBlob({
    content: JSON.stringify(bundle, null, 2),
    type: 'application/json',
    filename: auditCaseBundleFilename('json')
  });
  els.auditEvidenceChain.textContent =
    `Signed bundle ${String(bundle.manifest_hash || '').slice(0, 12)}` +
    ` · ${bundle.manifest?.entries?.length || 0} manifest entries` +
    ` · ${bundle.anomaly_digest_retention_receipt_references?.length || 0} anomaly retention refs` +
    ` · export ${String(payload.export_receipt?.receipt_hash || '').slice(0, 12)}` +
    ` · ${bundle.signature?.algorithm || 'signature'}`;
}

async function verifyAuditEvidenceCaseBundle() {
  if (!state.auditEvidenceCaseBundle) {
    const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle?${evidenceChainQuery({ limit: 100 })}`);
    if (!response.ok) {
      throw new Error(`Evidence case bundle returned ${response.status}`);
    }
    const payload = await response.json();
    state.auditEvidenceCaseBundle = payload.bundle || {};
  }
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundle: state.auditEvidenceCaseBundle })
  });
  if (!response.ok) {
    throw new Error(`Evidence case bundle verification returned ${response.status}`);
  }
  const payload = await response.json();
  const verification = payload.verification || {};
  if (payload.history) {
    state.auditEvidenceCaseBundleVerifications = [
      payload.history,
      ...state.auditEvidenceCaseBundleVerifications.filter((item) => item.id !== payload.history.id)
    ].slice(0, 20);
  }
  els.auditEvidenceChain.textContent =
    `${verification.valid ? 'Bundle verified' : 'Bundle verification failed'}` +
    ` · manifest ${String(verification.manifest_hash || '').slice(0, 12)}` +
    ` · receipt ${String(verification.receipt_hash || payload.receipt?.receipt_hash || '').slice(0, 12)}` +
    ` · entries ${(verification.entry_results || []).length}` +
    ` · signature ${verification.checks?.signature_matches ? 'match' : 'mismatch'}`;
}

async function fetchAuditEvidenceCaseBundleExports() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-exports?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle exports returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleExports = payload.exports || [];
  const latest = state.auditEvidenceCaseBundleExports[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest bundle export ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · manifest ${String(latest.bundle_manifest_hash || '').slice(0, 12)}` +
      ` · entries ${latest.manifest_entries?.length || 0}` +
      ` · requester ${latest.requester}`
    : 'No bundle export receipts yet';
  return state.auditEvidenceCaseBundleExports;
}

async function exportLatestAuditEvidenceCaseBundleExportReceipt() {
  if (!state.auditEvidenceCaseBundleExports.length) {
    await fetchAuditEvidenceCaseBundleExports();
  }
  const latest = state.auditEvidenceCaseBundleExports[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No bundle export receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-exports/${latest.receipt_hash}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle export receipt returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-export-receipt-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded bundle export receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · manifest ${String(latest.bundle_manifest_hash || '').slice(0, 12)}`;
}

async function reviewLatestAuditEvidenceCaseBundleExport() {
  if (!state.auditEvidenceCaseBundleExports.length) {
    await fetchAuditEvidenceCaseBundleExports();
  }
  const latest = state.auditEvidenceCaseBundleExports[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No bundle export receipt to review.';
    return;
  }
  els.auditCaseBundleExportReviewButton.disabled = true;
  els.auditCaseBundleExportReviewButton.textContent = 'Reviewing';
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-exports/${encodeURIComponent(latest.receipt_hash)}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'attested',
        purpose: 'archive',
        decision: 'usable',
        note: 'Dashboard attestation for internal evidence bundle export lifecycle.'
      })
    }
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle export review returned ${response.status}`);
  }
  const payload = await response.json();
  if (payload.review_receipt) {
    state.auditEvidenceCaseBundleExportReviews = [
      payload.review_receipt,
      ...state.auditEvidenceCaseBundleExportReviews.filter((review) => review.id !== payload.review_receipt.id)
    ];
  }
  els.auditEvidenceChain.textContent =
    `Reviewed bundle export ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · decision ${payload.review_receipt?.decision || 'usable'}` +
    ` · receipt ${String(payload.review_receipt?.receipt_hash || '').slice(0, 12)}`;
  els.auditCaseBundleExportReviewButton.disabled = false;
  els.auditCaseBundleExportReviewButton.textContent = 'Review export';
}

async function fetchAuditEvidenceCaseBundleExportReviews() {
  const params = new URLSearchParams({ limit: '20' });
  const latestExport = state.auditEvidenceCaseBundleExports[0];
  if (latestExport?.receipt_hash) params.set('export_receipt_hash', latestExport.receipt_hash);
  const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle-export-reviews?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Evidence case bundle export reviews returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleExportReviews = payload.reviews || [];
  const latest = state.auditEvidenceCaseBundleExportReviews[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest export review ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · export ${String(latest.bundle_export_receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.purpose}/${latest.decision}`
    : 'No bundle export review receipts yet';
  return state.auditEvidenceCaseBundleExportReviews;
}

async function fetchAuditEvidenceCaseBundleDeliveryReadiness() {
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-export-delivery-readiness?${evidenceChainQuery({ limit: 100 })}`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery readiness returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleDeliveryReadiness = payload.delivery_readiness || null;
  const readiness = state.auditEvidenceCaseBundleDeliveryReadiness;
  const counts = readiness?.counts || {};
  els.auditEvidenceChain.textContent = readiness
    ? `Delivery rollup ${readiness.delivery_status}` +
      ` · eligible ${counts.eligible_exports || 0}` +
      ` · needs review ${counts.needs_review_exports || 0}` +
      ` · blocked ${counts.blocked_exports || 0}` +
      ` · unreviewed ${counts.unreviewed_exports || 0}`
    : 'No delivery readiness rollup yet';
  return readiness;
}

async function fetchAuditEvidenceCaseBundleDeliveryGate() {
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-export-delivery-gate?${evidenceChainQuery({ limit: 100 })}`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery gate returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleDeliveryGate = payload.delivery_gate || null;
  const gate = state.auditEvidenceCaseBundleDeliveryGate;
  els.auditEvidenceChain.textContent = gate
    ? `Delivery gate ${gate.decision}` +
      ` · ${gate.reason}` +
      ` · ${gate.can_deliver ? 'allowed' : 'blocked'}` +
      ` · ${gate.explanation}`
    : 'No delivery gate result yet';
  return gate;
}

async function recordAuditEvidenceCaseBundleDeliveryGateReceipt() {
  els.auditCaseBundleDeliveryGateReceiptButton.disabled = true;
  els.auditCaseBundleDeliveryGateReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-gate-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery gate receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.gate_receipt) {
      state.auditEvidenceCaseBundleDeliveryGateReceipts = [
        payload.gate_receipt,
        ...state.auditEvidenceCaseBundleDeliveryGateReceipts.filter((receipt) => receipt.id !== payload.gate_receipt.id)
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded delivery gate ${payload.gate_receipt?.decision || 'deny'}` +
      ` · ${payload.gate_receipt?.reason || 'delivery_readiness_missing'}` +
      ` · receipt ${String(payload.gate_receipt?.receipt_hash || '').slice(0, 12)}` +
      ` · packet ${String(payload.gate_receipt?.packet_hash || '').slice(0, 12)}`;
    return payload.gate_receipt;
  } finally {
    els.auditCaseBundleDeliveryGateReceiptButton.disabled = false;
    els.auditCaseBundleDeliveryGateReceiptButton.textContent = 'Record gate';
  }
}

async function fetchAuditEvidenceCaseBundleDeliveryGateReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-gate-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery gate receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleDeliveryGateReceipts = payload.receipts || [];
  const latest = state.auditEvidenceCaseBundleDeliveryGateReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest gate receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.reason}` +
      ` · readiness ${latest.readiness_status}` +
      ` · packet ${String(latest.packet_hash || '').slice(0, 12)}`
    : 'No delivery gate receipts yet';
  return state.auditEvidenceCaseBundleDeliveryGateReceipts;
}

async function exportLatestAuditEvidenceCaseBundleDeliveryGateReceipt() {
  if (!state.auditEvidenceCaseBundleDeliveryGateReceipts.length) {
    await fetchAuditEvidenceCaseBundleDeliveryGateReceipts();
  }
  const latest = state.auditEvidenceCaseBundleDeliveryGateReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No delivery gate receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-delivery-gate-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery gate receipt JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-delivery-gate-receipt-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded delivery gate receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.reason}`;
}

async function createAuditEvidenceCaseBundleDeliveryHandoffPreview() {
  els.auditCaseBundleDeliveryHandoffPreviewButton.disabled = true;
  els.auditCaseBundleDeliveryHandoffPreviewButton.textContent = 'Previewing';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestGateReceipt = state.auditEvidenceCaseBundleDeliveryGateReceipts[0];
    if (!params.get('receipt_hash') && latestGateReceipt?.receipt_hash) {
      params.set('receipt_hash', latestGateReceipt.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery handoff preview returned ${response.status}`);
    }
    const payload = await response.json();
    const preview = payload.handoff_preview || null;
    state.auditEvidenceCaseBundleDeliveryHandoffPreview = preview;
    els.auditEvidenceChain.textContent = preview
      ? `Handoff preview ${preview.status}` +
        ` · ${preview.reason}` +
        ` · ${preview.can_handoff ? 'ready' : 'blocked'}` +
        ` · bundle entries ${preview.signed_bundle?.manifest_entry_count || 0}` +
        ` · verify ${preview.bundle_verification?.valid ? 'valid' : 'failed'}` +
        ` · hash ${String(preview.preview_hash || '').slice(0, 12)}`
      : 'No handoff preview generated';
    return preview;
  } finally {
    els.auditCaseBundleDeliveryHandoffPreviewButton.disabled = false;
    els.auditCaseBundleDeliveryHandoffPreviewButton.textContent = 'Handoff preview';
  }
}

async function recordAuditEvidenceCaseBundleDeliveryHandoffPreviewReceipt() {
  els.auditCaseBundleDeliveryHandoffPreviewReceiptButton.disabled = true;
  els.auditCaseBundleDeliveryHandoffPreviewReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestGateReceipt = state.auditEvidenceCaseBundleDeliveryGateReceipts[0];
    if (!params.get('receipt_hash') && latestGateReceipt?.receipt_hash) {
      params.set('receipt_hash', latestGateReceipt.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery handoff preview receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.handoff_preview_receipt) {
      state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts = [
        payload.handoff_preview_receipt,
        ...state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts.filter(
          (receipt) => receipt.id !== payload.handoff_preview_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded handoff preview ${payload.handoff_preview_receipt?.status || 'blocked'}` +
      ` · ${payload.handoff_preview_receipt?.reason || 'handoff_preview_missing'}` +
      ` · receipt ${String(payload.handoff_preview_receipt?.receipt_hash || '').slice(0, 12)}` +
      ` · preview ${String(payload.handoff_preview_receipt?.preview_hash || '').slice(0, 12)}`;
    return payload.handoff_preview_receipt;
  } finally {
    els.auditCaseBundleDeliveryHandoffPreviewReceiptButton.disabled = false;
    els.auditCaseBundleDeliveryHandoffPreviewReceiptButton.textContent = 'Record handoff';
  }
}

async function fetchAuditEvidenceCaseBundleDeliveryHandoffPreviewReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery handoff preview receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts = payload.receipts || [];
  const latest = state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest handoff receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_handoff ? 'ready' : 'blocked'}` +
      ` · preview ${String(latest.preview_hash || '').slice(0, 12)}`
    : 'No handoff preview receipts yet';
  return state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts;
}

async function exportLatestAuditEvidenceCaseBundleDeliveryHandoffPreviewReceipt() {
  if (!state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts.length) {
    await fetchAuditEvidenceCaseBundleDeliveryHandoffPreviewReceipts();
  }
  const latest = state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No handoff preview receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery handoff preview receipt JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-handoff-preview-receipt-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded handoff preview receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.status}` +
    ` · ${latest.reason}`;
}

async function createAuditEvidenceCaseBundleDeliveryFinalApprovalPreview() {
  els.auditCaseBundleDeliveryFinalApprovalPreviewButton.disabled = true;
  els.auditCaseBundleDeliveryFinalApprovalPreviewButton.textContent = 'Approving';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestHandoffReceipt = state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts[0];
    if (!params.get('receipt_hash') && latestHandoffReceipt?.receipt_hash) {
      params.set('receipt_hash', latestHandoffReceipt.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery final approval preview returned ${response.status}`);
    }
    const payload = await response.json();
    const preview = payload.final_approval_preview || null;
    state.auditEvidenceCaseBundleDeliveryFinalApprovalPreview = preview;
    els.auditEvidenceChain.textContent = preview
      ? `Final approval ${preview.decision}` +
        ` · ${preview.reason}` +
        ` · ${preview.can_approve ? 'ready' : 'blocked'}` +
        ` · handoff ${String(preview.handoff_preview_receipt?.receipt_hash || '').slice(0, 12)}` +
        ` · verify ${preview.bundle_verification?.valid ? 'valid' : 'failed'}` +
        ` · hash ${String(preview.approval_preview_hash || '').slice(0, 12)}`
      : 'No final approval preview generated';
    return preview;
  } finally {
    els.auditCaseBundleDeliveryFinalApprovalPreviewButton.disabled = false;
    els.auditCaseBundleDeliveryFinalApprovalPreviewButton.textContent = 'Final approval';
  }
}

async function recordAuditEvidenceCaseBundleDeliveryFinalApprovalReceipt() {
  els.auditCaseBundleDeliveryFinalApprovalReceiptButton.disabled = true;
  els.auditCaseBundleDeliveryFinalApprovalReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestHandoffReceipt = state.auditEvidenceCaseBundleDeliveryHandoffPreviewReceipts[0];
    if (!params.get('receipt_hash') && latestHandoffReceipt?.receipt_hash) {
      params.set('receipt_hash', latestHandoffReceipt.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery final approval receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.final_approval_receipt) {
      state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts = [
        payload.final_approval_receipt,
        ...state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts.filter(
          (receipt) => receipt.id !== payload.final_approval_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded final approval ${payload.final_approval_receipt?.decision || 'deny'}` +
      ` · ${payload.final_approval_receipt?.reason || 'final_approval_missing'}` +
      ` · receipt ${String(payload.final_approval_receipt?.receipt_hash || '').slice(0, 12)}` +
      ` · preview ${String(payload.final_approval_receipt?.approval_preview_hash || '').slice(0, 12)}`;
    return payload.final_approval_receipt;
  } finally {
    els.auditCaseBundleDeliveryFinalApprovalReceiptButton.disabled = false;
    els.auditCaseBundleDeliveryFinalApprovalReceiptButton.textContent = 'Record final';
  }
}

async function fetchAuditEvidenceCaseBundleDeliveryFinalApprovalReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery final approval receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts = payload.receipts || [];
  const latest = state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest final receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_approve ? 'ready' : 'blocked'}`
    : 'No final approval receipts yet';
  return state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts;
}

async function exportLatestAuditEvidenceCaseBundleDeliveryFinalApprovalReceipt() {
  if (!state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts.length) {
    await fetchAuditEvidenceCaseBundleDeliveryFinalApprovalReceipts();
  }
  const latest = state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final approval receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery final approval receipt JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-approval-receipt-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded final approval receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.reason}`;
}

async function recordAuditEvidenceCaseBundleDeliveryFinalApprovalReview(action) {
  const buttonMap = {
    confirmed: els.auditCaseBundleDeliveryFinalApprovalConfirmButton,
    revoked: els.auditCaseBundleDeliveryFinalApprovalRevokeButton,
    expired: els.auditCaseBundleDeliveryFinalApprovalExpireButton
  };
  const button = buttonMap[action];
  if (button) {
    button.disabled = true;
    button.textContent = action === 'confirmed' ? 'Confirming' : action === 'revoked' ? 'Revoking' : 'Expiring';
  }
  try {
    if (!state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts.length) {
      await fetchAuditEvidenceCaseBundleDeliveryFinalApprovalReceipts();
    }
    const latest = state.auditEvidenceCaseBundleDeliveryFinalApprovalReceipts[0];
    if (!latest) {
      els.auditEvidenceChain.textContent = 'No final approval receipt to review.';
      return null;
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        final_approval_receipt_hash: latest.receipt_hash,
        action,
        note: `ops dashboard ${action} lifecycle review`
      })
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery final approval lifecycle returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.review_receipt) {
      state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews = [
        payload.review_receipt,
        ...state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews.filter(
          (receipt) => receipt.id !== payload.review_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded final lifecycle ${payload.review_receipt?.lifecycle_status || action}` +
      ` · final ${String(payload.review_receipt?.final_approval_receipt_hash || '').slice(0, 12)}` +
      ` · receipt ${String(payload.review_receipt?.receipt_hash || '').slice(0, 12)}` +
      ` · delivery disabled`;
    return payload.review_receipt;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = action === 'confirmed' ? 'Confirm final' : action === 'revoked' ? 'Revoke final' : 'Expire final';
    }
  }
}

async function fetchAuditEvidenceCaseBundleDeliveryFinalApprovalReviews() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-reviews?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery final approval lifecycle returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews = payload.review_receipts || [];
  const latest = state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest final lifecycle ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.lifecycle_status}` +
      ` · final ${String(latest.final_approval_receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}`
    : 'No final approval lifecycle receipts yet';
  return state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews;
}

async function exportLatestAuditEvidenceCaseBundleDeliveryFinalApprovalReview() {
  if (!state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews.length) {
    await fetchAuditEvidenceCaseBundleDeliveryFinalApprovalReviews();
  }
  const latest = state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final lifecycle receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-reviews/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery final approval lifecycle JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-approval-lifecycle-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded final lifecycle receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.lifecycle_status}`;
}

async function createAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGate() {
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateButton.disabled = true;
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestReview = state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews[0];
    if (!params.get('receipt_hash') && latestReview?.receipt_hash) {
      params.set('receipt_hash', latestReview.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery final approval policy gate returned ${response.status}`);
    }
    const payload = await response.json();
    const gate = payload.policy_gate || null;
    state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGate = gate;
    els.auditEvidenceChain.textContent = gate
      ? `Policy gate ${gate.decision}` +
        ` · ${gate.policy_status}` +
        ` · ${gate.reason}` +
        ` · ${gate.can_prepare_delivery ? 'prepare ready' : 'blocked'}` +
        ` · final ${String(gate.selected_final_approval_receipt?.receipt_hash || '').slice(0, 12)}` +
        ` · lifecycle ${String(gate.latest_lifecycle_review?.receipt_hash || '').slice(0, 12)}`
      : 'No final approval policy gate generated';
    return gate;
  } finally {
    els.auditCaseBundleDeliveryFinalApprovalPolicyGateButton.disabled = false;
    els.auditCaseBundleDeliveryFinalApprovalPolicyGateButton.textContent = 'Policy gate';
  }
}

async function recordAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipt() {
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton.disabled = true;
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestReview = state.auditEvidenceCaseBundleDeliveryFinalApprovalReviews[0];
    if (!params.get('receipt_hash') && latestReview?.receipt_hash) {
      params.set('receipt_hash', latestReview.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle delivery final approval policy gate receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.policy_gate_receipt) {
      state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts = [
        payload.policy_gate_receipt,
        ...state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts.filter(
          (receipt) => receipt.id !== payload.policy_gate_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded policy gate ${payload.policy_gate_receipt?.decision || 'deny'}` +
      ` · ${payload.policy_gate_receipt?.policy_status || 'needs_lifecycle_review'}` +
      ` · ${payload.policy_gate_receipt?.reason || 'missing_final_approval_lifecycle_review'}` +
      ` · receipt ${String(payload.policy_gate_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.policy_gate_receipt;
  } finally {
    els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton.disabled = false;
    els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton.textContent = 'Record policy';
  }
}

async function fetchAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery final approval policy gate receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts = payload.policy_gate_receipts || [];
  const latest = state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest policy receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.policy_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_prepare_delivery ? 'prepare ready' : 'blocked'}`
    : 'No final approval policy gate receipts yet';
  return state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts;
}

async function exportLatestAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipt() {
  if (!state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts.length) {
    await fetchAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts();
  }
  const latest = state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final approval policy gate receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle delivery final approval policy gate JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-approval-policy-gate-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded policy gate receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.policy_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryDryRunLock() {
  els.auditCaseBundleFinalDeliveryDryRunLockButton.disabled = true;
  els.auditCaseBundleFinalDeliveryDryRunLockButton.textContent = 'Locking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestPolicyGate = state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts[0];
    if (!params.get('receipt_hash') && latestPolicyGate?.receipt_hash) {
      params.set('receipt_hash', latestPolicyGate.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery dry-run lock returned ${response.status}`);
    }
    const payload = await response.json();
    const lock = payload.dry_run_lock || null;
    state.auditEvidenceCaseBundleFinalDeliveryDryRunLock = lock;
    els.auditEvidenceChain.textContent = lock
      ? `Dry-run lock ${lock.decision}` +
        ` · ${lock.lock_status}` +
        ` · ${lock.reason}` +
        ` · ${lock.can_prepare_delivery ? 'release lock prepared' : 'blocked'}` +
        ` · policy ${String(lock.policy_gate_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery dry-run lock generated';
    return lock;
  } finally {
    els.auditCaseBundleFinalDeliveryDryRunLockButton.disabled = false;
    els.auditCaseBundleFinalDeliveryDryRunLockButton.textContent = 'Dry-run lock';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryDryRunLockReceipt() {
  els.auditCaseBundleFinalDeliveryDryRunLockReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryDryRunLockReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestPolicyGate = state.auditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts[0];
    if (!params.get('receipt_hash') && latestPolicyGate?.receipt_hash) {
      params.set('receipt_hash', latestPolicyGate.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery dry-run lock receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.dry_run_lock_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts = [
        payload.dry_run_lock_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts.filter(
          (receipt) => receipt.id !== payload.dry_run_lock_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded dry-run lock ${payload.dry_run_lock_receipt?.decision || 'block'}` +
      ` · ${payload.dry_run_lock_receipt?.lock_status || 'missing_policy_gate'}` +
      ` · ${payload.dry_run_lock_receipt?.reason || 'missing_final_approval_policy_gate_receipt'}` +
      ` · receipt ${String(payload.dry_run_lock_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.dry_run_lock_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryDryRunLockReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryDryRunLockReceiptButton.textContent = 'Record lock';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery dry-run lock receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts = payload.dry_run_lock_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest dry-run lock receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.lock_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_prepare_delivery ? 'release lock prepared' : 'blocked'}`
    : 'No final delivery dry-run lock receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryDryRunLockReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery dry-run lock receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery dry-run lock JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-dry-run-lock-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded dry-run lock receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.lock_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryRehearsal() {
  els.auditCaseBundleFinalDeliveryRehearsalButton.disabled = true;
  els.auditCaseBundleFinalDeliveryRehearsalButton.textContent = 'Rehearsing';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestLock = state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts[0];
    if (!params.get('receipt_hash') && latestLock?.receipt_hash) {
      params.set('receipt_hash', latestLock.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery rehearsal returned ${response.status}`);
    }
    const payload = await response.json();
    const rehearsal = payload.rehearsal || null;
    state.auditEvidenceCaseBundleFinalDeliveryRehearsal = rehearsal;
    els.auditEvidenceChain.textContent = rehearsal
      ? `Rehearsal ${rehearsal.decision}` +
        ` · ${rehearsal.rehearsal_status}` +
        ` · ${rehearsal.reason}` +
        ` · ${rehearsal.can_execute_dry_run ? 'dry-run executable' : 'blocked'}` +
        ` · lock ${String(rehearsal.dry_run_lock_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery rehearsal generated';
    return rehearsal;
  } finally {
    els.auditCaseBundleFinalDeliveryRehearsalButton.disabled = false;
    els.auditCaseBundleFinalDeliveryRehearsalButton.textContent = 'Rehearsal';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryRehearsalReceipt() {
  els.auditCaseBundleFinalDeliveryRehearsalReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryRehearsalReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestLock = state.auditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts[0];
    if (!params.get('receipt_hash') && latestLock?.receipt_hash) {
      params.set('receipt_hash', latestLock.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery rehearsal receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.rehearsal_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts = [
        payload.rehearsal_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts.filter(
          (receipt) => receipt.id !== payload.rehearsal_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded rehearsal ${payload.rehearsal_receipt?.decision || 'block'}` +
      ` · ${payload.rehearsal_receipt?.rehearsal_status || 'missing_dry_run_lock'}` +
      ` · ${payload.rehearsal_receipt?.reason || 'missing_final_delivery_dry_run_lock_receipt'}` +
      ` · receipt ${String(payload.rehearsal_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.rehearsal_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryRehearsalReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryRehearsalReceiptButton.textContent = 'Record rehearsal';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryRehearsalReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery rehearsal receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts = payload.rehearsal_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest rehearsal receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.rehearsal_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_execute_dry_run ? 'dry-run executable' : 'blocked'}`
    : 'No final delivery rehearsal receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryRehearsalReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryRehearsalReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery rehearsal receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery rehearsal JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-rehearsal-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded rehearsal receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.rehearsal_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryDualControlApproval() {
  els.auditCaseBundleFinalDeliveryDualControlApprovalButton.disabled = true;
  els.auditCaseBundleFinalDeliveryDualControlApprovalButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRehearsal = state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts[0];
    if (!params.get('receipt_hash') && latestRehearsal?.receipt_hash) {
      params.set('receipt_hash', latestRehearsal.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery dual-control approval returned ${response.status}`);
    }
    const payload = await response.json();
    const approval = payload.dual_control_approval || null;
    state.auditEvidenceCaseBundleFinalDeliveryDualControlApproval = approval;
    els.auditEvidenceChain.textContent = approval
      ? `Dual approval ${approval.decision}` +
        ` · ${approval.approval_status}` +
        ` · ${approval.reason}` +
        ` · ${approval.can_release_after_dual_control ? 'internally approved' : 'blocked'}` +
        ` · rehearsal ${String(approval.rehearsal_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery dual-control approval generated';
    return approval;
  } finally {
    els.auditCaseBundleFinalDeliveryDualControlApprovalButton.disabled = false;
    els.auditCaseBundleFinalDeliveryDualControlApprovalButton.textContent = 'Dual approval';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipt() {
  els.auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRehearsal = state.auditEvidenceCaseBundleFinalDeliveryRehearsalReceipts[0];
    if (!params.get('receipt_hash') && latestRehearsal?.receipt_hash) {
      params.set('receipt_hash', latestRehearsal.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery dual-control approval receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.dual_control_approval_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts = [
        payload.dual_control_approval_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts.filter(
          (receipt) => receipt.id !== payload.dual_control_approval_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded dual approval ${payload.dual_control_approval_receipt?.decision || 'block'}` +
      ` · ${payload.dual_control_approval_receipt?.approval_status || 'missing_rehearsal'}` +
      ` · ${payload.dual_control_approval_receipt?.reason || 'missing_final_delivery_rehearsal_receipt'}` +
      ` · receipt ${String(payload.dual_control_approval_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.dual_control_approval_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton.textContent = 'Record dual';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery dual-control approval receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts = payload.dual_control_approval_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest dual approval receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.approval_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_release_after_dual_control ? 'internally approved' : 'blocked'}`
    : 'No final delivery dual-control approval receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery dual-control approval receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery dual-control approval JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-dual-control-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded dual approval receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.approval_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryReadinessSeal() {
  els.auditCaseBundleFinalDeliveryReadinessSealButton.disabled = true;
  els.auditCaseBundleFinalDeliveryReadinessSealButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestApproval = state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts[0];
    if (!params.get('receipt_hash') && latestApproval?.receipt_hash) {
      params.set('receipt_hash', latestApproval.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery readiness seal returned ${response.status}`);
    }
    const payload = await response.json();
    const seal = payload.readiness_seal || null;
    state.auditEvidenceCaseBundleFinalDeliveryReadinessSeal = seal;
    els.auditEvidenceChain.textContent = seal
      ? `Readiness seal ${seal.decision}` +
        ` · ${seal.seal_status}` +
        ` · ${seal.reason}` +
        ` · ${seal.can_handoff_to_operator ? 'operator handoff ready' : 'blocked'}` +
        ` · dual ${String(seal.dual_control_approval_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery readiness seal generated';
    return seal;
  } finally {
    els.auditCaseBundleFinalDeliveryReadinessSealButton.disabled = false;
    els.auditCaseBundleFinalDeliveryReadinessSealButton.textContent = 'Seal ready';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryReadinessSealReceipt() {
  els.auditCaseBundleFinalDeliveryReadinessSealReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryReadinessSealReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestApproval = state.auditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts[0];
    if (!params.get('receipt_hash') && latestApproval?.receipt_hash) {
      params.set('receipt_hash', latestApproval.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery readiness seal receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.readiness_seal_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts = [
        payload.readiness_seal_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts.filter(
          (receipt) => receipt.id !== payload.readiness_seal_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded readiness seal ${payload.readiness_seal_receipt?.decision || 'block'}` +
      ` · ${payload.readiness_seal_receipt?.seal_status || 'missing_dual_control_approval'}` +
      ` · ${payload.readiness_seal_receipt?.reason || 'missing_final_delivery_dual_control_approval_receipt'}` +
      ` · receipt ${String(payload.readiness_seal_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.readiness_seal_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryReadinessSealReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryReadinessSealReceiptButton.textContent = 'Record seal';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery readiness seal receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts = payload.readiness_seal_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest readiness seal ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.seal_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_handoff_to_operator ? 'operator handoff ready' : 'blocked'}`
    : 'No final delivery readiness seal receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryReadinessSealReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery readiness seal receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery readiness seal JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-readiness-seal-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded readiness seal ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.seal_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliverySealedHandoffReview() {
  els.auditCaseBundleFinalDeliverySealedHandoffReviewButton.disabled = true;
  els.auditCaseBundleFinalDeliverySealedHandoffReviewButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestSeal = state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts[0];
    if (!params.get('receipt_hash') && latestSeal?.receipt_hash) {
      params.set('receipt_hash', latestSeal.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery sealed handoff review returned ${response.status}`);
    }
    const payload = await response.json();
    const review = payload.sealed_handoff_review || null;
    state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReview = review;
    els.auditEvidenceChain.textContent = review
      ? `Sealed handoff review ${review.decision}` +
        ` · ${review.review_status}` +
        ` · ${review.reason}` +
        ` · ${review.can_release_commander_signoff ? 'commander signoff ready' : 'blocked'}` +
        ` · seal ${String(review.readiness_seal_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery sealed handoff review generated';
    return review;
  } finally {
    els.auditCaseBundleFinalDeliverySealedHandoffReviewButton.disabled = false;
    els.auditCaseBundleFinalDeliverySealedHandoffReviewButton.textContent = 'Handoff review';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipt() {
  els.auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestSeal = state.auditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts[0];
    if (!params.get('receipt_hash') && latestSeal?.receipt_hash) {
      params.set('receipt_hash', latestSeal.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery sealed handoff review receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.sealed_handoff_review_receipt) {
      state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts = [
        payload.sealed_handoff_review_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts.filter(
          (receipt) => receipt.id !== payload.sealed_handoff_review_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded handoff signoff ${payload.sealed_handoff_review_receipt?.decision || 'block'}` +
      ` · ${payload.sealed_handoff_review_receipt?.review_status || 'missing_readiness_seal'}` +
      ` · ${payload.sealed_handoff_review_receipt?.reason || 'missing_final_delivery_readiness_seal_receipt'}` +
      ` · receipt ${String(payload.sealed_handoff_review_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.sealed_handoff_review_receipt;
  } finally {
    els.auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton.textContent = 'Record signoff';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery sealed handoff review receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts = payload.sealed_handoff_review_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest handoff signoff ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.review_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_release_commander_signoff ? 'commander signoff ready' : 'blocked'}`
    : 'No final delivery sealed handoff review receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery sealed handoff review receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery sealed handoff review JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-sealed-handoff-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded handoff signoff ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.review_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandEscrow() {
  els.auditCaseBundleFinalDeliveryCommandEscrowButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandEscrowButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestSignoff = state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts[0];
    if (!params.get('receipt_hash') && latestSignoff?.receipt_hash) {
      params.set('receipt_hash', latestSignoff.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command escrow returned ${response.status}`);
    }
    const payload = await response.json();
    const escrow = payload.command_escrow || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandEscrow = escrow;
    els.auditEvidenceChain.textContent = escrow
      ? `Command escrow ${escrow.decision}` +
        ` · ${escrow.escrow_status}` +
        ` · ${escrow.reason}` +
        ` · ${escrow.can_seal_release_command ? 'command ready' : 'blocked'}` +
        ` · signoff ${String(escrow.sealed_handoff_review_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command escrow generated';
    return escrow;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandEscrowButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandEscrowButton.textContent = 'Command escrow';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipt() {
  els.auditCaseBundleFinalDeliveryCommandEscrowReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandEscrowReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestSignoff = state.auditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts[0];
    if (!params.get('receipt_hash') && latestSignoff?.receipt_hash) {
      params.set('receipt_hash', latestSignoff.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command escrow receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.command_escrow_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts = [
        payload.command_escrow_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts.filter(
          (receipt) => receipt.id !== payload.command_escrow_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded command escrow ${payload.command_escrow_receipt?.decision || 'block'}` +
      ` · ${payload.command_escrow_receipt?.escrow_status || 'missing_release_commander_signoff'}` +
      ` · ${payload.command_escrow_receipt?.reason || 'missing_final_delivery_sealed_handoff_review_receipt'}` +
      ` · receipt ${String(payload.command_escrow_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.command_escrow_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandEscrowReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandEscrowReceiptButton.textContent = 'Record command';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command escrow receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts = payload.command_escrow_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest command escrow ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.escrow_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_seal_release_command ? 'command ready' : 'blocked'}`
    : 'No final delivery command escrow receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command escrow receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command escrow JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-escrow-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded command escrow ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.escrow_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandRevocation() {
  els.auditCaseBundleFinalDeliveryCommandRevocationButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandRevocationButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestEscrow = state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts[0];
    if (!params.get('receipt_hash') && latestEscrow?.receipt_hash) {
      params.set('receipt_hash', latestEscrow.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command revocation returned ${response.status}`);
    }
    const payload = await response.json();
    const revocation = payload.command_revocation || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandRevocation = revocation;
    els.auditEvidenceChain.textContent = revocation
      ? `Command revocation ${revocation.decision}` +
        ` · ${revocation.revocation_status}` +
        ` · ${revocation.reason}` +
        ` · ${revocation.can_rollback_release_command ? 'rollback recorded' : 'blocked'}` +
        ` · escrow ${String(revocation.command_escrow_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command revocation generated';
    return revocation;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandRevocationButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandRevocationButton.textContent = 'Command revoke';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipt() {
  els.auditCaseBundleFinalDeliveryCommandRevocationReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandRevocationReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestEscrow = state.auditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts[0];
    if (!params.get('receipt_hash') && latestEscrow?.receipt_hash) {
      params.set('receipt_hash', latestEscrow.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command revocation receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.command_revocation_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts = [
        payload.command_revocation_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts.filter(
          (receipt) => receipt.id !== payload.command_revocation_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded command revocation ${payload.command_revocation_receipt?.decision || 'block'}` +
      ` · ${payload.command_revocation_receipt?.revocation_status || 'missing_command_escrow'}` +
      ` · ${payload.command_revocation_receipt?.reason || 'missing_final_delivery_command_escrow_receipt'}` +
      ` · receipt ${String(payload.command_revocation_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.command_revocation_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandRevocationReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandRevocationReceiptButton.textContent = 'Record revoke';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command revocation receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts = payload.command_revocation_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest command revocation ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.revocation_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_rollback_release_command ? 'rollback recorded' : 'blocked'}`
    : 'No final delivery command revocation receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command revocation receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command revocation JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-revocation-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded command revocation ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.revocation_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandClosure() {
  els.auditCaseBundleFinalDeliveryCommandClosureButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandClosureButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRevocation = state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts[0];
    if (!params.get('receipt_hash') && latestRevocation?.receipt_hash) {
      params.set('receipt_hash', latestRevocation.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command closure returned ${response.status}`);
    }
    const payload = await response.json();
    const closure = payload.command_closure || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandClosure = closure;
    els.auditEvidenceChain.textContent = closure
      ? `Command closure ${closure.decision}` +
        ` · ${closure.closure_status}` +
        ` · ${closure.reason}` +
        ` · ${closure.can_reinstate_release_command ? 'reinstatement reviewed' : 'blocked'}` +
        ` · revocation ${String(closure.command_revocation_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command closure generated';
    return closure;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandClosureButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandClosureButton.textContent = 'Rollback close';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandClosureReceipt() {
  els.auditCaseBundleFinalDeliveryCommandClosureReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandClosureReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRevocation = state.auditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts[0];
    if (!params.get('receipt_hash') && latestRevocation?.receipt_hash) {
      params.set('receipt_hash', latestRevocation.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command closure receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.command_closure_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts = [
        payload.command_closure_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts.filter(
          (receipt) => receipt.id !== payload.command_closure_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded command closure ${payload.command_closure_receipt?.decision || 'block'}` +
      ` · ${payload.command_closure_receipt?.closure_status || 'missing_command_revocation'}` +
      ` · ${payload.command_closure_receipt?.reason || 'missing_final_delivery_command_revocation_receipt'}` +
      ` · receipt ${String(payload.command_closure_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.command_closure_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandClosureReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandClosureReceiptButton.textContent = 'Record closure';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command closure receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts = payload.command_closure_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest command closure ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.closure_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_reinstate_release_command ? 'reinstatement reviewed' : 'blocked'}`
    : 'No final delivery command closure receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandClosureReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command closure receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command closure JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-closure-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded command closure ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.closure_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarization() {
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestClosure = state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts[0];
    if (!params.get('receipt_hash') && latestClosure?.receipt_hash) {
      params.set('receipt_hash', latestClosure.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail notarization returned ${response.status}`);
    }
    const payload = await response.json();
    const notarization = payload.trail_notarization || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarization = notarization;
    els.auditEvidenceChain.textContent = notarization
      ? `Trail notarization ${notarization.decision}` +
        ` · ${notarization.notarization_status}` +
        ` · ${notarization.reason}` +
        ` · ${notarization.can_archive_release_trail ? 'trail frozen' : 'blocked'}` +
        ` · closure ${String(notarization.command_closure_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command trail notarization generated';
    return notarization;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailNotarizationButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailNotarizationButton.textContent = 'Trail notarize';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestClosure = state.auditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts[0];
    if (!params.get('receipt_hash') && latestClosure?.receipt_hash) {
      params.set('receipt_hash', latestClosure.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail notarization receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.trail_notarization_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts = [
        payload.trail_notarization_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts.filter(
          (receipt) => receipt.id !== payload.trail_notarization_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded trail notarization ${payload.trail_notarization_receipt?.decision || 'block'}` +
      ` · ${payload.trail_notarization_receipt?.notarization_status || 'missing_command_closure'}` +
      ` · ${payload.trail_notarization_receipt?.reason || 'missing_final_delivery_command_closure_receipt'}` +
      ` · receipt ${String(payload.trail_notarization_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.trail_notarization_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton.textContent = 'Record trail';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail notarization receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts = payload.trail_notarization_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest trail notarization ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.notarization_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_archive_release_trail ? 'trail frozen' : 'blocked'}`
    : 'No final delivery command trail notarization receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail notarization receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail notarization JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-notarization-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded trail notarization ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.notarization_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustody() {
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestTrail = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts[0];
    if (!params.get('receipt_hash') && latestTrail?.receipt_hash) {
      params.set('receipt_hash', latestTrail.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail custody returned ${response.status}`);
    }
    const payload = await response.json();
    const custody = payload.trail_custody || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustody = custody;
    els.auditEvidenceChain.textContent = custody
      ? `Trail custody ${custody.decision}` +
        ` · ${custody.custody_status}` +
        ` · ${custody.reason}` +
        ` · ${custody.can_retain_release_archive ? 'custody locked' : 'blocked'}` +
        ` · trail ${String(custody.trail_notarization_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command trail custody generated';
    return custody;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyButton.textContent = 'Custody lock';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestTrail = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts[0];
    if (!params.get('receipt_hash') && latestTrail?.receipt_hash) {
      params.set('receipt_hash', latestTrail.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail custody receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.trail_custody_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts = [
        payload.trail_custody_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts.filter(
          (receipt) => receipt.id !== payload.trail_custody_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded trail custody ${payload.trail_custody_receipt?.decision || 'block'}` +
      ` · ${payload.trail_custody_receipt?.custody_status || 'missing_trail_notarization'}` +
      ` · ${payload.trail_custody_receipt?.reason || 'missing_final_delivery_command_trail_notarization_receipt'}` +
      ` · receipt ${String(payload.trail_custody_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.trail_custody_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton.textContent = 'Record custody';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail custody receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts = payload.trail_custody_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest trail custody ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.custody_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_retain_release_archive ? 'custody locked' : 'blocked'}`
    : 'No final delivery command trail custody receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail custody receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail custody JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-custody-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded trail custody ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.custody_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestation() {
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestCustody = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts[0];
    if (!params.get('receipt_hash') && latestCustody?.receipt_hash) {
      params.set('receipt_hash', latestCustody.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail retention attestation returned ${response.status}`);
    }
    const payload = await response.json();
    const attestation = payload.retention_attestation || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestation = attestation;
    els.auditEvidenceChain.textContent = attestation
      ? `Retention attestation ${attestation.decision}` +
        ` · ${attestation.attestation_status}` +
        ` · ${attestation.reason}` +
        ` · ${attestation.can_continue_release_archive_retention ? 'retention attested' : 'blocked'}` +
        ` · custody ${String(attestation.trail_custody_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command trail retention attestation generated';
    return attestation;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton.textContent = 'Retention attest';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestCustody = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts[0];
    if (!params.get('receipt_hash') && latestCustody?.receipt_hash) {
      params.set('receipt_hash', latestCustody.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail retention attestation receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.retention_attestation_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts = [
        payload.retention_attestation_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts.filter(
          (receipt) => receipt.id !== payload.retention_attestation_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded retention attestation ${payload.retention_attestation_receipt?.decision || 'block'}` +
      ` · ${payload.retention_attestation_receipt?.attestation_status || 'missing_trail_custody'}` +
      ` · ${payload.retention_attestation_receipt?.reason || 'missing_final_delivery_command_trail_custody_receipt'}` +
      ` · receipt ${String(payload.retention_attestation_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.retention_attestation_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton.textContent = 'Record retention';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail retention attestation receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts = payload.retention_attestation_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest retention attestation ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.attestation_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_continue_release_archive_retention ? 'retention attested' : 'blocked'}`
    : 'No final delivery command trail retention attestation receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail retention attestation receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail retention attestation JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-retention-attestation-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded retention attestation ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.attestation_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindow() {
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRetention = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts[0];
    if (!params.get('receipt_hash') && latestRetention?.receipt_hash) {
      params.set('receipt_hash', latestRetention.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail renewal window returned ${response.status}`);
    }
    const payload = await response.json();
    const renewalWindow = payload.renewal_window || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindow = renewalWindow;
    els.auditEvidenceChain.textContent = renewalWindow
      ? `Renewal window ${renewalWindow.decision}` +
        ` · ${renewalWindow.renewal_status}` +
        ` · ${renewalWindow.reason}` +
        ` · ${renewalWindow.can_schedule_next_retention_review ? 'scheduled' : 'blocked'}` +
        ` · retention ${String(renewalWindow.retention_attestation_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command trail renewal window generated';
    return renewalWindow;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton.textContent = 'Renewal guard';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRetention = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts[0];
    if (!params.get('receipt_hash') && latestRetention?.receipt_hash) {
      params.set('receipt_hash', latestRetention.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail renewal window receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.renewal_window_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts = [
        payload.renewal_window_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts.filter(
          (receipt) => receipt.id !== payload.renewal_window_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded renewal window ${payload.renewal_window_receipt?.decision || 'block'}` +
      ` · ${payload.renewal_window_receipt?.renewal_status || 'missing_retention_attestation'}` +
      ` · ${payload.renewal_window_receipt?.reason || 'missing_final_delivery_command_trail_retention_attestation_receipt'}` +
      ` · receipt ${String(payload.renewal_window_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.renewal_window_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton.textContent = 'Record renewal';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail renewal window receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts = payload.renewal_window_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest renewal window ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.renewal_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_schedule_next_retention_review ? 'scheduled' : 'blocked'}`
    : 'No final delivery command trail renewal window receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail renewal window receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail renewal window JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-renewal-window-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded renewal window ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.renewal_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmation() {
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton.textContent = 'Checking';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRenewal = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts[0];
    if (!params.get('receipt_hash') && latestRenewal?.receipt_hash) {
      params.set('receipt_hash', latestRenewal.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail renewal confirmation returned ${response.status}`);
    }
    const payload = await response.json();
    const confirmation = payload.renewal_confirmation || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmation = confirmation;
    els.auditEvidenceChain.textContent = confirmation
      ? `Renewal checkpoint ${confirmation.decision}` +
        ` · ${confirmation.confirmation_status}` +
        ` · ${confirmation.reason}` +
        ` · ${confirmation.can_continue_archive_renewal ? 'confirmed' : 'blocked'}` +
        ` · renewal ${String(confirmation.renewal_window_receipt?.receipt_hash || '').slice(0, 12)}`
      : 'No final delivery command trail renewal confirmation generated';
    return confirmation;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton.textContent = 'Checkpoint confirm';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton.textContent = 'Recording';
  try {
    const params = new URLSearchParams(evidenceChainQuery({ limit: 100 }));
    const latestRenewal = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts[0];
    if (!params.get('receipt_hash') && latestRenewal?.receipt_hash) {
      params.set('receipt_hash', latestRenewal.receipt_hash);
    }
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(params.entries()))
    });
    if (!response.ok) {
      throw new Error(`Evidence case bundle final delivery command trail renewal confirmation receipt returned ${response.status}`);
    }
    const payload = await response.json();
    if (payload.renewal_confirmation_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts = [
        payload.renewal_confirmation_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts.filter(
          (receipt) => receipt.id !== payload.renewal_confirmation_receipt.id
        )
      ].slice(0, 20);
    }
    els.auditEvidenceChain.textContent =
      `Recorded renewal checkpoint ${payload.renewal_confirmation_receipt?.decision || 'block'}` +
      ` · ${payload.renewal_confirmation_receipt?.confirmation_status || 'missing_renewal_window'}` +
      ` · ${payload.renewal_confirmation_receipt?.reason || 'missing_final_delivery_command_trail_renewal_window_receipt'}` +
      ` · receipt ${String(payload.renewal_confirmation_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.renewal_confirmation_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton.textContent = 'Record checkpoint';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-receipts?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail renewal confirmation receipts returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts = payload.renewal_confirmation_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest renewal checkpoint ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.decision}` +
      ` · ${latest.confirmation_status}` +
      ` · ${latest.reason}` +
      ` · ${latest.can_continue_archive_renewal ? 'confirmed' : 'blocked'}`
    : 'No final delivery command trail renewal confirmation receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail renewal confirmation receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle final delivery command trail renewal confirmation JSON returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-renewal-confirmation-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded renewal checkpoint ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.confirmation_status}`;
}


async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSeal() {
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton.textContent = 'Sealing';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail checkpoint seal returned ${response.status}`);
    const payload = await response.json();
    const seal = payload.checkpoint_seal || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSeal = seal;
    els.auditEvidenceChain.textContent = seal
      ? `Checkpoint seal ${seal.decision || 'block'} · ${seal.seal_status || 'missing_renewal_confirmation'} · ${seal.reason || 'missing_final_delivery_command_trail_renewal_confirmation_receipt'}`
      : 'No final delivery command trail checkpoint seal generated';
    return seal;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton.textContent = 'Seal checkpoint';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton.textContent = 'Recording';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-receipts', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail checkpoint seal receipt returned ${response.status}`);
    const payload = await response.json();
    if (payload.checkpoint_seal_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts = [
        payload.checkpoint_seal_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts.filter((receipt) => receipt.id !== payload.checkpoint_seal_receipt.id)
      ];
    }
    els.auditEvidenceChain.textContent =
      `Recorded checkpoint seal ${payload.checkpoint_seal_receipt?.decision || 'block'}` +
      ` · ${payload.checkpoint_seal_receipt?.seal_status || 'missing_renewal_confirmation'}` +
      ` · ${payload.checkpoint_seal_receipt?.reason || 'missing_final_delivery_command_trail_renewal_confirmation_receipt'}` +
      ` · receipt ${String(payload.checkpoint_seal_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.checkpoint_seal_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton.textContent = 'Record seal';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-receipts?limit=20&decision=seal', { headers: authHeaders() });
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail checkpoint seal receipts returned ${response.status}`);
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts = payload.checkpoint_seal_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest checkpoint seal ${latest.decision || 'block'} · ${latest.seal_status || 'missing_renewal_confirmation'} · ${String(latest.receipt_hash || '').slice(0, 12)}`
    : 'No final delivery command trail checkpoint seal receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail checkpoint seal receipt to export.';
    return;
  }
  const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`);
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail checkpoint seal JSON returned ${response.status}`);
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-checkpoint-seal-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded checkpoint seal ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.seal_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoff() {
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton.textContent = 'Handing off';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody handoff returned ${response.status}`);
    const payload = await response.json();
    const handoff = payload.custody_handoff || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoff = handoff;
    els.auditEvidenceChain.textContent = handoff
      ? `Custody handoff ${handoff.decision || 'block'} · ${handoff.handoff_status || 'missing_checkpoint_seal'} · ${handoff.reason || 'missing_final_delivery_command_trail_checkpoint_seal_receipt'}`
      : 'No final delivery command trail custody handoff generated';
    return handoff;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton.textContent = 'Custody handoff';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton.textContent = 'Recording';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-receipts', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody handoff receipt returned ${response.status}`);
    const payload = await response.json();
    if (payload.custody_handoff_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts = [
        payload.custody_handoff_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts.filter((receipt) => receipt.id !== payload.custody_handoff_receipt.id)
      ];
    }
    els.auditEvidenceChain.textContent =
      `Recorded custody handoff ${payload.custody_handoff_receipt?.decision || 'block'}` +
      ` · ${payload.custody_handoff_receipt?.handoff_status || 'missing_checkpoint_seal'}` +
      ` · ${payload.custody_handoff_receipt?.reason || 'missing_final_delivery_command_trail_checkpoint_seal_receipt'}` +
      ` · receipt ${String(payload.custody_handoff_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.custody_handoff_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton.textContent = 'Record handoff';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-receipts?limit=20&decision=handoff', { headers: authHeaders() });
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody handoff receipts returned ${response.status}`);
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts = payload.custody_handoff_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest custody handoff ${latest.decision || 'block'} · ${latest.handoff_status || 'missing_checkpoint_seal'} · ${String(latest.receipt_hash || '').slice(0, 12)}`
    : 'No final delivery command trail custody handoff receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail custody handoff receipt to export.';
    return;
  }
  const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`);
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody handoff JSON returned ${response.status}`);
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-custody-handoff-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded custody handoff ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.handoff_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrow() {
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton.textContent = 'Escrowing';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail archive escrow returned ${response.status}`);
    const payload = await response.json();
    const escrow = payload.archive_escrow || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrow = escrow;
    els.auditEvidenceChain.textContent = escrow
      ? `Archive escrow ${escrow.decision || 'block'} · ${escrow.escrow_status || 'missing_custody_handoff'} · ${escrow.reason || 'missing_final_delivery_command_trail_custody_handoff_receipt'}`
      : 'No final delivery command trail archive escrow generated';
    return escrow;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton.textContent = 'Archive escrow';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton.textContent = 'Recording';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-receipts', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail archive escrow receipt returned ${response.status}`);
    const payload = await response.json();
    if (payload.archive_escrow_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts = [
        payload.archive_escrow_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts.filter((receipt) => receipt.id !== payload.archive_escrow_receipt.id)
      ];
    }
    els.auditEvidenceChain.textContent =
      `Recorded archive escrow ${payload.archive_escrow_receipt?.decision || 'block'}` +
      ` · ${payload.archive_escrow_receipt?.escrow_status || 'missing_custody_handoff'}` +
      ` · ${payload.archive_escrow_receipt?.reason || 'missing_final_delivery_command_trail_custody_handoff_receipt'}` +
      ` · receipt ${String(payload.archive_escrow_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.archive_escrow_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton.textContent = 'Record escrow';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-receipts?limit=20&decision=escrow', { headers: authHeaders() });
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail archive escrow receipts returned ${response.status}`);
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts = payload.archive_escrow_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest archive escrow ${latest.decision || 'block'} · ${latest.escrow_status || 'missing_custody_handoff'} · ${String(latest.receipt_hash || '').slice(0, 12)}`
    : 'No final delivery command trail archive escrow receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail archive escrow receipt to export.';
    return;
  }
  const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`);
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail archive escrow JSON returned ${response.status}`);
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-archive-escrow-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded archive escrow ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.escrow_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSeal() {
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton.textContent = 'Sealing';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail evidence seal returned ${response.status}`);
    const payload = await response.json();
    const seal = payload.evidence_seal || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSeal = seal;
    els.auditEvidenceChain.textContent = seal
      ? `Evidence seal ${seal.decision || 'block'} · ${seal.seal_status || 'missing_archive_escrow'} · ${seal.reason || 'missing_final_delivery_command_trail_archive_escrow_receipt'}`
      : 'No final delivery command trail evidence seal generated';
    return seal;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton.textContent = 'Evidence seal';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton.textContent = 'Recording';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-receipts', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail evidence seal receipt returned ${response.status}`);
    const payload = await response.json();
    if (payload.evidence_seal_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts = [
        payload.evidence_seal_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts.filter((receipt) => receipt.id !== payload.evidence_seal_receipt.id)
      ];
    }
    els.auditEvidenceChain.textContent =
      `Recorded evidence seal ${payload.evidence_seal_receipt?.decision || 'block'}` +
      ` · ${payload.evidence_seal_receipt?.seal_status || 'missing_archive_escrow'}` +
      ` · ${payload.evidence_seal_receipt?.reason || 'missing_final_delivery_command_trail_archive_escrow_receipt'}` +
      ` · receipt ${String(payload.evidence_seal_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.evidence_seal_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton.textContent = 'Record evidence';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-receipts?limit=20&decision=seal', { headers: authHeaders() });
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail evidence seal receipts returned ${response.status}`);
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts = payload.evidence_seal_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest evidence seal ${latest.decision || 'block'} · ${latest.seal_status || 'missing_archive_escrow'} · ${String(latest.receipt_hash || '').slice(0, 12)}`
    : 'No final delivery command trail evidence seal receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail evidence seal receipt to export.';
    return;
  }
  const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`);
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail evidence seal JSON returned ${response.status}`);
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-evidence-seal-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded evidence seal ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.seal_status}`;
}

async function createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpoint() {
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton.textContent = 'Checkpointing';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody checkpoint returned ${response.status}`);
    const payload = await response.json();
    const checkpoint = payload.custody_checkpoint || null;
    state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpoint = checkpoint;
    els.auditEvidenceChain.textContent = checkpoint
      ? `Custody checkpoint ${checkpoint.decision || 'block'} · ${checkpoint.checkpoint_status || 'missing_evidence_seal'} · ${checkpoint.reason || 'missing_final_delivery_command_trail_evidence_seal_receipt'}`
      : 'No final delivery command trail custody checkpoint generated';
    return checkpoint;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton.textContent = 'Custody checkpoint';
  }
}

async function recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt() {
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton.disabled = true;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton.textContent = 'Recording';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-receipts', {
      method: 'POST',
      headers: { ...authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(auditFilterPayload())
    });
    if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody checkpoint receipt returned ${response.status}`);
    const payload = await response.json();
    if (payload.custody_checkpoint_receipt) {
      state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts = [
        payload.custody_checkpoint_receipt,
        ...state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts.filter((receipt) => receipt.id !== payload.custody_checkpoint_receipt.id)
      ];
    }
    els.auditEvidenceChain.textContent =
      `Recorded custody checkpoint ${payload.custody_checkpoint_receipt?.decision || 'block'}` +
      ` · ${payload.custody_checkpoint_receipt?.checkpoint_status || 'missing_evidence_seal'}` +
      ` · ${payload.custody_checkpoint_receipt?.reason || 'missing_final_delivery_command_trail_evidence_seal_receipt'}` +
      ` · receipt ${String(payload.custody_checkpoint_receipt?.receipt_hash || '').slice(0, 12)}`;
    return payload.custody_checkpoint_receipt;
  } finally {
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton.disabled = false;
    els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton.textContent = 'Record custody';
  }
}

async function fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-receipts?limit=20&decision=checkpoint', { headers: authHeaders() });
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody checkpoint receipts returned ${response.status}`);
  const payload = await response.json();
  state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts = payload.custody_checkpoint_receipts || [];
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest custody checkpoint ${latest.decision || 'block'} · ${latest.checkpoint_status || 'missing_evidence_seal'} · ${String(latest.receipt_hash || '').slice(0, 12)}`
    : 'No final delivery command trail custody checkpoint receipts yet';
  return state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts;
}

async function exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt() {
  if (!state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts.length) {
    await fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts();
  }
  const latest = state.auditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No final delivery command trail custody checkpoint receipt to export.';
    return;
  }
  const response = await fetch(`/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`);
  if (!response.ok) throw new Error(`Evidence case bundle final delivery command trail custody checkpoint JSON returned ${response.status}`);
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-final-delivery-command-trail-custody-checkpoint-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded custody checkpoint ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.decision}` +
    ` · ${latest.checkpoint_status}`;
}

async function exportLatestAuditEvidenceCaseBundleExportReviewReceipt() {
  if (!state.auditEvidenceCaseBundleExportReviews.length) {
    await fetchAuditEvidenceCaseBundleExportReviews();
  }
  const latest = state.auditEvidenceCaseBundleExportReviews[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No bundle export review receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-export-reviews/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle export review receipt returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-export-review-receipt-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Downloaded bundle export review receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · export ${String(latest.bundle_export_receipt_hash || '').slice(0, 12)}`;
}

async function fetchAuditEvidenceCaseBundleVerifications() {
  const response = await fetch('/internal/ops/audit-evidence-case-packet-bundle-verifications?limit=20');
  if (!response.ok) {
    throw new Error(`Evidence case bundle verifications returned ${response.status}`);
  }
  const payload = await response.json();
  state.auditEvidenceCaseBundleVerifications = payload.verifications || [];
  const latest = state.auditEvidenceCaseBundleVerifications[0];
  els.auditEvidenceChain.textContent = latest
    ? `Latest bundle receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
      ` · ${latest.valid ? 'valid' : 'failed'}` +
      ` · ${latest.verifier}` +
      ` · manifest ${String(latest.bundle_manifest_hash || '').slice(0, 12)}`
    : 'No bundle verification receipts yet';
  return state.auditEvidenceCaseBundleVerifications;
}

async function exportLatestAuditEvidenceCaseBundleVerificationReceipt() {
  if (!state.auditEvidenceCaseBundleVerifications.length) {
    await fetchAuditEvidenceCaseBundleVerifications();
  }
  const latest = state.auditEvidenceCaseBundleVerifications[0];
  if (!latest) {
    els.auditEvidenceChain.textContent = 'No bundle verification receipt to export.';
    return;
  }
  const response = await fetch(
    `/internal/ops/audit-evidence-case-packet-bundle-verifications/${latest.receipt_hash}?format=receipt`
  );
  if (!response.ok) {
    throw new Error(`Evidence case bundle verification receipt returned ${response.status}`);
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.receipt || {}, null, 2),
    type: 'application/json',
    filename: `ops-audit-case-bundle-verification-receipt-${String(latest.receipt_hash || 'latest').slice(0, 12)}.json`
  });
  els.auditEvidenceChain.textContent =
    `Exported bundle receipt ${String(latest.receipt_hash || '').slice(0, 12)}` +
    ` · ${latest.valid ? 'valid' : 'failed'}`;
}

async function exportAuditNotificationReplayWorkload() {
  const workload = state.auditNotificationReplayWorkload || await fetchAuditNotificationReplayWorkload();
  downloadBlob({
    content: JSON.stringify(workload, null, 2),
    type: 'application/json',
    filename: auditReplayWorkloadFilename('json')
  });
}

async function exportAuditNotificationReplayEscalationReport(format) {
  const params = new URLSearchParams({ limit: '100', due_soon_hours: '4' });
  const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
  if (assignedReviewer) params.set('assigned_reviewer', assignedReviewer);
  if (format === 'html') params.set('format', 'html');
  const response = await fetch(`/internal/ops/audit-notification-replay-escalation-report?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Replay escalation report returned ${response.status}`);
  }
  if (format === 'html') {
    downloadBlob({
      content: await response.text(),
      type: 'text/html',
      filename: auditReplayWorkloadFilename('html')
    });
    return;
  }
  const payload = await response.json();
  downloadBlob({
    content: JSON.stringify(payload.report, null, 2),
    type: 'application/json',
    filename: auditReplayWorkloadFilename('json')
  });
}

async function exportAuditNotificationReplayPerformanceReport(format) {
  const params = new URLSearchParams({ limit: '100', due_soon_hours: '4' });
  const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
  if (assignedReviewer) params.set('assigned_reviewer', assignedReviewer);
  if (format === 'html') params.set('format', 'html');
  const response = await fetch(`/internal/ops/audit-notification-replay-performance-report?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Replay performance report returned ${response.status}`);
  }
  if (format === 'html') {
    downloadBlob({
      content: await response.text(),
      type: 'text/html',
      filename: auditReplayPerformanceFilename('html')
    });
    return;
  }
  const payload = await response.json();
  state.auditNotificationReplayPerformanceReport = payload.report;
  downloadBlob({
    content: JSON.stringify(payload.report, null, 2),
    type: 'application/json',
    filename: auditReplayPerformanceFilename('json')
  });
}

async function saveAuditReplayThresholds() {
  els.auditReplayThresholdSaveButton.disabled = true;
  els.auditReplayThresholdSaveButton.textContent = 'Saving';
  try {
    const payload = {
      max_expired_backlog_count: Number(els.auditReplayThresholdExpiredInput.value || 0),
      max_near_expiry_backlog_count: Number(els.auditReplayThresholdNearInput.value || 0),
      max_average_review_minutes: Number(els.auditReplayThresholdReviewInput.value || 1)
    };
    const response = await fetch('/internal/ops/audit-notification-replay-performance-thresholds', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || result.error || `Replay SLA thresholds returned ${response.status}`);
    }
    state.auditNotificationReplayPerformanceThresholdPolicy = result.policy;
    state.auditNotificationReplayPerformanceReport = await fetchAuditNotificationReplayPerformanceReport();
    renderAuditReplayThresholds();
  } finally {
    els.auditReplayThresholdSaveButton.disabled = false;
    els.auditReplayThresholdSaveButton.textContent = 'Save SLA thresholds';
  }
}

async function generateAuditReplaySlaAlerts() {
  els.auditReplaySlaAlertGenerateButton.disabled = true;
  els.auditReplaySlaAlertGenerateButton.textContent = 'Routing';
  try {
    const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alerts/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        due_soon_hours: 4,
        assigned_reviewer: assignedReviewer || undefined
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA alert routing returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlerts = [
      ...(payload.generation?.alerts || []),
      ...state.auditNotificationReplaySlaAlerts
    ].filter((alert, index, list) => list.findIndex((item) => item.id === alert.id) === index).slice(0, 50);
    renderAuditReplaySlaAlerts();
  } finally {
    els.auditReplaySlaAlertGenerateButton.disabled = false;
    els.auditReplaySlaAlertGenerateButton.textContent = 'Route SLA alerts';
  }
}

async function saveAuditReplaySlaSchedule() {
  els.auditReplaySlaScheduleSaveButton.disabled = true;
  els.auditReplaySlaScheduleSaveButton.textContent = 'Saving';
  try {
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-schedule', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        interval_minutes: Number(els.auditReplaySlaScheduleIntervalInput.value || 60),
        due_soon_hours: Number(els.auditReplaySlaScheduleDueSoonInput.value || 4),
        alert_limit: 100
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA schedule returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlertSchedule = payload.schedule;
    renderAuditReplaySlaAlertSchedule();
  } finally {
    els.auditReplaySlaScheduleSaveButton.disabled = false;
    els.auditReplaySlaScheduleSaveButton.textContent = 'Save SLA schedule';
  }
}

async function runAuditReplaySlaSchedule() {
  els.auditReplaySlaScheduleRunButton.disabled = true;
  els.auditReplaySlaScheduleRunButton.textContent = 'Running';
  try {
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-schedule/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA schedule run returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlertSchedule = payload.run?.schedule || state.auditNotificationReplaySlaAlertSchedule;
    state.auditNotificationReplaySlaAlerts = await fetchAuditNotificationReplaySlaAlerts();
    renderAuditReplaySlaAlertSchedule();
    renderAuditReplaySlaAlerts();
  } finally {
    els.auditReplaySlaScheduleRunButton.disabled = false;
    els.auditReplaySlaScheduleRunButton.textContent = 'Run SLA schedule';
  }
}

async function generateAuditReplaySlaDigest() {
  els.auditReplaySlaDigestGenerateButton.disabled = true;
  els.auditReplaySlaDigestGenerateButton.textContent = 'Generating';
  try {
    const assignedReviewer = els.auditNotificationAssignedReviewerInput?.value?.trim() || '';
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        reviewer: assignedReviewer || undefined
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA digest returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlertDigests = [
      payload.digest,
      ...state.auditNotificationReplaySlaAlertDigests
    ].filter((digest, index, list) => list.findIndex((item) => item.id === digest.id) === index).slice(0, 10);
    renderAuditReplaySlaAlertDigests();
  } finally {
    els.auditReplaySlaDigestGenerateButton.disabled = false;
    els.auditReplaySlaDigestGenerateButton.textContent = 'Generate SLA digest';
  }
}

function openLatestAuditReplaySlaDigestHtml() {
  const latest = state.auditNotificationReplaySlaAlertDigests[0];
  if (!latest) {
    els.auditReplaySlaDigestStatus.textContent = 'Generate a replay SLA digest first.';
    return;
  }
  window.open(`/internal/ops/audit-notification-replay-sla-alert-digests/${latest.id}?format=html`, '_blank', 'noopener');
}

async function saveAuditReplaySlaDigestSchedule() {
  els.auditReplaySlaDigestScheduleSaveButton.disabled = true;
  els.auditReplaySlaDigestScheduleSaveButton.textContent = 'Saving';
  try {
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digest-schedule', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        interval_minutes: Number(els.auditReplaySlaDigestScheduleIntervalInput.value || 1440),
        retention_days: Number(els.auditReplaySlaDigestRetentionInput.value || 90),
        alert_limit: 100
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA digest schedule returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlertDigestSchedule = payload.schedule;
    renderAuditReplaySlaAlertDigestSchedule();
  } finally {
    els.auditReplaySlaDigestScheduleSaveButton.disabled = false;
    els.auditReplaySlaDigestScheduleSaveButton.textContent = 'Save digest schedule';
  }
}

async function runAuditReplaySlaDigestSchedule() {
  els.auditReplaySlaDigestScheduleRunButton.disabled = true;
  els.auditReplaySlaDigestScheduleRunButton.textContent = 'Running';
  try {
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digest-schedule/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA digest schedule run returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlertDigestSchedule = payload.run?.schedule || state.auditNotificationReplaySlaAlertDigestSchedule;
    state.auditNotificationReplaySlaAlertDigests = await fetchAuditNotificationReplaySlaAlertDigests();
    renderAuditReplaySlaAlertDigestSchedule();
    renderAuditReplaySlaAlertDigests();
  } finally {
    els.auditReplaySlaDigestScheduleRunButton.disabled = false;
    els.auditReplaySlaDigestScheduleRunButton.textContent = 'Run digest schedule';
  }
}

async function pruneAuditReplaySlaDigests() {
  els.auditReplaySlaDigestPruneButton.disabled = true;
  els.auditReplaySlaDigestPruneButton.textContent = 'Pruning';
  try {
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digest-schedule/prune', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        execute: false,
        retention_days: Number(els.auditReplaySlaDigestRetentionInput.value || 90)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA digest prune returned ${response.status}`);
    }
    if (payload.prune?.receipt) {
      state.auditNotificationReplaySlaAlertDigestRetentionReceipts = [
        payload.prune.receipt,
        ...state.auditNotificationReplaySlaAlertDigestRetentionReceipts
      ].filter((receipt, index, list) => list.findIndex((item) => item.id === receipt.id) === index).slice(0, 5);
      renderAuditReplaySlaAlertDigestRetentionReceipts();
    }
    els.auditReplaySlaDigestScheduleStatus.textContent =
      `Replay SLA digest prune plan · eligible ${payload.prune?.eligible_count || 0}` +
      ` · retained ${payload.prune?.retained_count || 0}` +
      ` · receipt ${String(payload.prune?.receipt_hash || '').slice(0, 12)}` +
      ` · retain ${payload.prune?.retention_days || 90}d`;
  } finally {
    els.auditReplaySlaDigestPruneButton.disabled = false;
    els.auditReplaySlaDigestPruneButton.textContent = 'Prune digests';
  }
}

async function createAuditReplaySlaDigestRetentionReceipt() {
  els.auditReplaySlaDigestReceiptButton.disabled = true;
  els.auditReplaySlaDigestReceiptButton.textContent = 'Verifying';
  try {
    const response = await fetch('/internal/ops/audit-notification-replay-sla-alert-digest-retention-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        retention_days: Number(els.auditReplaySlaDigestRetentionInput.value || 90)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA digest retention receipt returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlertDigestRetentionReceipts = [
      payload.receipt,
      ...state.auditNotificationReplaySlaAlertDigestRetentionReceipts
    ].filter((receipt, index, list) => list.findIndex((item) => item.id === receipt.id) === index).slice(0, 5);
    renderAuditReplaySlaAlertDigestRetentionReceipts();
    window.open(
      `/internal/ops/audit-notification-replay-sla-alert-digest-retention-receipts/${payload.receipt.id}?format=receipt`,
      '_blank',
      'noopener'
    );
  } finally {
    els.auditReplaySlaDigestReceiptButton.disabled = false;
    els.auditReplaySlaDigestReceiptButton.textContent = 'Retention receipt';
  }
}

function latestOpenReplaySlaAlert() {
  return state.auditNotificationReplaySlaAlerts.find((alert) => alert.status === 'open') ||
    state.auditNotificationReplaySlaAlerts.find((alert) => alert.status === 'snoozed') ||
    state.auditNotificationReplaySlaAlerts[0];
}

async function updateLatestReplaySlaAlert(status) {
  const latest = latestOpenReplaySlaAlert();
  if (!latest) {
    els.auditReplaySlaAlertStatus.textContent = 'Route a replay SLA alert first.';
    return;
  }
  const button = status === 'snoozed' ? els.auditReplaySlaAlertSnoozeButton : els.auditReplaySlaAlertAckButton;
  button.disabled = true;
  button.textContent = status === 'snoozed' ? 'Snoozing' : 'Acking';
  try {
    const response = await fetch(`/internal/ops/audit-notification-replay-sla-alerts/${latest.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status,
        snooze_minutes: 60,
        note: status === 'snoozed' ? 'Dashboard snoozed replay SLA alert.' : 'Dashboard acknowledged replay SLA alert.'
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay SLA alert update returned ${response.status}`);
    }
    state.auditNotificationReplaySlaAlerts = [
      payload.alert,
      ...state.auditNotificationReplaySlaAlerts.filter((alert) => alert.id !== payload.alert.id)
    ].slice(0, 50);
    renderAuditReplaySlaAlerts();
  } finally {
    button.disabled = false;
    button.textContent = status === 'snoozed' ? 'Snooze SLA alert' : 'Ack SLA alert';
  }
}

async function openAuditEvidenceCase() {
  els.auditOpenCaseButton.disabled = true;
  els.auditOpenCaseButton.textContent = 'Opening';
  try {
    const assignee = els.auditCaseAssigneeInput.value.trim();
    const dueHours = Number(els.auditCaseDueHoursInput.value.trim() || 0);
    const dueAt = dueHours > 0 ? new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString() : null;
    const response = await fetch(`/internal/ops/audit-evidence-cases?${evidenceChainQuery({ limit: 100 })}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: assignee ? 'in_review' : 'open',
        priority: els.auditCasePrioritySelect.value || 'normal',
        due_at: dueAt,
        assignee: assignee ? { username: assignee, role: 'operator' } : null
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Open evidence case returned ${response.status}`);
    }
    state.auditEvidenceCases = [
      payload.review,
      ...state.auditEvidenceCases.filter((review) => review.id !== payload.review.id)
    ].slice(0, 5);
    if (payload.review_receipt) {
      state.auditEvidenceCaseReviewReceipts = [
        payload.review_receipt,
        ...state.auditEvidenceCaseReviewReceipts.filter((receipt) => receipt.id !== payload.review_receipt.id)
      ].slice(0, 5);
    }
    renderAuditEvidenceCases();
  } finally {
    els.auditOpenCaseButton.disabled = false;
  els.auditOpenCaseButton.textContent = 'Open case';
  }
}

async function openAuditEvidenceAnomalyCase() {
  const verification = state.auditEvidenceCaseBundleVerifications.find((item) => item.valid === false) ||
    state.auditEvidenceCaseBundleVerifications[0];
  if (!verification) {
    els.auditEvidenceCaseStatus.textContent = 'Verify or load a bundle receipt before opening anomaly review.';
    return;
  }
  els.auditOpenAnomalyCaseButton.disabled = true;
  els.auditOpenAnomalyCaseButton.textContent = 'Opening';
  try {
    const assignee = els.auditCaseAssigneeInput.value.trim();
    const dueHours = Number(els.auditCaseDueHoursInput.value.trim() || 0);
    const dueAt = dueHours > 0 ? new Date(Date.now() + dueHours * 60 * 60 * 1000).toISOString() : null;
    const response = await fetch('/internal/ops/audit-evidence-cases/anomaly-review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        receipt_hash: verification.receipt_hash,
        priority: els.auditCasePrioritySelect.value || (verification.valid ? 'normal' : 'critical'),
        due_at: dueAt,
        assignee: assignee ? { username: assignee, role: 'operator' } : null,
        review_note: els.auditCaseResolutionInput.value.trim() || 'Opened anomaly review from ops dashboard.'
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Open anomaly review returned ${response.status}`);
    }
    state.auditEvidenceCases = [
      payload.review,
      ...state.auditEvidenceCases.filter((review) => review.id !== payload.review.id)
    ].slice(0, 5);
    state.auditEvidenceCaseReviewReceipts = [
      payload.review_receipt,
      ...state.auditEvidenceCaseReviewReceipts.filter((receipt) => receipt.id !== payload.review_receipt.id)
    ].slice(0, 5);
    renderAuditEvidenceCases();
  } finally {
    els.auditOpenAnomalyCaseButton.disabled = false;
    els.auditOpenAnomalyCaseButton.textContent = 'Open anomaly';
  }
}

async function generateAuditEvidenceNotifications() {
  els.auditNotificationGenerateButton.disabled = true;
  els.auditNotificationGenerateButton.textContent = 'Generating';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-notifications/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 20 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Generate alerts returned ${response.status}`);
    }
    state.auditEvidenceNotifications = payload.notifications || [];
    renderAuditEvidenceNotifications();
  } finally {
    els.auditNotificationGenerateButton.disabled = false;
    els.auditNotificationGenerateButton.textContent = 'Generate alerts';
  }
}

async function generateAuditAnomalyEvidenceNotifications() {
  els.auditAnomalyNotificationGenerateButton.disabled = true;
  els.auditAnomalyNotificationGenerateButton.textContent = 'Generating';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notifications/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 20 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Generate anomaly alerts returned ${response.status}`);
    }
    state.auditEvidenceNotifications = payload.notifications || [];
    renderAuditEvidenceNotifications();
  } finally {
    els.auditAnomalyNotificationGenerateButton.disabled = false;
    els.auditAnomalyNotificationGenerateButton.textContent = 'Generate anomaly SLA';
  }
}

async function generateAuditAnomalyNotificationDigest() {
  els.auditAnomalyDigestGenerateButton.disabled = true;
  els.auditAnomalyDigestGenerateButton.textContent = 'Generating';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 50 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Generate anomaly digest returned ${response.status}`);
    }
    state.auditEvidenceCaseAnomalyNotificationDigests = [
      payload.digest,
      ...state.auditEvidenceCaseAnomalyNotificationDigests.filter((digest) => digest.id !== payload.digest.id)
    ].slice(0, 5);
    renderAuditEvidenceNotifications();
  } finally {
    els.auditAnomalyDigestGenerateButton.disabled = false;
    els.auditAnomalyDigestGenerateButton.textContent = 'Anomaly digest';
  }
}

function openLatestAuditAnomalyNotificationDigestHtml() {
  const latest = state.auditEvidenceCaseAnomalyNotificationDigests[0];
  if (!latest) {
    els.auditNotificationStatus.textContent = 'Generate an anomaly digest before opening HTML.';
    return;
  }
  window.open(`/internal/ops/audit-evidence-case-anomaly-notification-digests/${latest.id}?format=html`, '_blank', 'noopener');
}

async function saveAuditAnomalyDigestSchedule() {
  els.auditAnomalyDigestScheduleSaveButton.disabled = true;
  els.auditAnomalyDigestScheduleSaveButton.textContent = 'Saving';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        enabled: true,
        interval_minutes: Number(els.auditAnomalyDigestScheduleIntervalInput.value || 1440),
        retention_days: Number(els.auditAnomalyDigestRetentionInput.value || 90),
        notification_limit: 100
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Anomaly digest schedule returned ${response.status}`);
    }
    state.auditEvidenceCaseAnomalyNotificationDigestSchedule = payload.schedule;
    renderAuditEvidenceNotifications();
  } finally {
    els.auditAnomalyDigestScheduleSaveButton.disabled = false;
    els.auditAnomalyDigestScheduleSaveButton.textContent = 'Save anomaly schedule';
  }
}

async function runAuditAnomalyDigestSchedule() {
  els.auditAnomalyDigestScheduleRunButton.disabled = true;
  els.auditAnomalyDigestScheduleRunButton.textContent = 'Running';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force: true })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Anomaly digest schedule run returned ${response.status}`);
    }
    state.auditEvidenceCaseAnomalyNotificationDigestSchedule =
      payload.run?.schedule || state.auditEvidenceCaseAnomalyNotificationDigestSchedule;
    if (payload.run?.digest) {
      state.auditEvidenceCaseAnomalyNotificationDigests = [
        payload.run.digest,
        ...state.auditEvidenceCaseAnomalyNotificationDigests.filter((digest) => digest.id !== payload.run.digest.id)
      ].slice(0, 5);
    }
    renderAuditEvidenceNotifications();
  } finally {
    els.auditAnomalyDigestScheduleRunButton.disabled = false;
    els.auditAnomalyDigestScheduleRunButton.textContent = 'Run anomaly schedule';
  }
}

async function pruneAuditAnomalyDigests() {
  els.auditAnomalyDigestPruneButton.disabled = true;
  els.auditAnomalyDigestPruneButton.textContent = 'Pruning';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule/prune', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        execute: false,
        retention_days: Number(els.auditAnomalyDigestRetentionInput.value || 90)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Anomaly digest prune returned ${response.status}`);
    }
    if (payload.prune?.receipt) {
      state.auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts = [
        payload.prune.receipt,
        ...state.auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts
      ].filter((receipt, index, list) => list.findIndex((item) => item.id === receipt.id) === index).slice(0, 5);
    }
    els.auditNotificationStatus.textContent =
      `Anomaly digest prune plan · eligible ${payload.prune?.eligible_count || 0}` +
      ` · retained ${payload.prune?.retained_count || 0}` +
      ` · receipt ${String(payload.prune?.receipt_hash || '').slice(0, 12)}` +
      ` · retain ${payload.prune?.retention_days || 90}d`;
  } finally {
    els.auditAnomalyDigestPruneButton.disabled = false;
    els.auditAnomalyDigestPruneButton.textContent = 'Prune anomaly digests';
  }
}

async function createAuditAnomalyDigestRetentionReceipt() {
  els.auditAnomalyDigestReceiptButton.disabled = true;
  els.auditAnomalyDigestReceiptButton.textContent = 'Verifying';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-anomaly-notification-digest-retention-receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        retention_days: Number(els.auditAnomalyDigestRetentionInput.value || 90)
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Anomaly digest retention receipt returned ${response.status}`);
    }
    state.auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts = [
      payload.receipt,
      ...state.auditEvidenceCaseAnomalyNotificationDigestRetentionReceipts
    ].filter((receipt, index, list) => list.findIndex((item) => item.id === receipt.id) === index).slice(0, 5);
    renderAuditEvidenceNotifications();
    window.open(
      `/internal/ops/audit-evidence-case-anomaly-notification-digest-retention-receipts/${payload.receipt.id}?format=receipt`,
      '_blank',
      'noopener'
    );
  } finally {
    els.auditAnomalyDigestReceiptButton.disabled = false;
    els.auditAnomalyDigestReceiptButton.textContent = 'Anomaly receipt';
  }
}

async function saveAuditNotificationRule() {
  els.auditRuleSaveButton.disabled = true;
  els.auditRuleSaveButton.textContent = 'Saving';
  try {
    const assignee = els.auditRuleAssigneeInput.value.trim();
    const response = await fetch('/internal/ops/audit-notification-rules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: els.auditRuleNameInput.value.trim() || 'Dashboard notification rule',
        kind: els.auditRuleKindSelect.value,
        priority: els.auditRulePrioritySelect.value,
        adapter: els.auditRuleAdapterSelect.value,
        repeat_interval_minutes: Number(els.auditRuleRepeatInput.value || 15),
        suppression_window_minutes: Number(els.auditRuleSuppressInput.value || 60),
        escalation_assignee: assignee ? { username: assignee, role: 'operator' } : null
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Save rule returned ${response.status}`);
    }
    state.auditNotificationRules = [
      payload.rule,
      ...state.auditNotificationRules.filter((rule) => rule.id !== payload.rule.id)
    ].slice(0, 5);
    renderAuditNotificationRules();
  } finally {
    els.auditRuleSaveButton.disabled = false;
    els.auditRuleSaveButton.textContent = 'Save rule';
  }
}

async function deliverLatestAuditEvidenceNotification() {
  const latest = state.auditEvidenceNotifications.find((notification) => notification.status === 'open') || state.auditEvidenceNotifications[0];
  if (!latest) {
    els.auditNotificationDeliveryStatus.textContent = 'Generate an alert before delivery.';
    return;
  }
  els.auditNotificationDeliverButton.disabled = true;
  els.auditNotificationDeliverButton.textContent = 'Delivering';
  try {
    const response = await fetch('/internal/ops/audit-evidence-case-notifications/deliver', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        adapter: 'webhook',
        notification_id: latest.id,
        limit: 1
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Deliver alert returned ${response.status}`);
    }
    state.auditNotificationPolicy = payload.policy || state.auditNotificationPolicy;
    state.auditNotificationDeliveries = [
      ...(payload.attempts || []),
      ...state.auditNotificationDeliveries
    ].slice(0, 5);
    renderAuditNotificationPolicy();
    renderAuditNotificationDeliveries();
  } finally {
    els.auditNotificationDeliverButton.disabled = false;
    els.auditNotificationDeliverButton.textContent = 'Deliver stub';
  }
}

function latestReplayableAuditNotificationDelivery() {
  return state.auditNotificationDeliveries.find((attempt) => attempt.status === 'skipped') ||
    state.auditNotificationDeliveries[0];
}

async function explainLatestAuditNotificationDelivery() {
  const latest = latestReplayableAuditNotificationDelivery();
  if (!latest) {
    els.auditNotificationDeliveryStatus.textContent = 'Record a delivery attempt before explaining.';
    return;
  }
  els.auditNotificationExplainButton.disabled = true;
  els.auditNotificationExplainButton.textContent = 'Explaining';
  try {
    const response = await fetch(`/internal/ops/audit-notification-deliveries/${encodeURIComponent(latest.id)}/explain`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Explain delivery returned ${response.status}`);
    }
    const explanation = payload.explanation;
    els.auditNotificationDeliveryStatus.textContent =
      `Explain ${explanation.reason}` +
      ` · replay ${explanation.can_replay ? 'available' : 'blocked'}` +
      ` · force ${explanation.can_force_replay ? 'available' : 'blocked'}` +
      ` · ${explanation.explanation}`;
  } finally {
    els.auditNotificationExplainButton.disabled = false;
    els.auditNotificationExplainButton.textContent = 'Explain latest';
  }
}

async function replayLatestAuditNotificationDelivery(force = false) {
  const latest = latestReplayableAuditNotificationDelivery();
  if (!latest) {
    els.auditNotificationDeliveryStatus.textContent = 'Record a delivery attempt before replay.';
    return;
  }
  const button = force ? els.auditNotificationForceReplayButton : els.auditNotificationReplayButton;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = force ? 'Force replaying' : 'Replaying';
  try {
    const forceReason = force ? els.auditNotificationForceReasonInput.value.trim() : '';
    if (force && forceReason.length < 8) {
      els.auditNotificationDeliveryStatus.textContent = 'Force replay needs an approval reason.';
      return;
    }
    const response = await fetch(`/internal/ops/audit-notification-deliveries/${encodeURIComponent(latest.id)}/replay`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force, force_reason: forceReason })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay delivery returned ${response.status}`);
    }
    state.auditNotificationPolicy = payload.replay?.policy || state.auditNotificationPolicy;
    state.auditNotificationDeliveries = [
      ...(payload.replay?.attempts || []),
      ...state.auditNotificationDeliveries
    ].slice(0, 5);
    renderAuditNotificationPolicy();
    renderAuditNotificationDeliveries();
    if (force) els.auditNotificationForceReasonInput.value = '';
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function latestReplayApproval(status) {
  return state.auditNotificationReplayApprovals.find((approval) => !status || approval.status === status);
}

function parseReviewerAssignment(value) {
  const raw = String(value || '').trim();
  const [username, role = 'admin'] = raw.split(':').map((part) => part.trim());
  return { username, role: role || 'admin' };
}

async function requestLatestForceReplayApproval() {
  const latest = latestReplayableAuditNotificationDelivery();
  const forceReason = els.auditNotificationForceReasonInput.value.trim();
  if (!latest) {
    els.auditNotificationDeliveryStatus.textContent = 'Record a skipped delivery before requesting force replay.';
    return;
  }
  if (forceReason.length < 8) {
    els.auditNotificationDeliveryStatus.textContent = 'Force replay request needs an approval reason.';
    return;
  }
  els.auditNotificationRequestReplayButton.disabled = true;
  els.auditNotificationRequestReplayButton.textContent = 'Requesting';
  try {
    const response = await fetch(`/internal/ops/audit-notification-deliveries/${encodeURIComponent(latest.id)}/replay-approvals`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force_reason: forceReason })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay approval request returned ${response.status}`);
    }
    state.auditNotificationReplayApprovals = [
      payload.approval,
      ...state.auditNotificationReplayApprovals
    ].slice(0, 5);
    renderAuditNotificationDeliveries();
  } finally {
    els.auditNotificationRequestReplayButton.disabled = false;
    els.auditNotificationRequestReplayButton.textContent = 'Request force';
  }
}

async function assignLatestForceReplayRequest() {
  const approval = latestReplayApproval('requested') || latestReplayApproval('approved');
  const assignment = parseReviewerAssignment(els.auditNotificationAssignedReviewerInput.value);
  if (!approval) {
    els.auditNotificationDeliveryStatus.textContent = 'No open replay approval to assign.';
    return;
  }
  if (!assignment.username) {
    els.auditNotificationDeliveryStatus.textContent = 'Assigned reviewer needs username or username:role.';
    return;
  }
  els.auditNotificationAssignReplayButton.disabled = true;
  els.auditNotificationAssignReplayButton.textContent = 'Assigning';
  try {
    const response = await fetch(`/internal/ops/audit-notification-replay-approvals/${encodeURIComponent(approval.id)}/assign`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigned_reviewer: assignment })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay approval assign returned ${response.status}`);
    }
    state.auditNotificationReplayApprovals = [
      payload.approval,
      ...state.auditNotificationReplayApprovals.filter((item) => item.id !== payload.approval.id)
    ].slice(0, 5);
    renderAuditNotificationDeliveries();
  } finally {
    els.auditNotificationAssignReplayButton.disabled = false;
    els.auditNotificationAssignReplayButton.textContent = 'Assign reviewer';
  }
}

async function approveLatestForceReplayRequest() {
  const approval = latestReplayApproval('requested');
  if (!approval) {
    els.auditNotificationDeliveryStatus.textContent = 'No requested replay approval to approve.';
    return;
  }
  const reviewNote = els.auditNotificationReviewNoteInput.value.trim() || 'Approved from ops dashboard';
  els.auditNotificationApproveReplayButton.disabled = true;
  els.auditNotificationApproveReplayButton.textContent = 'Approving';
  try {
    const response = await fetch(`/internal/ops/audit-notification-replay-approvals/${encodeURIComponent(approval.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved', review_note: reviewNote })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay approval review returned ${response.status}`);
    }
    state.auditNotificationReplayApprovals = [
      payload.approval,
      ...state.auditNotificationReplayApprovals.filter((item) => item.id !== payload.approval.id)
    ].slice(0, 5);
    renderAuditNotificationDeliveries();
  } finally {
    els.auditNotificationApproveReplayButton.disabled = false;
    els.auditNotificationApproveReplayButton.textContent = 'Approve request';
  }
}

async function rejectLatestForceReplayRequest() {
  const approval = latestReplayApproval('requested');
  const rejectionReason = els.auditNotificationReviewNoteInput.value.trim();
  if (!approval) {
    els.auditNotificationDeliveryStatus.textContent = 'No requested replay approval to reject.';
    return;
  }
  if (rejectionReason.length < 8) {
    els.auditNotificationDeliveryStatus.textContent = 'Reject request needs an 8+ character reason.';
    return;
  }
  els.auditNotificationRejectReplayButton.disabled = true;
  els.auditNotificationRejectReplayButton.textContent = 'Rejecting';
  try {
    const response = await fetch(`/internal/ops/audit-notification-replay-approvals/${encodeURIComponent(approval.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status: 'rejected',
        review_note: rejectionReason,
        rejection_reason: rejectionReason
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay approval reject returned ${response.status}`);
    }
    state.auditNotificationReplayApprovals = [
      payload.approval,
      ...state.auditNotificationReplayApprovals.filter((item) => item.id !== payload.approval.id)
    ].slice(0, 5);
    renderAuditNotificationDeliveries();
  } finally {
    els.auditNotificationRejectReplayButton.disabled = false;
    els.auditNotificationRejectReplayButton.textContent = 'Reject request';
  }
}

async function cleanupExpiredForceReplayRequests() {
  const cleanupReason = els.auditNotificationReviewNoteInput.value.trim() || 'Expired replay approval cleanup from ops dashboard.';
  els.auditNotificationCleanupExpiredButton.disabled = true;
  els.auditNotificationCleanupExpiredButton.textContent = 'Cleaning';
  try {
    const response = await fetch('/internal/ops/audit-notification-replay-approvals/cleanup-expired', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cleanup_reason: cleanupReason, limit: 20 })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay approval cleanup returned ${response.status}`);
    }
    state.auditNotificationReplayApprovals = [
      ...(payload.cleanup?.approvals || []),
      ...state.auditNotificationReplayApprovals.filter((item) => !(payload.cleanup?.approvals || []).some((approval) => approval.id === item.id))
    ].slice(0, 5);
    els.auditNotificationDeliveryStatus.textContent = `Expired approvals cleaned: ${payload.cleanup?.cleaned_count || 0}`;
    renderAuditNotificationDeliveries();
  } finally {
    els.auditNotificationCleanupExpiredButton.disabled = false;
    els.auditNotificationCleanupExpiredButton.textContent = 'Cleanup expired';
  }
}

async function executeLatestForceReplayApproval() {
  const approval = latestReplayApproval('approved');
  if (!approval) {
    els.auditNotificationDeliveryStatus.textContent = 'No approved replay request to execute.';
    return;
  }
  els.auditNotificationExecuteReplayButton.disabled = true;
  els.auditNotificationExecuteReplayButton.textContent = 'Executing';
  try {
    const response = await fetch(`/internal/ops/audit-notification-replay-approvals/${encodeURIComponent(approval.id)}/execute`, {
      method: 'POST'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay approval execute returned ${response.status}`);
    }
    state.auditNotificationReplayApprovals = [
      payload.approval,
      ...state.auditNotificationReplayApprovals.filter((item) => item.id !== payload.approval.id)
    ].slice(0, 5);
    state.auditNotificationDeliveries = [
      ...(payload.replay?.attempts || []),
      ...state.auditNotificationDeliveries
    ].slice(0, 5);
    renderAuditNotificationPolicy();
    renderAuditNotificationDeliveries();
    els.auditNotificationForceReasonInput.value = '';
  } finally {
    els.auditNotificationExecuteReplayButton.disabled = false;
    els.auditNotificationExecuteReplayButton.textContent = 'Execute approved';
  }
}

async function updateLatestReplayWorkloadAction(action) {
  const approval = latestReplayApproval('requested') || latestReplayApproval('approved');
  const buttonByAction = {
    acknowledged: els.auditNotificationWorkloadAckButton,
    reassigned: els.auditNotificationWorkloadReassignButton,
    resolved: els.auditNotificationWorkloadResolveButton
  };
  const button = buttonByAction[action];
  if (!approval) {
    els.auditNotificationDeliveryStatus.textContent = 'No open replay workload item to update.';
    return;
  }
  const note = els.auditNotificationReviewNoteInput.value.trim() ||
    (action === 'resolved' ? 'Resolved replay approval workload item from ops dashboard.' : 'Replay workload action from ops dashboard.');
  const body = { action, note };
  if (action === 'reassigned') {
    const assignment = parseReviewerAssignment(els.auditNotificationAssignedReviewerInput.value);
    if (!assignment.username) {
      els.auditNotificationDeliveryStatus.textContent = 'Reassign workload needs reviewer username or username:role.';
      return;
    }
    body.assigned_reviewer = assignment;
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = action === 'acknowledged' ? 'Acking' : action === 'reassigned' ? 'Reassigning' : 'Resolving';
  try {
    const response = await fetch(`/internal/ops/audit-notification-replay-approvals/${encodeURIComponent(approval.id)}/workload-action`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Replay workload action returned ${response.status}`);
    }
    state.auditNotificationReplayApprovals = [
      payload.approval,
      ...state.auditNotificationReplayApprovals.filter((item) => item.id !== payload.approval.id)
    ].slice(0, 5);
    state.auditNotificationReplayWorkload = await fetchAuditNotificationReplayWorkload();
    renderAuditNotificationReplayWorkload();
    renderAuditNotificationDeliveries();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function updateLatestAuditEvidenceNotification(status) {
  const latest = state.auditEvidenceNotifications[0];
  if (!latest) {
    els.auditNotificationStatus.textContent = 'Generate an alert before updating.';
    return;
  }
  const button = status === 'acked' ? els.auditNotificationAckButton : els.auditNotificationSnoozeButton;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = status === 'acked' ? 'Acking' : 'Snoozing';
  try {
    const body = { status };
    if (status === 'snoozed') {
      body.snoozed_until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    }
    const response = await fetch(`/internal/ops/audit-evidence-case-notifications/${encodeURIComponent(latest.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Update alert returned ${response.status}`);
    }
    state.auditEvidenceNotifications = [
      payload.notification,
      ...state.auditEvidenceNotifications.filter((notification) => notification.id !== payload.notification.id)
    ].slice(0, 5);
    renderAuditEvidenceNotifications();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function resolveLatestAuditEvidenceCase() {
  const latest = state.auditEvidenceCases[0];
  if (!latest) {
    els.auditEvidenceCaseStatus.textContent = 'Open an evidence case before resolving.';
    return;
  }
  els.auditResolveCaseButton.disabled = true;
  els.auditResolveCaseButton.textContent = 'Resolving';
  try {
    const note = els.auditCaseResolutionInput.value.trim() || 'Reviewed and resolved from ops dashboard.';
    const response = await fetch(`/internal/ops/audit-evidence-cases/${encodeURIComponent(latest.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolution_note: note })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Resolve evidence case returned ${response.status}`);
    }
    state.auditEvidenceCases = [
      payload.review,
      ...state.auditEvidenceCases.filter((review) => review.id !== payload.review.id)
    ].slice(0, 5);
    if (payload.review_receipt) {
      state.auditEvidenceCaseReviewReceipts = [
        payload.review_receipt,
        ...state.auditEvidenceCaseReviewReceipts.filter((receipt) => receipt.id !== payload.review_receipt.id)
      ].slice(0, 5);
    }
    renderAuditEvidenceCases();
  } finally {
    els.auditResolveCaseButton.disabled = false;
    els.auditResolveCaseButton.textContent = 'Resolve latest';
  }
}

async function loadAuditEvidenceCaseReviewReceipts() {
  els.auditCaseReviewReceiptsButton.disabled = true;
  els.auditCaseReviewReceiptsButton.textContent = 'Loading';
  try {
    state.auditEvidenceCaseReviewReceipts = await fetchAuditEvidenceCaseReviewReceipts();
    renderAuditEvidenceCases();
  } finally {
    els.auditCaseReviewReceiptsButton.disabled = false;
    els.auditCaseReviewReceiptsButton.textContent = 'Review receipts';
  }
}

async function downloadLatestAuditEvidenceCaseReviewReceipt() {
  const latest = state.auditEvidenceCaseReviewReceipts[0];
  if (!latest) {
    els.auditEvidenceCaseStatus.textContent = 'Load or create a review receipt first.';
    return;
  }
  els.auditCaseReviewReceiptJsonButton.disabled = true;
  els.auditCaseReviewReceiptJsonButton.textContent = 'Exporting';
  try {
    const response = await fetch(
      `/internal/ops/audit-evidence-case-review-receipts/${encodeURIComponent(latest.receipt_hash)}?format=receipt`
    );
    if (!response.ok) {
      throw new Error(`Evidence case review receipt returned ${response.status}`);
    }
    const payload = await response.json();
    downloadJson(`evidence-case-review-receipt-${String(latest.receipt_hash || '').slice(0, 12)}.json`, payload.receipt || payload);
  } finally {
    els.auditCaseReviewReceiptJsonButton.disabled = false;
    els.auditCaseReviewReceiptJsonButton.textContent = 'Review receipt JSON';
  }
}

async function archiveAuditReport() {
  els.auditArchiveButton.disabled = true;
  els.auditArchiveButton.textContent = 'Archiving';
  try {
    const response = await fetch(`/internal/ops/audit-report-archives?${auditQuery({ limit: 200 })}`, {
      method: 'POST'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Audit report archive returned ${response.status}`);
    }
    state.auditReportArchives = [payload.archive, ...state.auditReportArchives.filter((archive) => archive.id !== payload.archive.id)].slice(0, 5);
    renderAuditReportArchives();
    downloadBlob({
      content: JSON.stringify(payload.archive.report, null, 2),
      type: 'application/json',
      filename: `${payload.archive.report_id}.json`
    });
  } finally {
    els.auditArchiveButton.disabled = false;
    els.auditArchiveButton.textContent = 'Archive';
  }
}

async function verifyAuditArchive() {
  const identifier = els.auditVerifyInput.value.trim();
  if (!identifier) {
    els.auditVerifyStatus.textContent = 'Paste a report hash or evidence signature.';
    return;
  }
  els.auditVerifyButton.disabled = true;
  els.auditVerifyButton.textContent = 'Verifying';
  try {
    const params = new URLSearchParams({ identifier });
    const response = await fetch(`/internal/ops/audit-report-verifications?${params.toString()}`, {
      method: 'POST'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Archive verification returned ${response.status}`);
    }
    state.auditVerificationReceipt = payload.verification.receipt;
    state.auditReportVerifications = [
      payload.verification,
      ...state.auditReportVerifications.filter((verification) => verification.id !== payload.verification.id)
    ].slice(0, 5);
    renderAuditVerificationReceipt();
    renderAuditVerificationHistory();
  } finally {
    els.auditVerifyButton.disabled = false;
    els.auditVerifyButton.textContent = 'Verify';
  }
}

async function runAuditTamperDrill() {
  const identifier = els.auditVerifyInput.value.trim() || state.auditReportArchives[0]?.report_hash || '';
  if (!identifier) {
    els.auditVerifyStatus.textContent = 'Archive a report before running a tamper drill.';
    return;
  }
  els.auditTamperButton.disabled = true;
  els.auditTamperButton.textContent = 'Drilling';
  try {
    const params = new URLSearchParams({ identifier });
    const response = await fetch(`/internal/ops/audit-report-verifications/tamper-drill?${params.toString()}`, {
      method: 'POST'
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Tamper drill returned ${response.status}`);
    }
    state.auditVerificationReceipt = payload.verification.receipt;
    state.auditReportVerifications = [
      payload.verification,
      ...state.auditReportVerifications.filter((verification) => verification.id !== payload.verification.id)
    ].slice(0, 5);
    renderAuditVerificationReceipt();
    renderAuditVerificationHistory();
  } finally {
    els.auditTamperButton.disabled = false;
    els.auditTamperButton.textContent = 'Tamper drill';
  }
}

async function loadVerificationReceipt() {
  const identifier = els.auditVerifyInput.value.trim() || state.auditReportVerifications[0]?.receipt_hash || '';
  if (!identifier) {
    els.auditVerifyStatus.textContent = 'Paste a receipt hash or run a verification first.';
    return;
  }
  els.auditLoadReceiptButton.disabled = true;
  els.auditLoadReceiptButton.textContent = 'Loading';
  try {
    const response = await fetch(`/internal/ops/audit-report-verifications/${encodeURIComponent(identifier)}?format=receipt`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Receipt lookup returned ${response.status}`);
    }
    state.auditVerificationReceipt = payload.receipt;
    renderAuditVerificationReceipt();
  } finally {
    els.auditLoadReceiptButton.disabled = false;
    els.auditLoadReceiptButton.textContent = 'Load receipt';
  }
}

function exportVerificationReceipt() {
  if (!state.auditVerificationReceipt) {
    els.auditVerifyStatus.textContent = 'Verify an archive before exporting a receipt.';
    return;
  }
  downloadBlob({
    content: JSON.stringify(state.auditVerificationReceipt, null, 2),
    type: 'application/json',
    filename: `${state.auditVerificationReceipt.archive.report_id}-verification.json`
  });
}

function readAuditFilters() {
  const data = new FormData(els.auditFilterForm);
  return {
    category: data.get('category') || 'all',
    action: data.get('action')?.trim() || '',
    actor: data.get('actor')?.trim() || '',
    target: data.get('target')?.trim() || '',
    q: data.get('q')?.trim() || ''
  };
}

function setAdminNotice(type, message) {
  els.adminNotice.className = `admin-notice ${type}`;
  els.adminNotice.textContent = message;
}

async function submitAdminUserCreate() {
  const submit = els.adminUserForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Creating';
  try {
    const data = new FormData(els.adminUserForm);
    await postAdminUser({
      username: data.get('username')?.trim(),
      display_name: data.get('display_name')?.trim(),
      role: data.get('role'),
      password: data.get('password')
    });
    els.adminUserForm.reset();
    setAdminNotice('success', 'Internal user created.');
    await refreshDashboard({ preserveSelection: true });
  } catch (error) {
    setAdminNotice('error', error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Create user';
  }
}

async function submitAdminUserUpdate(form) {
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Saving';
  try {
    const data = new FormData(form);
    const payload = {
      role: data.get('role'),
      display_name: data.get('display_name')?.trim(),
      disabled: data.get('disabled') === 'on'
    };
    const password = data.get('password');
    if (password) payload.password = password;
    await patchAdminUser(form.dataset.adminUser, payload);
    setAdminNotice('success', `${form.dataset.adminUser} updated.`);
    await refreshDashboard({ preserveSelection: true });
  } catch (error) {
    setAdminNotice('error', error.message);
  } finally {
    submit.disabled = false;
    submit.textContent = 'Save';
  }
}

function render() {
  renderLanguageChrome();
  renderHealth();
  renderSummary();
  renderControlCenter();
  renderPromptDiscoveryQueue();
  renderNav();
  renderItems();
  renderActivity();
  renderAdminUsers();
  applyChineseText();
}

els.refreshButton.addEventListener('click', () => refreshDashboard({ preserveSelection: true }));
els.langToggle?.addEventListener('click', () => setDashboardLanguage(isZh() ? 'en' : 'zh'));
els.logoutButton.addEventListener('click', logout);
els.auditFilterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  state.auditFilters = readAuditFilters();
  await refreshDashboard({ preserveSelection: true });
});
els.auditResetButton.addEventListener('click', async () => {
  els.auditFilterForm.reset();
  state.auditFilters = readAuditFilters();
  await refreshDashboard({ preserveSelection: true });
});
els.auditJsonButton.addEventListener('click', () => exportAudit('json').catch((error) => {
  els.auditFilterStatus.textContent = error.message;
}));
els.auditCsvButton.addEventListener('click', () => exportAudit('csv').catch((error) => {
  els.auditFilterStatus.textContent = error.message;
}));
els.auditReportJsonButton.addEventListener('click', () => exportAuditReport('json').catch((error) => {
  els.auditFilterStatus.textContent = error.message;
}));
els.auditReportHtmlButton.addEventListener('click', () => exportAuditReport('html').catch((error) => {
  els.auditFilterStatus.textContent = error.message;
}));
els.auditArchiveButton.addEventListener('click', () => archiveAuditReport().catch((error) => {
  els.auditArchiveStatus.textContent = error.message;
  els.auditArchiveButton.disabled = false;
  els.auditArchiveButton.textContent = 'Archive';
}));
els.auditVerifyButton.addEventListener('click', () => verifyAuditArchive().catch((error) => {
  els.auditVerifyStatus.textContent = error.message;
  els.auditVerifyButton.disabled = false;
  els.auditVerifyButton.textContent = 'Verify';
}));
els.auditTamperButton.addEventListener('click', () => runAuditTamperDrill().catch((error) => {
  els.auditVerifyStatus.textContent = error.message;
  els.auditTamperButton.disabled = false;
  els.auditTamperButton.textContent = 'Tamper drill';
}));
els.auditLoadReceiptButton.addEventListener('click', () => loadVerificationReceipt().catch((error) => {
  els.auditVerifyStatus.textContent = error.message;
  els.auditLoadReceiptButton.disabled = false;
  els.auditLoadReceiptButton.textContent = 'Load receipt';
}));
els.auditReceiptButton.addEventListener('click', exportVerificationReceipt);
els.auditEvidenceSearchButton.addEventListener('click', () => fetchAuditEvidenceChain()
  .then((chain) => {
    state.auditEvidenceChain = chain;
    renderAuditEvidenceChain();
  })
  .catch((error) => {
    els.auditEvidenceChain.textContent = error.message;
  }));
els.auditCaseJsonButton.addEventListener('click', () => exportAuditEvidenceCasePacket('json').catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseHtmlButton.addEventListener('click', () => exportAuditEvidenceCasePacket('html').catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleButton.addEventListener('click', () => exportAuditEvidenceCaseBundle().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseVerifyBundleButton.addEventListener('click', () => verifyAuditEvidenceCaseBundle().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleExportsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleExports().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleExportReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleExportReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleExportReviewButton.addEventListener('click', () => reviewLatestAuditEvidenceCaseBundleExport().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleExportReviewButton.disabled = false;
  els.auditCaseBundleExportReviewButton.textContent = 'Review export';
}));
els.auditCaseBundleExportReviewsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleExportReviews().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryReadinessButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleDeliveryReadiness().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryGateButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleDeliveryGate().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryGateReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleDeliveryGateReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryGateReceiptButton.disabled = false;
  els.auditCaseBundleDeliveryGateReceiptButton.textContent = 'Record gate';
}));
els.auditCaseBundleDeliveryGateReceiptsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleDeliveryGateReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryGateReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleDeliveryGateReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryHandoffPreviewButton.addEventListener('click', () => createAuditEvidenceCaseBundleDeliveryHandoffPreview().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryHandoffPreviewButton.disabled = false;
  els.auditCaseBundleDeliveryHandoffPreviewButton.textContent = 'Handoff preview';
}));
els.auditCaseBundleDeliveryHandoffPreviewReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleDeliveryHandoffPreviewReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryHandoffPreviewReceiptButton.disabled = false;
  els.auditCaseBundleDeliveryHandoffPreviewReceiptButton.textContent = 'Record handoff';
}));
els.auditCaseBundleDeliveryHandoffPreviewReceiptsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleDeliveryHandoffPreviewReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryHandoffPreviewReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleDeliveryHandoffPreviewReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryFinalApprovalPreviewButton.addEventListener('click', () => createAuditEvidenceCaseBundleDeliveryFinalApprovalPreview().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryFinalApprovalPreviewButton.disabled = false;
  els.auditCaseBundleDeliveryFinalApprovalPreviewButton.textContent = 'Final approval';
}));
els.auditCaseBundleDeliveryFinalApprovalReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleDeliveryFinalApprovalReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryFinalApprovalReceiptButton.disabled = false;
  els.auditCaseBundleDeliveryFinalApprovalReceiptButton.textContent = 'Record final';
}));
els.auditCaseBundleDeliveryFinalApprovalReceiptsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleDeliveryFinalApprovalReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryFinalApprovalReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleDeliveryFinalApprovalReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryFinalApprovalConfirmButton.addEventListener('click', () => recordAuditEvidenceCaseBundleDeliveryFinalApprovalReview('confirmed').catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryFinalApprovalConfirmButton.disabled = false;
  els.auditCaseBundleDeliveryFinalApprovalConfirmButton.textContent = 'Confirm final';
}));
els.auditCaseBundleDeliveryFinalApprovalRevokeButton.addEventListener('click', () => recordAuditEvidenceCaseBundleDeliveryFinalApprovalReview('revoked').catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryFinalApprovalRevokeButton.disabled = false;
  els.auditCaseBundleDeliveryFinalApprovalRevokeButton.textContent = 'Revoke final';
}));
els.auditCaseBundleDeliveryFinalApprovalExpireButton.addEventListener('click', () => recordAuditEvidenceCaseBundleDeliveryFinalApprovalReview('expired').catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryFinalApprovalExpireButton.disabled = false;
  els.auditCaseBundleDeliveryFinalApprovalExpireButton.textContent = 'Expire final';
}));
els.auditCaseBundleDeliveryFinalApprovalReviewsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleDeliveryFinalApprovalReviews().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryFinalApprovalReviewJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleDeliveryFinalApprovalReview().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryFinalApprovalPolicyGateButton.addEventListener('click', () => createAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGate().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateButton.disabled = false;
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateButton.textContent = 'Policy gate';
}));
els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton.disabled = false;
  els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptButton.textContent = 'Record policy';
}));
els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleDeliveryFinalApprovalPolicyGateReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleDeliveryFinalApprovalPolicyGateReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryDryRunLockButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryDryRunLock().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryDryRunLockButton.disabled = false;
  els.auditCaseBundleFinalDeliveryDryRunLockButton.textContent = 'Dry-run lock';
}));
els.auditCaseBundleFinalDeliveryDryRunLockReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryDryRunLockReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryDryRunLockReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryDryRunLockReceiptButton.textContent = 'Record lock';
}));
els.auditCaseBundleFinalDeliveryDryRunLockReceiptsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryDryRunLockReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryDryRunLockReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryDryRunLockReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryRehearsalButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryRehearsal().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryRehearsalButton.disabled = false;
  els.auditCaseBundleFinalDeliveryRehearsalButton.textContent = 'Rehearsal';
}));
els.auditCaseBundleFinalDeliveryRehearsalReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryRehearsalReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryRehearsalReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryRehearsalReceiptButton.textContent = 'Record rehearsal';
}));
els.auditCaseBundleFinalDeliveryRehearsalsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryRehearsalReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryRehearsalJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryRehearsalReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryDualControlApprovalButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryDualControlApproval().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryDualControlApprovalButton.disabled = false;
  els.auditCaseBundleFinalDeliveryDualControlApprovalButton.textContent = 'Dual approval';
}));
els.auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryDualControlApprovalReceiptButton.textContent = 'Record dual';
}));
els.auditCaseBundleFinalDeliveryDualControlApprovalsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryDualControlApprovalJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryDualControlApprovalReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryReadinessSealButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryReadinessSeal().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryReadinessSealButton.disabled = false;
  els.auditCaseBundleFinalDeliveryReadinessSealButton.textContent = 'Seal ready';
}));
els.auditCaseBundleFinalDeliveryReadinessSealReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryReadinessSealReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryReadinessSealReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryReadinessSealReceiptButton.textContent = 'Record seal';
}));
els.auditCaseBundleFinalDeliveryReadinessSealsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryReadinessSealReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryReadinessSealJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryReadinessSealReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliverySealedHandoffReviewButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliverySealedHandoffReview().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliverySealedHandoffReviewButton.disabled = false;
  els.auditCaseBundleFinalDeliverySealedHandoffReviewButton.textContent = 'Handoff review';
}));
els.auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliverySealedHandoffReviewReceiptButton.textContent = 'Record signoff';
}));
els.auditCaseBundleFinalDeliverySealedHandoffReviewsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliverySealedHandoffReviewJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliverySealedHandoffReviewReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandEscrowButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandEscrow().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandEscrowButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandEscrowButton.textContent = 'Command escrow';
}));
els.auditCaseBundleFinalDeliveryCommandEscrowReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandEscrowReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandEscrowReceiptButton.textContent = 'Record command';
}));
els.auditCaseBundleFinalDeliveryCommandEscrowsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandEscrowJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandEscrowReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandRevocationButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandRevocation().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandRevocationButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandRevocationButton.textContent = 'Command revoke';
}));
els.auditCaseBundleFinalDeliveryCommandRevocationReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandRevocationReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandRevocationReceiptButton.textContent = 'Record revoke';
}));
els.auditCaseBundleFinalDeliveryCommandRevocationsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandRevocationJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandRevocationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandClosureButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandClosure().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandClosureButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandClosureButton.textContent = 'Rollback close';
}));
els.auditCaseBundleFinalDeliveryCommandClosureReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandClosureReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandClosureReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandClosureReceiptButton.textContent = 'Record closure';
}));
els.auditCaseBundleFinalDeliveryCommandClosuresButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandClosureReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandClosureJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandClosureReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailNotarizationButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarization().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationButton.textContent = 'Trail notarize';
}));
els.auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailNotarizationReceiptButton.textContent = 'Record trail';
}));
els.auditCaseBundleFinalDeliveryCommandTrailNotarizationsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailNotarizationJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailNotarizationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustody().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyButton.textContent = 'Custody lock';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyReceiptButton.textContent = 'Record custody';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodiesButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestation().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationButton.textContent = 'Retention attest';
}));
els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceiptButton.textContent = 'Record retention';
}));
els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailRetentionAttestationJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailRetentionAttestationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindow().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowButton.textContent = 'Renewal guard';
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowReceiptButton.textContent = 'Record renewal';
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalWindowJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalWindowReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmation().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationButton.textContent = 'Checkpoint confirm';
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceiptButton.textContent = 'Record checkpoint';
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailRenewalConfirmationJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSeal().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealButton.textContent = 'Seal checkpoint';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealReceiptButton.textContent = 'Record seal';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCheckpointSealJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCheckpointSealReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoff().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffButton.textContent = 'Custody handoff';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceiptButton.textContent = 'Record handoff';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyHandoffJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyHandoffReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrow().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowButton.textContent = 'Archive escrow';
}));
els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceiptButton.textContent = 'Record escrow';
}));
els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailArchiveEscrowJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailArchiveEscrowReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSeal().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealButton.textContent = 'Evidence seal';
}));
els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealReceiptButton.textContent = 'Record evidence';
}));
els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailEvidenceSealJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailEvidenceSealReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton.addEventListener('click', () => createAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpoint().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointButton.textContent = 'Custody checkpoint';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton.addEventListener('click', () => recordAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton.disabled = false;
  els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceiptButton.textContent = 'Record custody';
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleFinalDeliveryCommandTrailCustodyCheckpointJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleExportReviewReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleExportReviewReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleReceiptsButton.addEventListener('click', () => fetchAuditEvidenceCaseBundleVerifications().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditCaseBundleReceiptJsonButton.addEventListener('click', () => exportLatestAuditEvidenceCaseBundleVerificationReceipt().catch((error) => {
  els.auditEvidenceChain.textContent = error.message;
}));
els.auditNotificationWorkloadJsonButton.addEventListener('click', () => exportAuditNotificationReplayWorkload().catch((error) => {
  els.auditNotificationReplayWorkloadStatus.textContent = error.message;
}));
els.auditNotificationEscalationHtmlButton.addEventListener('click', () => exportAuditNotificationReplayEscalationReport('html').catch((error) => {
  els.auditNotificationReplayWorkloadStatus.textContent = error.message;
}));
els.auditNotificationPerformanceJsonButton.addEventListener('click', () => exportAuditNotificationReplayPerformanceReport('json').catch((error) => {
  els.auditNotificationReplayWorkloadStatus.textContent = error.message;
}));
els.auditNotificationPerformanceHtmlButton.addEventListener('click', () => exportAuditNotificationReplayPerformanceReport('html').catch((error) => {
  els.auditNotificationReplayWorkloadStatus.textContent = error.message;
}));
els.auditReplayThresholdSaveButton.addEventListener('click', () => saveAuditReplayThresholds().catch((error) => {
  els.auditReplayThresholdStatus.textContent = error.message;
  els.auditReplayThresholdSaveButton.disabled = false;
  els.auditReplayThresholdSaveButton.textContent = 'Save SLA thresholds';
}));
els.auditReplaySlaAlertGenerateButton.addEventListener('click', () => generateAuditReplaySlaAlerts().catch((error) => {
  els.auditReplaySlaAlertStatus.textContent = error.message;
  els.auditReplaySlaAlertGenerateButton.disabled = false;
  els.auditReplaySlaAlertGenerateButton.textContent = 'Route SLA alerts';
}));
els.auditReplaySlaScheduleSaveButton.addEventListener('click', () => saveAuditReplaySlaSchedule().catch((error) => {
  els.auditReplaySlaScheduleStatus.textContent = error.message;
  els.auditReplaySlaScheduleSaveButton.disabled = false;
  els.auditReplaySlaScheduleSaveButton.textContent = 'Save SLA schedule';
}));
els.auditReplaySlaScheduleRunButton.addEventListener('click', () => runAuditReplaySlaSchedule().catch((error) => {
  els.auditReplaySlaScheduleStatus.textContent = error.message;
  els.auditReplaySlaScheduleRunButton.disabled = false;
  els.auditReplaySlaScheduleRunButton.textContent = 'Run SLA schedule';
}));
els.auditReplaySlaDigestGenerateButton.addEventListener('click', () => generateAuditReplaySlaDigest().catch((error) => {
  els.auditReplaySlaDigestStatus.textContent = error.message;
  els.auditReplaySlaDigestGenerateButton.disabled = false;
  els.auditReplaySlaDigestGenerateButton.textContent = 'Generate SLA digest';
}));
els.auditReplaySlaDigestHtmlButton.addEventListener('click', openLatestAuditReplaySlaDigestHtml);
els.auditReplaySlaDigestScheduleSaveButton.addEventListener('click', () => saveAuditReplaySlaDigestSchedule().catch((error) => {
  els.auditReplaySlaDigestScheduleStatus.textContent = error.message;
  els.auditReplaySlaDigestScheduleSaveButton.disabled = false;
  els.auditReplaySlaDigestScheduleSaveButton.textContent = 'Save digest schedule';
}));
els.auditReplaySlaDigestScheduleRunButton.addEventListener('click', () => runAuditReplaySlaDigestSchedule().catch((error) => {
  els.auditReplaySlaDigestScheduleStatus.textContent = error.message;
  els.auditReplaySlaDigestScheduleRunButton.disabled = false;
  els.auditReplaySlaDigestScheduleRunButton.textContent = 'Run digest schedule';
}));
els.auditReplaySlaDigestPruneButton.addEventListener('click', () => pruneAuditReplaySlaDigests().catch((error) => {
  els.auditReplaySlaDigestScheduleStatus.textContent = error.message;
  els.auditReplaySlaDigestPruneButton.disabled = false;
  els.auditReplaySlaDigestPruneButton.textContent = 'Prune digests';
}));
els.auditReplaySlaDigestReceiptButton.addEventListener('click', () => createAuditReplaySlaDigestRetentionReceipt().catch((error) => {
  els.auditReplaySlaDigestReceiptStatus.textContent = error.message;
  els.auditReplaySlaDigestReceiptButton.disabled = false;
  els.auditReplaySlaDigestReceiptButton.textContent = 'Retention receipt';
}));
els.auditReplaySlaAlertAckButton.addEventListener('click', () => updateLatestReplaySlaAlert('acked').catch((error) => {
  els.auditReplaySlaAlertStatus.textContent = error.message;
  els.auditReplaySlaAlertAckButton.disabled = false;
  els.auditReplaySlaAlertAckButton.textContent = 'Ack SLA alert';
}));
els.auditReplaySlaAlertSnoozeButton.addEventListener('click', () => updateLatestReplaySlaAlert('snoozed').catch((error) => {
  els.auditReplaySlaAlertStatus.textContent = error.message;
  els.auditReplaySlaAlertSnoozeButton.disabled = false;
  els.auditReplaySlaAlertSnoozeButton.textContent = 'Snooze SLA alert';
}));
els.auditOpenCaseButton.addEventListener('click', () => openAuditEvidenceCase().catch((error) => {
  els.auditEvidenceCaseStatus.textContent = error.message;
  els.auditOpenCaseButton.disabled = false;
  els.auditOpenCaseButton.textContent = 'Open case';
}));
els.auditOpenAnomalyCaseButton.addEventListener('click', () => openAuditEvidenceAnomalyCase().catch((error) => {
  els.auditEvidenceCaseStatus.textContent = error.message;
  els.auditOpenAnomalyCaseButton.disabled = false;
  els.auditOpenAnomalyCaseButton.textContent = 'Open anomaly';
}));
els.auditResolveCaseButton.addEventListener('click', () => resolveLatestAuditEvidenceCase().catch((error) => {
  els.auditEvidenceCaseStatus.textContent = error.message;
  els.auditResolveCaseButton.disabled = false;
  els.auditResolveCaseButton.textContent = 'Resolve latest';
}));
els.auditCaseReviewReceiptsButton.addEventListener('click', () => loadAuditEvidenceCaseReviewReceipts().catch((error) => {
  els.auditEvidenceCaseStatus.textContent = error.message;
  els.auditCaseReviewReceiptsButton.disabled = false;
  els.auditCaseReviewReceiptsButton.textContent = 'Review receipts';
}));
els.auditCaseReviewReceiptJsonButton.addEventListener('click', () => downloadLatestAuditEvidenceCaseReviewReceipt().catch((error) => {
  els.auditEvidenceCaseStatus.textContent = error.message;
  els.auditCaseReviewReceiptJsonButton.disabled = false;
  els.auditCaseReviewReceiptJsonButton.textContent = 'Review receipt JSON';
}));
els.auditAnomalyNotificationGenerateButton.addEventListener('click', () => generateAuditAnomalyEvidenceNotifications().catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditAnomalyNotificationGenerateButton.disabled = false;
  els.auditAnomalyNotificationGenerateButton.textContent = 'Generate anomaly SLA';
}));
els.auditAnomalyDigestGenerateButton.addEventListener('click', () => generateAuditAnomalyNotificationDigest().catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditAnomalyDigestGenerateButton.disabled = false;
  els.auditAnomalyDigestGenerateButton.textContent = 'Anomaly digest';
}));
els.auditAnomalyDigestHtmlButton.addEventListener('click', openLatestAuditAnomalyNotificationDigestHtml);
els.auditAnomalyDigestScheduleSaveButton.addEventListener('click', () => saveAuditAnomalyDigestSchedule().catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditAnomalyDigestScheduleSaveButton.disabled = false;
  els.auditAnomalyDigestScheduleSaveButton.textContent = 'Save anomaly schedule';
}));
els.auditAnomalyDigestScheduleRunButton.addEventListener('click', () => runAuditAnomalyDigestSchedule().catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditAnomalyDigestScheduleRunButton.disabled = false;
  els.auditAnomalyDigestScheduleRunButton.textContent = 'Run anomaly schedule';
}));
els.auditAnomalyDigestPruneButton.addEventListener('click', () => pruneAuditAnomalyDigests().catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditAnomalyDigestPruneButton.disabled = false;
  els.auditAnomalyDigestPruneButton.textContent = 'Prune anomaly digests';
}));
els.auditAnomalyDigestReceiptButton.addEventListener('click', () => createAuditAnomalyDigestRetentionReceipt().catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditAnomalyDigestReceiptButton.disabled = false;
  els.auditAnomalyDigestReceiptButton.textContent = 'Anomaly receipt';
}));
els.auditCaseSlaFilterSelect.addEventListener('change', () => fetchAuditEvidenceCases()
  .then((cases) => {
    state.auditEvidenceCases = cases;
    renderAuditEvidenceCases();
  })
  .catch((error) => {
    els.auditEvidenceCaseStatus.textContent = error.message;
  }));
els.auditNotificationGenerateButton.addEventListener('click', () => generateAuditEvidenceNotifications().catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditNotificationGenerateButton.disabled = false;
  els.auditNotificationGenerateButton.textContent = 'Generate alerts';
}));
els.auditRuleSaveButton.addEventListener('click', () => saveAuditNotificationRule().catch((error) => {
  els.auditNotificationRuleStatus.textContent = error.message;
  els.auditRuleSaveButton.disabled = false;
  els.auditRuleSaveButton.textContent = 'Save rule';
}));
els.auditNotificationDeliverButton.addEventListener('click', () => deliverLatestAuditEvidenceNotification().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationDeliverButton.disabled = false;
  els.auditNotificationDeliverButton.textContent = 'Deliver stub';
}));
els.auditNotificationExplainButton.addEventListener('click', () => explainLatestAuditNotificationDelivery().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationExplainButton.disabled = false;
  els.auditNotificationExplainButton.textContent = 'Explain latest';
}));
els.auditNotificationReplayButton.addEventListener('click', () => replayLatestAuditNotificationDelivery(false).catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationReplayButton.disabled = false;
  els.auditNotificationReplayButton.textContent = 'Replay latest';
}));
els.auditNotificationForceReplayButton.addEventListener('click', () => replayLatestAuditNotificationDelivery(true).catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationForceReplayButton.disabled = false;
  els.auditNotificationForceReplayButton.textContent = 'Force replay';
}));
els.auditNotificationRequestReplayButton.addEventListener('click', () => requestLatestForceReplayApproval().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationRequestReplayButton.disabled = false;
  els.auditNotificationRequestReplayButton.textContent = 'Request force';
}));
els.auditNotificationApproveReplayButton.addEventListener('click', () => approveLatestForceReplayRequest().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationApproveReplayButton.disabled = false;
  els.auditNotificationApproveReplayButton.textContent = 'Approve request';
}));
els.auditNotificationRejectReplayButton.addEventListener('click', () => rejectLatestForceReplayRequest().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationRejectReplayButton.disabled = false;
  els.auditNotificationRejectReplayButton.textContent = 'Reject request';
}));
els.auditNotificationAssignReplayButton.addEventListener('click', () => assignLatestForceReplayRequest().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationAssignReplayButton.disabled = false;
  els.auditNotificationAssignReplayButton.textContent = 'Assign reviewer';
}));
els.auditNotificationExecuteReplayButton.addEventListener('click', () => executeLatestForceReplayApproval().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationExecuteReplayButton.disabled = false;
  els.auditNotificationExecuteReplayButton.textContent = 'Execute approved';
}));
els.auditNotificationCleanupExpiredButton.addEventListener('click', () => cleanupExpiredForceReplayRequests().catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationCleanupExpiredButton.disabled = false;
  els.auditNotificationCleanupExpiredButton.textContent = 'Cleanup expired';
}));
els.auditNotificationWorkloadAckButton.addEventListener('click', () => updateLatestReplayWorkloadAction('acknowledged').catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationWorkloadAckButton.disabled = false;
  els.auditNotificationWorkloadAckButton.textContent = 'Ack workload';
}));
els.auditNotificationWorkloadReassignButton.addEventListener('click', () => updateLatestReplayWorkloadAction('reassigned').catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationWorkloadReassignButton.disabled = false;
  els.auditNotificationWorkloadReassignButton.textContent = 'Reassign workload';
}));
els.auditNotificationWorkloadResolveButton.addEventListener('click', () => updateLatestReplayWorkloadAction('resolved').catch((error) => {
  els.auditNotificationDeliveryStatus.textContent = error.message;
  els.auditNotificationWorkloadResolveButton.disabled = false;
  els.auditNotificationWorkloadResolveButton.textContent = 'Resolve workload';
}));
els.auditNotificationApprovalStatusSelect.addEventListener('change', () => refreshDashboard({ preserveSelection: true }));
els.auditNotificationApprovalExpiredSelect.addEventListener('change', () => refreshDashboard({ preserveSelection: true }));
els.auditNotificationAckButton.addEventListener('click', () => updateLatestAuditEvidenceNotification('acked').catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditNotificationAckButton.disabled = false;
  els.auditNotificationAckButton.textContent = 'Ack latest';
}));
els.auditNotificationSnoozeButton.addEventListener('click', () => updateLatestAuditEvidenceNotification('snoozed').catch((error) => {
  els.auditNotificationStatus.textContent = error.message;
  els.auditNotificationSnoozeButton.disabled = false;
  els.auditNotificationSnoozeButton.textContent = 'Snooze latest';
}));
els.auditLoadViewButton.addEventListener('click', async () => {
  const view = selectedSavedView();
  if (!view) {
    els.auditFilterStatus.textContent = 'Select a saved view to load.';
    return;
  }
  applyAuditFiltersToForm(view.filters);
  els.auditSavedViewName.value = view.name;
  state.auditFilters = readAuditFilters();
  await refreshDashboard({ preserveSelection: true });
});
els.auditSaveViewButton.addEventListener('click', () => saveAuditView().catch((error) => {
  els.auditFilterStatus.textContent = error.message;
}));
els.auditDeleteViewButton.addEventListener('click', () => deleteAuditView().catch((error) => {
  els.auditFilterStatus.textContent = error.message;
}));
els.auditSavedViewSelect.addEventListener('change', () => {
  const view = selectedSavedView();
  els.auditSavedViewName.value = view?.name || '';
});
els.adminUserForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await submitAdminUserCreate();
});
refreshSession();
refreshDashboard();

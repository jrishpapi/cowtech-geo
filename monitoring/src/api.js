import Fastify from 'fastify';
import { getConfig } from './config.js';
import { pool, closeDb } from './db.js';
import { createRedisClient } from './redis.js';
import { collectHealth } from './health.js';
import { createHealthcheckJob, enqueueJob } from './jobs.js';
import { logger } from './logger.js';
import { createTrackingRun, getTrackingResults, getTrackingRun, listBrands } from './tracking.js';
import { registerCustomerTrackingRunBoundary } from './customer-tracking-run-boundary.js';
import { scheduleTrackingRuns } from './scheduling.js';
import { getTrackingRunSummary, getUsageSummary, listTrackingRuns } from './admin.js';
import { assertPaidProviderAllowed } from './provider-policy.js';
import { parseTrackingRunResults } from './parser.js';
import { scoreTrackingRun } from './scoring.js';
import { getTrackingRunReport } from './reporting.js';
import { generateContentOpportunities, listContentOpportunities } from './opportunities.js';
import { generateContentBriefs, listContentBriefs } from './briefs.js';
import { generateRunExecutionPlan } from './execution-plan.js';
import { discoverOpportunityPrompts, listOpportunityPrompts } from './opportunity-prompts.js';
import { listPromptPromotions, promoteOpportunityPrompts } from './prompt-promotions.js';
import { generateMonthlyReport, getMonthlyReport, listMonthlyReports } from './monthly-report.js';
import { generateArticleDrafts, listArticleDrafts } from './article-drafts.js';
import { expandArticleDrafts, listArticleDraftExpansions } from './article-draft-expansions.js';
import { listArticleQualityReviews, reviewArticleDraftExpansions } from './article-quality-reviews.js';
import { createDeepArticleEvidencePack, listDeepArticleEvidencePacks } from './deep-article-evidence.js';
import { generateArticleExports, listArticleExports } from './article-exports.js';
import { generateArticleExportPackages, listArticleExportPackages } from './article-export-packages.js';
import {
  generateArticlePublishHandoffs,
  listArticlePublishHandoffs,
  transitionArticlePublishHandoff
} from './article-publish-handoffs.js';
import { performCustomerArticleAction } from './article-customer-actions.js';
import { performOpsArticleAction } from './article-ops-actions.js';
import { performProductOpsAction } from './product-ops-actions.js';
import { buildOpsAuditCsv, getOpsAuditLog } from './ops-audit-log.js';
import { buildOpsAuditComplianceReportHtml, getOpsAuditComplianceReport } from './ops-audit-report.js';
import {
  buildOpsAuditEvidenceCasePacketHtml,
  buildEvidenceCaseReviewSummary,
  buildEvidenceCaseNotificationSummary,
  buildOpsAuditNotificationDeliverySummary,
  buildOpsAuditNotificationReplayEscalationReport,
  buildOpsAuditNotificationReplayEscalationReportHtml,
  buildOpsAuditEvidenceCaseAnomalyNotificationDigestHtml,
  buildOpsAuditNotificationReplayPerformanceReportHtml,
  buildOpsAuditNotificationReplaySlaAlertDigestHtml,
  buildOpsAuditNotificationReplaySlaAlertSummary,
  assignOpsAuditNotificationReplayApproval,
  cleanupExpiredOpsAuditNotificationReplayApprovals,
  createOpsAuditNotificationReplayApproval,
  createOpsAuditEvidenceCaseAnomalyNotificationDigest,
  createOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipt,
  createOpsAuditEvidenceCaseReview,
  createOpsAuditNotificationReplaySlaAlertDigestRetentionReceipt,
  createOpsAuditNotificationReplaySlaAlertDigest,
  createOpsAuditReportArchive,
  deliverOpsAuditEvidenceCaseNotifications,
  generateOpsAuditEvidenceCaseNotifications,
  generateOpsAuditNotificationReplaySlaAlerts,
  explainOpsAuditNotificationDeliveryAttempt,
  getOpsAuditEvidenceChain,
  getOpsAuditEvidenceCaseAnomalyNotificationDigest,
  getOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipt,
  getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule,
  getOpsAuditEvidenceCasePacket,
  getOpsAuditEvidenceCasePacketBundle,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosure,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrow,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocation,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustody,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarization,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestation,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSeal,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoff,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrow,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpoint,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSeal,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmation,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindow,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLock,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApproval,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSeal,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsal,
  getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipt,
  getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReview,
  getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipt,
  getOpsAuditEvidenceCasePacketBundleDeliveryGateReceipt,
  getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPreview,
  getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGate,
  getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipt,
  getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipt,
  getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReview,
  getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreview,
  getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipt,
  getOpsAuditEvidenceCasePacketBundleExport,
  getOpsAuditEvidenceCasePacketBundleExportDeliveryGate,
  getOpsAuditEvidenceCasePacketBundleExportDeliveryReadiness,
  getOpsAuditEvidenceCasePacketBundleExportReview,
  getOpsAuditEvidenceCasePacketBundleVerification,
  getOpsAuditEvidenceCaseReview,
  getOpsAuditEvidenceCaseReviewReceipt,
  getOpsAuditNotificationDeliveryAttempt,
  getOpsAuditNotificationPolicy,
  getOpsAuditNotificationReplayApproval,
  getOpsAuditNotificationReplayPerformanceReport,
  getOpsAuditNotificationReplayPerformanceThresholdPolicy,
  getOpsAuditNotificationReplayPolicy,
  getOpsAuditNotificationReplaySlaAlertDigest,
  getOpsAuditNotificationReplaySlaAlertDigestRetentionReceipt,
  getOpsAuditNotificationReplaySlaAlertDigestSchedule,
  getOpsAuditNotificationReplaySlaAlertSchedule,
  getOpsAuditNotificationReplayWorkload,
  getOpsAuditReportArchive,
  getOpsAuditReportVerification,
  listOpsAuditEvidenceCaseReviews,
  listOpsAuditEvidenceCaseAnomalyNotificationDigests,
  listOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipts,
  listOpsAuditEvidenceCaseReviewReceipts,
  listOpsAuditEvidenceCasePacketBundleVerifications,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipts,
  listOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipts,
  listOpsAuditEvidenceCasePacketBundleDeliveryGateReceipts,
  listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipts,
  listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipts,
  listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReviews,
  listOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipts,
  listOpsAuditEvidenceCasePacketBundleExports,
  listOpsAuditEvidenceCasePacketBundleExportReviews,
  listOpsAuditEvidenceCaseNotifications,
  listOpsAuditNotificationDeliveryAttempts,
  listOpsAuditNotificationReplayApprovals,
  listOpsAuditNotificationReplaySlaAlertDigests,
  listOpsAuditNotificationReplaySlaAlertDigestRetentionReceipts,
  listOpsAuditNotificationReplaySlaAlerts,
  listOpsAuditNotificationRules,
  listOpsAuditReportArchives,
  listOpsAuditReportVerifications,
  recordOpsAuditEvidenceCasePacketBundleVerification,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipt,
  recordOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipt,
  recordOpsAuditEvidenceCasePacketBundleDeliveryGateReceipt,
  recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipt,
  recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipt,
  recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReview,
  recordOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipt,
  recordOpsAuditEvidenceCasePacketBundleExport,
  recordOpsAuditEvidenceCasePacketBundleExportReview,
  recordOpsAuditEvidenceCaseReviewReceipt,
  recordOpsAuditReportTamperDrill,
  recordOpsAuditReportVerification,
  replayOpsAuditNotificationDeliveryAttempt,
  pruneOpsAuditEvidenceCaseAnomalyNotificationDigests,
  pruneOpsAuditNotificationReplaySlaAlertDigests,
  runOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule,
  runOpsAuditNotificationReplaySlaAlertDigestSchedule,
  runOpsAuditNotificationReplaySlaAlertSchedule,
  reviewOpsAuditNotificationReplayApproval,
  executeOpsAuditNotificationReplayApproval,
  updateOpsAuditNotificationPolicy,
  updateOpsAuditNotificationReplayPolicy,
  updateOpsAuditNotificationReplayPerformanceThresholdPolicy,
  updateOpsAuditNotificationReplaySlaAlert,
  updateOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule,
  updateOpsAuditNotificationReplaySlaAlertDigestSchedule,
  updateOpsAuditNotificationReplaySlaAlertSchedule,
  updateOpsAuditNotificationReplayWorkloadAction,
  updateOpsAuditNotificationRule,
  updateOpsAuditEvidenceCaseReview,
  updateOpsAuditEvidenceCaseNotification,
  upsertOpsAuditNotificationRule,
  verifyOpsAuditReportArchive
} from './ops-audit-report-archives.js';
import { getOpsDashboardAggregate, getOpsPromptDiscoveryQueue } from './ops-dashboard.js';
import { buildDeploymentReadiness } from './deployment-readiness.js';
import {
  compareArticleRetestSchedule,
  generateArticleRetestSchedules,
  listArticleRetestSchedules,
  queueDueArticleRetests
} from './article-retests.js';
import { generateArticleRetestReports, listArticleRetestReports } from './article-retest-reports.js';
import { generateArticleDeliveryTimelines, listArticleDeliveryTimelines } from './article-delivery-timelines.js';
import { getArticleDashboardAggregate, getArticleDashboardByDraft } from './article-dashboard.js';
import {
  generateArticleProductionHandoffs,
  listArticleProductionHandoffs,
  markArticleProductionHandoffSubmitted,
  recordArticleProductionCallback
} from './article-production-handoffs.js';
import {
  dispatchGeoFlowProductionHandoff,
  dispatchGeoFlowProductionHandoffsForRun,
  getGeoFlowReadinessForHandoff
} from './geoflow-connector.js';
import { getGeoFlowLiveDispatchGateForHandoff, runGeoFlowLiveDispatchPilot } from './geoflow-live-gate.js';
import { importGeoFlowProductionResult, importGeoFlowProductionResultsForRun } from './geoflow-import.js';
import { readCustomerDashboardAsset } from './customer-dashboard-static.js';
import { getCustomerArticleExportFile, getCustomerArticleReviewPayload } from './customer-article-review.js';
import {
  getCustomerPublishHandoffPayload,
  markCustomerPublishHandoffPublished
} from './customer-publish-handoff.js';
import {
  getCustomerRetestPayload,
  runDueCustomerRetests,
  scheduleCustomerRetest
} from './customer-retests.js';
import { getCustomerBriefsPayload } from './customer-briefs.js';
import { getCustomerMonthlyReportPayload } from './customer-monthly-report.js';
import { getCustomerOpportunitiesPayload } from './customer-opportunities.js';
import { getCustomerSetupPayload } from './customer-setup.js';
import { getCustomerVisibilityReportPayload } from './customer-visibility.js';
import {
  configureRecurringMonitoring,
  getCustomerMonitoringPayload,
  pauseRecurringMonitoring
} from './recurring-monitoring.js';
import {
  configureMonthlyFulfillment,
  getCustomerGodReportItem,
  getCustomerMonthlyFulfillmentPayload
} from './monthly-fulfillment.js';
import { getGodReportExport } from './god-report-exports.js';
import {
  applyCustomerEntitlement,
  applyCustomerAddon,
  getCustomerAddonSummary
} from './customer-addons.js';
import { cleanupSmokeCustomerEntitlement, getCustomerEntitlementSnapshot } from './customer-entitlements.js';
import {
  createEvidenceBackedPromptDiscoveryRun,
  createMultiSourcePromptDiscoveryRun,
  createMinimaxPromptDiscoveryRun,
  getPromptDiscoveryPayload
} from './prompt-discovery.js';
import {
  createPhase4ReportAnswer,
  evidenceOnlyPromptDiscovery,
  getPhase4DashboardPayload,
  persistPhase4DarkLoop,
  setPhase4CustomerEntitlement
} from './phase4-repository.js';
import {
  confirmPromptCandidates,
  performCustomerPromptDiscoveryAction
} from './customer-prompt-discovery-actions.js';
import { performOpsPromptDiscoveryAction } from './ops-prompt-discovery-actions.js';
import { getBillingAuthEntitlementPayload, listBillingAuthEntitlements, buildBillingAuthOverview } from './billing-auth-bridge.js';
import { getPaidProviderPilotReadiness } from './paid-provider-pilot-readiness.js';
import { runPaidProviderPilot } from './paid-provider-pilot.js';
import { buildProviderPolicyCalibration } from './provider-policy-calibration.js';
import {
  buildOpsRuntimeConfig,
  createOpsCustomerBrandIntake,
  getOpsControlCenterPayload,
  getOpsRuntimeSettings,
  runOpsFullTrackingTest,
  updateOpsRuntimeSettings
} from './ops-control-center.js';
import { readOpsDashboardAsset } from './ops-dashboard-static.js';
import { registerOpsInternalAuth } from './internal-auth.js';
import {
  createInternalAdminUser,
  getInternalAdminUserByUsername,
  listInternalAdminUsers,
  resetInternalAdminUserPassword,
  setInternalAdminUserDisabled,
  updateInternalAdminUser
} from './internal-admin-users.js';
import { buildInternalAdminAuditEvent, recordInternalAdminAuditEvent } from './internal-admin-audit-events.js';
import {
  buildOpsAuditRetentionPrunePlan,
  createOpsAuditSavedView,
  deleteOpsAuditSavedView,
  getOpsAuditRetentionSettings,
  listOpsAuditSavedViews,
  updateOpsAuditRetentionSettings,
  updateOpsAuditSavedView
} from './ops-audit-settings.js';

function sanitizeInternalAdminUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    display_name: user.display_name,
    disabled: Boolean(user.disabled_at),
    disabled_at: user.disabled_at,
    last_login_at: user.last_login_at
  };
}

function caseReviewActionFromStatusForApi(status) {
  if (status === 'resolved') return 'resolved';
  if (status === 'dismissed') return 'dismissed';
  return 'updated';
}

export function registerApiShutdownHandlers(
  app,
  {
    processRef = process,
    loggerInstance = logger,
    exitOnFailure = (code) => processRef.exit(code)
  } = {}
) {
  let shutdownPromise = null;

  const shutdown = (signal) => {
    if (shutdownPromise) return shutdownPromise;

    loggerInstance.info({ signal }, 'api graceful shutdown started');
    shutdownPromise = Promise.resolve()
      .then(() => app.close())
      .then(() => {
        processRef.exitCode = 0;
        loggerInstance.info({ signal }, 'api graceful shutdown completed');
      })
      .catch((error) => {
        processRef.exitCode = 1;
        loggerInstance.error({ error, signal }, 'api graceful shutdown failed');
        exitOnFailure(1);
      });
    return shutdownPromise;
  };

  const onSigterm = () => {
    void shutdown('SIGTERM');
  };
  const onSigint = () => {
    void shutdown('SIGINT');
  };

  processRef.on('SIGTERM', onSigterm);
  processRef.on('SIGINT', onSigint);

  return {
    shutdown,
    remove() {
      processRef.off('SIGTERM', onSigterm);
      processRef.off('SIGINT', onSigint);
    }
  };
}

export async function closeApiResources({ redis, closeDatabase = closeDb }) {
  const [redisResult, databaseResult] = await Promise.allSettled([
    Promise.resolve().then(() => redis.quit()),
    Promise.resolve().then(() => closeDatabase())
  ]);
  const errors = [];

  if (redisResult.status === 'rejected') {
    errors.push(redisResult.reason);
    try {
      redis.disconnect(false);
    } catch (error) {
      errors.push(error);
    }
  }
  if (databaseResult.status === 'rejected') {
    errors.push(databaseResult.reason);
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, 'API resources failed to close cleanly');
  }
}

export function buildApi() {
  const config = getConfig();
  const app = Fastify({
    loggerInstance: logger
  });
  const redis = createRedisClient();

  app.setErrorHandler((error, request, reply) => {
    if (['provider_not_configured', 'mock_provider_test_only'].includes(error.code)) {
      return reply.code(503).send({ ok: false, error: error.code, message: error.message });
    }
    if (error.code === 'paid_provider_not_allowed') {
      return reply.code(403).send({
        ok: false,
        error: error.code,
        message: error.message
      });
    }

    if (
      [
        'customer_article_action_not_allowed',
        'customer_prompt_candidate_id_required',
        'customer_prompt_candidate_not_found',
        'customer_prompt_candidate_already_confirmed',
        'customer_prompt_candidate_not_confirmable',
        'customer_prompt_discovery_action_not_allowed',
        'customer_prompt_discovery_confirm_candidates_required',
        'customer_prompt_discovery_context_not_found',
        'customer_prompt_discovery_edit_text_required',
        'customer_prompt_discovery_edit_text_too_short',
        'customer_prompt_discovery_edit_text_too_long',
        'customer_prompt_discovery_mixed_brand_confirmation',
        'customer_prompt_discovery_prompt_set_not_found',
        'customer_prompt_discovery_quota_exceeded',
        'ops_prompt_candidate_id_required',
        'ops_prompt_candidate_not_found',
        'ops_prompt_candidate_already_confirmed',
        'ops_prompt_candidate_not_confirmable',
        'ops_prompt_discovery_action_not_allowed',
        'ops_prompt_discovery_actor_required',
        'ops_prompt_discovery_reason_required',
        'ops_prompt_discovery_override_reason_required',
        'ops_prompt_discovery_edit_text_required',
        'ops_prompt_discovery_edit_text_too_short',
        'ops_prompt_discovery_edit_text_too_long',
        'ops_prompt_discovery_replace_text_required',
        'ops_prompt_discovery_replace_text_too_short',
        'ops_prompt_discovery_replace_text_too_long',
        'ops_prompt_discovery_context_not_found',
        'ops_prompt_discovery_prompt_set_not_found',
        'ops_prompt_discovery_quota_override_required',
        'ops_article_action_not_allowed',
        'product_ops_action_not_allowed',
        'product_ops_publish_handoff_id_required',
        'product_ops_retest_schedule_required',
        'product_ops_tracking_run_id_required',
        'product_ops_tracking_run_not_found',
        'product_ops_tracking_run_not_retryable',
        'product_ops_target_type_required',
        'product_ops_target_id_required',
        'invalid_publish_handoff_action',
        'invalid_publish_handoff_transition',
        'external_publish_confirmation_required',
        'retest_schedule_required',
        'article_publish_handoff_not_found',
        'invalid_internal_admin_role',
        'internal_admin_username_required',
        'internal_admin_password_too_short',
        'internal_admin_user_exists',
        'internal_admin_user_not_found',
        'internal_admin_audit_actor_required',
        'internal_admin_audit_target_required',
        'ops_audit_settings_actor_required',
        'ops_audit_saved_view_name_required',
        'ops_audit_saved_view_name_too_long',
        'ops_audit_saved_view_not_found',
        'ops_audit_retention_days_invalid',
        'ops_audit_report_archive_actor_required',
        'ops_audit_report_archive_not_found',
        'ops_audit_report_archive_verify_identifier_required',
        'ops_audit_report_verification_actor_required',
        'ops_audit_report_verification_identifier_required',
        'ops_audit_report_verification_not_found',
        'ops_audit_notification_replay_approval_actor_required',
        'ops_audit_notification_replay_approval_not_allowed',
        'ops_audit_notification_replay_approval_status_invalid',
        'ops_audit_notification_replay_approval_id_required',
        'ops_audit_notification_replay_approval_not_found',
        'ops_audit_notification_replay_approval_not_reviewable',
        'ops_audit_notification_replay_approval_not_executable',
        'ops_audit_notification_replay_approval_expired',
        'ops_audit_notification_replay_approval_self_review_not_allowed',
        'ops_audit_notification_replay_approval_reviewer_role_required',
        'ops_audit_notification_replay_approval_rejection_reason_required',
        'ops_audit_notification_replay_approval_assignee_required',
        'ops_audit_notification_replay_approval_assignee_role_invalid',
        'ops_audit_notification_replay_approval_not_assignable',
        'ops_audit_notification_replay_workload_action_invalid',
        'ops_audit_notification_replay_workload_action_not_open',
        'ops_audit_notification_replay_policy_disabled',
        'ops_audit_notification_replay_policy_role_invalid',
        'ops_audit_notification_replay_policy_ttl_invalid',
        'ops_audit_notification_replay_performance_threshold_actor_required',
        'ops_audit_notification_replay_performance_threshold_invalid',
        'ops_audit_notification_replay_sla_alert_actor_required',
        'ops_audit_notification_replay_sla_alert_status_invalid',
        'ops_audit_notification_replay_sla_alert_not_found',
        'ops_audit_notification_replay_sla_alert_schedule_actor_required',
        'ops_audit_notification_replay_sla_alert_schedule_invalid',
        'ops_audit_notification_replay_sla_alert_digest_actor_required',
        'ops_audit_notification_replay_sla_alert_digest_identifier_required',
        'ops_audit_notification_replay_sla_alert_digest_not_found',
        'ops_audit_notification_replay_sla_alert_digest_schedule_actor_required',
        'ops_audit_notification_replay_sla_alert_digest_retention_receipt_identifier_required',
        'ops_audit_notification_replay_sla_alert_digest_retention_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_export_identifier_required',
        'ops_audit_evidence_case_packet_bundle_export_not_found',
        'ops_audit_evidence_case_packet_bundle_export_review_export_required',
        'ops_audit_evidence_case_packet_bundle_export_review_reviewer_required',
        'ops_audit_evidence_case_packet_bundle_export_review_action_invalid',
        'ops_audit_evidence_case_packet_bundle_export_review_purpose_invalid',
        'ops_audit_evidence_case_packet_bundle_export_review_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_export_review_identifier_required',
        'ops_audit_evidence_case_packet_bundle_export_review_not_found',
        'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_final_receipt_required',
        'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_reviewer_required',
        'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_action_invalid',
        'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_identifier_required',
        'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_not_found',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_actor_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_recorder_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_decision_invalid',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_identifier_required',
        'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_not_found',
        'ops_audit_notification_force_replay_reason_required',
        'ops_control_brand_name_required',
        'ops_control_brand_website_required',
        'ops_control_prompt_required',
        'ops_control_plan_not_found',
        'ops_control_provider_mode_invalid',
        'ops_control_budget_invalid',
        'monthly_fulfillment_brand_not_found',
        'monthly_fulfillment_tracking_run_not_found'
      ].includes(error.code)
    ) {
      return reply.code(
        [
          'article_publish_handoff_not_found',
          'customer_prompt_candidate_not_found',
          'internal_admin_user_not_found',
          'ops_audit_saved_view_not_found',
          'ops_audit_report_archive_not_found',
          'ops_audit_report_verification_not_found',
          'ops_audit_evidence_case_packet_bundle_export_not_found',
          'ops_audit_evidence_case_packet_bundle_export_review_not_found',
          'ops_audit_evidence_case_packet_bundle_delivery_final_approval_review_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_not_found',
          'ops_audit_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_not_found',
          'ops_audit_notification_replay_approval_not_found',
          'ops_audit_notification_replay_sla_alert_not_found',
          'ops_audit_notification_replay_sla_alert_digest_not_found',
          'ops_audit_notification_replay_sla_alert_digest_retention_receipt_not_found',
          'monthly_fulfillment_brand_not_found',
          'monthly_fulfillment_tracking_run_not_found'
        ].includes(error.code)
          ? 404
          : 400
      ).send({
        ok: false,
        error: error.code,
        message: error.message
      });
    }

    request.log.error({ error }, 'request failed');
    return reply.code(500).send({
      ok: false,
      error: error.code || 'internal_error',
      message: error.message
    });
  });

  app.addHook('onClose', async () => {
    await closeApiResources({ redis });
  });

  registerOpsInternalAuth(app, config);
  registerCustomerTrackingRunBoundary(app);

  app.get('/health', async () => collectHealth(redis));

  app.get('/ready', async (request, reply) => {
    const health = await collectHealth(redis);
    if (!health.ok) {
      return reply.code(503).send(health);
    }
    return health;
  });

  app.get('/dashboard/articles', async (_request, reply) => {
    const asset = await readCustomerDashboardAsset('index.html');
    return reply.type(asset.contentType).send(asset.body);
  });

  app.get('/dashboard/setup', async (_request, reply) => {
    const asset = await readCustomerDashboardAsset('index.html');
    return reply.type(asset.contentType).send(asset.body);
  });

  app.get('/dashboard/articles/:asset', async (request, reply) => {
    const allowed = new Set(['styles.css', 'app.js']);
    if (!allowed.has(request.params.asset)) {
      return reply.code(404).send({ ok: false, error: 'dashboard asset not found' });
    }
    const asset = await readCustomerDashboardAsset(request.params.asset);
    return reply.type(asset.contentType).send(asset.body);
  });

  app.get('/dashboard/setup-data', async (request, reply) => {
    const setup = await getCustomerSetupPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!setup) {
      return reply.code(404).send({ ok: false, error: 'customer setup not found' });
    }
    return { ok: true, setup };
  });

  app.get('/dashboard/billing-auth-data', async (request, reply) => {
    const billing_auth = await getBillingAuthEntitlementPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!billing_auth) {
      return reply.code(404).send({ ok: false, error: 'billing auth bridge not found' });
    }
    return { ok: true, billing_auth };
  });

  app.get('/dashboard/visibility-data', async (request, reply) => {
    const visibility = await getCustomerVisibilityReportPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!visibility) {
      return reply.code(404).send({ ok: false, error: 'visibility report not found' });
    }
    return { ok: true, visibility };
  });

  app.get('/dashboard/monitoring-data', async (request, reply) => {
    const monitoring = await getCustomerMonitoringPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!monitoring) {
      return reply.code(404).send({ ok: false, error: 'monitoring payload not found' });
    }
    return { ok: true, monitoring };
  });

  app.post('/dashboard/monitoring/configure', async (request) => {
    const body = request.body || {};
    const config = await configureRecurringMonitoring({
      run_id: body.run_id,
      brand_id: body.brand_id,
      brand_name: body.brand_name,
      cadence_days: body.cadence_days,
      provider_mode: body.provider_mode || 'unconfigured',
      allow_paid_provider: body.allow_paid_provider === true,
      status: body.status || 'active',
      engine_group: body.engine_group,
      region: body.region || 'US',
      language: body.language || 'en',
      alert_thresholds: body.alert_thresholds || {},
      surface_cycle: Array.isArray(body.surface_cycle) ? body.surface_cycle : []
    });
    return {
      ok: true,
      config,
      monitoring: await getCustomerMonitoringPayload({
        run_id: body.run_id,
        brand_id: body.brand_id || config.brand_id,
        brand_name: body.brand_name
      })
    };
  });

  app.post('/dashboard/monitoring/pause', async (request) => {
    const body = request.body || {};
    const config = await pauseRecurringMonitoring({
      run_id: body.run_id,
      brand_id: body.brand_id,
      brand_name: body.brand_name
    });
    return {
      ok: true,
      config,
      monitoring: await getCustomerMonitoringPayload({
        run_id: body.run_id,
        brand_id: body.brand_id || config?.brand_id,
        brand_name: body.brand_name
      })
    };
  });

  app.get('/dashboard/opportunities-data', async (request, reply) => {
    const opportunities = await getCustomerOpportunitiesPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!opportunities) {
      return reply.code(404).send({ ok: false, error: 'opportunities not found' });
    }
    return { ok: true, opportunities };
  });

  app.get('/dashboard/prompt-discovery-data', async (request, reply) => {
    const prompt_discovery = await getPromptDiscoveryPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      discovery_run_id: request.query?.discovery_run_id,
      customer_visible_only: true
    });
    if (!prompt_discovery) {
      return reply.code(404).send({ ok: false, error: 'prompt discovery not found' });
    }
    return { ok: true, prompt_discovery: evidenceOnlyPromptDiscovery(prompt_discovery) };
  });

  app.get('/dashboard/phase4-data', async (request, reply) => {
    const phase4 = await getPhase4DashboardPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!phase4) {
      return reply.code(404).send({ ok: false, error: 'phase4 workspace not found' });
    }
    return { ok: true, phase4 };
  });

  app.post('/dashboard/phase4/dark-loop', async (request, reply) => {
    const body = request.body || {};
    const pages = Array.isArray(body.pages) ? body.pages : [];
    if (pages.length < 1 || pages.length > 3) {
      return reply.code(400).send({ ok: false, error: 'phase4 requires one to three page snapshots' });
    }
    if (pages.some((page) => String(page.html || '').length > 1_000_000)) {
      return reply.code(413).send({ ok: false, error: 'phase4 page snapshot exceeds 1 MB' });
    }
    let result;
    try {
      result = await persistPhase4DarkLoop({
        brand_id: body.brand_id,
        brand_name: body.brand_name,
        run_id: body.run_id,
        pages,
        metric_evidence: body.metric_evidence,
        observations: body.observations,
        plan: body.plan,
        reviewer_id: body.reviewer_id
      }, {
        actor: body.actor || 'customer_dashboard'
      });
    } catch (error) {
      if (['phase4_entitlement_required', 'phase4_dry_run_feature_disabled'].includes(error.code)) {
        return reply.code(403).send({ ok: false, error: error.code });
      }
      if (error.code === 'phase4_workspace_not_found') {
        return reply.code(404).send({ ok: false, error: error.code });
      }
      throw error;
    }
    return reply.code(201).send({
      ok: true,
      phase4: {
        schema_version: result.schema_version,
        mode: result.mode,
        exit_handoff: result.exit_handoff,
        external_calls_executed: result.external_calls_executed,
        real_publish_executed: result.real_publish_executed
      }
    });
  });

  app.post('/dashboard/phase4/report-qa', async (request, reply) => {
    const body = request.body || {};
    if (!String(body.question || '').trim()) {
      return reply.code(400).send({ ok: false, error: 'phase4 report question is required' });
    }
    try {
      return {
        ok: true,
        response: await createPhase4ReportAnswer({
          brand_id: body.brand_id,
          brand_name: body.brand_name,
          run_id: body.run_id,
          conversation_id: body.conversation_id,
          question: String(body.question).trim()
        }, {
          actor: body.actor || 'customer_dashboard'
        })
      };
    } catch (error) {
      if (error.code === 'phase4_report_qa_entitlement_required') {
        return reply.code(403).send({ ok: false, error: error.code });
      }
      if (['phase4_workspace_not_found', 'phase4_conversation_not_found'].includes(error.code)) {
        return reply.code(404).send({ ok: false, error: error.code });
      }
      throw error;
    }
  });

  app.post('/dashboard/prompt-discovery/candidates/:id/action', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await performCustomerPromptDiscoveryAction({
        candidate_id: request.params.id,
        action: body.action,
        actor: body.actor || 'customer_dashboard',
        note: body.note,
        edited_text: body.edited_text,
        idempotency_key: body.idempotency_key
      })
    };
  });

  app.post('/dashboard/prompt-discovery/confirm', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await confirmPromptCandidates({
        candidate_ids: body.candidate_ids,
        discovery_run_id: body.discovery_run_id,
        brand_id: body.brand_id,
        brand_name: body.brand_name,
        actor: body.actor || 'customer_dashboard',
        note: body.note,
        idempotency_key: body.idempotency_key
      })
    };
  });

  app.get('/dashboard/briefs-data', async (request, reply) => {
    const briefs = await getCustomerBriefsPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id,
      opportunity_id: request.query?.opportunity_id
    });
    if (!briefs) {
      return reply.code(404).send({ ok: false, error: 'briefs not found' });
    }
    return { ok: true, briefs };
  });

  app.get('/dashboard/monthly-report-data', async (request, reply) => {
    const monthly_report = await getCustomerMonthlyReportPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!monthly_report) {
      return reply.code(404).send({ ok: false, error: 'monthly report not found' });
    }
    return { ok: true, monthly_report };
  });

  app.get('/dashboard/monthly-fulfillment-data', async (request, reply) => {
    const monthly_fulfillment = await getCustomerMonthlyFulfillmentPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id
    });
    if (!monthly_fulfillment) {
      return reply.code(404).send({ ok: false, error: 'monthly fulfillment not found' });
    }
    return { ok: true, monthly_fulfillment };
  });

  app.post('/dashboard/monthly-fulfillment/configure', async (request) => {
    const body = request.body || {};
    const monthly_fulfillment = await configureMonthlyFulfillment({
      run_id: body.run_id,
      brand_id: body.brand_id,
      brand_name: body.brand_name,
      plan_code: body.plan_code,
      plan_contract: body.plan_contract || {},
      scheduled_for: body.scheduled_for,
      cycle_month: body.cycle_month
    });
    return { ok: true, monthly_fulfillment };
  });

  app.get('/dashboard/article-review-data', async (request, reply) => {
    const article_review = await getCustomerArticleReviewPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id,
      article_draft_id: request.query?.article_draft_id
    });
    if (!article_review) {
      return reply.code(404).send({ ok: false, error: 'article review not found' });
    }
    return { ok: true, article_review };
  });

  app.get('/dashboard/article-export-files/:package_id/:filename', async (request, reply) => {
    const file = await getCustomerArticleExportFile({
      package_id: request.params.package_id,
      filename: request.params.filename
    });
    if (!file) {
      return reply.code(404).send({ ok: false, error: 'article export file not found' });
    }

    const safeFilename = file.filename.replaceAll('"', '');
    return reply
      .type(file.content_type)
      .header('Content-Disposition', `attachment; filename="${safeFilename}"`)
      .send(file.body);
  });

  app.get('/dashboard/publish-handoff-data', async (request, reply) => {
    const publish_handoff = await getCustomerPublishHandoffPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id,
      article_draft_id: request.query?.article_draft_id
    });
    if (!publish_handoff) {
      return reply.code(404).send({ ok: false, error: 'publish handoff not found' });
    }
    return { ok: true, publish_handoff };
  });

  app.post('/dashboard/publish-handoffs/:id/mark-published', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await markCustomerPublishHandoffPublished({
        handoff_id: request.params.id,
        url: body.url,
        external_reference: body.external_reference,
        published_at: body.published_at,
        actor: body.actor || 'customer_dashboard',
        note: body.note
      })
    };
  });

  app.get('/dashboard/retest-data', async (request, reply) => {
    const retest = await getCustomerRetestPayload({
      brand_id: request.query?.brand_id,
      brand_name: request.query?.brand_name,
      run_id: request.query?.run_id,
      article_draft_id: request.query?.article_draft_id,
      due_at: request.query?.due_at
    });
    if (!retest) {
      return reply.code(404).send({ ok: false, error: 'retest not found' });
    }
    return { ok: true, retest };
  });

  app.post('/dashboard/publish-handoffs/:id/schedule-retest', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await scheduleCustomerRetest({
        handoff_id: request.params.id,
        scheduled_for: body.scheduled_for,
        actor: body.actor || 'customer_dashboard',
        note: body.note
      })
    };
  });

  app.post('/dashboard/retests/run-due', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await runDueCustomerRetests({
        redis,
        due_at: body.due_at,
        limit: body.limit
      })
    };
  });

  app.get('/internal/ops/dashboard-ui', async (_request, reply) => {
    const asset = await readOpsDashboardAsset('index.html');
    return reply.type(asset.contentType).send(asset.body);
  });

  app.get('/internal/ops/dashboard-ui/:asset', async (request, reply) => {
    const allowed = new Set(['styles.css', 'app.js']);
    if (!allowed.has(request.params.asset)) {
      return reply.code(404).send({ ok: false, error: 'ops dashboard asset not found' });
    }
    const asset = await readOpsDashboardAsset(request.params.asset);
    return reply.type(asset.contentType).send(asset.body);
  });

  app.post('/internal/smoke/jobs', async () => {
    const job = await enqueueJob(redis, createHealthcheckJob('api-smoke'));
    return { ok: true, job };
  });

  app.get('/internal/smoke/health-checks', async () => {
    const result = await pool.query(
      `SELECT id, source, status, details, created_at
       FROM health_checks
       ORDER BY created_at DESC
       LIMIT 20`
    );
    return { ok: true, rows: result.rows };
  });

  app.get('/internal/brands', async () => {
    return { ok: true, rows: await listBrands() };
  });

  app.post('/internal/tracking/runs', async (request) => {
    const body = request.body || {};
    const providerMode = body.provider_mode || 'unconfigured';
    assertPaidProviderAllowed({
      provider_mode: providerMode,
      allow_paid_provider: body.allow_paid_provider === true
    });
    const run = await createTrackingRun({
      brand_id: body.brand_id,
      brand_name: body.brand_name,
      run_type: body.run_type || 'manual',
      idempotency_key: body.idempotency_key
    });
    const job = await enqueueJob(redis, {
      id: run.id,
      type: 'tracking.run',
      tracking_run_id: run.id,
      provider_mode: providerMode,
      allow_paid_provider: body.allow_paid_provider === true,
      created_at: new Date().toISOString()
    });
    return { ok: true, run, job };
  });

  app.get('/internal/tracking/runs', async (request) => {
    return { ok: true, rows: await listTrackingRuns({ limit: request.query?.limit }) };
  });

  app.get('/internal/tracking/runs/:id', async (request, reply) => {
    const run = await getTrackingRun(request.params.id);
    if (!run) {
      return reply.code(404).send({ ok: false, error: 'tracking run not found' });
    }
    return { ok: true, ...run };
  });

  app.get('/internal/tracking/runs/:id/summary', async (request, reply) => {
    const summary = await getTrackingRunSummary(request.params.id);
    if (!summary) {
      return reply.code(404).send({ ok: false, error: 'tracking run not found' });
    }
    return { ok: true, ...summary };
  });

  app.get('/internal/tracking/runs/:id/report', async (request, reply) => {
    const report = await getTrackingRunReport(request.params.id);
    if (!report) {
      return reply.code(404).send({ ok: false, error: 'tracking run not found' });
    }
    return { ok: true, report };
  });

  app.post('/internal/tracking/runs/:id/execution-plan', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await generateRunExecutionPlan(request.params.id, {
        brief_priority: body.brief_priority || 'high'
      })
    };
  });

  app.get('/internal/tracking/runs/:id/results', async (request) => {
    return { ok: true, rows: await getTrackingResults(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/parse', async (request) => {
    return { ok: true, result: await parseTrackingRunResults(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/score', async (request) => {
    return { ok: true, result: await scoreTrackingRun(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/opportunities', async (request) => {
    return { ok: true, result: await generateContentOpportunities(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/opportunities', async (request) => {
    return { ok: true, rows: await listContentOpportunities(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/briefs', async (request) => {
    return { ok: true, result: await generateContentBriefs(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/briefs', async (request) => {
    return { ok: true, rows: await listContentBriefs(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/opportunity-prompts', async (request) => {
    return { ok: true, result: await discoverOpportunityPrompts(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/opportunity-prompts', async (request) => {
    return { ok: true, rows: await listOpportunityPrompts(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/promotions', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await promoteOpportunityPrompts(request.params.id, {
        score_threshold: body.score_threshold,
        max_promotions: body.max_promotions,
        change_reason: body.change_reason
      })
    };
  });

  app.get('/internal/tracking/runs/:id/promotions', async (request) => {
    return { ok: true, rows: await listPromptPromotions(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/monthly-report', async (request) => {
    const body = request.body || {};
    return { ok: true, report: await generateMonthlyReport(request.params.id, { generated_at: body.generated_at }) };
  });

  app.get('/internal/tracking/runs/:id/monthly-report', async (request, reply) => {
    const report = await getMonthlyReport(request.params.id);
    if (!report) {
      return reply.code(404).send({ ok: false, error: 'monthly report not found' });
    }
    return { ok: true, report };
  });

  app.get('/internal/brands/:id/monthly-reports', async (request) => {
    return { ok: true, rows: await listMonthlyReports({ brand_id: request.params.id, limit: request.query?.limit }) };
  });

  app.post('/internal/tracking/runs/:id/article-drafts', async (request) => {
    return { ok: true, result: await generateArticleDrafts(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-drafts', async (request) => {
    return { ok: true, rows: await listArticleDrafts(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/article-production-handoffs', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await generateArticleProductionHandoffs(request.params.id, {
        provider: body.provider || 'geoflow'
      })
    };
  });

  app.get('/internal/tracking/runs/:id/article-production-handoffs', async (request) => {
    return { ok: true, rows: await listArticleProductionHandoffs(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/geoflow-dispatch', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await dispatchGeoFlowProductionHandoffsForRun(request.params.id, {
        dry_run: body.dry_run !== false,
        allow_live_geoflow: body.allow_live_geoflow === true,
        actor: body.actor
      })
    };
  });

  app.post('/internal/tracking/runs/:id/geoflow-imports', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await importGeoFlowProductionResultsForRun(request.params.id, {
        review_import: body.review_import === true,
        human_review_status: body.human_review_status || 'pending'
      })
    };
  });

  app.post('/internal/article-production-handoffs/:id/submit', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      handoff: await markArticleProductionHandoffSubmitted(request.params.id, {
        actor: body.actor,
        provider_job_id: body.provider_job_id,
        external_job_url: body.external_job_url,
        note: body.note
      })
    };
  });

  app.post('/internal/article-production-handoffs/:id/callback', async (request) => {
    return {
      ok: true,
      handoff: await recordArticleProductionCallback(request.params.id, request.body || {})
    };
  });

  app.post('/internal/article-production-handoffs/:id/geoflow-dispatch', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await dispatchGeoFlowProductionHandoff(request.params.id, {
        dry_run: body.dry_run !== false,
        allow_live_geoflow: body.allow_live_geoflow === true,
        actor: body.actor
      })
    };
  });

  app.get('/internal/ops/geoflow-readiness/:id', async (request) => {
    return {
      ok: true,
      readiness: await getGeoFlowReadinessForHandoff(request.params.id)
    };
  });

  app.get('/internal/ops/geoflow-live-dispatch-gate/:id', async (request) => {
    return {
      ok: true,
      gate: await getGeoFlowLiveDispatchGateForHandoff(request.params.id, {
        requested_pilot_jobs: request.query?.requested_pilot_jobs
      })
    };
  });

  app.post('/internal/ops/geoflow-live-dispatch-pilot/:id', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await runGeoFlowLiveDispatchPilot(request.params.id, {
        actor: body.actor,
        allow_live_geoflow: body.allow_live_geoflow === true,
        execute_live: body.execute_live === true,
        explicit_same_turn_approval: body.explicit_same_turn_approval === true,
        approval_phrase: body.approval_phrase,
        requested_pilot_jobs: body.requested_pilot_jobs
      })
    };
  });

  app.post('/internal/article-production-handoffs/:id/import', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await importGeoFlowProductionResult(request.params.id, {
        review_import: body.review_import === true,
        human_review_status: body.human_review_status || 'pending'
      })
    };
  });

  app.post('/internal/tracking/runs/:id/article-draft-expansions', async (request) => {
    const body = request.body || {};
    const providerMode = body.provider_mode || 'unconfigured';
    assertPaidProviderAllowed({
      provider_mode: providerMode,
      allow_paid_provider: body.allow_paid_provider === true
    });
    return { ok: true, result: await expandArticleDrafts(request.params.id, { provider_mode: providerMode }) };
  });

  app.get('/internal/tracking/runs/:id/article-draft-expansions', async (request) => {
    return { ok: true, rows: await listArticleDraftExpansions(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/article-quality-reviews', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await reviewArticleDraftExpansions(request.params.id, {
        human_review_status: body.human_review_status || 'pending'
      })
    };
  });

  app.get('/internal/tracking/runs/:id/article-quality-reviews', async (request) => {
    return { ok: true, rows: await listArticleQualityReviews(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/deep-article-evidence-packs', async (request) => {
    const body = request.body || {};
    const providerMode = body.provider_mode || 'unconfigured';
    return {
      ok: true,
      row: await createDeepArticleEvidencePack({
        ...body,
        tracking_run_id: request.params.id,
        provider_mode: providerMode,
        allow_paid_provider: body.allow_paid_provider === true
      })
    };
  });

  app.get('/internal/tracking/runs/:id/deep-article-evidence-packs', async (request) => {
    return { ok: true, rows: await listDeepArticleEvidencePacks(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/article-exports', async (request) => {
    return { ok: true, result: await generateArticleExports(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-exports', async (request) => {
    return { ok: true, rows: await listArticleExports(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/article-export-packages', async (request) => {
    return { ok: true, result: await generateArticleExportPackages(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-export-packages', async (request) => {
    return { ok: true, rows: await listArticleExportPackages(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/article-publish-handoffs', async (request) => {
    return { ok: true, result: await generateArticlePublishHandoffs(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-publish-handoffs', async (request) => {
    return { ok: true, rows: await listArticlePublishHandoffs(request.params.id) };
  });

  app.post('/internal/article-publish-handoffs/:id/transition', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      handoff: await transitionArticlePublishHandoff(request.params.id, body.action, {
        actor: body.actor,
        note: body.note,
        channel: body.channel,
        instructions: body.instructions,
        url: body.url,
        external_reference: body.external_reference,
        published_at: body.published_at,
        scheduled_for: body.scheduled_for
      })
    };
  });

  app.post('/internal/article-publish-handoffs/:id/customer-action', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      result: await performCustomerArticleAction({
        handoff_id: request.params.id,
        action: body.action,
        actor: body.actor || 'customer_dashboard',
        note: body.note
      })
    };
  });

  app.post('/internal/article-publish-handoffs/:id/ops-action', async (request) => {
    const body = request.body || {};
    const internalActor = request.internalAdmin
      ? `${request.internalAdmin.username}:${request.internalAdmin.role}`
      : body.actor || 'ops_dashboard';
    return {
      ok: true,
      result: await performOpsArticleAction({
        handoff_id: request.params.id,
        action: body.action,
        actor: internalActor,
        note: body.note,
        channel: body.channel,
        instructions: body.instructions,
        url: body.url,
        external_reference: body.external_reference,
        published_at: body.published_at,
        scheduled_for: body.scheduled_for,
        create_retest_schedule: body.create_retest_schedule !== false
      })
    };
  });

  app.post('/internal/ops/product-actions', async (request) => {
    const body = request.body || {};
    const internalActor = request.internalAdmin
      ? `${request.internalAdmin.username}:${request.internalAdmin.role}`
      : body.actor || 'ops_dashboard';
    return {
      ok: true,
      result: await performProductOpsAction({
        ...body,
        actor: internalActor,
        redis
      })
    };
  });

  app.post('/internal/tracking/runs/:id/article-retests', async (request) => {
    return { ok: true, result: await generateArticleRetestSchedules(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-retests', async (request) => {
    return { ok: true, rows: await listArticleRetestSchedules(request.params.id) };
  });

  app.post('/internal/article-retests/queue-due', async (request) => {
    const body = request.body || {};
    const providerMode = body.provider_mode || 'unconfigured';
    assertPaidProviderAllowed({
      provider_mode: providerMode,
      allow_paid_provider: body.allow_paid_provider === true
    });
    return {
      ok: true,
      result: await queueDueArticleRetests({
        redis,
        due_at: body.due_at,
        provider_mode: providerMode,
        allow_paid_provider: body.allow_paid_provider === true,
        limit: body.limit
      })
    };
  });

  app.post('/internal/article-retests/:id/compare', async (request) => {
    return { ok: true, result: await compareArticleRetestSchedule(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/article-retest-reports', async (request) => {
    return { ok: true, result: await generateArticleRetestReports(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-retest-reports', async (request) => {
    return { ok: true, rows: await listArticleRetestReports(request.params.id) };
  });

  app.post('/internal/tracking/runs/:id/article-delivery-timelines', async (request) => {
    return { ok: true, result: await generateArticleDeliveryTimelines(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-delivery-timelines', async (request) => {
    return { ok: true, rows: await listArticleDeliveryTimelines(request.params.id) };
  });

  app.get('/internal/tracking/runs/:id/article-dashboard', async (request) => {
    return {
      ok: true,
      dashboard: await getArticleDashboardAggregate(request.params.id, {
        article_draft_id: request.query?.article_draft_id
      })
    };
  });

  app.get('/internal/article-drafts/:id/dashboard', async (request) => {
    return { ok: true, dashboard: await getArticleDashboardByDraft(request.params.id) };
  });

  app.get('/internal/ops/dashboard', async (request) => {
    return {
      ok: true,
      dashboard: await getOpsDashboardAggregate({
        limit: request.query?.limit,
        limit_per_queue: request.query?.limit_per_queue
      })
    };
  });

  app.get('/internal/ops/prompt-discovery', async (request) => {
    return {
      ok: true,
      prompt_discovery_queue: await getOpsPromptDiscoveryQueue({
        limit: request.query?.limit,
        limit_per_run: request.query?.limit_per_run
      })
    };
  });

  app.post('/internal/ops/prompt-discovery/candidates/:id/action', async (request) => {
    const body = request.body || {};
    const internalActor = request.internalAdmin
      ? `${request.internalAdmin.username}:${request.internalAdmin.role}`
      : body.actor || 'ops_dashboard';
    return {
      ok: true,
      result: await performOpsPromptDiscoveryAction({
        candidate_id: request.params.id,
        action: body.action,
        actor: internalActor,
        reason: body.reason,
        note: body.note,
        edited_text: body.edited_text,
        replacement_text: body.replacement_text,
        override_quota: body.override_quota === true,
        idempotency_key: body.idempotency_key
      })
    };
  });

  app.post('/internal/ops/prompt-discovery/generate', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      prompt_discovery: await createMinimaxPromptDiscoveryRun({
        brand_id: body.brand_id,
        brand_name: body.brand_name,
        candidate_count: body.candidate_count,
        includeOperator: true,
        idempotency_key: body.idempotency_key
      })
    };
  });

  app.post('/internal/ops/prompt-discovery/generate-evidence-backed', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      prompt_discovery: await createEvidenceBackedPromptDiscoveryRun({
        brand_id: body.brand_id,
        brand_name: body.brand_name,
        candidate_count: body.candidate_count,
        queries: Array.isArray(body.queries) ? body.queries : undefined,
        includeOperator: true,
        idempotency_key: body.idempotency_key
      })
    };
  });

  app.post('/internal/ops/prompt-discovery/generate-multi-source-evidence', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      prompt_discovery: await createMultiSourcePromptDiscoveryRun({
        brand_id: body.brand_id,
        brand_name: body.brand_name,
        candidate_count: body.candidate_count,
        queries: Array.isArray(body.queries) ? body.queries : undefined,
        include_openrouter_ai_surface: body.include_openrouter_ai_surface !== false,
        use_web_search: body.use_web_search === true,
        includeOperator: true,
        idempotency_key: body.idempotency_key
      })
    };
  });

  app.get('/internal/ops/deployment-readiness', async () => {
    return {
      ok: true,
      readiness: buildDeploymentReadiness()
    };
  });

  app.get('/internal/ops/billing-auth-bridge', async (request) => {
    const entitlements = await listBillingAuthEntitlements({ limit: request.query?.limit });
    return {
      ok: true,
      billing_auth: buildBillingAuthOverview(entitlements)
    };
  });

  app.get('/internal/ops/control-center', async () => {
    return {
      ok: true,
      control_center: await getOpsControlCenterPayload()
    };
  });

  app.patch('/internal/ops/control-center/settings', async (request) => {
    const actor = request.internalAdmin
      ? `${request.internalAdmin.username}:${request.internalAdmin.role}`
      : 'ops_dashboard';
    const settings = await updateOpsRuntimeSettings(request.body || {}, actor);
    return {
      ok: true,
      control_center: await getOpsControlCenterPayload({ settings })
    };
  });

  app.post('/internal/ops/control-center/customers', async (request) => {
    const actor = request.internalAdmin
      ? `${request.internalAdmin.username}:${request.internalAdmin.role}`
      : 'ops_dashboard';
    return {
      ok: true,
      intake: await createOpsCustomerBrandIntake(request.body || {}, actor),
      control_center: await getOpsControlCenterPayload()
    };
  });

  app.post('/internal/ops/control-center/customer-entitlements', async (request) => {
    return {
      ok: true,
      entitlement: await applyCustomerEntitlement(request.body || {})
    };
  });

  app.get('/internal/ops/control-center/customer-entitlements', async (request, reply) => {
    try {
      const entitlement = await getCustomerEntitlementSnapshot({
        customer_id: request.query?.customer_id,
        external_customer_id: request.query?.external_customer_id,
        email: request.query?.email,
        brand_id: request.query?.brand_id,
        run_id: request.query?.run_id,
        cycle_month: request.query?.cycle_month
      });
      if (!entitlement) {
        return reply.code(404).send({ ok: false, error: 'customer_entitlement_not_found' });
      }
      return { ok: true, entitlement };
    } catch (error) {
      if (error?.code === 'customer_selector_required') {
        return reply.code(400).send({
          ok: false,
          error: error.code,
          message: 'Provide customer_id, external_customer_id, email, brand_id, or run_id.'
        });
      }
      throw error;
    }
  });

  app.post('/internal/ops/control-center/phase4-entitlements', async (request) => {
    const body = request.body || {};
    const actor = request.internalAdmin
      ? `${request.internalAdmin.username}:${request.internalAdmin.role}`
      : 'internal_ops';
    return {
      ok: true,
      entitlement: await setPhase4CustomerEntitlement(body, { actor })
    };
  });

  app.get('/internal/ops/control-center/monthly-fulfillment-items/:item_id/exports/:format', async (request, reply) => {
    const report = await getGodReportExport({
      item_id: request.params.item_id,
      tracking_run_id: request.query?.run_id,
      format: request.params.format
    });
    if (!report) {
      return reply.code(404).send({ ok: false, error: 'god_report_export_not_found' });
    }

    const safeFilename = String(report.filename || 'cowtech-god-report')
      .replace(/[^a-zA-Z0-9._-]/gu, '-')
      .replace(/-+/gu, '-')
      .slice(0, 160);
    return reply
      .type(report.content_type)
      .header('Content-Disposition', `attachment; filename="${safeFilename}"`)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(report.body);
  });

  app.get('/internal/ops/control-center/monthly-fulfillment-items/:item_id', async (request, reply) => {
    const item = await getCustomerGodReportItem({
      item_id: request.params.item_id,
      tracking_run_id: request.query?.run_id
    });
    if (!item) {
      return reply.code(404).send({ ok: false, error: 'god_report_item_not_found' });
    }
    return { ok: true, item };
  });

  app.post('/internal/ops/control-center/smoke-cleanup', async (request) => {
    return {
      ok: true,
      cleanup: await cleanupSmokeCustomerEntitlement({
        email: request.body?.email
      })
    };
  });

  app.post('/internal/ops/control-center/customer-addons', async (request) => {
    return {
      ok: true,
      addon: await applyCustomerAddon(request.body || {})
    };
  });

  app.get('/internal/ops/control-center/customer-addons', async (request) => {
    const addon = await getCustomerAddonSummary({
      external_customer_id: request.query?.external_customer_id,
      email: request.query?.email,
      customer_id: request.query?.customer_id,
      cycle_month: request.query?.cycle_month
    });
    if (!addon) {
      return { ok: false, error: 'customer_addons_not_found' };
    }
    return { ok: true, addon };
  });

  app.post('/internal/ops/control-center/full-tracking-test', async (request) => {
    const body = request.body || {};
    const settings = await getOpsRuntimeSettings();
    return {
      ok: true,
      full_tracking_test: await runOpsFullTrackingTest({
        brand_name: body.brand_name,
        provider_mode: body.provider_mode || 'unconfigured',
        execute_live: body.execute_live === true,
        max_estimated_cost_usd: body.max_estimated_cost_usd ?? settings.max_estimated_cost_usd,
        runtime_config: buildOpsRuntimeConfig(settings)
      }),
      control_center: await getOpsControlCenterPayload({ settings })
    };
  });

  app.post('/internal/ops/control-center/paid-provider-pilot', async (request) => {
    const body = request.body || {};
    const settings = await getOpsRuntimeSettings();
    const runtimeConfig = buildOpsRuntimeConfig(settings);
    const executeLive = body.execute_live === true;
    const providerMode = body.provider_mode || settings.default_provider_mode;
    return {
      ok: true,
      paid_provider_pilot: await runPaidProviderPilot({
        brand_name: body.brand_name || settings.default_brand_name,
        prompt_index: body.prompt_index ?? settings.default_prompt_index,
        model_index: body.model_index ?? settings.default_model_index,
        approval_phrase: body.approval_phrase,
        allow_paid_provider: providerMode === 'openrouter',
        execute_live: executeLive && providerMode === 'openrouter',
        requested_calls: body.requested_calls || 1,
        max_estimated_cost_usd: body.max_estimated_cost_usd ?? settings.max_estimated_cost_usd,
        fixture_name: body.fixture_name,
        runtime_config: runtimeConfig
      }),
      control_center: await getOpsControlCenterPayload({ settings })
    };
  });

  app.get('/internal/ops/paid-provider-pilot-readiness', async (request) => {
    return {
      ok: true,
      paid_provider_pilot: await getPaidProviderPilotReadiness({
        brand_name: request.query?.brand_name,
        prompt_index: request.query?.prompt_index,
        model_index: request.query?.model_index,
        approval_phrase: request.query?.approval_phrase,
        allow_paid_provider: request.query?.allow_paid_provider,
        execute_live: request.query?.execute_live,
        requested_calls: request.query?.requested_calls,
        max_estimated_cost_usd: request.query?.max_estimated_cost_usd,
        fixture_name: request.query?.fixture_name,
        config: buildOpsRuntimeConfig(await getOpsRuntimeSettings())
      })
    };
  });

  app.post('/internal/ops/paid-provider-pilot', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      paid_provider_pilot: await runPaidProviderPilot({
        brand_name: body.brand_name,
        prompt_index: body.prompt_index,
        model_index: body.model_index,
        approval_phrase: body.approval_phrase,
        allow_paid_provider: body.allow_paid_provider,
        execute_live: body.execute_live,
        requested_calls: body.requested_calls,
        max_estimated_cost_usd: body.max_estimated_cost_usd,
        fixture_name: body.fixture_name,
        runtime_config: buildOpsRuntimeConfig(await getOpsRuntimeSettings())
      })
    };
  });

  app.get('/internal/ops/provider-policy-calibration', async (request) => {
    return {
      ok: true,
      calibration: await buildProviderPolicyCalibration({
        fixture_path: request.query?.fixture_path
      })
    };
  });

  app.get('/internal/ops/audit-log', async (request, reply) => {
    const auditLog = await getOpsAuditLog({
      limit: request.query?.limit,
      handoff_id: request.query?.handoff_id,
      category: request.query?.category,
      action: request.query?.action,
      actor: request.query?.actor,
      target: request.query?.target,
      q: request.query?.q,
      export_actor: request.internalAdmin
    });
    if (request.query?.format === 'csv') {
      return reply.type('text/csv').send(buildOpsAuditCsv(auditLog));
    }
    return {
      ok: true,
      audit_log: auditLog
    };
  });

  app.get('/internal/ops/audit-report', async (request, reply) => {
    const report = await getOpsAuditComplianceReport({
      limit: request.query?.limit,
      handoff_id: request.query?.handoff_id,
      category: request.query?.category,
      action: request.query?.action,
      actor: request.query?.actor,
      target: request.query?.target,
      q: request.query?.q,
      export_actor: request.internalAdmin
    });
    if (request.query?.format === 'html') {
      return reply.type('text/html').send(buildOpsAuditComplianceReportHtml(report));
    }
    return {
      ok: true,
      report
    };
  });

  app.get('/internal/ops/audit-report-archives', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-report-archives-v1',
      archives: await listOpsAuditReportArchives({ limit: request.query?.limit })
    };
  });

  app.post('/internal/ops/audit-report-archives', async (request) => {
    const archive = await createOpsAuditReportArchive({
      limit: request.query?.limit || request.body?.limit,
      handoff_id: request.query?.handoff_id || request.body?.handoff_id,
      category: request.query?.category || request.body?.category,
      action: request.query?.action || request.body?.action,
      actor: request.query?.actor || request.body?.actor,
      target: request.query?.target || request.body?.target,
      q: request.query?.q || request.body?.q,
      export_actor: request.internalAdmin,
      signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
    });
    return {
      ok: true,
      archive
    };
  });

  app.get('/internal/ops/audit-report-archives/verify', async (request) => {
    return {
      ok: true,
      receipt: await verifyOpsAuditReportArchive({
        identifier: request.query?.identifier || request.query?.report_hash || request.query?.report_id || request.query?.id,
        evidence_signature: request.query?.evidence_signature,
        signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
      })
    };
  });

  app.get('/internal/ops/audit-report-verifications', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-report-verification-history-v1',
      verifications: await listOpsAuditReportVerifications({
        limit: request.query?.limit,
        archive_id: request.query?.archive_id
      })
    };
  });

  app.post('/internal/ops/audit-report-verifications', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      verification: await recordOpsAuditReportVerification({
        identifier:
          request.query?.identifier ||
          request.query?.report_hash ||
          request.query?.report_id ||
          request.query?.id ||
          body.identifier ||
          body.report_hash ||
          body.report_id ||
          body.id,
        evidence_signature: request.query?.evidence_signature || body.evidence_signature,
        signing_secret: config.internalAdminSessionSecret || config.internalAdminToken,
        verifier: request.internalAdmin
      })
    };
  });

  app.post('/internal/ops/audit-report-verifications/tamper-drill', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      verification: await recordOpsAuditReportTamperDrill({
        identifier:
          request.query?.identifier ||
          request.query?.report_hash ||
          request.query?.report_id ||
          request.query?.id ||
          body.identifier ||
          body.report_hash ||
          body.report_id ||
          body.id,
        signing_secret: config.internalAdminSessionSecret || config.internalAdminToken,
        verifier: request.internalAdmin
      })
    };
  });

  app.get('/internal/ops/audit-report-verifications/:id', async (request) => {
    const verification = await getOpsAuditReportVerification(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: verification.receipt
      };
    }
    return {
      ok: true,
      verification
    };
  });

  app.get('/internal/ops/audit-evidence-chain', async (request) => {
    return {
      ok: true,
      evidence_chain: await getOpsAuditEvidenceChain({
        limit: request.query?.limit,
        report_id: request.query?.report_id,
        report_hash: request.query?.report_hash,
        receipt_hash: request.query?.receipt_hash,
        verifier: request.query?.verifier,
        failed_check: request.query?.failed_check,
        q: request.query?.q
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet', async (request, reply) => {
    const packet = await getOpsAuditEvidenceCasePacket(
      {
        limit: request.query?.limit,
        report_id: request.query?.report_id,
        report_hash: request.query?.report_hash,
        receipt_hash: request.query?.receipt_hash,
        verifier: request.query?.verifier,
        failed_check: request.query?.failed_check,
        q: request.query?.q
      },
      request.internalAdmin
    );
    if (request.query?.format === 'html') {
      return reply.type('text/html').send(buildOpsAuditEvidenceCasePacketHtml(packet));
    }
    return {
      ok: true,
      packet
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle', async (request) => {
    const exportRecord = await recordOpsAuditEvidenceCasePacketBundleExport({
      filters: {
        limit: request.query?.limit,
        report_id: request.query?.report_id,
        report_hash: request.query?.report_hash,
        receipt_hash: request.query?.receipt_hash,
        verifier: request.query?.verifier,
        failed_check: request.query?.failed_check,
        q: request.query?.q
      },
      requester: request.internalAdmin,
      signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
    });
    return {
      ok: true,
      bundle: exportRecord.bundle,
      export_receipt: exportRecord.export_receipt,
      history: exportRecord.history
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-exports', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-history-v1',
      exports: await listOpsAuditEvidenceCasePacketBundleExports({
        limit: request.query?.limit
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-exports/:id', async (request) => {
    const exportRecord = await getOpsAuditEvidenceCasePacketBundleExport(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: exportRecord.receipt
      };
    }
    return {
      ok: true,
      export: exportRecord
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-exports/:id/review', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const review = await recordOpsAuditEvidenceCasePacketBundleExportReview(
        {
          export_receipt_hash: request.params.id,
          reviewer: request.internalAdmin,
          action: body.action || 'attested',
          purpose: body.purpose || 'archive',
          decision: body.decision || 'usable',
          note: body.note || ''
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_export_reviewed',
          target_user_id: null,
          target_username: `bundle_export:${review.bundle_export_receipt_hash}`,
          before_payload: {},
          after_payload: {
            review_receipt_hash: review.receipt_hash,
            bundle_export_receipt_hash: review.bundle_export_receipt_hash,
            bundle_manifest_hash: review.bundle_manifest_hash,
            bundle_packet_hash: review.bundle_packet_hash,
            action: review.action,
            purpose: review.purpose,
            decision: review.decision
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_export_review_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        review_receipt: review
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-export-reviews', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-export-review-history-v1',
      reviews: await listOpsAuditEvidenceCasePacketBundleExportReviews({
        limit: request.query?.limit,
        export_receipt_hash: request.query?.export_receipt_hash,
        reviewer: request.query?.reviewer,
        decision: request.query?.decision,
        purpose: request.query?.purpose
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-export-reviews/:id', async (request) => {
    const review = await getOpsAuditEvidenceCasePacketBundleExportReview(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: review.receipt
      };
    }
    return {
      ok: true,
      review_receipt: review
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-export-delivery-readiness', async (request) => {
    return {
      ok: true,
      delivery_readiness: await getOpsAuditEvidenceCasePacketBundleExportDeliveryReadiness(
        {
          limit: request.query?.limit,
          report_id: request.query?.report_id,
          report_hash: request.query?.report_hash,
          receipt_hash: request.query?.receipt_hash,
          verifier: request.query?.verifier,
          failed_check: request.query?.failed_check,
          q: request.query?.q
        },
        request.internalAdmin
      )
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-export-delivery-gate', async (request) => {
    return {
      ok: true,
      delivery_gate: await getOpsAuditEvidenceCasePacketBundleExportDeliveryGate(
        {
          limit: request.query?.limit,
          report_id: request.query?.report_id,
          report_hash: request.query?.report_hash,
          receipt_hash: request.query?.receipt_hash,
          verifier: request.query?.verifier,
          failed_check: request.query?.failed_check,
          q: request.query?.q
        },
        request.internalAdmin
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-gate-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleDeliveryGateReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_gate_recorded',
          target_user_id: null,
          target_username: `delivery_gate:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            reason: receipt.reason,
            can_deliver: receipt.can_deliver,
            readiness_status: receipt.readiness_status,
            packet_hash: receipt.packet_hash
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_gate_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        gate_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-gate-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-gate-history-v1',
      receipts: await listOpsAuditEvidenceCasePacketBundleDeliveryGateReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        readiness_status: request.query?.readiness_status,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-gate-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleDeliveryGateReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      gate_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview', async (request) => {
    return {
      ok: true,
      handoff_preview: await getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreview(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const preview = await getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreview(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_handoff_previewed',
          target_user_id: null,
          target_username: `delivery_handoff_preview:${preview.preview_hash}`,
          before_payload: {},
          after_payload: {
            preview_hash: preview.preview_hash,
            status: preview.status,
            can_handoff: preview.can_handoff,
            reason: preview.reason,
            packet_hash: preview.packet?.packet_hash || null,
            manifest_hash: preview.signed_bundle?.manifest_hash || null,
            delivery_gate_receipt_hash: preview.delivery_gate_receipt?.receipt_hash || null,
            external_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_handoff_preview_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        handoff_preview: preview
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_handoff_preview_recorded',
          target_user_id: null,
          target_username: `delivery_handoff_preview_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            preview_hash: receipt.preview_hash,
            status: receipt.status,
            can_handoff: receipt.can_handoff,
            reason: receipt.reason,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            delivery_gate_receipt_hash: receipt.delivery_gate_receipt_hash,
            external_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_handoff_preview_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        handoff_preview_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-handoff-preview-history-v1',
      receipts: await listOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipts({
        limit: request.query?.limit,
        status: request.query?.status,
        can_handoff: request.query?.can_handoff,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash,
        preview_hash: request.query?.preview_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-handoff-preview-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleDeliveryHandoffPreviewReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      handoff_preview_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-preview', async (request) => {
    return {
      ok: true,
      final_approval_preview: await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPreview(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-preview', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const preview = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPreview(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_final_approval_previewed',
          target_user_id: null,
          target_username: `delivery_final_approval_preview:${preview.approval_preview_hash}`,
          before_payload: {},
          after_payload: {
            approval_preview_hash: preview.approval_preview_hash,
            decision: preview.decision,
            status: preview.status,
            can_approve: preview.can_approve,
            reason: preview.reason,
            packet_hash: preview.packet?.packet_hash || null,
            manifest_hash: preview.signed_bundle?.manifest_hash || null,
            handoff_preview_receipt_hash: preview.handoff_preview_receipt?.receipt_hash || null,
            external_delivery: false,
            final_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_final_approval_preview_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        final_approval_preview: preview
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_final_approval_recorded',
          target_user_id: null,
          target_username: `delivery_final_approval_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            approval_preview_hash: receipt.approval_preview_hash,
            decision: receipt.decision,
            status: receipt.status,
            can_approve: receipt.can_approve,
            reason: receipt.reason,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            handoff_preview_receipt_hash: receipt.handoff_preview_receipt_hash,
            external_delivery: false,
            final_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_final_approval_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        final_approval_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-history-v1',
      receipts: await listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        status: request.query?.status,
        can_approve: request.query?.can_approve,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash,
        approval_preview_hash: request.query?.approval_preview_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      final_approval_receipt: receipt
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-reviews', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const review = await recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReview(
        {
          final_approval_receipt_hash: body.final_approval_receipt_hash || body.receipt_hash || request.query?.final_approval_receipt_hash || request.query?.receipt_hash,
          reviewer: request.internalAdmin,
          action: body.action || request.query?.action || 'confirmed',
          note: body.note || request.query?.note || ''
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_final_approval_reviewed',
          target_user_id: null,
          target_username: `delivery_final_approval_review:${review.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: review.receipt_hash,
            final_approval_receipt_hash: review.final_approval_receipt_hash,
            action: review.action,
            lifecycle_status: review.lifecycle_status,
            decision: review.decision,
            approval_status: review.approval_status,
            packet_hash: review.packet_hash,
            manifest_hash: review.manifest_hash,
            handoff_preview_receipt_hash: review.handoff_preview_receipt_hash,
            external_delivery: false,
            final_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_final_approval_review_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        review_receipt: review
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-reviews', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-review-history-v1',
      review_receipts: await listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReviews({
        limit: request.query?.limit,
        final_approval_receipt_hash: request.query?.final_approval_receipt_hash || request.query?.receipt_hash,
        reviewer: request.query?.reviewer,
        action: request.query?.action,
        lifecycle_status: request.query?.lifecycle_status
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-reviews/:id', async (request) => {
    const review = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalReview(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: review.receipt
      };
    }
    return {
      ok: true,
      review_receipt: review
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate', async (request) => {
    return {
      ok: true,
      policy_gate: await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGate(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const gate = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGate(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_final_approval_policy_gate_previewed',
          target_user_id: null,
          target_username: `delivery_final_approval_policy_gate:${gate.policy_gate_hash}`,
          before_payload: {},
          after_payload: {
            policy_gate_hash: gate.policy_gate_hash,
            decision: gate.decision,
            policy_status: gate.policy_status,
            reason: gate.reason,
            can_prepare_delivery: gate.can_prepare_delivery,
            final_approval_receipt_hash: gate.selected_final_approval_receipt?.receipt_hash || null,
            lifecycle_review_receipt_hash: gate.latest_lifecycle_review?.receipt_hash || null,
            external_delivery: false,
            final_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_final_approval_policy_gate_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        policy_gate: gate
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_delivery_final_approval_policy_gate_recorded',
          target_user_id: null,
          target_username: `delivery_final_approval_policy_gate_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            policy_status: receipt.policy_status,
            reason: receipt.reason,
            can_prepare_delivery: receipt.can_prepare_delivery,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_delivery_final_approval_policy_gate_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        policy_gate_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-history-v1',
      policy_gate_receipts: await listOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        policy_status: request.query?.policy_status,
        can_prepare_delivery: request.query?.can_prepare_delivery,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-delivery-final-approval-policy-gate-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleDeliveryFinalApprovalPolicyGateReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      policy_gate_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock', async (request) => {
    return {
      ok: true,
      dry_run_lock: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLock(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const dryRunLock = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLock(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_dry_run_lock_previewed',
          target_user_id: null,
          target_username: `final_delivery_dry_run_lock:${dryRunLock.dry_run_lock_hash}`,
          before_payload: {},
          after_payload: {
            dry_run_lock_hash: dryRunLock.dry_run_lock_hash,
            decision: dryRunLock.decision,
            lock_status: dryRunLock.lock_status,
            reason: dryRunLock.reason,
            can_prepare_delivery: dryRunLock.can_prepare_delivery,
            policy_gate_receipt_hash: dryRunLock.policy_gate_receipt?.receipt_hash || null,
            final_approval_receipt_hash: dryRunLock.policy_gate_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: dryRunLock.policy_gate_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_dry_run_lock_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        dry_run_lock: dryRunLock
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_dry_run_lock_recorded',
          target_user_id: null,
          target_username: `final_delivery_dry_run_lock_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            lock_status: receipt.lock_status,
            reason: receipt.reason,
            can_prepare_delivery: receipt.can_prepare_delivery,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_dry_run_lock_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        dry_run_lock_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-history-v1',
      dry_run_lock_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        lock_status: request.query?.lock_status,
        can_prepare_delivery: request.query?.can_prepare_delivery,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dry-run-lock-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDryRunLockReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      dry_run_lock_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal', async (request) => {
    return {
      ok: true,
      rehearsal: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsal(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const rehearsal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsal(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_rehearsal_previewed',
          target_user_id: null,
          target_username: `final_delivery_rehearsal:${rehearsal.rehearsal_hash}`,
          before_payload: {},
          after_payload: {
            rehearsal_hash: rehearsal.rehearsal_hash,
            decision: rehearsal.decision,
            rehearsal_status: rehearsal.rehearsal_status,
            reason: rehearsal.reason,
            can_execute_dry_run: rehearsal.can_execute_dry_run,
            dry_run_lock_receipt_hash: rehearsal.dry_run_lock_receipt?.receipt_hash || null,
            policy_gate_receipt_hash: rehearsal.dry_run_lock_receipt?.policy_gate_receipt_hash || null,
            final_approval_receipt_hash: rehearsal.dry_run_lock_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: rehearsal.dry_run_lock_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_rehearsal_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        rehearsal
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_rehearsal_recorded',
          target_user_id: null,
          target_username: `final_delivery_rehearsal_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            rehearsal_status: receipt.rehearsal_status,
            reason: receipt.reason,
            can_execute_dry_run: receipt.can_execute_dry_run,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_rehearsal_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        rehearsal_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-rehearsal-history-v1',
      rehearsal_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        rehearsal_status: request.query?.rehearsal_status,
        can_execute_dry_run: request.query?.can_execute_dry_run,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-rehearsal-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryRehearsalReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      rehearsal_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval', async (request) => {
    return {
      ok: true,
      dual_control_approval: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApproval(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const approval = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApproval(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_dual_control_approval_previewed',
          target_user_id: null,
          target_username: `final_delivery_dual_control_approval:${approval.dual_control_approval_hash}`,
          before_payload: {},
          after_payload: {
            dual_control_approval_hash: approval.dual_control_approval_hash,
            decision: approval.decision,
            approval_status: approval.approval_status,
            reason: approval.reason,
            can_release_after_dual_control: approval.can_release_after_dual_control,
            rehearsal_receipt_hash: approval.rehearsal_receipt?.receipt_hash || null,
            dry_run_lock_receipt_hash: approval.rehearsal_receipt?.dry_run_lock_receipt_hash || null,
            policy_gate_receipt_hash: approval.rehearsal_receipt?.policy_gate_receipt_hash || null,
            final_approval_receipt_hash: approval.rehearsal_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: approval.rehearsal_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_dual_control_approval_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        dual_control_approval: approval
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_dual_control_approval_recorded',
          target_user_id: null,
          target_username: `final_delivery_dual_control_approval_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            approval_status: receipt.approval_status,
            reason: receipt.reason,
            can_release_after_dual_control: receipt.can_release_after_dual_control,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_dual_control_approval_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        dual_control_approval_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-history-v1',
      dual_control_approval_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        approval_status: request.query?.approval_status,
        can_release_after_dual_control: request.query?.can_release_after_dual_control,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-dual-control-approval-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryDualControlApprovalReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      dual_control_approval_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal', async (request) => {
    return {
      ok: true,
      readiness_seal: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSeal(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const seal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSeal(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_readiness_seal_previewed',
          target_user_id: null,
          target_username: `final_delivery_readiness_seal:${seal.readiness_seal_hash}`,
          before_payload: {},
          after_payload: {
            readiness_seal_hash: seal.readiness_seal_hash,
            decision: seal.decision,
            seal_status: seal.seal_status,
            reason: seal.reason,
            can_handoff_to_operator: seal.can_handoff_to_operator,
            dual_control_approval_receipt_hash: seal.dual_control_approval_receipt?.receipt_hash || null,
            rehearsal_receipt_hash: seal.dual_control_approval_receipt?.rehearsal_receipt_hash || null,
            dry_run_lock_receipt_hash: seal.dual_control_approval_receipt?.dry_run_lock_receipt_hash || null,
            policy_gate_receipt_hash: seal.dual_control_approval_receipt?.policy_gate_receipt_hash || null,
            final_approval_receipt_hash: seal.dual_control_approval_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: seal.dual_control_approval_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_readiness_seal_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        readiness_seal: seal
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_readiness_seal_recorded',
          target_user_id: null,
          target_username: `final_delivery_readiness_seal_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            seal_status: receipt.seal_status,
            reason: receipt.reason,
            can_handoff_to_operator: receipt.can_handoff_to_operator,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_readiness_seal_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        readiness_seal_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-readiness-seal-history-v1',
      readiness_seal_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        seal_status: request.query?.seal_status,
        can_handoff_to_operator: request.query?.can_handoff_to_operator,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-readiness-seal-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryReadinessSealReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      readiness_seal_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review', async (request) => {
    return {
      ok: true,
      sealed_handoff_review: await getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReview(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const review = await getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReview(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_sealed_handoff_review_previewed',
          target_user_id: null,
          target_username: `final_delivery_sealed_handoff_review:${review.sealed_handoff_review_hash}`,
          before_payload: {},
          after_payload: {
            sealed_handoff_review_hash: review.sealed_handoff_review_hash,
            decision: review.decision,
            review_status: review.review_status,
            reason: review.reason,
            can_release_commander_signoff: review.can_release_commander_signoff,
            readiness_seal_receipt_hash: review.readiness_seal_receipt?.receipt_hash || null,
            dual_control_approval_receipt_hash: review.readiness_seal_receipt?.dual_control_approval_receipt_hash || null,
            rehearsal_receipt_hash: review.readiness_seal_receipt?.rehearsal_receipt_hash || null,
            dry_run_lock_receipt_hash: review.readiness_seal_receipt?.dry_run_lock_receipt_hash || null,
            policy_gate_receipt_hash: review.readiness_seal_receipt?.policy_gate_receipt_hash || null,
            final_approval_receipt_hash: review.readiness_seal_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: review.readiness_seal_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        sealed_handoff_review: review
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_sealed_handoff_review_recorded',
          target_user_id: null,
          target_username: `final_delivery_sealed_handoff_review_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            review_status: receipt.review_status,
            reason: receipt.reason,
            can_release_commander_signoff: receipt.can_release_commander_signoff,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_sealed_handoff_review_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        sealed_handoff_review_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-history-v1',
      sealed_handoff_review_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        review_status: request.query?.review_status,
        can_release_commander_signoff: request.query?.can_release_commander_signoff,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-sealed-handoff-review-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliverySealedHandoffReviewReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      sealed_handoff_review_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow', async (request) => {
    return {
      ok: true,
      command_escrow: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrow(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const escrow = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrow(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_escrow_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_escrow:${escrow.command_escrow_hash}`,
          before_payload: {},
          after_payload: {
            command_escrow_hash: escrow.command_escrow_hash,
            decision: escrow.decision,
            escrow_status: escrow.escrow_status,
            reason: escrow.reason,
            can_seal_release_command: escrow.can_seal_release_command,
            sealed_handoff_review_receipt_hash: escrow.sealed_handoff_review_receipt?.receipt_hash || null,
            readiness_seal_receipt_hash: escrow.sealed_handoff_review_receipt?.readiness_seal_receipt_hash || null,
            dual_control_approval_receipt_hash: escrow.sealed_handoff_review_receipt?.dual_control_approval_receipt_hash || null,
            rehearsal_receipt_hash: escrow.sealed_handoff_review_receipt?.rehearsal_receipt_hash || null,
            dry_run_lock_receipt_hash: escrow.sealed_handoff_review_receipt?.dry_run_lock_receipt_hash || null,
            policy_gate_receipt_hash: escrow.sealed_handoff_review_receipt?.policy_gate_receipt_hash || null,
            final_approval_receipt_hash: escrow.sealed_handoff_review_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: escrow.sealed_handoff_review_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_escrow_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        command_escrow: escrow
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_escrow_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_escrow_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            escrow_status: receipt.escrow_status,
            reason: receipt.reason,
            can_seal_release_command: receipt.can_seal_release_command,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_escrow_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        command_escrow_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-escrow-history-v1',
      command_escrow_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        escrow_status: request.query?.escrow_status,
        can_seal_release_command: request.query?.can_seal_release_command,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-escrow-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandEscrowReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      command_escrow_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation', async (request) => {
    return {
      ok: true,
      command_revocation: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocation(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const revocation = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocation(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_revocation_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_revocation:${revocation.command_revocation_hash}`,
          before_payload: {},
          after_payload: {
            command_revocation_hash: revocation.command_revocation_hash,
            decision: revocation.decision,
            revocation_status: revocation.revocation_status,
            reason: revocation.reason,
            can_rollback_release_command: revocation.can_rollback_release_command,
            command_escrow_receipt_hash: revocation.command_escrow_receipt?.receipt_hash || null,
            sealed_handoff_review_receipt_hash: revocation.command_escrow_receipt?.sealed_handoff_review_receipt_hash || null,
            readiness_seal_receipt_hash: revocation.command_escrow_receipt?.readiness_seal_receipt_hash || null,
            dual_control_approval_receipt_hash: revocation.command_escrow_receipt?.dual_control_approval_receipt_hash || null,
            rehearsal_receipt_hash: revocation.command_escrow_receipt?.rehearsal_receipt_hash || null,
            dry_run_lock_receipt_hash: revocation.command_escrow_receipt?.dry_run_lock_receipt_hash || null,
            policy_gate_receipt_hash: revocation.command_escrow_receipt?.policy_gate_receipt_hash || null,
            final_approval_receipt_hash: revocation.command_escrow_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: revocation.command_escrow_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_revocation_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        command_revocation: revocation
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_revocation_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_revocation_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            revocation_status: receipt.revocation_status,
            reason: receipt.reason,
            can_rollback_release_command: receipt.can_rollback_release_command,
            command_escrow_receipt_hash: receipt.command_escrow_receipt_hash,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_revocation_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        command_revocation_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-revocation-history-v1',
      command_revocation_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        revocation_status: request.query?.revocation_status,
        can_rollback_release_command: request.query?.can_rollback_release_command,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-revocation-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandRevocationReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      command_revocation_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure', async (request) => {
    return {
      ok: true,
      command_closure: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosure(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const closure = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosure(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_closure_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_closure:${closure.command_closure_hash}`,
          before_payload: {},
          after_payload: {
            command_closure_hash: closure.command_closure_hash,
            decision: closure.decision,
            closure_status: closure.closure_status,
            reason: closure.reason,
            can_reinstate_release_command: closure.can_reinstate_release_command,
            command_revocation_receipt_hash: closure.command_revocation_receipt?.receipt_hash || null,
            command_escrow_receipt_hash: closure.command_revocation_receipt?.command_escrow_receipt_hash || null,
            sealed_handoff_review_receipt_hash: closure.command_revocation_receipt?.sealed_handoff_review_receipt_hash || null,
            readiness_seal_receipt_hash: closure.command_revocation_receipt?.readiness_seal_receipt_hash || null,
            dual_control_approval_receipt_hash: closure.command_revocation_receipt?.dual_control_approval_receipt_hash || null,
            rehearsal_receipt_hash: closure.command_revocation_receipt?.rehearsal_receipt_hash || null,
            dry_run_lock_receipt_hash: closure.command_revocation_receipt?.dry_run_lock_receipt_hash || null,
            policy_gate_receipt_hash: closure.command_revocation_receipt?.policy_gate_receipt_hash || null,
            final_approval_receipt_hash: closure.command_revocation_receipt?.final_approval_receipt_hash || null,
            lifecycle_review_receipt_hash: closure.command_revocation_receipt?.lifecycle_review_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_closure_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        command_closure: closure
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_closure_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_closure_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            closure_status: receipt.closure_status,
            reason: receipt.reason,
            can_reinstate_release_command: receipt.can_reinstate_release_command,
            command_revocation_receipt_hash: receipt.command_revocation_receipt_hash,
            command_escrow_receipt_hash: receipt.command_escrow_receipt_hash,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_closure_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        command_closure_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-closure-history-v1',
      command_closure_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        closure_status: request.query?.closure_status,
        can_reinstate_release_command: request.query?.can_reinstate_release_command,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-closure-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandClosureReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      command_closure_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization', async (request) => {
    return {
      ok: true,
      trail_notarization: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarization(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const notarization = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarization(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_notarization_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_notarization:${notarization.trail_notarization_hash}`,
          before_payload: {},
          after_payload: {
            trail_notarization_hash: notarization.trail_notarization_hash,
            decision: notarization.decision,
            notarization_status: notarization.notarization_status,
            reason: notarization.reason,
            can_archive_release_trail: notarization.can_archive_release_trail,
            command_closure_receipt_hash: notarization.command_closure_receipt?.receipt_hash || null,
            command_revocation_receipt_hash: notarization.command_closure_receipt?.command_revocation_receipt_hash || null,
            command_escrow_receipt_hash: notarization.command_closure_receipt?.command_escrow_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_notarization_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        trail_notarization: notarization
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_notarization_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_notarization_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            notarization_status: receipt.notarization_status,
            reason: receipt.reason,
            can_archive_release_trail: receipt.can_archive_release_trail,
            command_closure_receipt_hash: receipt.command_closure_receipt_hash,
            command_revocation_receipt_hash: receipt.command_revocation_receipt_hash,
            command_escrow_receipt_hash: receipt.command_escrow_receipt_hash,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_notarization_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        trail_notarization_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-history-v1',
      trail_notarization_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        notarization_status: request.query?.notarization_status,
        can_archive_release_trail: request.query?.can_archive_release_trail,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-notarization-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailNotarizationReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      trail_notarization_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody', async (request) => {
    return {
      ok: true,
      trail_custody: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustody(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const custody = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustody(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_custody_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_custody:${custody.trail_custody_hash}`,
          before_payload: {},
          after_payload: {
            trail_custody_hash: custody.trail_custody_hash,
            decision: custody.decision,
            custody_status: custody.custody_status,
            reason: custody.reason,
            can_retain_release_archive: custody.can_retain_release_archive,
            trail_notarization_receipt_hash: custody.trail_notarization_receipt?.receipt_hash || null,
            command_closure_receipt_hash: custody.trail_notarization_receipt?.command_closure_receipt_hash || null,
            command_revocation_receipt_hash: custody.trail_notarization_receipt?.command_revocation_receipt_hash || null,
            command_escrow_receipt_hash: custody.trail_notarization_receipt?.command_escrow_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_custody_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        trail_custody: custody
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_custody_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_custody_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            custody_status: receipt.custody_status,
            reason: receipt.reason,
            can_retain_release_archive: receipt.can_retain_release_archive,
            trail_notarization_receipt_hash: receipt.trail_notarization_receipt_hash,
            command_closure_receipt_hash: receipt.command_closure_receipt_hash,
            command_revocation_receipt_hash: receipt.command_revocation_receipt_hash,
            command_escrow_receipt_hash: receipt.command_escrow_receipt_hash,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_custody_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        trail_custody_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-history-v1',
      trail_custody_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        custody_status: request.query?.custody_status,
        can_retain_release_archive: request.query?.can_retain_release_archive,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      trail_custody_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation', async (request) => {
    return {
      ok: true,
      retention_attestation: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestation(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const attestation = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestation(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_retention_attestation:${attestation.retention_attestation_hash}`,
          before_payload: {},
          after_payload: {
            retention_attestation_hash: attestation.retention_attestation_hash,
            decision: attestation.decision,
            attestation_status: attestation.attestation_status,
            reason: attestation.reason,
            can_continue_release_archive_retention: attestation.can_continue_release_archive_retention,
            trail_custody_receipt_hash: attestation.trail_custody_receipt?.receipt_hash || null,
            trail_notarization_receipt_hash: attestation.trail_custody_receipt?.trail_notarization_receipt_hash || null,
            command_closure_receipt_hash: attestation.trail_custody_receipt?.command_closure_receipt_hash || null,
            command_revocation_receipt_hash: attestation.trail_custody_receipt?.command_revocation_receipt_hash || null,
            command_escrow_receipt_hash: attestation.trail_custody_receipt?.command_escrow_receipt_hash || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        retention_attestation: attestation
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_retention_attestation_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            attestation_status: receipt.attestation_status,
            reason: receipt.reason,
            can_continue_release_archive_retention: receipt.can_continue_release_archive_retention,
            trail_custody_receipt_hash: receipt.trail_custody_receipt_hash,
            trail_notarization_receipt_hash: receipt.trail_notarization_receipt_hash,
            command_closure_receipt_hash: receipt.command_closure_receipt_hash,
            command_revocation_receipt_hash: receipt.command_revocation_receipt_hash,
            command_escrow_receipt_hash: receipt.command_escrow_receipt_hash,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_retention_attestation_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        retention_attestation_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-history-v1',
      retention_attestation_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        attestation_status: request.query?.attestation_status,
        can_continue_release_archive_retention: request.query?.can_continue_release_archive_retention,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-retention-attestation-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRetentionAttestationReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      retention_attestation_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window', async (request) => {
    return {
      ok: true,
      renewal_window: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindow(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const renewalWindow = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindow(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_renewal_window:${renewalWindow.renewal_window_hash}`,
          before_payload: {},
          after_payload: {
            renewal_window_hash: renewalWindow.renewal_window_hash,
            decision: renewalWindow.decision,
            renewal_status: renewalWindow.renewal_status,
            reason: renewalWindow.reason,
            can_schedule_next_retention_review: renewalWindow.can_schedule_next_retention_review,
            retention_attestation_receipt_hash: renewalWindow.retention_attestation_receipt?.receipt_hash || null,
            trail_custody_receipt_hash: renewalWindow.retention_attestation_receipt?.trail_custody_receipt_hash || null,
            trail_notarization_receipt_hash: renewalWindow.retention_attestation_receipt?.trail_notarization_receipt_hash || null,
            command_closure_receipt_hash: renewalWindow.retention_attestation_receipt?.command_closure_receipt_hash || null,
            command_revocation_receipt_hash: renewalWindow.retention_attestation_receipt?.command_revocation_receipt_hash || null,
            command_escrow_receipt_hash: renewalWindow.retention_attestation_receipt?.command_escrow_receipt_hash || null,
            renewal_window_opens_at: renewalWindow.renewal_window?.renewal_window_opens_at || null,
            expires_at: renewalWindow.renewal_window?.expires_at || null,
            next_review_due_at: renewalWindow.renewal_window?.next_review_due_at || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        renewal_window: renewalWindow
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_renewal_window_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            renewal_status: receipt.renewal_status,
            reason: receipt.reason,
            can_schedule_next_retention_review: receipt.can_schedule_next_retention_review,
            retention_attestation_receipt_hash: receipt.retention_attestation_receipt_hash,
            trail_custody_receipt_hash: receipt.trail_custody_receipt_hash,
            trail_notarization_receipt_hash: receipt.trail_notarization_receipt_hash,
            command_closure_receipt_hash: receipt.command_closure_receipt_hash,
            command_revocation_receipt_hash: receipt.command_revocation_receipt_hash,
            command_escrow_receipt_hash: receipt.command_escrow_receipt_hash,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            renewal_window_opens_at: receipt.renewal_window_opens_at,
            expires_at: receipt.expires_at,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_renewal_window_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        renewal_window_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-history-v1',
      renewal_window_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        renewal_status: request.query?.renewal_status,
        can_schedule_next_retention_review: request.query?.can_schedule_next_retention_review,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-window-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalWindowReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      renewal_window_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation', async (request) => {
    return {
      ok: true,
      renewal_confirmation: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmation(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const confirmation = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmation(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_renewal_confirmation:${confirmation.renewal_confirmation_hash}`,
          before_payload: {},
          after_payload: {
            renewal_confirmation_hash: confirmation.renewal_confirmation_hash,
            decision: confirmation.decision,
            confirmation_status: confirmation.confirmation_status,
            reason: confirmation.reason,
            can_continue_archive_renewal: confirmation.can_continue_archive_renewal,
            renewal_window_receipt_hash: confirmation.renewal_window_receipt?.receipt_hash || null,
            retention_attestation_receipt_hash: confirmation.renewal_window_receipt?.retention_attestation_receipt_hash || null,
            checkpoint_at: confirmation.archive_renewal_checkpoint?.checkpoint_at || null,
            next_review_due_at: confirmation.archive_renewal_checkpoint?.next_review_due_at || null,
            expires_at: confirmation.archive_renewal_checkpoint?.expires_at || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        renewal_confirmation: confirmation
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_renewal_confirmation_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            confirmation_status: receipt.confirmation_status,
            reason: receipt.reason,
            can_continue_archive_renewal: receipt.can_continue_archive_renewal,
            renewal_window_receipt_hash: receipt.renewal_window_receipt_hash,
            retention_attestation_receipt_hash: receipt.retention_attestation_receipt_hash,
            trail_custody_receipt_hash: receipt.trail_custody_receipt_hash,
            trail_notarization_receipt_hash: receipt.trail_notarization_receipt_hash,
            command_closure_receipt_hash: receipt.command_closure_receipt_hash,
            command_revocation_receipt_hash: receipt.command_revocation_receipt_hash,
            command_escrow_receipt_hash: receipt.command_escrow_receipt_hash,
            sealed_handoff_review_receipt_hash: receipt.sealed_handoff_review_receipt_hash,
            readiness_seal_receipt_hash: receipt.readiness_seal_receipt_hash,
            dual_control_approval_receipt_hash: receipt.dual_control_approval_receipt_hash,
            rehearsal_receipt_hash: receipt.rehearsal_receipt_hash,
            dry_run_lock_receipt_hash: receipt.dry_run_lock_receipt_hash,
            policy_gate_receipt_hash: receipt.policy_gate_receipt_hash,
            final_approval_receipt_hash: receipt.final_approval_receipt_hash,
            lifecycle_review_receipt_hash: receipt.lifecycle_review_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            checkpoint_at: receipt.checkpoint_at,
            expires_at: receipt.expires_at,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_renewal_confirmation_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        renewal_confirmation_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-history-v1',
      renewal_confirmation_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        confirmation_status: request.query?.confirmation_status,
        can_continue_archive_renewal: request.query?.can_continue_archive_renewal,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-renewal-confirmation-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailRenewalConfirmationReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      renewal_confirmation_receipt: receipt
    };
  });


  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal', async (request) => {
    return {
      ok: true,
      checkpoint_seal: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSeal(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const seal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSeal(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_checkpoint_seal:${seal.checkpoint_seal_hash}`,
          before_payload: {},
          after_payload: {
            checkpoint_seal_hash: seal.checkpoint_seal_hash,
            decision: seal.decision,
            seal_status: seal.seal_status,
            reason: seal.reason,
            can_freeze_archive_checkpoint: seal.can_freeze_archive_checkpoint,
            renewal_confirmation_receipt_hash: seal.renewal_confirmation_receipt?.receipt_hash || null,
            renewal_window_receipt_hash: seal.renewal_confirmation_receipt?.renewal_window_receipt_hash || null,
            checkpoint_at: seal.archive_checkpoint_freeze?.checkpoint_at || null,
            frozen_at: seal.archive_checkpoint_freeze?.frozen_at || null,
            next_review_due_at: seal.archive_checkpoint_freeze?.next_review_due_at || null,
            expires_at: seal.archive_checkpoint_freeze?.expires_at || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        checkpoint_seal: seal
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_checkpoint_seal_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            seal_status: receipt.seal_status,
            reason: receipt.reason,
            can_freeze_archive_checkpoint: receipt.can_freeze_archive_checkpoint,
            renewal_confirmation_receipt_hash: receipt.renewal_confirmation_receipt_hash,
            renewal_window_receipt_hash: receipt.renewal_window_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            checkpoint_at: receipt.checkpoint_at,
            frozen_at: receipt.frozen_at,
            expires_at: receipt.expires_at,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_checkpoint_seal_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        checkpoint_seal_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-history-v1',
      checkpoint_seal_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        seal_status: request.query?.seal_status,
        can_freeze_archive_checkpoint: request.query?.can_freeze_archive_checkpoint,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-checkpoint-seal-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCheckpointSealReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      checkpoint_seal_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff', async (request) => {
    return {
      ok: true,
      custody_handoff: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoff(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const handoff = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoff(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_custody_handoff:${handoff.custody_handoff_hash}`,
          before_payload: {},
          after_payload: {
            custody_handoff_hash: handoff.custody_handoff_hash,
            decision: handoff.decision,
            handoff_status: handoff.handoff_status,
            reason: handoff.reason,
            can_transfer_archive_custody: handoff.can_transfer_archive_custody,
            checkpoint_seal_receipt_hash: handoff.checkpoint_seal_receipt?.receipt_hash || null,
            renewal_confirmation_receipt_hash: handoff.checkpoint_seal_receipt?.renewal_confirmation_receipt_hash || null,
            checkpoint_at: handoff.archive_custody_transfer?.checkpoint_at || null,
            frozen_at: handoff.archive_custody_transfer?.frozen_at || null,
            custody_handoff_at: handoff.archive_custody_transfer?.custody_handoff_at || null,
            next_review_due_at: handoff.archive_custody_transfer?.next_review_due_at || null,
            expires_at: handoff.archive_custody_transfer?.expires_at || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        custody_handoff: handoff
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_custody_handoff_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            handoff_status: receipt.handoff_status,
            reason: receipt.reason,
            can_transfer_archive_custody: receipt.can_transfer_archive_custody,
            checkpoint_seal_receipt_hash: receipt.checkpoint_seal_receipt_hash,
            renewal_confirmation_receipt_hash: receipt.renewal_confirmation_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            checkpoint_at: receipt.checkpoint_at,
            frozen_at: receipt.frozen_at,
            custody_handoff_at: receipt.custody_handoff_at,
            expires_at: receipt.expires_at,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_custody_handoff_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        custody_handoff_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-history-v1',
      custody_handoff_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        handoff_status: request.query?.handoff_status,
        can_transfer_archive_custody: request.query?.can_transfer_archive_custody,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-handoff-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyHandoffReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      custody_handoff_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow', async (request) => {
    return {
      ok: true,
      archive_escrow: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrow(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const escrow = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrow(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_archive_escrow:${escrow.archive_escrow_hash}`,
          before_payload: {},
          after_payload: {
            archive_escrow_hash: escrow.archive_escrow_hash,
            decision: escrow.decision,
            escrow_status: escrow.escrow_status,
            reason: escrow.reason,
            can_lock_archive_evidence: escrow.can_lock_archive_evidence,
            custody_handoff_receipt_hash: escrow.custody_handoff_receipt?.receipt_hash || null,
            checkpoint_seal_receipt_hash: escrow.custody_handoff_receipt?.checkpoint_seal_receipt_hash || null,
            custody_handoff_at: escrow.archive_evidence_lock?.custody_handoff_at || null,
            escrow_locked_at: escrow.archive_evidence_lock?.escrow_locked_at || null,
            next_review_due_at: escrow.archive_evidence_lock?.next_review_due_at || null,
            expires_at: escrow.archive_evidence_lock?.expires_at || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        archive_escrow: escrow
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_archive_escrow_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            escrow_status: receipt.escrow_status,
            reason: receipt.reason,
            can_lock_archive_evidence: receipt.can_lock_archive_evidence,
            custody_handoff_receipt_hash: receipt.custody_handoff_receipt_hash,
            checkpoint_seal_receipt_hash: receipt.checkpoint_seal_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            custody_handoff_at: receipt.custody_handoff_at,
            escrow_locked_at: receipt.escrow_locked_at,
            expires_at: receipt.expires_at,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_archive_escrow_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        archive_escrow_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-history-v1',
      archive_escrow_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        escrow_status: request.query?.escrow_status,
        can_lock_archive_evidence: request.query?.can_lock_archive_evidence,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-archive-escrow-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailArchiveEscrowReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      archive_escrow_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal', async (request) => {
    return {
      ok: true,
      evidence_seal: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSeal(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const seal = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSeal(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_evidence_seal:${seal.evidence_seal_hash}`,
          before_payload: {},
          after_payload: {
            evidence_seal_hash: seal.evidence_seal_hash,
            decision: seal.decision,
            seal_status: seal.seal_status,
            reason: seal.reason,
            can_notarize_release_evidence: seal.can_notarize_release_evidence,
            archive_escrow_receipt_hash: seal.archive_escrow_receipt?.receipt_hash || null,
            custody_handoff_receipt_hash: seal.archive_escrow_receipt?.custody_handoff_receipt_hash || null,
            escrow_locked_at: seal.release_evidence_seal?.escrow_locked_at || null,
            evidence_sealed_at: seal.release_evidence_seal?.evidence_sealed_at || null,
            next_review_due_at: seal.release_evidence_seal?.next_review_due_at || null,
            expires_at: seal.release_evidence_seal?.expires_at || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        evidence_seal: seal
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_evidence_seal_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            seal_status: receipt.seal_status,
            reason: receipt.reason,
            can_notarize_release_evidence: receipt.can_notarize_release_evidence,
            archive_escrow_receipt_hash: receipt.archive_escrow_receipt_hash,
            custody_handoff_receipt_hash: receipt.custody_handoff_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            escrow_locked_at: receipt.escrow_locked_at,
            evidence_sealed_at: receipt.evidence_sealed_at,
            expires_at: receipt.expires_at,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_evidence_seal_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        evidence_seal_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-history-v1',
      evidence_seal_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        seal_status: request.query?.seal_status,
        can_notarize_release_evidence: request.query?.can_notarize_release_evidence,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-evidence-seal-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailEvidenceSealReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      evidence_seal_receipt: receipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint', async (request) => {
    return {
      ok: true,
      custody_checkpoint: await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpoint(
        {
          filters: {
            limit: request.query?.limit,
            report_id: request.query?.report_id,
            report_hash: request.query?.report_hash,
            receipt_hash: request.query?.receipt_hash,
            verifier: request.query?.verifier,
            failed_check: request.query?.failed_check,
            q: request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        }
      )
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const checkpoint = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpoint(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          actor: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_previewed',
          target_user_id: null,
          target_username: `final_delivery_command_trail_custody_checkpoint:${checkpoint.custody_checkpoint_hash}`,
          before_payload: {},
          after_payload: {
            custody_checkpoint_hash: checkpoint.custody_checkpoint_hash,
            decision: checkpoint.decision,
            checkpoint_status: checkpoint.checkpoint_status,
            reason: checkpoint.reason,
            can_checkpoint_sealed_evidence: checkpoint.can_checkpoint_sealed_evidence,
            evidence_seal_receipt_hash: checkpoint.evidence_seal_receipt?.receipt_hash || null,
            archive_escrow_receipt_hash: checkpoint.evidence_seal_receipt?.archive_escrow_receipt_hash || null,
            packet_hash: checkpoint.sealed_evidence_custody_checkpoint?.packet_hash || null,
            manifest_hash: checkpoint.sealed_evidence_custody_checkpoint?.manifest_hash || null,
            evidence_sealed_at: checkpoint.sealed_evidence_custody_checkpoint?.evidence_sealed_at || null,
            custody_checkpointed_at: checkpoint.sealed_evidence_custody_checkpoint?.custody_checkpointed_at || null,
            next_review_due_at: checkpoint.sealed_evidence_custody_checkpoint?.next_review_due_at || null,
            expires_at: checkpoint.sealed_evidence_custody_checkpoint?.expires_at || null,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        custody_checkpoint: checkpoint
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receipt = await recordOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt(
        {
          filters: {
            limit: body.limit || request.query?.limit,
            report_id: body.report_id || request.query?.report_id,
            report_hash: body.report_hash || request.query?.report_hash,
            receipt_hash: body.receipt_hash || request.query?.receipt_hash,
            verifier: body.verifier || request.query?.verifier,
            failed_check: body.failed_check || request.query?.failed_check,
            q: body.q || request.query?.q
          },
          recorder: request.internalAdmin,
          signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_recorded',
          target_user_id: null,
          target_username: `final_delivery_command_trail_custody_checkpoint_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: {
            receipt_hash: receipt.receipt_hash,
            decision: receipt.decision,
            checkpoint_status: receipt.checkpoint_status,
            reason: receipt.reason,
            can_checkpoint_sealed_evidence: receipt.can_checkpoint_sealed_evidence,
            evidence_seal_receipt_hash: receipt.evidence_seal_receipt_hash,
            archive_escrow_receipt_hash: receipt.archive_escrow_receipt_hash,
            packet_hash: receipt.packet_hash,
            manifest_hash: receipt.manifest_hash,
            evidence_sealed_at: receipt.evidence_sealed_at,
            custody_checkpointed_at: receipt.custody_checkpointed_at,
            expires_at: receipt.expires_at,
            next_review_due_at: receipt.next_review_due_at,
            external_delivery: false,
            final_delivery: false,
            webhook: false,
            email: false,
            customer_dashboard: false,
            cloudflare_deploy: false
          },
          metadata: { source: 'ops_evidence_case_packet_bundle_final_delivery_command_trail_custody_checkpoint_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        custody_checkpoint_receipt: receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-history-v1',
      custody_checkpoint_receipts: await listOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipts({
        limit: request.query?.limit,
        decision: request.query?.decision,
        checkpoint_status: request.query?.checkpoint_status,
        can_checkpoint_sealed_evidence: request.query?.can_checkpoint_sealed_evidence,
        recorder: request.query?.recorder,
        receipt_hash: request.query?.receipt_hash
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-final-delivery-command-trail-custody-checkpoint-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCasePacketBundleFinalDeliveryCommandTrailCustodyCheckpointReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      custody_checkpoint_receipt: receipt
    };
  });

  app.post('/internal/ops/audit-evidence-case-packet-bundle/verify', async (request) => {
    const verification = await recordOpsAuditEvidenceCasePacketBundleVerification({
      bundle: request.body?.bundle || request.body || {},
      verifier: request.internalAdmin,
      signing_secret: config.internalAdminSessionSecret || config.internalAdminToken
    });
    return {
      ok: true,
      verification: {
        ...verification.receipt.verification,
        receipt_hash: verification.receipt_hash,
        verifier: verification.verifier
      },
      receipt: verification.receipt,
      history: verification
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-verifications', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-packet-bundle-verification-history-v1',
      verifications: await listOpsAuditEvidenceCasePacketBundleVerifications({
        limit: request.query?.limit,
        valid: request.query?.valid
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-packet-bundle-verifications/:id', async (request) => {
    const verification = await getOpsAuditEvidenceCasePacketBundleVerification(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: verification.receipt
      };
    }
    return {
      ok: true,
      verification
    };
  });

  app.get('/internal/ops/audit-evidence-cases', async (request) => {
    const cases = await listOpsAuditEvidenceCaseReviews({
      limit: request.query?.limit,
      status: request.query?.status,
      assignee: request.query?.assignee,
      priority: request.query?.priority,
      sla_status: request.query?.sla_status
    });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-reviews-v1',
      summary: buildEvidenceCaseReviewSummary(cases),
      cases
    };
  });

  app.post('/internal/ops/audit-evidence-cases', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const review = await createOpsAuditEvidenceCaseReview(
        {
          filters: {
            limit: request.query?.limit || body.filters?.limit,
            report_id: request.query?.report_id || body.filters?.report_id,
            report_hash: request.query?.report_hash || body.filters?.report_hash,
            receipt_hash: request.query?.receipt_hash || body.filters?.receipt_hash,
            verifier: request.query?.verifier || body.filters?.verifier,
            failed_check: request.query?.failed_check || body.filters?.failed_check,
            q: request.query?.q || body.filters?.q
          },
          status: body.status || 'open',
          priority: body.priority || 'normal',
          due_at: body.due_at || null,
          assignee: body.assignee || null,
          actor: request.internalAdmin
        },
        client
      );
      const reviewReceipt = await recordOpsAuditEvidenceCaseReviewReceipt(
        {
          review,
          action: 'opened',
          reviewer: request.internalAdmin,
          note: body.review_note || ''
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_opened',
          target_user_id: null,
          target_username: `evidence_case:${review.packet_hash}`,
          before_payload: {},
          after_payload: {
            id: review.id,
            packet_hash: review.packet_hash,
            status: review.status,
            priority: review.priority,
            due_at: review.due_at,
            sla: review.sla,
            assignee: review.assignee,
            anomaly_count: review.summary?.anomaly_count || 0,
            review_receipt_hash: reviewReceipt.receipt_hash
          },
          metadata: { source: 'ops_evidence_case_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        review,
        review_receipt: reviewReceipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-cases/anomaly-review', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const receiptHash = String(body.receipt_hash || request.query?.receipt_hash || '').trim();
      if (!receiptHash) {
        const error = new Error('Anomaly review requires a bundle verification receipt hash.');
        error.code = 'ops_audit_evidence_case_anomaly_receipt_hash_required';
        throw error;
      }
      const verification = await getOpsAuditEvidenceCasePacketBundleVerification(receiptHash, client);
      const failedChecks = Object.entries(verification.checks || {})
        .filter(([, value]) => value === false)
        .map(([key]) => key);
      const firstFailedCheck = failedChecks[0] || (verification.valid ? '' : 'entry_hashes_match');
      const review = await createOpsAuditEvidenceCaseReview(
        {
          filters: {
            limit: body.filters?.limit || request.query?.limit || 20,
            receipt_hash: verification.receipt_hash,
            failed_check: body.filters?.failed_check || firstFailedCheck,
            q: body.filters?.q || verification.bundle_manifest_hash || ''
          },
          status: body.status || 'in_review',
          priority: body.priority || (verification.valid ? 'normal' : 'critical'),
          due_at: body.due_at || null,
          assignee: body.assignee || null,
          actor: request.internalAdmin
        },
        client
      );
      const reviewReceipt = await recordOpsAuditEvidenceCaseReviewReceipt(
        {
          review,
          action: 'opened',
          reviewer: request.internalAdmin,
          note: body.review_note || `Opened anomaly review for bundle verification ${verification.receipt_hash}`
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_anomaly_review_opened',
          target_user_id: null,
          target_username: `bundle_verification:${verification.receipt_hash}`,
          before_payload: {},
          after_payload: {
            id: review.id,
            packet_hash: review.packet_hash,
            bundle_verification_receipt_hash: verification.receipt_hash,
            valid: verification.valid,
            status: review.status,
            priority: review.priority,
            due_at: review.due_at,
            sla: review.sla,
            assignee: review.assignee,
            anomaly_count: review.summary?.anomaly_count || 0,
            review_receipt_hash: reviewReceipt.receipt_hash
          },
          metadata: { source: 'ops_evidence_case_anomaly_review_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        review,
        review_receipt: reviewReceipt,
        bundle_verification: verification
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/audit-evidence-cases/:id', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const previousReview = await getOpsAuditEvidenceCaseReview(request.params.id, client);
      const review = await updateOpsAuditEvidenceCaseReview(
        request.params.id,
        {
          status: body.status,
          assignee: body.assignee,
          resolution_note: body.resolution_note,
          priority: body.priority,
          due_at: body.due_at
        },
        request.internalAdmin,
        client
      );
      const reviewReceipt = await recordOpsAuditEvidenceCaseReviewReceipt(
        {
          review,
          action: caseReviewActionFromStatusForApi(review.status),
          previous_status: previousReview.status,
          reviewer: request.internalAdmin,
          note: body.resolution_note || body.review_note || ''
        },
        client
      );
      const action = review.status === 'resolved' || review.status === 'dismissed'
        ? 'evidence_case_resolved'
        : 'evidence_case_updated';
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action,
          target_user_id: null,
          target_username: `evidence_case:${review.packet_hash}`,
          before_payload: {},
          after_payload: {
            id: review.id,
            packet_hash: review.packet_hash,
            status: review.status,
            priority: review.priority,
            due_at: review.due_at,
            sla: review.sla,
            assignee: review.assignee,
            resolution_note: review.resolution_note,
            resolved_by: review.resolved_by,
            resolved_at: review.resolved_at,
            review_receipt_hash: reviewReceipt.receipt_hash
          },
          metadata: { source: 'ops_evidence_case_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        review,
        review_receipt: reviewReceipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-review-receipts', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-review-receipts-v1',
      receipts: await listOpsAuditEvidenceCaseReviewReceipts({
        limit: request.query?.limit,
        case_id: request.query?.case_id,
        packet_hash: request.query?.packet_hash,
        receipt_hash: request.query?.receipt_hash,
        status: request.query?.status,
        reviewer: request.query?.reviewer
      })
    };
  });

  app.get('/internal/ops/audit-evidence-case-review-receipts/:id', async (request) => {
    const reviewReceipt = await getOpsAuditEvidenceCaseReviewReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: reviewReceipt.receipt
      };
    }
    return {
      ok: true,
      review_receipt: reviewReceipt
    };
  });

  app.get('/internal/ops/audit-evidence-case-notifications', async (request) => {
    const notifications = await listOpsAuditEvidenceCaseNotifications({
      limit: request.query?.limit,
      status: request.query?.status,
      kind: request.query?.kind,
      case_kind: request.query?.case_kind
    });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-notifications-v1',
      summary: buildEvidenceCaseNotificationSummary(notifications),
      notifications
    };
  });

  app.post('/internal/ops/audit-evidence-case-notifications/generate', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const notifications = await generateOpsAuditEvidenceCaseNotifications(
        {
          actor: request.internalAdmin,
          limit: request.body?.limit || request.query?.limit,
          case_kind: request.body?.case_kind || request.query?.case_kind
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notifications_generated',
          target_user_id: null,
          target_username: 'evidence_case_notifications',
          before_payload: {},
          after_payload: {
            generated_count: notifications.length,
            notification_ids: notifications.map((notification) => notification.id),
            kinds: notifications.map((notification) => notification.kind),
            case_kinds: notifications.map((notification) => notification.case_kind)
          },
          metadata: { source: 'ops_evidence_case_notification_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        schema_version: 'phase4-ops-audit-evidence-case-notifications-v1',
        summary: buildEvidenceCaseNotificationSummary(notifications),
        notifications
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-anomaly-notifications', async (request) => {
    const notifications = await listOpsAuditEvidenceCaseNotifications({
      limit: request.query?.limit,
      status: request.query?.status,
      kind: request.query?.kind,
      case_kind: 'bundle_anomaly_review'
    });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-anomaly-notifications-v1',
      summary: buildEvidenceCaseNotificationSummary(notifications),
      notifications
    };
  });

  app.post('/internal/ops/audit-evidence-case-anomaly-notifications/generate', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const notifications = await generateOpsAuditEvidenceCaseNotifications(
        {
          actor: request.internalAdmin,
          limit: request.body?.limit || request.query?.limit,
          case_kind: 'bundle_anomaly_review'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_anomaly_notifications_generated',
          target_user_id: null,
          target_username: 'evidence_case_anomaly_notifications',
          before_payload: {},
          after_payload: {
            generated_count: notifications.length,
            notification_ids: notifications.map((notification) => notification.id),
            bundle_receipts: notifications.map((notification) => notification.bundle_verification_receipt_hash).filter(Boolean),
            kinds: notifications.map((notification) => notification.kind)
          },
          metadata: { source: 'ops_evidence_case_anomaly_notification_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        schema_version: 'phase4-ops-audit-evidence-case-anomaly-notifications-v1',
        summary: buildEvidenceCaseNotificationSummary(notifications),
        notifications
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-anomaly-notification-digests', async (request) => {
    const digests = await listOpsAuditEvidenceCaseAnomalyNotificationDigests({ limit: request.query?.limit });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digests-v1',
      digests
    };
  });

  app.post('/internal/ops/audit-evidence-case-anomaly-notification-digests', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const digest = await createOpsAuditEvidenceCaseAnomalyNotificationDigest(
        {
          actor: request.internalAdmin,
          filters: {
            limit: request.body?.limit || request.query?.limit,
            status: request.body?.status || request.query?.status,
            kind: request.body?.kind || request.query?.kind
          }
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_anomaly_notification_digest_generated',
          target_user_id: null,
          target_username: `anomaly_notification_digest:${digest.digest_id}`,
          before_payload: {},
          after_payload: {
            id: digest.id,
            digest_id: digest.digest_id,
            digest_hash: digest.digest_hash,
            html_hash: digest.html_hash,
            notification_count: digest.notification_count,
            summary: digest.summary
          },
          metadata: { source: 'ops_evidence_case_anomaly_notification_digest_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        digest
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-anomaly-notification-digests/:id', async (request, reply) => {
    const digestRecord = await getOpsAuditEvidenceCaseAnomalyNotificationDigest(request.params.id);
    if (request.query?.format === 'html') {
      return reply
        .type('text/html; charset=utf-8')
        .send(digestRecord.html_snapshot || buildOpsAuditEvidenceCaseAnomalyNotificationDigestHtml(digestRecord.digest));
    }
    return {
      ok: true,
      digest: digestRecord
    };
  });

  app.get('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule', async () => {
    const schedule = await getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule();
    return {
      ok: true,
      schedule
    };
  });

  app.patch('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(client);
      const schedule = await updateOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(
        request.body || {},
        request.internalAdmin,
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_anomaly_notification_digest_schedule_updated',
          target_user_id: null,
          target_username: 'evidence_case_anomaly_notification_digest_schedule',
          before_payload: before,
          after_payload: schedule,
          metadata: { source: 'ops_evidence_case_anomaly_notification_digest_schedule_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, schedule };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule/run', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const run = await runOpsAuditEvidenceCaseAnomalyNotificationDigestSchedule(
        {
          actor: request.internalAdmin,
          force: body.force === true,
          source: body.source || 'api_run_now'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: `evidence_case_anomaly_notification_digest_schedule_${run.status}`,
          target_user_id: null,
          target_username: 'evidence_case_anomaly_notification_digest_schedule',
          before_payload: null,
          after_payload: run,
          metadata: { source: 'ops_evidence_case_anomaly_notification_digest_schedule_run_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, run };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-anomaly-notification-digest-retention-receipts', async (request) => {
    const receipts = await listOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipts({ limit: request.query?.limit });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-evidence-case-anomaly-notification-digest-retention-receipts-v1',
      receipts
    };
  });

  app.post('/internal/ops/audit-evidence-case-anomaly-notification-digest-retention-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const receipt = await createOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipt(
        {
          actor: request.internalAdmin,
          retention_days: request.body?.retention_days
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_anomaly_notification_digest_retention_receipt_generated',
          target_user_id: null,
          target_username: `evidence_case_anomaly_notification_digest_retention_receipt:${receipt.receipt_hash}`,
          before_payload: {},
          after_payload: receipt,
          metadata: { source: 'ops_evidence_case_anomaly_notification_digest_retention_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        receipt
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-evidence-case-anomaly-notification-digest-retention-receipts/:id', async (request) => {
    const receipt = await getOpsAuditEvidenceCaseAnomalyNotificationDigestRetentionReceipt(request.params.id);
    return {
      ok: true,
      receipt: request.query?.format === 'receipt' ? receipt.receipt : receipt
    };
  });

  app.post('/internal/ops/audit-evidence-case-anomaly-notification-digest-schedule/prune', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const prune = await pruneOpsAuditEvidenceCaseAnomalyNotificationDigests(
        {
          actor: request.internalAdmin,
          execute: body.execute === true,
          retention_days: body.retention_days
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: prune.executed
            ? 'evidence_case_anomaly_notification_digest_pruned'
            : 'evidence_case_anomaly_notification_digest_prune_planned',
          target_user_id: null,
          target_username: 'evidence_case_anomaly_notification_digest_schedule',
          before_payload: null,
          after_payload: prune,
          metadata: { source: 'ops_evidence_case_anomaly_notification_digest_prune_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, prune };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/audit-evidence-case-notifications/:id', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const notification = await updateOpsAuditEvidenceCaseNotification(
        request.params.id,
        {
          status: body.status,
          snoozed_until: body.snoozed_until
        },
        request.internalAdmin,
        client
      );
      const action = notification.status === 'snoozed'
        ? 'evidence_case_notification_snoozed'
        : 'evidence_case_notification_acknowledged';
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action,
          target_user_id: null,
          target_username: `evidence_case_notification:${notification.id}`,
          before_payload: {},
          after_payload: {
            id: notification.id,
            case_id: notification.case_id,
            kind: notification.kind,
            status: notification.status,
            snoozed_until: notification.snoozed_until,
            acknowledged_by: notification.acknowledged_by,
            acknowledged_at: notification.acknowledged_at
          },
          metadata: { source: 'ops_evidence_case_notification_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        notification
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-policy', async () => {
    const policy = await getOpsAuditNotificationPolicy();
    return {
      ok: true,
      policy
    };
  });

  app.patch('/internal/ops/audit-notification-policy', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const policy = await updateOpsAuditNotificationPolicy(request.body || {}, request.internalAdmin, client);
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_policy_updated',
          target_user_id: null,
          target_username: 'evidence_case_notification_policy',
          before_payload: {},
          after_payload: {
            enabled: policy.enabled,
            min_priority: policy.min_priority,
            notify_overdue: policy.notify_overdue,
            notify_due_soon: policy.notify_due_soon,
            quiet_hours: policy.quiet_hours,
            adapters: policy.adapters
          },
          metadata: { source: 'ops_evidence_case_notification_policy_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        policy
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-rules', async (request) => {
    const rules = await listOpsAuditNotificationRules({
      limit: request.query?.limit,
      enabled: request.query?.enabled ?? ''
    });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-notification-rules-v1',
      rules
    };
  });

  app.post('/internal/ops/audit-notification-rules', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rule = await upsertOpsAuditNotificationRule(request.body || {}, request.internalAdmin, client);
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_rule_upserted',
          target_user_id: null,
          target_username: `evidence_case_notification_rule:${rule.id}`,
          before_payload: {},
          after_payload: rule,
          metadata: { source: 'ops_evidence_case_notification_rule_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        rule
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/audit-notification-rules/:id', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rule = await updateOpsAuditNotificationRule(request.params.id, request.body || {}, request.internalAdmin, client);
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_rule_updated',
          target_user_id: null,
          target_username: `evidence_case_notification_rule:${rule.id}`,
          before_payload: {},
          after_payload: rule,
          metadata: { source: 'ops_evidence_case_notification_rule_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        rule
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-deliveries', async (request) => {
    const attempts = await listOpsAuditNotificationDeliveryAttempts({
      limit: request.query?.limit,
      notification_id: request.query?.notification_id,
      adapter: request.query?.adapter,
      status: request.query?.status
    });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-notification-deliveries-v1',
      summary: buildOpsAuditNotificationDeliverySummary(attempts),
      attempts
    };
  });

  app.get('/internal/ops/audit-notification-deliveries/:id/explain', async (request) => {
    const attempt = await getOpsAuditNotificationDeliveryAttempt(request.params.id);
    return {
      ok: true,
      explanation: explainOpsAuditNotificationDeliveryAttempt(attempt)
    };
  });

  app.get('/internal/ops/audit-notification-replay-approvals', async (request) => {
    const approvals = await listOpsAuditNotificationReplayApprovals({
      limit: request.query?.limit,
      status: request.query?.status,
      source_attempt_id: request.query?.source_attempt_id,
      requested_by: request.query?.requested_by,
      reviewed_by: request.query?.reviewed_by,
      assigned_reviewer: request.query?.assigned_reviewer,
      q: request.query?.q,
      expired: request.query?.expired ?? ''
    });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-notification-replay-approvals-v1',
      approvals
    };
  });

  app.get('/internal/ops/audit-notification-replay-workload', async (request) => {
    const workload = await getOpsAuditNotificationReplayWorkload({
      limit: request.query?.limit,
      assigned_reviewer: request.query?.assigned_reviewer,
      due_soon_hours: request.query?.due_soon_hours
    });
    return {
      ok: true,
      workload
    };
  });

  app.get('/internal/ops/audit-notification-replay-escalation-report', async (request, reply) => {
    const workload = await getOpsAuditNotificationReplayWorkload({
      limit: request.query?.limit,
      assigned_reviewer: request.query?.assigned_reviewer,
      due_soon_hours: request.query?.due_soon_hours
    });
    const report = buildOpsAuditNotificationReplayEscalationReport(workload, {
      actor: request.internalAdmin
    });
    if (request.query?.format === 'html') {
      reply.type('text/html; charset=utf-8');
      return buildOpsAuditNotificationReplayEscalationReportHtml(report);
    }
    return {
      ok: true,
      report
    };
  });

  app.get('/internal/ops/audit-notification-replay-performance-report', async (request, reply) => {
    const report = await getOpsAuditNotificationReplayPerformanceReport({
      limit: request.query?.limit,
      assigned_reviewer: request.query?.assigned_reviewer,
      due_soon_hours: request.query?.due_soon_hours,
      actor: request.internalAdmin
    });
    if (request.query?.format === 'html') {
      reply.type('text/html; charset=utf-8');
      return buildOpsAuditNotificationReplayPerformanceReportHtml(report);
    }
    return {
      ok: true,
      report
    };
  });

  app.get('/internal/ops/audit-notification-replay-performance-thresholds', async () => {
    const policy = await getOpsAuditNotificationReplayPerformanceThresholdPolicy();
    return {
      ok: true,
      policy
    };
  });

  app.patch('/internal/ops/audit-notification-replay-performance-thresholds', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplayPerformanceThresholdPolicy(client);
      const policy = await updateOpsAuditNotificationReplayPerformanceThresholdPolicy(
        request.body || {},
        request.internalAdmin,
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_performance_thresholds_updated',
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_performance_thresholds',
          before_payload: before,
          after_payload: policy,
          metadata: { source: 'ops_evidence_case_notification_replay_performance_thresholds_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, policy };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-replay-sla-alerts', async (request) => {
    const alerts = await listOpsAuditNotificationReplaySlaAlerts({
      limit: request.query?.limit,
      status: request.query?.status,
      severity: request.query?.severity,
      reviewer: request.query?.reviewer,
      metric: request.query?.metric
    });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-notification-replay-sla-alerts-v1',
      summary: buildOpsAuditNotificationReplaySlaAlertSummary(alerts),
      alerts
    };
  });

  app.post('/internal/ops/audit-notification-replay-sla-alerts/generate', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const generation = await generateOpsAuditNotificationReplaySlaAlerts(
        {
          actor: request.internalAdmin,
          limit: body.limit || request.query?.limit,
          assigned_reviewer: body.assigned_reviewer || request.query?.assigned_reviewer,
          due_soon_hours: body.due_soon_hours || request.query?.due_soon_hours
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_sla_alerts_generated',
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alerts',
          before_payload: null,
          after_payload: generation,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alerts_generate_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, generation };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/audit-notification-replay-sla-alerts/:id', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = (await listOpsAuditNotificationReplaySlaAlerts({ limit: 1 }, client))
        .find((alert) => alert.id === request.params.id) || null;
      const body = request.body || {};
      const alert = await updateOpsAuditNotificationReplaySlaAlert(
        request.params.id,
        {
          status: body.status || body.action,
          note: body.note || body.action_note,
          snoozed_until: body.snoozed_until,
          snooze_minutes: body.snooze_minutes
        },
        request.internalAdmin,
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: `evidence_case_notification_replay_sla_alert_${alert.status}`,
          target_user_id: null,
          target_username: `evidence_case_notification_replay_sla_alert:${alert.id}`,
          before_payload: before,
          after_payload: alert,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_update_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, alert };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-replay-sla-alert-schedule', async () => {
    const schedule = await getOpsAuditNotificationReplaySlaAlertSchedule();
    return {
      ok: true,
      schedule
    };
  });

  app.patch('/internal/ops/audit-notification-replay-sla-alert-schedule', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplaySlaAlertSchedule(client);
      const schedule = await updateOpsAuditNotificationReplaySlaAlertSchedule(
        request.body || {},
        request.internalAdmin,
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_sla_alert_schedule_updated',
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alert_schedule',
          before_payload: before,
          after_payload: schedule,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_schedule_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, schedule };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-notification-replay-sla-alert-schedule/run', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const run = await runOpsAuditNotificationReplaySlaAlertSchedule(
        {
          actor: request.internalAdmin,
          force: body.force === true,
          source: body.source || 'api_run_now'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: `evidence_case_notification_replay_sla_alert_schedule_${run.status}`,
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alert_schedule',
          before_payload: null,
          after_payload: run,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_schedule_run_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, run };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-replay-sla-alert-digests', async (request) => {
    const digests = await listOpsAuditNotificationReplaySlaAlertDigests({ limit: request.query?.limit });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digests-v1',
      digests
    };
  });

  app.post('/internal/ops/audit-notification-replay-sla-alert-digests', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const digest = await createOpsAuditNotificationReplaySlaAlertDigest(
        {
          actor: request.internalAdmin,
          limit: body.limit || request.query?.limit,
          status: body.status || request.query?.status,
          severity: body.severity || request.query?.severity,
          reviewer: body.reviewer || request.query?.reviewer,
          metric: body.metric || request.query?.metric
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_sla_alert_digest_generated',
          target_user_id: null,
          target_username: `evidence_case_notification_replay_sla_alert_digest:${digest.digest_id}`,
          before_payload: null,
          after_payload: digest,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_digest_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, digest };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-replay-sla-alert-digests/:id', async (request, reply) => {
    const digestRecord = await getOpsAuditNotificationReplaySlaAlertDigest(request.params.id);
    if (request.query?.format === 'html') {
      return reply
        .header('content-type', 'text/html; charset=utf-8')
        .send(digestRecord.html_snapshot || buildOpsAuditNotificationReplaySlaAlertDigestHtml(digestRecord.digest));
    }
    return {
      ok: true,
      digest: digestRecord
    };
  });

  app.get('/internal/ops/audit-notification-replay-sla-alert-digest-retention-receipts', async (request) => {
    const receipts = await listOpsAuditNotificationReplaySlaAlertDigestRetentionReceipts({ limit: request.query?.limit });
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-notification-replay-sla-alert-digest-retention-receipts-v1',
      receipts
    };
  });

  app.post('/internal/ops/audit-notification-replay-sla-alert-digest-retention-receipts', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const receipt = await createOpsAuditNotificationReplaySlaAlertDigestRetentionReceipt(
        {
          actor: request.internalAdmin,
          retention_days: request.body?.retention_days
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_sla_alert_digest_retention_receipt_generated',
          target_user_id: null,
          target_username: `evidence_case_notification_replay_sla_alert_digest_retention_receipt:${receipt.receipt_hash}`,
          before_payload: null,
          after_payload: receipt,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_digest_retention_receipt_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, receipt };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-replay-sla-alert-digest-retention-receipts/:id', async (request) => {
    const receipt = await getOpsAuditNotificationReplaySlaAlertDigestRetentionReceipt(request.params.id);
    if (request.query?.format === 'receipt') {
      return {
        ok: true,
        receipt: receipt.receipt
      };
    }
    return {
      ok: true,
      receipt
    };
  });

  app.get('/internal/ops/audit-notification-replay-sla-alert-digest-schedule', async () => {
    const schedule = await getOpsAuditNotificationReplaySlaAlertDigestSchedule();
    return {
      ok: true,
      schedule
    };
  });

  app.patch('/internal/ops/audit-notification-replay-sla-alert-digest-schedule', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplaySlaAlertDigestSchedule(client);
      const schedule = await updateOpsAuditNotificationReplaySlaAlertDigestSchedule(
        request.body || {},
        request.internalAdmin,
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_sla_alert_digest_schedule_updated',
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alert_digest_schedule',
          before_payload: before,
          after_payload: schedule,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_digest_schedule_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, schedule };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-notification-replay-sla-alert-digest-schedule/run', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const run = await runOpsAuditNotificationReplaySlaAlertDigestSchedule(
        {
          actor: request.internalAdmin,
          force: body.force === true,
          source: body.source || 'api_run_now'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: `evidence_case_notification_replay_sla_alert_digest_schedule_${run.status}`,
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alert_digest_schedule',
          before_payload: null,
          after_payload: run,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_digest_schedule_run_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, run };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-notification-replay-sla-alert-digest-schedule/prune', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const prune = await pruneOpsAuditNotificationReplaySlaAlertDigests(
        {
          actor: request.internalAdmin,
          execute: body.execute === true,
          retention_days: body.retention_days
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: prune.executed
            ? 'evidence_case_notification_replay_sla_alert_digest_pruned'
            : 'evidence_case_notification_replay_sla_alert_digest_prune_planned',
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_sla_alert_digest_schedule',
          before_payload: null,
          after_payload: prune,
          metadata: { source: 'ops_evidence_case_notification_replay_sla_alert_digest_prune_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, prune };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-notification-replay-approvals/cleanup-expired', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const cleanup = await cleanupExpiredOpsAuditNotificationReplayApprovals(
        {
          actor: request.internalAdmin,
          limit: body.limit,
          cleanup_reason: body.cleanup_reason || body.reason
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_approvals_expired',
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_approvals:expired',
          before_payload: {},
          after_payload: cleanup,
          metadata: { source: 'ops_evidence_case_notification_replay_approval_cleanup_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, cleanup };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-notification-replay-policy', async () => {
    const policy = await getOpsAuditNotificationReplayPolicy();
    return {
      ok: true,
      policy
    };
  });

  app.patch('/internal/ops/audit-notification-replay-policy', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplayPolicy(client);
      const body = request.body || {};
      const policy = await updateOpsAuditNotificationReplayPolicy(
        {
          enabled: body.enabled,
          allow_self_approval: body.allow_self_approval,
          required_reviewer_role: body.required_reviewer_role,
          request_ttl_minutes: body.request_ttl_minutes
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_policy_updated',
          target_user_id: null,
          target_username: 'evidence_case_notification_replay_policy',
          before_payload: before,
          after_payload: policy,
          metadata: { source: 'ops_evidence_case_notification_replay_policy_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, policy };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-notification-deliveries/:id/replay-approvals', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const approval = await createOpsAuditNotificationReplayApproval(
        {
          source_attempt_id: request.params.id,
          force_reason: body.force_reason || body.approval_reason,
          actor: request.internalAdmin
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_approval_requested',
          target_user_id: null,
          target_username: `evidence_case_notification_replay_approval:${approval.id}`,
          before_payload: {},
          after_payload: approval,
          metadata: { source: 'ops_evidence_case_notification_replay_approval_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, approval };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/audit-notification-replay-approvals/:id', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplayApproval(request.params.id, client);
      const body = request.body || {};
      const approval = await reviewOpsAuditNotificationReplayApproval(
        {
          id: request.params.id,
          status: body.status,
          review_note: body.review_note,
          rejection_reason: body.rejection_reason,
          actor: request.internalAdmin
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: approval.status === 'approved'
            ? 'evidence_case_notification_replay_approval_approved'
            : 'evidence_case_notification_replay_approval_rejected',
          target_user_id: null,
          target_username: `evidence_case_notification_replay_approval:${approval.id}`,
          before_payload: before,
          after_payload: approval,
          metadata: { source: 'ops_evidence_case_notification_replay_approval_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, approval };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/audit-notification-replay-approvals/:id/assign', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplayApproval(request.params.id, client);
      const body = request.body || {};
      const approval = await assignOpsAuditNotificationReplayApproval(
        {
          id: request.params.id,
          assigned_reviewer: body.assigned_reviewer || {
            username: body.assigned_reviewer_username || body.username,
            role: body.assigned_reviewer_role || body.role
          },
          actor: request.internalAdmin
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_approval_assigned',
          target_user_id: null,
          target_username: `evidence_case_notification_replay_approval:${approval.id}`,
          before_payload: before,
          after_payload: approval,
          metadata: { source: 'ops_evidence_case_notification_replay_approval_assign_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, approval };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/audit-notification-replay-approvals/:id/workload-action', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplayApproval(request.params.id, client);
      const body = request.body || {};
      const approval = await updateOpsAuditNotificationReplayWorkloadAction(
        {
          id: request.params.id,
          action: body.action,
          note: body.note || body.workload_action_note || body.resolution_note,
          assigned_reviewer: body.assigned_reviewer || {
            username: body.assigned_reviewer_username || body.username,
            role: body.assigned_reviewer_role || body.role
          },
          actor: request.internalAdmin
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: `evidence_case_notification_replay_workload_${approval.workload_action_status}`,
          target_user_id: null,
          target_username: `evidence_case_notification_replay_approval:${approval.id}`,
          before_payload: before,
          after_payload: approval,
          metadata: { source: 'ops_evidence_case_notification_replay_workload_action_api' }
        },
        client
      );
      await client.query('COMMIT');
      return { ok: true, approval };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-notification-replay-approvals/:id/execute', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const before = await getOpsAuditNotificationReplayApproval(request.params.id, client);
      const result = await executeOpsAuditNotificationReplayApproval(
        {
          id: request.params.id,
          actor: request.internalAdmin
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_replay_approval_executed',
          target_user_id: null,
          target_username: `evidence_case_notification_replay_approval:${result.approval.id}`,
          before_payload: before,
          after_payload: {
            approval: result.approval,
            replay_attempt_ids: result.replay.attempts.map((attempt) => attempt.id),
            replay_attempt_metadata: result.replay.attempts.map((attempt) => ({
              id: attempt.id,
              replay_source_attempt_id: attempt.replay_source_attempt_id,
              force_replay: attempt.force_replay
            }))
          },
          metadata: { source: 'ops_evidence_case_notification_replay_approval_execute_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        approval: result.approval,
        replay: result.replay
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-notification-deliveries/:id/replay', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const replay = await replayOpsAuditNotificationDeliveryAttempt(
        {
          id: request.params.id,
          actor: request.internalAdmin,
          force: body.force === true || request.query?.force === 'true',
          force_reason: body.force_reason || body.approval_reason || request.query?.force_reason || request.query?.approval_reason,
          approved_by: body.approved_by || request.internalAdmin
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_delivery_replayed',
          target_user_id: null,
          target_username: `evidence_case_notification_delivery:${replay.source_attempt.id}`,
          before_payload: replay.source_attempt,
          after_payload: {
            force: replay.force,
            approval: replay.approval,
            source_attempt_id: replay.source_attempt.id,
            source_reason: replay.source_attempt.reason,
            replay_attempt_ids: replay.attempts.map((attempt) => attempt.id),
            statuses: replay.attempts.map((attempt) => attempt.status),
            reasons: replay.attempts.map((attempt) => attempt.reason),
            replay_attempt_metadata: replay.attempts.map((attempt) => ({
              id: attempt.id,
              replay_source_attempt_id: attempt.replay_source_attempt_id,
              force_replay: attempt.force_replay
            }))
          },
          metadata: { source: 'ops_evidence_case_notification_delivery_replay_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        replay
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/internal/ops/audit-evidence-case-notifications/deliver', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const adapter = body.adapter || request.query?.adapter || 'webhook';
      const { policy, attempts } = await deliverOpsAuditEvidenceCaseNotifications(
        {
          actor: request.internalAdmin,
          adapter,
          notification_id: body.notification_id || request.query?.notification_id,
          limit: body.limit || request.query?.limit,
          force: body.force === true || request.query?.force === 'true'
        },
        client
      );
      await recordInternalAdminAuditEvent(
        {
          actor_username: request.internalAdmin.username,
          actor_role: request.internalAdmin.role,
          action: 'evidence_case_notification_delivery_attempted',
          target_user_id: null,
          target_username: 'evidence_case_notification_delivery',
          before_payload: {},
          after_payload: {
            adapter,
            attempt_count: attempts.length,
            attempt_ids: attempts.map((attempt) => attempt.id),
            rule_ids: attempts.map((attempt) => attempt.rule_id).filter(Boolean),
            escalation_assignees: attempts.map((attempt) => attempt.escalation_assignee).filter(Boolean),
            statuses: attempts.map((attempt) => attempt.status),
            reasons: attempts.map((attempt) => attempt.reason)
          },
          metadata: { source: 'ops_evidence_case_notification_delivery_api' }
        },
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        schema_version: 'phase4-ops-audit-notification-deliveries-v1',
        policy,
        summary: buildOpsAuditNotificationDeliverySummary(attempts),
        attempts
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/ops/audit-report-archives/:id', async (request, reply) => {
    const archive = await getOpsAuditReportArchive(request.params.id);
    if (request.query?.format === 'html') {
      return reply.type('text/html').send(archive.html_snapshot);
    }
    return {
      ok: true,
      archive
    };
  });

  app.get('/internal/ops/audit-views', async () => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-saved-views-v1',
      views: await listOpsAuditSavedViews()
    };
  });

  app.post('/internal/ops/audit-views', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-saved-views-v1',
      view: await createOpsAuditSavedView({
        name: body.name,
        filters: body.filters,
        actor: request.internalAdmin
      })
    };
  });

  app.patch('/internal/ops/audit-views/:id', async (request) => {
    const body = request.body || {};
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-saved-views-v1',
      view: await updateOpsAuditSavedView(request.params.id, {
        name: body.name,
        filters: body.filters,
        actor: request.internalAdmin
      })
    };
  });

  app.delete('/internal/ops/audit-views/:id', async (request) => {
    return {
      ok: true,
      schema_version: 'phase4-ops-audit-saved-views-v1',
      deleted: await deleteOpsAuditSavedView(request.params.id)
    };
  });

  app.get('/internal/ops/audit-retention', async () => {
    return {
      ok: true,
      retention: await getOpsAuditRetentionSettings()
    };
  });

  app.patch('/internal/ops/audit-retention', async (request) => {
    return {
      ok: true,
      retention: await updateOpsAuditRetentionSettings({
        retention_days: request.body?.retention_days,
        actor: request.internalAdmin
      })
    };
  });

  app.post('/internal/ops/audit-retention/prune', async (request) => {
    return {
      ok: true,
      prune: await buildOpsAuditRetentionPrunePlan({
        execute: request.body?.execute === true,
        actor: request.internalAdmin
      })
    };
  });

  app.get('/internal/ops/admin-users', async () => {
    const users = await listInternalAdminUsers();
    return {
      ok: true,
      schema_version: 'phase4-internal-admin-users-v1',
      users: users.map(sanitizeInternalAdminUser)
    };
  });

  app.post('/internal/ops/admin-users', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const user = await createInternalAdminUser(request.body || {}, client);
      await recordInternalAdminAuditEvent(
        buildInternalAdminAuditEvent({
          actor: request.internalAdmin,
          action: 'admin_user_created',
          targetUser: user,
          metadata: { source: 'ops_admin_users_api' }
        }),
        client
      );
      await client.query('COMMIT');
      return {
        ok: true,
        schema_version: 'phase4-internal-admin-user-management-v1',
        user: sanitizeInternalAdminUser(user)
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.patch('/internal/ops/admin-users/:username', async (request) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const body = request.body || {};
      const username = request.params.username;
      const beforeUser = await getInternalAdminUserByUsername(username, client);
      let user = null;
      const auditActions = [];
      if (body.password !== undefined) {
        user = await resetInternalAdminUserPassword(username, body.password, client);
        auditActions.push('admin_user_password_reset');
      }
      if (body.role !== undefined || body.display_name !== undefined) {
        user = await updateInternalAdminUser(
          username,
          {
            role: body.role,
            display_name: body.display_name
          },
          client
        );
        if (body.role !== undefined && body.role !== beforeUser?.role) auditActions.push('admin_user_role_changed');
        if (body.display_name !== undefined && body.display_name !== beforeUser?.display_name) {
          auditActions.push('admin_user_display_name_changed');
        }
      }
      if (body.disabled !== undefined) {
        user = await setInternalAdminUserDisabled(username, Boolean(body.disabled), client);
        if (Boolean(body.disabled) !== Boolean(beforeUser?.disabled_at)) {
          auditActions.push(Boolean(body.disabled) ? 'admin_user_disabled' : 'admin_user_enabled');
        }
      }
      if (!user) {
        user = await updateInternalAdminUser(username, {}, client);
      }
      for (const action of auditActions) {
        await recordInternalAdminAuditEvent(
          buildInternalAdminAuditEvent({
            actor: request.internalAdmin,
            action,
            targetUser: user,
            beforeUser,
            metadata: { source: 'ops_admin_users_api' }
          }),
          client
        );
      }
      await client.query('COMMIT');
      return {
        ok: true,
        schema_version: 'phase4-internal-admin-user-management-v1',
        user: sanitizeInternalAdminUser(user)
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  app.get('/internal/usage/summary', async (request) => {
    return {
      ok: true,
      rows: await getUsageSummary({
        brand_id: request.query?.brand_id,
        customer_id: request.query?.customer_id
      })
    };
  });

  app.post('/internal/scheduler/run-once', async (request) => {
    const body = request.body || {};
    const result = await scheduleTrackingRuns({
      redis,
      provider_mode: body.provider_mode || 'unconfigured',
      allow_paid_provider: body.allow_paid_provider === true
    });
    return { ok: true, ...result };
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = getConfig();
  const app = buildApi();
  registerApiShutdownHandlers(app);
  try {
    await app.listen({ host: '0.0.0.0', port: config.port });
  } catch (error) {
    logger.error({ error }, 'api failed to start');
    process.exit(1);
  }
}

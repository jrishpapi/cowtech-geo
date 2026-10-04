<?php

namespace App\Http\Controllers\Customer;

require_once __DIR__.'/../../../Services/Customer/AivglDashboardClient.php';
require_once __DIR__.'/../../../Services/Customer/AivglCampaignHandoffService.php';
require_once __DIR__.'/../../../Services/Customer/BillingAddonBridge.php';
require_once __DIR__.'/../../../Services/Customer/BillingEntitlementBridge.php';
require_once __DIR__.'/../../../Services/Customer/CustomerOnboardingService.php';
require_once __DIR__.'/../../../Services/Customer/GodModeDeliverableBridge.php';
require_once __DIR__.'/../../../Services/Customer/LaunchPackFulfillmentBridge.php';
require_once __DIR__.'/../../../Services/Customer/LaunchPackOrchestrator.php';

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\Article;
use App\Models\CustomerBillingEntitlement;
use App\Models\CustomerLaunchPackFulfillment;
use App\Models\CustomerWorkspace;
use App\Models\Task;
use App\Models\TaskRun;
use App\Services\Customer\AivglCampaignHandoffService;
use App\Services\Customer\AivglDashboardClient;
use App\Services\Customer\BillingAddonBridge;
use App\Services\Customer\BillingEntitlementBridge;
use App\Services\Customer\CustomerOnboardingService;
use App\Services\Customer\GodModeDeliverableBridge;
use App\Services\Customer\LaunchPackFulfillmentBridge;
use App\Services\Customer\LaunchPackOrchestrator;
use Illuminate\Http\Client\Response as ClientResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

class DashboardController extends Controller
{
    public function __construct(
        private readonly AivglDashboardClient $aivglDashboardClient,
        private readonly CustomerOnboardingService $onboardingService,
        private readonly LaunchPackFulfillmentBridge $launchPackFulfillmentBridge,
        private readonly BillingEntitlementBridge $billingEntitlementBridge,
        private readonly BillingAddonBridge $billingAddonBridge,
        private readonly GodModeDeliverableBridge $godModeDeliverableBridge,
        private readonly LaunchPackOrchestrator $launchPackOrchestrator,
    ) {}

    public function index(Request $request): View|RedirectResponse
    {
        $admin = $request->user('admin');
        $workspace = $admin instanceof Admin ? $this->onboardingService->workspaceFor($admin) : null;
        $launchPackEntitlement = $admin instanceof Admin
            ? $this->boundLaunchPackEntitlement($admin, true)
            : null;

        if (
            ! $workspace instanceof CustomerWorkspace
            && $launchPackEntitlement instanceof CustomerBillingEntitlement
            && (string) $launchPackEntitlement->plan_code === 'launch'
        ) {
            return redirect()->route('customer.launch-pack.show');
        }

        if (! $workspace instanceof CustomerWorkspace && ! $this->onboardingService->shouldUseDemoFallback($admin instanceof Admin ? $admin : null)) {
            return redirect()->route('customer.start');
        }

        if ($workspace instanceof CustomerWorkspace) {
            $workspace = $this->onboardingService->refreshDiagnosisStatus($workspace);
        }

        $aivgl = $this->aivglDashboardClient->snapshot($workspace);
        if ($workspace instanceof CustomerWorkspace && ! (bool) ($aivgl['connected'] ?? false)) {
            return view('customer.dashboard-pending', [
                'pageTitle' => __('customer.page_pending'),
                'activeMenu' => 'dashboard',
                'workspace' => $workspace,
            ]);
        }

        $summary = $this->summary($aivgl, $workspace);
        $launchPack = $launchPackEntitlement instanceof CustomerBillingEntitlement
            ? $this->statusForEntitlement($launchPackEntitlement)
            : ['ok' => false, 'launch_pack' => []];
        $billingAddons = $admin instanceof Admin
            ? $this->billingAddonBridge->summaryForEmail((string) $admin->email)
            : ['totals' => ['credits' => 0, 'article' => 0, 'competitor' => 0], 'items' => []];
        $billingEntitlement = $admin instanceof Admin
            ? $this->billingEntitlementBridge->claimedEntitlementForAdmin($admin)
            : null;
        $billingLedger = $this->billingLedger($billingEntitlement, $billingAddons, $aivgl);

        return view('customer.dashboard', [
            'pageTitle' => __('customer.page_dashboard'),
            'activeMenu' => 'dashboard',
            'aivgl' => $aivgl,
            'launchPack' => $launchPack,
            'billingAddons' => $billingAddons,
            'billingLedger' => $billingLedger,
            'deliveryStatus' => $this->deliveryStatus($aivgl, $workspace, $launchPack),
            'summary' => $summary,
            'pipeline' => $this->pipeline($summary),
            'opportunities' => $this->opportunities($aivgl),
            'articleFeedback' => $this->articleFeedback($aivgl, $workspace),
        ]);
    }

    public function start(Request $request): View|RedirectResponse
    {
        $admin = $request->user('admin');
        $prefill = $request->session()->get('customer_start_prefill', []);
        $prefill = is_array($prefill) ? $prefill : [];

        return view('customer.start', [
            'pageTitle' => __('customer.page_start'),
            'activeMenu' => 'dashboard',
            'workspace' => $admin instanceof Admin ? $this->onboardingService->workspaceFor($admin) : null,
            'prefill' => $prefill,
            'entitlementGate' => $admin instanceof Admin
                ? $this->billingEntitlementBridge->accessStateForAdmin($admin)
                : $this->billingEntitlementBridge->accessStateForEmail(''),
        ]);
    }

    public function storeStart(Request $request): RedirectResponse
    {
        $admin = $request->user('admin');
        if (! $admin instanceof Admin) {
            return redirect()->route('admin.login');
        }

        $request->merge([
            'brand_url' => $this->normalizeWebsiteUrl((string) $request->input('brand_url', '')),
        ]);

        $payload = $request->validate([
            'brand_name' => ['required', 'string', 'max:160'],
            'brand_url' => ['required', 'url:http,https', 'max:500'],
            'business_summary' => ['nullable', 'string', 'max:500'],
            'competitors' => ['nullable', 'string', 'max:1200'],
            'target_prompts' => ['nullable', 'string', 'max:1600'],
            'target_market' => ['nullable', 'string', 'max:160'],
            'locale' => ['nullable', 'string', 'max:20'],
            'source' => ['nullable', 'string', 'max:80'],
            'order_id' => ['nullable', 'string', 'max:120'],
        ]);

        $entitlement = $this->boundLaunchPackEntitlement($admin);
        if (! $entitlement instanceof CustomerBillingEntitlement && ! $this->billingEntitlementBridge->isSelfHosted()) {
            return redirect()
                ->route('customer.start')
                ->withErrors(__('customer.bind_required'))
                ->withInput();
        }

        $canonicalEmail = strtolower(trim((string) ($entitlement?->email ?? $admin->email)));
        $canonicalOrderId = trim((string) ($entitlement?->provider_order_id ?? ''));
        $entitlementGate = $this->billingEntitlementBridge->accessStateForAdmin($admin);
        if (($entitlementGate['can_start_aivgl'] ?? false) !== true && ($entitlementGate['can_generate_launch_pack'] ?? false) !== true) {
            return redirect()
                ->route('customer.start')
                ->withErrors($entitlementGate['message'] ?? __('customer.payment_wait'))
                ->withInput();
        }

        if (($entitlementGate['can_start_aivgl'] ?? false) === true) {
            $workspace = $this->onboardingService->start($admin, $payload);
            if ($entitlement instanceof CustomerBillingEntitlement) {
                $this->launchPackOrchestrator->recordFor($workspace, $entitlement);
            }
            $request->session()->forget('customer_start_prefill');

            return redirect()
                ->route('customer.dashboard')
                ->with('message', __('customer.first_run_started'));
        }

        $launchPack = $this->launchPackFulfillmentBridge->trigger([
            ...$payload,
            'email' => $canonicalEmail,
            'order_id' => $canonicalOrderId,
        ]);
        $request->session()->forget('customer_start_prefill');

        $redirect = redirect()
            ->route('customer.launch-pack.show')
            ->with('message', __('customer.launch_submitted'));

        if (($launchPack['ok'] ?? false) === true) {
            return $redirect->with('launch_pack_status', [
                'status' => $launchPack['status'] ?? 'queued',
                'order_id' => $launchPack['order_id'] ?? '',
                'files_generated' => $launchPack['files_generated'] ?? 0,
                'already_ready' => $launchPack['already_ready'] ?? false,
            ]);
        }

        return $redirect->withErrors(__('customer.launch_incomplete', [
            'status' => $launchPack['status'] ?? 'fulfillment_unavailable',
        ]));
    }

    private function boundLaunchPackEntitlement(Admin $admin, bool $allowRestricted = false): ?CustomerBillingEntitlement
    {
        $entitlement = $this->billingEntitlementBridge->claimedEntitlementForAdmin($admin);
        if (! $entitlement instanceof CustomerBillingEntitlement) {
            return null;
        }

        $status = strtolower(trim((string) $entitlement->billing_status));
        $plan = strtolower(trim((string) $entitlement->plan_code));
        $email = strtolower(trim((string) $entitlement->email));
        $orderId = trim((string) $entitlement->provider_order_id);
        $allowedStatuses = $allowRestricted
            ? ['active', 'paid', 'trial', 'past_due']
            : ['active', 'paid', 'trial'];
        if (
            ! in_array($status, $allowedStatuses, true)
            || ! in_array($plan, ['launch', 'starter', 'pro', 'god'], true)
            || $email === ''
            || filter_var($email, FILTER_VALIDATE_EMAIL) === false
            || $orderId === ''
        ) {
            return null;
        }

        return $entitlement;
    }

    /**
     * @return array<string,mixed>
     */
    private function statusForEntitlement(CustomerBillingEntitlement $entitlement): array
    {
        $status = $this->launchPackFulfillmentBridge->statusForEmail(
            strtolower(trim((string) $entitlement->email)),
            trim((string) $entitlement->provider_order_id)
        );
        $fulfillment = CustomerLaunchPackFulfillment::query()
            ->where('order_id', trim((string) $entitlement->provider_order_id))
            ->first();
        if (! $fulfillment instanceof CustomerLaunchPackFulfillment || (string) $fulfillment->state === 'ready') {
            return $status;
        }

        [$customerState, $label, $nextAction] = $fulfillment->customerStatus();
        $launchPack = is_array($status['launch_pack'] ?? null) ? $status['launch_pack'] : [];
        $manifest = is_array($launchPack['manifest'] ?? null) ? $launchPack['manifest'] : [];
        $manifestQuality = is_array($manifest['quality_gate'] ?? null) ? $manifest['quality_gate'] : [];
        $status['launch_pack'] = [
            ...$launchPack,
            'fulfillment_status' => $customerState,
            'status_label' => $label,
            'next_action' => $nextAction,
            // Generated artifacts remain drafts until the local release gate
            // reaches `ready`. Do not let historical Worker metadata advertise
            // a downloadable or quality-passed customer delivery.
            'files_ready' => false,
            'access_status' => 'not_ready',
            'downloadable' => false,
            'manifest' => $manifest === [] ? null : [
                ...$manifest,
                'status' => $customerState,
                'quality_gate' => [
                    ...$manifestQuality,
                    'pass' => false,
                ],
            ],
            'orchestration_state' => (string) $fulfillment->state,
            'attempt_count' => (int) $fulfillment->attempt_count,
            'next_attempt_at' => $fulfillment->next_attempt_at?->toIso8601String(),
        ];

        return $status;
    }

    /**
     * Resolve the delivery once, then pin every subsequent action to the exact
     * order returned for the authenticated admin's bound entitlement.
     *
     * @return array{email:string,order_id:string,status:array<string,mixed>,launch_pack:array<string,mixed>}
     */
    private function resolvedLaunchPackContext(Admin $admin): array
    {
        $entitlement = $this->boundLaunchPackEntitlement($admin, true);
        if (! $entitlement instanceof CustomerBillingEntitlement) {
            abort(404);
        }

        $email = strtolower(trim((string) $entitlement->email));
        $expectedOrderId = trim((string) $entitlement->provider_order_id);
        $status = $this->statusForEntitlement($entitlement);
        if (! (bool) ($status['ok'] ?? false)) {
            $this->abortForLaunchPackHttpStatus(
                (int) ($status['http_status'] ?? 502),
                (int) ($status['retry_after'] ?? 0)
            );
        }

        $launchPack = is_array($status['launch_pack'] ?? null) ? $status['launch_pack'] : [];
        $resolvedOrderId = trim((string) ($launchPack['order_id'] ?? ''));
        if (
            ! (bool) ($launchPack['has_order'] ?? false)
            || $resolvedOrderId === ''
            || ! hash_equals($expectedOrderId, $resolvedOrderId)
        ) {
            abort(404);
        }

        return [
            'email' => $email,
            'order_id' => $resolvedOrderId,
            'status' => $status,
            'launch_pack' => $launchPack,
        ];
    }

    /**
     * @param  array<string,mixed>  $launchPack
     */
    private function assertLaunchPackDownloadable(array $launchPack): void
    {
        $accessStatus = (string) ($launchPack['access_status'] ?? 'not_ready');
        if ($accessStatus === 'revoked') {
            abort(404);
        }
        if ($accessStatus === 'expired' || (bool) ($launchPack['download_expired'] ?? false)) {
            abort(410);
        }
        if ($accessStatus === 'unavailable') {
            abort(502);
        }
        if (
            $accessStatus !== 'active'
            || ! (bool) ($launchPack['files_ready'] ?? false)
            || ! (bool) ($launchPack['downloadable'] ?? false)
        ) {
            abort(409);
        }
    }

    private function abortForLaunchPackHttpStatus(int $status, int $retryAfter = 0): never
    {
        match ($status) {
            404 => abort(404),
            409 => abort(409),
            410 => abort(410),
            429 => abort(429, 'Too Many Requests', [
                'Retry-After' => (string) max(1, min(86400, $retryAfter > 0 ? $retryAfter : 60)),
            ]),
            default => abort(502),
        };
    }

    private function retryAfterFromResponse(ClientResponse $response): int
    {
        $value = trim((string) $response->header('Retry-After'));

        return ctype_digit($value) ? max(0, min(86400, (int) $value)) : 0;
    }

    /**
     * @param  array<string,mixed>  $file
     */
    private function safeLaunchPackMime(array $file, string $filename): string
    {
        $allowed = [
            'text/plain',
            'text/markdown',
            'text/html',
            'application/json',
            'application/ld+json',
            'application/xml',
            'text/xml',
        ];
        $mime = strtolower(trim(explode(';', (string) ($file['mime'] ?? ''))[0]));
        if (! in_array($mime, $allowed, true)) {
            $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $mime = match ($extension) {
                'html', 'htm' => 'text/html',
                'json' => 'application/json',
                'xml' => 'application/xml',
                'md', 'markdown' => 'text/markdown',
                default => 'text/plain',
            };
        }

        return str_starts_with($mime, 'text/') || str_contains($mime, 'json') || str_contains($mime, 'xml')
            ? $mime.'; charset=utf-8'
            : $mime;
    }

    private function safeDownloadName(string $value, string $fallback): string
    {
        $basename = basename(str_replace('\\', '/', trim($value)));
        $safe = preg_replace('/[^A-Za-z0-9._-]+/', '-', $basename);
        $safe = is_string($safe) ? trim($safe, '-.') : '';

        return $safe !== '' ? Str::limit($safe, 180, '') : $fallback;
    }

    /**
     * @return array<string,string>
     */
    private function secureDownloadHeaders(string $contentType, string $filename): array
    {
        return [
            'Content-Type' => $contentType,
            'Content-Disposition' => HeaderUtils::makeDisposition('attachment', $filename),
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ];
    }

    public function storeAivglCampaign(Request $request, AivglCampaignHandoffService $handoffService): RedirectResponse
    {
        $selection = $request->validate([
            'opportunity_id' => ['nullable', 'string', 'max:120'],
            'opportunity_key' => ['nullable', 'string', 'max:180'],
            'brief_id' => ['nullable', 'string', 'max:120'],
            'brief_key' => ['nullable', 'string', 'max:220'],
        ]);

        try {
            $result = $handoffService->createCampaign($selection);
        } catch (Throwable $exception) {
            return redirect()
                ->route('customer.dashboard')
                ->withErrors(__('customer.campaign_failed', ['message' => $exception->getMessage()]));
        }

        return redirect()
            ->route('customer.campaigns.created', ['taskId' => (int) $result['task']->id])
            ->with('message', __('customer.campaign_created'));
    }

    public function downloadLaunchPackFile(Request $request, string $filename): Response|RedirectResponse
    {
        $admin = $request->user('admin');
        if (! $admin instanceof Admin) {
            return redirect()->route('admin.login');
        }

        $filename = trim($filename);
        if ($filename === '') {
            abort(404);
        }

        $context = $this->resolvedLaunchPackContext($admin);
        $launchPack = $context['launch_pack'];
        $files = is_array($launchPack['files'] ?? null) ? $launchPack['files'] : [];
        $file = collect($files)->first(
            fn ($candidate): bool => is_array($candidate) && (string) ($candidate['name'] ?? '') === $filename
        );
        if (! is_array($file)) {
            abort(404);
        }
        $this->assertLaunchPackDownloadable($launchPack);

        try {
            $response = $this->launchPackFulfillmentBridge->downloadFile(
                $context['email'],
                $filename,
                $context['order_id']
            );
        } catch (Throwable) {
            abort(502);
        }
        if (! $response->ok()) {
            $this->abortForLaunchPackHttpStatus(
                $response->status(),
                $this->retryAfterFromResponse($response)
            );
        }

        $safeName = $this->safeDownloadName($filename, 'launch-pack-file.txt');
        $headers = $this->secureDownloadHeaders(
            $this->safeLaunchPackMime($file, $filename),
            $safeName
        );
        if (str_starts_with($headers['Content-Type'], 'text/html')) {
            $headers['Content-Security-Policy'] = "sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
        }

        return response($response->body(), 200, $headers);
    }

    public function downloadLaunchPackZip(Request $request): Response|RedirectResponse
    {
        $admin = $request->user('admin');
        if (! $admin instanceof Admin) {
            return redirect()->route('admin.login');
        }

        $context = $this->resolvedLaunchPackContext($admin);
        $launchPack = $context['launch_pack'];
        $fileCount = (int) ($launchPack['manifest']['file_count'] ?? count((array) ($launchPack['files'] ?? [])));
        if (! (bool) ($launchPack['files_ready'] ?? false) || $fileCount < 1) {
            abort(409);
        }
        $this->assertLaunchPackDownloadable($launchPack);

        try {
            $response = $this->launchPackFulfillmentBridge->downloadZip(
                $context['email'],
                $context['order_id']
            );
        } catch (Throwable) {
            abort(502);
        }
        if (! $response->ok()) {
            $this->abortForLaunchPackHttpStatus(
                $response->status(),
                $this->retryAfterFromResponse($response)
            );
        }

        $archiveName = $this->safeDownloadName($context['order_id'].'-launch-pack.zip', 'launch-pack.zip');

        return response($response->body(), 200, $this->secureDownloadHeaders('application/zip', $archiveName));
    }

    public function showLaunchPack(Request $request): View|RedirectResponse
    {
        $admin = $request->user('admin');
        if (! $admin instanceof Admin) {
            return redirect()->route('admin.login');
        }

        $entitlement = $this->boundLaunchPackEntitlement($admin, true);
        if (! $entitlement instanceof CustomerBillingEntitlement) {
            return view('customer.launch-pack', [
                'pageTitle' => __('customer.lp_secure_delivery'),
                'activeMenu' => 'deliverables',
                'launchPack' => ['ok' => false, 'launch_pack' => []],
                'launchPackData' => [],
                'launchPackMissingEntitlement' => true,
            ]);
        }

        $context = $this->resolvedLaunchPackContext($admin);

        return view('customer.launch-pack', [
            'pageTitle' => __('customer.lp_secure_delivery'),
            'activeMenu' => 'deliverables',
            'launchPack' => $context['status'],
            'launchPackData' => $context['launch_pack'],
            'launchPackMissingEntitlement' => false,
        ]);
    }

    public function resendLaunchPack(Request $request): RedirectResponse
    {
        $admin = $request->user('admin');
        if (! $admin instanceof Admin) {
            return redirect()->route('admin.login');
        }

        $context = $this->resolvedLaunchPackContext($admin);
        $launchPack = $context['launch_pack'];
        if (! (bool) ($launchPack['files_ready'] ?? false)) {
            abort(409);
        }
        $accessStatus = (string) ($launchPack['access_status'] ?? 'not_ready');
        if ($accessStatus === 'revoked') {
            abort(404);
        }
        if ($accessStatus === 'unavailable') {
            abort(502);
        }
        if (! in_array($accessStatus, ['active', 'expired'], true)) {
            abort(409);
        }
        if (! (bool) ($launchPack['can_redeliver'] ?? false)) {
            $retryAfter = max(0, (int) ($launchPack['redeliver_retry_after_seconds'] ?? 0));
            if ($retryAfter > 0) {
                $this->abortForLaunchPackHttpStatus(429, $retryAfter);
            }
            abort(409);
        }

        $result = $this->launchPackFulfillmentBridge->redeliver(
            $context['email'],
            $context['order_id']
        );
        if (! (bool) ($result['ok'] ?? false)) {
            $this->abortForLaunchPackHttpStatus(
                (int) ($result['http_status'] ?? 502),
                (int) ($result['retry_after'] ?? 0)
            );
        }

        return redirect()
            ->route('customer.launch-pack.show')
            ->with('message', __('customer.lp_redelivery_started'));
    }

    public function showGodReport(Request $request, string $itemId): View|RedirectResponse
    {
        $admin = $request->user('admin');
        if (! $admin instanceof Admin) {
            return redirect()->route('admin.login');
        }

        $workspace = $this->onboardingService->workspaceFor($admin);
        if (! $workspace instanceof CustomerWorkspace || trim((string) $workspace->aivgl_tracking_run_id) === '') {
            abort(404);
        }

        try {
            $response = $this->godModeDeliverableBridge->item($workspace, $itemId);
        } catch (\InvalidArgumentException) {
            abort(404);
        } catch (Throwable) {
            abort(502);
        }

        if ($response->status() === 404) {
            abort(404);
        }
        if (! $response->ok()) {
            abort(502);
        }

        $item = $response->json('item');
        if (! is_array($item) || ! is_array($item['result_payload'] ?? null)) {
            abort(404);
        }

        return view('customer.god-report', [
            'pageTitle' => (string) ($item['result_payload']['title'] ?? 'God Mode Executive Report'),
            'activeMenu' => 'dashboard',
            'workspace' => $workspace,
            'item' => $item,
            'report' => $item['result_payload'],
        ]);
    }

    public function downloadGodReport(Request $request, string $itemId, string $format): Response|RedirectResponse
    {
        $admin = $request->user('admin');
        if (! $admin instanceof Admin) {
            return redirect()->route('admin.login');
        }

        $workspace = $this->onboardingService->workspaceFor($admin);
        if (! $workspace instanceof CustomerWorkspace || trim((string) $workspace->aivgl_tracking_run_id) === '') {
            abort(404);
        }
        if (! in_array($format, ['md', 'pdf'], true)) {
            abort(404);
        }

        try {
            $itemResponse = $this->godModeDeliverableBridge->item($workspace, $itemId);
            if ($itemResponse->status() === 404) {
                abort(404);
            }
            if (! $itemResponse->ok()) {
                abort(502);
            }
            $item = $itemResponse->json('item');
            if (! is_array($item)) {
                abort(404);
            }

            $download = $this->godModeDeliverableBridge->download($workspace, $itemId, $format);
        } catch (\InvalidArgumentException) {
            abort(404);
        } catch (HttpException $exception) {
            throw $exception;
        } catch (Throwable) {
            abort(502);
        }

        if ($download->status() === 404) {
            abort(404);
        }
        if (! $download->ok()) {
            abort(502);
        }

        $slug = Str::slug((string) $workspace->brand_name) ?: 'cowtech';
        $cycle = preg_replace('/[^0-9-]/', '', (string) ($item['cycle_month'] ?? '')) ?: 'current';
        $type = ($item['item_type'] ?? '') === 'competitor_deep_report' ? 'competitor-deep-report' : 'strategy-memo';
        $filename = implode('-', [$slug, $cycle, $type]).'.'.$format;

        return response($download->body(), 200, [
            'Content-Type' => $format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * @param  array<string,mixed>  $billingAddons
     * @param  array<string,mixed>  $aivgl
     * @return array<string,mixed>
     */
    private function billingLedger(?CustomerBillingEntitlement $entitlement, array $billingAddons, array $aivgl): array
    {
        $billingAuth = is_array($aivgl['billing_auth'] ?? null) ? $aivgl['billing_auth'] : [];
        // GeoFlow is the billing authority. AIVGL may report mock plan and quota
        // data for pipeline validation, but it must never grant a subscription
        // contract or active fulfillment access in the customer ledger.
        $planCode = strtolower(trim((string) ($entitlement?->plan_code ?? '')));
        $hasContract = in_array($planCode, ['starter', 'pro', 'god'], true);
        $contract = $hasContract
            ? $this->onboardingService->planContractFor($planCode)
            : ['credits' => 0, 'surface_limit' => 0, 'competitor_limit' => 0, 'article_quota' => 0];
        $addonTotals = is_array($billingAddons['totals'] ?? null)
            ? $billingAddons['totals']
            : ['credits' => 0, 'article' => 0, 'competitor' => 0];
        $quotaBridge = is_array($billingAuth['quota_bridge']['quotas'] ?? null)
            ? $billingAuth['quota_bridge']['quotas']
            : [];
        $status = strtolower(trim((string) ($entitlement?->billing_status ?? 'missing')));
        $active = $hasContract && in_array($status, ['active', 'paid', 'trial', 'trialing'], true);
        $prices = ['starter' => 149, 'pro' => 299, 'god' => 599];

        $metric = static function (int $base, int $addon, string $quotaKey) use ($quotaBridge): array {
            $used = max(0, (int) ($quotaBridge[$quotaKey]['used'] ?? 0));
            $effective = max(0, $base + $addon);

            return [
                'base' => $base,
                'addon' => $addon,
                'effective' => $effective,
                'used' => $used,
                'remaining' => max(0, $effective - $used),
            ];
        };

        return [
            'has_contract' => $hasContract,
            'plan_code' => $planCode,
            'plan_name' => $hasContract ? ucfirst($planCode) : '',
            'price' => $hasContract ? (int) ($prices[$planCode] ?? 0) : 0,
            'currency' => strtoupper(trim((string) ($entitlement?->currency ?: 'USD'))),
            'billing_period' => $hasContract ? 'monthly' : '',
            'billing_status' => $status,
            'access_mode' => $active ? 'active' : 'read_only',
            'cycle_month' => (string) ($billingAuth['plan']['addons']['cycle_month'] ?? now()->format('Y-m')),
            'metrics' => [
                'credits' => $metric((int) $contract['credits'], (int) ($addonTotals['credits'] ?? 0), 'provider_call'),
                'surfaces' => $metric((int) $contract['surface_limit'], 0, 'model_count'),
                'competitors' => $metric((int) $contract['competitor_limit'], (int) ($addonTotals['competitor'] ?? 0), 'competitor_count'),
                'articles' => $metric((int) $contract['article_quota'], (int) ($addonTotals['article'] ?? 0), 'article_draft'),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $aivgl
     * @return array<string, int|string|float|null|bool>
     */
    private function summary(array $aivgl, ?CustomerWorkspace $workspace = null): array
    {
        $summary = [
            'aivgl_connected' => (bool) ($aivgl['connected'] ?? false),
            'aivgl_status' => (string) ($aivgl['status'] ?? 'unavailable'),
            'visibility_score' => $aivgl['scores']['visibility'] ?? null,
            'source_quality' => $aivgl['scores']['source_quality'] ?? null,
            'competitor_pressure' => $aivgl['scores']['competitor_pressure'] ?? null,
            'tracked_prompts' => (int) ($aivgl['tracked_prompts'] ?? 0),
            'source_gaps' => (int) ($aivgl['source_gaps'] ?? 0),
            'opportunities' => (int) ($aivgl['opportunity_summary']['opportunity_count'] ?? count($aivgl['opportunities'] ?? [])),
            'briefs' => (int) ($aivgl['brief_summary']['brief_count'] ?? $aivgl['brief_summary']['total'] ?? 0),
            'article_review_ready' => (int) ($aivgl['article_review_summary']['review_ready_count'] ?? $aivgl['article_review_summary']['ready_count'] ?? 0),
            'publish_handoffs' => (int) ($aivgl['publish_handoff_summary']['handoff_count'] ?? $aivgl['publish_handoff_summary']['total'] ?? 0),
            'retest_reports' => (int) ($aivgl['retest_summary']['report_ready_count'] ?? $aivgl['retest_summary']['completed_count'] ?? 0),
            'active_campaigns' => 0,
            'pending_review' => 0,
            'published_articles' => 0,
            'running_jobs' => 0,
            'failed_jobs' => 0,
        ];

        try {
            $workspaceRunId = $workspace instanceof CustomerWorkspace ? trim((string) $workspace->aivgl_tracking_run_id) : '';
            $taskScope = function ($query) use ($workspaceRunId): void {
                if ($workspaceRunId !== '') {
                    $query->where('aivgl_run_id', $workspaceRunId);
                }
            };

            $summary['active_campaigns'] = (int) Task::query()
                ->where('content_generation_mode', 'geo_growth')
                ->when($workspaceRunId !== '', $taskScope)
                ->whereIn('status', ['active', 'running'])
                ->count();
            $summary['pending_review'] = (int) Article::query()
                ->where('review_status', 'pending')
                ->whereNull('deleted_at')
                ->when($workspaceRunId !== '', function ($query) use ($workspaceRunId): void {
                    $query->whereHas('task', fn ($taskQuery) => $taskQuery->where('aivgl_run_id', $workspaceRunId));
                })
                ->count();
            $summary['published_articles'] = (int) Article::query()
                ->where('status', 'published')
                ->whereNull('deleted_at')
                ->when($workspaceRunId !== '', function ($query) use ($workspaceRunId): void {
                    $query->whereHas('task', fn ($taskQuery) => $taskQuery->where('aivgl_run_id', $workspaceRunId));
                })
                ->count();

            $jobStatusCounts = TaskRun::query()
                ->when($workspaceRunId !== '', function ($query) use ($workspaceRunId): void {
                    $query->whereHas('task', fn ($taskQuery) => $taskQuery->where('aivgl_run_id', $workspaceRunId));
                })
                ->selectRaw('status, COUNT(*) as c')
                ->groupBy('status')
                ->pluck('c', 'status')
                ->all();
            $summary['running_jobs'] = (int) ($jobStatusCounts['running'] ?? 0);
            $summary['failed_jobs'] = (int) ($jobStatusCounts['failed'] ?? 0);

            if (Schema::hasColumn('tasks', 'geo_brief_json')) {
                $briefs = Task::query()
                    ->whereNotNull('geo_brief_json')
                    ->when($workspaceRunId !== '', $taskScope)
                    ->latest('id')
                    ->limit(20)
                    ->pluck('geo_brief_json');
                $prompts = [];
                $gaps = [];
                foreach ($briefs as $brief) {
                    $decoded = is_array($brief) ? $brief : json_decode((string) $brief, true);
                    if (! is_array($decoded)) {
                        continue;
                    }
                    foreach ((array) ($decoded['retest_prompts'] ?? []) as $prompt) {
                        $prompt = trim((string) $prompt);
                        if ($prompt !== '') {
                            $prompts[$prompt] = true;
                        }
                    }
                    foreach ((array) ($decoded['source_gap'] ?? []) as $gap) {
                        $gap = trim((string) $gap);
                        if ($gap !== '') {
                            $gaps[$gap] = true;
                        }
                    }
                }
                if ($summary['tracked_prompts'] === 0) {
                    $summary['tracked_prompts'] = count($prompts);
                }
                if ($summary['source_gaps'] === 0) {
                    $summary['source_gaps'] = count($gaps);
                }
            }
        } catch (Throwable) {
            // Keep the customer shell usable while an engine is partially configured.
        }

        return $summary;
    }

    /**
     * @param  array<string,mixed>  $aivgl
     * @param  array<string,mixed>  $launchPack
     * @return list<array<string,mixed>>
     */
    private function deliveryStatus(array $aivgl, ?CustomerWorkspace $workspace, array $launchPack): array
    {
        $launch = is_array($launchPack['launch_pack'] ?? null) ? $launchPack['launch_pack'] : [];
        $manifest = is_array($launch['manifest'] ?? null) ? $launch['manifest'] : [];
        $launchStatus = (string) ($launch['fulfillment_status'] ?? 'unknown');
        $launchReady = (bool) ($launch['files_ready'] ?? false);

        $fulfillment = is_array($aivgl['fulfillment'] ?? null) ? $aivgl['fulfillment'] : [];
        $monitoringMode = (string) ($fulfillment['mode'] ?? 'pending');
        $monthly = is_array($aivgl['monthly_fulfillment'] ?? null) ? $aivgl['monthly_fulfillment'] : [];
        $monthlySummary = is_array($monthly['summary'] ?? null) ? $monthly['summary'] : [];
        $monthlyItems = is_array($monthly['items'] ?? null) ? $monthly['items'] : [];
        $scheduledCount = (int) ($monthlySummary['scheduled_count'] ?? 0)
            + (int) ($monthlySummary['queued_count'] ?? 0)
            + (int) ($monthlySummary['generating_count'] ?? 0);
        if ($scheduledCount === 0 && count($monthlyItems) > 0) {
            $scheduledCount = collect($monthlyItems)
                ->whereIn('status', ['scheduled', 'queued', 'generating'])
                ->count();
        }
        $operatorCount = (int) ($monthlySummary['pending_operator_count'] ?? collect($monthlyItems)->where('status', 'pending_operator')->count());
        $doneCount = (int) ($monthlySummary['completed_count'] ?? collect($monthlyItems)->whereIn('status', ['completed', 'done'])->count());

        $firstRunReady = $workspace instanceof CustomerWorkspace && trim((string) $workspace->aivgl_tracking_run_id) !== '';
        $firstRunFailed = $workspace instanceof CustomerWorkspace && str_contains((string) $workspace->status, 'failed');

        return [
            [
                'key' => 'launch_pack',
                'title' => 'Launch Pack',
                'status' => $launchReady ? 'ready' : ($launchStatus ?: 'pending'),
                'label' => $launchReady ? __('customer.status_ready') : match ($launchStatus) {
                    'onboarding_required' => __('customer.delivery_launch_waiting_profile'),
                    'generating' => __('customer.delivery_generating'),
                    'failed' => __('customer.delivery_needs_review'),
                    'pending_payment' => __('customer.delivery_waiting_payment'),
                    default => __('customer.status_pending'),
                },
                'tone' => $launchReady ? 'ready' : ($launchStatus === 'failed' ? 'failed' : 'pending'),
                'detail' => $launchReady
                    ? __('customer.delivery_files_ready', ['count' => (int) ($manifest['file_count'] ?? 0)])
                    : __('customer.delivery_files_pending'),
            ],
            [
                'key' => 'first_run',
                'title' => __('customer.delivery_first_run'),
                'status' => $firstRunReady ? 'ready' : ($firstRunFailed ? 'failed' : 'pending'),
                'label' => $firstRunReady ? __('customer.status_ready') : ($firstRunFailed ? __('customer.delivery_needs_review') : __('customer.status_pending')),
                'tone' => $firstRunReady ? 'ready' : ($firstRunFailed ? 'failed' : 'pending'),
                'detail' => $firstRunReady
                    ? __('customer.delivery_first_ready')
                    : __('customer.delivery_first_pending'),
            ],
            [
                'key' => 'daily_monitoring',
                'title' => __('customer.delivery_monitoring'),
                'status' => $monitoringMode,
                'label' => match ($monitoringMode) {
                    'live_monitoring' => __('customer.delivery_live'),
                    'mock_validation' => __('customer.delivery_mock'),
                    'degraded' => __('customer.delivery_needs_review'),
                    'failed' => __('customer.delivery_needs_review'),
                    default => __('customer.status_pending'),
                },
                'tone' => $monitoringMode === 'live_monitoring' ? 'ready' : (in_array($monitoringMode, ['degraded', 'failed'], true) ? 'failed' : 'pending'),
                'detail' => __('customer.delivery_surface_counts', [
                    'live' => (int) ($fulfillment['live_surface_count'] ?? 0),
                    'mock' => (int) ($fulfillment['mock_surface_count'] ?? 0),
                    'pending' => (int) ($fulfillment['pending_surface_count'] ?? 0),
                    'failed' => (int) ($fulfillment['failed_surface_count'] ?? 0),
                    'configured' => (int) ($fulfillment['configured_surface_count'] ?? 0),
                ]),
            ],
            [
                'key' => 'monthly_fulfillment',
                'title' => __('customer.delivery_monthly'),
                'status' => $scheduledCount > 0 ? 'scheduled' : 'pending',
                'label' => $scheduledCount > 0 ? __('customer.delivery_scheduled') : __('customer.status_pending'),
                'tone' => $scheduledCount > 0 ? 'ready' : 'pending',
                'detail' => __('customer.delivery_monthly_counts', [
                    'scheduled' => $scheduledCount,
                    'operator' => $operatorCount,
                    'done' => $doneCount,
                ]),
            ],
        ];
    }

    /**
     * @return list<array{key: string, label: string, value: int|string, description: string, state: string}>
     */
    private function pipeline(array $summary): array
    {
        return [
            [
                'key' => 'discover',
                'label' => __('customer.journey_discover'),
                'value' => $summary['tracked_prompts'] ?: __('customer.pending_data'),
                'description' => __('customer.journey_discover_detail'),
                'state' => $summary['tracked_prompts'] > 0 ? 'active' : 'pending',
            ],
            [
                'key' => 'plan',
                'label' => __('customer.journey_plan'),
                'value' => $summary['briefs'] ?: $summary['active_campaigns'],
                'description' => __('customer.journey_plan_detail'),
                'state' => ($summary['briefs'] > 0 || $summary['active_campaigns'] > 0) ? 'active' : 'ready',
            ],
            [
                'key' => 'publish',
                'label' => __('customer.journey_review'),
                'value' => $summary['article_review_ready'] ?: $summary['pending_review'],
                'description' => __('customer.journey_review_detail'),
                'state' => ($summary['article_review_ready'] > 0 || $summary['pending_review'] > 0) ? 'attention' : 'ready',
            ],
            [
                'key' => 'retest',
                'label' => __('customer.journey_retest'),
                'value' => $summary['retest_reports'] ?: $summary['published_articles'],
                'description' => __('customer.journey_retest_detail'),
                'state' => ($summary['retest_reports'] > 0 || $summary['published_articles'] > 0) ? 'active' : 'pending',
            ],
        ];
    }

    /**
     * @return list<array{title: string, type: string, impact: string, action: string, href: string}>
     */
    private function opportunities(array $aivgl): array
    {
        if (! empty($aivgl['opportunities'])) {
            return $aivgl['opportunities'];
        }

        return [
            [
                'title' => __('customer.opp_baseline_title'),
                'type' => __('customer.opp_baseline_type'),
                'impact' => __('customer.opp_baseline_impact'),
                'action' => __('customer.opp_wait_data'),
                'href' => '#visibility',
            ],
            [
                'title' => __('customer.opp_campaign_title'),
                'type' => __('customer.opp_campaign_type'),
                'impact' => __('customer.opp_campaign_impact'),
                'action' => __('customer.opp_create_campaign'),
                'href' => route('customer.campaigns.create'),
            ],
            [
                'title' => __('customer.opp_review_title'),
                'type' => __('customer.opp_review_type'),
                'impact' => __('customer.opp_review_impact'),
                'action' => __('customer.opp_view_articles'),
                'href' => route('customer.dashboard').'#articles',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $aivgl
     * @return list<array<string, mixed>>
     */
    private function articleFeedback(array $aivgl, ?CustomerWorkspace $workspace = null): array
    {
        $retestResults = is_array($aivgl['article_retest_results'] ?? null) ? $aivgl['article_retest_results'] : [];

        try {
            $query = Article::query()
                ->with(['task:id,name,content_generation_mode,aivgl_opportunity_key,aivgl_brief_key'])
                ->whereNull('deleted_at')
                ->where(function ($query): void {
                    $query->whereNotNull('aivgl_publish_handoff_id')
                        ->orWhereHas('task', function ($taskQuery): void {
                            $taskQuery->where('content_generation_mode', 'geo_growth')
                                ->orWhereNotNull('aivgl_run_id');
                        });
                });

            if ($workspace instanceof CustomerWorkspace && trim((string) $workspace->aivgl_tracking_run_id) !== '') {
                $query->whereHas('task', function ($taskQuery) use ($workspace): void {
                    $taskQuery->where('aivgl_run_id', (string) $workspace->aivgl_tracking_run_id);
                });
            }

            return $query
                ->latest('published_at')
                ->latest('id')
                ->limit(8)
                ->get()
                ->map(function (Article $article) use ($retestResults): array {
                    $handoffId = trim((string) $article->aivgl_publish_handoff_id);
                    $result = $handoffId !== '' && isset($retestResults[$handoffId]) && is_array($retestResults[$handoffId])
                        ? $retestResults[$handoffId]
                        : [];

                    return [
                        'campaign' => (string) ($article->task->name ?? 'Article Campaign'),
                        'title' => (string) $article->title,
                        'status' => (string) $article->status,
                        'published_at' => $article->published_at,
                        'handoff_id' => $handoffId,
                        'local_retest_status' => (string) ($article->aivgl_retest_status ?? ''),
                        'retest_status' => (string) ($result['retest_status'] ?? $article->aivgl_retest_status ?? 'not_started'),
                        'headline' => $this->localizedRetestHeadline((string) ($result['headline'] ?? '')),
                        'metric_title' => (string) ($result['primary_metric_title'] ?? 'Visibility'),
                        'before' => $result['primary_before'] ?? null,
                        'after' => $result['primary_after'] ?? null,
                        'delta' => $result['primary_delta'] ?? null,
                        'outcome' => (string) ($result['primary_outcome'] ?? ''),
                    ];
                })
                ->values()
                ->all();
        } catch (Throwable) {
            return [];
        }
    }

    private function localizedRetestHeadline(string $headline): string
    {
        $clean = trim($headline);
        if ($clean === '') {
            return '';
        }

        if (str_contains(strtolower($clean), 'post-publish retest')) {
            return __('customer.retest_improved_headline');
        }

        return $clean;
    }

    private function normalizeWebsiteUrl(string $value): string
    {
        $url = trim($value);
        if ($url === '' || preg_match('#^https?://#i', $url) === 1) {
            return $url;
        }

        if (str_starts_with($url, '//')) {
            return 'https:'.$url;
        }

        return 'https://'.$url;
    }
}

<?php

namespace App\Services\Customer;

require_once __DIR__.'/../../Models/CustomerWorkspace.php';
require_once __DIR__.'/BillingAddonBridge.php';
require_once __DIR__.'/BillingEntitlementBridge.php';

use App\Models\Admin;
use App\Models\CustomerWorkspace;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class CustomerOnboardingService
{
    private const PLAN_CONTRACTS = [
        'starter' => [
            'credits' => 4000,
            'surface_limit' => 3,
            'competitor_limit' => 3,
            'article_quota' => 2,
            'cadence_days' => 1,
            'surfaces' => ['chatgpt', 'perplexity', 'google_aio'],
        ],
        'pro' => [
            'credits' => 10000,
            'surface_limit' => 5,
            'competitor_limit' => 5,
            'article_quota' => 4,
            'cadence_days' => 1,
            'surfaces' => ['chatgpt', 'perplexity', 'google_aio', 'gemini', 'grok'],
        ],
        'god' => [
            'credits' => 25000,
            'surface_limit' => 8,
            'competitor_limit' => 10,
            'article_quota' => 8,
            'cadence_days' => 1,
            'surfaces' => ['chatgpt', 'perplexity', 'google_aio', 'gemini', 'grok', 'qwen', 'deepseek', 'mistral'],
        ],
    ];

    public function __construct(
        private readonly BillingEntitlementBridge $billingEntitlementBridge = new BillingEntitlementBridge,
        private readonly BillingAddonBridge $billingAddonBridge = new BillingAddonBridge,
    ) {}

    public function workspaceFor(?Admin $admin): ?CustomerWorkspace
    {
        if (! $admin instanceof Admin) {
            return null;
        }

        return CustomerWorkspace::query()
            ->where('admin_id', (int) $admin->id)
            ->first();
    }

    public function shouldUseDemoFallback(?Admin $admin): bool
    {
        if (! $admin instanceof Admin) {
            return false;
        }

        if ($admin->isSuperAdmin() || strtolower((string) $admin->username) === 'admin') {
            return trim((string) config('services.aivgl.tracking_run_id', '')) !== '';
        }

        return false;
    }

    /**
     * @param  array<string,mixed>  $payload
     */
    public function start(Admin $admin, array $payload): CustomerWorkspace
    {
        $workspace = CustomerWorkspace::query()->updateOrCreate(
            ['admin_id' => (int) $admin->id],
            [
                'brand_name' => trim((string) $payload['brand_name']),
                'brand_url' => trim((string) $payload['brand_url']),
                'business_summary' => trim((string) ($payload['business_summary'] ?? '')),
                'competitors_text' => trim((string) ($payload['competitors'] ?? '')),
                'target_prompts_text' => trim((string) ($payload['target_prompts'] ?? '')),
                'target_market' => trim((string) ($payload['target_market'] ?? '')),
                'locale' => trim((string) ($payload['locale'] ?? 'en')) ?: 'en',
                'status' => 'diagnosis_pending',
                'last_error' => null,
            ]
        );

        try {
            $this->createAivglIntakeAndRun($admin, $workspace);
        } catch (\Throwable $exception) {
            $workspace->forceFill([
                'status' => 'diagnosis_setup_failed',
                'last_error' => $exception->getMessage(),
            ])->save();
        }

        return $workspace->refresh();
    }

    public function refreshDiagnosisStatus(CustomerWorkspace $workspace): CustomerWorkspace
    {
        if (! $workspace->hasDiagnosisRun()) {
            return $workspace;
        }

        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            return $workspace;
        }

        try {
            $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
                ->acceptJson()
                ->get($baseUrl.'/internal/tracking/runs/'.$workspace->aivgl_tracking_run_id);

            if (! $response->ok()) {
                return $workspace;
            }

            $status = (string) ($response->json('run.status') ?? $response->json('status') ?? '');
            if (in_array($status, ['completed', 'scored', 'reported'], true)) {
                $workspace->forceFill([
                    'status' => 'diagnosis_ready',
                    'diagnosis_completed_at' => $workspace->diagnosis_completed_at ?? now(),
                    'last_error' => null,
                ])->save();
            } elseif (in_array($status, ['failed', 'cancelled'], true)) {
                $workspace->forceFill([
                    'status' => 'diagnosis_failed',
                    'last_error' => (string) ($response->json('error') ?? 'AIVGL diagnosis failed.'),
                ])->save();
            }
        } catch (\Throwable) {
            return $workspace;
        }

        return $workspace->refresh();
    }

    private function createAivglIntakeAndRun(Admin $admin, CustomerWorkspace $workspace): void
    {
        $providerMode = \App\Support\GeoFlow\ProviderConfiguration::requireMode('services.aivgl.customer_provider_mode');
        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            throw new \RuntimeException('AIVGL base URL is not configured.');
        }

        $planCode = $this->billingEntitlementBridge->planCodeForAdmin($admin);
        if (! in_array($planCode, ['starter', 'pro', 'god'], true)) {
            throw new \RuntimeException('A verified customer plan entitlement is required.');
        }
        $contract = $this->planContractFor((string) $planCode);

        $intakePayload = [
            'customer' => [
                'external_customer_id' => 'cowtech-admin-'.$admin->id,
                'email' => trim((string) $admin->email) !== '' ? (string) $admin->email : 'customer-'.$admin->id.'@cowtech.local',
                'plan_code' => $planCode,
            ],
            'brand' => [
                'name' => $workspace->brand_name,
                'website_url' => $workspace->brand_url,
                'vertical' => $workspace->business_summary ?: 'customer brand',
                'locale' => $workspace->locale ?: 'en',
            ],
            'competitors' => $this->competitors($workspace, (int) $contract['competitor_limit']),
            'prompts' => $this->prompts($workspace),
            'plan_contract' => $contract,
        ];

        $intake = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
            ->acceptJson()
            ->withHeaders($this->aivglInternalHeaders())
            ->post($baseUrl.'/internal/ops/control-center/customers', $intakePayload);

        if (! $intake->ok()) {
            throw new \RuntimeException('AIVGL intake failed: '.$intake->status().' '.$intake->body());
        }

        $brandId = (string) ($intake->json('intake.brand.id') ?? '');
        if ($brandId === '') {
            throw new \RuntimeException('AIVGL intake did not return a brand id.');
        }

        $entitlementState = $this->billingEntitlementBridge->accessStateForAdmin($admin);
        $entitlementSync = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
            ->acceptJson()
            ->withHeaders($this->aivglInternalHeaders())
            ->post($baseUrl.'/internal/ops/control-center/customer-entitlements', [
                'external_customer_id' => 'cowtech-admin-'.$admin->id,
                'email' => (string) $admin->email,
                'plan_code' => $planCode,
                'status' => $this->billingEntitlementBridge->isSelfHosted() ? 'active' : (string) ($entitlementState['billing_status'] ?? 'active'),
                'source' => $this->billingEntitlementBridge->isSelfHosted() ? 'self_hosted_local_access' : 'geoflow_verified_entitlement',
            ]);
        if (! $entitlementSync->ok() || $entitlementSync->json('entitlement.status') !== 'synced') {
            throw new \RuntimeException(
                'AIVGL entitlement sync failed: '.$entitlementSync->status().' '.$entitlementSync->body()
            );
        }

        $allowPaid = (bool) config('services.aivgl.customer_allow_paid_provider', false);
        $tracking = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
            ->acceptJson()
            ->post($baseUrl.'/internal/tracking/runs', [
                'brand_id' => $brandId,
                'run_type' => 'manual',
                'provider_mode' => $providerMode,
                'allow_paid_provider' => $allowPaid,
                'complete_pipeline' => true,
                'idempotency_key' => 'cowtech-first-run-'.$workspace->id.'-'.Str::slug($workspace->brand_name).'-'.(string) $intake->json('intake.prompt_set.id'),
            ]);

        if (! $tracking->ok()) {
            throw new \RuntimeException('AIVGL tracking run failed: '.$tracking->status().' '.$tracking->body());
        }
        $trackingRunId = (string) ($tracking->json('run.id') ?? '');
        $monitoring = $this->configureMonitoring($baseUrl, $workspace, $trackingRunId, (string) $planCode, $contract);
        $monthlyFulfillment = $this->configureMonthlyFulfillment($baseUrl, $workspace, $trackingRunId, (string) $planCode, $contract);

        $workspace->forceFill([
            'status' => 'diagnosis_running',
            'aivgl_customer_id' => (string) ($intake->json('intake.customer.id') ?? ''),
            'aivgl_brand_id' => $brandId,
            'aivgl_prompt_set_id' => (string) ($intake->json('intake.prompt_set.id') ?? ''),
            'aivgl_tracking_run_id' => $trackingRunId,
            'aivgl_provider_mode' => $providerMode,
            'diagnosis_started_at' => now(),
            'payload_json' => json_encode([
                'intake' => $intake->json('intake'),
                'tracking' => $tracking->json('run'),
                'monitoring' => $monitoring,
                'monthly_fulfillment' => $monthlyFulfillment,
                'plan_contract' => $contract,
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'last_error' => null,
        ])->save();

        $this->billingAddonBridge->syncForEmail((string) $admin->email);
    }

    /**
     * @return array<string,string>
     */
    private function aivglInternalHeaders(): array
    {
        $token = trim((string) config('services.aivgl.internal_admin_token', ''));

        return $token !== '' ? ['X-Internal-Admin-Token' => $token] : [];
    }

    /**
     * @return list<array{name:string,website_url:string}>
     */
    private function competitors(CustomerWorkspace $workspace, int $limit = 6): array
    {
        $raw = trim((string) $workspace->competitors_text);
        $parts = preg_split('/[\r\n,;|]+/', $raw) ?: [];
        if (count($parts) === 1 && ! preg_match('/[\r\n,;|]/', $raw)) {
            $tokens = preg_split('/\s+/', $raw) ?: [];
            $allSimpleNames = count($tokens) >= 2
                && count($tokens) <= max($limit, 1)
                && collect($tokens)->every(fn (string $token): bool => preg_match('/^[a-z0-9][a-z0-9._-]*$/i', $token) === 1);
            $allLowercase = collect($tokens)->every(fn (string $token): bool => $token === strtolower($token));
            if ($allSimpleNames && ($allLowercase || count($tokens) === $limit)) {
                $parts = $tokens;
            }
        }

        return collect($parts)
            ->map(fn (string $line): string => trim($line))
            ->filter()
            ->take(max($limit, 1))
            ->map(fn (string $name): array => ['name' => $name, 'website_url' => ''])
            ->values()
            ->all();
    }

    /**
     * @return list<array{category:string,prompt_text:string,prompt_source:string}>
     */
    private function prompts(CustomerWorkspace $workspace): array
    {
        $custom = collect(preg_split('/\r\n|\r|\n/', (string) $workspace->target_prompts_text) ?: [])
            ->map(fn (string $line): string => trim($line))
            ->filter()
            ->take(12)
            ->map(fn (string $prompt): array => [
                'category' => 'customer-priority',
                'prompt_text' => $prompt,
                'prompt_source' => 'cowtech_first_run',
            ]);

        if ($custom->isNotEmpty()) {
            return $custom->values()->all();
        }

        $brand = $workspace->brand_name;
        $market = $workspace->target_market ?: $workspace->business_summary ?: 'this category';

        return [
            ['category' => 'brand-awareness', 'prompt_text' => "Do you know {$brand}?", 'prompt_source' => 'cowtech_first_run_default'],
            ['category' => 'category-recommendation', 'prompt_text' => "Which {$market} companies do you recommend?", 'prompt_source' => 'cowtech_first_run_default'],
            ['category' => 'competitor-comparison', 'prompt_text' => "Compare {$brand} with leading alternatives.", 'prompt_source' => 'cowtech_first_run_default'],
        ];
    }

    /**
     * @return array{credits:int,surface_limit:int,competitor_limit:int,article_quota:int,cadence_days:int,surfaces:list<string>}
     */
    public function planContractFor(string $planCode): array
    {
        return self::PLAN_CONTRACTS[$planCode] ?? self::PLAN_CONTRACTS['starter'];
    }

    /**
     * @param  array{credits:int,surface_limit:int,competitor_limit:int,article_quota:int,cadence_days:int,surfaces:list<string>}  $contract
     * @return array<string,mixed>
     */
    private function configureMonitoring(string $baseUrl, CustomerWorkspace $workspace, string $trackingRunId, string $planCode, array $contract): array
    {
        if ($trackingRunId === '') {
            throw new \RuntimeException('AIVGL tracking run did not return an id for monitoring config.');
        }

        $monitoringProviderMode = trim((string) config('services.aivgl.customer_monitoring_provider_mode', 'unconfigured')) ?: 'unconfigured';
        $allowPaid = (bool) config(
            'services.aivgl.customer_monitoring_allow_paid_provider',
            (bool) config('services.aivgl.customer_allow_paid_provider', false)
        );
        $surfaceCycle = array_map(
            fn (string $surface): array => [
                'surface_key' => $surface,
                'provider_mode' => $monitoringProviderMode === 'contract' ? $this->providerModeForSurface($surface) : $monitoringProviderMode,
                'engine_group' => $monitoringProviderMode === 'contract' ? $this->engineGroupForSurface($surface) : 'mock_llm',
                'cadence_days' => (int) $contract['cadence_days'],
                'allow_paid_provider' => $allowPaid,
                'status' => 'active',
                'region' => 'US',
                'language' => $workspace->locale ?: 'en',
            ],
            $contract['surfaces']
        );

        $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
            ->acceptJson()
            ->post($baseUrl.'/dashboard/monitoring/configure', [
                'run_id' => $trackingRunId,
                'brand_name' => $workspace->brand_name,
                'cadence_days' => (int) $contract['cadence_days'],
                'provider_mode' => $monitoringProviderMode === 'contract' ? 'openrouter' : $monitoringProviderMode,
                'allow_paid_provider' => $allowPaid,
                'status' => 'active',
                'region' => 'US',
                'language' => $workspace->locale ?: 'en',
                'surface_cycle' => $surfaceCycle,
                'plan_contract' => [
                    'plan_code' => $planCode,
                    'credits' => (int) $contract['credits'],
                    'surface_limit' => (int) $contract['surface_limit'],
                    'competitor_limit' => (int) $contract['competitor_limit'],
                    'article_quota' => (int) $contract['article_quota'],
                    'cadence_days' => (int) $contract['cadence_days'],
                ],
            ]);

        if (! $response->ok()) {
            throw new \RuntimeException('AIVGL monitoring config failed: '.$response->status().' '.$response->body());
        }

        return [
            'status' => 'configured',
            'plan_code' => $planCode,
            'cadence_days' => (int) $contract['cadence_days'],
            'credits' => (int) $contract['credits'],
            'surface_count' => count($contract['surfaces']),
            'surfaces' => $contract['surfaces'],
            'response' => $response->json(),
        ];
    }

    /**
     * @param  array{credits:int,surface_limit:int,competitor_limit:int,article_quota:int,cadence_days:int,surfaces:list<string>}  $contract
     * @return array<string,mixed>
     */
    private function configureMonthlyFulfillment(string $baseUrl, CustomerWorkspace $workspace, string $trackingRunId, string $planCode, array $contract): array
    {
        if ($trackingRunId === '') {
            throw new \RuntimeException('AIVGL tracking run did not return an id for monthly fulfillment.');
        }

        $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
            ->acceptJson()
            ->post($baseUrl.'/dashboard/monthly-fulfillment/configure', [
                'run_id' => $trackingRunId,
                'brand_name' => $workspace->brand_name,
                'plan_code' => $planCode,
                'plan_contract' => [
                    'credits' => (int) $contract['credits'],
                    'surface_limit' => (int) $contract['surface_limit'],
                    'competitor_limit' => (int) $contract['competitor_limit'],
                    'article_quota' => (int) $contract['article_quota'],
                    'cadence_days' => (int) $contract['cadence_days'],
                    'surfaces' => $contract['surfaces'],
                ],
            ]);

        if (! $response->ok()) {
            throw new \RuntimeException('AIVGL monthly fulfillment config failed: '.$response->status().' '.$response->body());
        }

        return [
            'status' => 'configured',
            'plan_code' => $planCode,
            'article_quota' => (int) $contract['article_quota'],
            'response' => $response->json(),
        ];
    }

    private function providerModeForSurface(string $surface): string
    {
        return match ($surface) {
            'chatgpt' => 'openrouter',
            'perplexity' => 'openrouter',
            'google_aio' => 'google_ai_overview',
            'gemini' => 'openrouter',
            'grok' => 'openrouter',
            default => 'openrouter',
        };
    }

    private function engineGroupForSurface(string $surface): string
    {
        return match ($surface) {
            'chatgpt' => 'openrouter_llm',
            'perplexity' => 'openrouter_llm',
            'google_aio' => 'google_aio',
            'gemini' => 'openrouter_llm',
            'grok' => 'openrouter_llm',
            default => 'openrouter_llm',
        };
    }
}

<?php

namespace App\Http\Controllers\Admin;

require_once __DIR__.'/../../../../app/Models/Admin.php';
require_once __DIR__.'/../../../../app/Models/CustomerBillingAddon.php';
require_once __DIR__.'/../../../../app/Models/CustomerBillingEntitlement.php';
require_once __DIR__.'/../../../../app/Models/CustomerWorkspace.php';

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\CustomerBillingAddon;
use App\Models\CustomerBillingEntitlement;
use App\Models\CustomerWorkspace;
use App\Support\AdminWeb;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\View\View;

class AivglOpsController extends Controller
{
    public function index(Request $request): View
    {
        $filters = [
            'q' => trim((string) $request->query('q', '')),
            'plan' => strtolower(trim((string) $request->query('plan', ''))),
            'status' => strtolower(trim((string) $request->query('status', ''))),
            'email' => strtolower(trim((string) $request->query('email', ''))),
        ];

        $customers = $this->customers($filters);
        $selectedEmail = $filters['email'] !== ''
            ? $filters['email']
            : strtolower((string) ($customers[0]['email'] ?? ''));
        $selected = $selectedEmail !== '' ? $this->findLocalCustomer($selectedEmail) : null;
        $remote = $selectedEmail !== '' ? $this->aivglSnapshot($selectedEmail) : [
            'status' => 'not_selected',
            'snapshot' => null,
            'error' => 'no_customer_selected',
        ];

        return view('admin.aivgl-ops.index', [
            'pageTitle' => 'AIVGL 运维页',
            'activeMenu' => 'aivgl_ops',
            'adminSiteName' => AdminWeb::siteName(),
            'filters' => $filters,
            'customers' => $customers,
            'selectedEmail' => $selectedEmail,
            'selectedCustomer' => $selected,
            'remoteSnapshot' => $remote,
            'summary' => $this->summary(),
        ]);
    }

    /**
     * @param  array{q:string,plan:string,status:string,email:string}  $filters
     * @return list<array<string,mixed>>
     */
    private function customers(array $filters): array
    {
        $query = CustomerBillingEntitlement::query()
            ->when($filters['q'] !== '', function ($query) use ($filters): void {
                $needle = '%'.$filters['q'].'%';
                $query->where(function ($query) use ($needle): void {
                    $query->where('email', 'like', $needle)
                        ->orWhere('provider_order_id', 'like', $needle)
                        ->orWhere('provider_subscription_id', 'like', $needle);
                });
            })
            ->when(in_array($filters['plan'], ['launch', 'starter', 'pro', 'god'], true), fn ($query) => $query->where('plan_code', $filters['plan']))
            ->when(in_array($filters['status'], ['active', 'trial', 'past_due', 'paused', 'canceled'], true), fn ($query) => $query->where('billing_status', $filters['status']))
            ->orderByDesc('updated_at')
            ->limit(50);

        return $query->get()
            ->map(fn (CustomerBillingEntitlement $entitlement): array => $this->localCustomerRow($entitlement))
            ->values()
            ->all();
    }

    /**
     * @return array<string,mixed>|null
     */
    private function findLocalCustomer(string $email): ?array
    {
        $entitlement = CustomerBillingEntitlement::query()
            ->where('email', strtolower(trim($email)))
            ->latest('updated_at')
            ->first();

        return $entitlement instanceof CustomerBillingEntitlement
            ? $this->localCustomerRow($entitlement, true)
            : null;
    }

    /**
     * @return array<string,mixed>
     */
    private function localCustomerRow(CustomerBillingEntitlement $entitlement, bool $includeAddonItems = false): array
    {
        $email = strtolower((string) $entitlement->email);
        $admin = Admin::query()->where('email', $email)->first();
        $workspace = $admin instanceof Admin
            ? CustomerWorkspace::query()->where('admin_id', (int) $admin->id)->first()
            : null;
        $addons = CustomerBillingAddon::query()
            ->where('email', $email)
            ->whereIn('billing_status', ['active', 'trial'])
            ->latest('updated_at')
            ->get();
        $addonTotals = ['credits' => 0, 'article' => 0, 'competitor' => 0];

        foreach ($addons as $addon) {
            $type = (string) $addon->unit_type;
            if (array_key_exists($type, $addonTotals)) {
                $addonTotals[$type] += (int) $addon->units;
            }
        }

        return [
            'email' => $email,
            'plan_code' => (string) $entitlement->plan_code,
            'billing_status' => (string) $entitlement->billing_status,
            'payment_provider' => (string) $entitlement->payment_provider,
            'provider_order_id' => (string) ($entitlement->provider_order_id ?? ''),
            'provider_subscription_id' => (string) ($entitlement->provider_subscription_id ?? ''),
            'amount' => $entitlement->amount !== null ? (string) $entitlement->amount : '',
            'currency' => strtoupper((string) $entitlement->currency),
            'synced_to_aivgl_at' => optional($entitlement->synced_to_aivgl_at)->toDateTimeString(),
            'last_sync_error' => (string) ($entitlement->last_sync_error ?? ''),
            'admin_id' => $admin instanceof Admin ? (int) $admin->id : null,
            'workspace' => $workspace instanceof CustomerWorkspace ? [
                'brand_name' => (string) $workspace->brand_name,
                'brand_url' => (string) $workspace->brand_url,
                'status' => (string) $workspace->status,
                'aivgl_customer_id' => (string) ($workspace->aivgl_customer_id ?? ''),
                'aivgl_brand_id' => (string) ($workspace->aivgl_brand_id ?? ''),
                'aivgl_tracking_run_id' => (string) ($workspace->aivgl_tracking_run_id ?? ''),
                'aivgl_provider_mode' => (string) ($workspace->aivgl_provider_mode ?? ''),
                'last_error' => (string) ($workspace->last_error ?? ''),
                'diagnosis_completed_at' => optional($workspace->diagnosis_completed_at)->toDateTimeString(),
            ] : null,
            'addons' => [
                'totals' => $addonTotals,
                'count' => $addons->count(),
                'items' => $includeAddonItems
                    ? $addons->map(fn (CustomerBillingAddon $addon): array => [
                        'addon_code' => (string) $addon->addon_code,
                        'unit_type' => (string) $addon->unit_type,
                        'units' => (int) $addon->units,
                        'billing_status' => (string) $addon->billing_status,
                        'billing_period' => (string) $addon->billing_period,
                        'synced_to_aivgl_at' => optional($addon->synced_to_aivgl_at)->toDateTimeString(),
                        'last_sync_error' => (string) ($addon->last_sync_error ?? ''),
                    ])->values()->all()
                    : [],
            ],
            'updated_at' => optional($entitlement->updated_at)->toDateTimeString(),
        ];
    }

    /**
     * @return array{status:string,snapshot:?array<string,mixed>,error:string,http_status:int|null}
     */
    private function aivglSnapshot(string $email): array
    {
        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            return ['status' => 'unavailable', 'snapshot' => null, 'error' => 'aivgl_base_url_missing', 'http_status' => null];
        }

        try {
            $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
                ->acceptJson()
                ->withHeaders($this->aivglInternalHeaders())
                ->get($baseUrl.'/internal/ops/control-center/customer-entitlements', [
                    'email' => $email,
                ]);

            if ($response->status() === 404) {
                return ['status' => 'not_found', 'snapshot' => null, 'error' => 'aivgl_customer_entitlement_not_found', 'http_status' => 404];
            }

            if (! $response->ok()) {
                return ['status' => 'error', 'snapshot' => null, 'error' => 'aivgl_http_'.$response->status(), 'http_status' => $response->status()];
            }

            $snapshot = $response->json('entitlement');

            return [
                'status' => is_array($snapshot) ? 'connected' : 'error',
                'snapshot' => is_array($snapshot) ? $snapshot : null,
                'error' => is_array($snapshot) ? '' : 'aivgl_payload_missing',
                'http_status' => $response->status(),
            ];
        } catch (\Throwable $exception) {
            return ['status' => 'error', 'snapshot' => null, 'error' => $exception->getMessage(), 'http_status' => null];
        }
    }

    /**
     * @return array<string,int>
     */
    private function summary(): array
    {
        return [
            'customers' => (int) CustomerBillingEntitlement::query()->count(),
            'active' => (int) CustomerBillingEntitlement::query()->whereIn('billing_status', ['active', 'trial'])->count(),
            'workspaces' => (int) CustomerWorkspace::query()->whereNotNull('aivgl_customer_id')->count(),
            'sync_errors' => (int) CustomerBillingEntitlement::query()->whereNotNull('last_sync_error')->where('last_sync_error', '<>', '')->count()
                + (int) CustomerBillingAddon::query()->whereNotNull('last_sync_error')->where('last_sync_error', '<>', '')->count(),
        ];
    }

    /**
     * @return array<string,string>
     */
    private function aivglInternalHeaders(): array
    {
        $token = trim((string) config('services.aivgl.internal_admin_token', ''));

        return $token !== '' ? ['X-Internal-Admin-Token' => $token] : [];
    }
}

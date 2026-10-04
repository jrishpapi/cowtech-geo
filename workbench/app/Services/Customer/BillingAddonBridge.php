<?php

namespace App\Services\Customer;

require_once __DIR__.'/../../Models/Admin.php';
require_once __DIR__.'/../../Models/CustomerBillingAddon.php';
require_once __DIR__.'/../../Models/CustomerWorkspace.php';

use App\Models\Admin;
use App\Models\CustomerBillingAddon;
use App\Models\CustomerWorkspace;
use Illuminate\Support\Facades\Http;

class BillingAddonBridge
{
    private const ADDONS = [
        'credits_1000' => ['unit_type' => 'credits', 'units' => 1000, 'billing_period' => 'one_time'],
        'article_extra' => ['unit_type' => 'article', 'units' => 1, 'billing_period' => 'one_time'],
        'competitor_extra' => ['unit_type' => 'competitor', 'units' => 1, 'billing_period' => 'monthly'],
    ];

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    public function apply(array $payload): array
    {
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $addonCode = $this->normalizeAddon((string) ($payload['addon_code'] ?? $payload['pkg'] ?? ''));
        $billingStatus = $this->normalizeStatus((string) ($payload['billing_status'] ?? $payload['status'] ?? 'active'));

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('valid email is required');
        }
        if ($addonCode === '') {
            throw new \InvalidArgumentException('valid addon_code is required');
        }

        $config = self::ADDONS[$addonCode];
        $units = max(1, (int) ($payload['units'] ?? $config['units']));
        $providerOrderId = trim((string) ($payload['order_id'] ?? $payload['provider_order_id'] ?? '')) ?: null;
        $providerSubscriptionId = trim((string) ($payload['subscription_id'] ?? $payload['provider_subscription_id'] ?? '')) ?: null;
        $providerTransactionId = trim((string) ($payload['transaction_id'] ?? $payload['provider_transaction_id'] ?? '')) ?: null;
        if ($providerSubscriptionId !== null) {
            $lookup = [
                'email' => $email,
                'provider_subscription_id' => $providerSubscriptionId,
                'addon_code' => $addonCode,
            ];
        } elseif ($providerTransactionId !== null) {
            $lookup = [
                'email' => $email,
                'provider_transaction_id' => $providerTransactionId,
                'addon_code' => $addonCode,
            ];
        } elseif ($providerOrderId !== null) {
            $lookup = [
                'email' => $email,
                'provider_order_id' => $providerOrderId,
                'addon_code' => $addonCode,
            ];
        } else {
            throw new \InvalidArgumentException('provider order, transaction, or subscription reference is required');
        }

        $values = [
            'unit_type' => (string) ($payload['unit_type'] ?? $config['unit_type']),
            'units' => $units,
            'billing_status' => $billingStatus,
            'billing_period' => (string) ($payload['billing_period'] ?? $config['billing_period']),
            'payment_provider' => (string) ($payload['payment_provider'] ?? 'paypal'),
            'source_payload_json' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'last_sync_error' => null,
        ];
        foreach ([
            'provider_order_id' => $providerOrderId,
            'provider_subscription_id' => $providerSubscriptionId,
            'provider_transaction_id' => $providerTransactionId,
        ] as $attribute => $value) {
            if ($value !== null) {
                $values[$attribute] = $value;
            }
        }
        if (is_numeric($payload['amount'] ?? null)) {
            $values['amount'] = (float) $payload['amount'];
        }
        $currency = strtolower(trim((string) ($payload['currency'] ?? '')));
        if ($currency !== '') {
            $values['currency'] = $currency;
        }

        $addon = CustomerBillingAddon::query()->updateOrCreate($lookup, $values);

        $sync = $this->syncExistingAivglCustomer($addon);

        return [
            'status' => 'stored',
            'addon' => [
                'email' => $addon->email,
                'addon_code' => $addon->addon_code,
                'unit_type' => $addon->unit_type,
                'units' => $addon->units,
                'billing_status' => $addon->billing_status,
                'synced_to_aivgl_at' => optional($addon->synced_to_aivgl_at)->toIso8601String(),
                'last_sync_error' => $addon->last_sync_error,
            ],
            'aivgl_sync' => $sync,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function summaryForEmail(string $email): array
    {
        $normalized = strtolower(trim($email));
        $rows = CustomerBillingAddon::query()
            ->where('email', $normalized)
            ->latest('updated_at')
            ->get();

        $totals = ['credits' => 0, 'article' => 0, 'competitor' => 0];
        foreach ($rows as $row) {
            $type = (string) $row->unit_type;
            if (in_array((string) $row->billing_status, ['active', 'trial'], true) && array_key_exists($type, $totals)) {
                $totals[$type] += (int) $row->units;
            }
        }

        return [
            'totals' => $totals,
            'items' => $rows->map(fn (CustomerBillingAddon $row): array => [
                'addon_code' => (string) $row->addon_code,
                'unit_type' => (string) $row->unit_type,
                'units' => (int) $row->units,
                'billing_status' => (string) $row->billing_status,
                'billing_period' => (string) $row->billing_period,
                'synced_to_aivgl_at' => optional($row->synced_to_aivgl_at)->toIso8601String(),
                'last_sync_error' => $row->last_sync_error,
            ])->values()->all(),
        ];
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function syncForEmail(string $email): array
    {
        $normalized = strtolower(trim($email));
        if ($normalized === '') {
            return [];
        }

        return CustomerBillingAddon::query()
            ->where('email', $normalized)
            ->get()
            ->map(fn (CustomerBillingAddon $addon): array => [
                'id' => (int) $addon->id,
                'result' => $this->syncExistingAivglCustomer($addon),
            ])
            ->values()
            ->all();
    }

    private function syncExistingAivglCustomer(CustomerBillingAddon $addon): array
    {
        $admin = Admin::query()->where('email', (string) $addon->email)->first();
        if (! $admin instanceof Admin) {
            return ['status' => 'pending_signup'];
        }

        $workspace = CustomerWorkspace::query()->where('admin_id', (int) $admin->id)->first();
        if (! $workspace instanceof CustomerWorkspace || trim((string) $workspace->aivgl_customer_id) === '') {
            return ['status' => 'pending_first_run'];
        }

        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            return $this->markSyncError($addon, 'aivgl_base_url_missing');
        }

        try {
            $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
                ->acceptJson()
                ->withHeaders($this->aivglInternalHeaders())
                ->post($baseUrl.'/internal/ops/control-center/customer-addons', [
                    'external_customer_id' => 'cowtech-admin-'.$admin->id,
                    'email' => (string) $addon->email,
                    'addon_code' => (string) $addon->addon_code,
                    'unit_type' => (string) $addon->unit_type,
                    'units' => (int) $addon->units,
                    'billing_status' => (string) $addon->billing_status,
                    'billing_period' => (string) $addon->billing_period,
                    'payment_provider' => (string) $addon->payment_provider,
                    'provider_order_id' => $addon->provider_order_id,
                    'provider_subscription_id' => $addon->provider_subscription_id,
                    'provider_transaction_id' => $addon->provider_transaction_id,
                    'source' => 'paypal_addon_bridge',
                ]);

            if (! $response->ok()) {
                return $this->markSyncError($addon, 'aivgl_http_'.$response->status().': '.$response->body());
            }

            $addon->forceFill([
                'synced_to_aivgl_at' => now(),
                'last_sync_error' => null,
            ])->save();

            return ['status' => (string) ($response->json('addon.status') ?? 'synced')];
        } catch (\Throwable $exception) {
            return $this->markSyncError($addon, $exception->getMessage());
        }
    }

    /**
     * @return array<string,string>
     */
    private function aivglInternalHeaders(): array
    {
        $token = trim((string) config('services.aivgl.internal_admin_token', ''));

        return $token !== '' ? ['X-Internal-Admin-Token' => $token] : [];
    }

    private function markSyncError(CustomerBillingAddon $addon, string $message): array
    {
        $addon->forceFill(['last_sync_error' => $message])->save();

        return ['status' => 'sync_failed', 'error' => $message];
    }

    private function normalizeAddon(string $addon): string
    {
        $normalized = strtolower(trim($addon));

        return match ($normalized) {
            'credits_1000', 'extra_credits_1000' => 'credits_1000',
            'article_extra', 'extra_article' => 'article_extra',
            'competitor_extra', 'extra_competitor' => 'competitor_extra',
            default => '',
        };
    }

    private function normalizeStatus(string $status): string
    {
        $normalized = strtolower(trim($status));

        return match ($normalized) {
            'paid' => 'active',
            'payment_failed', 'failed' => 'past_due',
            'suspended' => 'paused',
            'cancelled', 'expired' => 'canceled',
            'active', 'trial', 'past_due', 'paused', 'canceled' => $normalized,
            default => 'active',
        };
    }
}

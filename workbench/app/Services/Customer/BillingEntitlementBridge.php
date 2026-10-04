<?php

namespace App\Services\Customer;

require_once __DIR__.'/../../Models/Admin.php';
require_once __DIR__.'/../../Models/CustomerBillingEntitlement.php';
require_once __DIR__.'/../../Models/CustomerWorkspace.php';

use App\Models\Admin;
use App\Models\CustomerBillingEntitlement;
use App\Models\CustomerWorkspace;
use Illuminate\Support\Facades\Http;

class BillingEntitlementBridge
{
    public function isSelfHosted(): bool
    {
        $mode = (string) config('services.cowtech.deployment_mode', 'self_hosted');
        if (! in_array($mode, ['self_hosted', 'commercial'], true)) {
            throw new \RuntimeException('Invalid COWTECH_DEPLOYMENT_MODE.');
        }

        return $mode === 'self_hosted';
    }

    private function selfHostedAccess(Admin $admin): array
    {
        $plan = (string) config('services.cowtech.self_hosted_plan_code', 'god');
        if (! in_array($plan, ['starter', 'pro', 'god'], true)) {
            throw new \RuntimeException('Invalid self-hosted capacity profile.');
        }
        $allowed = $admin->exists && (int) $admin->id > 0
            && $admin->status === 'active'
            && ($admin->email_verified_at !== null || $admin->isSuperAdmin());

        return [
            ...$this->emptyAccessState(strtolower(trim((string) $admin->email))),
            'plan_code' => $allowed ? $plan : '',
            'billing_status' => 'not_applicable',
            'access_source' => 'self_hosted',
            'is_active' => $allowed,
            'can_start_aivgl' => $allowed,
            'state' => $allowed ? 'self_hosted_active' : 'account_verification_required',
            'message' => $allowed
                ? 'Self-hosted workspace. Configure your own AI services; no CowTech subscription is required.'
                : 'An active, verified local account is required.',
        ];
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    public function apply(array $payload): array
    {
        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $planCode = $this->normalizePlan((string) ($payload['plan_code'] ?? $payload['plan'] ?? ''));
        $billingStatus = $this->normalizeStatus((string) ($payload['billing_status'] ?? $payload['status'] ?? 'active'));

        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('valid email is required');
        }
        if ($planCode === '') {
            throw new \InvalidArgumentException('valid plan_code is required');
        }

        $entitlement = CustomerBillingEntitlement::query()->firstOrNew(['email' => $email]);
        $entitlement->fill([
            'plan_code' => $planCode,
            'billing_status' => $billingStatus,
            'payment_provider' => (string) ($payload['payment_provider'] ?? 'paypal'),
            'source_payload_json' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'last_sync_error' => null,
        ]);

        // Subscription lifecycle callbacks do not always repeat the original
        // order/transaction fields. Missing values must never erase the exact
        // paid-order identity used by account claims and file ownership checks.
        foreach ([
            'provider_order_id' => $payload['order_id'] ?? $payload['provider_order_id'] ?? null,
            'provider_subscription_id' => $payload['subscription_id'] ?? $payload['provider_subscription_id'] ?? null,
            'provider_transaction_id' => $payload['transaction_id'] ?? $payload['provider_transaction_id'] ?? null,
        ] as $attribute => $value) {
            $normalized = trim((string) $value);
            if ($normalized !== '') {
                $entitlement->setAttribute($attribute, $normalized);
            }
        }
        if (is_numeric($payload['amount'] ?? null)) {
            $entitlement->amount = (float) $payload['amount'];
        }
        $currency = strtolower(trim((string) ($payload['currency'] ?? '')));
        if ($currency !== '') {
            $entitlement->currency = $currency;
        } elseif (! $entitlement->exists && trim((string) $entitlement->currency) === '') {
            $entitlement->currency = 'usd';
        }
        $entitlement->save();

        $entitlement = $this->bindToVerifiedCustomerWhenSafe($entitlement);
        $sync = $this->syncExistingAivglCustomer($entitlement);

        return [
            'status' => 'stored',
            'entitlement' => [
                'email' => $entitlement->email,
                'plan_code' => $entitlement->plan_code,
                'billing_status' => $entitlement->billing_status,
                'synced_to_aivgl_at' => optional($entitlement->synced_to_aivgl_at)->toIso8601String(),
                'last_sync_error' => $entitlement->last_sync_error,
            ],
            'aivgl_sync' => $sync,
        ];
    }

    public function planCodeForEmail(string $email): ?string
    {
        $normalized = strtolower(trim($email));
        if ($normalized === '') {
            return null;
        }

        $entitlement = CustomerBillingEntitlement::query()
            ->where('email', $normalized)
            ->whereIn('billing_status', ['active', 'paid', 'trial'])
            ->whereIn('plan_code', ['starter', 'pro', 'god'])
            ->latest('updated_at')
            ->first();

        return $entitlement instanceof CustomerBillingEntitlement
            ? $this->normalizePlan((string) $entitlement->plan_code)
            : null;
    }

    public function planCodeForAdmin(Admin $admin): ?string
    {
        if ($this->isSelfHosted()) {
            $access = $this->selfHostedAccess($admin);

            return $access['can_start_aivgl'] ? $access['plan_code'] : null;
        }
        $entitlement = $this->claimedEntitlementForAdmin($admin);
        if (! $entitlement instanceof CustomerBillingEntitlement) {
            return null;
        }

        $status = $this->normalizeStatus((string) $entitlement->billing_status);
        $plan = $this->normalizePlan((string) $entitlement->plan_code);

        return in_array($status, ['active', 'trial'], true)
            && in_array($plan, ['starter', 'pro', 'god'], true)
                ? $plan
                : null;
    }

    /**
     * The admin id, not a browser-supplied email address, is the ownership boundary.
     */
    public function claimedEntitlementForAdmin(Admin $admin): ?CustomerBillingEntitlement
    {
        if ($this->isSelfHosted()) {
            return null;
        }
        if ((int) $admin->id < 1 || $admin->email_verified_at === null) {
            return null;
        }

        $entitlement = CustomerBillingEntitlement::query()
            ->where('admin_id', (int) $admin->id)
            ->latest('updated_at')
            ->first();

        return $entitlement instanceof CustomerBillingEntitlement ? $entitlement : null;
    }

    /**
     * @return array{email:string,plan_code:string,billing_status:string,has_entitlement:bool,is_active:bool,can_generate_launch_pack:bool,can_start_aivgl:bool,state:string,message:string}
     */
    public function accessStateForAdmin(Admin $admin): array
    {
        if ($this->isSelfHosted()) {
            return $this->selfHostedAccess($admin);
        }
        $entitlement = $this->claimedEntitlementForAdmin($admin);
        if ($entitlement instanceof CustomerBillingEntitlement) {
            return $this->accessStateFromEntitlement($entitlement);
        }

        return [
            ...$this->emptyAccessState(strtolower(trim((string) $admin->email))),
            'state' => $admin->email_verified_at === null ? 'email_unverified' : 'claim_required',
            'message' => $admin->email_verified_at === null
                ? '请先验证付款邮箱，再进入客户履约。'
                : '这个账号尚未绑定付款权益，请联系支持处理。',
        ];
    }

    /**
     * @return array{email:string,plan_code:string,billing_status:string,has_entitlement:bool,is_active:bool,can_generate_launch_pack:bool,can_start_aivgl:bool,state:string,message:string}
     */
    public function accessStateForEmail(string $email): array
    {
        $normalized = strtolower(trim($email));
        $base = $this->emptyAccessState($normalized);

        if ($normalized === '') {
            return $base;
        }

        $entitlement = CustomerBillingEntitlement::query()
            ->where('email', $normalized)
            ->latest('updated_at')
            ->first();

        if (! $entitlement instanceof CustomerBillingEntitlement) {
            return $base;
        }

        return $this->accessStateFromEntitlement($entitlement);
    }

    /**
     * @return array{email:string,plan_code:string,billing_status:string,has_entitlement:bool,is_active:bool,can_generate_launch_pack:bool,can_start_aivgl:bool,state:string,message:string}
     */
    private function accessStateFromEntitlement(CustomerBillingEntitlement $entitlement): array
    {
        $base = $this->emptyAccessState(strtolower(trim((string) $entitlement->email)));

        $plan = $this->normalizePlan((string) $entitlement->plan_code);
        $status = $this->normalizeStatus((string) $entitlement->billing_status);
        $active = in_array($status, ['active', 'trial'], true);
        $aivglPlan = in_array($plan, ['starter', 'pro', 'god'], true);
        $launchPlan = $plan === 'launch';

        if (! $active) {
            return [
                ...$base,
                'plan_code' => $plan,
                'billing_status' => $status,
                'has_entitlement' => true,
                'state' => $status === 'past_due' ? 'past_due' : 'inactive',
                'message' => $status === 'past_due'
                    ? '付款已逾期。账号保持只读，但新的监控、文章和复测任务已暂停。'
                    : '付款状态不是 active/trial，暂时不能启动履约。',
            ];
        }

        if ($launchPlan) {
            return [
                ...$base,
                'plan_code' => $plan,
                'billing_status' => $status,
                'has_entitlement' => true,
                'is_active' => true,
                'can_generate_launch_pack' => true,
                'state' => 'launch_only',
                'message' => 'Launch Pack 已激活：可以生成交付文件，但不会启动月度 AIVGL 监控。',
            ];
        }

        if ($aivglPlan) {
            return [
                ...$base,
                'plan_code' => $plan,
                'billing_status' => $status,
                'has_entitlement' => true,
                'is_active' => true,
                'can_generate_launch_pack' => true,
                'can_start_aivgl' => true,
                'state' => 'subscription_active',
                'message' => strtoupper($plan).' 套餐已激活，可以启动 first run 和 Launch Pack 文件生成。',
            ];
        }

        return [
            ...$base,
            'plan_code' => $plan,
            'billing_status' => $status,
            'has_entitlement' => true,
            'is_active' => true,
            'state' => 'unsupported_plan',
            'message' => '当前 plan 不能启动客户履约。',
        ];
    }

    /**
     * @return array{email:string,plan_code:string,billing_status:string,has_entitlement:bool,is_active:bool,can_generate_launch_pack:bool,can_start_aivgl:bool,state:string,message:string}
     */
    private function emptyAccessState(string $email): array
    {
        return [
            'email' => $email,
            'plan_code' => '',
            'billing_status' => '',
            'has_entitlement' => false,
            'is_active' => false,
            'can_generate_launch_pack' => false,
            'can_start_aivgl' => false,
            'state' => 'missing',
            'message' => '未检测到这个登录邮箱的有效付款记录。',
        ];
    }

    private function bindToVerifiedCustomerWhenSafe(CustomerBillingEntitlement $entitlement): CustomerBillingEntitlement
    {
        if ($entitlement->admin_id !== null || $this->normalizeStatus((string) $entitlement->billing_status) !== 'active') {
            return $entitlement;
        }

        $email = strtolower(trim((string) $entitlement->email));
        if ($email === '') {
            return $entitlement;
        }

        $matches = Admin::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('role', 'customer')
            ->where('status', 'active')
            ->whereNotNull('email_verified_at')
            ->limit(2)
            ->get();
        if ($matches->count() !== 1) {
            return $entitlement;
        }

        /** @var Admin $admin */
        $admin = $matches->first();
        $alreadyClaimed = CustomerBillingEntitlement::query()
            ->where('admin_id', (int) $admin->id)
            ->whereKeyNot($entitlement->getKey())
            ->exists();
        if ($alreadyClaimed) {
            return $entitlement;
        }

        $entitlement->forceFill([
            'admin_id' => (int) $admin->id,
            'claimed_at' => $entitlement->claimed_at ?? now(),
        ])->save();

        return $entitlement->refresh();
    }

    private function syncExistingAivglCustomer(CustomerBillingEntitlement $entitlement): array
    {
        if (! in_array((string) $entitlement->plan_code, ['starter', 'pro', 'god'], true)) {
            return ['status' => 'not_aivgl_subscription_plan'];
        }

        $entitlement = $this->bindToVerifiedCustomerWhenSafe($entitlement);
        $admin = $entitlement->admin_id !== null
            ? Admin::query()
                ->whereKey((int) $entitlement->admin_id)
                ->where('role', 'customer')
                ->where('status', 'active')
                ->whereNotNull('email_verified_at')
                ->first()
            : null;
        if (! $admin instanceof Admin) {
            return ['status' => 'pending_signup'];
        }

        $workspace = CustomerWorkspace::query()->where('admin_id', (int) $admin->id)->first();
        if (! $workspace instanceof CustomerWorkspace || trim((string) $workspace->aivgl_customer_id) === '') {
            return ['status' => 'pending_first_run'];
        }

        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            return $this->markSyncError($entitlement, 'aivgl_base_url_missing');
        }

        try {
            $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
                ->acceptJson()
                ->withHeaders($this->aivglInternalHeaders())
                ->post($baseUrl.'/internal/ops/control-center/customer-entitlements', [
                    'external_customer_id' => 'cowtech-admin-'.$admin->id,
                    'email' => (string) $entitlement->email,
                    'plan_code' => (string) $entitlement->plan_code,
                    'status' => (string) $entitlement->billing_status,
                    'source' => 'paypal_bridge',
                ]);

            if (! $response->ok()) {
                return $this->markSyncError($entitlement, 'aivgl_http_'.$response->status().': '.$response->body());
            }

            $status = (string) ($response->json('entitlement.status') ?? 'unknown');
            if ($status !== 'synced') {
                return ['status' => $status];
            }

            $entitlement->forceFill([
                'synced_to_aivgl_at' => now(),
                'last_sync_error' => null,
            ])->save();

            return ['status' => 'synced'];
        } catch (\Throwable $exception) {
            return $this->markSyncError($entitlement, $exception->getMessage());
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

    /**
     * @return array{status:string,error:string}
     */
    private function markSyncError(CustomerBillingEntitlement $entitlement, string $message): array
    {
        $entitlement->forceFill(['last_sync_error' => $message])->save();

        return ['status' => 'sync_failed', 'error' => $message];
    }

    private function normalizePlan(string $plan): string
    {
        $normalized = strtolower(trim($plan));

        return match ($normalized) {
            'god_mode' => 'god',
            'launch', 'starter', 'pro', 'god' => $normalized,
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

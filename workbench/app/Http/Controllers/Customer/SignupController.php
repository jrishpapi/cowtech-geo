<?php

namespace App\Http\Controllers\Customer;

require_once __DIR__.'/../../../Models/Admin.php';
require_once __DIR__.'/../../../Models/CustomerBillingEntitlement.php';
require_once __DIR__.'/../../../Models/CustomerEmailClaim.php';
require_once __DIR__.'/../../../Services/Customer/LaunchPackFulfillmentBridge.php';

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\CustomerBillingEntitlement;
use App\Models\CustomerEmailClaim;
use App\Services\Customer\LaunchPackFulfillmentBridge;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class SignupController extends Controller
{
    private const CLAIM_TTL_MINUTES = 10;

    private const CLAIM_MAX_ATTEMPTS = 5;

    private const CLAIM_RESEND_COOLDOWN_MINUTES = 10;

    private const CLAIM_SENDS_PER_DAY = 3;

    private const ELIGIBLE_PLANS = ['launch', 'starter', 'pro', 'god', 'god_mode'];

    private const ACTIVE_PAID_STATUSES = ['active', 'paid'];

    public function __construct(
        private readonly LaunchPackFulfillmentBridge $launchPackFulfillmentBridge
    ) {}

    public function show(Request $request): View|RedirectResponse
    {
        $prefill = $this->prefillFromRequest($request);
        if (Auth::guard('admin')->check()) {
            $this->storePrefill($request, $prefill);

            return redirect()->route('customer.start');
        }

        if ($this->pendingAdmin($request) instanceof Admin) {
            return redirect()->route('customer.signup.verify');
        }

        return view('customer.signup', [
            'pageTitle' => __('customer.signup_page'),
            'prefill' => $prefill,
            'loginUrl' => $this->loginUrl($prefill),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        if (app(\App\Services\Customer\BillingEntitlementBridge::class)->isSelfHosted()) {
            return $this->storeSelfHosted($request);
        }
        $payload = $request->validate([
            'email' => ['required', 'email', 'max:100'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'brand_name' => ['nullable', 'string', 'max:160'],
            'brand_url' => ['nullable', 'url', 'max:500'],
            'business_summary' => ['nullable', 'string', 'max:500'],
            'source' => ['nullable', 'string', 'max:80'],
            'order_id' => ['required', 'string', 'max:120'],
        ]);

        $email = strtolower(trim((string) $payload['email']));
        $orderId = trim((string) $payload['order_id']);

        /** @var array{admin:Admin,entitlement:CustomerBillingEntitlement,claim:CustomerEmailClaim,code:?string,resumed:bool} $registration */
        $registration = DB::transaction(function () use ($email, $orderId, $payload): array {
            $entitlement = CustomerBillingEntitlement::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->where('provider_order_id', $orderId)
                ->whereIn('billing_status', self::ACTIVE_PAID_STATUSES)
                ->whereIn('plan_code', self::ELIGIBLE_PLANS)
                ->lockForUpdate()
                ->first();
            if (! $entitlement instanceof CustomerBillingEntitlement || trim((string) $entitlement->provider_order_id) === '') {
                throw ValidationException::withMessages([
                    'order_id' => __('customer.claim_not_found'),
                ]);
            }

            $existingAdmin = Admin::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->lockForUpdate()
                ->first();
            if ($existingAdmin instanceof Admin) {
                $canResume = (string) $existingAdmin->role === 'customer'
                    && (string) $existingAdmin->status === 'pending_email_verification'
                    && $existingAdmin->email_verified_at === null
                    && ($entitlement->admin_id === null || (int) $entitlement->admin_id === (int) $existingAdmin->id);
                if (! $canResume) {
                    throw ValidationException::withMessages([
                        'email' => __('customer.account_exists'),
                    ]);
                }

                $claim = CustomerEmailClaim::query()
                    ->where('admin_id', (int) $existingAdmin->id)
                    ->where('entitlement_id', (int) $entitlement->id)
                    ->where('provider_order_id', $orderId)
                    ->whereNull('used_at')
                    ->latest('created_at')
                    ->lockForUpdate()
                    ->first();
                if (! $claim instanceof CustomerEmailClaim) {
                    throw ValidationException::withMessages([
                        'email' => __('customer.claim_missing'),
                    ]);
                }

                return [
                    'admin' => $existingAdmin,
                    'entitlement' => $entitlement,
                    'claim' => $claim,
                    'code' => null,
                    'resumed' => true,
                ];
            }
            if ($entitlement->admin_id !== null) {
                throw ValidationException::withMessages([
                    'email' => __('customer.entitlement_bound'),
                ]);
            }
            $pendingReservation = CustomerEmailClaim::query()
                ->where('entitlement_id', (int) $entitlement->id)
                ->whereNull('used_at')
                ->where('expires_at', '>', now())
                ->exists();
            if ($pendingReservation) {
                throw ValidationException::withMessages([
                    'email' => __('customer.claim_in_progress'),
                ]);
            }

            $admin = Admin::query()->create([
                'username' => $this->uniqueUsername($email),
                // The submitted password is held only in the claimant's
                // server-side session until email ownership is proven.
                'password' => Str::random(64),
                'email' => $email,
                'email_verified_at' => null,
                'display_name' => trim((string) ($payload['brand_name'] ?? '')) ?: $email,
                'role' => 'customer',
                'status' => 'pending_email_verification',
            ]);
            [$claim, $code] = $this->createClaim($admin, $entitlement);

            return compact('admin', 'entitlement', 'claim', 'code') + ['resumed' => false];
        }, 3);

        $this->storePrefill($request, [
            'email' => $email,
            'brand_name' => trim((string) ($payload['brand_name'] ?? '')),
            'brand_url' => trim((string) ($payload['brand_url'] ?? '')),
            'business_summary' => trim((string) ($payload['business_summary'] ?? '')),
            'source' => trim((string) ($payload['source'] ?? '')),
            'order_id' => $orderId,
        ]);
        $this->rememberPendingAdmin(
            $request,
            $registration['admin'],
            Hash::make((string) $payload['password'])
        );

        if ($registration['resumed']) {
            return redirect()
                ->route('customer.signup.verify')
                ->with('message', __('customer.claim_resumed'));
        }

        $sent = $this->sendClaimEmail(
            $registration['entitlement'],
            $registration['claim'],
            (string) $registration['code']
        );

        $redirect = redirect()->route('customer.signup.verify');
        if (! $sent) {
            return $redirect->withErrors([
                'code' => __('customer.email_delivery_failed'),
            ]);
        }

        return $redirect->with('message', __('customer.code_sent'));
    }

    public function showVerification(Request $request): View|RedirectResponse
    {
        if (Auth::guard('admin')->check()) {
            return redirect()->route('customer.start');
        }

        $admin = $this->pendingAdmin($request);
        if (! $admin instanceof Admin) {
            return redirect()->route('customer.signup')
                ->withErrors(['email' => __('customer.claim_session_expired')]);
        }

        $claim = CustomerEmailClaim::query()
            ->where('admin_id', (int) $admin->id)
            ->whereNull('used_at')
            ->latest('created_at')
            ->first();

        return view('customer.signup-verify', [
            'pageTitle' => __('customer.verify_page'),
            'maskedEmail' => $this->maskEmail((string) $admin->email),
            'expiresAt' => $claim?->expires_at,
            'canResendAt' => $claim?->last_sent_at?->copy()->addMinutes(self::CLAIM_RESEND_COOLDOWN_MINUTES),
        ]);
    }

    public function verify(Request $request): RedirectResponse
    {
        $payload = $request->validate([
            'code' => ['required', 'string', 'regex:/^[0-9]{6}$/'],
        ], [
            'code.regex' => __('customer.code_format'),
        ]);
        $pendingAdminId = (int) $request->session()->get('customer_pending_claim_admin_id', 0);
        $pendingPasswordHash = (string) $request->session()->get('customer_pending_claim_password_hash', '');
        $passwordInfo = password_get_info($pendingPasswordHash);
        if ($pendingAdminId < 1 || ($passwordInfo['algo'] ?? null) === null) {
            return redirect()->route('customer.signup')
                ->withErrors(['email' => __('customer.claim_session_expired')]);
        }

        /** @var array{ok:bool,reason:string,admin?:Admin} $result */
        $result = DB::transaction(function () use ($pendingAdminId, $pendingPasswordHash, $payload): array {
            $admin = Admin::query()->whereKey($pendingAdminId)->lockForUpdate()->first();
            if (! $admin instanceof Admin || (string) $admin->role !== 'customer') {
                return ['ok' => false, 'reason' => 'session_invalid'];
            }
            if ((string) $admin->status !== 'pending_email_verification' || $admin->email_verified_at !== null) {
                return ['ok' => false, 'reason' => 'account_state_invalid'];
            }

            $claim = CustomerEmailClaim::query()
                ->where('admin_id', (int) $admin->id)
                ->whereNull('used_at')
                ->latest('created_at')
                ->lockForUpdate()
                ->first();
            if (! $claim instanceof CustomerEmailClaim) {
                return ['ok' => false, 'reason' => 'claim_missing'];
            }
            if ($claim->expires_at === null || $claim->expires_at->isPast()) {
                return ['ok' => false, 'reason' => 'claim_expired'];
            }
            if ((int) $claim->attempts >= self::CLAIM_MAX_ATTEMPTS) {
                return ['ok' => false, 'reason' => 'claim_locked'];
            }

            $claim->forceFill(['attempts' => (int) $claim->attempts + 1])->save();
            if (! Hash::check((string) $payload['code'], (string) $claim->code_hash)) {
                return [
                    'ok' => false,
                    'reason' => (int) $claim->attempts >= self::CLAIM_MAX_ATTEMPTS ? 'claim_locked' : 'code_invalid',
                ];
            }

            $entitlement = CustomerBillingEntitlement::query()
                ->whereKey((int) $claim->entitlement_id)
                ->lockForUpdate()
                ->first();
            if (! $this->entitlementCanBeClaimedBy($entitlement, $admin, (string) $claim->provider_order_id)) {
                return ['ok' => false, 'reason' => 'entitlement_unavailable'];
            }

            $verifiedAt = now();
            $entitlement->forceFill([
                'admin_id' => (int) $admin->id,
                'claimed_at' => $verifiedAt,
            ])->save();
            $admin->forceFill([
                'email_verified_at' => $verifiedAt,
                'password' => $pendingPasswordHash,
                'status' => 'active',
            ])->save();
            $claim->forceFill(['used_at' => $verifiedAt])->save();

            CustomerEmailClaim::query()
                ->where('admin_id', (int) $admin->id)
                ->whereKeyNot($claim->getKey())
                ->whereNull('used_at')
                ->update(['expires_at' => $verifiedAt, 'updated_at' => $verifiedAt]);

            return ['ok' => true, 'reason' => '', 'admin' => $admin->refresh()];
        }, 3);

        if (! $result['ok'] || ! ($result['admin'] ?? null) instanceof Admin) {
            return back()->withErrors(['code' => $this->claimFailureMessage($result['reason'])]);
        }

        /** @var Admin $admin */
        $admin = $result['admin'];
        Auth::guard('admin')->login($admin, true);
        $request->session()->regenerate();
        $request->session()->forget([
            'customer_pending_claim_admin_id',
            'customer_pending_claim_email',
            'customer_pending_claim_password_hash',
        ]);

        return redirect()
            ->to(secure_url('/dashboard/start'))
            ->with('message', __('customer.claim_verified'));
    }

    public function resendVerification(Request $request): RedirectResponse
    {
        $pendingAdminId = (int) $request->session()->get('customer_pending_claim_admin_id', 0);
        if ($pendingAdminId < 1) {
            return redirect()->route('customer.signup')
                ->withErrors(['email' => __('customer.claim_session_expired')]);
        }

        /** @var array{ok:bool,reason:string,retry_after?:int,entitlement?:CustomerBillingEntitlement,claim?:CustomerEmailClaim,code?:string} $result */
        $result = DB::transaction(function () use ($pendingAdminId): array {
            $admin = Admin::query()->whereKey($pendingAdminId)->lockForUpdate()->first();
            if (! $admin instanceof Admin
                || (string) $admin->role !== 'customer'
                || (string) $admin->status !== 'pending_email_verification'
                || $admin->email_verified_at !== null) {
                return ['ok' => false, 'reason' => 'session_invalid'];
            }

            $latestClaim = CustomerEmailClaim::query()
                ->where('admin_id', (int) $admin->id)
                ->latest('created_at')
                ->lockForUpdate()
                ->first();
            if (! $latestClaim instanceof CustomerEmailClaim) {
                return ['ok' => false, 'reason' => 'claim_missing'];
            }

            $entitlement = CustomerBillingEntitlement::query()
                ->whereKey((int) $latestClaim->entitlement_id)
                ->lockForUpdate()
                ->first();
            if (! $this->entitlementCanBeClaimedBy($entitlement, $admin, (string) $latestClaim->provider_order_id)) {
                return ['ok' => false, 'reason' => 'entitlement_unavailable'];
            }

            if ($latestClaim->last_sent_at !== null) {
                $canResendAt = $latestClaim->last_sent_at->copy()->addMinutes(self::CLAIM_RESEND_COOLDOWN_MINUTES);
                if ($canResendAt->isFuture()) {
                    return [
                        'ok' => false,
                        'reason' => 'resend_cooldown',
                        'retry_after' => max(1, now()->diffInSeconds($canResendAt)),
                    ];
                }
            }

            $sentToday = CustomerEmailClaim::query()
                ->where('admin_id', (int) $admin->id)
                ->whereNotNull('last_sent_at')
                ->where('last_sent_at', '>=', now()->subDay())
                ->count();
            if ($sentToday >= self::CLAIM_SENDS_PER_DAY) {
                return ['ok' => false, 'reason' => 'resend_daily_limit'];
            }

            [$claim, $code] = $this->createClaim($admin, $entitlement);

            return compact('entitlement', 'claim', 'code') + ['ok' => true, 'reason' => ''];
        }, 3);

        if (! $result['ok']) {
            $message = $result['reason'] === 'resend_cooldown'
                ? __('customer.resend_too_fast', ['minutes' => (int) ceil(((int) ($result['retry_after'] ?? 60)) / 60)])
                : $this->claimFailureMessage($result['reason']);

            return back()->withErrors(['code' => $message]);
        }

        $sent = $this->sendClaimEmail($result['entitlement'], $result['claim'], (string) $result['code']);
        if (! $sent) {
            return back()->withErrors([
                'code' => __('customer.resend_delivery_failed'),
            ]);
        }

        return back()->with('message', __('customer.new_code_sent'));
    }

    /**
     * @return array{0:CustomerEmailClaim,1:string}
     */
    private function createClaim(Admin $admin, CustomerBillingEntitlement $entitlement): array
    {
        $now = now();
        CustomerEmailClaim::query()
            ->where('admin_id', (int) $admin->id)
            ->whereNull('used_at')
            ->update(['expires_at' => $now, 'updated_at' => $now]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $claim = CustomerEmailClaim::query()->create([
            'admin_id' => (int) $admin->id,
            'entitlement_id' => (int) $entitlement->id,
            'provider_order_id' => trim((string) $entitlement->provider_order_id),
            'code_hash' => Hash::make($code),
            'expires_at' => $now->copy()->addMinutes(self::CLAIM_TTL_MINUTES),
            'attempts' => 0,
            'last_sent_at' => $now,
            'used_at' => null,
        ]);

        return [$claim, $code];
    }

    private function sendClaimEmail(
        CustomerBillingEntitlement $entitlement,
        CustomerEmailClaim $claim,
        string $code
    ): bool {
        try {
            // Contract: sendEmailClaim(email, exact order id, claim UUID, six-digit code).
            // The bridge/Worker owns the fixed template and canonical recipient lookup.
            $result = $this->launchPackFulfillmentBridge->sendEmailClaim(
                strtolower(trim((string) $entitlement->email)),
                trim((string) $entitlement->provider_order_id),
                (string) $claim->id,
                $code
            );

            return (bool) ($result['ok'] ?? false);
        } catch (\Throwable) {
            return false;
        }
    }

    private function entitlementCanBeClaimedBy(
        ?CustomerBillingEntitlement $entitlement,
        Admin $admin,
        string $expectedOrderId
    ): bool {
        if (! $entitlement instanceof CustomerBillingEntitlement) {
            return false;
        }

        return strtolower(trim((string) $entitlement->email)) === strtolower(trim((string) $admin->email))
            && trim((string) $entitlement->provider_order_id) !== ''
            && hash_equals(trim($expectedOrderId), trim((string) $entitlement->provider_order_id))
            && in_array(strtolower(trim((string) $entitlement->billing_status)), self::ACTIVE_PAID_STATUSES, true)
            && in_array(strtolower(trim((string) $entitlement->plan_code)), self::ELIGIBLE_PLANS, true)
            && ($entitlement->admin_id === null || (int) $entitlement->admin_id === (int) $admin->id);
    }

    private function pendingAdmin(Request $request): ?Admin
    {
        $adminId = (int) $request->session()->get('customer_pending_claim_admin_id', 0);
        if ($adminId < 1) {
            return null;
        }

        $admin = Admin::query()
            ->whereKey($adminId)
            ->where('role', 'customer')
            ->where('status', 'pending_email_verification')
            ->whereNull('email_verified_at')
            ->first();

        return $admin instanceof Admin ? $admin : null;
    }

    private function rememberPendingAdmin(Request $request, Admin $admin, string $pendingPasswordHash): void
    {
        $request->session()->regenerate();
        $request->session()->put([
            'customer_pending_claim_admin_id' => (int) $admin->id,
            'customer_pending_claim_email' => strtolower(trim((string) $admin->email)),
            'customer_pending_claim_password_hash' => $pendingPasswordHash,
        ]);
    }

    private function claimFailureMessage(string $reason): string
    {
        return match ($reason) {
            'code_invalid' => __('customer.code_invalid'),
            'claim_expired' => __('customer.code_expired'),
            'claim_locked' => __('customer.code_locked'),
            'resend_daily_limit' => __('customer.resend_daily_limit'),
            'entitlement_unavailable' => __('customer.entitlement_unavailable'),
            default => __('customer.claim_invalid'),
        };
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        if ($domain === '') {
            return '***';
        }

        $visible = mb_substr($local, 0, min(2, mb_strlen($local)));

        return $visible.str_repeat('*', max(3, mb_strlen($local) - mb_strlen($visible))).'@'.$domain;
    }

    /**
     * @return array{email:string,brand_name:string,brand_url:string,business_summary:string,source:string,order_id:string}
     */
    private function prefillFromRequest(Request $request): array
    {
        return [
            'email' => trim((string) $request->query('email', '')),
            'brand_name' => trim((string) $request->query('brand', $request->query('brand_name', ''))),
            'brand_url' => trim((string) $request->query('website', $request->query('brand_url', ''))),
            'business_summary' => trim((string) $request->query('business_summary', '')),
            'source' => trim((string) $request->query('source', '')),
            'order_id' => trim((string) $request->query('order', $request->query('order_id', ''))),
        ];
    }

    /**
     * @param  array<string,string>  $prefill
     */
    private function storePrefill(Request $request, array $prefill): void
    {
        $clean = array_filter($prefill, static fn (string $value): bool => trim($value) !== '');
        if ($clean !== []) {
            $request->session()->put('customer_start_prefill', $clean);
        }
    }

    private function uniqueUsername(string $email): string
    {
        $local = Str::slug(Str::before($email, '@')) ?: 'customer';
        $base = Str::limit($local, 36, '');
        $username = $base;
        $suffix = 1;

        while (Admin::query()->where('username', $username)->exists()) {
            $suffix++;
            $username = Str::limit($base, 36, '').'-'.$suffix;
        }

        return Str::limit($username, 50, '');
    }

    private function storeSelfHosted(Request $request): RedirectResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email', 'max:100'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $mailer = app(\App\Services\Customer\LocalAccountMailer::class);
        try {
            $mailer->assertConfigured();
        } catch (\RuntimeException $exception) {
            throw ValidationException::withMessages(['email' => $exception->getMessage()]);
        }
        $email = strtolower(trim($payload['email']));
        $admin = DB::transaction(function () use ($email, $payload): Admin {
            $existing = Admin::query()->whereRaw('LOWER(email) = ?', [$email])->lockForUpdate()->first();
            if ($existing instanceof Admin) {
                if ($existing->role !== 'customer' || $existing->status !== 'pending_email_verification'
                    || $existing->email_verified_at !== null || ! Hash::check($payload['password'], $existing->password)) {
                    throw ValidationException::withMessages(['email' => __('customer.account_exists')]);
                }

                return $existing;
            }

            return Admin::query()->create([
                'username' => 'local-'.Str::uuid(),
                'email' => $email,
                'password' => $payload['password'],
                'role' => 'customer',
                'status' => 'pending_email_verification',
            ]);
        });
        $url = \Illuminate\Support\Facades\URL::temporarySignedRoute('customer.local.verify', now()->addMinutes(30), [
            'id' => $admin->id,
            'email_hash' => hash('sha256', $email),
        ]);
        try {
            $mailer->send($email, 'Verify your local account', 'Verify your email within 30 minutes: '.$url);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['email' => 'Verification email could not be sent. Check your mail service and retry with the same password.']);
        }

        return redirect()->route('admin.login')->with('message', 'Check your email to activate your local account. No subscription is required.');
    }

    public function verifySelfHosted(Request $request, int $id): RedirectResponse
    {
        abort_unless(app(\App\Services\Customer\BillingEntitlementBridge::class)->isSelfHosted(), 404);
        $admin = Admin::query()->findOrFail($id);
        abort_unless($admin->role === 'customer' && $admin->status === 'pending_email_verification'
            && $admin->email_verified_at === null
            && hash_equals(hash('sha256', strtolower(trim((string) $admin->email))), (string) $request->query('email_hash')), 403);
        $admin->forceFill(['email_verified_at' => now(), 'status' => 'active'])->save();

        return redirect()->route('admin.login')->with('message', 'Email verified. Sign in to your local workspace.');
    }

    /**
     * @param  array<string,string>  $prefill
     */
    private function loginUrl(array $prefill): string
    {
        $query = array_filter([
            'email' => $prefill['email'] ?? '',
            'brand' => $prefill['brand_name'] ?? '',
            'website' => $prefill['brand_url'] ?? '',
            'source' => $prefill['source'] ?? '',
            'order' => $prefill['order_id'] ?? '',
            'intended' => route('customer.start', absolute: false),
        ], static fn (string $value): bool => trim($value) !== '');

        return route('admin.login', $query);
    }
}

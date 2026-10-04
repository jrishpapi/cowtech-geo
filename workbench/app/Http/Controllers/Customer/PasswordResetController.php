<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Models\CustomerBillingEntitlement;
use App\Services\Customer\LaunchPackFulfillmentBridge;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class PasswordResetController extends Controller
{
    private const CODE_TTL_MINUTES = 10;

    public function __construct(
        private readonly LaunchPackFulfillmentBridge $bridge
    ) {}

    public function showForgot(): View|RedirectResponse
    {
        if (Auth::guard('admin')->check()) {
            return redirect()->route('customer.dashboard');
        }

        return view('customer.forgot-password');
    }

    public function sendCode(Request $request): RedirectResponse
    {
        $payload = $request->validate(['email' => ['required', 'email', 'max:100']]);
        $email = strtolower(trim((string) $payload['email']));
        $request->session()->put('customer_password_reset_email', $email);

        $admin = Admin::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('role', 'customer')
            ->where('status', 'active')
            ->first();
        $entitlement = $admin instanceof Admin
            ? CustomerBillingEntitlement::query()
                ->where('admin_id', (int) $admin->id)
                ->whereIn('billing_status', ['active', 'paid'])
                ->whereNotNull('provider_order_id')
                ->latest('updated_at')
                ->first()
            : null;

        $selfHosted = app(\App\Services\Customer\BillingEntitlementBridge::class)->isSelfHosted();
        if ($admin instanceof Admin && ($selfHosted || $entitlement instanceof CustomerBillingEntitlement)) {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email],
                ['token' => Hash::make($code), 'created_at' => now()]
            );
            if ($selfHosted) {
                try {
                    app(\App\Services\Customer\LocalAccountMailer::class)->send($email, 'Reset your password', 'Your reset code (valid for 10 minutes): '.$code);
                    $result = ['ok' => true];
                } catch (\Throwable) {
                    $result = ['ok' => false];
                }
            } else {
                $result = $this->bridge->sendEmailClaim(
                $email,
                trim((string) $entitlement->provider_order_id),
                (string) Str::uuid(),
                $code,
                'password_reset'
            );
            }
            if (! ($result['ok'] ?? false)) {
                DB::table('password_reset_tokens')->where('email', $email)->delete();
            }
        }

        return redirect()->route('customer.password.reset')
            ->with('message', 'If the customer account exists, a six-digit reset code has been sent.');
    }

    public function showReset(Request $request): View
    {
        return view('customer.reset-password', [
            'email' => trim((string) $request->session()->get('customer_password_reset_email', $request->query('email', ''))),
        ]);
    }

    public function reset(Request $request): RedirectResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email', 'max:100'],
            'code' => ['required', 'regex:/^[0-9]{6}$/'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        $email = strtolower(trim((string) $payload['email']));
        $token = DB::table('password_reset_tokens')->where('email', $email)->first();
        $admin = Admin::query()
            ->whereRaw('LOWER(email) = ?', [$email])
            ->where('role', 'customer')
            ->where('status', 'active')
            ->first();
        $fresh = $token && $token->created_at && now()->diffInMinutes($token->created_at) <= self::CODE_TTL_MINUTES;

        if (! $fresh || ! $admin instanceof Admin || ! Hash::check((string) $payload['code'], (string) $token->token)) {
            throw ValidationException::withMessages(['code' => 'The reset code is invalid or expired.']);
        }

        DB::transaction(function () use ($admin, $email, $payload): void {
            $admin->forceFill(['password' => (string) $payload['password']])->save();
            DB::table('password_reset_tokens')->where('email', $email)->delete();
        });

        Auth::guard('admin')->login($admin, true);
        $request->session()->regenerate();
        $request->session()->forget('customer_password_reset_email');

        return redirect()->route('customer.dashboard')->with('message', 'Your password has been reset.');
    }
}

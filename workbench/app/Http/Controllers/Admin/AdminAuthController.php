<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use App\Support\AdminActivityLogger;
use App\Support\AdminWeb;
use App\Support\GeoFlow\AdminLoginLockService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\View\View;

/**
 * Blade 后台会话登录/退出/语言切换（替代 bak/admin/index.php、logout.php）。
 */
class AdminAuthController extends Controller
{
    public function __construct(
        private readonly AdminLoginLockService $adminLoginLockService
    ) {}

    public function showLoginForm(Request $request): View|RedirectResponse
    {
        $this->storeCustomerStartPrefill($request);

        if (Auth::guard('admin')->check()) {
            return redirect()->to($this->intendedAfterAuth($request));
        }

        return view('admin.auth.login', [
            'adminSiteName' => AdminWeb::siteName(),
            'prefillUsername' => trim((string) $request->query('email', '')),
            'signupUrl' => route('customer.signup', array_filter([
                'email' => trim((string) $request->query('email', '')),
                'brand' => trim((string) $request->query('brand', '')),
                'website' => trim((string) $request->query('website', '')),
                'source' => trim((string) $request->query('source', '')),
                'order' => trim((string) $request->query('order', '')),
            ], static fn (string $value): bool => $value !== '')),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'username' => ['required', 'string', 'max:50'],
            'password' => ['required', 'string'],
        ]);
        $login = trim((string) $credentials['username']);
        $this->storeCustomerStartPrefill($request);

        /** @var Admin|null $targetAdmin */
        $targetAdmin = Admin::query()
            ->where('username', $login)
            ->orWhere('email', strtolower($login))
            ->first();
        $username = $targetAdmin instanceof Admin ? (string) $targetAdmin->username : $login;
        if ($targetAdmin instanceof Admin && $this->adminLoginLockService->isLocked($targetAdmin)) {
            return back()->withErrors([
                'username' => __('admin.login.error.account_locked'),
            ])->onlyInput('username');
        }

        // 后台以长期维护为主，默认保持登录 30 天，避免频繁掉线影响管理操作。
        $remember = $request->has('remember') ? $request->boolean('remember') : true;

        if (! Auth::guard('admin')->attempt(
            ['username' => $username, 'password' => $credentials['password'], 'status' => 'active'],
            $remember
        )) {
            if ($targetAdmin instanceof Admin && $this->adminLoginLockService->recordFailedAttemptAndLock($targetAdmin)) {
                return back()->withErrors([
                    'username' => __('admin.login.error.account_locked'),
                ])->onlyInput('username');
            }

            return back()->withErrors([
                'username' => __('admin.login.error.invalid_credentials'),
            ])->onlyInput('username');
        }

        /** @var Admin $admin */
        $admin = Auth::guard('admin')->user();
        $request->session()->regenerate();
        $this->adminLoginLockService->clearFailedAttempts((string) $admin->username);

        $admin->forceFill(['last_login' => now()])->save();
        AdminActivityLogger::logFromRequest($request, $admin, 'auth:login', [
            'username' => (string) $admin->username,
        ]);

        return redirect()->intended($this->intendedAfterAuth($request));
    }

    public function logout(Request $request): RedirectResponse
    {
        /** @var Admin|null $admin */
        $admin = Auth::guard('admin')->user();
        if ($admin instanceof Admin) {
            AdminActivityLogger::logFromRequest($request, $admin, 'auth:logout', [
                'username' => (string) $admin->username,
            ]);
        }

        Auth::guard('admin')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }

    public function switchLocale(Request $request, string $locale): RedirectResponse
    {
        if (! AdminWeb::isSupportedLocale($locale)) {
            $locale = 'zh_CN';
        }
        $request->session()->put('locale', $locale);
        app()->setLocale($locale);

        return redirect()->back();
    }

    private function intendedAfterAuth(Request $request): string
    {
        $intended = trim((string) $request->query('intended', ''));
        if ($intended !== '' && str_starts_with($intended, '/') && ! str_starts_with($intended, '//')) {
            return $intended;
        }

        if ($request->session()->has('customer_start_prefill')) {
            return route('customer.start');
        }

        return route('customer.dashboard');
    }

    private function storeCustomerStartPrefill(Request $request): void
    {
        $prefill = array_filter([
            'email' => trim((string) $request->query('email', '')),
            'brand_name' => trim((string) $request->query('brand', $request->query('brand_name', ''))),
            'brand_url' => trim((string) $request->query('website', $request->query('brand_url', ''))),
            'source' => trim((string) $request->query('source', '')),
            'order_id' => trim((string) $request->query('order', $request->query('order_id', ''))),
        ], static fn (string $value): bool => $value !== '');

        if ($prefill !== []) {
            $request->session()->put('customer_start_prefill', $prefill);
        }
    }
}

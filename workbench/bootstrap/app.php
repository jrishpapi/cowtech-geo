<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

use App\Exceptions\ApiException;
use App\Http\Middleware\AdminWebLocale;
use App\Http\Middleware\AssignApiRequestId;
use App\Http\Middleware\AuthenticateAdminWeb;
use App\Http\Middleware\AuthenticateApiToken;
use App\Http\Middleware\EnsureApiScope;
use App\Http\Middleware\EnsureStaffAdmin;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\LogAdminActivity;
use App\Http\Middleware\RecordSiteViewLog;
use App\Http\Middleware\SiteWebLocale;
use App\Http\Middleware\TrustProxies;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO
                | Request::HEADER_X_FORWARDED_PREFIX,
        );
        // Keep Laravel's standard stateful web protections. Authentication
        // identifies the session; CSRF independently proves form intent.
        $middleware->group('web', [
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            \Illuminate\View\Middleware\ShareErrorsFromSession::class,
            \Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
        ]);

        $middleware->alias([
            'api.request_id' => AssignApiRequestId::class,
            'api.auth' => AuthenticateApiToken::class,
            'api.scope' => EnsureApiScope::class,
            'admin.auth' => AuthenticateAdminWeb::class,
            'admin.staff' => EnsureStaffAdmin::class,
            'admin.locale' => AdminWebLocale::class,
            'site.locale' => SiteWebLocale::class,
            'site.view_log' => RecordSiteViewLog::class,
            'admin.super' => EnsureSuperAdmin::class,
            'admin.activity' => LogAdminActivity::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*')) { return null; }
            $adminPrefix = trim((string) config('geoflow.admin_base_path', '/geo_admin'), '/');
            if (! $request->is($adminPrefix.'/*')) { return null; }
            if (! $e->getPrevious() instanceof ModelNotFoundException) { return null; }
            return response()->view('admin.errors.not-found', ['pageTitle' => __('admin.common.not_found_title'), 'activeMenu' => '', 'adminSiteName' => config('app.name')], 404);
        });

        $exceptions->render(function (ApiException $e, Request $request) {
            if (! $request->is('api/*')) { return null; }
            $rid = (string) ($request->attributes->get('request_id') ?? Str::uuid()->toString());
            return ApiResponse::error($e->getErrorCode(), $e->getMessage(), $rid, $e->getHttpStatus(), $e->getDetails())->withHeaders(['X-Request-Id' => $rid]);
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*') || $e instanceof ApiException) { return null; }
            Log::error($e->getMessage(), ['exception' => $e::class, 'file' => $e->getFile(), 'line' => $e->getLine()]);
            $rid = (string) ($request->attributes->get('request_id') ?? Str::uuid()->toString());
            return ApiResponse::error('internal_error', '服务器内部错误', $rid, 500)->withHeaders(['X-Request-Id' => $rid]);
        });
    })->create();

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keep customer accounts out of the operator administration surface.
 *
 * Customer and operator accounts intentionally share the `admin` guard for
 * authentication, so every operator route must also enforce a staff role.
 */
class EnsureStaffAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $admin = $request->user('admin');
        $role = strtolower(trim((string) ($admin?->role ?? '')));

        if (! in_array($role, ['admin', 'super_admin', 'superadmin'], true)) {
            abort(403);
        }

        return $next($request);
    }
}

<?php

namespace App\Http\Controllers\Api;

require_once __DIR__.'/../../../Services/Customer/BillingEntitlementBridge.php';

use App\Http\Controllers\Controller;
use App\Services\Customer\BillingEntitlementBridge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayPalEntitlementController extends Controller
{
    public function __invoke(Request $request, BillingEntitlementBridge $bridge): JsonResponse
    {
        $expected = trim((string) config('services.cowtech.entitlement_bridge_secret', ''));
        $provided = trim((string) $request->header('X-CowTech-Entitlement-Secret', ''));
        $bearer = trim((string) $request->bearerToken());

        if ($expected === '' || (! hash_equals($expected, $provided) && ! hash_equals($expected, $bearer))) {
            return response()->json(['ok' => false, 'error' => 'unauthorized'], 401);
        }

        try {
            return response()->json([
                'ok' => true,
                'bridge' => $bridge->apply($request->all()),
            ]);
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['ok' => false, 'error' => $exception->getMessage()], 422);
        }
    }
}

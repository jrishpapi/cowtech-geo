<?php

namespace App\Http\Controllers\Api;

require_once __DIR__.'/../../../Services/Customer/BillingAddonBridge.php';

use App\Http\Controllers\Controller;
use App\Services\Customer\BillingAddonBridge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayPalAddonController extends Controller
{
    public function __invoke(Request $request, BillingAddonBridge $bridge): JsonResponse
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

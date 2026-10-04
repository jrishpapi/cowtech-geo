<?php

namespace App\Services\Customer;

use Illuminate\Support\Facades\Http;

class AivglRetestScheduler
{
    /**
     * @return array<string,mixed>
     */
    public function run(?string $dueAt = null, int $limit = 3): array
    {
        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            throw new \RuntimeException('AIVGL base URL is not configured.');
        }

        $providerMode = \App\Support\GeoFlow\ProviderConfiguration::requireMode('services.aivgl.customer_provider_mode');
        $allowPaidProvider = (bool) config('services.aivgl.customer_allow_paid_provider', false);
        $payload = [
            'due_at' => $dueAt ?: now()->toIso8601String(),
            'limit' => max(1, min(100, $limit)),
            'provider_mode' => $providerMode,
            'allow_paid_provider' => $allowPaidProvider,
            'external_customer_id_prefix' => 'cowtech-admin-',
        ];

        $token = trim((string) config('services.aivgl.internal_admin_token', ''));
        $request = Http::timeout(max(10, min(600, (int) config('services.aivgl.retest_timeout_seconds', 180))))
            ->acceptJson()
            ->asJson();
        if ($token !== '') {
            $request = $request->withHeaders(['X-Internal-Admin-Token' => $token]);
        }

        $response = $request->post($baseUrl.'/dashboard/retests/run-due', $payload);
        if (! $response->ok() || $response->json('ok') !== true) {
            throw new \RuntimeException('AIVGL due retest failed: '.$response->status().' '.$response->body());
        }

        return [
            'status' => 'completed',
            'provider_mode' => $providerMode,
            'allow_paid_provider' => $allowPaidProvider,
            'result' => is_array($response->json('result')) ? $response->json('result') : [],
        ];
    }
}

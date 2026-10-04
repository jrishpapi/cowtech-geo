<?php

namespace App\Services\Customer;

use App\Models\CustomerWorkspace;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class GodModeDeliverableBridge
{
    public function item(CustomerWorkspace $workspace, string $itemId): Response
    {
        return $this->request($workspace)
            ->acceptJson()
            ->get($this->itemUrl($itemId), [
                'run_id' => $this->trackingRunId($workspace),
            ]);
    }

    public function download(CustomerWorkspace $workspace, string $itemId, string $format): Response
    {
        if (! in_array($format, ['md', 'pdf'], true)) {
            throw new \InvalidArgumentException('Unsupported God Mode report format.');
        }

        return $this->request($workspace)
            ->get($this->itemUrl($itemId).'/exports/'.$format, [
                'run_id' => $this->trackingRunId($workspace),
            ]);
    }

    private function request(CustomerWorkspace $workspace): \Illuminate\Http\Client\PendingRequest
    {
        $token = trim((string) config('services.aivgl.internal_admin_token', ''));
        $this->trackingRunId($workspace);
        if ($this->baseUrl() === '' || $token === '') {
            throw new \RuntimeException('God Mode report bridge is not configured.');
        }

        return Http::timeout(max(15, (int) config('services.aivgl.timeout_seconds', 4)))
            ->withHeaders([
                'X-Internal-Admin-Token' => $token,
                'X-Content-Type-Options' => 'nosniff',
            ]);
    }

    private function itemUrl(string $itemId): string
    {
        if (! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $itemId)) {
            throw new \InvalidArgumentException('Invalid God Mode report item.');
        }

        return $this->baseUrl().'/internal/ops/control-center/monthly-fulfillment-items/'.$itemId;
    }

    private function trackingRunId(CustomerWorkspace $workspace): string
    {
        $trackingRunId = trim((string) $workspace->aivgl_tracking_run_id);
        if ($trackingRunId === '') {
            throw new \RuntimeException('Customer tracking run is not configured.');
        }

        return $trackingRunId;
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.aivgl.base_url', ''), '/');
    }
}

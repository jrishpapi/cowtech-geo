<?php

namespace App\Jobs;

use App\Models\CustomerLaunchPackFulfillment;
use App\Services\Customer\AivglDashboardClient;
use App\Services\Customer\LaunchPackFulfillmentBridge;
use App\Services\Customer\LaunchPackOrchestrator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class GenerateCustomerLaunchPackJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;
    public int $timeout = 120;

    public function __construct(public readonly int $fulfillmentId) {}

    public function handle(
        AivglDashboardClient $dashboardClient,
        LaunchPackFulfillmentBridge $launchPackBridge,
        LaunchPackOrchestrator $orchestrator,
    ): void {
        $fulfillment = CustomerLaunchPackFulfillment::query()
            ->with(['workspace', 'entitlement'])
            ->find($this->fulfillmentId);
        if (! $fulfillment instanceof CustomerLaunchPackFulfillment || (string) $fulfillment->state !== 'queued') {
            return;
        }

        $workspace = $fulfillment->workspace;
        $entitlement = $fulfillment->entitlement;
        if ($workspace === null || $entitlement === null) {
            $orchestrator->scheduleRetry($fulfillment, 'fulfillment_context_missing', 'Workspace or entitlement is missing.');
            return;
        }

        $fulfillment->forceFill([
            'state' => 'generating',
            'attempt_count' => (int) $fulfillment->attempt_count + 1,
            'last_attempt_at' => now(),
        ])->save();

        try {
            $snapshot = $dashboardClient->snapshot($workspace);
            $visibility = data_get($snapshot, 'scores.visibility');
            if (($snapshot['connected'] ?? false) !== true || ! is_numeric($visibility)) {
                throw new \RuntimeException('AIVGL baseline is not complete or measurable.');
            }
            $diagnosis = $this->diagnosisPayload($workspace->aivgl_tracking_run_id, $snapshot);
            $fulfillment->forceFill(['baseline_snapshot_json' => $diagnosis])->save();

            $response = $launchPackBridge->trigger([
                'email' => (string) $fulfillment->email,
                'order_id' => (string) $fulfillment->order_id,
                'brand_name' => (string) $workspace->brand_name,
                'brand_url' => (string) $workspace->brand_url,
                'business_summary' => trim((string) $workspace->business_summary) !== ''
                    ? (string) $workspace->business_summary
                    : trim((string) $workspace->brand_name).' provides '.(trim((string) $workspace->target_market) ?: 'its submitted services').'.',
                'target_market' => trim((string) $workspace->target_market) ?: 'general business',
                'competitors' => $snapshot['configured_competitors'] ?? (string) $workspace->competitors_text,
                'target_prompts' => (string) $workspace->target_prompts_text,
                'diagnosis' => $diagnosis,
            ]);
            if (($response['ok'] ?? false) !== true) {
                throw new \RuntimeException('Launch Pack queue rejected the request: '.($response['status'] ?? 'unknown'));
            }

            $workerStatus = (string) ($response['status'] ?? '');
            $state = match ($workerStatus) {
                'ready' => 'ready',
                'review_required' => 'review_required',
                default => 'queued',
            };
            $fulfillment->forceFill([
                'state' => $state,
                'completed_at' => $state === 'ready' ? now() : null,
                'last_error_code' => $state === 'review_required' ? 'content_quality_review_required' : null,
                'last_error_message' => $state === 'review_required'
                    ? 'Launch Pack evidence or content quality did not meet the delivery gate.'
                    : null,
            ])->save();
        } catch (Throwable $exception) {
            $orchestrator->scheduleRetry($fulfillment, 'launch_pack_dispatch_failed', $exception->getMessage());
        }
    }

    /** @return array<string,mixed> */
    private function diagnosisPayload(string $runId, array $snapshot): array
    {
        $opportunities = collect($snapshot['raw_opportunities'] ?? [])->filter(fn ($item): bool => is_array($item));
        $evidenceRecords = collect($snapshot['evidence_records'] ?? [])->filter(fn ($item): bool => is_array($item));
        $sources = $evidenceRecords
            ->flatMap(fn (array $item): array => is_array($item['sources'] ?? null) ? $item['sources'] : [])
            ->filter(fn ($item): bool => is_array($item) && trim((string) ($item['url'] ?? '')) !== '')
            ->unique(fn (array $item): string => strtolower(trim((string) $item['url'])))
            ->take(100)
            ->values();
        return [
            'baseline_run_id' => $runId,
            'generated_at' => $snapshot['generated_at'] ?? now()->toIso8601String(),
            'scores' => $snapshot['scores'] ?? [],
            'source_gaps' => collect($snapshot['next_actions'] ?? [])->map(fn ($item): string => trim((string) ($item['title'] ?? $item['action'] ?? $item['description'] ?? '')))->filter()->take(12)->values()->all(),
            'competitor_gaps' => $opportunities->filter(function (array $item): bool {
                $text = strtolower((string) ($item['opportunity_type'] ?? $item['type'] ?? '').' '.(string) ($item['title'] ?? ''));
                return str_contains($text, 'competitor');
            })->map(fn (array $item): string => trim((string) ($item['title'] ?? $item['description'] ?? $item['recommended_action'] ?? '')))->filter()->take(12)->values()->all(),
            'opportunities' => $opportunities->map(fn (array $item): array => [
                'title' => (string) ($item['title'] ?? $item['opportunity_type'] ?? 'AIVGL opportunity'),
                'detail' => (string) ($item['impact'] ?? $item['description'] ?? $item['recommended_action'] ?? ''),
            ])->take(12)->values()->all(),
            'sources' => $sources->map(fn (array $item): array => [
                'title' => (string) ($item['source_name'] ?? $item['domain'] ?? ''),
                'detail' => (string) ($item['source_type'] ?? ''),
                'source' => (string) ($item['url'] ?? ''),
            ])->all(),
            'evidence_records' => $evidenceRecords->take(200)->values()->all(),
            'measurement' => is_array($snapshot['measurement'] ?? null) ? $snapshot['measurement'] : [],
            'configured_competitors' => collect($snapshot['configured_competitors'] ?? [])->filter(fn ($item): bool => is_array($item))->take(10)->values()->all(),
        ];
    }
}

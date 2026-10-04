<?php

namespace App\Services\Customer;

use App\Jobs\GenerateCustomerLaunchPackJob;
use App\Models\CustomerBillingEntitlement;
use App\Models\CustomerLaunchPackFulfillment;
use App\Models\CustomerWorkspace;
use Illuminate\Support\Facades\DB;

class LaunchPackOrchestrator
{
    public function __construct(
        private readonly CustomerOnboardingService $onboardingService,
        private readonly LaunchPackFulfillmentBridge $launchPackBridge,
    ) {}

    /** @return array{scanned:int,dispatched:int,ready:int,retrying:int,downgraded:int} */
    public function reconcile(int $limit = 20): array
    {
        $result = ['scanned' => 0, 'dispatched' => 0, 'ready' => 0, 'retrying' => 0, 'downgraded' => 0];
        $reconcilableStates = [
            'baseline_running',
            'baseline_ready',
            'queued',
            'generating',
            'quality_check',
            'retry_scheduled',
            'ready',
        ];
        $workspaces = CustomerWorkspace::query()
            ->with('admin')
            ->whereNotNull('admin_id')
            ->whereNotNull('aivgl_tracking_run_id')
            ->where(function ($query) use ($reconcilableStates): void {
                $query
                    ->whereDoesntHave('launchPackFulfillments')
                    ->orWhereHas(
                        'launchPackFulfillments',
                        fn ($fulfillments) => $fulfillments->whereIn('state', $reconcilableStates)
                    );
            })
            ->orderBy(
                CustomerLaunchPackFulfillment::query()
                    ->select('updated_at')
                    ->whereColumn('workspace_id', 'customer_workspaces.id')
                    ->latest('id')
                    ->limit(1)
            )
            ->limit(max(1, min(100, $limit)))
            ->get();

        foreach ($workspaces as $workspace) {
            $result['scanned']++;
            $admin = $workspace->admin;
            if ($admin === null) {
                continue;
            }
            $entitlement = CustomerBillingEntitlement::query()
                ->where('admin_id', (int) $admin->id)
                ->whereIn('plan_code', ['launch', 'starter', 'pro', 'god'])
                ->whereIn('billing_status', ['active', 'paid', 'trial'])
                ->whereNotNull('provider_order_id')
                ->latest('id')
                ->first();
            if (! $entitlement instanceof CustomerBillingEntitlement) {
                continue;
            }

            $workspace = $this->onboardingService->refreshDiagnosisStatus($workspace);
            $fulfillment = $this->recordFor($workspace, $entitlement);
            if ((string) $workspace->status !== 'diagnosis_ready') {
                continue;
            }

            if ((string) $fulfillment->state === 'baseline_running') {
                $fulfillment->forceFill([
                    'state' => 'baseline_ready',
                    'baseline_run_id' => (string) $workspace->aivgl_tracking_run_id,
                    'last_error_code' => null,
                    'last_error_message' => null,
                ])->save();
            }

            if (in_array((string) $fulfillment->state, ['queued', 'generating', 'quality_check', 'ready'], true)) {
                $status = $this->launchPackBridge->statusForEmail($fulfillment->email, $fulfillment->order_id);
                $workerState = (string) data_get($status, 'launch_pack.fulfillment_status', '');
                if ($workerState === 'ready' && data_get($status, 'launch_pack.files_ready') === true) {
                    if ((string) $fulfillment->state === 'ready') {
                        $fulfillment->touch();
                    } else {
                        $fulfillment->forceFill([
                            'state' => 'ready',
                            'completed_at' => now(),
                            'next_attempt_at' => null,
                            'last_error_code' => null,
                            'last_error_message' => null,
                        ])->save();
                    }
                    $result['ready']++;
                    continue;
                }
                if ($workerState === 'failed') {
                    $this->scheduleRetry($fulfillment, 'worker_failed', 'Launch Pack Worker reported a failed generation.');
                    $result['retrying']++;
                    continue;
                }
                if ($workerState === 'review_required') {
                    $wasReady = (string) $fulfillment->state === 'ready';
                    $fulfillment->forceFill([
                        'state' => 'review_required',
                        'completed_at' => null,
                        'next_attempt_at' => null,
                        'last_error_code' => 'content_quality_review_required',
                        'last_error_message' => 'Launch Pack evidence or content quality did not meet the delivery gate.',
                    ])->save();
                    if ($wasReady) {
                        $result['downgraded']++;
                    }
                    continue;
                }
                if ($workerState === 'generating' && (string) $fulfillment->state !== 'generating') {
                    $wasReady = (string) $fulfillment->state === 'ready';
                    $fulfillment->forceFill(['state' => 'generating', 'completed_at' => null])->save();
                    if ($wasReady) {
                        $result['downgraded']++;
                    }
                }
                if (
                    (string) $fulfillment->state === 'ready'
                    && (bool) ($status['ok'] ?? false)
                    && ($workerState !== 'ready' || data_get($status, 'launch_pack.files_ready') !== true)
                ) {
                    $fulfillment->forceFill([
                        'state' => 'review_required',
                        'completed_at' => null,
                        'next_attempt_at' => null,
                        'last_error_code' => 'worker_delivery_state_mismatch',
                        'last_error_message' => 'The canonical Worker delivery is not downloadable and requires review.',
                    ])->save();
                    $result['downgraded']++;
                    continue;
                }
                $staleMinutes = (string) $fulfillment->state === 'queued' ? 5 : 15;
                if ($fulfillment->updated_at?->lt(now()->subMinutes($staleMinutes))
                    && ! in_array($workerState, ['generating', 'ready'], true)) {
                    $this->scheduleRetry(
                        $fulfillment,
                        'stale_fulfillment_recovered',
                        'A queued Launch Pack made no progress and was recovered by the reconciler.'
                    );
                    $result['retrying']++;
                    continue;
                }
            }

            if (! in_array((string) $fulfillment->state, ['baseline_ready', 'retry_scheduled'], true)) {
                continue;
            }
            if ($fulfillment->next_attempt_at !== null && $fulfillment->next_attempt_at->isFuture()) {
                continue;
            }
            if ((int) $fulfillment->attempt_count >= 3) {
                $fulfillment->forceFill(['state' => 'failed'])->save();
                continue;
            }

            $claimed = DB::transaction(function () use ($fulfillment): bool {
                $locked = CustomerLaunchPackFulfillment::query()->lockForUpdate()->find($fulfillment->id);
                if (! $locked instanceof CustomerLaunchPackFulfillment
                    || ! in_array((string) $locked->state, ['baseline_ready', 'retry_scheduled'], true)) {
                    return false;
                }
                $locked->forceFill([
                    'state' => 'queued',
                    'next_attempt_at' => null,
                    'last_error_code' => null,
                    'last_error_message' => null,
                ])->save();
                return true;
            });
            if ($claimed) {
                GenerateCustomerLaunchPackJob::dispatch((int) $fulfillment->id)->onQueue('default');
                $result['dispatched']++;
            }
        }

        return $result;
    }

    public function recordFor(CustomerWorkspace $workspace, CustomerBillingEntitlement $entitlement): CustomerLaunchPackFulfillment
    {
        $fulfillment = CustomerLaunchPackFulfillment::query()->firstOrNew([
            'order_id' => (string) $entitlement->provider_order_id,
        ]);
        if (! $fulfillment->exists) {
            $fulfillment->forceFill([
                'workspace_id' => (int) $workspace->id,
                'entitlement_id' => (int) $entitlement->id,
                'email' => strtolower(trim((string) $entitlement->email)),
                'baseline_run_id' => (string) $workspace->aivgl_tracking_run_id ?: null,
                'state' => (string) $workspace->status === 'diagnosis_ready' ? 'baseline_ready' : 'baseline_running',
            ]);
        } else {
            // The paid order id is canonical. Refresh its local ownership links so
            // a later account claim or normalized payer email cannot leave the
            // Dashboard looking up a stale fulfillment identity.
            $fulfillment->forceFill([
                'workspace_id' => (int) $workspace->id,
                'entitlement_id' => (int) $entitlement->id,
                'email' => strtolower(trim((string) $entitlement->email)),
            ]);
        }
        if (! $fulfillment->exists || $fulfillment->isDirty()) {
            $fulfillment->save();
        }

        return $fulfillment;
    }

    public function scheduleRetry(CustomerLaunchPackFulfillment $fulfillment, string $code, string $message): void
    {
        $attempts = (int) $fulfillment->attempt_count;
        $terminal = $attempts >= 3;
        $fulfillment->forceFill([
            'state' => $terminal ? 'failed' : 'retry_scheduled',
            'next_attempt_at' => $terminal ? null : now()->addMinutes(min(15, 2 ** max(0, $attempts))),
            'last_error_code' => $code,
            'last_error_message' => mb_substr($message, 0, 2000),
        ])->save();
    }
}

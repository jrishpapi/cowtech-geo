@php
    $launchPackEnvelope = is_array($launchPack ?? null) ? $launchPack : [];
    $launchPackStatusValue = is_array($launchPackStatus ?? null) ? $launchPackStatus : [];

    if (is_array($launchPackStatusValue['launch_pack'] ?? null)) {
        $launchPackStatusValue = $launchPackStatusValue['launch_pack'];
    } elseif ($launchPackStatusValue === [] && is_array($launchPackEnvelope['launch_pack'] ?? null)) {
        $launchPackStatusValue = $launchPackEnvelope['launch_pack'];
    } elseif ($launchPackStatusValue === [] && ! array_key_exists('launch_pack', $launchPackEnvelope)) {
        $launchPackStatusValue = $launchPackEnvelope;
    }

    $launchPackManifest = is_array($launchPackStatusValue['manifest'] ?? null)
        ? $launchPackStatusValue['manifest']
        : [];
    $launchPackAccess = is_array($launchPackStatusValue['access'] ?? null)
        ? $launchPackStatusValue['access']
        : [];
    $launchPackEmail = is_array($launchPackStatusValue['completion_email'] ?? null)
        ? $launchPackStatusValue['completion_email']
        : (is_array($launchPackStatusValue['email_delivery'] ?? null) ? $launchPackStatusValue['email_delivery'] : []);
    $launchPackFiles = is_array($launchPackStatusValue['files'] ?? null)
        ? $launchPackStatusValue['files']
        : (is_array($launchPackManifest['files'] ?? null) ? $launchPackManifest['files'] : []);

    $orderId = trim((string) ($launchPackStatusValue['order_id'] ?? $launchPackManifest['order_id'] ?? ''));
    $brandName = trim((string) ($launchPackStatusValue['brand'] ?? $launchPackManifest['brand'] ?? ''));
    $fulfillmentStatus = strtolower(trim((string) ($launchPackStatusValue['fulfillment_status']
        ?? $launchPackStatusValue['status']
        ?? $launchPackStatusValue['raw_status']
        ?? 'not_ready')));
    $accessStatus = strtolower(trim((string) ($launchPackStatusValue['access_status']
        ?? $launchPackAccess['status']
        ?? '')));
    $statusLabel = trim((string) ($launchPackStatusValue['status_label'] ?? ''));
    $downloadExpired = (bool) ($launchPackStatusValue['download_expired']
        ?? $launchPackAccess['expired']
        ?? false);
    $filesReady = (bool) ($launchPackStatusValue['files_ready'] ?? false);
    $downloadableValueExists = array_key_exists('downloadable', $launchPackStatusValue)
        || array_key_exists('downloadable', $launchPackAccess);
    $downloadable = (bool) ($launchPackStatusValue['downloadable']
        ?? $launchPackAccess['downloadable']
        ?? $filesReady);

    $deliveryState = match (true) {
        in_array($accessStatus, ['revoked', 'disabled'], true) => 'revoked',
        in_array($fulfillmentStatus, ['failed', 'blocked', 'error', 'review_required'], true) => 'failed',
        in_array($fulfillmentStatus, ['baseline_running', 'generating', 'processing', 'queued', 'scheduled', 'quality_check', 'retry_scheduled'], true) => 'generating',
        $downloadExpired || $accessStatus === 'expired' => 'expired',
        $accessStatus === 'active' || ($downloadable && $filesReady) => 'active',
        default => 'not-ready',
    };

    if (in_array($deliveryState, ['expired', 'failed', 'revoked', 'generating', 'not-ready'], true)) {
        $downloadable = false;
    } elseif (! $downloadableValueExists && $filesReady) {
        $downloadable = true;
    }

    $stateMeta = [
        'active' => [
            'label' => __('customer.lp_authorized'),
            'title' => __('customer.lp_active_title'),
            'description' => __('customer.lp_active_detail'),
            'icon' => 'badge-check',
        ],
        'expired' => [
            'label' => __('customer.lp_expired'),
            'title' => __('customer.lp_expired_title'),
            'description' => __('customer.lp_expired_detail'),
            'icon' => 'clock-alert',
        ],
        'generating' => [
            'label' => __('customer.lp_generating'),
            'title' => __('customer.lp_generating_title'),
            'description' => __('customer.lp_generating_detail'),
            'icon' => 'loader-circle',
        ],
        'failed' => [
            'label' => __('customer.lp_attention'),
            'title' => __('customer.lp_failed_title'),
            'description' => __('customer.lp_failed_detail'),
            'icon' => 'triangle-alert',
        ],
        'revoked' => [
            'label' => __('customer.lp_revoked'),
            'title' => __('customer.lp_revoked_title'),
            'description' => __('customer.lp_revoked_detail'),
            'icon' => 'shield-x',
        ],
        'not-ready' => [
            'label' => __('customer.lp_not_ready'),
            'title' => __('customer.lp_not_ready_title'),
            'description' => __('customer.lp_not_ready_detail'),
            'icon' => 'archive-restore',
        ],
    ];
    $currentState = $stateMeta[$deliveryState];
    $fulfillmentLabel = match ($fulfillmentStatus) {
        'ready', 'completed' => __('customer.lp_ready'),
        'baseline_running' => __('customer.lp_baseline_running'),
        'generating', 'processing', 'quality_check' => __('customer.lp_generating'),
        'queued', 'scheduled' => __('customer.lp_queued'),
        'retry_scheduled' => __('customer.lp_retry_scheduled'),
        'review_required' => __('customer.lp_review_required'),
        'failed', 'blocked', 'error' => __('customer.status_failed'),
        'paid' => __('customer.lp_awaiting_onboarding'),
        default => __('customer.lp_not_ready'),
    };
    $accessLabel = match ($deliveryState) {
        'active' => __('customer.lp_access_active'),
        'expired' => __('customer.lp_access_expired'),
        'revoked' => __('customer.lp_revoked'),
        default => __('customer.lp_access_inactive'),
    };

    $formatDate = static function ($value): array {
        $raw = trim((string) $value);
        if ($raw === '') {
            return ['iso' => '', 'label' => '—'];
        }

        try {
            $date = \Illuminate\Support\Carbon::parse($raw)->timezone((string) config('app.timezone', 'UTC'));

            return ['iso' => $date->toIso8601String(), 'label' => $date->format('Y-m-d H:i T')];
        } catch (\Throwable) {
            return ['iso' => '', 'label' => $raw];
        }
    };
    $generatedAt = $formatDate($launchPackManifest['generated_at']
        ?? $launchPackStatusValue['ready_at']
        ?? $launchPackStatusValue['created_at']
        ?? '');
    $expiresAt = $formatDate($launchPackStatusValue['download_expires_at']
        ?? $launchPackAccess['download_expires_at']
        ?? $launchPackAccess['expires_at']
        ?? '');

    $contractVersion = trim((string) ($launchPackManifest['contract_version']
        ?? $launchPackStatusValue['delivery_version']
        ?? $launchPackStatusValue['manifest_version']
        ?? '—'));
    $fileCount = (int) ($launchPackManifest['file_count'] ?? count($launchPackFiles));
    if ($fileCount < count($launchPackFiles)) {
        $fileCount = count($launchPackFiles);
    }

    $qualityGate = is_array($launchPackManifest['quality_gate'] ?? null)
        ? $launchPackManifest['quality_gate']
        : [];
    $qualityPass = ($qualityGate['pass'] ?? null) === true;
    $qualityKnown = array_key_exists('pass', $qualityGate);
    $qualityLabel = $qualityKnown ? ($qualityPass ? __('customer.lp_passed') : __('customer.status_failed')) : __('customer.lp_quality_pending');
    $deliveryReleased = in_array($fulfillmentStatus, ['ready', 'completed'], true)
        && $filesReady
        && $qualityPass;
    if (! $deliveryReleased) {
        $fileCount = 0;
    }

    $emailStatus = strtolower(trim((string) ($launchPackStatusValue['completion_email_status']
        ?? $launchPackStatusValue['email_status']
        ?? $launchPackEmail['status']
        ?? 'not_scheduled')));
    $emailStatusMeta = match ($emailStatus) {
        'sent', 'delivered' => ['label' => __('customer.lp_email_sent'), 'tone' => 'positive'],
        'queued', 'pending', 'sending' => ['label' => __('customer.lp_email_queued'), 'tone' => 'progress'],
        'failed', 'bounced' => ['label' => __('customer.lp_email_failed'), 'tone' => 'danger'],
        default => ['label' => __('customer.lp_email_unscheduled'), 'tone' => 'muted'],
    };
    $emailToneClass = match ($emailStatusMeta['tone']) {
        'positive' => 'text-[#2f6b4d]',
        'progress' => 'text-[#315f83]',
        'danger' => 'text-[#a23c32]',
        default => '',
    };
    $emailSentAt = $formatDate($launchPackStatusValue['completion_email_sent_at']
        ?? $launchPackEmail['sent_at']
        ?? '');

    $categoryLabels = [
        'delivery' => '00 · '.__('customer.lp_category_delivery'),
        'ai-crawlability' => '01 · '.__('customer.lp_category_crawl'),
        'ai-discovery' => '02 · '.__('customer.lp_category_discovery'),
        'entity-schema' => '03 · '.__('customer.lp_category_schema'),
        'content-entity' => '04 · '.__('customer.lp_category_content'),
        'technical-diagnosis' => '05 · '.__('customer.lp_category_technical'),
        'geo-analysis' => '06 · '.__('customer.lp_category_geo'),
        'action-plan' => '07 · '.__('customer.lp_category_plan'),
        'geo-deployment' => '08 · '.__('customer.lp_category_notes'),
    ];
    $fileGroups = [];
    foreach ($launchPackFiles as $fileIndex => $file) {
        if (is_string($file)) {
            $file = ['name' => $file];
        }
        if (! is_array($file)) {
            continue;
        }

        $fileName = trim((string) ($file['name'] ?? ''));
        if ($fileName === '') {
            continue;
        }

        $category = trim((string) ($file['category'] ?? '')) ?: 'other';
        $file['name'] = $fileName;
        $file['_index'] = $fileIndex;
        $fileGroups[$category][] = $file;
    }
    uksort($fileGroups, static function (string $left, string $right) use ($categoryLabels): int {
        $leftLabel = $categoryLabels[$left] ?? '99 · '.str_replace(['_', '-'], ' ', $left);
        $rightLabel = $categoryLabels[$right] ?? '99 · '.str_replace(['_', '-'], ' ', $right);

        return $leftLabel <=> $rightLabel;
    });
    if (! $deliveryReleased) {
        $fileGroups = [];
    }

    $formatBytes = static function ($value): string {
        if (! is_numeric($value) || (float) $value < 0) {
            return '—';
        }

        $bytes = (float) $value;
        if ($bytes === 0.0) {
            return '0 B';
        }
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024 || $unit === 'GB') {
                $precision = $unit === 'B' ? 0 : 1;

                return rtrim(rtrim(number_format($bytes, $precision), '0'), '.').' '.$unit;
            }
            $bytes /= 1024;
        }

        return '—';
    };

    $zipRouteAvailable = app('router')->has('customer.launch-pack.download');
    $fileRouteAvailable = app('router')->has('customer.launch-pack.files.download');
    // The standalone dossier resolves against the authenticated customer's
    // bound order. Do not advertise that route when no delivery exists: the
    // controller intentionally returns 404 for unbound accounts.
    $hasBoundDelivery = (bool) ($launchPackStatusValue['has_order'] ?? false) && $orderId !== '';
    $showRouteAvailable = $hasBoundDelivery && app('router')->has('customer.launch-pack.show');
    $resendRouteAvailable = app('router')->has('customer.launch-pack.resend');
    $canRedeliver = (bool) ($launchPackStatusValue['can_redeliver']
        ?? $launchPackStatusValue['can_resend']
        ?? $launchPackAccess['can_redeliver']
        ?? ($deliveryState === 'expired'));
    $redeliverRetryAfter = max(0, (int) ($launchPackStatusValue['redeliver_retry_after_seconds'] ?? 0));
    $redeliverWaitLabel = match (true) {
        $redeliverRetryAfter >= 7200 => __('customer.lp_hour', ['count' => (int) ceil($redeliverRetryAfter / 3600)]),
        $redeliverRetryAfter >= 120 => __('customer.lp_minute', ['count' => (int) ceil($redeliverRetryAfter / 60)]),
        $redeliverRetryAfter > 0 => __('customer.lp_second', ['count' => $redeliverRetryAfter]),
        default => '',
    };
    $lastRedeliveredAt = $formatDate($launchPackStatusValue['last_redelivered_at']
        ?? $launchPackAccess['last_redelivered_at']
        ?? '');
    $isStandalone = (bool) ($launchPackStandalone ?? false);
@endphp

@once
    @push('styles')
        <style>
            .launch-dossier {
                --lp-ink: #152019;
                --lp-forest: #203c2b;
                --lp-moss: #53725d;
                --lp-paper: #f7f5ed;
                --lp-rule: #d6d8ce;
                --lp-state: #2f6b4d;
                --lp-state-soft: #e3eee6;
                position: relative;
                overflow: hidden;
                border: 1px solid #cfd5cd;
                border-radius: 10px;
                background: var(--lp-paper);
                box-shadow: 0 24px 54px rgba(21, 32, 25, 0.09);
                color: var(--lp-ink);
            }
            .launch-dossier[data-delivery-state="expired"] { --lp-state: #976219; --lp-state-soft: #f7ead1; }
            .launch-dossier[data-delivery-state="generating"] { --lp-state: #315f83; --lp-state-soft: #e2edf5; }
            .launch-dossier[data-delivery-state="failed"] { --lp-state: #a23c32; --lp-state-soft: #f8e4df; }
            .launch-dossier[data-delivery-state="revoked"] { --lp-state: #6d4651; --lp-state-soft: #eee4e7; }
            .launch-dossier[data-delivery-state="not-ready"] { --lp-state: #68716b; --lp-state-soft: #e9ece8; }
            .launch-dossier__masthead {
                position: relative;
                isolation: isolate;
                overflow: hidden;
                background: var(--lp-forest);
                color: #f7f5ed;
            }
            .launch-dossier__masthead::after {
                position: absolute;
                inset: 0;
                z-index: -1;
                background-image: repeating-linear-gradient(112deg, transparent 0 27px, rgba(247, 245, 237, 0.055) 28px 29px);
                content: "";
            }
            .launch-dossier__folio {
                display: grid;
                min-height: 100%;
                place-content: space-between;
                border-right: 1px solid rgba(247, 245, 237, 0.18);
                padding: 1.5rem 1rem;
                color: #b9cbbb;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: .65rem;
                font-weight: 700;
                letter-spacing: .18em;
                text-transform: uppercase;
            }
            .launch-dossier__status-dot {
                width: .55rem;
                height: .55rem;
                border-radius: 999px;
                background: var(--lp-state);
                box-shadow: 0 0 0 4px color-mix(in srgb, var(--lp-state) 18%, transparent);
            }
            .launch-dossier__meta {
                display: grid;
                border-top: 1px solid var(--lp-rule);
                border-bottom: 1px solid var(--lp-rule);
                background: rgba(255, 255, 255, .56);
            }
            .launch-dossier__metric {
                min-width: 0;
                padding: 1rem 1.1rem;
                border-bottom: 1px solid var(--lp-rule);
            }
            .launch-dossier__metric dt {
                color: #6c776f;
                font-size: .65rem;
                font-weight: 700;
                letter-spacing: .13em;
                text-transform: uppercase;
            }
            .launch-dossier__metric dd {
                margin-top: .45rem;
                overflow-wrap: anywhere;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: .78rem;
                font-weight: 700;
                line-height: 1.35;
            }
            .launch-dossier__state-note {
                border-left: 4px solid var(--lp-state);
                background: var(--lp-state-soft);
            }
            .launch-dossier__button:focus-visible,
            .launch-dossier__file-link:focus-visible,
            .launch-dossier summary:focus-visible {
                outline: 3px solid color-mix(in srgb, var(--lp-state) 65%, white);
                outline-offset: 3px;
            }
            .launch-dossier__button[aria-disabled="true"] {
                cursor: not-allowed;
                opacity: .5;
            }
            .launch-dossier__group {
                overflow: hidden;
                border: 1px solid var(--lp-rule);
                border-radius: 7px;
                background: rgba(255, 255, 255, .72);
            }
            .launch-dossier__group > summary {
                display: flex;
                cursor: pointer;
                list-style: none;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                padding: 1rem 1.1rem;
                color: var(--lp-forest);
                font-size: .82rem;
                font-weight: 800;
                letter-spacing: .02em;
            }
            .launch-dossier__group > summary::-webkit-details-marker { display: none; }
            .launch-dossier__chevron { transition: transform 180ms ease; }
            .launch-dossier__group[open] .launch-dossier__chevron { transform: rotate(180deg); }
            .launch-dossier__file {
                display: grid;
                gap: .8rem;
                align-items: center;
                border-top: 1px solid #e3e4dc;
                padding: .9rem 1.1rem;
            }
            .launch-dossier__file-name {
                overflow-wrap: anywhere;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: .78rem;
                font-weight: 700;
                line-height: 1.4;
            }
            .launch-dossier__file-meta {
                color: #6c776f;
                font-size: .7rem;
                line-height: 1.45;
            }
            .launch-dossier__hash {
                color: #4f6255;
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
                font-size: .68rem;
            }
            @media (min-width: 640px) {
                .launch-dossier__meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                .launch-dossier__metric:nth-child(odd) { border-right: 1px solid var(--lp-rule); }
            }
            @media (min-width: 1024px) {
                .launch-dossier__meta { grid-template-columns: repeat(6, minmax(0, 1fr)); }
                .launch-dossier__metric { border-right: 1px solid var(--lp-rule); border-bottom: 0; }
                .launch-dossier__metric:last-child { border-right: 0; }
                .launch-dossier__file { grid-template-columns: minmax(220px, 1.5fr) minmax(150px, .8fr) minmax(130px, .65fr) auto; }
            }
            @media (prefers-reduced-motion: reduce) {
                .launch-dossier__chevron { transition: none; }
            }
        </style>
    @endpush
@endonce

<section class="launch-dossier {{ $isStandalone ? '' : 'mb-5' }}" data-delivery-state="{{ $deliveryState }}" aria-labelledby="launch-pack-title">
    <header class="launch-dossier__masthead">
        <div class="grid sm:grid-cols-[84px_minmax(0,1fr)]">
            <div class="launch-dossier__folio hidden sm:grid" aria-hidden="true">
                <span>LP / 001</span>
                <span class="[writing-mode:vertical-rl] rotate-180">{{ __('customer.lp_atlas') }}</span>
            </div>
            <div class="px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
                <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div class="max-w-3xl">
                        <div class="flex flex-wrap items-center gap-3">
                            <span class="text-xs font-semibold uppercase tracking-[0.22em] text-[#b9cbbb]">{{ __('customer.launch_pack_name') }}</span>
                            <span class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                                <span class="launch-dossier__status-dot" aria-hidden="true"></span>
                                {{ __('customer.lp_delivery') }} · {{ $fulfillmentLabel }}
                            </span>
                            <span class="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                                {{ __('customer.lp_access') }} · {{ $accessLabel }}
                            </span>
                        </div>
                        <h2 id="launch-pack-title" class="mt-5 max-w-3xl font-serif text-3xl font-semibold leading-[1.08] tracking-[-0.025em] text-white sm:text-4xl">
                            {{ $brandName !== '' ? $brandName.' · ' : '' }}{{ __('customer.lp_dossier') }}
                        </h2>
                        <p class="mt-4 max-w-2xl text-sm leading-6 text-white/[0.68] sm:text-base">
                            {{ __('customer.lp_dossier_detail') }}
                        </p>
                    </div>
                    <div class="flex shrink-0 flex-wrap gap-2">
                        @if(! $isStandalone && $showRouteAvailable)
                            <a href="{{ route('customer.launch-pack.show') }}" class="launch-dossier__button inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">
                                <i data-lucide="book-open" class="h-4 w-4" aria-hidden="true"></i>
                                {{ __('customer.lp_open_dossier') }}
                            </a>
                        @endif
                        @if($downloadable && $zipRouteAvailable)
                            <a href="{{ route('customer.launch-pack.download') }}" class="launch-dossier__button inline-flex items-center gap-2 rounded-md bg-[#f7f5ed] px-4 py-2.5 text-sm font-semibold text-[#203c2b] transition hover:bg-white">
                                <i data-lucide="archive" class="h-4 w-4" aria-hidden="true"></i>
                                {{ __('customer.lp_download_zip') }}
                            </a>
                        @else
                            <span class="launch-dossier__button inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/[0.55]" aria-disabled="true">
                                <i data-lucide="archive-x" class="h-4 w-4" aria-hidden="true"></i>
                                {{ __('customer.lp_zip_unavailable') }}
                            </span>
                        @endif
                    </div>
                </div>
            </div>
        </div>
    </header>

    <dl class="launch-dossier__meta">
        <div class="launch-dossier__metric">
            <dt>{{ __('customer.lp_generated') }}</dt>
            <dd>@if($generatedAt['iso'] !== '')<time datetime="{{ $generatedAt['iso'] }}">{{ $generatedAt['label'] }}</time>@else{{ $generatedAt['label'] }}@endif</dd>
        </div>
        <div class="launch-dossier__metric">
            <dt>{{ __('customer.lp_access_expires') }}</dt>
            <dd>@if($expiresAt['iso'] !== '')<time datetime="{{ $expiresAt['iso'] }}">{{ $expiresAt['label'] }}</time>@else{{ $expiresAt['label'] }}@endif</dd>
        </div>
        <div class="launch-dossier__metric">
            <dt>{{ __('customer.lp_version') }}</dt>
            <dd>{{ $contractVersion !== '' ? $contractVersion : '—' }}</dd>
        </div>
        <div class="launch-dossier__metric">
            <dt>{{ __('customer.lp_inventory') }}</dt>
            <dd>{{ $fileCount > 0 ? __('customer.lp_files', ['count' => $fileCount]) : __('customer.status_pending') }}</dd>
        </div>
        <div class="launch-dossier__metric">
            <dt>{{ __('customer.lp_quality_gate') }}</dt>
            <dd class="{{ $qualityPass ? 'text-[#2f6b4d]' : ($qualityKnown ? 'text-[#a23c32]' : '') }}">{{ $qualityLabel }}</dd>
        </div>
        <div class="launch-dossier__metric">
            <dt>{{ __('customer.lp_delivery_email') }}</dt>
            <dd class="{{ $emailToneClass }}">{{ $emailStatusMeta['label'] }}@if($emailSentAt['iso'] !== '') · <time datetime="{{ $emailSentAt['iso'] }}">{{ $emailSentAt['label'] }}</time>@endif</dd>
        </div>
    </dl>

    <div class="p-5 sm:p-7 lg:p-8">
        <div class="launch-dossier__state-note p-4 sm:p-5" aria-live="polite" role="status">
            <div class="flex items-start gap-3">
                <span class="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.65] text-[var(--lp-state)]">
                    <i data-lucide="{{ $currentState['icon'] }}" class="h-4 w-4" aria-hidden="true"></i>
                </span>
                <div>
                    <h3 class="text-sm font-semibold text-[var(--lp-ink)]">{{ $currentState['title'] }}</h3>
                    <p class="mt-1 text-sm leading-6 text-[#5e6961]">{{ $currentState['description'] }}</p>
                    @if($statusLabel !== '')
                        <p class="mt-2 text-xs font-semibold text-[#4f6255]">{{ __('customer.lp_system_record', ['status' => $statusLabel]) }}</p>
                    @endif
                </div>
            </div>
        </div>

        <div class="mt-5 flex flex-col gap-3 border-y border-[#d6d8ce] py-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-xs leading-5 text-[#6c776f]">
                @if($orderId !== '')
                    <span class="font-semibold uppercase tracking-[0.12em]">{{ __('customer.lp_order') }}</span>
                    <code class="ml-2 text-[#203c2b]">{{ $orderId }}</code>
                @else
                    {{ __('customer.lp_order_pending') }}
                @endif
                @if($lastRedeliveredAt['iso'] !== '')
                    <span class="ml-3">{{ __('customer.lp_last_resent', ['date' => $lastRedeliveredAt['label']]) }}</span>
                @endif
            </div>
            @if($canRedeliver && $orderId !== '' && $resendRouteAvailable)
                <form method="POST" action="{{ route('customer.launch-pack.resend') }}" class="shrink-0">
                    @csrf
                    <button type="submit" class="launch-dossier__button inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#9dad9f] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#203c2b] transition hover:border-[#53725d] hover:bg-[#eef3ec] sm:w-auto">
                        <i data-lucide="send" class="h-4 w-4" aria-hidden="true"></i>
                        {{ $deliveryState === 'expired' ? __('customer.lp_reauthorize') : __('customer.lp_resend') }}
                    </button>
                </form>
            @elseif($redeliverRetryAfter > 0)
                <span class="text-xs font-semibold text-[#976219]">{{ __('customer.lp_cooldown', ['time' => $redeliverWaitLabel]) }}</span>
            @elseif($deliveryState === 'expired')
                <span class="text-xs font-semibold text-[#976219]">{{ __('customer.lp_reauthorize_contact') }}</span>
            @endif
        </div>

        <div class="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#53725d]">{{ __('customer.lp_manifest_label') }}</p>
                <h3 class="mt-2 font-serif text-2xl font-semibold tracking-[-0.015em] text-[#152019]">{{ __('customer.lp_manifest_title') }}</h3>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-[#6c776f]">{{ __('customer.lp_manifest_detail') }}</p>
            </div>
            <span class="text-xs font-semibold uppercase tracking-[0.14em] text-[#6c776f]">{{ __('customer.lp_sections_indexed', ['sections' => count($fileGroups), 'files' => $fileCount]) }}</span>
        </div>

        @if($fileGroups !== [])
            <div class="mt-5 space-y-3">
                @foreach($fileGroups as $category => $files)
                    <details class="launch-dossier__group" @if($loop->first) open @endif>
                        <summary>
                            <span>{{ $categoryLabels[$category] ?? '09 · '.ucwords(str_replace(['_', '-'], ' ', $category)) }}</span>
                            <span class="flex shrink-0 items-center gap-3 text-xs font-semibold text-[#6c776f]">
                                {{ count($files) }} {{ count($files) === 1 ? 'file' : 'files' }}
                                <i data-lucide="chevron-down" class="launch-dossier__chevron h-4 w-4" aria-hidden="true"></i>
                            </span>
                        </summary>
                        <div>
                            @foreach($files as $file)
                                @php
                                    $fileName = (string) $file['name'];
                                    $mime = trim((string) ($file['mime'] ?? $file['content_type'] ?? '')) ?: 'application/octet-stream';
                                    $required = ($file['required'] ?? false) === true || (string) ($file['required'] ?? '') === '1';
                                    $integrity = is_array($file['integrity'] ?? null) ? $file['integrity'] : [];
                                    $bytes = $file['bytes'] ?? $file['size_bytes'] ?? $file['byte_size'] ?? $file['size'] ?? null;
                                    $hash = trim((string) ($file['sha256'] ?? $integrity['sha256'] ?? $file['hash'] ?? $file['checksum'] ?? ''));
                                    $hash = preg_replace('/^sha256:/i', '', $hash) ?? $hash;
                                    $hashShort = strlen($hash) > 20 ? substr($hash, 0, 12).'…'.substr($hash, -6) : $hash;
                                @endphp
                                <div class="launch-dossier__file">
                                    <div class="min-w-0">
                                        @if($downloadable && $fileRouteAvailable)
                                            <a href="{{ route('customer.launch-pack.files.download', ['filename' => $fileName]) }}" class="launch-dossier__file-link launch-dossier__file-name text-[#203c2b] underline decoration-[#a8b5aa] decoration-1 underline-offset-4 hover:decoration-[#203c2b]">
                                                {{ $fileName }}
                                            </a>
                                        @else
                                            <div class="launch-dossier__file-name text-[#48534c]">{{ $fileName }}</div>
                                        @endif
                                        <div class="launch-dossier__file-meta mt-1">{{ $required ? __('customer.lp_required') : __('customer.lp_supporting') }}</div>
                                    </div>
                                    <div class="launch-dossier__file-meta">
                                        <span class="block text-[.62rem] font-bold uppercase tracking-[0.11em] text-[#8a938d]">MIME</span>
                                        <span class="mt-1 block break-all">{{ $mime }}</span>
                                    </div>
                                    <div class="launch-dossier__file-meta">
                                        <span class="block text-[.62rem] font-bold uppercase tracking-[0.11em] text-[#8a938d]">{{ __('customer.lp_size') }}</span>
                                        <span class="mt-1 block">{{ $formatBytes($bytes) }}</span>
                                    </div>
                                    <div class="min-w-0 lg:text-right">
                                        @if($hash !== '')
                                            <span class="block text-[.62rem] font-bold uppercase tracking-[0.11em] text-[#8a938d]">SHA-256</span>
                                            <code class="launch-dossier__hash mt-1 block" title="{{ $hash }}">{{ $hashShort }}</code>
                                        @else
                                            <span class="launch-dossier__file-meta">{{ __('customer.lp_hash_pending') }}</span>
                                        @endif
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </details>
                @endforeach
            </div>
        @else
            <div class="mt-5 rounded-md border border-dashed border-[#bfc7bf] bg-white/55 px-5 py-8 text-center">
                <i data-lucide="folders" class="mx-auto h-5 w-5 text-[#738078]" aria-hidden="true"></i>
                <p class="mt-3 text-sm font-semibold text-[#48534c]">{{ __('customer.lp_manifest_missing') }}</p>
                <p class="mt-1 text-xs leading-5 text-[#7a847e]">{{ __('customer.lp_manifest_missing_detail') }}</p>
            </div>
        @endif
    </div>
</section>

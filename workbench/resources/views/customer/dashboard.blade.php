@extends('customer.layouts.app')

@section('content')
@php
    $brandName = trim((string) ($aivgl['brand']['name'] ?? __('customer.brand_default')));
    $brandLabel = $brandName !== '' ? $brandName : __('customer.brand_default');
    $checkoutEmail = strtolower(trim((string) (auth('admin')->user()?->email ?? '')));
    $scores = $summary;
    $visibilityScore = $scores['visibility_score'];
    $sourceQuality = $scores['source_quality'];
    $competitorPressure = $scores['competitor_pressure'];
    $hasBaseline = $visibilityScore !== null;
    $articleFeedback = $articleFeedback ?? [];
    $coverage = $aivgl['coverage'] ?? [];
    $sourceMix = $aivgl['source_mix'] ?? [];
    $components = $aivgl['score_components'] ?? [];
    $highlightedAnswers = $aivgl['highlighted_answers'] ?? [];
    $providerRuns = $aivgl['evidence_collection']['provider_runs'] ?? [];
    $fulfillment = is_array($aivgl['fulfillment'] ?? null) ? $aivgl['fulfillment'] : [];
    $deliveryStatus = is_array($deliveryStatus ?? null) ? $deliveryStatus : [];
    $launchPack = is_array($launchPack ?? null) ? $launchPack : [];
    $launchPackData = is_array($launchPack['launch_pack'] ?? null) ? $launchPack['launch_pack'] : [];
    $monthlyFulfillment = is_array($aivgl['monthly_fulfillment'] ?? null) ? $aivgl['monthly_fulfillment'] : [];
    $monthlyFulfillmentItems = is_array($monthlyFulfillment['items'] ?? null) ? $monthlyFulfillment['items'] : [];
    $godReportTypes = ['competitor_deep_report', 'strategy_memo'];
    $godReports = array_values(array_filter($monthlyFulfillmentItems, static fn ($item): bool => is_array($item) && in_array((string) ($item['item_type'] ?? ''), $godReportTypes, true)));
    $standardFulfillmentItems = array_values(array_filter($monthlyFulfillmentItems, static fn ($item): bool => is_array($item) && ! in_array((string) ($item['item_type'] ?? ''), $godReportTypes, true)));
    $monthlyFulfillmentSummary = is_array($monthlyFulfillment['summary'] ?? null) ? $monthlyFulfillment['summary'] : [];
    $billingAddons = is_array($billingAddons ?? null) ? $billingAddons : [];
    $billingLedger = is_array($billingLedger ?? null) ? $billingLedger : [];
    $billingMetrics = is_array($billingLedger['metrics'] ?? null) ? $billingLedger['metrics'] : [];
    $addonTotals = is_array($billingAddons['totals'] ?? null) ? $billingAddons['totals'] : ['credits' => 0, 'article' => 0, 'competitor' => 0];
    $addonItems = is_array($billingAddons['items'] ?? null) ? $billingAddons['items'] : [];
    $fulfillmentMode = (string) ($fulfillment['mode'] ?? 'pending');
    $liveProviderBlockers = is_array($fulfillment['live_provider_blockers'] ?? null) ? $fulfillment['live_provider_blockers'] : [];
    $liveProviderBlockerLabels = [
        'plan_live_provider_not_enabled' => __('customer.blocker_plan_disabled'),
        'allow_paid_provider_flag_missing' => __('customer.blocker_paid_flag_missing'),
        'openrouter_secret_missing' => __('customer.blocker_openrouter_missing'),
        'perplexity_secret_missing' => __('customer.blocker_perplexity_missing'),
        'daily_provider_call_limit_exceeded' => __('customer.blocker_daily_limit'),
        'monthly_provider_call_limit_exceeded' => __('customer.blocker_monthly_call_limit'),
        'monthly_provider_cost_limit_exceeded' => __('customer.blocker_monthly_cost_limit'),
    ];
    $isMockFulfillment = $fulfillmentMode === 'mock_validation';
    $isLiveFulfillment = $fulfillmentMode === 'live_monitoring';
    $isFailedFulfillment = in_array($fulfillmentMode, ['failed', 'degraded'], true);
    $fulfillmentTone = match ($fulfillmentMode) {
        'live_monitoring' => [
            'wrap' => 'border-[#b7e4d2] bg-[#f0faf5] text-[#0f5f46]',
            'badge' => 'bg-[#d9f2e7] text-[#0f5f46]',
            'icon' => 'radio',
        ],
        'failed', 'degraded' => [
            'wrap' => 'border-[#f5c2c7] bg-[#fff5f5] text-[#b42318]',
            'badge' => 'bg-[#fde8e8] text-[#b42318]',
            'icon' => 'triangle-alert',
        ],
        default => [
            'wrap' => 'border-[#f4d48b] bg-[#fffaf0] text-[#8a5b12]',
            'badge' => 'bg-[#fff1c2] text-[#8a5b12]',
            'icon' => 'flask-conical',
        ],
    };

    $fmt = static function ($value, int $decimals = 0): string {
        if (! is_numeric($value)) {
            return __('customer.pending_data');
        }

        $formatted = number_format((float) $value, $decimals);
        if ($decimals > 0) {
            $formatted = rtrim(rtrim($formatted, '0'), '.');
        }

        return $formatted;
    };
    $pct = static function ($value): string {
        if (! is_numeric($value)) {
            return __('customer.not_available');
        }

        $formatted = rtrim(rtrim(number_format((float) $value * 100, 1), '0'), '.');

        return ($formatted === '' ? '0' : $formatted).'%';
    };
    $band = static function ($value, bool $pressure = false): array {
        if (! is_numeric($value)) {
            return ['label' => __('customer.pending_data'), 'class' => 'bg-[#eef1ed] text-[#64716a]', 'tone' => 'text-[#64716a]'];
        }

        $score = (float) $value;
        if ($pressure) {
            return match (true) {
                $score >= 75 => ['label' => __('customer.band_pressure_high'), 'class' => 'bg-[#fde8e8] text-[#b42318]', 'tone' => 'text-[#b42318]'],
                $score >= 40 => ['label' => __('customer.band_pressure_medium'), 'class' => 'bg-[#fff8e7] text-[#9a6b18]', 'tone' => 'text-[#9a6b18]'],
                default => ['label' => __('customer.band_pressure_low'), 'class' => 'bg-[#e8f5f1] text-[#0f766e]', 'tone' => 'text-[#0f766e]'],
            };
        }

        return match (true) {
            $score >= 85 => ['label' => __('customer.band_strong'), 'class' => 'bg-[#e8f5f1] text-[#0f766e]', 'tone' => 'text-[#0f766e]'],
            $score >= 70 => ['label' => __('customer.band_good'), 'class' => 'bg-[#e8f5f1] text-[#0f766e]', 'tone' => 'text-[#0f766e]'],
            $score >= 50 => ['label' => __('customer.band_weak'), 'class' => 'bg-[#fff8e7] text-[#9a6b18]', 'tone' => 'text-[#9a6b18]'],
            default => ['label' => __('customer.band_low'), 'class' => 'bg-[#fde8e8] text-[#b42318]', 'tone' => 'text-[#b42318]'],
        };
    };
    $scoreLabel = $hasBaseline ? $fmt($visibilityScore).'/100' : __('customer.pending_data');
    $visibilityBand = $band($visibilityScore);
    $sourceBand = $band($sourceQuality);
    $pressureBand = $band($competitorPressure, true);
    $topProblem = $isMockFulfillment
        ? __('customer.problem_mock')
        : ($competitorPressure !== null && (float) $competitorPressure >= 40
        ? __('customer.problem_competitor', ['brand' => $brandLabel])
        : __('customer.problem_evidence', ['brand' => $brandLabel]));
    $recommendedAction = $isMockFulfillment
        ? __('customer.action_mock')
        : __('customer.action_content');

    $scoreCards = [
        [
            'id' => 'visibility',
            'title' => __('customer.metric_visibility'),
            'score' => $visibilityScore,
            'band' => $visibilityBand,
            'meaning' => __('customer.metric_visibility_meaning', ['brand' => $brandLabel]),
            'direction' => __('customer.direction_higher'),
            'formula' => __('customer.formula_visibility'),
            'components' => [
                ['label' => __('customer.component_brand_mention'), 'value' => $pct($components['brand_mention_rate'] ?? null)],
                ['label' => __('customer.component_source_coverage'), 'value' => $pct($components['source_coverage_rate'] ?? null)],
                ['label' => __('customer.component_official_source'), 'value' => $pct($components['official_source_rate'] ?? null)],
                ['label' => __('customer.component_third_party_source'), 'value' => $pct($components['third_party_source_rate'] ?? null)],
                ['label' => __('customer.component_competitor_only'), 'value' => $pct($components['competitor_only_rate'] ?? null)],
            ],
        ],
        [
            'id' => 'source-quality',
            'title' => __('customer.metric_source_quality'),
            'score' => $sourceQuality,
            'band' => $sourceBand,
            'meaning' => __('customer.metric_source_meaning'),
            'direction' => __('customer.direction_higher'),
            'formula' => __('customer.formula_source'),
            'components' => [
                ['label' => __('customer.component_official_source'), 'value' => $pct($components['official_source_rate'] ?? null)],
                ['label' => __('customer.component_third_party_source'), 'value' => $pct($components['third_party_source_rate'] ?? null)],
                ['label' => __('customer.component_source_coverage'), 'value' => $pct($components['source_coverage_rate'] ?? null)],
                ['label' => __('customer.component_competitor_source'), 'value' => $pct($components['competitor_source_rate'] ?? null)],
            ],
        ],
        [
            'id' => 'competitor-pressure',
            'title' => __('customer.metric_competitor_pressure'),
            'score' => $competitorPressure,
            'band' => $pressureBand,
            'meaning' => __('customer.metric_pressure_meaning'),
            'direction' => __('customer.direction_lower'),
            'formula' => __('customer.formula_pressure'),
            'components' => [
                ['label' => __('customer.component_competitor_mention'), 'value' => $pct($components['competitor_mention_rate'] ?? null)],
                ['label' => __('customer.component_competitor_source'), 'value' => $pct($components['competitor_source_rate'] ?? null)],
            ],
        ],
    ];

    $providerLabels = [
        'gsc' => __('customer.provider_gsc'),
        'competitor_page_crawler' => __('customer.provider_competitor_crawler'),
        'ai_answer_surfaces' => __('customer.provider_ai_answers'),
        'serp_paa' => __('customer.provider_serp_paa'),
        'third_party_source_crawler' => __('customer.provider_third_party_crawler'),
    ];
    $providerStatusLabels = [
        'completed' => __('customer.provider_completed'),
        'skipped' => __('customer.provider_skipped'),
        'failed' => __('customer.provider_failed'),
    ];
    $providerReasonLabels = [
        'missing_gsc_access_token_or_property' => __('customer.provider_missing_gsc'),
        'missing_serpapi_or_dataforseo_credentials' => __('customer.provider_missing_serp'),
        'no_third_party_urls_from_serp' => __('customer.provider_no_third_party'),
    ];
    $customerStatusLabels = [
        'active' => __('customer.status_active'), 'paid' => __('customer.status_paid'), 'trial' => __('customer.status_trial'),
        'paused' => __('customer.status_paused'), 'past_due' => __('customer.status_past_due'), 'cancelled' => __('customer.status_cancelled'), 'canceled' => __('customer.status_cancelled'),
        'scheduled' => __('customer.status_scheduled'), 'queued' => __('customer.status_queued'), 'generating' => __('customer.status_generating'),
        'pending_operator' => __('customer.status_pending_operator'), 'pending' => __('customer.status_pending'), 'completed' => __('customer.status_completed'),
        'failed' => __('customer.status_failed'), 'blocked' => __('customer.status_blocked'),
    ];
    $unitTypeLabels = [
        'credit' => __('customer.unit_credit'), 'credits' => __('customer.unit_credit'), 'article' => __('customer.unit_article'),
        'competitor' => __('customer.unit_competitor'), 'addon' => __('customer.unit_addon'),
    ];
    $billingPeriodLabels = ['one_time' => __('customer.period_one_time'), 'monthly' => __('customer.period_monthly')];
@endphp

@if ($errors->any())
    <div class="mb-5 rounded-lg border border-[#f5c2c7] bg-[#fff5f5] p-4 text-sm font-medium text-[#b42318]">
        {{ $errors->first() }}
    </div>
@endif

<section class="mb-5 customer-panel overflow-hidden">
    <div class="border-b border-[#d8dfd9] bg-[#17201b] px-5 py-5 text-white sm:px-7">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fc4a7]">{{ __('customer.billing_overline') }}</p>
                <h2 class="mt-2 text-2xl font-semibold">{{ __('customer.billing_title') }}</h2>
                <p class="mt-2 max-w-3xl text-sm leading-6 text-white/65">{{ __('customer.billing_detail') }}</p>
            </div>
            <span class="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">{{ __('customer.billing_cycle', ['month' => $billingLedger['cycle_month'] ?? now()->format('Y-m')]) }}</span>
        </div>
    </div>
    @if(($billingLedger['has_contract'] ?? false) === true)
        @php
            $billingStatus = (string) ($billingLedger['billing_status'] ?? 'missing');
            $isBillingActive = ($billingLedger['access_mode'] ?? 'read_only') === 'active';
            $billingTone = $isBillingActive ? 'bg-[#e8f5f1] text-[#0f766e]' : 'bg-[#fff1c2] text-[#8a5b12]';
            $metricLabels = [
                'credits' => __('customer.billing_metric_credits'),
                'surfaces' => __('customer.billing_metric_surfaces'),
                'competitors' => __('customer.billing_metric_competitors'),
                'articles' => __('customer.billing_metric_articles'),
            ];
        @endphp
        <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
            <div class="bg-[#f7f8f4] p-5 sm:p-7">
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.15em] text-[#64716a]">{{ __('customer.billing_current_plan') }}</p>
                        <div class="mt-2 text-3xl font-semibold text-[#17201b]">{{ $billingLedger['plan_name'] }}</div>
                    </div>
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $billingTone }}">{{ $customerStatusLabels[$billingStatus] ?? __('customer.status_unknown') }}</span>
                </div>
                <div class="mt-6 text-sm text-[#64716a]">{{ __('customer.billing_rate') }}</div>
                <div class="mt-1 text-2xl font-semibold text-[#17201b]">{{ $billingLedger['currency'] }} ${{ number_format((int) ($billingLedger['price'] ?? 0)) }}<span class="text-sm font-medium text-[#64716a]"> {{ __('customer.billing_monthly_suffix') }}</span></div>
                <div class="mt-5 rounded-md border border-[#d8dfd9] bg-white px-4 py-3">
                    <div class="text-xs font-semibold uppercase tracking-[0.12em] text-[#64716a]">{{ __('customer.billing_access') }}</div>
                    <div class="mt-1 text-sm font-semibold {{ $isBillingActive ? 'text-[#0f766e]' : 'text-[#8a5b12]' }}">{{ $isBillingActive ? __('customer.billing_access_active') : __('customer.billing_access_read_only') }}</div>
                </div>
            </div>
            <div class="bg-white p-5 sm:p-7">
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    @foreach($billingMetrics as $metricKey => $metric)
                        <article class="rounded-lg border border-[#d8dfd9] bg-white p-4">
                            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#64716a]">{{ $metricLabels[$metricKey] ?? $metricKey }}</p>
                            <div class="mt-3 flex items-end justify-between gap-2">
                                <div class="text-3xl font-semibold text-[#17201b]">{{ number_format((int) ($metric['remaining'] ?? 0)) }}</div>
                                <div class="pb-1 text-xs font-semibold text-[#64716a]">{{ __('customer.billing_remaining') }}</div>
                            </div>
                            <dl class="mt-4 space-y-2 border-t border-[#e5e9e5] pt-3 text-xs">
                                <div class="flex justify-between gap-3"><dt class="text-[#64716a]">{{ __('customer.billing_base') }}</dt><dd class="font-semibold text-[#17201b]">{{ number_format((int) ($metric['base'] ?? 0)) }}</dd></div>
                                <div class="flex justify-between gap-3"><dt class="text-[#64716a]">{{ __('customer.billing_addon') }}</dt><dd class="font-semibold text-[#0f766e]">+{{ number_format((int) ($metric['addon'] ?? 0)) }}</dd></div>
                                <div class="flex justify-between gap-3"><dt class="text-[#64716a]">{{ __('customer.billing_effective') }}</dt><dd class="font-semibold text-[#17201b]">{{ number_format((int) ($metric['effective'] ?? 0)) }}</dd></div>
                                <div class="flex justify-between gap-3"><dt class="text-[#64716a]">{{ __('customer.billing_used') }}</dt><dd class="font-semibold text-[#17201b]">{{ number_format((int) ($metric['used'] ?? 0)) }}</dd></div>
                            </dl>
                        </article>
                    @endforeach
                </div>
            </div>
        </div>
    @else
        <div class="bg-white px-5 py-6 text-sm leading-6 text-[#64716a] sm:px-7">{{ __('customer.billing_no_contract') }}</div>
    @endif
</section>

@if(count($deliveryStatus) > 0)
    <section class="mb-5 customer-panel p-5">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#64716a]">{{ __('customer.fulfillment_label') }}</p>
                <h2 class="mt-2 text-lg font-semibold text-[#17201b]">{{ __('customer.section_fulfillment') }}</h2>
            </div>
            <span class="text-xs font-semibold text-[#64716a]">{{ __('customer.fulfillment_scope') }}</span>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-4">
            @foreach($deliveryStatus as $item)
                @php
                    $tone = (string) ($item['tone'] ?? 'pending');
                    $toneClass = match ($tone) {
                        'ready' => 'border-[#b7e4d2] bg-[#f0faf5] text-[#0f5f46]',
                        'failed' => 'border-[#f5c2c7] bg-[#fff5f5] text-[#b42318]',
                        default => 'border-[#f4d48b] bg-[#fffaf0] text-[#8a5b12]',
                    };
                @endphp
                <div class="rounded-lg border p-4 {{ $toneClass }}">
                    <div class="flex items-center justify-between gap-2">
                        <h3 class="text-sm font-semibold">{{ $item['title'] ?? __('customer.fulfillment_item') }}</h3>
                        <span class="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold">{{ $item['label'] ?? __('customer.status_pending') }}</span>
                    </div>
                    <p class="mt-3 text-xs leading-5">{{ $item['detail'] ?? '' }}</p>
                </div>
            @endforeach
        </div>
    </section>
@endif

@include('customer.partials.launch-pack-delivery', [
    'launchPackStatus' => $launchPackData,
    'launchPack' => $launchPack,
])

@if(($billingLedger['has_contract'] ?? false) === true && ($billingLedger['access_mode'] ?? 'read_only') === 'active' && $checkoutEmail !== '')
    <section id="billing-addons" class="mb-5 scroll-mt-28 customer-panel overflow-hidden">
        <div class="border-b border-[#d8dfd9] bg-[#17201b] p-5 text-white sm:p-7">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#8fc4a7]">{{ __('customer.addon_store_label') }}</p>
                    <h2 class="mt-2 text-2xl font-semibold">{{ __('customer.addon_store_title') }}</h2>
                    <p class="mt-2 max-w-3xl text-sm leading-6 text-white/65">{{ __('customer.addon_store_detail') }}</p>
                </div>
                <div class="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-xs leading-5 text-white/75">
                    {{ __('customer.addon_account_note', ['email' => $checkoutEmail]) }}
                </div>
            </div>
        </div>
        <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-3" data-addon-store>
            <article class="flex min-w-0 flex-col bg-white p-5 sm:p-6" data-addon-code="credits_1000" data-addon-kind="hosted">
                <div class="flex items-start justify-between gap-3">
                    <div class="rounded-md bg-[#e8f5f1] p-2 text-[#0f766e]"><i data-lucide="activity" class="h-5 w-5" aria-hidden="true"></i></div>
                    <div class="text-right"><strong class="block text-2xl text-[#17201b]">$49</strong><span class="text-xs font-semibold uppercase tracking-[0.12em] text-[#64716a]">{{ __('customer.addon_one_time') }}</span></div>
                </div>
                <h3 class="mt-5 text-base font-semibold text-[#17201b]">{{ __('customer.addon_credits_title') }}</h3>
                <p class="mt-2 flex-1 text-sm leading-6 text-[#64716a]">{{ __('customer.addon_credits_detail') }}</p>
                <button type="button" class="mt-5 min-h-11 rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b5f59] disabled:cursor-wait disabled:opacity-60" data-addon-prepare disabled>{{ __('customer.addon_loading') }}</button>
                <div class="mt-3 min-h-0" data-addon-target></div>
                <p class="mt-2 min-h-5 text-xs leading-5 text-[#64716a]" data-addon-message aria-live="polite"></p>
            </article>
            <article class="flex min-w-0 flex-col bg-white p-5 sm:p-6" data-addon-code="article_extra" data-addon-kind="hosted">
                <div class="flex items-start justify-between gap-3">
                    <div class="rounded-md bg-[#fff8e7] p-2 text-[#9a6b18]"><i data-lucide="file-plus-2" class="h-5 w-5" aria-hidden="true"></i></div>
                    <div class="text-right"><strong class="block text-2xl text-[#17201b]">$39</strong><span class="text-xs font-semibold uppercase tracking-[0.12em] text-[#64716a]">{{ __('customer.addon_one_time') }}</span></div>
                </div>
                <h3 class="mt-5 text-base font-semibold text-[#17201b]">{{ __('customer.addon_article_title') }}</h3>
                <p class="mt-2 flex-1 text-sm leading-6 text-[#64716a]">{{ __('customer.addon_article_detail') }}</p>
                <button type="button" class="mt-5 min-h-11 rounded-md bg-[#0f766e] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b5f59] disabled:cursor-wait disabled:opacity-60" data-addon-prepare disabled>{{ __('customer.addon_loading') }}</button>
                <div class="mt-3 min-h-0" data-addon-target></div>
                <p class="mt-2 min-h-5 text-xs leading-5 text-[#64716a]" data-addon-message aria-live="polite"></p>
            </article>
            <article class="flex min-w-0 flex-col bg-white p-5 sm:p-6" data-addon-code="competitor_extra" data-addon-kind="subscription">
                <div class="flex items-start justify-between gap-3">
                    <div class="rounded-md bg-[#eef1ed] p-2 text-[#385642]"><i data-lucide="users-round" class="h-5 w-5" aria-hidden="true"></i></div>
                    <div class="text-right"><strong class="block text-2xl text-[#17201b]">$19</strong><span class="text-xs font-semibold uppercase tracking-[0.12em] text-[#64716a]">{{ __('customer.addon_per_month') }}</span></div>
                </div>
                <h3 class="mt-5 text-base font-semibold text-[#17201b]">{{ __('customer.addon_competitor_title') }}</h3>
                <p class="mt-2 flex-1 text-sm leading-6 text-[#64716a]">{{ __('customer.addon_competitor_detail') }}</p>
                <div class="mt-5 min-h-11" id="paypal-dashboard-competitor-extra" data-addon-target></div>
                <p class="mt-2 min-h-5 text-xs leading-5 text-[#64716a]" data-addon-message aria-live="polite">{{ __('customer.addon_loading') }}</p>
            </article>
        </div>
    </section>
@endif

@if(count($addonItems) > 0)
    <section class="mb-5 customer-panel p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#64716a]">{{ __('customer.addons_label') }}</p>
                <h2 class="mt-2 text-lg font-semibold text-[#17201b]">{{ __('customer.section_addons') }}</h2>
                <p class="mt-1 text-sm leading-6 text-[#64716a]">{{ __('customer.section_addons_detail') }}</p>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-[#385642] md:min-w-[320px]">
                <div class="rounded-md bg-[#f3f7f1] px-3 py-2">
                    <div class="text-base text-[#17201b]">{{ (int) ($addonTotals['credits'] ?? 0) }}</div>
                    <div>{{ __('customer.credits') }}</div>
                </div>
                <div class="rounded-md bg-[#fff8e7] px-3 py-2">
                    <div class="text-base text-[#17201b]">{{ (int) ($addonTotals['article'] ?? 0) }}</div>
                    <div>{{ __('customer.articles') }}</div>
                </div>
                <div class="rounded-md bg-[#eef1ed] px-3 py-2">
                    <div class="text-base text-[#17201b]">{{ (int) ($addonTotals['competitor'] ?? 0) }}</div>
                    <div>{{ __('customer.competitors_unit') }}</div>
                </div>
            </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-3">
            @foreach(array_slice($addonItems, 0, 6) as $addon)
                @php
                    $synced = ! empty($addon['synced_to_aivgl_at']);
                    $status = (string) ($addon['billing_status'] ?? 'active');
                    $unitType = (string) ($addon['unit_type'] ?? 'addon');
                @endphp
                <div class="rounded-md border border-[#d8dfd9] bg-white p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-sm font-semibold text-[#17201b]">{{ str_replace('_', ' ', (string) ($addon['addon_code'] ?? 'addon')) }}</div>
                            <div class="mt-1 text-xs text-[#64716a]">{{ (int) ($addon['units'] ?? 1) }} {{ $unitTypeLabels[$unitType] ?? str_replace('_', ' ', $unitType) }} · {{ $billingPeriodLabels[$addon['billing_period'] ?? 'one_time'] ?? str_replace('_', ' ', (string) ($addon['billing_period'] ?? 'one_time')) }}</div>
                        </div>
                        <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $synced ? 'bg-[#e8f5f1] text-[#0f766e]' : 'bg-[#fff8e7] text-[#9a6b18]' }}">{{ $synced ? __('customer.synced') : ($customerStatusLabels[$status] ?? __('customer.status_unknown')) }}</span>
                    </div>
                </div>
            @endforeach
        </div>
    </section>
@endif

<section class="mb-5 rounded-lg border p-4 {{ $fulfillmentTone['wrap'] }}">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex items-start gap-3">
            <div class="mt-0.5 rounded-md bg-white/70 p-2">
                <i data-lucide="{{ $fulfillmentTone['icon'] }}" class="h-4 w-4"></i>
            </div>
            <div>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $fulfillmentTone['badge'] }}">{{ $fulfillment['label'] ?? __('customer.pending_confirmation') }}</span>
                    <span class="text-xs font-semibold uppercase tracking-[0.12em]">{{ $isLiveFulfillment ? __('customer.live_delivery') : __('customer.not_live_delivery') }}</span>
                </div>
                <p class="mt-2 max-w-4xl text-sm leading-6">
                    {{ $fulfillment['description'] ?? __('customer.fulfillment_unsynced') }}
                </p>
                @if(count($liveProviderBlockers) > 0)
                    <p class="mt-2 text-xs font-semibold">
                        {{ __('customer.live_gate') }}: {{ collect($liveProviderBlockers)->map(fn ($blocker) => $liveProviderBlockerLabels[$blocker] ?? str_replace('_', ' ', (string) $blocker))->join(' · ') }}
                    </p>
                @endif
            </div>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center text-xs font-semibold md:min-w-[260px]">
            <div class="rounded-md bg-white/70 px-3 py-2">
                <div class="text-base text-[#17201b]">{{ (int) ($fulfillment['live_surface_count'] ?? 0) }}</div>
                <div>{{ __('customer.surface_live') }}</div>
            </div>
            <div class="rounded-md bg-white/70 px-3 py-2">
                <div class="text-base text-[#17201b]">{{ (int) ($fulfillment['mock_surface_count'] ?? 0) }}</div>
                <div>{{ __('customer.surface_mock') }}</div>
            </div>
            <div class="rounded-md bg-white/70 px-3 py-2">
                <div class="text-base text-[#17201b]">{{ (int) ($fulfillment['pending_surface_count'] ?? 0) }}</div>
                <div>{{ __('customer.surface_pending') }}</div>
            </div>
        </div>
    </div>
</section>

@if(count($standardFulfillmentItems) > 0)
    <section class="mb-5 customer-panel p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#64716a]">{{ __('customer.monthly_label') }}</p>
                <h2 class="mt-2 text-lg font-semibold text-[#17201b]">{{ __('customer.section_monthly_queue') }}</h2>
                <p class="mt-1 text-sm leading-6 text-[#64716a]">
                    {{ __('customer.monthly_detail', ['month' => $monthlyFulfillment['cycle_month'] ?? now()->format('Y-m')]) }}
                </p>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-[#385642] md:min-w-[280px]">
                <div class="rounded-md bg-[#f3f7f1] px-3 py-2">
                    <div class="text-base text-[#17201b]">{{ (int) ($monthlyFulfillmentSummary['scheduled_count'] ?? 0) + (int) ($monthlyFulfillmentSummary['queued_count'] ?? 0) + (int) ($monthlyFulfillmentSummary['generating_count'] ?? 0) }}</div>
                    <div>{{ __('customer.monthly_auto') }}</div>
                </div>
                <div class="rounded-md bg-[#fff8e7] px-3 py-2">
                    <div class="text-base text-[#17201b]">{{ (int) ($monthlyFulfillmentSummary['pending_operator_count'] ?? 0) }}</div>
                    <div>{{ __('customer.monthly_operator') }}</div>
                </div>
                <div class="rounded-md bg-[#eef1ed] px-3 py-2">
                    <div class="text-base text-[#17201b]">{{ (int) ($monthlyFulfillmentSummary['completed_count'] ?? 0) }}</div>
                    <div>{{ __('customer.monthly_done') }}</div>
                </div>
            </div>
        </div>
        <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            @foreach(array_slice($standardFulfillmentItems, 0, 6) as $item)
                @php
                    $status = (string) ($item['status'] ?? 'scheduled');
                    $itemType = (string) ($item['item_type'] ?? '');
                    $resultPayload = is_array($item['result_payload'] ?? null) ? $item['result_payload'] : [];
                    $statusTone = match ($status) {
                        'completed' => 'bg-[#e8f5f1] text-[#0f766e]',
                        'queued', 'generating' => 'bg-[#eaf2ff] text-[#1d4ed8]',
                        'pending_operator' => 'bg-[#fff8e7] text-[#9a6b18]',
                        'failed', 'blocked' => 'bg-[#fde8e8] text-[#b42318]',
                        default => 'bg-[#eef1ed] text-[#64716a]',
                    };
                @endphp
                <div class="rounded-md border border-[#d8dfd9] bg-white p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <div class="text-sm font-semibold text-[#17201b]">{{ $item['item_label'] ?? $item['item_type'] ?? __('customer.fulfillment_item') }}</div>
                            <div class="mt-1 text-xs text-[#64716a]">{{ __('customer.quota') }}: {{ (int) ($item['quota_units'] ?? 1) }}</div>
                        </div>
                        <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $statusTone }}">{{ $customerStatusLabels[$status] ?? __('customer.status_unknown') }}</span>
                    </div>
                    @if($status === 'pending_operator')
                        <div class="mt-4 rounded-md border border-[#f4d48b] bg-[#fff8e7] px-3 py-3 text-xs leading-5 text-[#8a5b12]">
                            <strong class="block text-[#6f470c]">{{ __('customer.monthly_operator_next_title') }}</strong>
                            <span>{{ __('customer.monthly_operator_next_detail') }}</span>
                            @if($itemType === 'article_drafts')
                                <a href="{{ route('customer.campaigns.create') }}" class="mt-2 inline-flex min-h-11 items-center font-semibold text-[#0f766e] underline decoration-[#0f766e]/35 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f766e]">{{ __('customer.monthly_operator_open_content') }}</a>
                            @endif
                        </div>
                    @endif
                </div>
            @endforeach
        </div>
    </section>
@endif

@if(count($godReports) > 0)
    <section class="mb-5 customer-panel overflow-hidden">
        <div class="border-b border-[#d8dfd9] bg-[#17201b] px-5 py-6 text-white sm:px-7">
            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.2em] text-[#8fc4a7]">{{ __('customer.god_reports_label') }}</p>
                    <h2 class="mt-2 text-2xl font-semibold">{{ __('customer.god_reports_title') }}</h2>
                    <p class="mt-2 max-w-3xl text-sm leading-6 text-white/65">{{ __('customer.god_reports_detail') }}</p>
                </div>
                <span class="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">{{ $monthlyFulfillment['cycle_month'] ?? now()->format('Y-m') }}</span>
            </div>
        </div>
        <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-2">
            @foreach($godReports as $item)
                @php
                    $status = (string) ($item['status'] ?? 'scheduled');
                    $itemType = (string) ($item['item_type'] ?? '');
                    $resultPayload = is_array($item['result_payload'] ?? null) ? $item['result_payload'] : [];
                    $reportStatus = (string) ($resultPayload['status'] ?? 'pending');
                    $deliveryReady = ($resultPayload['customer_delivery_ready'] ?? false) === true;
                    $isCompleted = $status === 'completed' && $resultPayload !== [] && ! empty($item['id']);
                    $evidenceCount = $itemType === 'competitor_deep_report'
                        ? count(is_array($resultPayload['evidence_highlights'] ?? null) ? $resultPayload['evidence_highlights'] : [])
                        : count(is_array($resultPayload['evidence_register'] ?? null) ? $resultPayload['evidence_register'] : []);
                    $actionCount = $itemType === 'competitor_deep_report'
                        ? count(is_array($resultPayload['action_plan'] ?? null) ? $resultPayload['action_plan'] : [])
                        : count(is_array($resultPayload['roadmap_90_days'] ?? null) ? $resultPayload['roadmap_90_days'] : []);
                    $statusTone = match ($status) {
                        'completed' => 'bg-[#e8f5f1] text-[#0f766e]',
                        'queued', 'generating' => 'bg-[#eaf2ff] text-[#1d4ed8]',
                        'failed', 'blocked' => 'bg-[#fde8e8] text-[#b42318]',
                        default => 'bg-[#eef1ed] text-[#64716a]',
                    };
                @endphp
                <article class="bg-white p-6 sm:p-7">
                    <div class="flex items-start justify-between gap-4">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e]">{{ $itemType === 'competitor_deep_report' ? __('customer.competitive_intelligence') : __('customer.executive_strategy') }}</p>
                            <h3 class="mt-2 text-xl font-semibold text-[#17201b]">{{ $resultPayload['title'] ?? $item['item_label'] ?? __('customer.god_report_default') }}</h3>
                        </div>
                        <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $statusTone }}">{{ $customerStatusLabels[$status] ?? __('customer.status_unknown') }}</span>
                    </div>
                    @if($isCompleted)
                        <p class="mt-4 text-sm leading-6 text-[#64716a]">
                            {{ $resultPayload['executive_summary'] ?? (($itemType === 'competitor_deep_report') ? __('customer.competitors_measured', ['count' => (int) ($resultPayload['competitive_summary']['tracked_competitors'] ?? 0)]) : __('customer.strategy_ready')) }}
                        </p>
                        <div class="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-[#64716a]">
                            <div class="rounded-md bg-[#f7f8f4] px-3 py-2"><strong class="block text-base text-[#17201b]">{{ (int) ($resultPayload['measurement']['parsed_answer_count'] ?? 0) }}</strong>{{ __('customer.answers') }}</div>
                            <div class="rounded-md bg-[#f7f8f4] px-3 py-2"><strong class="block text-base text-[#17201b]">{{ $evidenceCount }}</strong>{{ __('customer.evidence') }}</div>
                            <div class="rounded-md bg-[#f7f8f4] px-3 py-2"><strong class="block text-base text-[#17201b]">{{ $actionCount }}</strong>{{ __('customer.phases') }}</div>
                        </div>
                        @if($reportStatus !== 'ready' || ! $deliveryReady)
                            <div class="mt-4 rounded-md border border-[#f4d48b] bg-[#fff8e7] px-3 py-2 text-xs leading-5 text-[#8a5b12]">{{ __('customer.report_boundary', ['status' => str_replace('_', ' ', $reportStatus)]) }}</div>
                        @endif
                        <div class="mt-5 flex flex-wrap gap-2">
                            <a href="{{ route('customer.god-reports.show', ['itemId' => $item['id']]) }}" class="inline-flex items-center gap-2 rounded-md bg-[#17201b] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#2f3b34]"><i data-lucide="book-open" class="h-4 w-4"></i>{{ __('customer.view_report') }}</a>
                            <a href="{{ route('customer.god-reports.download', ['itemId' => $item['id'], 'format' => 'md']) }}" class="inline-flex items-center gap-2 rounded-md border border-[#d8dfd9] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#385642] hover:bg-[#f3f7f1]"><i data-lucide="file-text" class="h-4 w-4"></i>MD</a>
                            <a href="{{ route('customer.god-reports.download', ['itemId' => $item['id'], 'format' => 'pdf']) }}" class="inline-flex items-center gap-2 rounded-md border border-[#d8dfd9] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#385642] hover:bg-[#f3f7f1]"><i data-lucide="file-down" class="h-4 w-4"></i>PDF</a>
                        </div>
                    @else
                        <div class="mt-5 rounded-md bg-[#f7f8f4] px-4 py-3 text-sm leading-6 text-[#64716a]">{{ __('customer.report_in_queue') }}</div>
                    @endif
                </article>
            @endforeach
        </div>
    </section>
@endif

<section class="customer-panel overflow-hidden">
    <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div class="bg-white p-6 sm:p-8">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.growth_diagnosis', ['brand' => $brandLabel]) }}</p>
            <h1 class="mt-3 max-w-4xl text-3xl font-semibold tracking-normal text-[#17201b] sm:text-4xl">
                @if($isMockFulfillment)
                    {{ __('customer.hero_mock', ['brand' => $brandLabel]) }}
                @elseif($isFailedFulfillment)
                    {{ __('customer.hero_failed', ['brand' => $brandLabel]) }}
                @else
                    {{ __('customer.hero_score', ['brand' => $brandLabel, 'score' => $scoreLabel, 'band' => $visibilityBand['label']]) }}
                @endif
            </h1>
            <p class="mt-4 max-w-3xl text-base leading-7 text-[#4f5d55]">
                {{ $topProblem }} {{ $recommendedAction }}
            </p>
            <div class="mt-6 flex flex-wrap gap-3">
                <a href="#solutions" class="inline-flex items-center gap-2 rounded-md bg-[#17201b] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2f3b34]">
                    <i data-lucide="list-checks" class="h-4 w-4"></i>
                    {{ __('customer.view_actions') }}
                </a>
                <a href="#score-detail" class="inline-flex items-center gap-2 rounded-md border border-[#d8dfd9] bg-white px-4 py-2.5 text-sm font-semibold text-[#385642] hover:bg-[#f3f7f1]">
                    <i data-lucide="calculator" class="h-4 w-4"></i>
                    {{ __('customer.score_explainer') }}
                </a>
            </div>
        </div>
        <aside class="bg-[#f7f8f4] p-6 sm:p-8">
            <p class="text-sm font-semibold text-[#64716a]">{{ __('customer.sample_title') }}</p>
            <div class="mt-5 grid grid-cols-2 gap-3">
                <div>
                    <div class="text-3xl font-semibold text-[#17201b]">{{ $summary['tracked_prompts'] }}</div>
                    <div class="mt-1 text-sm text-[#64716a]">{{ __('customer.tracked_questions') }}</div>
                </div>
                <div>
                    <div class="text-3xl font-semibold text-[#17201b]">{{ (int) ($coverage['parsed_answers'] ?? $components['parsed_count'] ?? 0) ?: __('customer.pending_data') }}</div>
                    <div class="mt-1 text-sm text-[#64716a]">{{ __('customer.parsed_answers') }}</div>
                </div>
                <div>
                    <div class="text-3xl font-semibold text-[#17201b]">{{ $summary['source_gaps'] }}</div>
                    <div class="mt-1 text-sm text-[#64716a]">{{ __('customer.priority_gaps') }}</div>
                </div>
                <div>
                    <div class="text-3xl font-semibold text-[#17201b]">{{ $summary['retest_reports'] }}</div>
                    <div class="mt-1 text-sm text-[#64716a]">{{ __('customer.completed_retests') }}</div>
                </div>
            </div>
            <p class="mt-5 text-xs leading-5 text-[#64716a]">
                {{ __('customer.score_disclaimer') }}
            </p>
        </aside>
    </div>
</section>

<section id="score-detail" class="mt-5 grid gap-5 lg:grid-cols-3">
    @foreach ($scoreCards as $card)
        <article class="customer-panel p-5">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#64716a]">{{ $card['direction'] }}</p>
                    <h2 class="mt-2 text-lg font-semibold text-[#17201b]">{{ $card['title'] }}</h2>
                </div>
                <span class="rounded-full px-2.5 py-1 text-xs font-semibold {{ $card['band']['class'] }}">{{ $card['band']['label'] }}</span>
            </div>
            <div class="mt-5 flex items-end gap-2">
                <div class="text-5xl font-semibold {{ $card['band']['tone'] }}">{{ is_numeric($card['score']) ? $fmt($card['score'], 2) : __('customer.pending_data') }}</div>
                <div class="pb-2 text-sm font-semibold text-[#64716a]">/100</div>
            </div>
            <p class="mt-4 text-sm leading-6 text-[#4f5d55]">{{ $card['meaning'] }}</p>
            <div class="mt-4 rounded-md bg-[#f7f8f4] p-3 text-xs leading-5 text-[#64716a]">
                <div class="font-semibold text-[#17201b]">{{ __('customer.calculation') }}</div>
                <div class="mt-1">{{ $card['formula'] }}</div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-2">
                @foreach ($card['components'] as $component)
                    <div class="rounded-md border border-[#d8dfd9] bg-white px-3 py-2">
                        <div class="text-xs text-[#64716a]">{{ $component['label'] }}</div>
                        <div class="mt-1 text-sm font-semibold text-[#17201b]">{{ $component['value'] }}</div>
                    </div>
                @endforeach
            </div>
        </article>
    @endforeach
</section>

<section id="problems" class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
    <div class="customer-panel p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.section_problem_label') }}</p>
                <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.section_problem_title') }}</h2>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-[#64716a]">{{ __('customer.section_problem_detail') }}</p>
            </div>
            <a href="{{ route('customer.campaigns.create') }}" class="inline-flex items-center gap-2 rounded-md border border-[#d8dfd9] bg-white px-3 py-2 text-sm font-semibold text-[#385642] hover:bg-[#f3f7f1]">
                <i data-lucide="plus" class="h-4 w-4"></i>
                {{ __('customer.create_content_plan') }}
            </a>
        </div>
        <div class="mt-5 space-y-3">
            @foreach ($opportunities as $opportunity)
                <article class="rounded-lg border border-[#d8dfd9] bg-white p-4">
                    <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div class="min-w-0">
                            <span class="rounded-full bg-[#f7f8f4] px-2.5 py-1 text-xs font-semibold text-[#64716a]">{{ $opportunity['type'] }}</span>
                            <h3 class="mt-3 text-base font-semibold text-[#17201b]">{{ $opportunity['title'] }}</h3>
                            <p class="mt-2 text-sm leading-6 text-[#64716a]">{{ $opportunity['impact'] }}</p>
                            @if(! empty($opportunity['prompt_examples']))
                                <div class="mt-3 space-y-1 text-xs text-[#64716a]">
                                    @foreach ($opportunity['prompt_examples'] as $prompt)
                                        <div class="rounded-md bg-[#f7f8f4] px-3 py-2">{{ __('customer.affected_prompt', ['prompt' => $prompt]) }}</div>
                                    @endforeach
                                </div>
                            @endif
                        </div>
                        @if (! empty($opportunity['can_handoff']))
                            <form method="POST" action="{{ route('customer.aivgl-campaigns.store') }}" class="shrink-0">
                                @csrf
                                <input type="hidden" name="opportunity_id" value="{{ $opportunity['opportunity_id'] ?? '' }}">
                                <input type="hidden" name="opportunity_key" value="{{ $opportunity['opportunity_key'] ?? '' }}">
                                <input type="hidden" name="brief_id" value="{{ $opportunity['brief_id'] ?? '' }}">
                                <input type="hidden" name="brief_key" value="{{ $opportunity['brief_key'] ?? '' }}">
                                <button type="submit" class="inline-flex items-center gap-1.5 rounded-md bg-[#17201b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2f3b34]">
                                    <i data-lucide="sparkles" class="h-3.5 w-3.5"></i>
                                    {{ __('customer.generate_three_plans') }}
                                </button>
                            </form>
                        @else
                            <a href="{{ $opportunity['href'] }}" class="shrink-0 rounded-md bg-[#e6eee7] px-3 py-2 text-xs font-semibold text-[#385642] hover:bg-[#d6e5da]">{{ $opportunity['action'] }}</a>
                        @endif
                    </div>
                </article>
            @endforeach
        </div>
    </div>

    <div id="solutions" class="customer-panel p-6">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#255a8a]">{{ __('customer.section_solution_label') }}</p>
        <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.section_solution_title') }}</h2>
        <div class="mt-5 space-y-3">
            <div class="rounded-lg border border-[#d8dfd9] bg-white p-4">
                <div class="font-semibold text-[#17201b]">{{ __('customer.solution_compare_title') }}</div>
                <p class="mt-2 text-sm leading-6 text-[#64716a]">{{ __('customer.solution_compare_detail', ['brand' => $brandLabel]) }}</p>
            </div>
            <div class="rounded-lg border border-[#d8dfd9] bg-white p-4">
                <div class="font-semibold text-[#17201b]">{{ __('customer.solution_facts_title') }}</div>
                <p class="mt-2 text-sm leading-6 text-[#64716a]">{{ __('customer.solution_facts_detail') }}</p>
            </div>
            <div class="rounded-lg border border-[#d8dfd9] bg-white p-4">
                <div class="font-semibold text-[#17201b]">{{ __('customer.solution_retest_title') }}</div>
                <p class="mt-2 text-sm leading-6 text-[#64716a]">{{ __('customer.solution_retest_detail', ['brand' => $brandLabel]) }}</p>
            </div>
        </div>
    </div>
</section>

<section id="articles" class="mt-5 customer-panel p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.section_retest_label') }}</p>
            <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.section_retest_title') }}</h2>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-[#64716a]">{{ __('customer.section_retest_detail') }}</p>
        </div>
    </div>
    <div class="mt-5 grid gap-3 lg:grid-cols-2">
        @forelse ($articleFeedback as $item)
            @php
                $delta = $item['delta'];
                $deltaClass = is_numeric($delta) && (float) $delta > 0
                    ? 'text-[#0f766e]'
                    : (is_numeric($delta) && (float) $delta < 0 ? 'text-[#b42318]' : 'text-[#64716a]');
                $deltaLabel = is_numeric($delta)
                    ? (((float) $delta > 0 ? '+' : '').rtrim(rtrim(number_format((float) $delta, 2), '0'), '.'))
                    : __('customer.retest_pending');
                $statusLabel = match ((string) $item['retest_status']) {
                    'completed' => __('customer.retest_completed'),
                    'scheduled' => __('customer.retest_scheduled'),
                    'running' => __('customer.retest_running'),
                    default => __('customer.retest_waiting'),
                };
            @endphp
            <article class="min-w-0 overflow-hidden rounded-lg border border-[#d8dfd9] bg-white p-4">
                <div class="flex min-w-0 flex-col items-start gap-4 sm:flex-row sm:justify-between">
                    <div class="min-w-0 max-w-full">
                        <div class="break-words text-xs font-semibold uppercase tracking-[0.12em] text-[#64716a]">{{ $item['campaign'] }}</div>
                        <div class="mt-2 truncate text-sm font-semibold text-[#17201b]">{{ $item['title'] }}</div>
                        <div class="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                            <span class="rounded-full bg-[#f7f8f4] px-2.5 py-1 text-[#64716a]">{{ $statusLabel }}</span>
                            @if($item['outcome'] !== '')
                                <span class="rounded-full bg-[#e8f5f1] px-2.5 py-1 text-[#0f766e]">{{ $item['outcome'] === 'improved' ? __('customer.outcome_improved') : $item['outcome'] }}</span>
                            @endif
                        </div>
                    </div>
                    <div class="shrink-0 text-left sm:text-right">
                        <div class="text-xs font-semibold text-[#64716a]">{{ $item['metric_title'] === 'Visibility' ? __('customer.metric_visibility') : $item['metric_title'] }}</div>
                        <div class="mt-1 text-2xl font-semibold {{ $deltaClass }}">{{ $deltaLabel }}</div>
                    </div>
                </div>
                @if(is_numeric($item['before']) || is_numeric($item['after']))
                    <div class="mt-3 text-xs text-[#64716a]">
                        {{ __('customer.before_publish', ['value' => is_numeric($item['before']) ? rtrim(rtrim(number_format((float) $item['before'], 2), '0'), '.') : __('customer.not_available')]) }}
                        · {{ __('customer.after_publish', ['value' => is_numeric($item['after']) ? rtrim(rtrim(number_format((float) $item['after'], 2), '0'), '.') : __('customer.not_available')]) }}
                    </div>
                @endif
                @if($item['headline'] !== '')
                    <p class="mt-3 text-sm leading-6 text-[#64716a]">{{ $item['headline'] }}</p>
                @endif
            </article>
        @empty
            <div class="rounded-lg border border-dashed border-[#c7d0c8] bg-[#f7f8f4] p-5 text-sm leading-6 text-[#64716a] lg:col-span-2">
                {{ __('customer.retest_empty') }}
            </div>
        @endforelse
    </div>
</section>

<section class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <div class="customer-panel p-6">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#255a8a]">{{ __('customer.section_evidence_label') }}</p>
        <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.section_evidence_title') }}</h2>
        <div class="mt-5 space-y-3">
            @forelse ($highlightedAnswers as $answer)
                <div class="rounded-lg border border-[#d8dfd9] bg-white p-4">
                    <div class="text-sm font-semibold text-[#17201b]">{{ $answer['prompt_text'] !== '' ? $answer['prompt_text'] : __('customer.sample_prompt') }}</div>
                    <div class="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                        <span class="rounded-full bg-[#f7f8f4] px-2.5 py-1 text-[#64716a]">{{ __('customer.model_label', ['model' => $answer['model_id'] ?: __('customer.unknown')]) }}</span>
                        <span class="rounded-full {{ $answer['brand_mentioned'] ? 'bg-[#e8f5f1] text-[#0f766e]' : 'bg-[#fde8e8] text-[#b42318]' }} px-2.5 py-1">{{ $answer['brand_mentioned'] ? __('customer.brand_mentioned') : __('customer.brand_not_mentioned') }}</span>
                        <span class="rounded-full bg-[#f7f8f4] px-2.5 py-1 text-[#64716a]">{{ __('customer.source_count', ['count' => (int) $answer['source_url_count']]) }}</span>
                        <span class="rounded-full bg-[#f7f8f4] px-2.5 py-1 text-[#64716a]">{{ __('customer.official_source_count', ['count' => (int) $answer['official_source_count']]) }}</span>
                    </div>
                </div>
            @empty
                <div class="rounded-lg border border-dashed border-[#c7d0c8] bg-[#f7f8f4] p-5 text-sm leading-6 text-[#64716a]">
                    {{ __('customer.evidence_empty') }}
                </div>
            @endforelse
        </div>
    </div>

    <details class="customer-panel p-6">
        <summary class="cursor-pointer list-none">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#64716a]">{{ __('customer.section_technical_label') }}</p>
            <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.section_technical_title') }}</h2>
            <p class="mt-2 text-sm leading-6 text-[#64716a]">{{ __('customer.section_technical_detail') }}</p>
        </summary>
        <div class="mt-5 space-y-3">
            @forelse ($providerRuns as $provider)
                @php
                    $providerStatus = (string) ($provider['status'] ?? 'unknown');
                    $providerKey = (string) ($provider['provider'] ?? $provider['name'] ?? 'provider');
                    $reasonKey = (string) ($provider['reason'] ?? '');
                @endphp
                <div class="rounded-lg border border-[#d8dfd9] bg-white p-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <div class="font-semibold text-[#17201b]">{{ $providerLabels[$providerKey] ?? str_replace('_', ' ', $providerKey) }}</div>
                        <span class="rounded-full bg-[#f7f8f4] px-2.5 py-1 text-xs font-semibold text-[#64716a]">{{ $providerStatusLabels[$providerStatus] ?? __('customer.pending_confirmation') }}</span>
                    </div>
                    <div class="mt-2 text-sm text-[#64716a]">
                        {{ __('customer.evidence_count', ['count' => (int) ($provider['item_count'] ?? $provider['items_count'] ?? 0)]) }}
                        @if ($reasonKey !== '')
                            · {{ $providerReasonLabels[$reasonKey] ?? __('customer.provider_no_data') }}
                        @endif
                    </div>
                </div>
            @empty
                <div class="rounded-lg border border-dashed border-[#c7d0c8] bg-[#f7f8f4] p-5 text-sm leading-6 text-[#64716a]">
                    {{ __('customer.provider_empty') }}
                </div>
            @endforelse
        </div>
    </details>
</section>
@endsection

@if(($billingLedger['has_contract'] ?? false) === true && ($billingLedger['access_mode'] ?? 'read_only') === 'active' && $checkoutEmail !== '')
@push('scripts')
<script src="https://www.paypal.com/sdk/js?client-id=AUV8CeBJ8uVpjyuLdAAiwrCewRuJ4HjCtz-upTGtv5SX2H9N6oFVg4rxukDKVtRLAwIKkhW_Aw9tejyN&components=buttons,hosted-buttons&vault=true&intent=subscription&currency=USD"></script>
<script>
(() => {
    const apiBase = @json(rtrim((string) config('services.cowtech.api_base_url', ''), '/').'/api');
    const account = {
        email: @json($checkoutEmail),
        brand: @json($brandLabel),
    };
    const copy = {
        prepare: @json(__('customer.addon_prepare')),
        preparing: @json(__('customer.addon_preparing')),
        ready: @json(__('customer.addon_ready')),
        unavailable: @json(__('customer.addon_unavailable')),
        orderFailed: @json(__('customer.addon_order_failed')),
        paymentFailed: @json(__('customer.addon_payment_failed')),
        approved: @json(__('customer.addon_payment_approved')),
    };

    const setMessage = (card, message, error = false) => {
        const node = card.querySelector('[data-addon-message]');
        if (!node) return;
        node.textContent = message;
        node.classList.toggle('text-[#b42318]', error);
        node.classList.toggle('text-[#64716a]', !error);
    };

    const createOrder = async (code, period) => {
        const response = await fetch(`${apiBase}/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: account.email,
                brand: account.brand,
                pkg: code,
                period,
                llms: [],
            }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || !result.order_id) {
            throw new Error(result.error || copy.orderFailed);
        }
        return result.order_id;
    };

    const configureHostedCheckout = (card, hostedButtonId) => {
        const button = card.querySelector('[data-addon-prepare]');
        const target = card.querySelector('[data-addon-target]');
        button.disabled = false;
        button.textContent = copy.prepare;
        button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = copy.preparing;
            setMessage(card, copy.preparing);
            try {
                await createOrder(card.dataset.addonCode, 'one_time');
                if (!window.paypal?.HostedButtons) throw new Error(copy.unavailable);
                target.replaceChildren();
                await window.paypal.HostedButtons({ hostedButtonId }).render(target);
                button.hidden = true;
                setMessage(card, copy.ready);
            } catch (error) {
                button.disabled = false;
                button.textContent = copy.prepare;
                setMessage(card, error.message || copy.orderFailed, true);
            }
        });
    };

    const configureSubscriptionCheckout = (card, planId) => {
        if (!window.paypal?.Buttons || !planId) {
            setMessage(card, copy.unavailable, true);
            return;
        }
        let orderId = '';
        window.paypal.Buttons({
            style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'paypal', height: 44 },
            createSubscription: async (_data, actions) => {
                setMessage(card, copy.preparing);
                orderId = await createOrder(card.dataset.addonCode, 'monthly');
                return actions.subscription.create({ plan_id: planId, custom_id: orderId });
            },
            onApprove: () => {
                setMessage(card, copy.approved);
                window.setTimeout(() => window.location.reload(), 4000);
            },
            onError: () => setMessage(card, copy.paymentFailed, true),
            onCancel: () => setMessage(card, copy.paymentFailed, true),
        }).render('#paypal-dashboard-competitor-extra');
    };

    const initialize = async () => {
        const cards = [...document.querySelectorAll('[data-addon-code]')];
        try {
            const response = await fetch(`${apiBase}/paypal/public-config`);
            const config = await response.json();
            if (!response.ok || !config.ok) throw new Error(copy.unavailable);
            cards.forEach(card => {
                const addon = config.addons?.[card.dataset.addonCode];
                if (card.dataset.addonKind === 'hosted' && addon?.configured && addon.hosted_button_id) {
                    configureHostedCheckout(card, addon.hosted_button_id);
                    setMessage(card, '');
                    return;
                }
                if (card.dataset.addonKind === 'subscription' && addon?.configured && addon.plan_id) {
                    configureSubscriptionCheckout(card, addon.plan_id);
                    setMessage(card, '');
                    return;
                }
                setMessage(card, copy.unavailable, true);
            });
        } catch (_error) {
            cards.forEach(card => {
                const button = card.querySelector('[data-addon-prepare]');
                if (button) button.disabled = true;
                setMessage(card, copy.unavailable, true);
            });
        }
    };

    initialize();
})();
</script>
@endpush
@endif

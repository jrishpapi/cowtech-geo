@extends('customer.layouts.app')

@section('content')
@php
    $type = (string) ($report['deliverable_type'] ?? $item['item_type'] ?? '');
    $isCompetitor = $type === 'competitor_deep_report';
    $brand = is_array($report['brand'] ?? null) ? $report['brand'] : [];
    $measurement = is_array($report['measurement'] ?? null) ? $report['measurement'] : [];
    $scorecards = is_array($report['scorecards'] ?? null) ? $report['scorecards'] : [];
    $trend = is_array($report['trend'] ?? null) ? $report['trend'] : [];
    $status = (string) ($report['status'] ?? 'evidence_limited');
    $deliveryReady = (bool) ($report['customer_delivery_ready'] ?? false);
    $competitors = is_array($report['competitors'] ?? null) ? array_slice($report['competitors'], 0, 10) : [];
    $evidence = is_array($report['evidence_highlights'] ?? null)
        ? array_slice($report['evidence_highlights'], 0, 6)
        : (is_array($report['evidence_register'] ?? null) ? array_slice($report['evidence_register'], 0, 10) : []);
    $priorityGaps = is_array($report['priority_gaps'] ?? null) ? array_slice($report['priority_gaps'], 0, 5) : [];
    $actionPlan = is_array($report['action_plan'] ?? null)
        ? array_slice($report['action_plan'], 0, 3)
        : (is_array($report['roadmap_90_days'] ?? null) ? array_slice($report['roadmap_90_days'], 0, 3) : []);
    $priorities = is_array($report['strategic_priorities'] ?? null) ? array_slice($report['strategic_priorities'], 0, 3) : [];
    $risks = is_array($report['risk_register'] ?? null) ? array_slice($report['risk_register'], 0, 8) : [];
    $guardrails = is_array($report['guardrails'] ?? null) ? $report['guardrails'] : [];
    $methodology = is_array($measurement['methodology'] ?? null) ? $measurement['methodology'] : [];
    $decisionBrief = is_array($report['decision_brief'] ?? null) ? $report['decision_brief'] : [];
    $summary = is_array($report['competitive_summary'] ?? null) ? $report['competitive_summary'] : [];
    $fmt = static fn ($value, int $decimals = 0): string => is_numeric($value)
        ? rtrim(rtrim(number_format((float) $value, $decimals), '0'), '.')
        : '—';
    $scoreMeta = [
        'visibility' => ['label' => __('customer.metric_visibility'), 'direction' => __('customer.direction_higher')],
        'source_quality' => ['label' => __('customer.metric_source_quality'), 'direction' => __('customer.direction_higher')],
        'competitor_pressure' => ['label' => __('customer.metric_competitor_pressure'), 'direction' => __('customer.direction_lower')],
    ];
    $statusTone = match ($status) {
        'ready' => 'border-[#b7e4d2] bg-[#e8f5f1] text-[#0f5f46]',
        'validation_only' => 'border-[#bfd3f2] bg-[#eef5ff] text-[#255a8a]',
        default => 'border-[#f4d48b] bg-[#fff8e7] text-[#8a5b12]',
    };
    $statusLabel = match ($status) {
        'ready' => __('customer.gr_ready'),
        'validation_only' => __('customer.gr_validation'),
        'insufficient_evidence' => __('customer.gr_insufficient'),
        default => __('customer.gr_limited'),
    };
@endphp

<section class="customer-panel overflow-hidden">
    <div class="border-b border-[#d8dfd9] bg-[#17201b] px-6 py-8 text-white sm:px-10 sm:py-11">
        <div class="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div class="max-w-4xl">
                <a href="{{ route('customer.dashboard') }}" class="inline-flex items-center gap-2 text-sm font-semibold text-[#b7d7c2] hover:text-white">
                    <i data-lucide="arrow-left" class="h-4 w-4"></i>
                    {{ __('customer.lp_back_workspace') }}
                </a>
                <div class="mt-7 flex flex-wrap items-center gap-2">
                    <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">God Mode</span>
                    <span class="rounded-full border px-3 py-1 text-xs font-semibold {{ $statusTone }}">{{ $statusLabel }}</span>
                    <span class="text-xs text-white/55">{{ $item['cycle_month'] ?? '' }} · {{ $report['generated_at'] ?? $item['completed_at'] ?? '' }}</span>
                </div>
                <p class="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[#8fc4a7]">
                    {{ $isCompetitor ? __('customer.gr_competitive_brief') : __('customer.gr_strategy_memo') }}
                </p>
                <h1 class="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-normal sm:text-5xl">
                    {{ $report['title'] ?? __('customer.gr_default_title') }}
                </h1>
                <p class="mt-5 max-w-3xl text-base leading-7 text-white/75 sm:text-lg">
                    {{ $report['executive_summary'] ?? __('customer.gr_summary_pending') }}
                </p>
            </div>
            <div class="flex shrink-0 flex-wrap gap-2">
                <a href="{{ route('customer.god-reports.download', ['itemId' => $item['id'], 'format' => 'md']) }}" class="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20">
                    <i data-lucide="file-text" class="h-4 w-4"></i>
                    Markdown
                </a>
                <a href="{{ route('customer.god-reports.download', ['itemId' => $item['id'], 'format' => 'pdf']) }}" class="inline-flex items-center gap-2 rounded-md bg-[#e6eee7] px-4 py-2.5 text-sm font-semibold text-[#17201b] hover:bg-white">
                    <i data-lucide="file-down" class="h-4 w-4"></i>
                    PDF
                </a>
            </div>
        </div>
    </div>

    @if(! $deliveryReady)
        <div class="border-b border-[#f4d48b] bg-[#fff8e7] px-6 py-4 text-sm leading-6 text-[#8a5b12] sm:px-10">
            <div class="flex items-start gap-3">
                <i data-lucide="triangle-alert" class="mt-0.5 h-4 w-4 shrink-0"></i>
                <p>{{ __('customer.gr_boundary') }}</p>
            </div>
        </div>
    @endif

    <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-3">
        @foreach($scoreMeta as $key => $meta)
            @php
                $card = is_array($scorecards[$key] ?? null) ? $scorecards[$key] : [];
                $delta = $card['delta_from_previous_run'] ?? null;
                $isPositive = $key === 'competitor_pressure' ? (is_numeric($delta) && $delta < 0) : (is_numeric($delta) && $delta > 0);
            @endphp
            <article class="bg-white px-6 py-6 sm:px-8">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#64716a]">{{ $meta['direction'] }}</p>
                        <h2 class="mt-2 text-lg font-semibold text-[#17201b]">{{ $meta['label'] }}</h2>
                    </div>
                    <span class="rounded-full bg-[#f3f7f1] px-2.5 py-1 text-xs font-semibold text-[#385642]">{{ str_replace('_', ' ', $card['band'] ?? 'not measured') }}</span>
                </div>
                <div class="mt-6 flex items-end gap-2">
                    <div class="text-5xl font-semibold text-[#17201b]">{{ $fmt($card['score'] ?? null, 1) }}</div>
                    <div class="pb-2 text-sm font-semibold text-[#64716a]">/100</div>
                </div>
                <p class="mt-3 text-xs font-semibold {{ $isPositive ? 'text-[#0f766e]' : 'text-[#64716a]' }}">
                    @if(is_numeric($delta))
                        {{ __('customer.gr_vs_previous', ['value' => ((float) $delta > 0 ? '+' : '').$fmt($delta, 1)]) }}
                    @else
                        {{ __('customer.gr_no_baseline') }}
                    @endif
                </p>
            </article>
        @endforeach
    </div>
</section>

<section class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
    <div class="customer-panel p-6 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.gr_measurement_frame') }}</p>
        <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.gr_measurement_title') }}</h2>
        <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-md bg-[#f7f8f4] p-4">
                <div class="text-2xl font-semibold text-[#17201b]">{{ (int) ($measurement['parsed_answer_count'] ?? 0) }}</div>
                <div class="mt-1 text-xs text-[#64716a]">{{ __('customer.parsed_answers') }}</div>
            </div>
            <div class="rounded-md bg-[#f7f8f4] p-4">
                <div class="text-2xl font-semibold text-[#17201b]">{{ (int) ($measurement['model_count'] ?? 0) }}</div>
                <div class="mt-1 text-xs text-[#64716a]">{{ __('customer.gr_model_rows') }}</div>
            </div>
            <div class="rounded-md bg-[#f7f8f4] p-4">
                <div class="text-2xl font-semibold text-[#17201b]">{{ (int) ($measurement['category_count'] ?? 0) }}</div>
                <div class="mt-1 text-xs text-[#64716a]">{{ __('customer.gr_prompt_categories') }}</div>
            </div>
            <div class="rounded-md bg-[#f7f8f4] p-4">
                <div class="text-2xl font-semibold text-[#17201b]">{{ $fmt($trend['brand_share_of_voice'] ?? 0, 1) }}%</div>
                <div class="mt-1 text-xs text-[#64716a]">{{ __('customer.gr_brand_sov') }}</div>
            </div>
        </div>
    </div>
    <aside class="customer-panel p-6 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#64716a]">{{ __('customer.gr_data_status') }}</p>
        <dl class="mt-5 space-y-4 text-sm">
            <div class="flex items-start justify-between gap-4"><dt class="text-[#64716a]">{{ __('customer.gr_mode') }}</dt><dd class="text-right font-semibold text-[#17201b]">{{ str_replace('_', ' ', $measurement['mode'] ?? __('customer.not_reported')) }}</dd></div>
            <div class="flex items-start justify-between gap-4"><dt class="text-[#64716a]">{{ __('customer.gr_score_meaning') }}</dt><dd class="text-right font-semibold text-[#17201b]">{{ str_replace('_', ' ', $measurement['score_meaning'] ?? __('customer.not_reported')) }}</dd></div>
            <div class="flex items-start justify-between gap-4"><dt class="text-[#64716a]">{{ __('customer.gr_parser_confidence') }}</dt><dd class="text-right font-semibold text-[#17201b]">{{ $fmt($measurement['average_parser_confidence'] ?? null, 2) }}</dd></div>
            <div class="flex items-start justify-between gap-4"><dt class="text-[#64716a]">{{ __('customer.gr_provider_live') }}</dt><dd class="text-right font-semibold text-[#17201b]">{{ ($measurement['provider_calls_live'] ?? false) ? __('customer.yes') : __('customer.no') }}</dd></div>
        </dl>
    </aside>
</section>

@if($isCompetitor)
    <section class="mt-5 customer-panel p-6 sm:p-8">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.gr_competitor_scoreboard') }}</p>
                <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.gr_competitor_title') }}</h2>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center text-xs text-[#64716a]">
                <div class="rounded-md bg-[#f7f8f4] px-3 py-2"><strong class="block text-base text-[#17201b]">{{ (int) ($summary['tracked_competitors'] ?? count($competitors)) }}</strong>{{ __('customer.gr_tracked') }}</div>
                <div class="rounded-md bg-[#f7f8f4] px-3 py-2"><strong class="block text-base text-[#17201b]">{{ (int) ($summary['competitor_mentions'] ?? 0) }}</strong>{{ __('customer.gr_mentions') }}</div>
                <div class="rounded-md bg-[#f7f8f4] px-3 py-2"><strong class="block text-base text-[#17201b]">{{ $fmt($summary['brand_share_of_voice_percent'] ?? 0, 1) }}%</strong>brand SOV</div>
            </div>
        </div>
        <div class="mt-6 overflow-x-auto">
            <table class="min-w-full text-left text-sm">
                <thead class="border-b border-[#d8dfd9] text-xs uppercase tracking-[0.12em] text-[#64716a]">
                    <tr><th class="px-3 py-3">{{ __('customer.gr_rank_competitor') }}</th><th class="px-3 py-3">{{ __('customer.gr_mentions') }}</th><th class="px-3 py-3">{{ __('customer.gr_answer_coverage') }}</th><th class="px-3 py-3">{{ __('customer.gr_share_voice') }}</th><th class="px-3 py-3">{{ __('customer.gr_pressure') }}</th></tr>
                </thead>
                <tbody class="divide-y divide-[#e5e9e5]">
                    @forelse($competitors as $competitor)
                        <tr>
                            <td class="px-3 py-4"><span class="mr-2 text-[#64716a]">#{{ (int) ($competitor['rank'] ?? 0) }}</span><strong class="text-[#17201b]">{{ $competitor['name'] ?? __('customer.gr_competitor_default') }}</strong><p class="mt-1 max-w-xl text-xs leading-5 text-[#64716a]">{{ $competitor['evidence_note'] ?? '' }}</p></td>
                            <td class="px-3 py-4 font-semibold text-[#17201b]">{{ (int) ($competitor['mention_count'] ?? 0) }}</td>
                            <td class="px-3 py-4 text-[#385642]">{{ $fmt($competitor['answer_coverage_percent'] ?? 0, 1) }}%</td>
                            <td class="px-3 py-4 text-[#385642]">{{ $fmt($competitor['share_of_voice_percent'] ?? 0, 1) }}%</td>
                            <td class="px-3 py-4"><span class="rounded-full bg-[#f3f7f1] px-2.5 py-1 text-xs font-semibold text-[#385642]">{{ str_replace('_', ' ', $competitor['pressure_level'] ?? 'not observed') }}</span></td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="px-3 py-8 text-center text-[#64716a]">{{ __('customer.gr_no_competitors') }}</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </section>
@elseif($decisionBrief !== [])
    <section class="mt-5 customer-panel overflow-hidden">
        <div class="grid gap-px bg-[#d8dfd9] lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div class="bg-white p-6 sm:p-8">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.gr_decision_brief') }}</p>
                <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.gr_decision_title') }}</h2>
                <p class="mt-5 text-lg leading-8 text-[#385642]">{{ $decisionBrief['strategic_thesis'] ?? '' }}</p>
                <div class="mt-6 rounded-md border-l-4 border-[#0f766e] bg-[#f7f8f4] p-4">
                    <div class="text-xs font-semibold uppercase tracking-[0.14em] text-[#64716a]">{{ __('customer.gr_first_decision') }}</div>
                    <div class="mt-2 text-base font-semibold leading-7 text-[#17201b]">{{ $decisionBrief['first_decision'] ?? '' }}</div>
                </div>
            </div>
            <aside class="bg-[#f7f8f4] p-6 sm:p-8">
                <div class="text-xs font-semibold uppercase tracking-[0.14em] text-[#64716a]">{{ __('customer.gr_primary_constraint') }}</div>
                <p class="mt-3 text-sm leading-6 text-[#385642]">{{ $decisionBrief['primary_constraint'] ?? '' }}</p>
                <div class="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[#64716a]">{{ __('customer.gr_current_position') }}</div>
                <p class="mt-3 text-sm leading-6 text-[#385642]">{{ $decisionBrief['current_position'] ?? '' }}</p>
            </aside>
        </div>
    </section>
@endif

@if($priorities !== [])
    <section class="mt-5 grid gap-5 lg:grid-cols-3">
        @foreach($priorities as $priority)
            <article class="customer-panel p-6">
                <div class="flex items-start justify-between gap-3">
                    <div><p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f766e]">{{ str_replace('_', ' ', $priority['priority'] ?? 'priority') }}</p><h3 class="mt-2 text-lg font-semibold text-[#17201b]">{{ $priority['objective'] ?? '' }}</h3></div>
                    <span class="rounded-full bg-[#f3f7f1] px-2.5 py-1 text-xs font-semibold text-[#385642]">{{ $fmt($priority['baseline'] ?? null, 1) }}</span>
                </div>
                <div class="mt-5 space-y-2">
                    @foreach(array_slice(is_array($priority['evidence'] ?? null) ? $priority['evidence'] : [], 0, 3) as $point)
                        <div class="flex gap-2 text-sm leading-6 text-[#64716a]"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f766e]"></span><span>{{ $point }}</span></div>
                    @endforeach
                </div>
                <div class="mt-5 border-t border-[#e5e9e5] pt-4 text-sm leading-6 text-[#385642]"><strong class="text-[#17201b]">{{ __('customer.gr_deliverable') }}</strong> {{ $priority['deliverable'] ?? '' }}</div>
                <div class="mt-2 text-xs leading-5 text-[#64716a]"><strong>{{ __('customer.gr_success') }}</strong> {{ $priority['success_metric'] ?? '' }}</div>
            </article>
        @endforeach
    </section>
@endif

@if($evidence !== [])
    <section class="mt-5 customer-panel p-6 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.gr_evidence_register') }}</p>
        <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.gr_evidence_title') }}</h2>
        <div class="mt-6 grid gap-4 lg:grid-cols-2">
            @foreach($evidence as $index => $entry)
                <article class="rounded-md border border-[#d8dfd9] bg-white p-5">
                    <div class="flex flex-wrap items-center gap-2 text-xs text-[#64716a]">
                        <span class="font-semibold text-[#0f766e]">EV-{{ str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT) }}</span>
                        <span>{{ $entry['provider'] ?? '' }} {{ $entry['model'] ?? '' }}</span>
                        <span>{{ $entry['category'] ?? $entry['type'] ?? '' }}</span>
                    </div>
                    <h3 class="mt-3 text-sm font-semibold leading-6 text-[#17201b]">{{ $entry['prompt'] ?? $entry['statement'] ?? __('customer.gr_measured_evidence') }}</h3>
                    <p class="mt-3 text-sm leading-6 text-[#64716a]">{{ $entry['answer_excerpt'] ?? $entry['observation'] ?? '' }}</p>
                    @if(array_key_exists('brand_mentioned', $entry))
                        <div class="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                            <span class="rounded-full bg-[#f3f7f1] px-2.5 py-1 text-[#385642]">{{ ($entry['brand_mentioned'] ?? false) ? __('customer.brand_mentioned') : __('customer.gr_brand_missing') }}</span>
                            <span class="rounded-full bg-[#f3f7f1] px-2.5 py-1 text-[#385642]">{{ __('customer.gr_competitor_mentions', ['count' => (int) ($entry['competitor_mentions'] ?? 0)]) }}</span>
                            <span class="rounded-full bg-[#f3f7f1] px-2.5 py-1 text-[#385642]">{{ __('customer.source_count', ['count' => (int) ($entry['source_url_count'] ?? 0)]) }}</span>
                        </div>
                    @endif
                </article>
            @endforeach
        </div>
    </section>
@endif

@if($priorityGaps !== [])
    <section class="mt-5 customer-panel p-6 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.gr_priority_gaps') }}</p>
        <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.gr_priority_title') }}</h2>
        <div class="mt-6 space-y-4">
            @foreach($priorityGaps as $gap)
                <article class="rounded-md border border-[#d8dfd9] bg-white p-5">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div class="max-w-3xl"><div class="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f766e]">#{{ (int) ($gap['order'] ?? 0) }} · {{ $gap['priority'] ?? 'priority' }}</div><h3 class="mt-2 text-lg font-semibold text-[#17201b]">{{ $gap['title'] ?? '' }}</h3><p class="mt-2 text-sm leading-6 text-[#64716a]">{{ $gap['description'] ?? '' }}</p></div>
                        <span class="shrink-0 rounded-md bg-[#f7f8f4] px-3 py-2 text-xs font-semibold text-[#385642]">{{ $gap['recommended_format'] ?? '' }}</span>
                    </div>
                    <div class="mt-4 grid gap-2 md:grid-cols-2">
                        @foreach(array_slice(is_array($gap['evidence'] ?? null) ? $gap['evidence'] : [], 0, 4) as $point)
                            <div class="rounded-md bg-[#f7f8f4] px-3 py-2 text-xs leading-5 text-[#64716a]">{{ $point }}</div>
                        @endforeach
                    </div>
                    <p class="mt-4 text-xs leading-5 text-[#385642]"><strong>{{ __('customer.gr_success_measure') }}</strong> {{ $gap['success_measure'] ?? '' }}</p>
                </article>
            @endforeach
        </div>
    </section>
@endif

@if($risks !== [])
    <section class="mt-5 customer-panel p-6 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#b42318]">{{ __('customer.gr_risk_register') }}</p>
        <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.gr_risk_title') }}</h2>
        <div class="mt-6 grid gap-3 md:grid-cols-2">
            @foreach($risks as $risk)
                <article class="rounded-md border border-[#ead6d2] bg-[#fffafa] p-4"><div class="text-xs font-semibold uppercase tracking-[0.12em] text-[#b42318]">{{ $risk['severity'] ?? 'risk' }}</div><h3 class="mt-2 text-sm font-semibold leading-6 text-[#17201b]">{{ $risk['risk'] ?? '' }}</h3><p class="mt-2 text-xs leading-5 text-[#64716a]">{{ $risk['evidence'] ?? '' }}</p><p class="mt-3 text-xs leading-5 text-[#385642]"><strong>{{ __('customer.gr_mitigation') }}</strong> {{ $risk['mitigation'] ?? '' }}</p></article>
            @endforeach
        </div>
    </section>
@endif

@if($actionPlan !== [])
    <section class="mt-5 customer-panel p-6 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e]">{{ __('customer.gr_action_plan') }}</p>
        <h2 class="mt-2 text-2xl font-semibold text-[#17201b]">{{ __('customer.gr_action_title') }}</h2>
        <div class="relative mt-7 space-y-4 before:absolute before:bottom-5 before:left-[18px] before:top-5 before:w-px before:bg-[#c8d2ca]">
            @foreach($actionPlan as $phase)
                @php
                    $phaseActions = is_array($phase['actions'] ?? null) ? $phase['actions'] : [];
                    if ($phaseActions === [] && ! empty($phase['action'])) { $phaseActions = [$phase['action']]; }
                @endphp
                <article class="relative pl-12">
                    <div class="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border border-[#b7d7c2] bg-[#eef5ef] text-xs font-semibold text-[#0f766e]">{{ $loop->iteration }}</div>
                    <div class="rounded-md border border-[#d8dfd9] bg-white p-5">
                        <div class="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><div class="text-xs font-semibold uppercase tracking-[0.14em] text-[#0f766e]">{{ str_replace('_', ' ', $phase['phase'] ?? 'phase') }}</div><h3 class="mt-2 text-lg font-semibold text-[#17201b]">{{ $phase['objective'] ?? $phase['action'] ?? '' }}</h3></div><span class="text-xs font-semibold text-[#64716a]">{{ $phase['owner'] ?? '' }}</span></div>
                        <div class="mt-4 space-y-2">@foreach(array_slice($phaseActions, 0, 5) as $phaseAction)<div class="flex gap-2 text-sm leading-6 text-[#64716a]"><span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f766e]"></span><span>{{ $phaseAction }}</span></div>@endforeach</div>
                        <div class="mt-5 grid gap-3 border-t border-[#e5e9e5] pt-4 md:grid-cols-2"><p class="text-xs leading-5 text-[#385642]"><strong>{{ __('customer.gr_deliverable') }}</strong> {{ $phase['deliverable'] ?? '' }}</p><p class="text-xs leading-5 text-[#385642]"><strong>{{ __('customer.gr_success') }}</strong> {{ $phase['success_metric'] ?? '' }}</p></div>
                    </div>
                </article>
            @endforeach
        </div>
    </section>
@endif

<section class="mt-5 customer-panel p-6 sm:p-8">
    <details>
        <summary class="cursor-pointer text-sm font-semibold text-[#385642]">{{ __('customer.gr_methodology') }}</summary>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
            @foreach(array_merge($methodology, $guardrails) as $note)
                <div class="rounded-md bg-[#f7f8f4] px-4 py-3 text-xs leading-5 text-[#64716a]">{{ $note }}</div>
            @endforeach
        </div>
    </details>
</section>
@endsection

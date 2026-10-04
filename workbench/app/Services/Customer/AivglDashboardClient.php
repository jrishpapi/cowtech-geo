<?php

namespace App\Services\Customer;

require_once __DIR__.'/../../Models/CustomerWorkspace.php';

use App\Models\CustomerWorkspace;
use Illuminate\Support\Facades\Http;

class AivglDashboardClient
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(?CustomerWorkspace $workspace = null): array
    {
        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        $isDemoSnapshot = ! $workspace instanceof CustomerWorkspace;
        $brandName = trim((string) ($workspace?->brand_name ?: config('services.aivgl.brand_name', 'Demo Brand')));
        $trackingRunId = trim((string) ($workspace?->aivgl_tracking_run_id ?: ($isDemoSnapshot ? config('services.aivgl.tracking_run_id', '') : '')));
        $discoveryRunId = trim((string) ($workspace?->aivgl_discovery_run_id ?: ($isDemoSnapshot ? config('services.aivgl.discovery_run_id', '') : '')));

        if ($baseUrl === '') {
            return $this->emptySnapshot('aivgl_base_url_missing', $brandName, $isDemoSnapshot);
        }

        if (! $isDemoSnapshot && $trackingRunId === '') {
            return $this->emptySnapshot('customer_tracking_run_missing', $brandName, false);
        }

        $query = array_filter([
            'brand_name' => $brandName !== '' ? $brandName : null,
            'run_id' => $trackingRunId !== '' ? $trackingRunId : null,
        ]);

        $responses = [];
        $errors = [];
        foreach ($this->endpoints($discoveryRunId) as $key => $endpoint) {
            $endpointQuery = $key === 'prompt_discovery'
                ? array_filter([
                    'brand_name' => $brandName !== '' ? $brandName : null,
                    'discovery_run_id' => $discoveryRunId !== '' ? $discoveryRunId : null,
                ])
                : $query;

            try {
                $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
                    ->acceptJson()
                    ->get($baseUrl.$endpoint, $endpointQuery);

                if (! $response->ok()) {
                    $errors[$key] = 'http_'.$response->status();
                    continue;
                }

                $responses[$key] = $response->json();
            } catch (\Throwable $exception) {
                $errors[$key] = $exception->getMessage();
            }
        }

        return $this->mapSnapshot($responses, $errors, [
            'brand_name' => $brandName,
            'tracking_run_id' => $trackingRunId,
            'discovery_run_id' => $discoveryRunId,
            'demo' => $isDemoSnapshot,
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function endpoints(string $discoveryRunId): array
    {
        return [
            'setup' => '/dashboard/setup-data',
            'billing_auth' => '/dashboard/billing-auth-data',
            'visibility' => '/dashboard/visibility-data',
            'opportunities' => '/dashboard/opportunities-data',
            'prompt_discovery' => '/dashboard/prompt-discovery-data',
            'briefs' => '/dashboard/briefs-data',
            'monthly_report' => '/dashboard/monthly-report-data',
            'article_review' => '/dashboard/article-review-data',
            'publish_handoff' => '/dashboard/publish-handoff-data',
            'retest' => '/dashboard/retest-data',
            'monitoring' => '/dashboard/monitoring-data',
            'monthly_fulfillment' => '/dashboard/monthly-fulfillment-data',
        ];
    }

    /**
     * @param  array<string, mixed>  $responses
     * @param  array<string, string>  $errors
     * @param  array<string, string>  $config
     * @return array<string, mixed>
     */
    private function mapSnapshot(array $responses, array $errors, array $config): array
    {
        $visibility = $responses['visibility']['visibility'] ?? [];
        $promptDiscovery = $responses['prompt_discovery']['prompt_discovery'] ?? [];
        $monitoring = $responses['monitoring']['monitoring'] ?? [];
        $monthlyFulfillment = $responses['monthly_fulfillment']['monthly_fulfillment'] ?? [];
        $billingAuth = $responses['billing_auth']['billing_auth'] ?? [];
        $fulfillment = $this->fulfillmentState($visibility, $monitoring, $errors);

        return [
            'connected' => $visibility !== [] || $promptDiscovery !== [] || $monitoring !== [],
            'status' => $errors === [] ? 'connected' : ($responses === [] ? 'unavailable' : 'partial'),
            'errors' => $errors,
            'demo' => (bool) ($config['demo'] ?? false),
            'brand' => $responses['setup']['setup']['brand'] ?? $visibility['brand'] ?? [
                'name' => $config['brand_name'],
            ],
            'configured_competitors' => collect($responses['setup']['setup']['competitors']['items'] ?? [])
                ->filter(fn ($item): bool => is_array($item) && trim((string) ($item['name'] ?? '')) !== '')
                ->map(fn (array $item): array => [
                    'name' => trim((string) $item['name']),
                    'website_url' => trim((string) ($item['website_url'] ?? '')),
                ])
                ->values()
                ->all(),
            'tracking_run_id' => $config['tracking_run_id'],
            'discovery_run_id' => $config['discovery_run_id'],
            'scores' => $this->scoreMap($visibility['scorecards'] ?? []),
            'scorecards' => $this->scorecards($visibility['scorecards'] ?? []),
            'score_components' => is_array($visibility['score_components'] ?? null) ? $visibility['score_components'] : [],
            'coverage' => is_array($visibility['coverage'] ?? null) ? $visibility['coverage'] : [],
            'measurement' => is_array($visibility['measurement'] ?? null) ? $visibility['measurement'] : [],
            'monitoring' => is_array($monitoring) ? $monitoring : [],
            'monthly_fulfillment' => is_array($monthlyFulfillment) ? $monthlyFulfillment : [],
            'billing_auth' => is_array($billingAuth) ? $billingAuth : [],
            'fulfillment' => $fulfillment,
            'source_mix' => is_array($visibility['source_mix'] ?? null) ? $visibility['source_mix'] : [],
            'highlighted_answers' => $this->highlightedAnswers($visibility['highlighted_answers'] ?? []),
            'evidence_records' => $this->evidenceRecords($visibility['evidence_records'] ?? []),
            'next_actions' => $this->nextActions($visibility['next_actions'] ?? []),
            'tracked_prompts' => (int) ($responses['setup']['setup']['prompts']['active_count'] ?? count($visibility['breakdowns']['categories'] ?? [])),
            'source_gaps' => (int) ($responses['opportunities']['opportunities']['summary']['high_priority_count']
                ?? $responses['opportunities']['opportunities']['summary']['opportunity_count']
                ?? 0),
            'opportunities' => $this->opportunities($responses['opportunities']['opportunities']['opportunities'] ?? [], (string) $config['brand_name']),
            'raw_opportunities' => $responses['opportunities']['opportunities']['opportunities'] ?? [],
            'opportunity_summary' => $responses['opportunities']['opportunities']['summary'] ?? [],
            'briefs' => $responses['briefs']['briefs']['briefs'] ?? [],
            'brief_summary' => $responses['briefs']['briefs']['summary'] ?? [],
            'article_review_summary' => $responses['article_review']['article_review']['summary'] ?? [],
            'publish_handoff_summary' => $responses['publish_handoff']['publish_handoff']['summary'] ?? [],
            'retest_summary' => $responses['retest']['retest']['summary'] ?? [],
            'retest_items' => $responses['retest']['retest']['retests'] ?? [],
            'article_retest_results' => $this->mapArticleRetestResults($responses['retest']['retest']['retests'] ?? []),
            'evidence_collection' => $promptDiscovery['evidence_collection'] ?? [
                'status' => 'not_reported',
                'provider_runs' => [],
                'summary' => [],
            ],
            'monthly_report' => $responses['monthly_report']['monthly_report']['customer_report'] ?? [],
            'generated_at' => $visibility['generated_at'] ?? $promptDiscovery['generated_at'] ?? null,
        ];
    }

    /**
     * @param  array<string, mixed>  $visibility
     * @param  array<string, mixed>  $monitoring
     * @param  array<string, string>  $errors
     * @return array<string, mixed>
     */
    private function fulfillmentState(array $visibility, array $monitoring, array $errors): array
    {
        $monitoringFulfillment = is_array($monitoring['fulfillment'] ?? null) ? $monitoring['fulfillment'] : [];
        $mode = trim((string) ($monitoringFulfillment['mode'] ?? ''));
        $measurement = is_array($visibility['measurement'] ?? null) ? $visibility['measurement'] : [];

        if ($mode === '' && ($measurement['score_meaning'] ?? '') === 'pipeline_validation') {
            $mode = 'mock_validation';
        }

        if ($mode === '') {
            $mode = $errors === [] ? 'pending' : 'partial';
        }

        $labels = [
            'live_monitoring' => '真实监控已开启',
            'mock_validation' => 'Mock 验证中',
            'pending_live_enablement' => '等待开启真实监控',
            'pending' => '等待配置',
            'failed' => '履约失败',
            'partial' => '部分数据可用',
        ];
        $descriptions = [
            'live_monitoring' => '当前至少一个 surface 已启用真实 provider 调用，可作为真实 web-grounded monitoring 履约展示。',
            'mock_validation' => '当前数据来自 mock validation，只能证明流程和排程已配置，不能当作真实 AI / web-grounded 可见度结果。',
            'pending_live_enablement' => '监控 surface 已配置，但真实 provider 调用尚未开启，不能展示为真实履约完成。',
            'pending' => '系统还在等待 first run 或 monitoring config 完成。',
            'failed' => '监控配置或执行失败，需要内部处理后再向客户展示履约结果。',
            'partial' => '部分 AIVGL 数据可用，但状态不完整，需要谨慎展示。',
        ];

        return [
            'mode' => $mode,
            'label' => $labels[$mode] ?? '状态待确认',
            'description' => $descriptions[$mode] ?? '履约状态尚未完整同步。',
            'real_provider_calls_enabled' => (bool) ($monitoringFulfillment['real_provider_calls_enabled'] ?? false),
            'mock_surface_count' => (int) ($monitoringFulfillment['mock_surface_count'] ?? 0),
            'live_surface_count' => (int) ($monitoringFulfillment['live_surface_count'] ?? 0),
            'pending_surface_count' => (int) ($monitoringFulfillment['pending_surface_count'] ?? 0),
            'failed_surface_count' => (int) ($monitoringFulfillment['failed_surface_count'] ?? 0),
            'configured_surface_count' => (int) ($monitoring['production_cycle']['summary']['configured_surface_count'] ?? 0),
            'active_surface_count' => (int) ($monitoring['production_cycle']['summary']['active_surface_count'] ?? 0),
            'score_meaning' => (string) ($measurement['score_meaning'] ?? ''),
            'measurement_mode' => (string) ($measurement['mode'] ?? ''),
            'customer_message' => (string) ($monitoringFulfillment['customer_message'] ?? ''),
            'live_provider_gate' => is_array($monitoringFulfillment['live_provider_gate'] ?? null)
                ? $monitoringFulfillment['live_provider_gate']
                : [],
            'live_provider_blockers' => is_array($monitoringFulfillment['live_provider_gate']['blockers'] ?? null)
                ? array_values($monitoringFulfillment['live_provider_gate']['blockers'])
                : [],
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $scorecards
     * @return array<string, float|null>
     */
    private function scoreMap(array $scorecards): array
    {
        $scores = [
            'visibility' => null,
            'source_quality' => null,
            'competitor_pressure' => null,
        ];

        foreach ($scorecards as $scorecard) {
            $key = (string) ($scorecard['key'] ?? '');
            if (array_key_exists($key, $scores)) {
                $scores[$key] = is_numeric($scorecard['score'] ?? null) ? (float) $scorecard['score'] : null;
            }
        }

        return $scores;
    }

    /**
     * @param  list<array<string, mixed>>|array<string, mixed>  $scorecards
     * @return list<array<string, mixed>>
     */
    private function scorecards(array $scorecards): array
    {
        return collect($scorecards)
            ->filter(fn ($scorecard): bool => is_array($scorecard))
            ->map(function (array $scorecard): array {
                $key = (string) ($scorecard['key'] ?? '');

                return [
                    'key' => $key,
                    'score' => is_numeric($scorecard['score'] ?? null) ? (float) $scorecard['score'] : null,
                    'status' => (string) ($scorecard['status'] ?? ''),
                    'direction' => (string) ($scorecard['direction'] ?? ($key === 'competitor_pressure' ? 'lower_is_better' : 'higher_is_better')),
                    'label' => (string) ($scorecard['label'] ?? $scorecard['title'] ?? $key),
                    'explanation' => (string) ($scorecard['explanation'] ?? ''),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function highlightedAnswers(array $items): array
    {
        return collect($items)
            ->filter(fn ($item): bool => is_array($item))
            ->take(4)
            ->map(static function (array $item): array {
                return [
                    'result_id' => (string) ($item['result_id'] ?? ''),
                    'provider_id' => (string) ($item['provider_id'] ?? ''),
                    'prompt_text' => (string) ($item['prompt_text'] ?? ''),
                    'model_id' => (string) ($item['model_id'] ?? ''),
                    'category' => (string) ($item['category'] ?? ''),
                    'answer_excerpt' => (string) ($item['answer_excerpt'] ?? ''),
                    'brand_mentioned' => (bool) ($item['brand_mentioned'] ?? false),
                    'competitor_mentions' => is_numeric($item['competitor_mentions'] ?? null) ? (float) $item['competitor_mentions'] : 0,
                    'source_url_count' => is_numeric($item['source_url_count'] ?? null) ? (float) $item['source_url_count'] : 0,
                    'official_source_count' => is_numeric($item['official_source_count'] ?? null) ? (float) $item['official_source_count'] : 0,
                    'sources' => is_array($item['sources'] ?? null) ? array_slice($item['sources'], 0, 20) : [],
                    'competitors' => is_array($item['competitors'] ?? null) ? array_slice($item['competitors'], 0, 10) : [],
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function evidenceRecords(array $items): array
    {
        return collect($items)
            ->filter(fn ($item): bool => is_array($item))
            ->take(200)
            ->map(static fn (array $item): array => [
                'result_id' => (string) ($item['result_id'] ?? ''),
                'status' => (string) ($item['status'] ?? ''),
                'provider_id' => (string) ($item['provider_id'] ?? ''),
                'model_id' => (string) ($item['model_id'] ?? ''),
                'category' => (string) ($item['category'] ?? ''),
                'prompt_text' => (string) ($item['prompt_text'] ?? ''),
                'answer_excerpt' => (string) ($item['answer_excerpt'] ?? ''),
                'brand_mentioned' => (bool) ($item['brand_mentioned'] ?? false),
                'competitor_mentions' => is_numeric($item['competitor_mentions'] ?? null) ? (float) $item['competitor_mentions'] : 0,
                'source_url_count' => is_numeric($item['source_url_count'] ?? null) ? (float) $item['source_url_count'] : 0,
                'official_source_count' => is_numeric($item['official_source_count'] ?? null) ? (float) $item['official_source_count'] : 0,
                'competitor_source_count' => is_numeric($item['competitor_source_count'] ?? null) ? (float) $item['competitor_source_count'] : 0,
                'parser_confidence' => is_numeric($item['parser_confidence'] ?? null) ? (float) $item['parser_confidence'] : 0,
                'sources' => collect($item['sources'] ?? [])->filter(fn ($source): bool => is_array($source))
                    ->take(20)->map(static fn (array $source): array => [
                        'url' => (string) ($source['url'] ?? ''),
                        'domain' => (string) ($source['domain'] ?? ''),
                        'source_type' => (string) ($source['source_type'] ?? 'unknown'),
                        'source_name' => (string) ($source['source_name'] ?? ''),
                    ])->values()->all(),
                'competitors' => collect($item['competitors'] ?? [])->filter(fn ($competitor): bool => is_array($competitor))
                    ->take(10)->map(static fn (array $competitor): array => [
                        'competitor_id' => (string) ($competitor['competitor_id'] ?? ''),
                        'name' => (string) ($competitor['name'] ?? ''),
                        'mention_count' => is_numeric($competitor['mention_count'] ?? null) ? (float) $competitor['mention_count'] : 0,
                    ])->values()->all(),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function nextActions(array $items): array
    {
        return collect($items)
            ->filter(fn ($item): bool => is_array($item))
            ->take(3)
            ->map(static function (array $item): array {
                return [
                    'title' => (string) ($item['title'] ?? ''),
                    'priority' => (string) ($item['priority'] ?? ''),
                    'deliverable' => (string) ($item['deliverable'] ?? ''),
                    'success_measure' => (string) ($item['success_measure'] ?? ''),
                    'recommended_steps' => array_values(array_filter(array_map('strval', (array) ($item['recommended_steps'] ?? [])))),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function opportunities(array $items, string $brandName): array
    {
        return collect($items)
            ->take(4)
            ->map(function (array $item) use ($brandName): array {
                $binding = is_array($item['execution_binding'] ?? null) ? $item['execution_binding'] : [];
                $key = (string) ($item['opportunity_key'] ?? $item['key'] ?? '');
                $type = (string) ($item['type'] ?? $item['opportunity_type'] ?? 'AIVGL Opportunity');

                return [
                    'title' => $this->opportunityTitle($key, $type, (string) ($item['title'] ?? ''), $brandName),
                    'type' => $this->opportunityTypeLabel($type),
                    'impact' => $this->opportunityImpact($key, (string) ($item['impact'] ?? $item['description'] ?? $item['recommended_action'] ?? '')),
                    'action' => '预览解决方案',
                    'href' => route('customer.campaigns.create'),
                    'can_handoff' => true,
                    'prompt_examples' => $this->promptExamples($item['target_prompts'] ?? []),
                    'estimated_articles' => 3,
                    'opportunity_id' => (string) ($item['id'] ?? ''),
                    'opportunity_key' => $key,
                    'brief_id' => (string) ($binding['brief_id'] ?? ''),
                    'brief_key' => (string) ($binding['brief_key'] ?? ''),
                ];
            })
            ->values()
            ->all();
    }

    private function opportunityTitle(string $key, string $type, string $fallback, string $brandName): string
    {
        $value = strtolower($key.' '.$type.' '.$fallback);
        $brand = trim($brandName) !== '' ? trim($brandName) : '品牌';

        if (str_contains($value, 'comparison') || str_contains($value, 'competitor') || str_contains($value, 'alternative')) {
            return '补齐 '.$brand.' 与竞品对比内容';
        }

        if (str_contains($value, 'citation') || str_contains($value, 'source')) {
            return '补齐 AI 可以引用的官方证据页';
        }

        if (str_contains($value, 'review') || str_contains($value, 'best')) {
            return '建立更容易被 AI 推荐的评测内容';
        }

        if (str_contains($value, 'visibility') || str_contains($value, 'missing') || str_contains($value, 'brand')) {
            return '补齐品牌缺席的用户问题页面';
        }

        return '把 AI 推荐缺口转成内容行动';
    }

    private function opportunityTypeLabel(string $type): string
    {
        return match ($type) {
            'competitor_pressure' => '竞品占位过强',
            'source_gap' => '引用来源不足',
            'visibility_gap' => '品牌提及不足',
            'content_gap' => '内容覆盖不足',
            default => 'AI 可见度机会',
        };
    }

    private function opportunityImpact(string $key, string $fallback): string
    {
        $value = strtolower($key.' '.$fallback);

        if (str_contains($value, 'comparison') || str_contains($value, 'competitor') || str_contains($value, 'alternative')) {
            return 'AI 在回答对比类问题时更容易引用竞品，因此需要官方、可引用、结构清楚的对比内容。';
        }

        if (str_contains($value, 'citation') || str_contains($value, 'source')) {
            return 'AI 缺少可信来源时不会稳定推荐品牌，需要先补充事实页、证据页和可引用说明。';
        }

        if (str_contains($value, 'visibility') || str_contains($value, 'missing') || str_contains($value, 'brand')) {
            return '这些用户问题里品牌提及不足，需要用问题页、对比页或解释页补齐品牌存在感。';
        }

        return '这类缺口会影响 AI 是否愿意提到品牌，建议转成内容计划执行。';
    }

    /**
     * @param  list<array<string, mixed>>|list<string>  $items
     * @return list<string>
     */
    private function promptExamples(array $items): array
    {
        return collect($items)
            ->map(static function ($item): string {
                if (is_array($item)) {
                    return trim((string) ($item['prompt_text'] ?? ''));
                }

                return trim((string) $item);
            })
            ->filter()
            ->unique()
            ->take(2)
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function emptySnapshot(string $reason, string $brandName = '', bool $demo = false): array
    {
        return [
            'connected' => false,
            'status' => 'unavailable',
            'errors' => ['config' => $reason],
            'demo' => $demo,
            'brand' => ['name' => $brandName !== '' ? $brandName : 'Your Brand'],
            'tracking_run_id' => '',
            'discovery_run_id' => '',
            'scores' => [
                'visibility' => null,
                'source_quality' => null,
                'competitor_pressure' => null,
            ],
            'scorecards' => [],
            'score_components' => [],
            'coverage' => [],
            'measurement' => [],
            'monitoring' => [],
            'fulfillment' => [
                'mode' => 'pending',
                'label' => '等待配置',
                'description' => '系统还在等待 first run 或 monitoring config 完成。',
                'real_provider_calls_enabled' => false,
                'mock_surface_count' => 0,
                'live_surface_count' => 0,
                'pending_surface_count' => 0,
                'score_meaning' => '',
                'measurement_mode' => '',
                'customer_message' => '',
            ],
            'source_mix' => [],
            'highlighted_answers' => [],
            'evidence_records' => [],
            'next_actions' => [],
            'tracked_prompts' => 0,
            'source_gaps' => 0,
            'opportunities' => [],
            'raw_opportunities' => [],
            'opportunity_summary' => [],
            'briefs' => [],
            'brief_summary' => [],
            'article_review_summary' => [],
            'publish_handoff_summary' => [],
            'retest_summary' => [],
            'retest_items' => [],
            'article_retest_results' => [],
            'evidence_collection' => [
                'status' => 'not_reported',
                'provider_runs' => [],
                'summary' => [],
            ],
            'monthly_report' => [],
            'generated_at' => null,
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function latestRetestResultsByHandoff(): array
    {
        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            return [];
        }

        $brandName = trim((string) config('services.aivgl.brand_name', 'Limitless'));
        $trackingRunId = trim((string) config('services.aivgl.tracking_run_id', ''));

        try {
            $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
                ->acceptJson()
                ->get($baseUrl.'/dashboard/retest-data', array_filter([
                    'brand_name' => $brandName !== '' ? $brandName : null,
                    'run_id' => $trackingRunId !== '' ? $trackingRunId : null,
                ]));

            if (! $response->ok()) {
                return [];
            }

            return $this->mapArticleRetestResults($response->json('retest.retests') ?? []);
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return array<string, array<string, mixed>>
     */
    private function mapArticleRetestResults(array $items): array
    {
        $results = [];

        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $handoffId = trim((string) data_get($item, 'publish_handoff.id', ''));
            if ($handoffId === '') {
                continue;
            }

            $scorecards = collect((array) data_get($item, 'retest_report.scorecards', []))
                ->filter(fn ($scorecard): bool => is_array($scorecard))
                ->map(function (array $scorecard): array {
                    return [
                        'metric' => (string) ($scorecard['metric'] ?? ''),
                        'title' => (string) ($scorecard['title'] ?? $scorecard['metric'] ?? 'Visibility'),
                        'before' => is_numeric($scorecard['before'] ?? null) ? (float) $scorecard['before'] : null,
                        'after' => is_numeric($scorecard['after'] ?? null) ? (float) $scorecard['after'] : null,
                        'delta' => is_numeric($scorecard['delta'] ?? null) ? (float) $scorecard['delta'] : null,
                        'outcome' => (string) ($scorecard['outcome'] ?? ''),
                    ];
                })
                ->values()
                ->all();

            $primary = $scorecards[0] ?? [];
            if ($primary === []) {
                $target = data_get($item, 'comparison.target_metric', []);
                if (is_array($target)) {
                    $primary = [
                        'metric' => (string) ($target['target_metric'] ?? ''),
                        'title' => $this->metricTitle((string) ($target['target_metric'] ?? 'visibility_score')),
                        'before' => null,
                        'after' => null,
                        'delta' => is_numeric($target['delta'] ?? null) ? (float) $target['delta'] : null,
                        'outcome' => (string) ($target['outcome'] ?? ''),
                    ];
                }
            }

            $results[$handoffId] = [
                'handoff_id' => $handoffId,
                'article_title' => (string) data_get($item, 'article.title', 'Published article'),
                'published_url' => (string) data_get($item, 'publish_handoff.published_url', ''),
                'publish_status' => (string) data_get($item, 'publish_handoff.publish_status', ''),
                'retest_status' => (string) data_get($item, 'retest_schedule.status', 'not_started'),
                'retest_schedule_id' => (string) data_get($item, 'retest_schedule.id', ''),
                'scheduled_for' => data_get($item, 'retest_schedule.scheduled_for'),
                'report_status' => (string) data_get($item, 'retest_report.status', ''),
                'headline' => (string) (data_get($item, 'retest_report.headline') ?: data_get($item, 'retest_report.customer_report.one_line_summary', '')),
                'primary_metric' => $primary['metric'] ?? '',
                'primary_metric_title' => $primary['title'] ?? 'Visibility',
                'primary_before' => $primary['before'] ?? null,
                'primary_after' => $primary['after'] ?? null,
                'primary_delta' => $primary['delta'] ?? null,
                'primary_outcome' => $primary['outcome'] ?? '',
                'scorecards' => $scorecards,
            ];
        }

        return $results;
    }

    private function metricTitle(string $metric): string
    {
        return match ($metric) {
            'source_quality_score' => 'Source quality',
            'competitor_pressure_score' => 'Competitor pressure',
            default => 'Visibility',
        };
    }
}

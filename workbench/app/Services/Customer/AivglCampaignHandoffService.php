<?php

namespace App\Services\Customer;

use App\Models\Task;
use App\Services\GeoFlow\ArticleCampaignWizardService;
use RuntimeException;

class AivglCampaignHandoffService
{
    public function __construct(
        private readonly AivglDashboardClient $aivglDashboardClient,
        private readonly ArticleCampaignWizardService $campaignWizardService,
        private readonly CustomerOnboardingService $onboardingService,
    ) {}

    /**
     * @param  array<string,mixed>  $selection
     * @return array{task:Task}
     */
    public function createCampaign(array $selection): array
    {
        $admin = auth('admin')->user();
        $workspace = $admin instanceof \App\Models\Admin ? $this->onboardingService->workspaceFor($admin) : null;
        if (! $workspace instanceof \App\Models\CustomerWorkspace && ! $this->onboardingService->shouldUseDemoFallback($admin instanceof \App\Models\Admin ? $admin : null)) {
            throw new RuntimeException('Customer workspace is not connected.');
        }

        $snapshot = $this->aivglDashboardClient->snapshot($workspace);
        if (! (bool) ($snapshot['connected'] ?? false)) {
            throw new RuntimeException('AIVGL dashboard data is not connected.');
        }

        $opportunity = $this->findOpportunity($snapshot['raw_opportunities'] ?? [], $selection);
        if ($opportunity === null) {
            throw new RuntimeException('Selected AIVGL opportunity was not found.');
        }

        $brief = $this->findBrief($snapshot['briefs'] ?? [], $opportunity, $selection);
        $brand = is_array($snapshot['brand'] ?? null) ? $snapshot['brand'] : [];
        $brandName = trim((string) ($brand['name'] ?? config('services.aivgl.brand_name', 'AIVGL Brand')));
        $brandUrl = trim((string) ($brand['website_url'] ?? $brand['url'] ?? ''));
        if ($brandUrl === '') {
            throw new RuntimeException('AIVGL brand website URL is missing.');
        }

        $payload = [
            'brand_name' => $brandName,
            'brand_url' => $brandUrl,
            'business_summary' => $this->businessSummary($brand, $brief, $opportunity),
            'competitors' => implode("\n", $this->competitors($opportunity, $snapshot['configured_competitors'] ?? [])),
            'target_prompts' => implode("\n", $this->targetPrompts($brief, $opportunity)),
            'objective' => $this->objective($opportunity, $brief),
            'article_count' => 1,
            'need_review' => 1,
            'publish_scope' => 'local_only',
            'publish_interval' => 60,
            'aivgl_brief' => $brief ?? [],
            'aivgl_handoff' => [
                'run_id' => (string) ($snapshot['tracking_run_id'] ?? ''),
                'discovery_run_id' => (string) ($snapshot['discovery_run_id'] ?? ''),
                'opportunity_id' => (string) ($opportunity['id'] ?? ''),
                'opportunity_key' => (string) ($opportunity['opportunity_key'] ?? ''),
                'brief_id' => (string) ($brief['id'] ?? $opportunity['execution_binding']['brief_id'] ?? ''),
                'brief_key' => (string) ($brief['brief_key'] ?? $opportunity['execution_binding']['brief_key'] ?? ''),
            ],
        ];

        $result = $this->campaignWizardService->createCampaign($payload);

        return ['task' => $result['task']];
    }

    /**
     * @param  mixed  $items
     * @param  array<string,mixed>  $selection
     * @return array<string,mixed>|null
     */
    private function findOpportunity(mixed $items, array $selection): ?array
    {
        $opportunityId = trim((string) ($selection['opportunity_id'] ?? ''));
        $opportunityKey = trim((string) ($selection['opportunity_key'] ?? ''));

        foreach (is_array($items) ? $items : [] as $item) {
            if (! is_array($item)) {
                continue;
            }
            if ($opportunityId !== '' && (string) ($item['id'] ?? '') === $opportunityId) {
                return $item;
            }
            if ($opportunityKey !== '' && (string) ($item['opportunity_key'] ?? '') === $opportunityKey) {
                return $item;
            }
        }

        return null;
    }

    /**
     * @param  mixed  $items
     * @param  array<string,mixed>  $opportunity
     * @param  array<string,mixed>  $selection
     * @return array<string,mixed>|null
     */
    private function findBrief(mixed $items, array $opportunity, array $selection): ?array
    {
        $binding = is_array($opportunity['execution_binding'] ?? null) ? $opportunity['execution_binding'] : [];
        $briefId = trim((string) ($selection['brief_id'] ?? $binding['brief_id'] ?? ''));
        $briefKey = trim((string) ($selection['brief_key'] ?? $binding['brief_key'] ?? ''));
        $opportunityId = (string) ($opportunity['id'] ?? '');
        $opportunityKey = (string) ($opportunity['opportunity_key'] ?? '');

        foreach (is_array($items) ? $items : [] as $item) {
            if (! is_array($item)) {
                continue;
            }
            $linked = is_array($item['linked_opportunity'] ?? null) ? $item['linked_opportunity'] : [];
            if ($briefId !== '' && (string) ($item['id'] ?? '') === $briefId) {
                return $item;
            }
            if ($briefKey !== '' && (string) ($item['brief_key'] ?? '') === $briefKey) {
                return $item;
            }
            if ($opportunityId !== '' && (string) ($linked['id'] ?? '') === $opportunityId) {
                return $item;
            }
            if ($opportunityKey !== '' && (string) ($linked['opportunity_key'] ?? '') === $opportunityKey) {
                return $item;
            }
        }

        return null;
    }

    /**
     * @param  array<string,mixed>  $brand
     * @param  array<string,mixed>|null  $brief
     * @param  array<string,mixed>  $opportunity
     */
    private function businessSummary(array $brand, ?array $brief, array $opportunity): string
    {
        return trim((string) (
            $brand['vertical']
            ?? $brief['objective']
            ?? $opportunity['description']
            ?? 'AI visibility growth content campaign'
        ));
    }

    /**
     * @param  array<string,mixed>  $opportunity
     * @return list<string>
     */
    private function competitors(array $opportunity, array $configuredCompetitors = []): array
    {
        $evidence = is_array($opportunity['expected_impact'] ?? null) ? $opportunity['expected_impact'] : [];
        $lines = array_merge((array) ($opportunity['evidence_summary'] ?? []), (array) ($opportunity['weakness_evidence'] ?? []));

        $configured = collect($configuredCompetitors)
            ->map(static fn ($item): string => is_array($item) ? trim((string) ($item['name'] ?? '')) : trim((string) $item))
            ->filter();

        return $configured
            ->merge(collect($lines)
            ->filter(static fn ($line): bool => is_string($line) && str_contains(strtolower($line), 'competitor'))
            ->merge(array_filter([(string) ($evidence['secondary_metric'] ?? '')])))
            ->unique()
            ->take(6)
            ->values()
            ->all();
    }

    /**
     * @param  array<string,mixed>|null  $brief
     * @param  array<string,mixed>  $opportunity
     * @return list<string>
     */
    private function targetPrompts(?array $brief, array $opportunity): array
    {
        $fromBrief = collect($brief['target_prompts'] ?? [])->map(static fn ($prompt): string => (string) $prompt);
        $fromRetest = collect($brief['retest_plan']['prompt_samples'] ?? [])->map(static fn ($prompt): string => (string) $prompt);
        $fromOpportunity = collect($opportunity['target_prompts'] ?? [])
            ->map(static fn ($prompt): string => is_array($prompt) ? (string) ($prompt['prompt_text'] ?? '') : (string) $prompt);

        return $fromBrief
            ->merge($fromRetest)
            ->merge($fromOpportunity)
            ->map(static fn (string $prompt): string => trim($prompt))
            ->filter()
            ->unique()
            ->take(8)
            ->values()
            ->all();
    }

    /**
     * @param  array<string,mixed>  $opportunity
     * @param  array<string,mixed>|null  $brief
     */
    private function objective(array $opportunity, ?array $brief): string
    {
        $signal = strtolower((string) ($opportunity['opportunity_type'] ?? $opportunity['recommended_format'] ?? $brief['content_type'] ?? ''));
        if (str_contains($signal, 'competitor')) {
            return 'competitor_comparison';
        }
        if (str_contains($signal, 'source') || str_contains($signal, 'authority')) {
            return 'source_gap';
        }
        if (str_contains($signal, 'comparison') || str_contains($signal, 'alternative')) {
            return 'comparison_page';
        }

        return 'ai_recommendation';
    }
}

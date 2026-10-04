<?php

namespace App\Services\GeoFlow;

use App\Models\AiModel;
use App\Models\Category;
use App\Models\KnowledgeBase;
use App\Models\Prompt;
use App\Models\Task;
use App\Models\Title;
use App\Models\TitleLibrary;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ArticleCampaignWizardService
{
    public function __construct(
        private readonly ArticleGenerationBriefService $articleGenerationBriefService,
        private readonly KnowledgeChunkSyncService $knowledgeChunkSyncService,
        private readonly TaskLifecycleService $taskLifecycleService,
        private readonly DistributionOrchestrator $distributionOrchestrator,
    ) {}

    /**
     * @param  array<string,mixed>  $payload
     * @return array{task:Task,title_library:TitleLibrary,knowledge_base:KnowledgeBase,brief:array<string,mixed>}
     */
    public function createCampaign(array $payload): array
    {
        $brandName = trim((string) $payload['brand_name']);
        $brandUrl = $this->normalizeUrl((string) $payload['brand_url']);
        $businessSummary = trim((string) ($payload['business_summary'] ?? ''));
        $objective = (string) ($payload['objective'] ?? 'ai_recommendation');
        $articleCount = max(1, min(50, (int) ($payload['article_count'] ?? 6)));
        $needReview = ! empty($payload['need_review']);
        $publishScope = (string) ($payload['publish_scope'] ?? 'local_only');
        $competitors = $this->splitLines((string) ($payload['competitors'] ?? ''));
        $targetPrompts = $this->splitLines((string) ($payload['target_prompts'] ?? ''));

        $crawl = $this->crawlBrandSite($brandUrl);
        if ($businessSummary === '') {
            $businessSummary = $this->inferBusinessSummary($brandName, $crawl);
        }
        $titles = $this->buildTitles($brandName, $businessSummary, $objective, $competitors, $targetPrompts, $articleCount);
        $knowledgeContent = $this->buildKnowledgeContent($brandName, $brandUrl, $businessSummary, $competitors, $crawl);
        $brief = $this->buildBrief($brandName, $brandUrl, $businessSummary, $objective, $competitors, $targetPrompts, $crawl);
        if (is_array($payload['aivgl_brief'] ?? null)) {
            $brief = $this->mergeAivglBrief($brief, $payload['aivgl_brief']);
        }
        if (is_array($payload['aivgl_handoff'] ?? null)) {
            $brief['aivgl_handoff'] = $this->compactAivglHandoff($payload['aivgl_handoff']);
            $brief['campaign_source'] = 'aivgl_campaign_handoff';
            $brief['notes'] = trim((string) ($brief['notes'] ?? '')."\nCampaign source: aivgl_campaign_handoff. AIVGL run: ".$brief['aivgl_handoff']['run_id'].'. Opportunity: '.$brief['aivgl_handoff']['opportunity_key'].'. Brief: '.$brief['aivgl_handoff']['brief_id']);
        }
        $prompt = is_array($payload['aivgl_handoff'] ?? null)
            ? $this->resolveAivglGrowthPrompt()
            : $this->resolveDefaultPrompt();
        $model = $this->resolveDefaultModel();

        return DB::transaction(function () use ($payload, $brandName, $articleCount, $needReview, $publishScope, $titles, $knowledgeContent, $brief, $prompt, $model): array {
            $this->ensureDefaultCategory();

            $titleLibrary = TitleLibrary::query()->create([
                'name' => $brandName.' Article Campaign '.now()->format('Ymd Hi'),
                'description' => 'Auto-created by Article Campaign Wizard',
                'title_count' => count($titles),
                'generation_type' => 'campaign_wizard',
                'is_ai_generated' => 1,
            ]);

            foreach ($titles as $row) {
                Title::query()->create([
                    'library_id' => (int) $titleLibrary->id,
                    'title' => $row['title'],
                    'keyword' => $row['keyword'],
                    'is_ai_generated' => true,
                    'used_count' => 0,
                    'usage_count' => 0,
                ]);
            }

            $knowledgeBase = KnowledgeBase::query()->create([
                'name' => $brandName.' Brand Evidence Base',
                'description' => 'Auto-created from brand setup and homepage crawl.',
                'content' => $knowledgeContent,
                'character_count' => mb_strlen($knowledgeContent, 'UTF-8'),
                'word_count' => str_word_count(strip_tags($knowledgeContent)),
                'file_type' => 'markdown',
            ]);
            $this->knowledgeChunkSyncService->sync((int) $knowledgeBase->id, $knowledgeContent);

            $taskData = [
                'name' => $brandName.' Article Campaign',
                'title_library_id' => (int) $titleLibrary->id,
                'prompt_id' => (int) $prompt->id,
                'ai_model_id' => (int) $model->id,
                'knowledge_base_id' => (int) $knowledgeBase->id,
                'fixed_category_id' => isset($payload['fixed_category_id']) ? (int) $payload['fixed_category_id'] : null,
                'status' => 'paused',
                'publish_scope' => $publishScope,
                'article_limit' => $articleCount,
                'draft_limit' => $needReview ? $articleCount : min($articleCount, 10),
                'publish_interval' => max(60, (int) ($payload['publish_interval'] ?? 60) * 60),
                'need_review' => $needReview ? 1 : 0,
                'is_loop' => 0,
                'auto_keywords' => 1,
                'auto_description' => 1,
                'category_mode' => ! empty($payload['fixed_category_id']) ? 'fixed' : 'smart',
                'model_selection_mode' => 'smart_failover',
                'content_generation_mode' => 'geo_growth',
                'geo_brief_json' => $this->articleGenerationBriefService->encodeBrief($brief),
                'quality_gate_enabled' => 1,
            ];
            $taskData = array_merge($taskData, $this->aivglTaskColumns($payload));

            $task = Task::query()->whereKey((int) $this->taskLifecycleService->createTask($taskData)['id'])->firstOrFail();
            $this->distributionOrchestrator->syncTaskChannels($task, $this->selectedDistributionChannelIds($payload, $publishScope));

            return [
                'task' => $task,
                'title_library' => $titleLibrary,
                'knowledge_base' => $knowledgeBase,
                'brief' => $brief,
            ];
        });
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array{brand_name:string,brand_url:string,business_summary:string,objective:string,objective_label:string,article_count:int,crawl_status:string,pages:list<array{url:string,title:string,description:string,headings:list<string>}>,titles:list<array{title:string,keyword:string}>,brief:array<string,mixed>}
     */
    public function previewCampaign(array $payload): array
    {
        $brandUrl = $this->normalizeUrl((string) $payload['brand_url']);
        $brandName = trim((string) ($payload['brand_name'] ?? ''));
        if ($brandName === '') {
            $brandName = $this->inferBrandName($brandUrl);
        }

        $objective = (string) ($payload['objective'] ?? 'ai_recommendation');
        $articleCount = max(1, min(50, (int) ($payload['article_count'] ?? 6)));
        $competitors = $this->splitLines((string) ($payload['competitors'] ?? ''));
        $targetPrompts = $this->splitLines((string) ($payload['target_prompts'] ?? ''));
        $crawl = $this->crawlBrandSite($brandUrl);
        $businessSummary = trim((string) ($payload['business_summary'] ?? ''));
        if ($businessSummary === '') {
            $businessSummary = $this->inferBusinessSummary($brandName, $crawl);
        }

        $titles = $this->buildTitles($brandName, $businessSummary, $objective, $competitors, $targetPrompts, $articleCount);
        $brief = $this->buildBrief($brandName, $brandUrl, $businessSummary, $objective, $competitors, $targetPrompts, $crawl);

        return [
            'brand_name' => $brandName,
            'brand_url' => $brandUrl,
            'business_summary' => $businessSummary,
            'objective' => $objective,
            'objective_label' => $this->objectiveLabel($objective),
            'article_count' => $articleCount,
            'crawl_status' => (string) ($crawl['status'] ?? 'unknown'),
            'pages' => $crawl['pages'],
            'titles' => $titles,
            'brief' => $brief,
        ];
    }

    private function normalizeUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }
        if (! preg_match('/^https?:\/\//i', $url)) {
            $url = 'https://'.$url;
        }

        return $url;
    }

    private function inferBrandName(string $brandUrl): string
    {
        $host = (string) parse_url($brandUrl, PHP_URL_HOST);
        $host = preg_replace('/^www\./i', '', $host) ?: $brandUrl;
        $name = preg_replace('/\.[a-z]{2,}(\.[a-z]{2,})?$/i', '', $host) ?: $host;

        return Str::headline(str_replace(['-', '_'], ' ', $name));
    }

    /**
     * @param  array{status:string,pages:list<array{url:string,title:string,description:string,headings:list<string>}>}  $crawl
     */
    private function inferBusinessSummary(string $brandName, array $crawl): string
    {
        $homepage = $crawl['pages'][0] ?? [];
        $description = trim((string) ($homepage['description'] ?? ''));
        if ($description !== '') {
            return Str::limit($description, 220, '');
        }

        $headings = collect($homepage['headings'] ?? [])
            ->filter(static fn ($heading): bool => trim((string) $heading) !== '')
            ->take(2)
            ->implode(' / ');
        if ($headings !== '') {
            return Str::limit($headings, 220, '');
        }

        $title = trim((string) ($homepage['title'] ?? ''));
        if ($title !== '') {
            return Str::limit($title, 220, '');
        }

        return $brandName.' brand, product, and buyer decision content';
    }

    /**
     * @return list<string>
     */
    private function splitLines(string $value): array
    {
        return collect(preg_split('/[\r\n,]+/u', $value) ?: [])
            ->map(static fn (string $item): string => trim($item))
            ->filter(static fn (string $item): bool => $item !== '')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return array{status:string,pages:list<array{url:string,title:string,description:string,headings:list<string>}>}
     */
    private function crawlBrandSite(string $brandUrl): array
    {
        $pages = [];
        $homepage = $this->fetchPage($brandUrl);
        if ($homepage !== null) {
            $pages[] = $homepage;
            foreach ($this->extractPriorityLinks($brandUrl, (string) ($homepage['html'] ?? '')) as $link) {
                $page = $this->fetchPage($link);
                if ($page !== null) {
                    $pages[] = $page;
                }
            }
        }

        return [
            'status' => $pages === [] ? 'fallback_from_user_input' : 'crawled',
            'pages' => array_map(static fn (array $page): array => [
                'url' => (string) $page['url'],
                'title' => (string) $page['title'],
                'description' => (string) $page['description'],
                'headings' => $page['headings'],
            ], $pages),
        ];
    }

    /**
     * @return array<string,mixed>|null
     */
    private function fetchPage(string $url): ?array
    {
        try {
            $response = Http::timeout(8)
                ->connectTimeout(4)
                ->withHeaders(['User-Agent' => 'CowTech Article Campaign Wizard/1.0'])
                ->get($url);
        } catch (\Throwable) {
            return null;
        }

        if (! $response->ok()) {
            return null;
        }

        $html = mb_substr((string) $response->body(), 0, 250000, 'UTF-8');

        return [
            'url' => $url,
            'html' => $html,
            'title' => $this->extractTag($html, 'title'),
            'description' => $this->extractMetaDescription($html),
            'headings' => $this->extractHeadings($html),
        ];
    }

    private function extractTag(string $html, string $tag): string
    {
        if (preg_match('/<'.preg_quote($tag, '/').'[^>]*>(.*?)<\/'.preg_quote($tag, '/').'>/isu', $html, $matches) !== 1) {
            return '';
        }

        return trim(html_entity_decode(strip_tags($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    private function extractMetaDescription(string $html): string
    {
        if (preg_match('/<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\'][^>]*>/isu', $html, $matches) !== 1
            && preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']description["\'][^>]*>/isu', $html, $matches) !== 1) {
            return '';
        }

        return trim(html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    /**
     * @return list<string>
     */
    private function extractHeadings(string $html): array
    {
        preg_match_all('/<h[1-3][^>]*>(.*?)<\/h[1-3]>/isu', $html, $matches);

        return collect($matches[1] ?? [])
            ->map(static fn (string $heading): string => trim(html_entity_decode(strip_tags($heading), ENT_QUOTES | ENT_HTML5, 'UTF-8')))
            ->filter(static fn (string $heading): bool => $heading !== '')
            ->unique()
            ->take(12)
            ->values()
            ->all();
    }

    /**
     * @return list<string>
     */
    private function extractPriorityLinks(string $brandUrl, string $html): array
    {
        $host = parse_url($brandUrl, PHP_URL_HOST);
        if ($host === null || $html === '') {
            return [];
        }

        preg_match_all('/<a[^>]+href=["\']([^"\']+)["\'][^>]*>/isu', $html, $matches);
        $base = rtrim((string) parse_url($brandUrl, PHP_URL_SCHEME).'://'.$host, '/');
        $priority = ['about', 'product', 'pricing', 'compare', 'comparison', 'case', 'customer', 'blog', 'docs'];

        return collect($matches[1] ?? [])
            ->map(static function (string $href) use ($base): string {
                if (str_starts_with($href, '/')) {
                    return $base.$href;
                }

                return $href;
            })
            ->filter(static function (string $url) use ($host, $priority): bool {
                $linkHost = parse_url($url, PHP_URL_HOST);
                if ($linkHost !== $host) {
                    return false;
                }
                $path = strtolower((string) parse_url($url, PHP_URL_PATH));

                return collect($priority)->contains(static fn (string $needle): bool => str_contains($path, $needle));
            })
            ->unique()
            ->take(5)
            ->values()
            ->all();
    }

    /**
     * @param  list<string>  $competitors
     * @param  list<string>  $targetPrompts
     * @return list<array{title:string,keyword:string}>
     */
    private function buildTitles(string $brandName, string $businessSummary, string $objective, array $competitors, array $targetPrompts, int $articleCount): array
    {
        $industry = $this->conciseIndustry($businessSummary, $brandName);
        $ideas = [
            ["What is {$brandName}? A practical guide for buyers", $brandName],
            ["Best {$industry} tools to consider in 2026", $industry],
            ["How {$brandName} helps teams solve {$industry} problems", $brandName.' use cases'],
            ["{$brandName} pricing, features, and alternatives", $brandName.' alternatives'],
            ["How to choose a {$industry} platform", $industry.' platform'],
            ["{$brandName} implementation checklist for growing teams", $brandName.' implementation'],
        ];

        foreach ($competitors as $competitor) {
            $ideas[] = ["{$brandName} vs {$competitor}: which option fits your team?", "{$brandName} vs {$competitor}"];
            $ideas[] = ["Best {$competitor} alternatives for {$industry}", "{$competitor} alternatives"];
        }

        foreach ($targetPrompts as $prompt) {
            $clean = ucfirst(trim($prompt, " ?\t\n\r\0\x0B"));
            $ideas[] = [$clean.'?', Str::limit($prompt, 120, '')];
        }

        if ($objective === 'source_gap') {
            array_unshift($ideas, ["Authoritative sources for evaluating {$brandName}", $brandName.' sources']);
        } elseif ($objective === 'competitor_comparison') {
            array_unshift($ideas, ["{$brandName} alternatives and competitor comparison guide", $brandName.' competitor comparison']);
        }

        return collect($ideas)
            ->unique(static fn (array $row): string => mb_strtolower($row[0], 'UTF-8'))
            ->take($articleCount)
            ->map(static fn (array $row): array => ['title' => $row[0], 'keyword' => $row[1]])
            ->values()
            ->all();
    }

    /**
     * @param  list<string>  $competitors
     * @param  array<string,mixed>  $crawl
     */
    private function buildKnowledgeContent(string $brandName, string $brandUrl, string $businessSummary, array $competitors, array $crawl): string
    {
        $lines = [
            '# '.$brandName.' Brand Evidence Base',
            '',
            '- Brand URL: '.$brandUrl,
            '- Business summary: '.($businessSummary !== '' ? $businessSummary : 'Not provided'),
            '- Known competitors: '.($competitors === [] ? 'Not provided' : implode(', ', $competitors)),
            '- Crawl status: '.(string) ($crawl['status'] ?? 'unknown'),
            '',
            '## Crawled pages',
        ];

        foreach (($crawl['pages'] ?? []) as $page) {
            $lines[] = '';
            $lines[] = '### '.((string) ($page['title'] ?? '') ?: (string) ($page['url'] ?? 'Untitled page'));
            $lines[] = '- URL: '.(string) ($page['url'] ?? '');
            if (! empty($page['description'])) {
                $lines[] = '- Description: '.(string) $page['description'];
            }
            foreach ((array) ($page['headings'] ?? []) as $heading) {
                $lines[] = '- Page signal: '.(string) $heading;
            }
        }

        return implode("\n", $lines)."\n";
    }

    /**
     * @param  list<string>  $competitors
     * @param  list<string>  $targetPrompts
     * @param  array<string,mixed>  $crawl
     * @return array<string,mixed>
     */
    private function buildBrief(string $brandName, string $brandUrl, string $businessSummary, string $objective, array $competitors, array $targetPrompts, array $crawl): array
    {
        $industry = $this->conciseIndustry($businessSummary, $brandName);

        return [
            'brand_name' => $brandName,
            'brand_url' => $brandUrl,
            'target_audience' => 'Buyers comparing solutions in the brand category',
            'search_intent' => $this->objectiveLabel($objective),
            'commercial_intent' => 'evaluation',
            'target_prompt' => $targetPrompts[0] ?? 'Which '.$industry.' companies should I consider?',
            'source_gap' => ['review pages', 'comparison pages', 'best-of lists', 'AI answer citations'],
            'competitor_angle' => $competitors,
            'required_sources' => collect($crawl['pages'] ?? [])->pluck('url')->filter()->take(6)->values()->all(),
            'facts_to_include' => [
                $businessSummary !== '' ? $businessSummary : $brandName.' positioning must be explained from crawled evidence.',
                'Use the brand evidence base before making claims.',
                'Mention competitors only for fair comparison and buyer decision support.',
            ],
            'internal_links' => [$brandUrl],
            'cta' => 'Compare options and contact '.$brandName.' for the next step.',
            'retest_prompts' => $targetPrompts === [] ? [
                'What are the best '.$industry.' tools?',
                'Is '.$brandName.' recommended for this category?',
            ] : $targetPrompts,
            'campaign_objective' => $objective,
            'campaign_source' => 'article_campaign_wizard',
        ];
    }

    /**
     * @param  array<string,mixed>  $brief
     * @param  array<string,mixed>  $aivglBrief
     * @return array<string,mixed>
     */
    private function mergeAivglBrief(array $brief, array $aivglBrief): array
    {
        $executionBrief = is_array($aivglBrief['execution_brief'] ?? null) ? $aivglBrief['execution_brief'] : [];
        $linkedOpportunity = is_array($aivglBrief['linked_opportunity'] ?? null) ? $aivglBrief['linked_opportunity'] : [];
        $readiness = is_array($aivglBrief['article_readiness'] ?? null) ? $aivglBrief['article_readiness'] : [];
        $binding = is_array($aivglBrief['validated_prompt_binding'] ?? null) ? $aivglBrief['validated_prompt_binding'] : [];
        $primaryPrompt = is_array($binding['primary_prompt'] ?? null) ? $binding['primary_prompt'] : [];

        $brief['aivgl_brief_id'] = $aivglBrief['id'] ?? null;
        $brief['aivgl_brief_key'] = $aivglBrief['brief_key'] ?? null;
        $brief['aivgl_opportunity_id'] = $linkedOpportunity['id'] ?? null;
        $brief['aivgl_opportunity_key'] = $linkedOpportunity['opportunity_key'] ?? null;
        $brief['search_intent'] = (string) ($aivglBrief['objective'] ?? $brief['search_intent']);
        $brief['target_audience'] = (string) ($aivglBrief['audience'] ?? $brief['target_audience']);
        $brief['target_prompt'] = (string) ($primaryPrompt['prompt_text'] ?? $brief['target_prompt']);
        $brief['target_prompts'] = $this->cleanList($aivglBrief['target_prompts'] ?? []);
        $brief['source_gap'] = $this->cleanList($aivglBrief['evidence_requirements'] ?? $brief['source_gap']);
        $brief['required_sources'] = collect($brief['required_sources'] ?? [])
            ->merge(collect($aivglBrief['internal_link_targets'] ?? [])->map(
                static fn ($link): string => is_array($link) ? (string) ($link['url'] ?? '') : (string) $link
            ))
            ->map(static fn ($source): string => trim((string) $source))
            ->filter()
            ->unique()
            ->values()
            ->all();
        $brief['facts_to_include'] = $this->cleanList($aivglBrief['must_include_facts'] ?? $brief['facts_to_include']);
        $brief['outline'] = $this->cleanList($aivglBrief['outline'] ?? []);
        $brief['guardrails'] = $this->cleanList($aivglBrief['guardrails'] ?? []);
        $brief['internal_links'] = collect($aivglBrief['internal_link_targets'] ?? [])
            ->map(static fn ($link): string => is_array($link) ? (string) ($link['url'] ?? $link['label'] ?? '') : (string) $link)
            ->filter(static fn (string $value): bool => trim($value) !== '')
            ->values()
            ->all() ?: $brief['internal_links'];
        $brief['retest_prompts'] = $this->cleanList($aivglBrief['retest_plan']['prompt_samples'] ?? $brief['retest_prompts']);
        $brief['aivgl_article_ready'] = (bool) ($readiness['ready_for_article_workflow'] ?? false);
        $brief['aivgl_validated_prompt_count'] = (int) ($binding['validated_prompt_count'] ?? 0);
        $brief['aivgl_execution_brief'] = $executionBrief;

        return $brief;
    }

    /**
     * @param  array<string,mixed>  $handoff
     * @return array<string,mixed>
     */
    private function compactAivglHandoff(array $handoff): array
    {
        return [
            'run_id' => (string) ($handoff['run_id'] ?? ''),
            'discovery_run_id' => (string) ($handoff['discovery_run_id'] ?? ''),
            'opportunity_id' => (string) ($handoff['opportunity_id'] ?? ''),
            'opportunity_key' => (string) ($handoff['opportunity_key'] ?? ''),
            'brief_id' => (string) ($handoff['brief_id'] ?? ''),
            'brief_key' => (string) ($handoff['brief_key'] ?? ''),
            'source' => 'aivgl_dashboard',
        ];
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    private function aivglTaskColumns(array $payload): array
    {
        if (! is_array($payload['aivgl_handoff'] ?? null)) {
            return [];
        }

        $handoff = $this->compactAivglHandoff($payload['aivgl_handoff']);
        $values = [
            'aivgl_run_id' => $handoff['run_id'] ?: null,
            'aivgl_discovery_run_id' => $handoff['discovery_run_id'] ?: null,
            'aivgl_opportunity_id' => $handoff['opportunity_id'] ?: null,
            'aivgl_opportunity_key' => $handoff['opportunity_key'] ?: null,
            'aivgl_brief_id' => $handoff['brief_id'] ?: null,
            'aivgl_brief_key' => $handoff['brief_key'] ?: null,
            'aivgl_handoff_payload_json' => json_encode($handoff, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ];

        return collect($values)
            ->filter(static fn ($value, string $column): bool => Schema::hasColumn('tasks', $column))
            ->all();
    }

    /**
     * @param  mixed  $value
     * @return list<string>
     */
    private function cleanList(mixed $value): array
    {
        return collect(is_array($value) ? $value : [$value])
            ->map(static fn ($item): string => trim(is_array($item) ? json_encode($item, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : (string) $item))
            ->filter(static fn (string $item): bool => $item !== '')
            ->values()
            ->all();
    }

    private function objectiveLabel(string $objective): string
    {
        return match ($objective) {
            'competitor_comparison' => 'Compare the brand against named competitors',
            'source_gap' => 'Create source-worthy evidence for AI citations',
            'comparison_page' => 'Build a comparison or alternatives page',
            default => 'Improve AI recommendations and visibility',
        };
    }

    private function conciseIndustry(string $businessSummary, string $brandName): string
    {
        $summary = trim($businessSummary);
        if ($summary === '') {
            return $brandName;
        }

        $summary = preg_split('/[,.。;；:：]/u', $summary, 2)[0] ?? $summary;
        $summary = preg_replace('/\b(providing|provides|offers|offering|through|with|for)\b.*$/iu', '', $summary) ?: $summary;
        $summary = trim($summary, " \t\n\r\0\x0B-–—");

        return Str::limit($summary !== '' ? $summary : $brandName, 72, '');
    }

    private function resolveDefaultPrompt(): Prompt
    {
        return Prompt::query()
            ->where('type', 'content')
            ->orderByDesc('id')
            ->firstOrFail();
    }

    private function resolveAivglGrowthPrompt(): Prompt
    {
        return Prompt::query()->firstOrCreate(
            [
                'name' => 'CowTech AIVGL GEO Growth Article',
                'type' => 'content',
            ],
            [
                'content' => implode("\n", [
                    'Write a factual, publication-ready article titled "{{title}}" for buyers evaluating the category.',
                    'Use only facts and named competitors found in the supplied knowledge and growth brief.',
                    'Never invent competitors, rankings, certifications, customers, prices, capabilities, or results.',
                    'Never use generic labels such as Brand A, Brand B, Vendor A, or Vendor B.',
                    'Answer the target AI prompt directly, include an evidence and sources section, named comparison criteria when relevant, FAQ, internal links, and the exact next-step CTA from the brief.',
                    'If evidence is unavailable, state the limitation plainly instead of filling the gap with marketing claims.',
                    '',
                    'Reference knowledge:',
                    '{{knowledge}}',
                ]),
                'variables' => 'title,knowledge',
            ]
        );
    }

    private function resolveDefaultModel(): AiModel
    {
        return AiModel::query()
            ->where('status', 'active')
            ->where(function ($query): void {
                $query->whereNull('model_type')
                    ->orWhere('model_type', '')
                    ->orWhere('model_type', 'chat');
            })
            ->orderBy('failover_priority')
            ->orderByDesc('id')
            ->firstOrFail();
    }

    private function ensureDefaultCategory(): Category
    {
        $category = Category::query()->orderBy('sort_order')->orderBy('id')->first();
        if ($category instanceof Category) {
            return $category;
        }

        return Category::query()->create([
            'name' => 'AI Visibility',
            'slug' => 'ai-visibility',
            'description' => 'Default category for Article Campaign content.',
            'sort_order' => 0,
        ]);
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return list<int>
     */
    private function selectedDistributionChannelIds(array $payload, string $publishScope): array
    {
        if ($publishScope === 'local_only') {
            return [];
        }

        return collect($payload['distribution_channel_ids'] ?? [])
            ->map(static fn ($id): int => (int) $id)
            ->filter(static fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();
    }
}

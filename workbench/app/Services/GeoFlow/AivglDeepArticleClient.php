<?php

namespace App\Services\GeoFlow;

use App\Models\Task;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class AivglDeepArticleClient
{
    /**
     * @param  array<string,mixed>  $brief
     * @return array<string,mixed>|null
     */
    public function createEvidencePackForTask(
        Task $task,
        string $title,
        string $keyword,
        array $brief,
        string $articleMarkdown,
        string $externalArticleKey,
        bool $runFactQa
    ): ?array {
        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            return $this->handleUnavailable('aivgl_base_url_missing');
        }

        $trackingRunId = trim((string) ($task->aivgl_run_id ?: config('services.aivgl.tracking_run_id', '')));
        if ($trackingRunId === '') {
            return $this->handleUnavailable('aivgl_tracking_run_id_missing');
        }

        $providerMode = \App\Support\GeoFlow\ProviderConfiguration::requireMode('services.aivgl.deep_article_provider_mode');
        $response = Http::timeout((int) config('services.aivgl.deep_article_timeout_seconds', 45))
            ->acceptJson()
            ->asJson()
            ->post($baseUrl.'/internal/tracking/runs/'.rawurlencode($trackingRunId).'/deep-article-evidence-packs', [
                'external_article_key' => $externalArticleKey,
                'brand' => $this->brandPayload($task, $brief),
                'draft' => $this->draftPayload($task, $title, $keyword, $brief),
                'article_markdown' => $articleMarkdown,
                'competitors' => $this->competitorsPayload($brief),
                'provider_mode' => $providerMode,
                'allow_paid_provider' => (bool) config('services.aivgl.deep_article_allow_paid_provider', false),
                'run_fact_qa' => $runFactQa,
            ]);

        if (! $response->ok()) {
            return $this->handleUnavailable('aivgl_deep_article_http_'.$response->status().': '.$response->body());
        }

        $payload = $response->json() ?: [];
        $row = is_array($payload['row'] ?? null) ? $payload['row'] : [];

        return is_array($row['pack_payload'] ?? null) ? $row['pack_payload'] : null;
    }

    /**
     * @param  array<string,mixed>  $pack
     */
    public function buildEvidencePromptSection(array $pack, bool $english): string
    {
        $items = data_get($pack, 'research.evidence_items', []);
        if (! is_array($items) || $items === []) {
            return '';
        }

        $lines = $english ? [
            'Verified deep research evidence pack:',
            'Use only these source URLs for citations. Do not invent citations or unsupported claims.',
        ] : [
            '【已验证 Deep Research 证据包】',
            '引用只能使用以下来源 URL。不要编造引用，不要写没有证据支撑的事实。',
        ];

        foreach (array_slice($items, 0, 12) as $item) {
            if (! is_array($item)) {
                continue;
            }
            $ref = trim((string) ($item['ref'] ?? 'E'));
            $url = trim((string) ($item['source_url'] ?? ''));
            $text = Str::limit(trim((string) ($item['evidence_text'] ?? '')), 420, '...');
            if ($text === '') {
                continue;
            }
            $lines[] = sprintf('- %s %s %s', $ref.':', $text, $url !== '' ? 'Source: '.$url : '');
        }

        $lines[] = $english
            ? 'Required: include a Sources or References section using the source URLs above, and keep visibility improvement claims out until retest proof exists.'
            : '必须：正文包含 Sources/References 或“来源/参考”段落，使用以上 URL；复测证明完成前不得宣称 AI visibility 已提升。';

        return implode("\n", $lines);
    }

    /**
     * @param  array<string,mixed>  $pack
     * @return list<string>
     */
    public function criticalBlockers(array $pack): array
    {
        $blockers = is_array($pack['blockers'] ?? null) ? $pack['blockers'] : [];

        return array_values(array_filter(array_map('strval', $blockers), static function (string $blocker): bool {
            return $blocker !== '' && $blocker !== 'visibility_measurement_pending';
        }));
    }

    private function handleUnavailable(string $reason): ?array
    {
        if ((bool) config('services.aivgl.deep_article_fail_open', false)) {
            return null;
        }

        throw new RuntimeException('AIVGL deep article unavailable: '.$reason);
    }

    /**
     * @param  array<string,mixed>  $brief
     * @return array<string,mixed>
     */
    private function brandPayload(Task $task, array $brief): array
    {
        $handoff = $this->handoffPayload($task);
        $brand = is_array($handoff['brand'] ?? null) ? $handoff['brand'] : [];

        return [
            'id' => $brand['id'] ?? null,
            'name' => $brand['name'] ?? config('services.aivgl.brand_name', 'AIVGL Brand'),
            'website_url' => $brand['website_url'] ?? $brand['website'] ?? '',
            'vertical' => $brief['commercial_intent'] ?? $brief['search_intent'] ?? 'software',
        ];
    }

    /**
     * @param  array<string,mixed>  $brief
     * @return array<string,mixed>
     */
    private function draftPayload(Task $task, string $title, string $keyword, array $brief): array
    {
        return [
            'title' => $title,
            'article_title' => $title,
            'content_type' => (string) ($task->content_generation_mode ?? 'deep_research'),
            'primary_prompt' => $brief['target_prompt'] ?? $keyword,
            'target_prompts' => $this->targetPrompts($brief),
        ];
    }

    /**
     * @param  array<string,mixed>  $brief
     * @return list<array{prompt_text:string}>
     */
    private function targetPrompts(array $brief): array
    {
        $raw = $brief['retest_prompts'] ?? $brief['target_prompt'] ?? [];
        $items = is_array($raw) ? $raw : preg_split('/[\n;,，；]+/u', (string) $raw);

        return array_values(array_filter(array_map(static function ($item): array {
            if (is_array($item)) {
                $item = $item['prompt_text'] ?? $item['text'] ?? '';
            }

            return ['prompt_text' => trim((string) $item)];
        }, $items ?: []), static fn (array $item): bool => $item['prompt_text'] !== ''));
    }

    /**
     * @param  array<string,mixed>  $brief
     * @return list<array{name:string,website_url:string}>
     */
    private function competitorsPayload(array $brief): array
    {
        $raw = $brief['competitor_angle'] ?? [];
        $items = is_array($raw) ? $raw : preg_split('/[\n;,，；]+/u', (string) $raw);

        return array_values(array_filter(array_map(static function ($item): array {
            if (is_array($item)) {
                $item = $item['name'] ?? $item['title'] ?? '';
            }
            $name = trim((string) $item);

            return ['name' => $name, 'website_url' => ''];
        }, $items ?: []), static fn (array $item): bool => $item['name'] !== ''));
    }

    /**
     * @return array<string,mixed>
     */
    private function handoffPayload(Task $task): array
    {
        $decoded = json_decode((string) ($task->aivgl_handoff_payload_json ?? ''), true);

        return is_array($decoded) ? $decoded : [];
    }
}

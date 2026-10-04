<?php

namespace App\Services\GeoFlow;

/**
 * Converts operator briefs and market evidence into a deterministic writing
 * contract for Article Generation v2.
 */
class ArticleGenerationBriefService
{
    /**
     * @return array<string, mixed>
     */
    public function normalizeBrief(?string $raw): array
    {
        $raw = trim((string) $raw);
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            return $this->cleanBriefArray($decoded);
        }

        return $this->cleanBriefArray(['notes' => $raw]);
    }

    /**
     * @param  array<string, mixed>  $brief
     */
    public function encodeBrief(array $brief): string
    {
        $cleaned = $this->cleanBriefArray($brief);
        if ($cleaned === []) {
            return '';
        }

        return (string) json_encode($cleaned, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * @param  array<string, mixed>  $brief
     */
    public function buildBriefSection(array $brief, string $title, string $keyword, string $knowledgeContext, bool $english): string
    {
        $brief = $this->cleanBriefArray($brief);
        $lines = $english ? [
            'Article Generation v2 growth brief:',
            '- Primary title: '.$title,
        ] : [
            '【Article Generation v2 增长简报】',
            '- 文章标题：'.$title,
        ];

        if (trim($keyword) !== '') {
            $lines[] = ($english ? '- Primary keyword: ' : '- 目标关键词：').$keyword;
        }

        $labels = $english ? $this->englishLabels() : $this->chineseLabels();
        foreach ($labels as $key => $label) {
            $value = $brief[$key] ?? null;
            $rendered = $this->renderBriefValue($value);
            if ($rendered !== '') {
                $lines[] = '- '.$label.': '.$rendered;
            }
        }

        if (trim($knowledgeContext) !== '') {
            $lines[] = $english ? '- Retrieved knowledge context:' : '- 知识库检索上下文：';
            $lines[] = $knowledgeContext;
        }

        $lines[] = $english
            ? 'Required structure: short answer-ready definition, evidence-backed explanation, comparison or alternative angle when relevant, source/citation section, FAQ, next-step CTA, and internal-link suggestions.'
            : '必须包含结构：可被 AI 直接引用的定义段、证据支撑解释、必要的竞品/替代方案角度、来源/引用段落、FAQ、下一步 CTA、内部链接建议。';
        $lines[] = $english
            ? 'Do not invent citations. If a required source is not available in the brief or knowledge context, name it as a source to win instead of fabricating facts.'
            : '不要编造引用。如果简报或知识库没有提供某个来源，就把它写成“待拿下/待补充来源”，不要伪造事实。';

        return implode("\n", $lines);
    }

    /**
     * @param  array<string, mixed>  $brief
     * @return array<string, mixed>
     */
    public function qualityReport(string $content, array $brief): array
    {
        $checks = [
            'has_markdown_headings' => preg_match('/^#{2,3}\s+/m', $content) === 1,
            'has_faq' => preg_match('/FAQ|常见问题|Q&A|问答/iu', $content) === 1,
            'has_source_section' => preg_match('/source|citation|reference|来源|引用|参考/iu', $content) === 1,
            'has_cta' => preg_match('/next step|contact|try|book|下一步|联系|试用|预约/iu', $content) === 1,
            'no_placeholder_text' => preg_match('/TODO|TBD|占位符|待补充|placeholder|\b(?:Brand|Vendor|Company)\s+[A-Z]\b/iu', $content) !== 1,
            'no_unverified_ranking_claims' => preg_match('/\bTOP\s*\d+\b|#\s*1\b|number\s+one|best\s+choice|market\s+leader|leading\s+(?:platform|solution)|无可替代|最佳选择|市场领先/iu', $content) !== 1,
            'long_enough' => mb_strlen(trim($content), 'UTF-8') >= 800,
        ];

        if ($this->renderBriefValue($brief['required_sources'] ?? null) !== '') {
            $checks['mentions_required_sources'] = $this->mentionsAnyBriefTerm($content, $brief['required_sources']);
        }
        if ($this->renderBriefValue($brief['competitor_angle'] ?? null) !== '') {
            $checks['uses_competitor_angle'] = $this->mentionsAnyBriefTerm($content, $brief['competitor_angle']);
        }
        if ($this->renderBriefValue($brief['internal_links'] ?? null) !== '') {
            $checks['mentions_internal_links'] = $this->mentionsAnyBriefTerm($content, $brief['internal_links']);
        }

        $passed = count(array_filter($checks));
        $total = max(1, count($checks));

        return [
            'schema' => 'article-generation-quality-gate-v2',
            'score' => (int) round(($passed / $total) * 100),
            'passed' => $passed,
            'total' => $total,
            'checks' => $checks,
        ];
    }

    /**
     * @param  array<string, mixed>  $brief
     */
    public function buildMetaDescription(string $content, array $brief): string
    {
        $intent = trim((string) ($brief['search_intent'] ?? $brief['commercial_intent'] ?? ''));
        $plain = preg_replace('/[`#>*_\-\[\]\(\)]/u', ' ', $content) ?: $content;
        $plain = trim(preg_replace('/\s+/u', ' ', $plain) ?: $plain);
        $description = $intent !== '' ? $intent.' - '.$plain : $plain;

        return mb_substr($description !== '' ? $description : 'AI generated article summary', 0, 155, 'UTF-8');
    }

    /**
     * @param  array<string, mixed>  $brief
     * @return array<string, mixed>
     */
    private function cleanBriefArray(array $brief): array
    {
        $allowed = array_merge(array_keys($this->chineseLabels()), ['notes']);
        $cleaned = [];
        foreach ($allowed as $key) {
            if (! array_key_exists($key, $brief)) {
                continue;
            }
            $value = $brief[$key];
            if (is_array($value)) {
                $value = array_values(array_filter(array_map(
                    static fn ($item): string => trim((string) $item),
                    $value
                ), static fn (string $item): bool => $item !== ''));
            } else {
                $value = trim((string) $value);
            }
            if ($value !== '' && $value !== []) {
                $cleaned[$key] = $value;
            }
        }

        return $cleaned;
    }

    /**
     * @return array<string, string>
     */
    private function chineseLabels(): array
    {
        return [
            'target_audience' => '目标读者',
            'search_intent' => '搜索意图',
            'commercial_intent' => '商业意图',
            'target_prompt' => '目标 AI prompt',
            'source_gap' => 'Source / Citation Gap',
            'competitor_angle' => '竞品/替代方案角度',
            'required_sources' => '必须覆盖的来源',
            'facts_to_include' => '必须覆盖的事实',
            'internal_links' => '内部链接建议',
            'cta' => '转化动作',
            'retest_prompts' => '发布后复测 prompt',
            'notes' => '补充说明',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function englishLabels(): array
    {
        return [
            'target_audience' => 'Target audience',
            'search_intent' => 'Search intent',
            'commercial_intent' => 'Commercial intent',
            'target_prompt' => 'Target AI prompt',
            'source_gap' => 'Source / Citation gap',
            'competitor_angle' => 'Competitor or alternative angle',
            'required_sources' => 'Required sources',
            'facts_to_include' => 'Facts to include',
            'internal_links' => 'Internal links',
            'cta' => 'Conversion action',
            'retest_prompts' => 'Retest prompts',
            'notes' => 'Notes',
        ];
    }

    private function renderBriefValue(mixed $value): string
    {
        if (is_array($value)) {
            return implode('; ', array_values(array_filter(array_map(
                static fn ($item): string => trim((string) $item),
                $value
            ), static fn (string $item): bool => $item !== '')));
        }

        return trim((string) $value);
    }

    private function mentionsAnyBriefTerm(string $content, mixed $value): bool
    {
        $terms = is_array($value) ? $value : preg_split('/[,;，；\n]+/u', (string) $value);
        foreach ($terms ?: [] as $term) {
            $term = trim((string) $term);
            if ($term !== '' && mb_stripos($content, $term, 0, 'UTF-8') !== false) {
                return true;
            }
        }

        return false;
    }
}

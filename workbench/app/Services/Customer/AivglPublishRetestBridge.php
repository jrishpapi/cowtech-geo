<?php

namespace App\Services\Customer;

use App\Models\Article;
use App\Models\Task;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

class AivglPublishRetestBridge
{
    /**
     * @return array<string,mixed>
     */
    public function syncPublishedArticle(Article|int $article): array
    {
        $article = $article instanceof Article
            ? $article->fresh(['task'])
            : Article::query()->with('task')->whereKey($article)->first();

        if (! $article instanceof Article || (string) $article->status !== 'published') {
            return ['status' => 'skipped', 'reason' => 'article_not_published'];
        }

        $task = $article->task;
        if (! $task instanceof Task || trim((string) $task->aivgl_run_id) === '' || trim((string) $task->aivgl_brief_id) === '') {
            return ['status' => 'skipped', 'reason' => 'missing_aivgl_lineage'];
        }

        $baseUrl = rtrim((string) config('services.aivgl.base_url', ''), '/');
        if ($baseUrl === '') {
            return $this->record($article, [
                'status' => 'failed',
                'error' => 'aivgl_base_url_missing',
            ]);
        }

        try {
            $brief = $this->resolveBrief($baseUrl, $task);
            $handoff = $this->resolveHandoff($baseUrl, $task, $brief, $article);
            if ($handoff === null) {
                return $this->record($article, [
                    'status' => 'handoff_missing',
                    'error' => 'matching_aivgl_publish_handoff_not_found',
                    'brief_id' => (string) $task->aivgl_brief_id,
                    'brief_title' => $brief['title'] ?? null,
                ]);
            }

            $publishHandoff = is_array($handoff['publish_handoff'] ?? null) ? $handoff['publish_handoff'] : [];
            $handoffId = (string) ($publishHandoff['id'] ?? '');
            $handoffStatus = (string) ($publishHandoff['status'] ?? '');
            $articleUrl = $this->articleUrl($article);
            $publishedAt = $article->published_at?->toIso8601String() ?? now()->toIso8601String();
            $markPublished = null;
            $scheduleRetest = null;

            if ($handoffStatus === 'handoff_prepared') {
                $markPublished = $this->postJson($baseUrl.'/dashboard/publish-handoffs/'.rawurlencode($handoffId).'/mark-published', [
                    'url' => $articleUrl,
                    'external_reference' => 'cowtech_article_'.$article->id,
                    'published_at' => $publishedAt,
                    'actor' => 'cowtech_article_engine',
                    'note' => 'CowTech Article Engine published this article.',
                ]);
                $handoffStatus = (string) data_get($markPublished, 'result.publish_handoff.status', 'published_externally');
            }

            if ($handoffStatus === 'published_externally') {
                $scheduledFor = now()->addHours((int) config('services.aivgl.retest_delay_hours', 24))->toIso8601String();
                $scheduleRetest = $this->postJson($baseUrl.'/dashboard/publish-handoffs/'.rawurlencode($handoffId).'/schedule-retest', [
                    'scheduled_for' => $scheduledFor,
                    'actor' => 'cowtech_article_engine',
                    'note' => 'CowTech scheduled post-publish retest after article publication.',
                ]);
            }

            $updatedHandoff = is_array(data_get($scheduleRetest, 'result.publish_handoff'))
                ? data_get($scheduleRetest, 'result.publish_handoff')
                : (is_array(data_get($markPublished, 'result.publish_handoff')) ? data_get($markPublished, 'result.publish_handoff') : $publishHandoff);
            $retestSchedule = is_array(data_get($scheduleRetest, 'result.retest_schedule'))
                ? data_get($scheduleRetest, 'result.retest_schedule')
                : (is_array($updatedHandoff['retest_schedule'] ?? null) ? $updatedHandoff['retest_schedule'] : []);

            $status = ((string) ($updatedHandoff['status'] ?? $handoffStatus)) === 'retest_scheduled'
                ? 'scheduled'
                : ($handoffStatus === 'retest_scheduled' ? 'already_scheduled' : 'published_synced');

            return $this->record($article, [
                'status' => $status,
                'handoff_id' => $handoffId,
                'article_url' => $articleUrl,
                'published_at' => $publishedAt,
                'brief_id' => (string) $task->aivgl_brief_id,
                'brief_title' => $brief['title'] ?? null,
                'mark_published' => $markPublished,
                'schedule_retest' => $scheduleRetest,
                'retest_schedule_id' => (string) ($retestSchedule['id'] ?? data_get($scheduleRetest, 'result.schedule.id', '')),
                'retest_scheduled_for' => (string) ($retestSchedule['scheduled_for'] ?? data_get($scheduleRetest, 'result.schedule.scheduled_for', $updatedHandoff['retest_schedule']['scheduled_for'] ?? '')),
            ]);
        } catch (Throwable $exception) {
            return $this->record($article, [
                'status' => 'failed',
                'error' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * @return array<string,mixed>
     */
    private function resolveBrief(string $baseUrl, Task $task): array
    {
        $payload = $this->getJson($baseUrl.'/dashboard/briefs-data', [
            'run_id' => (string) $task->aivgl_run_id,
        ]);

        foreach ((array) data_get($payload, 'briefs.briefs', []) as $brief) {
            if (! is_array($brief)) {
                continue;
            }
            if ((string) ($brief['id'] ?? '') === (string) $task->aivgl_brief_id) {
                return $brief;
            }
            if ((string) ($brief['brief_key'] ?? '') !== '' && (string) ($brief['brief_key'] ?? '') === (string) $task->aivgl_brief_key) {
                return $brief;
            }
        }

        return [];
    }

    /**
     * @param  array<string,mixed>  $brief
     * @return array<string,mixed>|null
     */
    private function resolveHandoff(string $baseUrl, Task $task, array $brief, Article $article): ?array
    {
        $payload = $this->getJson($baseUrl.'/dashboard/publish-handoff-data', [
            'run_id' => (string) $task->aivgl_run_id,
        ]);

        $handoffs = (array) data_get($payload, 'publish_handoff.handoffs', []);
        $existingHandoffId = trim((string) $article->aivgl_publish_handoff_id);
        $briefTitle = Str::lower(trim((string) ($brief['title'] ?? '')));

        foreach ($handoffs as $handoff) {
            if (! is_array($handoff)) {
                continue;
            }
            $publishHandoff = is_array($handoff['publish_handoff'] ?? null) ? $handoff['publish_handoff'] : [];
            if ($existingHandoffId !== '' && (string) ($publishHandoff['id'] ?? '') === $existingHandoffId) {
                return $handoff;
            }
            $handoffTitle = Str::lower(trim((string) data_get($handoff, 'article.title', '')));
            if ($briefTitle !== '' && $handoffTitle === $briefTitle) {
                return $handoff;
            }
        }

        return null;
    }

    /**
     * @param  array<string,string>  $query
     * @return array<string,mixed>
     */
    private function getJson(string $url, array $query): array
    {
        $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
            ->acceptJson()
            ->get($url, array_filter($query));

        if (! $response->ok()) {
            throw new \RuntimeException('AIVGL GET failed: '.$response->status());
        }

        return $response->json() ?: [];
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    private function postJson(string $url, array $payload): array
    {
        $response = Http::timeout((int) config('services.aivgl.timeout_seconds', 4))
            ->acceptJson()
            ->asJson()
            ->post($url, $payload);

        if (! $response->ok()) {
            throw new \RuntimeException('AIVGL POST failed: '.$response->status().' '.$response->body());
        }

        return $response->json() ?: [];
    }

    private function articleUrl(Article $article): string
    {
        return route('site.article', ['slug' => (string) $article->slug]);
    }

    /**
     * @param  array<string,mixed>  $result
     * @return array<string,mixed>
     */
    private function record(Article $article, array $result): array
    {
        if (! Schema::hasColumn('articles', 'aivgl_retest_status')) {
            return $result;
        }

        $scheduledAt = trim((string) ($result['retest_scheduled_for'] ?? ''));
        Article::query()->whereKey((int) $article->id)->update([
            'aivgl_publish_handoff_id' => $result['handoff_id'] ?? $article->aivgl_publish_handoff_id,
            'aivgl_publish_synced_at' => in_array($result['status'] ?? '', ['scheduled', 'already_scheduled', 'published_synced'], true) ? now() : $article->aivgl_publish_synced_at,
            'aivgl_retest_schedule_id' => ($result['retest_schedule_id'] ?? '') !== '' ? $result['retest_schedule_id'] : $article->aivgl_retest_schedule_id,
            'aivgl_retest_scheduled_at' => $scheduledAt !== '' ? Carbon::parse($scheduledAt) : $article->aivgl_retest_scheduled_at,
            'aivgl_retest_status' => (string) ($result['status'] ?? 'unknown'),
            'aivgl_retest_last_error' => $result['error'] ?? null,
            'aivgl_publish_retest_payload_json' => json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        ]);

        return $result;
    }
}

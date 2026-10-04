<?php

namespace App\Services\GeoFlow;

use App\Models\ArticleDistribution;
use App\Models\DistributionChannel;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GenericWebhookPublisher implements DistributionPublisherInterface
{
    public function health(DistributionChannel $channel): array
    {
        $webhookUrl = $this->getWebhookUrl($channel);
        
        try {
            $response = Http::timeout(10)
                ->withHeaders($this->getHeaders($channel))
                ->get($webhookUrl);

            return [
                'ok' => true,
                'channel_type' => 'generic_webhook',
                'webhook_url' => $webhookUrl,
                'status_code' => $response->status(),
                'reachable' => true,
            ];
        } catch (\Exception $e) {
            return [
                'ok' => false,
                'channel_type' => 'generic_webhook',
                'webhook_url' => $webhookUrl,
                'reachable' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    public function publish(ArticleDistribution $distribution, array $payload): array
    {
        $distribution->loadMissing('channel');
        $channel = $distribution->channel;
        
        if (! $channel instanceof DistributionChannel) {
            throw new RuntimeException('分发记录缺少渠道信息。');
        }

        $webhookUrl = $this->getWebhookUrl($channel);
        $article = is_array($payload['article'] ?? null) ? $payload['article'] : [];

        $postData = $this->buildPayload($channel, $article, $payload);

        try {
            $response = Http::timeout(30)
                ->withHeaders($this->getHeaders($channel))
                ->post($webhookUrl, $postData);

            if ($response->failed()) {
                throw new RuntimeException(
                    "Webhook 请求失败：HTTP {$response->status()} - " . mb_substr($response->body(), 0, 300)
                );
            }

            return $this->parseResponse($response);
        } catch (\Exception $e) {
            throw new RuntimeException('Generic Webhook 发布失败：' . $e->getMessage());
        }
    }

    public function update(ArticleDistribution $distribution, array $payload): array
    {
        $distribution->loadMissing('channel');
        $channel = $distribution->channel;
        
        if (! $channel instanceof DistributionChannel) {
            throw new RuntimeException('分发记录缺少渠道信息。');
        }

        $webhookUrl = $this->getWebhookUrl($channel);
        $remoteId = $distribution->remote_id;

        if (empty($remoteId)) {
            return $this->publish($distribution, $payload);
        }

        $article = is_array($payload['article'] ?? null) ? $payload['article'] : [];
        $postData = $this->buildPayload($channel, $article, $payload);
        $postData['id'] = $remoteId;

        try {
            $response = Http::timeout(30)
                ->withHeaders($this->getHeaders($channel))
                ->put($webhookUrl . '/' . $remoteId, $postData);

            if ($response->failed()) {
                throw new RuntimeException(
                    "Webhook PUT 请求失败：HTTP {$response->status()} - " . mb_substr($response->body(), 0, 300)
                );
            }

            return $this->parseResponse($response);
        } catch (\Exception $e) {
            throw new RuntimeException('Generic Webhook 更新失败：' . $e->getMessage());
        }
    }

    public function delete(ArticleDistribution $distribution): array
    {
        $distribution->loadMissing('channel');
        $channel = $distribution->channel;
        
        if (! $channel instanceof DistributionChannel) {
            throw new RuntimeException('分发记录缺少渠道信息。');
        }

        $remoteId = $distribution->remote_id;
        if (empty($remoteId)) {
            return [
                'deleted' => true,
                'remote_id' => null,
                'remote_url' => null,
                'message' => 'missing_remote_id',
            ];
        }

        $webhookUrl = $this->getWebhookUrl($channel);

        try {
            $response = Http::timeout(30)
                ->withHeaders($this->getHeaders($channel))
                ->delete($webhookUrl . '/' . $remoteId);

            if ($response->failed() && $response->status() !== 404) {
                throw new RuntimeException(
                    "Webhook DELETE 请求失败：HTTP {$response->status()}"
                );
            }

            return [
                'deleted' => true,
                'remote_id' => (string) $remoteId,
                'remote_url' => null,
            ];
        } catch (\Exception $e) {
            throw new RuntimeException('Generic Webhook 删除失败：' . $e->getMessage());
        }
    }

    public function syncSiteSettings(DistributionChannel $channel): array
    {
        return [
            'ok' => true,
            'message' => 'Generic Webhook 不支持站点设置同步',
        ];
    }

    private function getWebhookUrl(DistributionChannel $channel): string
    {
        $url = rtrim((string) $channel->endpoint_url, '/');
        if ($url === '') {
            throw new RuntimeException('Webhook URL 未配置');
        }
        return $url;
    }

    private function getHeaders(DistributionChannel $channel): array
    {
        $config = $channel->resolvedChannelConfig();
        $headers = [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];

        $customHeaders = $config['webhook_headers'] ?? [];
        if (is_array($customHeaders)) {
            foreach ($customHeaders as $key => $value) {
                if (! empty($key) && ! empty($value)) {
                    $headers[$key] = $value;
                }
            }
        }

        $secret = $config['webhook_secret'] ?? null;
        if (! empty($secret)) {
            $headers['X-Webhook-Signature'] = hash_hmac('sha256', json_encode($config), $secret);
        }

        return $headers;
    }

    private function buildPayload(DistributionChannel $channel, array $article, array $payload): array
    {
        $postData = [
            'title' => (string) ($article['title'] ?? ''),
            'content' => (string) ($article['content_html'] ?? $article['content'] ?? ''),
            'excerpt' => (string) ($article['excerpt'] ?? ''),
            'slug' => (string) ($article['slug'] ?? ''),
            'author' => (string) ($article['author'] ?? 'CowTech'),
            'published_at' => now()->toIso8601String(),
            'categories' => [],
            'tags' => [],
            'meta' => [
                'source' => 'cowtech',
                'original_id' => (string) ($article['id'] ?? ''),
            ],
        ];

        if (! empty($article['keywords'])) {
            $keywords = is_string($article['keywords']) 
                ? explode(',', $article['keywords']) 
                : (is_array($article['keywords']) ? $article['keywords'] : []);
            $postData['tags'] = array_map('trim', $keywords);
        }

        return $postData;
    }

    private function parseResponse(Response $response): array
    {
        $json = $response->json();
        $body = is_array($json) ? $json : [];

        $remoteId = (string) ($body['id'] ?? $body['remote_id'] ?? $body['_id'] ?? '');
        $remoteUrl = (string) ($body['url'] ?? $body['link'] ?? $body['webhook_url'] ?? '');

        return [
            'remote_id' => $remoteId,
            'remote_url' => $remoteUrl,
            'remote_meta' => [
                'status_code' => $response->status(),
                'response_body' => $body,
            ],
        ];
    }
}

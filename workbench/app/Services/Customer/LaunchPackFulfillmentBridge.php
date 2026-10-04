<?php

namespace App\Services\Customer;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Throwable;

class LaunchPackFulfillmentBridge
{
    /**
     * @return array<string,mixed>
     */
    public function statusForEmail(string $email, string $orderId = ''): array
    {
        $email = $this->normalizeEmail($email);
        $orderId = trim($orderId);
        if (! $this->isConfigured() || $email === '' || $orderId === '') {
            return $this->unavailableStatus($this->isConfigured() ? 400 : 502);
        }

        try {
            $response = $this->client()
                ->post($this->baseUrl().'/api/internal/fulfillment/launch-pack-status', [
                    'email' => $email,
                    'order_id' => $orderId,
                ]);
        } catch (Throwable) {
            return $this->unavailableStatus();
        }

        $data = $response->json();
        $data = is_array($data) ? $data : [];

        return [
            'ok' => $response->ok() && (bool) ($data['success'] ?? false),
            'http_status' => $response->status(),
            'status' => $response->ok() ? 'available' : 'unavailable',
            'retry_after' => $this->retryAfter($response),
            'launch_pack' => $this->sanitizeLaunchPack(
                is_array($data['launch_pack'] ?? null) ? $data['launch_pack'] : []
            ),
        ];
    }

    public function downloadFile(string $email, string $filename, string $orderId): Response
    {
        $email = $this->normalizeEmail($email);
        $filename = trim($filename);
        $orderId = trim($orderId);
        if (! $this->isConfigured() || $email === '' || $filename === '' || $orderId === '') {
            throw new \RuntimeException('Launch Pack download is not configured.');
        }

        return $this->client(false)
            ->post($this->baseUrl().'/api/internal/fulfillment/launch-pack-file', [
                'email' => $email,
                'order_id' => $orderId,
                'filename' => $filename,
            ]);
    }

    public function downloadZip(string $email, string $orderId): Response
    {
        $email = $this->normalizeEmail($email);
        $orderId = trim($orderId);
        if (! $this->isConfigured() || $email === '' || $orderId === '') {
            throw new \RuntimeException('Launch Pack ZIP download is not configured.');
        }

        return $this->client(false)
            ->post($this->baseUrl().'/api/internal/fulfillment/launch-pack-zip', [
                'email' => $email,
                'order_id' => $orderId,
            ]);
    }

    /**
     * Renew the exact order's download window and enqueue its delivery email.
     * This POST is intentionally not retried here: the Worker owns idempotency.
     *
     * @return array<string,mixed>
     */
    public function redeliver(string $email, string $orderId): array
    {
        $email = $this->normalizeEmail($email);
        $orderId = trim($orderId);
        if (! $this->isConfigured() || $email === '' || $orderId === '') {
            return $this->actionFailure($this->isConfigured() ? 400 : 502, 'redelivery_unavailable');
        }

        try {
            $response = $this->client()
                ->post($this->baseUrl().'/api/internal/fulfillment/launch-pack-redeliver', [
                    'email' => $email,
                    'order_id' => $orderId,
                ]);
        } catch (Throwable) {
            return $this->actionFailure(502, 'redelivery_unavailable');
        }

        $data = $response->json();
        $data = is_array($data) ? $data : [];

        return [
            'ok' => $response->successful() && (bool) ($data['success'] ?? false),
            'http_status' => $response->status(),
            'status' => $response->successful()
                ? $this->safeString($data['status'] ?? 'redelivery_queued', 80)
                : 'redelivery_failed',
            'retry_after' => $this->retryAfter($response),
            'launch_pack' => $this->sanitizeLaunchPack(
                is_array($data['launch_pack'] ?? null) ? $data['launch_pack'] : []
            ),
        ];
    }

    /**
     * Send a one-time account-claim code through the fixed Worker email API.
     * Provider identifiers and provider errors never cross this bridge.
     *
     * @return array<string,mixed>
     */
    public function sendEmailClaim(
        string $email,
        string $orderId,
        string $claimId,
        string $code,
        string $purpose = 'account_claim'
    ): array {
        $email = $this->normalizeEmail($email);
        $orderId = trim($orderId);
        $claimId = trim($claimId);
        $code = trim($code);
        if (
            ! $this->isConfigured()
            || $email === ''
            || $orderId === ''
            || preg_match('/^[A-Za-z0-9-]{20,80}$/', $claimId) !== 1
            || preg_match('/^[0-9]{6}$/', $code) !== 1
        ) {
            return $this->actionFailure($this->isConfigured() ? 400 : 502, 'claim_email_unavailable');
        }

        try {
            $response = $this->client()
                ->post($this->baseUrl().'/api/internal/customer-email-claim/send', [
                    'email' => $email,
                    'order_id' => $orderId,
                    'claim_id' => $claimId,
                    'code' => $code,
                    'purpose' => $purpose === 'password_reset' ? 'password_reset' : 'account_claim',
                ]);
        } catch (Throwable) {
            return $this->actionFailure(502, 'claim_email_unavailable');
        }

        $data = $response->json();
        $data = is_array($data) ? $data : [];

        return [
            'ok' => $response->successful() && (bool) ($data['success'] ?? false),
            'http_status' => $response->status(),
            'status' => $response->successful() ? 'claim_email_queued' : 'claim_email_failed',
            'retry_after' => $this->retryAfter($response),
            'already_sent' => (bool) ($data['already_sent'] ?? false),
            'sent_at' => $this->safeNullableString($data['sent_at'] ?? null, 80),
        ];
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    public function trigger(array $payload): array
    {
        $email = $this->normalizeEmail($payload['email'] ?? '');
        $orderId = trim((string) ($payload['order_id'] ?? ''));
        if (! $this->isConfigured() || $email === '' || $orderId === '') {
            return $this->actionFailure($this->isConfigured() ? 400 : 502, 'fulfillment_unavailable');
        }

        try {
            $response = $this->client(
                true,
                (int) config('services.cowtech.launch_pack_timeout_seconds', 60),
            )
                ->post($this->baseUrl().'/api/internal/fulfillment/launch-pack', [
                    'email' => $email,
                    'order_id' => $orderId,
                    'brand' => trim((string) ($payload['brand_name'] ?? $payload['brand'] ?? '')),
                    'website' => trim((string) ($payload['brand_url'] ?? $payload['website'] ?? '')),
                    'description' => trim((string) ($payload['business_summary'] ?? $payload['description'] ?? '')),
                    'industry' => trim((string) ($payload['target_market'] ?? $payload['industry'] ?? '')),
                    'competitors' => is_array($payload['competitors'] ?? null)
                        ? array_slice($payload['competitors'], 0, 10)
                        : trim((string) ($payload['competitors'] ?? '')),
                    'audience' => trim((string) ($payload['audience'] ?? '')),
                    'notes' => trim((string) ($payload['notes'] ?? '')),
                    'diagnosis' => is_array($payload['diagnosis'] ?? null) ? $payload['diagnosis'] : [],
                    'source' => 'app_dashboard_start',
                ]);
        } catch (Throwable) {
            return $this->actionFailure(502, 'fulfillment_unavailable');
        }

        $data = $response->json();
        $data = is_array($data) ? $data : [];

        return [
            'ok' => $response->successful() && (bool) ($data['success'] ?? false),
            'http_status' => $response->status(),
            'status' => $this->safeString($data['status'] ?? 'unknown', 80),
            'order_id' => $this->safeString($data['order_id'] ?? $orderId, 120),
            'files_generated' => max(0, min(100, (int) ($data['files_generated'] ?? 0))),
            'already_ready' => (bool) ($data['already_ready'] ?? false),
            'retry_after' => $this->retryAfter($response),
        ];
    }

    private function client(bool $acceptJson = true, ?int $timeoutSeconds = null): PendingRequest
    {
        $timeout = $timeoutSeconds ?? (int) config('services.cowtech.timeout_seconds', 10);
        $request = Http::timeout(max(1, min(60, $timeout)))
            ->withHeaders(['X-CowTech-Entitlement-Secret' => $this->secret()]);

        return $acceptJson ? $request->acceptJson() : $request;
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.cowtech.api_base_url', ''), '/');
    }

    private function secret(): string
    {
        return trim((string) config('services.cowtech.entitlement_bridge_secret', ''));
    }

    private function isConfigured(): bool
    {
        return $this->baseUrl() !== '' && $this->secret() !== '';
    }

    private function normalizeEmail(mixed $email): string
    {
        $normalized = strtolower(trim((string) $email));

        return filter_var($normalized, FILTER_VALIDATE_EMAIL) !== false ? $normalized : '';
    }

    /**
     * @param  array<string,mixed>  $launchPack
     * @return array<string,mixed>
     */
    private function sanitizeLaunchPack(array $launchPack): array
    {
        $accessStatus = strtolower($this->safeString($launchPack['access_status'] ?? 'not_ready', 32));
        if (! in_array($accessStatus, ['active', 'expired', 'revoked', 'not_ready', 'unavailable'], true)) {
            $accessStatus = 'unavailable';
        }

        $emailStatus = strtolower($this->safeString($launchPack['completion_email_status'] ?? 'not_scheduled', 32));
        if (! in_array($emailStatus, ['not_scheduled', 'queued', 'sending', 'sent', 'failed'], true)) {
            $emailStatus = 'not_scheduled';
        }

        $files = [];
        foreach (array_slice(is_array($launchPack['files'] ?? null) ? $launchPack['files'] : [], 0, 100) as $file) {
            if (! is_array($file)) {
                continue;
            }
            $name = $this->safeFileName($file['name'] ?? '');
            if ($name === '') {
                continue;
            }
            $sha256 = strtolower($this->safeString($file['sha256'] ?? '', 64));
            $files[] = [
                'name' => $name,
                'category' => $this->safeNullableString($file['category'] ?? null, 80),
                'required' => (bool) ($file['required'] ?? false),
                'mime' => $this->safeNullableString($file['mime'] ?? null, 100),
                'quality' => $this->safeNullableString($file['quality'] ?? null, 32),
                'bytes' => is_numeric($file['bytes'] ?? null) ? max(0, (int) $file['bytes']) : null,
                'sha256' => preg_match('/^[a-f0-9]{64}$/', $sha256) === 1 ? $sha256 : null,
            ];
        }

        return [
            'has_order' => (bool) ($launchPack['has_order'] ?? false),
            'order_id' => $this->safeNullableString($launchPack['order_id'] ?? null, 120),
            'brand' => $this->safeNullableString($launchPack['brand'] ?? null, 160),
            'pkg' => $this->safeNullableString($launchPack['pkg'] ?? null, 40),
            'fulfillment_status' => $this->safeString($launchPack['fulfillment_status'] ?? 'unknown', 40),
            'status_label' => $this->safeString($launchPack['status_label'] ?? 'Status unavailable', 160),
            'next_action' => $this->safeString($launchPack['next_action'] ?? 'contact_support', 80),
            'files_ready' => (bool) ($launchPack['files_ready'] ?? false),
            'access_status' => $accessStatus,
            'downloadable' => (bool) ($launchPack['downloadable'] ?? false),
            'download_expired' => (bool) ($launchPack['download_expired'] ?? false),
            'download_expires_at' => $this->safeNullableString($launchPack['download_expires_at'] ?? null, 80),
            'can_redeliver' => (bool) ($launchPack['can_redeliver'] ?? false),
            'redeliver_retry_after_seconds' => max(0, (int) ($launchPack['redeliver_retry_after_seconds'] ?? 0)),
            'redelivery_count' => max(0, (int) ($launchPack['redelivery_count'] ?? 0)),
            'redelivery_daily_count' => max(0, (int) ($launchPack['redelivery_daily_count'] ?? 0)),
            'redelivery_daily_limit' => max(0, (int) ($launchPack['redelivery_daily_limit'] ?? 0)),
            'completion_email_status' => $emailStatus,
            'completion_email_sent_at' => $this->safeNullableString($launchPack['completion_email_sent_at'] ?? null, 80),
            'last_redelivered_at' => $this->safeNullableString($launchPack['last_redelivered_at'] ?? null, 80),
            'last_downloaded_at' => $this->safeNullableString($launchPack['last_downloaded_at'] ?? null, 80),
            'download_count' => max(0, (int) ($launchPack['download_count'] ?? 0)),
            'manifest' => $this->sanitizeManifest(
                is_array($launchPack['manifest'] ?? null) ? $launchPack['manifest'] : []
            ),
            'files' => $files,
        ];
    }

    /**
     * @param  array<string,mixed>  $manifest
     * @return array<string,mixed>|null
     */
    private function sanitizeManifest(array $manifest): ?array
    {
        if ($manifest === []) {
            return null;
        }

        $quality = is_array($manifest['quality_gate'] ?? null) ? $manifest['quality_gate'] : [];

        return [
            'status' => $this->safeString($manifest['status'] ?? 'unknown', 32),
            'contract_version' => $this->safeNullableString($manifest['contract_version'] ?? null, 80),
            'generated_at' => $this->safeNullableString($manifest['generated_at'] ?? null, 80),
            'file_count' => max(0, min(100, (int) ($manifest['file_count'] ?? 0))),
            'warning_count' => count(is_array($manifest['warnings'] ?? null) ? $manifest['warnings'] : []),
            'quality_gate' => [
                'pass' => (bool) ($quality['pass'] ?? false),
                'error_count' => count(is_array($quality['errors'] ?? null) ? $quality['errors'] : []),
                'warning_count' => count(is_array($quality['warnings'] ?? null) ? $quality['warnings'] : []),
            ],
        ];
    }

    private function safeFileName(mixed $value): string
    {
        $name = $this->safeString($value, 512);
        if (
            $name === ''
            || str_starts_with($name, '/')
            || str_contains($name, '\\')
            || preg_match('#(^|/)\.\.(/|$)#', $name) === 1
        ) {
            return '';
        }

        return $name;
    }

    private function safeString(mixed $value, int $limit): string
    {
        $clean = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', trim((string) $value));
        $clean = is_string($clean) ? preg_replace('/\s+/u', ' ', $clean) : '';

        return mb_substr(is_string($clean) ? $clean : '', 0, $limit);
    }

    private function safeNullableString(mixed $value, int $limit): ?string
    {
        $safe = $this->safeString($value, $limit);

        return $safe !== '' ? $safe : null;
    }

    private function retryAfter(Response $response): int
    {
        $value = trim((string) $response->header('Retry-After'));

        return ctype_digit($value) ? min(86400, max(0, (int) $value)) : 0;
    }

    /**
     * @return array<string,mixed>
     */
    private function unavailableStatus(int $httpStatus = 502): array
    {
        return [
            'ok' => false,
            'http_status' => $httpStatus,
            'status' => 'unavailable',
            'retry_after' => 0,
            'launch_pack' => $this->sanitizeLaunchPack([]),
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function actionFailure(int $httpStatus, string $status): array
    {
        return [
            'ok' => false,
            'http_status' => $httpStatus,
            'status' => $status,
            'retry_after' => 0,
        ];
    }
}

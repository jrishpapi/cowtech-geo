<?php

// Modified for CowTech GEO. Upstream license and attribution are retained in LICENSE and NOTICE.

namespace App\Services\GeoFlow;

use App\Models\DistributionChannelSecret;
use App\Support\GeoFlow\ApiKeyCrypto;
use Illuminate\Support\Str;
use RuntimeException;

class DistributionSigningService
{
    public function __construct(private readonly ApiKeyCrypto $apiKeyCrypto) {}

    /**
     * @return array<string,string>
     */
    public function headers(
        DistributionChannelSecret $secret,
        string $method,
        string $path,
        string $body,
        string $event,
        string $idempotencyKey
    ): array {
        $plainSecret = $this->apiKeyCrypto->decrypt((string) $secret->secret_ciphertext);
        if ($plainSecret === '') {
            throw new RuntimeException('分发渠道密钥无法解密');
        }

        $method = mb_strtoupper($method, 'UTF-8');
        $bodyHash = hash('sha256', $body);
        $timestamp = now()->toIso8601String();
        $nonce = (string) Str::uuid();
        $signature = hash_hmac(
            'sha256',
            $method."\n".$path."\n".$timestamp."\n".$nonce."\n".$bodyHash,
            $plainSecret
        );

        return [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'X-CowTech-Key-Id' => (string) $secret->key_id,
            'X-CowTech-Timestamp' => $timestamp,
            'X-CowTech-Nonce' => $nonce,
            'X-CowTech-Idempotency-Key' => $idempotencyKey,
            'X-CowTech-Body-SHA256' => $bodyHash,
            'X-CowTech-Signature' => $signature,
            'X-CowTech-Event' => $event,
        ];
    }
}

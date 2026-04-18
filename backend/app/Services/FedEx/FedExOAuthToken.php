<?php

namespace App\Services\FedEx;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class FedExOAuthToken
{
    /**
     * Cached OAuth2 access token for FedEx APIs (shared by Track, Address Validation, etc.).
     */
    public function getToken(): string
    {
        $ttl = (int) config('fedex.token_cache_seconds', 3500);

        return Cache::remember('fedex.oauth.access_token', max(60, $ttl), function (): string {
            $base = rtrim((string) config('fedex.base_url'), '/');
            $timeout = (int) config('fedex.http_timeout', 30);

            $response = Http::asForm()
                ->timeout($timeout)
                ->post($base.'/oauth/token', [
                    'grant_type' => 'client_credentials',
                    'client_id' => (string) config('fedex.client_id'),
                    'client_secret' => (string) config('fedex.client_secret'),
                ]);

            if (! $response->successful()) {
                throw new RuntimeException('FedEx OAuth failed: HTTP '.$response->status());
            }

            $token = $response->json('access_token');
            if (! is_string($token) || $token === '') {
                throw new RuntimeException('FedEx OAuth response missing access_token.');
            }

            return $token;
        });
    }
}

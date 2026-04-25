<?php

namespace App\Services\FedEx;

use Illuminate\Support\Facades\Cache;
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

            $form = [
                'grant_type' => (string) config('fedex.oauth_grant_type', 'client_credentials'),
                'client_id' => (string) config('fedex.client_id'),
                'client_secret' => (string) config('fedex.client_secret'),
            ];

            $childKey = config('fedex.oauth_child_key');
            $childSecret = config('fedex.oauth_child_secret');
            if (is_string($childKey) && $childKey !== '') {
                $form['child_Key'] = $childKey;
            }
            if (is_string($childSecret) && $childSecret !== '') {
                $form['child_secret'] = $childSecret;
            }

            // application/x-www-form-urlencoded (FedEx docs); asForm() sets Content-Type and encodes body.
            $response = FedExHttp::pending($timeout)
                ->acceptJson()
                ->asForm()
                ->post($base.'/oauth/token', $form);

            if (! $response->successful()) {
                $body = $response->json() ?? [];
                $msg = 'FedEx OAuth failed: HTTP '.$response->status().'.';
                $errors = is_array($body['errors'] ?? null) ? $body['errors'] : [];
                if (isset($errors[0]) && is_array($errors[0])) {
                    $code = isset($errors[0]['code']) ? (string) $errors[0]['code'] : '';
                    $detail = isset($errors[0]['message']) ? (string) $errors[0]['message'] : '';
                    if ($detail !== '') {
                        $msg .= ' '.$detail;
                    } elseif ($code !== '') {
                        $msg .= ' '.$code;
                    }
                }
                if (isset($body['transactionId']) && is_string($body['transactionId'])) {
                    $msg .= ' (transactionId: '.$body['transactionId'].')';
                }

                throw new RuntimeException($msg);
            }

            $token = $response->json('access_token');
            if (! is_string($token) || $token === '') {
                throw new RuntimeException('FedEx OAuth response missing access_token.');
            }

            return $token;
        });
    }
}

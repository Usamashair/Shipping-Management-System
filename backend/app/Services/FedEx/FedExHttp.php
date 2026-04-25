<?php

namespace App\Services\FedEx;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Shared Guzzle/cURL options for outbound FedEx API calls (OAuth, Ship, Address, Track).
 */
final class FedExHttp
{
    /**
     * TLS options for {@see PendingRequest::withOptions()}.
     * Use FEDEX_CAINFO_PATH for a PEM bundle (e.g. curl cacert.pem) or corporate root CA.
     * FEDEX_HTTP_VERIFY_SSL=false disables verification (local dev only; never in production).
     *
     * @return array<string, mixed>
     */
    public static function tlsOptions(): array
    {
        $caPath = config('fedex.http_ca_path');
        if (is_string($caPath) && $caPath !== '' && is_readable($caPath)) {
            return ['verify' => $caPath];
        }

        $verify = filter_var(config('fedex.http_verify_ssl', true), FILTER_VALIDATE_BOOL);

        return ['verify' => $verify];
    }

    public static function pending(?int $timeout = null): PendingRequest
    {
        $t = $timeout ?? (int) config('fedex.http_timeout', 30);

        return Http::withOptions(self::tlsOptions())->timeout($t);
    }
}

<?php

namespace App\Services\FedEx;

/**
 * FedEx Tracking Webhook: verify x-fedex-signature (HMAC-SHA256 hex of raw POST body, secret = FDP security token).
 */
final class FedExTrackingWebhookSignatureValidator
{
    public static function isValid(string $rawBody, ?string $headerSignature, string $secret): bool
    {
        if ($secret === '' || $headerSignature === null) {
            return false;
        }

        $headerSignature = trim($headerSignature);
        if ($headerSignature === '') {
            return false;
        }

        $expectedHex = hash_hmac('sha256', $rawBody, $secret, false);

        return hash_equals(strtolower($expectedHex), strtolower($headerSignature));
    }
}

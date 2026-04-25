<?php

namespace App\Services\FedEx;

/**
 * Map webhook status hints to values accepted by {@see FedExStatusMapper::toInternal}.
 */
final class FedExWebhookEventMapper
{
    /**
     * @param  array<string, mixed>  $payload  Decoded webhook JSON (for future structured codes)
     */
    public static function guessMappedStatus(string $statusText, array $payload = []): ?string
    {
        unset($payload);
        $desc = strtolower($statusText);

        if ($desc === '') {
            return null;
        }

        if (str_contains($desc, 'out for delivery')) {
            return 'in_transit';
        }

        if (str_contains($desc, 'deliver')) {
            return 'delivered';
        }

        if (str_contains($desc, 'exception') || str_contains($desc, 'fail') || str_contains($desc, 'delay')) {
            return 'failed';
        }

        if (str_contains($desc, 'label') && str_contains($desc, 'creat')) {
            return 'pending';
        }

        if (str_contains($desc, 'pickup') || str_contains($desc, 'transit') || str_contains($desc, 'in transit')) {
            return 'in_transit';
        }

        if (str_contains($desc, 'pending')) {
            return 'pending';
        }

        return 'in_transit';
    }
}

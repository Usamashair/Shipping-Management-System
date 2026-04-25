<?php

namespace App\Services\FedEx;

class FedExShipErrorMapper
{
    /** User-facing message when FedEx rejects input (do not surface raw FedEx text in API `message`). */
    public const GENERIC_INVALID_INPUT_MESSAGE = 'Shipment cannot be created. Please verify address and service details.';

    public static function mapCode(?string $code): string
    {
        if ($code === null || $code === '') {
            return '';
        }

        return match ($code) {
            'SHIPMENT.POSTALCODE.INVALID' => 'Invalid ZIP/postal code.',
            'ACCOUNT.NUMBER.INVALID' => 'FedEx account configuration error.',
            'SHIPMENT.SERVICETYPE.INVALID' => 'Selected service is not available for this route.',
            'WEIGHT.VALUE.INVALID' => 'Invalid package weight.',
            'SHIPMENT.PACKAGEDIMENSION.INVALID' => 'Invalid package dimensions.',
            'INVALID.INPUT.EXCEPTION' => self::GENERIC_INVALID_INPUT_MESSAGE,
            default => 'FedEx error: '.$code,
        };
    }

    /**
     * @param  array<int, mixed>  $errors
     * @return array<int, string>
     */
    public static function messagesFromErrors(array $errors): array
    {
        $out = [];
        foreach ($errors as $err) {
            if (! is_array($err)) {
                continue;
            }
            $code = isset($err['code']) ? (string) $err['code'] : '';
            if ($code === 'INVALID.INPUT.EXCEPTION') {
                $mapped = self::mapCode($code);
                if ($mapped !== '') {
                    $out[] = $mapped;
                }

                continue;
            }
            $base = self::mapCode($code);
            if (isset($err['message']) && is_string($err['message']) && $err['message'] !== '') {
                $base = $base !== '' && ! str_contains($base, $err['message'])
                    ? $base.' '.$err['message']
                    : ($base !== '' ? $base : $err['message']);
            }
            if ($base !== '') {
                $out[] = $base;
            }
        }

        return $out;
    }
}

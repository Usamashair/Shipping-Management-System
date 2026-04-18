<?php

namespace App\Services\FedEx;

class FedExShipErrorMapper
{
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

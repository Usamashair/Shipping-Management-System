<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Support\UsNationalPhoneNormalizer;

/**
 * System-wide default ship-to: all customer FedEx create flows use this unless overridden in app_settings.
 */
final class FixedRecipientService
{
    /**
     * Raw shape stored in `app_settings` / seeder: personName, companyName, phoneNumber, email, address[].
     *
     * @return array{
     *   personName: string,
     *   companyName: string,
     *   phoneNumber: string,
     *   email: string,
     *   address: array{
     *     streetLines: array<int, string>,
     *     city: string,
     *     stateOrProvinceCode: string,
     *     postalCode: string,
     *     countryCode: string,
     *     residential: bool
     *   }
     * }
     */
    public static function rawOrDefault(): array
    {
        try {
            $v = AppSetting::get('fixed_recipient');
            if (is_array($v) && isset($v['address']) && is_array($v['address'])) {
                return self::normalizeRaw($v);
            }
        } catch (\Throwable) {
            // Missing `app_settings` (e.g. unit tests) or DB: use embedded default.
        }

        return self::defaultRaw();
    }

    /**
     * FedEx Ship `recipients[0]` shape (required by sanitizer and API).
     *
     * @return array<int, array<string, mixed>>
     */
    public static function asFedExRecipientsArray(): array
    {
        $r = self::rawOrDefault();

        $contactPhone = (string) $r['phoneNumber'];
        $cc = strtoupper((string) ($r['address']['countryCode'] ?? 'US'));
        if ($cc === 'US') {
            $contactPhone = UsNationalPhoneNormalizer::stripAndNormalizeUsNationalToTen($contactPhone);
        } else {
            $contactPhone = preg_replace('/\D+/', '', $contactPhone) ?: $contactPhone;
        }

        return [
            [
                'contact' => [
                    'personName' => $r['personName'],
                    'phoneNumber' => $contactPhone,
                    'companyName' => $r['companyName'] !== '' ? $r['companyName'] : 'Recipient',
                ],
                'address' => $r['address'],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $v
     * @return array{
     *   personName: string,
     *   companyName: string,
     *   phoneNumber: string,
     *   email: string,
     *   address: array{
     *     streetLines: array<int, string>,
     *     city: string,
     *     stateOrProvinceCode: string,
     *     postalCode: string,
     *     countryCode: string,
     *     residential: bool
     *   }
     * }
     */
    public static function normalizeRaw(array $v): array
    {
        $addr = is_array($v['address'] ?? null) ? $v['address'] : [];
        $lines = $addr['streetLines'] ?? [];
        if (! is_array($lines)) {
            $lines = [];
        }
        $lines = array_values(array_filter(array_map('strval', $lines), fn ($s) => $s !== ''));
        if ($lines === []) {
            $lines = ['174 Main Ave'];
        }

        return [
            'personName' => (string) ($v['personName'] ?? 'Danny Mita'),
            'companyName' => (string) ($v['companyName'] ?? 'Mobile Pros LLC'),
            'phoneNumber' => (string) ($v['phoneNumber'] ?? '9172511533'),
            'email' => (string) ($v['email'] ?? 'danny@mobileprosllc.com'),
            'address' => [
                'streetLines' => $lines,
                'city' => (string) ($addr['city'] ?? 'Wallington'),
                'stateOrProvinceCode' => strtoupper(substr((string) ($addr['stateOrProvinceCode'] ?? 'NJ'), 0, 32)),
                'postalCode' => (string) ($addr['postalCode'] ?? '07057'),
                'countryCode' => strtoupper(substr((string) ($addr['countryCode'] ?? 'US'), 0, 2)),
                'residential' => (bool) ($addr['residential'] ?? false),
            ],
        ];
    }

    /**
     * @return array{
     *   personName: string,
     *   companyName: string,
     *   phoneNumber: string,
     *   email: string,
     *   address: array{
     *     streetLines: array<int, string>,
     *     city: string,
     *     stateOrProvinceCode: string,
     *     postalCode: string,
     *     countryCode: string,
     *     residential: bool
     *   }
     * }
     */
    public static function defaultRaw(): array
    {
        return self::normalizeRaw([
            'personName' => 'Danny Mita',
            'companyName' => 'Mobile Pros LLC',
            'phoneNumber' => '9172511533',
            'email' => 'danny@mobileprosllc.com',
            'address' => [
                'streetLines' => ['174 Main Ave'],
                'city' => 'Wallington',
                'stateOrProvinceCode' => 'NJ',
                'postalCode' => '07057',
                'countryCode' => 'US',
                'residential' => false,
            ],
        ]);
    }
}

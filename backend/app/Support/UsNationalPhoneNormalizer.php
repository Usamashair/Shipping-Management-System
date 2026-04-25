<?php

namespace App\Support;

/**
 * US NANP: national 10 digits. Strips non-digits, then leading country code 1 when 11 digits
 * (same rules as {@see \App\Services\FedEx\FedExDomesticShipPayloadSanitizer} for domestic US).
 */
final class UsNationalPhoneNormalizer
{
    /**
     * Digits only, then US 11→10 (leading 1) and last-10 for longer digit runs.
     * Result may be 7–9 digits; callers validate 10 for US.
     */
    public static function stripAndNormalizeUsNationalToTen(string $input): string
    {
        $d = preg_replace('/\D+/', '', $input) ?? '';
        if ($d === '') {
            return '';
        }
        if (strlen($d) === 11 && str_starts_with($d, '1')) {
            $d = substr($d, 1);
        }
        if (strlen($d) === 10) {
            return $d;
        }
        if (strlen($d) > 10) {
            return substr($d, -10);
        }

        return $d;
    }

    /**
     * @return string|null  Exactly 10 national digits, or null if not representable
     */
    public static function toTenDigitNationalOrNullFromDigits(string $digitsOnly): ?string
    {
        if ($digitsOnly === '') {
            return null;
        }
        $d = $digitsOnly;
        if (strlen($d) === 11 && str_starts_with($d, '1')) {
            $d = substr($d, 1);
        }
        if (strlen($d) === 10) {
            return $d;
        }
        if (strlen($d) > 10) {
            $d = substr($d, -10);
        }

        return strlen($d) === 10 ? $d : null;
    }
}

<?php

namespace App\Services\FedEx;

/**
 * Validates US city + ZIP against the same JSON dataset as the frontend dropdowns
 * (resources/data/us/cities/{STATE}.json).
 */
class UsLocationDatasetValidator
{
    public const COMPLIANCE_MESSAGE = 'Invalid field value in address. Please verify state, city, ZIP, street, and phone format according to FedEx requirements.';

    /**
     * @return array<int, string> Empty if valid; one or more reasons otherwise (for logging/tests).
     */
    public function validateUsLegacyRow(array $details): array
    {
        $country = strtoupper(trim((string) ($details['country'] ?? '')));
        if ($country !== 'US') {
            return [];
        }

        $state = strtoupper(trim((string) ($details['state'] ?? '')));
        $city = trim((string) ($details['city'] ?? ''));
        $postalRaw = trim((string) ($details['postalCode'] ?? ''));

        if ($state === '' || $city === '' || $postalRaw === '') {
            return ['Missing state, city, or postal code.'];
        }

        if (! preg_match('/^[A-Z]{2}$/', $state)) {
            return ['State must be a 2-letter code.'];
        }

        $path = resource_path('data/us/cities/'.$state.'.json');
        if (! is_readable($path)) {
            return ['US location dataset missing for state '.$state.'. Run frontend script: npm run generate-us-data'];
        }

        $json = json_decode((string) file_get_contents($path), true);
        if (! is_array($json) || ! isset($json['cities']) || ! is_array($json['cities'])) {
            return ['Invalid US location dataset.'];
        }

        $zipBase = $this->normalizeUsZipBase($postalRaw);
        if ($zipBase === '') {
            return ['Invalid US postal code.'];
        }

        foreach ($json['cities'] as $row) {
            if (! is_array($row) || ! isset($row['name'], $row['zips'])) {
                continue;
            }
            if ((string) $row['name'] !== $city) {
                continue;
            }
            $zips = is_array($row['zips']) ? $row['zips'] : [];
            foreach ($zips as $z) {
                if (is_string($z) && $this->normalizeUsZipBase($z) === $zipBase) {
                    return [];
                }
            }

            return ['Postal code does not match selected city and state.'];
        }

        return ['City is not in the allowed list for this state.'];
    }

    private function normalizeUsZipBase(string $postal): string
    {
        $digits = preg_replace('/\D+/', '', $postal) ?? '';
        if (strlen($digits) >= 5) {
            return substr($digits, 0, 5);
        }

        return '';
    }
}

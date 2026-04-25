<?php

namespace App\Services\FedEx;

use App\Enums\FedExServiceType;
use App\Support\UsNationalPhoneNormalizer;
use App\Support\UsStateCodeNormalizer;

/**
 * Pre-flight normalization and validation for US domestic FedEx Ship API payloads.
 * Runs before {@see FedExShipApiService::buildRootPayload}.
 */
class FedExDomesticShipPayloadSanitizer
{
    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     *
     * @throws FedExShipPayloadSanitizationException
     */
    public function sanitize(array $data): array
    {
        $serviceType = trim((string) ($data['serviceType'] ?? ''));
        if ($serviceType === '') {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ['serviceType'], 'serviceType is required.');
        }
        if (FedExServiceType::tryFrom($serviceType) === null) {
            throw new FedExShipPayloadSanitizationException('SERVICE_NOT_AVAILABLE', ['serviceType'], 'serviceType is not allowed.');
        }

        $packagingType = trim((string) ($data['packagingType'] ?? ''));
        if ($packagingType === '') {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ['packagingType'], 'packagingType is required.');
        }

        $shipper = $data['shipper'] ?? null;
        if (! is_array($shipper)) {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ['shipper'], 'shipper is required.');
        }

        $recipients = $data['recipients'] ?? [];
        if (! is_array($recipients) || $recipients === []) {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ['recipients'], 'At least one recipient is required.');
        }

        $packages = $data['packages'] ?? [];
        if (! is_array($packages) || $packages === []) {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ['packages'], 'At least one package is required.');
        }

        $out = $data;
        $out['serviceType'] = $serviceType;
        $out['packagingType'] = $packagingType;
        $out['shipper'] = $this->sanitizeParty($shipper, 'shipper', false, false);

        $isResidentialRoot = (bool) ($data['is_residential'] ?? false);

        $out['recipients'] = [];
        foreach ($recipients as $i => $r) {
            if (! is_array($r)) {
                continue;
            }
            $out['recipients'][] = $this->sanitizeParty($r, "recipients.{$i}", true, $isResidentialRoot);
        }
        if ($out['recipients'] === []) {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ['recipients'], 'At least one valid recipient is required.');
        }

        $out['packages'] = [];
        foreach ($packages as $i => $pkg) {
            if (! is_array($pkg)) {
                continue;
            }
            $out['packages'][] = $this->sanitizePackage($pkg, "packages.{$i}");
        }
        if ($out['packages'] === []) {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ['packages'], 'At least one valid package is required.');
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function sanitizeParty(array $party, string $prefix, bool $isRecipient = false, bool $isResidentialDefault = false): array
    {
        $contact = is_array($party['contact'] ?? null) ? $party['contact'] : [];
        $address = is_array($party['address'] ?? null) ? $party['address'] : [];

        $personName = trim((string) ($contact['personName'] ?? ''));
        if ($personName === '') {
            throw new FedExShipPayloadSanitizationException('MISSING_FIELDS', ["{$prefix}.contact.personName"], 'personName is required.');
        }

        $phoneRaw = (string) ($contact['phoneNumber'] ?? '');
        $phoneDigits = preg_replace('/\D+/', '', $phoneRaw) ?? '';
        $phone = UsNationalPhoneNormalizer::toTenDigitNationalOrNullFromDigits($phoneDigits);
        if ($phone === null) {
            throw new FedExShipPayloadSanitizationException('PHONE_INVALID', ["{$prefix}.contact.phoneNumber"], 'US phone must be 10 digits.');
        }

        $lines = $address['streetLines'] ?? [];
        if (! is_array($lines)) {
            $lines = [];
        }
        $trimmed = [];
        foreach ($lines as $line) {
            if (! is_string($line)) {
                continue;
            }
            $t = trim($line);
            if ($t === '') {
                continue;
            }
            $trimmed[] = mb_substr($t, 0, 150);
        }
        if ($trimmed === []) {
            throw new FedExShipPayloadSanitizationException('ADDRESS_INVALID', ["{$prefix}.address.streetLines"], 'At least one street line is required.');
        }

        $city = trim((string) ($address['city'] ?? ''));
        if ($city === '') {
            throw new FedExShipPayloadSanitizationException('ADDRESS_INVALID', ["{$prefix}.address.city"], 'city is required.');
        }

        $state = UsStateCodeNormalizer::normalizeForUs((string) ($address['stateOrProvinceCode'] ?? ''));
        if ($state === null) {
            throw new FedExShipPayloadSanitizationException('INVALID_STATE', ["{$prefix}.address.stateOrProvinceCode"], UsStateCodeNormalizer::INVALID_MESSAGE);
        }

        $postal = trim((string) ($address['postalCode'] ?? ''));
        if (! preg_match('/^\d{5}(-\d{4})?$/', $postal)) {
            throw new FedExShipPayloadSanitizationException('ADDRESS_INVALID', ["{$prefix}.address.postalCode"], 'Invalid US postal code.');
        }

        $company = isset($contact['companyName']) ? trim((string) $contact['companyName']) : '';
        $companyName = $company !== '' ? mb_substr($company, 0, 255) : 'N/A';

        $addrOut = [
            'streetLines' => $trimmed,
            'city' => mb_substr($city, 0, 120),
            'stateOrProvinceCode' => $state,
            'postalCode' => $postal,
            'countryCode' => 'US',
        ];
        if ($isRecipient) {
            $addrOut['residential'] = (bool) ($address['residential'] ?? $isResidentialDefault);
        }

        return [
            'contact' => [
                'personName' => $personName,
                'phoneNumber' => $phone,
                'companyName' => $companyName,
            ],
            'address' => $addrOut,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sanitizePackage(array $pkg, string $prefix): array
    {
        $w = (float) data_get($pkg, 'weight.value', 0);
        if ($w <= 0.1) {
            throw new FedExShipPayloadSanitizationException('PACKAGE_INVALID', ["{$prefix}.weight.value"], 'Weight must be greater than 0.1 LB.');
        }

        $len = (float) data_get($pkg, 'dimensions.length', 0);
        $wid = (float) data_get($pkg, 'dimensions.width', 0);
        $hgt = (float) data_get($pkg, 'dimensions.height', 0);
        if ($len < 1 || $wid < 1 || $hgt < 1) {
            throw new FedExShipPayloadSanitizationException('PACKAGE_INVALID', ["{$prefix}.dimensions"], 'Dimensions must be at least 1 IN each.');
        }

        $units = (string) (data_get($pkg, 'weight.units') ?: 'LB');
        $dimUnits = (string) (data_get($pkg, 'dimensions.units') ?: 'IN');

        $out = [
            'weight' => [
                'units' => $units,
                'value' => $w,
            ],
            'dimensions' => [
                'length' => (int) round($len),
                'width' => (int) round($wid),
                'height' => (int) round($hgt),
                'units' => $dimUnits,
            ],
        ];

        $desc = trim((string) data_get($pkg, 'description', ''));
        if ($desc !== '') {
            $out['description'] = $desc;
        }

        return $out;
    }
}

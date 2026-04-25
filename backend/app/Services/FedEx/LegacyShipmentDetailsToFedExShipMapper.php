<?php

namespace App\Services\FedEx;

use App\Enums\FedExServiceType;
use App\Services\FixedRecipientService;
use App\Support\UsStateCodeNormalizer;

/**
 * Maps customer/admin legacy JSON (sender_details, receiver_details, package_details)
 * to the FedEx Ship API payload shape (ISO 3166-1 alpha-2 country codes).
 */
class LegacyShipmentDetailsToFedExShipMapper
{
    /**
     * @param  array<string, mixed>  $sender
     * @param  array<string, mixed>  $receiver
     * @param  array<string, mixed>  $package
     * @param  string|null  $serviceTypeOverride  When set to a valid {@see FedExServiceType} value, used instead of config/lane defaults.
     * @return array<string, mixed>
     */
    public function toFedExShipPayload(array $sender, array $receiver, array $package, ?string $serviceTypeOverride = null): array
    {
        $serviceType = ($serviceTypeOverride !== null && $serviceTypeOverride !== '' && FedExServiceType::tryFrom($serviceTypeOverride) !== null)
            ? $serviceTypeOverride
            : $this->resolveInitialServiceTypeForSender($sender);
        $packagingType = (string) config('fedex.default_packaging_type', 'YOUR_PACKAGING');
        $pickupType = $this->resolvePickupTypeForSender($sender);
        $senderLines = array_values(array_filter([
            trim((string) ($sender['street1'] ?? '')),
            trim((string) ($sender['street2'] ?? '')),
        ], fn (string $s) => $s !== ''));

        if ($senderLines === []) {
            $senderLines = [''];
        }

        $fixed = FixedRecipientService::rawOrDefault();
        $isResidential = (bool) ($fixed['address']['residential'] ?? false);

        $weight = max(0.1, (float) ($package['weightLb'] ?? 1));
        $length = max(1, (int) floor((float) ($package['lengthIn'] ?? 1)));
        $width = max(1, (int) floor((float) ($package['widthIn'] ?? 1)));
        $height = max(1, (int) floor((float) ($package['heightIn'] ?? 1)));
        $description = trim((string) ($package['description'] ?? 'General merchandise'));
        if ($description === '') {
            $description = 'General merchandise';
        }

        return [
            'serviceType' => $serviceType,
            'packagingType' => $packagingType,
            'pickupType' => $pickupType,
            'is_residential' => $isResidential,
            'shipper' => [
                'contact' => [
                    'personName' => trim((string) ($sender['name'] ?? 'Sender')) ?: 'Sender',
                    'phoneNumber' => trim((string) ($sender['phone'] ?? '')) ?: '0000000000',
                    'companyName' => trim((string) ($sender['company'] ?? '')) ?: 'N/A',
                ],
                'address' => [
                    'streetLines' => $senderLines,
                    'city' => trim((string) ($sender['city'] ?? '')),
                    'stateOrProvinceCode' => $this->iso2StateOrProvince(
                        (string) ($sender['state'] ?? ''),
                        $this->iso2Country((string) ($sender['country'] ?? 'US'))
                    ),
                    'postalCode' => trim((string) ($sender['postalCode'] ?? '')),
                    'countryCode' => $this->iso2Country((string) ($sender['country'] ?? 'US')),
                ],
            ],
            'recipients' => FixedRecipientService::asFedExRecipientsArray(),
            'packages' => [
                [
                    'weight' => ['value' => $weight, 'units' => 'LB'],
                    'dimensions' => [
                        'length' => $length,
                        'width' => $width,
                        'height' => $height,
                        'units' => 'IN',
                    ],
                    'description' => $description,
                ],
            ],
        ];
    }

    /**
     * Draft `serviceType` for the domestic sanitizer. When {@see config('fedex.rate_lookup_enabled')} is true,
     * {@see FedExRateApiService} replaces this with a FedEx Rate API result before Ship validate/create.
     *
     * @param  array<string, mixed>  $sender
     */
    private function resolveInitialServiceTypeForSender(array $sender): string
    {
        if (filter_var(config('fedex.rate_lookup_enabled', true), FILTER_VALIDATE_BOOL)) {
            $placeholder = (string) config('fedex.rate_placeholder_service_type', 'FEDEX_GROUND');

            return $placeholder !== '' ? $placeholder : 'FEDEX_GROUND';
        }

        $country = $this->iso2Country((string) ($sender['country'] ?? 'US'));
        if ($country === 'US') {
            $code = UsStateCodeNormalizer::normalizeForUs(trim((string) ($sender['state'] ?? '')));
            if ($code === 'HI' || $code === 'AK') {
                $express = (string) config('fedex.non_contiguous_origin_service_type', 'FEDEX_EXPRESS_SAVER');

                return $express !== '' ? $express : 'FEDEX_EXPRESS_SAVER';
            }
        }

        $default = (string) config('fedex.default_service_type', 'FEDEX_GROUND');

        return $default !== '' ? $default : 'FEDEX_GROUND';
    }

    /**
     * Scheduled pickup from HI/AK often fails in sandbox (INVALID.INPUT); prefer drop-off unless overridden.
     *
     * @param  array<string, mixed>  $sender
     */
    private function resolvePickupTypeForSender(array $sender): string
    {
        $country = $this->iso2Country((string) ($sender['country'] ?? 'US'));
        if ($country === 'US') {
            $code = UsStateCodeNormalizer::normalizeForUs(trim((string) ($sender['state'] ?? '')));
            if ($code === 'HI' || $code === 'AK') {
                $pt = (string) config('fedex.non_contiguous_origin_pickup_type', 'DROPOFF_AT_FEDEX_LOCATION');

                return $pt !== '' ? $pt : 'DROPOFF_AT_FEDEX_LOCATION';
            }
        }

        $default = (string) config('fedex.default_pickup_type', 'USE_SCHEDULED_PICKUP');

        return $default !== '' ? $default : 'USE_SCHEDULED_PICKUP';
    }

    private function iso2Country(string $country): string
    {
        $c = strtoupper(substr(trim($country), 0, 2));

        return $c !== '' ? $c : 'US';
    }

    /**
     * FedEx expects 2-letter state/province for US and CA (never full US state names).
     */
    private function iso2StateOrProvince(string $state, string $countryCode): string
    {
        $s = trim($state);
        $cc = strtoupper(substr($countryCode, 0, 2));
        if ($cc === 'US') {
            $normalized = UsStateCodeNormalizer::normalizeForUs($s);

            return $normalized ?? '';
        }
        if ($cc === 'CA') {
            if (preg_match('/^[A-Za-z]{2}$/', $s) === 1) {
                return strtoupper($s);
            }

            return strtoupper(substr($s, 0, 2));
        }

        return $s;
    }
}

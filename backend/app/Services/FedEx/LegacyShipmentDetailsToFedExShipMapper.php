<?php

namespace App\Services\FedEx;

use App\Http\Requests\Api\ValidateFedExShipRequest;

/**
 * Maps customer/admin legacy JSON (sender_details, receiver_details, package_details)
 * to the FedEx Ship API payload shape validated by {@see ValidateFedExShipRequest}.
 */
class LegacyShipmentDetailsToFedExShipMapper
{
    /**
     * @param  array<string, mixed>  $sender
     * @param  array<string, mixed>  $receiver
     * @param  array<string, mixed>  $package
     * @return array<string, mixed>
     */
    public function toFedExShipPayload(array $sender, array $receiver, array $package): array
    {
        $serviceType = (string) config('fedex.default_service_type', 'FEDEX_GROUND');
        $packagingType = (string) config('fedex.default_packaging_type', 'YOUR_PACKAGING');
        $pickupType = (string) config('fedex.default_pickup_type', 'USE_SCHEDULED_PICKUP');
        $isResidential = (bool) config('fedex.default_is_residential', false);

        $senderLines = array_values(array_filter([
            trim((string) ($sender['street1'] ?? '')),
            trim((string) ($sender['street2'] ?? '')),
        ], fn (string $s) => $s !== ''));

        $receiverLines = array_values(array_filter([
            trim((string) ($receiver['street1'] ?? '')),
            trim((string) ($receiver['street2'] ?? '')),
        ], fn (string $s) => $s !== ''));

        if ($senderLines === []) {
            $senderLines = [''];
        }
        if ($receiverLines === []) {
            $receiverLines = [''];
        }

        $weight = max(0.01, (float) ($package['weightLb'] ?? 1));
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
                    'companyName' => trim((string) ($sender['company'] ?? '')) ?: null,
                ],
                'address' => [
                    'streetLines' => $senderLines,
                    'city' => trim((string) ($sender['city'] ?? '')),
                    'stateOrProvinceCode' => trim((string) ($sender['state'] ?? '')),
                    'postalCode' => trim((string) ($sender['postalCode'] ?? '')),
                    'countryCode' => strtoupper(substr(trim((string) ($sender['country'] ?? 'US')) ?: 'US', 0, 8)),
                ],
            ],
            'recipients' => [
                [
                    'contact' => [
                        'personName' => trim((string) ($receiver['name'] ?? 'Recipient')) ?: 'Recipient',
                        'phoneNumber' => trim((string) ($receiver['phone'] ?? '')) ?: '0000000000',
                        'companyName' => trim((string) ($receiver['company'] ?? '')) ?: null,
                    ],
                    'address' => [
                        'streetLines' => $receiverLines,
                        'city' => trim((string) ($receiver['city'] ?? '')),
                        'stateOrProvinceCode' => trim((string) ($receiver['state'] ?? '')),
                        'postalCode' => trim((string) ($receiver['postalCode'] ?? '')),
                        'countryCode' => strtoupper(substr(trim((string) ($receiver['country'] ?? 'US')) ?: 'US', 0, 8)),
                    ],
                ],
            ],
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
}

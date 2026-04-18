<?php

namespace App\Services\FedEx;

use App\Contracts\FedEx\FedExClient;

class StubFedExClient implements FedExClient
{
    public function createShipment(
        array $senderDetails,
        array $receiverDetails,
        array $packageDetails,
    ): array {
        $suffix = strtoupper(bin2hex(random_bytes(3)));

        return [
            'tracking_number' => 'FX-STUB-'.$suffix,
            'label_base64' => $this->tinyPngBase64(),
            'fedex_response' => [
                'mock' => true,
                'mode' => 'stub',
                'transactionId' => 'stub-'.uniqid('', true),
                'serviceType' => 'FEDEX_GROUND',
            ],
        ];
    }

    public function track(string $trackingNumber): array
    {
        return [
            'status' => 'In transit (stub)',
            'location' => 'Memphis, TN (stub hub)',
            'raw_response' => [
                'mock' => true,
                'trackingNumber' => $trackingNumber,
                'eventType' => 'IT',
            ],
            'mapped_status' => 'in_transit',
        ];
    }

    private function tinyPngBase64(): string
    {
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            true
        );

        return base64_encode($png);
    }
}

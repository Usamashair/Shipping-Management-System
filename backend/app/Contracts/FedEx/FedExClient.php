<?php

namespace App\Contracts\FedEx;

interface FedExClient
{
    /**
     * @param  array<string, mixed>  $senderDetails
     * @param  array<string, mixed>  $receiverDetails
     * @param  array<string, mixed>  $packageDetails
     * @return array{tracking_number: string, label_base64: string, fedex_response: array<string, mixed>}
     */
    public function createShipment(
        array $senderDetails,
        array $receiverDetails,
        array $packageDetails,
    ): array;

    /**
     * @return array{status: string, location: string, raw_response: array<string, mixed>, mapped_status?: string}
     */
    public function track(string $trackingNumber): array;
}

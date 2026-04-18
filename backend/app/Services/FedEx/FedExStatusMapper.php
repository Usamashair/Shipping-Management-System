<?php

namespace App\Services\FedEx;

class FedExStatusMapper
{
    /**
     * Map external / stub status hints to internal shipment statuses.
     */
    public function toInternal(?string $mapped): string
    {
        return match ($mapped) {
            'pending' => 'pending',
            'in_transit' => 'in_transit',
            'delivered' => 'delivered',
            'failed' => 'failed',
            default => 'in_transit',
        };
    }
}

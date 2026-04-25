<?php

namespace App\Services\FedEx\FreightLtl;

/**
 * Proxies FedEx Freight LTL pickup availability, create, and cancel.
 *
 * @see FedExFreightLtlApiCatalog
 */
class FedExFreightLtlPickupService extends AbstractFedExFreightLtlService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function pickupAvailability(array $payload, ?string $customerTransactionId = null, ?string $locale = null): array
    {
        $path = (string) config(
            'fedex.freight_ltl.paths.pickup_availability',
            FedExFreightLtlApiCatalog::DEFAULT_PATH_PICKUP_AVAILABILITY,
        );

        return $this->postJson($path, $payload, 'freight_ltl_pickup_availability', $customerTransactionId, $locale);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function createPickup(array $payload, ?string $customerTransactionId = null, ?string $locale = null): array
    {
        $path = (string) config('fedex.freight_ltl.paths.pickups', FedExFreightLtlApiCatalog::DEFAULT_PATH_PICKUPS);

        return $this->postJson($path, $payload, 'freight_ltl_pickups_create', $customerTransactionId, $locale);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function cancelPickup(array $payload, ?string $customerTransactionId = null, ?string $locale = null): array
    {
        $path = (string) config('fedex.freight_ltl.paths.pickup_cancel', FedExFreightLtlApiCatalog::DEFAULT_PATH_PICKUP_CANCEL);

        return $this->putJson($path, $payload, 'freight_ltl_pickups_cancel', $customerTransactionId, $locale);
    }
}

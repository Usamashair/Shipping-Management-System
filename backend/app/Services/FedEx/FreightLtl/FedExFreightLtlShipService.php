<?php

namespace App\Services\FedEx\FreightLtl;

/**
 * Proxies FedEx Freight LTL Ship API (POST /ltl-freight/v1/shipments).
 *
 * @see FedExFreightLtlApiCatalog::DEFAULT_PATH_SHIPMENTS
 */
class FedExFreightLtlShipService extends AbstractFedExFreightLtlService
{
    /**
     * @param  array<string, mixed>  $payload  FedEx freight shipment create/validate body
     * @return array<string, mixed>
     */
    public function ship(array $payload, ?string $customerTransactionId = null, ?string $locale = null): array
    {
        $path = (string) config('fedex.freight_ltl.paths.shipments', FedExFreightLtlApiCatalog::DEFAULT_PATH_SHIPMENTS);

        return $this->postJson($path, $payload, 'freight_ltl_shipments', $customerTransactionId, $locale);
    }
}

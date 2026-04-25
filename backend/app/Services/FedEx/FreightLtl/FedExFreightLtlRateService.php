<?php

namespace App\Services\FedEx\FreightLtl;

/**
 * Proxies FedEx Rate API — Freight LTL rate quotes (POST /rate/v1/freight/rates/quotes).
 *
 * @see FedExFreightLtlApiCatalog::DEFAULT_PATH_RATE_QUOTES
 */
class FedExFreightLtlRateService extends AbstractFedExFreightLtlService
{
    /**
     * @param  array<string, mixed>  $payload  FedEx rate request body
     * @return array<string, mixed>
     */
    public function rateQuotes(array $payload, ?string $customerTransactionId = null, ?string $locale = null): array
    {
        $path = (string) config('fedex.freight_ltl.paths.rate_quotes', FedExFreightLtlApiCatalog::DEFAULT_PATH_RATE_QUOTES);

        return $this->postJson($path, $payload, 'freight_ltl_rate_quotes', $customerTransactionId, $locale);
    }
}

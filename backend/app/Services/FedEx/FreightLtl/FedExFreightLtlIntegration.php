<?php

namespace App\Services\FedEx\FreightLtl;

/**
 * FedEx Freight LTL API readiness (OAuth + freight account).
 */
final class FedExFreightLtlIntegration
{
    public static function isConfigured(): bool
    {
        return filled(config('fedex.client_id'))
            && filled(config('fedex.client_secret'))
            && filled(config('fedex.freight_ltl.account_number'));
    }
}

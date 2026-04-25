<?php

namespace App\Services\FedEx\FreightLtl;

/**
 * Official FedEx Freight LTL API references and default REST paths (v1).
 *
 * Paths match the FedEx Developer Portal Freight LTL catalog; override via config `fedex.freight_ltl.paths.*` if FedEx updates routes.
 *
 * @see https://developer.fedex.com/api/en-us/catalog/ltl-freight/v1/docs.html
 * @see https://developer.fedex.com/api/en-us/catalog/ltl-freight.html
 *
 * OAuth: same client credentials as other FedEx REST APIs; add the Freight LTL API to your FedEx Developer project.
 *
 * Rate Freight LTL uses the Rate API namespace (not /ltl-freight/v1/...).
 * @see https://developer.fedex.com/api/en-us/catalog/rate/v1/docs.html (Freight LTL rate operation)
 */
final class FedExFreightLtlApiCatalog
{
    public const DOCS_V1_URL = 'https://developer.fedex.com/api/en-us/catalog/ltl-freight/v1/docs.html';

    public const CATALOG_OVERVIEW_URL = 'https://developer.fedex.com/api/en-us/catalog/ltl-freight.html';

    /** Default relative paths on {@see config('fedex.base_url')}. */
    public const DEFAULT_PATH_RATE_QUOTES = '/rate/v1/freight/rates/quotes';

    public const DEFAULT_PATH_SHIPMENTS = '/ltl-freight/v1/shipments';

    public const DEFAULT_PATH_PICKUP_AVAILABILITY = '/ltl-freight/v1/freight-ltl-pickups/availabilities';

    public const DEFAULT_PATH_PICKUPS = '/ltl-freight/v1/freight-ltl-pickups';

    /** Cancel scheduled pickup (FedEx docs: PUT with confirmation details in body). */
    public const DEFAULT_PATH_PICKUP_CANCEL = '/ltl-freight/v1/freight-ltl-pickups/cancel';
}

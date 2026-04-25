<?php

use App\Services\FedEx\FreightLtl\FedExFreightLtlApiCatalog;

return [

    /*
    |--------------------------------------------------------------------------
    | FedEx integration mode
    |--------------------------------------------------------------------------
    |
    | stub — local StubFedExClient (no live Ship API; use for tests/offline).
    | rest  — OAuth + Ship + Track against FedEx when client id/secret/account are set.
    |
    */

    'mode' => env('FEDEX_MODE', 'rest'),

    /** Defaults when mapping legacy POST /api/customer|admin/shipments to FedEx Ship shape. */
    'default_service_type' => env('FEDEX_DEFAULT_SERVICE_TYPE', 'FEDEX_GROUND'),

    /**
     * When true (default), POST /rate/v1/rates/quotes runs before Ship validate/create and `serviceType` is chosen
     * from FedEx Rate output (see rate_service_preference). When false, legacy mapper defaults apply (including HI/AK).
     */
    'rate_lookup_enabled' => filter_var(env('FEDEX_RATE_LOOKUP_ENABLED', true), FILTER_VALIDATE_BOOL),

    /**
     * Draft serviceType passed to the domestic sanitizer when rate_lookup_enabled is true; replaced by Rate API before Ship.
     */
    'rate_placeholder_service_type' => env('FEDEX_RATE_PLACEHOLDER_SERVICE_TYPE', 'FEDEX_GROUND'),

    /**
     * Comma-separated preference order when multiple Rate API services apply (e.g. FEDEX_GROUND,FEDEX_2_DAY,FEDEX_EXPRESS_SAVER).
     * Empty = built-in default list.
     */
    'rate_service_preference' => env('FEDEX_RATE_SERVICE_PREFERENCE', ''),

    /** FedEx Rate API version block (POST /rate/v1/rates/quotes). FedEx doc samples often use 1.1.1. */
    'rate_api_version' => [
        'major' => env('FEDEX_RATE_VERSION_MAJOR', '1'),
        'minor' => env('FEDEX_RATE_VERSION_MINOR', '1'),
        'patch' => env('FEDEX_RATE_VERSION_PATCH', '1'),
    ],

    /**
     * Optional JSON string merged into Rate API root as rateRequestControlParameters (parsed in FedExShipApiService).
     * Empty = omit. Example: {"returnTransitTimes":false,"rateSortOrder":"SERVICENAMETRADITIONAL"}
     */
    'rate_request_control_parameters_json' => env('FEDEX_RATE_REQUEST_CONTROL_PARAMETERS', ''),

    /**
     * Optional carrier codes for Rate API root (comma-separated), e.g. FDXE,FDXG. Empty = omit.
     *
     * @var array<int, string>
     */
    'rate_carrier_codes' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'FEDEX_RATE_CARRIER_CODES',
        ''
    ))))),

    /**
     * Root-level processingOptions for Rate API only (not Ship). Comma-separated, e.g. INCLUDE_PICKUPRATES. Empty = omit.
     *
     * @var array<int, string>
     */
    'rate_processing_options' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'FEDEX_RATE_PROCESSING_OPTIONS',
        ''
    ))))),

    /**
     * When true and base_url is FedEx sandbox, skip Rate API and use default_service_type / non_contiguous_origin_service_type.
     * For local sandbox quirks only — never enable in production.
     */
    'sandbox_skip_rate_eligibility' => filter_var(env('FEDEX_SANDBOX_SKIP_RATE_ELIGIBILITY', false), FILTER_VALIDATE_BOOL),

    /**
     * When base_url is FedEx sandbox and Rate API returns an error or empty services, fall back to legacy
     * default_service_type / non_contiguous_origin_service_type instead of failing the shipment.
     * Production (apis.fedex.com) never uses this path. Default true so sandbox HI/AK lanes remain testable.
     */
    'sandbox_fallback_on_rate_failure' => filter_var(env('FEDEX_SANDBOX_RATE_FAILURE_FALLBACK', true), FILTER_VALIDATE_BOOL),

    /**
     * When base_url is sandbox and Ship POST /ship/v1/shipments returns INVALID.INPUT, retry create with these
     * service types (after deduping the rate-selected type) for HI/AK→mainland and contiguous US domestic lanes.
     * Sandbox often rejects FEDEX_GROUND on create; FEDEX_2_DAY is a common fallback. Not used in production.
     *
     * @var array<int, string>
     */
    'sandbox_ship_create_alternate_service_types' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'FEDEX_SANDBOX_SHIP_CREATE_ALTERNATE_SERVICE_TYPES',
        'FEDEX_2_DAY,FEDEX_EXPRESS_SAVER,PRIORITY_OVERNIGHT,STANDARD_OVERNIGHT,FIRST_OVERNIGHT'
    ))))),

    /**
     * Enable sandbox Ship create retries using sandbox_ship_create_alternate_service_types when INVALID.INPUT on create.
     */
    'sandbox_retry_ship_create_on_invalid_input' => filter_var(env('FEDEX_SANDBOX_RETRY_SHIP_CREATE_ON_INVALID_INPUT', true), FILTER_VALIDATE_BOOL),

    /**
     * After exhausting alternate service types with the original pickupType, sandbox HI/AK→mainland Ship retries
     * use these pickup types (e.g. USE_SCHEDULED_PICKUP when DROPOFF_AT_FEDEX_LOCATION fails). Comma-separated.
     * Empty = no pickup alternates (only one pickup wave). Not used against production hosts.
     *
     * @var array<int, string>
     */
    'sandbox_ship_create_alternate_pickup_types' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'FEDEX_SANDBOX_SHIP_CREATE_ALTERNATE_PICKUP_TYPES',
        'USE_SCHEDULED_PICKUP'
    ))))),

    /**
     * Legacy mapper: when shipper origin is US-HI or US-AK, FedEx Ground is often invalid; use this service instead.
     * If Ship validate/create returns INVALID.INPUT for HI/AK lanes, try another express service your account supports
     * (e.g. FEDEX_2_DAY, PRIORITY_OVERNIGHT) per FedEx docs and sandbox behavior.
     */
    'non_contiguous_origin_service_type' => env('FEDEX_NON_CONTIGUOUS_ORIGIN_SERVICE_TYPE', 'FEDEX_EXPRESS_SAVER'),

    /**
     * Legacy mapper: HI/AK origins often reject USE_SCHEDULED_PICKUP in sandbox (no pickup account); drop-off is safer.
     * FedEx Ship pickupType enum (e.g. DROPOFF_AT_FEDEX_LOCATION, USE_SCHEDULED_PICKUP, CONTACT_FEDEX_TO_SCHEDULE).
     */
    'non_contiguous_origin_pickup_type' => env('FEDEX_NON_CONTIGUOUS_ORIGIN_PICKUP_TYPE', 'DROPOFF_AT_FEDEX_LOCATION'),

    /**
     * When true, FedExShipmentCreateService skips POST /ship/v1/shipments/packages/validate and calls Ship create only.
     * Same requestedShipment is used; you lose preflight alerts from validate. Use for local debugging only — not production.
     */
    'skip_ship_validate' => filter_var(env('FEDEX_SKIP_SHIP_VALIDATE', false), FILTER_VALIDATE_BOOL),

    'default_packaging_type' => env('FEDEX_DEFAULT_PACKAGING_TYPE', 'YOUR_PACKAGING'),

    'default_pickup_type' => env('FEDEX_DEFAULT_PICKUP_TYPE', 'USE_SCHEDULED_PICKUP'),

    'default_is_residential' => filter_var(env('FEDEX_DEFAULT_IS_RESIDENTIAL', false), FILTER_VALIDATE_BOOL),

    /*
    | When FEDEX_ENV=production and no FEDEX_API_URL is set, defaults to production FedEx host.
    | Explicit FEDEX_API_URL / FEDEX_BASE_URL always win.
    */
    'environment' => env('FEDEX_ENV', 'sandbox'),

    /** Same as `environment` — FEDEX_ENV value (e.g. sandbox|production) for `config('fedex.env')` checks. */
    'env' => env('FEDEX_ENV', 'sandbox'),

    'base_url' => rtrim((string) env(
        'FEDEX_API_URL',
        env(
            'FEDEX_BASE_URL',
            env('FEDEX_ENV', 'sandbox') === 'production'
                ? 'https://apis.fedex.com'
                : 'https://apis-sandbox.fedex.com'
        )
    ), '/'),

    'account_number' => env('FEDEX_ACCOUNT_NUMBER'),

    /**
     * Cities/states/zip in FedEx’s JSON API Collection virtualized Ship sample (documentation only; exact ship body is built in \App\Services\FedEx\FedExShipApiService::createShipmentSandboxVirtualized()).
     *
     * @var array{shipper: array{city: string, state: string, zip: string}, recipient: array{city: string, state: string, zip: string}}
     */
    'sandbox_sample_addresses' => [
        'shipper' => [
            'city' => 'Harrison',
            'state' => 'AR',
            'zip' => '72601',
        ],
        'recipient' => [
            'city' => 'Collierville',
            'state' => 'TN',
            'zip' => '38017',
        ],
    ],

    /**
     * When true and base_url is FedEx sandbox, skip POST /address/v1/addresses/resolve during ship create
     * (avoids VIRTUAL.RESPONSE when payloads do not match JSON API samples). Never use in production.
     */
    'skip_address_validation_in_sandbox' => filter_var(env('FEDEX_SKIP_ADDRESS_VALIDATION_IN_SANDBOX', false), FILTER_VALIDATE_BOOL),

    /**
     * Optional Y-m-d for Address Validation API `inEffectAsOfTimestamp` during ship create and tag flows.
     * Empty = current date in AddressValidationService. Use for sandbox tests that require a fixed reference date.
     */
    'address_validation_in_effect_as_of' => ($__fedexInEffect = trim((string) env('FEDEX_ADDRESS_VALIDATION_IN_EFFECT_AS_OF', ''))) !== ''
        ? $__fedexInEffect
        : null,

    /** URL_ONLY | LABEL (base64 / async depending on FedEx response) */
    'ship_label_response' => env('FEDEX_SHIP_LABEL_RESPONSE', 'URL_ONLY'),

    /**
     * FedEx Ship create: SYNCHRONOUS_ONLY | ALLOW_ASYNCHRONOUS (matches Ship API docs).
     * Sandbox/production both use POST /ship/v1/shipments on the host from base_url.
     */
    'processing_option_type' => env('FEDEX_PROCESSING_OPTION_TYPE', 'ALLOW_ASYNCHRONOUS'),

    /**
     * Optional root-level flags on create (e.g. INCLUDE_PICKUPRATES). Empty = omit.
     * Default empty: INCLUDE_PICKUPRATES often triggers INVALID.INPUT in sandbox for domestic Ship.
     *
     * @var array<int, string>
     */
    'processing_options' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'FEDEX_PROCESSING_OPTIONS',
        ''
    ))))),

    'one_label_at_a_time' => filter_var(env('FEDEX_ONE_LABEL_AT_A_TIME', true), FILTER_VALIDATE_BOOL),

    /**
     * When labelResponseOptions is URL_ONLY, controls merged PDF in the response.
     * NONE | LABELS_AND_DOCS | LABELS_ONLY
     *
     * Default LABELS_ONLY: avoids FedEx’s letter-sized PDF that merges shipping art with horizontal folding
     * instructions (the shipping block often appears rotated 90° in viewers). Set LABELS_AND_DOCS if you need
     * those instruction pages.
     */
    'merge_label_doc_option' => env('FEDEX_MERGE_LABEL_DOC_OPTION', 'LABELS_ONLY'),

    /**
     * FedEx Ship requestedShipment.labelSpecification.labelStockType (e.g. PAPER_4X6).
     * PAPER_85X11_TOP_HALF_LABEL / PAPER_85X11_BOTTOM_HALF_LABEL merge letter-sized instructions; some FedEx PDFs
     * then show the shipping label art rotated relative to the page. Prefer PAPER_4X6 for normal viewing/printing.
     */
    'label_stock_type' => env('FEDEX_LABEL_STOCK_TYPE', 'PAPER_4X6'),

    /**
     * Optional FedEx labelPrintingOrientation (e.g. TOP_EDGE_OF_TEXT_FIRST, BOTTOM_EDGE_OF_TEXT_FIRST,
     * LEFT_EDGE_OF_TEXT_FIRST). Omitted unless set — some REST responses ignore or vary this field.
     */
    'label_printing_orientation' => ($__fedexLabelOrient = trim((string) env('FEDEX_LABEL_PRINTING_ORIENTATION', ''))) !== ''
        ? $__fedexLabelOrient
        : null,

    /** API version block sent with Ship v1 requests (FedEx schema). */
    'ship_api_version' => [
        'major' => env('FEDEX_SHIP_VERSION_MAJOR', '1'),
        'minor' => env('FEDEX_SHIP_VERSION_MINOR', '1'),
        'patch' => env('FEDEX_SHIP_VERSION_PATCH', '0'),
    ],

    'client_id' => env('FEDEX_CLIENT_ID'),

    'client_secret' => env('FEDEX_CLIENT_SECRET'),

    /**
     * OAuth POST /oauth/token body: client_credentials | csp_credentials | client_pc_credentials
     * (FedEx API Authorization docs).
     */
    'oauth_grant_type' => in_array((string) env('FEDEX_OAUTH_GRANT_TYPE', 'client_credentials'), [
        'client_credentials',
        'csp_credentials',
        'client_pc_credentials',
    ], true) ? (string) env('FEDEX_OAUTH_GRANT_TYPE', 'client_credentials') : 'client_credentials',

    /** Optional: for Integrator / Compatible / Parent-Child flows (child_Key / child_secret in FedEx docs). */
    'oauth_child_key' => env('FEDEX_CHILD_KEY'),

    'oauth_child_secret' => env('FEDEX_CHILD_SECRET'),

    'http_timeout' => (int) env('FEDEX_HTTP_TIMEOUT', 30),

    /**
     * TLS verification for Guzzle (cURL error 60: set FEDEX_CAINFO_PATH to cacert.pem,
     * or on trusted dev only FEDEX_HTTP_VERIFY_SSL=false).
     */
    'http_verify_ssl' => filter_var(env('FEDEX_HTTP_VERIFY_SSL', true), FILTER_VALIDATE_BOOL),

    /** Absolute path to PEM bundle (e.g. https://curl.se/ca/cacert.pem) when verify fails on Windows. */
    'http_ca_path' => env('FEDEX_CAINFO_PATH'),

    'token_cache_seconds' => (int) env('FEDEX_TOKEN_CACHE_SECONDS', 3500),

    /**
     * FedEx Tracking Webhook (Advanced Integrated Visibility): POST destination URL.
     * FEDEX_WEBHOOK_SECRET must match the Security Token in FDP for this URL (HMAC-SHA256, header x-fedex-signature).
     * Empty secret: endpoint returns 503.
     */
    'webhook_enabled' => filter_var(env('FEDEX_WEBHOOK_ENABLED', true), FILTER_VALIDATE_BOOL),

    'webhook_secret' => env('FEDEX_WEBHOOK_SECRET'),

    /**
     * Optional: allow only FedEx push IPs (comma-separated). Empty = no IP filter (typical for local dev).
     * FedEx docs list Dev/Beta and Prod IPs for whitelisting.
     *
     * @var array<int, string>
     */
    'webhook_allowed_ips' => array_values(array_filter(array_map('trim', explode(',', (string) env(
        'FEDEX_WEBHOOK_ALLOWED_IPS',
        ''
    ))))),

    /**
     * FedEx Freight LTL (less-than-truckload). Same OAuth client as parcel; add Freight LTL API to your FedEx Developer project.
     * Requires FEDEX_FREIGHT_ACCOUNT_NUMBER (separate from parcel FEDEX_ACCOUNT_NUMBER when using Freight).
     *
     * @see FedExFreightLtlApiCatalog
     */
    'freight_ltl' => [
        'account_number' => env('FEDEX_FREIGHT_ACCOUNT_NUMBER'),
        'rate_enabled' => filter_var(env('FEDEX_FREIGHT_LTL_RATE_ENABLED', true), FILTER_VALIDATE_BOOL),
        'ship_enabled' => filter_var(env('FEDEX_FREIGHT_LTL_SHIP_ENABLED', true), FILTER_VALIDATE_BOOL),
        'pickup_enabled' => filter_var(env('FEDEX_FREIGHT_LTL_PICKUP_ENABLED', true), FILTER_VALIDATE_BOOL),
        'direct_enabled' => filter_var(env('FEDEX_FREIGHT_LTL_DIRECT_ENABLED', false), FILTER_VALIDATE_BOOL),
        'paths' => [
            'rate_quotes' => env('FEDEX_FREIGHT_LTL_PATH_RATE_QUOTES', '/rate/v1/freight/rates/quotes'),
            'shipments' => env('FEDEX_FREIGHT_LTL_PATH_SHIPMENTS', '/ltl-freight/v1/shipments'),
            'pickup_availability' => env(
                'FEDEX_FREIGHT_LTL_PATH_PICKUP_AVAILABILITY',
                '/ltl-freight/v1/freight-ltl-pickups/availabilities',
            ),
            'pickups' => env('FEDEX_FREIGHT_LTL_PATH_PICKUPS', '/ltl-freight/v1/freight-ltl-pickups'),
            'pickup_cancel' => env('FEDEX_FREIGHT_LTL_PATH_PICKUP_CANCEL', '/ltl-freight/v1/freight-ltl-pickups/cancel'),
        ],
    ],
];

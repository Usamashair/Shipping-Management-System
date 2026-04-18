<?php

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

    'default_packaging_type' => env('FEDEX_DEFAULT_PACKAGING_TYPE', 'YOUR_PACKAGING'),

    'default_pickup_type' => env('FEDEX_DEFAULT_PICKUP_TYPE', 'USE_SCHEDULED_PICKUP'),

    'default_is_residential' => filter_var(env('FEDEX_DEFAULT_IS_RESIDENTIAL', false), FILTER_VALIDATE_BOOL),

    /*
    | When FEDEX_ENV=production and no FEDEX_API_URL is set, defaults to production FedEx host.
    | Explicit FEDEX_API_URL / FEDEX_BASE_URL always win.
    */
    'environment' => env('FEDEX_ENV', 'sandbox'),

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

    /** URL_ONLY | LABEL (base64 / async depending on FedEx response) */
    'ship_label_response' => env('FEDEX_SHIP_LABEL_RESPONSE', 'URL_ONLY'),

    /**
     * When labelResponseOptions is URL_ONLY, controls merged PDF in the response.
     * NONE | LABELS_AND_DOCS | LABELS_ONLY
     */
    'merge_label_doc_option' => env('FEDEX_MERGE_LABEL_DOC_OPTION', 'LABELS_AND_DOCS'),

    /** API version block sent with Ship v1 requests (FedEx schema). */
    'ship_api_version' => [
        'major' => env('FEDEX_SHIP_VERSION_MAJOR', '1'),
        'minor' => env('FEDEX_SHIP_VERSION_MINOR', '1'),
        'patch' => env('FEDEX_SHIP_VERSION_PATCH', '0'),
    ],

    'client_id' => env('FEDEX_CLIENT_ID'),

    'client_secret' => env('FEDEX_CLIENT_SECRET'),

    'http_timeout' => (int) env('FEDEX_HTTP_TIMEOUT', 30),

    'token_cache_seconds' => (int) env('FEDEX_TOKEN_CACHE_SECONDS', 3500),
];

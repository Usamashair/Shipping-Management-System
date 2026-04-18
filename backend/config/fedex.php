<?php

return [

    /*
    |--------------------------------------------------------------------------
    | FedEx integration mode
    |--------------------------------------------------------------------------
    |
    | stub — local StubFedExClient (default).
    | rest  — OAuth + Track API against FedEx; labels still use the stub
    |         ship path until a live Ship transaction is wired separately.
    |
    */

    'mode' => env('FEDEX_MODE', 'stub'),

    'base_url' => rtrim((string) env('FEDEX_BASE_URL', 'https://apis.fedex.com'), '/'),

    'client_id' => env('FEDEX_CLIENT_ID'),

    'client_secret' => env('FEDEX_CLIENT_SECRET'),

    'http_timeout' => (int) env('FEDEX_HTTP_TIMEOUT', 30),

    'token_cache_seconds' => (int) env('FEDEX_TOKEN_CACHE_SECONDS', 3300),
];

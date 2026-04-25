<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExLocationSearchTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
        ]);
    }

    public function test_search_returns_502_when_fedex_not_configured(): void
    {
        config(['fedex.account_number' => '']);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/locations/search', [
            'location' => [
                'address' => [
                    'streetLines' => ['10 FedEx Parkway'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38125',
                    'countryCode' => 'US',
                ],
            ],
        ])->assertStatus(502)
            ->assertJsonPath('message', 'FedEx is not configured.');
    }

    public function test_search_returns_422_when_location_missing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/locations/search', [
            'locationSearchCriterion' => 'ADDRESS',
        ])->assertStatus(422);
    }

    public function test_search_returns_fedex_json_on_success(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-loc',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/location/v1/locations' => Http::response([
                'transactionId' => 'txn-loc-1',
                'customerTransactionId' => 'cust-1',
                'output' => [
                    'totalResults' => 1,
                    'resultsReturned' => 1,
                    'locationDetailList' => [],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $payload = [
            'locationsSummaryRequestControlParameters' => [
                'distance' => ['units' => 'MI', 'value' => 10],
                'maxResults' => 5,
            ],
            'locationSearchCriterion' => 'ADDRESS',
            'location' => [
                'address' => [
                    'streetLines' => ['10 FedEx Parkway'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38125',
                    'countryCode' => 'US',
                ],
            ],
        ];

        $this->postJson('/api/fedex/locations/search', $payload)
            ->assertOk()
            ->assertJsonPath('transactionId', 'txn-loc-1')
            ->assertJsonPath('output.totalResults', 1);
    }

    public function test_search_returns_fedex_errors_on_http_400(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-loc',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/location/v1/locations' => Http::response([
                'transactionId' => 'txn-err',
                'errors' => [
                    [
                        'code' => 'ERROR.LONGLAT.REQUIRED',
                        'message' => 'Longitude and Latitude are required.',
                    ],
                ],
            ], 400),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/locations/search', [
            'locationSearchCriterion' => 'ADDRESS',
            'location' => [
                'address' => [
                    'streetLines' => ['10 FedEx Parkway'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38125',
                    'countryCode' => 'US',
                ],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'ERROR.LONGLAT.REQUIRED')
            ->assertJsonPath('message', 'Longitude and Latitude are required.');
    }

    public function test_search_maps_catalog_message_when_fedex_error_message_empty(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-loc',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/location/v1/locations' => Http::response([
                'transactionId' => 'txn-err-2',
                'errors' => [
                    [
                        'code' => 'ERROR.LONGLAT.REQUIRED',
                        'message' => '',
                    ],
                ],
            ], 400),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/locations/search', [
            'locationSearchCriterion' => 'ADDRESS',
            'location' => [
                'address' => [
                    'streetLines' => ['10 FedEx Parkway'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38125',
                    'countryCode' => 'US',
                ],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'ERROR.LONGLAT.REQUIRED')
            ->assertJsonPath('fedex_errors.0.message', 'Longitude and Latitude are required.')
            ->assertJsonPath('message', 'Longitude and Latitude are required.');
    }

    public function test_search_unknown_code_without_message_uses_generic_prefix(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-loc',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/location/v1/locations' => Http::response([
                'transactionId' => 'txn-err-3',
                'errors' => [
                    [
                        'code' => 'UNKNOWN.FUTURE.CODE',
                        'message' => '',
                    ],
                ],
            ], 400),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/locations/search', [
            'locationSearchCriterion' => 'ADDRESS',
            'location' => [
                'address' => [
                    'streetLines' => ['10 FedEx Parkway'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38125',
                    'countryCode' => 'US',
                ],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.message', 'FedEx error: UNKNOWN.FUTURE.CODE')
            ->assertJsonPath('message', 'FedEx error: UNKNOWN.FUTURE.CODE');
    }
}

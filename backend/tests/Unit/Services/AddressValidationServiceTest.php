<?php

namespace Tests\Unit\Services;

use App\Services\FedEx\AddressValidationService;
use App\Services\FedEx\FedExOAuthToken;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AddressValidationServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        config([
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
            'fedex.client_id' => 'test-client-id',
            'fedex.client_secret' => 'test-client-secret',
            'fedex.http_timeout' => 15,
        ]);
    }

    public function test_validate_addresses_marks_is_valid_true_when_fedex_returns_standardized_address_state(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'unit-test-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/address/v1/addresses/resolve' => Http::response([
                'output' => [
                    'resolvedAddresses' => [
                        [
                            'addressState' => 'Standardized',
                            'deliveryPointValidationRollup' => 'CONFIRMED',
                            'address' => [
                                'streetLines' => ['123 Main St'],
                                'city' => 'Memphis',
                                'stateOrProvinceCode' => 'TN',
                                'postalCode' => '38116',
                                'countryCode' => 'US',
                            ],
                        ],
                    ],
                    'alerts' => [],
                ],
            ], 200),
        ]);

        $service = new AddressValidationService(new FedExOAuthToken);

        $result = $service->validateAddresses([
            [
                'streetLines' => ['123 Main St'],
                'city' => 'Memphis',
                'stateOrProvinceCode' => 'TN',
                'postalCode' => '38116',
                'countryCode' => 'US',
            ],
        ]);

        $this->assertArrayHasKey('results', $result);
        $this->assertCount(1, $result['results']);
        $this->assertTrue($result['results'][0]['isValid'], 'isValid must be true when addressState is Standardized and deliveryPointValidationRollup is CONFIRMED.');
        $this->assertSame('US', $result['results'][0]['resolvedAddress']['countryCode'] ?? null);
    }

    public function test_validate_addresses_marks_is_valid_false_when_address_state_is_standardized_but_rollups_not_confirmed(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'unit-test-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/address/v1/addresses/resolve' => Http::response([
                'output' => [
                    'resolvedAddresses' => [
                        [
                            'addressState' => 'Standardized',
                            'deliveryPointValidationRollup' => 'UNCONFIRMED',
                            'address' => [
                                'streetLines' => ['456 Oak Ave'],
                                'countryCode' => 'US',
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new AddressValidationService(new FedExOAuthToken);

        $result = $service->validateAddresses([
            ['streetLines' => ['456 Oak Ave'], 'countryCode' => 'US'],
        ]);

        $this->assertFalse($result['results'][0]['isValid']);
    }
}

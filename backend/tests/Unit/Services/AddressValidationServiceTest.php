<?php

namespace Tests\Unit\Services;

use App\Services\FedEx\AddressValidationService;
use App\Services\FedEx\FedExOAuthToken;
use Illuminate\Http\Client\Request;
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

    public function test_validate_addresses_includes_client_reference_id_in_payload_when_provided(): void
    {
        Http::fake(function (Request $request) {
            if (str_contains($request->url(), '/oauth/token')) {
                return Http::response([
                    'access_token' => 'unit-test-token',
                    'token_type' => 'bearer',
                    'expires_in' => 3600,
                ], 200);
            }

            $data = json_decode($request->body(), true);
            $this->assertIsArray($data);
            $this->assertSame('CORR-999', $data['addressesToValidate'][0]['clientReferenceId'] ?? null);

            return Http::response([
                'output' => [
                    'resolvedAddresses' => [
                        [
                            'addressState' => 'Standardized',
                            'deliveryPointValidationRollup' => 'CONFIRMED',
                            'address' => [
                                'streetLines' => ['123 Main St'],
                                'countryCode' => 'US',
                            ],
                        ],
                    ],
                ],
            ], 200);
        });

        $service = new AddressValidationService(new FedExOAuthToken);

        $result = $service->validateAddresses([
            [
                'streetLines' => ['123 Main St'],
                'countryCode' => 'US',
                'clientReferenceId' => 'CORR-999',
            ],
        ]);

        $this->assertTrue($result['results'][0]['isValid']);
    }

    public function test_validate_addresses_second_argument_sets_in_effect_as_of_timestamp(): void
    {
        Http::fake(function (Request $request) {
            if (str_contains($request->url(), '/oauth/token')) {
                return Http::response([
                    'access_token' => 'unit-test-token',
                    'token_type' => 'bearer',
                    'expires_in' => 3600,
                ], 200);
            }

            $data = json_decode($request->body(), true);
            $this->assertIsArray($data);
            $this->assertSame('2019-09-06', $data['inEffectAsOfTimestamp'] ?? null);

            return Http::response([
                'output' => [
                    'resolvedAddresses' => [
                        [
                            'addressState' => 'Standardized',
                            'deliveryPointValidationRollup' => 'CONFIRMED',
                            'address' => [
                                'streetLines' => ['7372 PARKRIDGE BLVD'],
                                'countryCode' => 'US',
                            ],
                        ],
                    ],
                ],
            ], 200);
        });

        $service = new AddressValidationService(new FedExOAuthToken);

        $result = $service->validateAddresses([
            ['streetLines' => ['7372 PARKRIDGE BLVD'], 'countryCode' => 'US'],
        ], '2019-09-06');

        $this->assertTrue($result['results'][0]['isValid']);
    }
}

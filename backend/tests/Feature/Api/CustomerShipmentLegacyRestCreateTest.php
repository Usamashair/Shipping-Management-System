<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerShipmentLegacyRestCreateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'fedex.mode' => 'rest',
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
        ]);
    }

    public function test_post_customer_shipments_calls_fedex_ship_and_persists_tracking(): void
    {
        Http::fake(function (Request $request) {
            $url = $request->url();
            if (str_contains($url, '/oauth/token')) {
                return Http::response([
                    'access_token' => 't',
                    'token_type' => 'bearer',
                    'expires_in' => 3600,
                ], 200);
            }
            if (str_contains($url, '/rate/v1/rates/quotes')) {
                return Http::response([
                    'output' => [
                        'rateReplyDetails' => [
                            ['serviceType' => 'FEDEX_GROUND'],
                        ],
                    ],
                    'transactionId' => 'rate-mock-tx',
                ], 200);
            }
            if (str_contains($url, '/address/v1/addresses/resolve')) {
                return Http::response([
                    'output' => [
                        'resolvedAddresses' => [
                            [
                                'addressState' => 'Standardized',
                                'deliveryPointValidationRollup' => 'CONFIRMED',
                                'address' => [
                                    'streetLines' => ['100 Receiver St'],
                                    'city' => 'Nashville',
                                    'stateOrProvinceCode' => 'TN',
                                    'postalCode' => '37203',
                                    'countryCode' => 'US',
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }
            if (str_contains($url, '/ship/v1/shipments/packages/validate')) {
                return Http::response(['output' => ['alerts' => []]], 200);
            }
            if ($request->method() === 'POST' && preg_match('#/ship/v1/shipments$#', $url)) {
                return Http::response([
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => 'FX-LEGACY-REST-1',
                                'serviceType' => 'FEDEX_GROUND',
                                'shipTimestamp' => now()->toIso8601String(),
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-LEGACY-REST-1',
                                        'packageDocuments' => [
                                            [
                                                'url' => 'https://example.com/label.pdf',
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['code' => 'UNEXPECTED', 'message' => $url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/customer/shipments', [
            'sender_details' => [
                'name' => 'Shipper',
                'street1' => '2000 Freight Rd',
                'city' => 'Memphis',
                'state' => 'TN',
                'postalCode' => '38116',
                'country' => 'US',
                'phone' => '9015551212',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '100 Receiver St',
                'city' => 'Nashville',
                'state' => 'TN',
                'postalCode' => '37203',
                'country' => 'US',
                'phone' => '9015553434',
            ],
            'package_details' => [
                'weightLb' => 2.5,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Books',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-LEGACY-REST-1');

        $this->assertDatabaseHas('shipments', [
            'user_id' => $user->id,
            'tracking_number' => 'FX-LEGACY-REST-1',
            'service_type' => 'FEDEX_GROUND',
        ]);
    }

    public function test_skip_address_validation_sandbox_does_not_call_address_resolve(): void
    {
        config(['fedex.skip_address_validation_in_sandbox' => true]);

        Http::fake(function (Request $request) {
            $url = $request->url();
            if (str_contains($url, '/oauth/token')) {
                return Http::response([
                    'access_token' => 't',
                    'token_type' => 'bearer',
                    'expires_in' => 3600,
                ], 200);
            }
            if (str_contains($url, '/rate/v1/rates/quotes')) {
                return Http::response([
                    'output' => [
                        'rateReplyDetails' => [
                            ['serviceType' => 'FEDEX_GROUND'],
                        ],
                    ],
                    'transactionId' => 'rate-mock-tx',
                ], 200);
            }
            if (str_contains($url, '/address/v1/addresses/resolve')) {
                return Http::response(['errors' => [['code' => 'SHOULD_NOT_CALL', 'message' => 'address resolve should be skipped']]], 500);
            }
            if (str_contains($url, '/ship/v1/shipments/packages/validate')) {
                return Http::response(['output' => ['alerts' => []]], 200);
            }
            if ($request->method() === 'POST' && preg_match('#/ship/v1/shipments$#', $url)) {
                return Http::response([
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => 'FX-SKIP-ADDR-1',
                                'serviceType' => 'FEDEX_GROUND',
                                'shipTimestamp' => now()->toIso8601String(),
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-SKIP-ADDR-1',
                                        'packageDocuments' => [
                                            ['url' => 'https://example.com/label.pdf'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['message' => 'unexpected '.$url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/customer/shipments', [
            'sender_details' => [
                'name' => 'Shipper',
                'street1' => '2000 Freight Rd',
                'city' => 'Memphis',
                'state' => 'TN',
                'postalCode' => '38116',
                'country' => 'US',
                'phone' => '9015551212',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '100 Receiver St',
                'city' => 'Nashville',
                'state' => 'TN',
                'postalCode' => '37203',
                'country' => 'US',
                'phone' => '9015553434',
            ],
            'package_details' => [
                'weightLb' => 2.5,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Books',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-SKIP-ADDR-1');
    }

    public function test_skip_ship_validate_does_not_call_packages_validate(): void
    {
        config([
            'fedex.skip_ship_validate' => true,
        ]);

        Http::fake(function (Request $request) {
            $url = $request->url();
            if (str_contains($url, '/oauth/token')) {
                return Http::response([
                    'access_token' => 't',
                    'token_type' => 'bearer',
                    'expires_in' => 3600,
                ], 200);
            }
            if (str_contains($url, '/rate/v1/rates/quotes')) {
                return Http::response([
                    'output' => [
                        'rateReplyDetails' => [
                            ['serviceType' => 'FEDEX_GROUND'],
                        ],
                    ],
                    'transactionId' => 'rate-mock-tx',
                ], 200);
            }
            if (str_contains($url, '/ship/v1/shipments/packages/validate')) {
                return Http::response(['errors' => [['code' => 'SHOULD_NOT_CALL_VALIDATE', 'message' => 'validate was not skipped']]], 500);
            }
            if (str_contains($url, '/address/v1/addresses/resolve')) {
                return Http::response([
                    'output' => [
                        'resolvedAddresses' => [
                            [
                                'addressState' => 'Standardized',
                                'deliveryPointValidationRollup' => 'CONFIRMED',
                                'address' => [
                                    'streetLines' => ['100 Receiver St'],
                                    'city' => 'Nashville',
                                    'stateOrProvinceCode' => 'TN',
                                    'postalCode' => '37203',
                                    'countryCode' => 'US',
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }
            if ($request->method() === 'POST' && preg_match('#/ship/v1/shipments$#', $url)) {
                return Http::response([
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => 'FX-SKIP-VAL-1',
                                'serviceType' => 'FEDEX_GROUND',
                                'shipTimestamp' => now()->toIso8601String(),
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-SKIP-VAL-1',
                                        'packageDocuments' => [
                                            ['url' => 'https://example.com/label.pdf'],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['code' => 'UNEXPECTED', 'message' => $url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/customer/shipments', [
            'sender_details' => [
                'name' => 'Shipper',
                'street1' => '2000 Freight Rd',
                'city' => 'Memphis',
                'state' => 'TN',
                'postalCode' => '38116',
                'country' => 'US',
                'phone' => '9015551212',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '100 Receiver St',
                'city' => 'Nashville',
                'state' => 'TN',
                'postalCode' => '37203',
                'country' => 'US',
                'phone' => '9015553434',
            ],
            'package_details' => [
                'weightLb' => 2.5,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Books',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-SKIP-VAL-1');
    }
}

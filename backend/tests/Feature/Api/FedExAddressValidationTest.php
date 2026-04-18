<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExAddressValidationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
        ]);
    }

    public function test_validate_address_returns_results_when_fedex_succeeds(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'fake-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/address/v1/addresses/resolve' => Http::response([
                'transactionId' => 'fedex-txn-addr-1',
                'customerTransactionId' => 'cust-txn-addr-1',
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

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/validate-address', [
            'addresses' => [
                [
                    'streetLines' => ['123 Main St'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38116',
                    'countryCode' => 'US',
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('results.0.isValid', true)
            ->assertJsonPath('results.0.resolvedAddress.countryCode', 'US')
            ->assertJsonPath('fedex_transaction_id', 'fedex-txn-addr-1')
            ->assertJsonPath('fedex_customer_transaction_id', 'cust-txn-addr-1');
    }

    public function test_validate_address_outbound_payload_matches_fedex_doc_shape(): void
    {
        Http::fake(function (Request $request) {
            $url = $request->url();
            if (str_contains($url, '/oauth/token')) {
                return Http::response([
                    'access_token' => 'fake-token',
                    'token_type' => 'bearer',
                    'expires_in' => 3600,
                ], 200);
            }
            if (str_contains($url, '/address/v1/addresses/resolve')) {
                $data = $request->data();
                $this->assertArrayHasKey('inEffectAsOfTimestamp', $data);
                $this->assertSame('2019-09-06', $data['inEffectAsOfTimestamp']);
                $this->assertTrue($data['validateAddressControlParameters']['includeResolutionTokens'] ?? false);
                $this->assertIsArray($data['addressesToValidate'][0]['address']['streetLines'] ?? null);
                $this->assertSame('US', $data['addressesToValidate'][0]['address']['countryCode'] ?? null);

                return Http::response([
                    'output' => [
                        'resolvedAddresses' => [
                            [
                                'addressState' => 'Standardized',
                                'deliveryPointValidationRollup' => 'CONFIRMED',
                                'address' => [
                                    'streetLines' => ['1 Test'],
                                    'countryCode' => 'US',
                                ],
                            ],
                        ],
                        'alerts' => [],
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['code' => 'X', 'message' => $url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/validate-address', [
            'in_effect_as_of_timestamp' => '2019-09-06',
            'addresses' => [
                [
                    'streetLines' => ['1 Test'],
                    'countryCode' => 'US',
                ],
            ],
        ])->assertOk();
    }

    public function test_validate_address_returns_502_when_fedex_returns_error_status(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'fake-token',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/address/v1/addresses/resolve' => Http::response([
                'errors' => [['code' => 'SYSTEM.ERROR', 'message' => 'Down']],
            ], 500),
        ]);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/validate-address', [
            'addresses' => [
                [
                    'streetLines' => ['x'],
                    'countryCode' => 'US',
                ],
            ],
        ]);

        $response->assertStatus(502)
            ->assertJsonStructure(['message']);
    }

    public function test_validate_address_returns_502_when_credentials_missing(): void
    {
        config(['fedex.client_id' => '', 'fedex.client_secret' => '']);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/validate-address', [
            'addresses' => [
                [
                    'streetLines' => ['1'],
                    'countryCode' => 'US',
                ],
            ],
        ]);

        $response->assertStatus(502);
    }

    public function test_validate_address_requires_authentication(): void
    {
        $response = $this->postJson('/api/fedex/validate-address', [
            'addresses' => [
                [
                    'streetLines' => ['1'],
                    'countryCode' => 'US',
                ],
            ],
        ]);

        $response->assertStatus(401);
    }
}

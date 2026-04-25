<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Encodes "Test A / Test B / …" from the FedEx sandbox verification playbook (mocked HTTP).
 * Proves mainland Ground, mainland Ground→2Day retry, and HI→AZ express mapping; live FedEx sandbox may still 422 on some lanes.
 */
class FedExSandboxVerificationShipmentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'fedex.mode' => 'rest',
            'fedex.env' => 'sandbox',
            'fedex.environment' => 'sandbox',
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
            'fedex.default_service_type' => 'FEDEX_GROUND',
            'fedex.non_contiguous_origin_service_type' => 'FEDEX_EXPRESS_SAVER',
            'fedex.skip_ship_validate' => false,
            'fedex.processing_options' => [],
        ]);
    }

    /**
     * Test A: mainland TN → GA with FEDEX_GROUND (control — proves OAuth → address → validate → create path).
     */
    public function test_a_mainland_tn_to_ga_ground_succeeds_with_mocked_fedex(): void
    {
        $this->fakeFedExShipSuccess('FX-TEST-A-GROUND', ['FEDEX_GROUND']);

        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/shipments', [
            'user_id' => $customer->id,
            'sender_details' => [
                'name' => 'Sender',
                'street1' => '2000 Freight Rd',
                'city' => 'Memphis',
                'state' => 'TN',
                'postalCode' => '38116',
                'country' => 'US',
                'phone' => '9015551212',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '100 Peachtree St',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postalCode' => '30303',
                'country' => 'US',
                'phone' => '4045550100',
            ],
            'package_details' => [
                'weightLb' => 5,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Test A mainland',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-TEST-A-GROUND')
            ->assertJsonPath('data.service_type', 'FEDEX_GROUND');
    }

    /**
     * Mainland TN → GA: first Ship create INVALID.INPUT on Ground; second succeeds with FEDEX_2_DAY (sandbox Ground quirk).
     */
    public function test_d_mainland_tn_to_ga_retries_ship_create_after_invalid_input_on_ground(): void
    {
        config([
            'fedex.env' => 'production',
            'fedex.environment' => 'production',
            'fedex.sandbox_ship_create_alternate_service_types' => ['FEDEX_2_DAY'],
            'fedex.sandbox_ship_create_alternate_pickup_types' => [],
            'fedex.sandbox_retry_ship_create_on_invalid_input' => true,
        ]);

        $this->fakeFedExShipSuccess(
            'FX-MAINLAND-RETRY-OK',
            ['FEDEX_GROUND'],
            'FEDEX_GROUND',
            true,
            'FEDEX_2_DAY',
        );

        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/shipments', [
            'user_id' => $customer->id,
            'sender_details' => [
                'name' => 'Sender',
                'street1' => '2000 Freight Rd',
                'city' => 'Memphis',
                'state' => 'TN',
                'postalCode' => '38116',
                'country' => 'US',
                'phone' => '9015551212',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '100 Peachtree St',
                'city' => 'Atlanta',
                'state' => 'GA',
                'postalCode' => '30303',
                'country' => 'US',
                'phone' => '4045550100',
            ],
            'package_details' => [
                'weightLb' => 5,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Test D mainland retry',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-MAINLAND-RETRY-OK')
            ->assertJsonPath('data.service_type', 'FEDEX_2_DAY');
    }

    /**
     * Test B: HI → AZ with FEDEX_2_DAY from non_contiguous config (mapper picks express for HI origin).
     */
    public function test_b_hi_to_az_uses_rate_selected_express_service(): void
    {
        // Rate must run to assert HI→AZ express selection; FEDEX_ENV=sandbox skips Rate API entirely (ship create is still mocked below).
        config([
            'fedex.env' => 'production',
            'fedex.environment' => 'production',
        ]);

        $this->fakeFedExShipSuccess('FX-TEST-B-HI-AZ', ['FEDEX_2_DAY', 'FEDEX_EXPRESS_SAVER'], 'FEDEX_2_DAY');

        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/shipments', [
            'user_id' => $customer->id,
            'sender_details' => [
                'name' => 'Sender',
                'street1' => '75-5660 Kopiko St',
                'city' => 'Kailua Kona',
                'state' => 'HI',
                'postalCode' => '96740',
                'country' => 'US',
                'phone' => '8085551234',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '400 E Van Buren St',
                'city' => 'Phoenix',
                'state' => 'AZ',
                'postalCode' => '85001',
                'country' => 'US',
                'phone' => '6025554567',
            ],
            'package_details' => [
                'weightLb' => 12,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Test B HI to AZ',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-TEST-B-HI-AZ')
            ->assertJsonPath('data.service_type', 'FEDEX_2_DAY');
    }

    /**
     * First Ship create returns INVALID.INPUT; second succeeds with alternate service (sandbox retry path).
     */
    public function test_c_hi_to_az_retries_ship_create_after_invalid_input_in_sandbox(): void
    {
        config([
            'fedex.env' => 'production',
            'fedex.environment' => 'production',
            'fedex.sandbox_ship_create_alternate_service_types' => ['PRIORITY_OVERNIGHT'],
            'fedex.sandbox_ship_create_alternate_pickup_types' => [],
            'fedex.sandbox_retry_ship_create_on_invalid_input' => true,
        ]);

        $this->fakeFedExShipSuccess(
            'FX-HI-RETRY-OK',
            ['FEDEX_2_DAY'],
            'FEDEX_2_DAY',
            true,
            'PRIORITY_OVERNIGHT',
        );

        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/shipments', [
            'user_id' => $customer->id,
            'sender_details' => [
                'name' => 'Sender',
                'street1' => '75-5660 Kopiko St',
                'city' => 'Kailua Kona',
                'state' => 'HI',
                'postalCode' => '96740',
                'country' => 'US',
                'phone' => '8085551234',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '400 E Van Buren St',
                'city' => 'Phoenix',
                'state' => 'AZ',
                'postalCode' => '85001',
                'country' => 'US',
                'phone' => '6025554567',
            ],
            'package_details' => [
                'weightLb' => 12,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Test C retry',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-HI-RETRY-OK')
            ->assertJsonPath('data.service_type', 'PRIORITY_OVERNIGHT');
    }

    /**
     * @param  array<int, string>  $rateServiceTypes
     */
    private function fakeFedExShipSuccess(
        string $trackingNumber,
        array $rateServiceTypes = ['FEDEX_GROUND'],
        ?string $shipServiceType = null,
        bool $failFirstShipCreate = false,
        ?string $shipServiceTypeAfterRetry = null,
    ): void {
        $shipServiceType = $shipServiceType ?? $rateServiceTypes[0];
        $rateDetails = array_map(fn (string $s) => ['serviceType' => $s], $rateServiceTypes);

        Http::fake(function (Request $request) use ($trackingNumber, $rateDetails, $shipServiceType, $failFirstShipCreate, $shipServiceTypeAfterRetry) {
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
                        'rateReplyDetails' => $rateDetails,
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
                                    'streetLines' => ['Resolved St'],
                                    'city' => 'City',
                                    'stateOrProvinceCode' => 'AZ',
                                    'postalCode' => '85001',
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
                static $shipCreateCount = 0;
                if ($failFirstShipCreate) {
                    $shipCreateCount++;
                    if ($shipCreateCount === 1) {
                        return Http::response([
                            'transactionId' => 'fedex-tx-invalid-input',
                            'errors' => [
                                [
                                    'code' => 'INVALID.INPUT.EXCEPTION',
                                    'message' => 'Invalid field value in the input',
                                ],
                            ],
                        ], 422);
                    }
                }

                $svc = ($failFirstShipCreate && $shipServiceTypeAfterRetry !== null && $shipServiceTypeAfterRetry !== '')
                    ? $shipServiceTypeAfterRetry
                    : $shipServiceType;

                return Http::response([
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => $trackingNumber,
                                'serviceType' => $svc,
                                'shipTimestamp' => now()->toIso8601String(),
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => $trackingNumber,
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
    }
}

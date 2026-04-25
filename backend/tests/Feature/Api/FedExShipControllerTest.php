<?php

namespace Tests\Feature\Api;

use App\Jobs\CheckAsyncShipmentJob;
use App\Models\Shipment;
use App\Models\User;
use App\Services\FedEx\FedExShipErrorMapper;
use App\Support\UsStateCodeNormalizer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExShipControllerTest extends TestCase
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

    public function test_validate_returns_generic_message_when_fedex_invalid_input(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 't',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/ship/v1/shipments/packages/validate' => Http::response([
                'transactionId' => 'fedex-txn-1',
                'errors' => [
                    [
                        'code' => 'INVALID.INPUT.EXCEPTION',
                        'message' => 'Sensitive FedEx diagnostic detail',
                    ],
                ],
            ], 422),
        ]);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/shipments/validate', $this->sampleShipPayload());

        $response->assertStatus(422)
            ->assertJsonPath('message', FedExShipErrorMapper::GENERIC_INVALID_INPUT_MESSAGE)
            ->assertJsonPath('fedex_errors.0.code', 'INVALID.INPUT.EXCEPTION');
    }

    public function test_validate_accepts_full_us_state_name_and_normalizes_to_code(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 't',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/ship/v1/shipments/packages/validate' => Http::response([
                'transactionId' => 'fedex-validate-tx',
                'output' => [
                    'alerts' => [],
                ],
            ], 200),
        ]);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $payload = $this->sampleShipPayload();
        $payload['shipper']['address']['stateOrProvinceCode'] = 'Tennessee';
        $payload['recipients'][0]['address']['stateOrProvinceCode'] = 'Tennessee';

        $response = $this->postJson('/api/fedex/shipments/validate', $payload);

        $response->assertOk()
            ->assertJsonStructure(['alerts', 'transaction_id', 'fedex_transaction_id'])
            ->assertJsonPath('fedex_transaction_id', 'fedex-validate-tx');
    }

    public function test_validate_returns_invalid_state_when_us_state_unknown(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $payload = $this->sampleShipPayload();
        $payload['shipper']['address']['stateOrProvinceCode'] = 'NotAState';

        $response = $this->postJson('/api/fedex/shipments/validate', $payload);

        $response->assertStatus(422)
            ->assertJsonPath('code', UsStateCodeNormalizer::ERROR_CODE)
            ->assertJsonPath('message', UsStateCodeNormalizer::INVALID_MESSAGE);
    }

    public function test_validate_shipment_returns_alerts(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 't',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/ship/v1/shipments/packages/validate' => Http::response([
                'transactionId' => 'fedex-validate-tx-2',
                'output' => [
                    'alerts' => [],
                ],
            ], 200),
        ]);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/shipments/validate', $this->sampleShipPayload());

        $response->assertOk()
            ->assertJsonStructure(['alerts', 'transaction_id', 'fedex_transaction_id'])
            ->assertJsonPath('fedex_transaction_id', 'fedex-validate-tx-2');
    }

    public function test_store_shipment_returns_502_when_fedex_account_missing(): void
    {
        config(['fedex.account_number' => '']);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/shipments', array_merge($this->sampleShipPayload(), [
            'pickupType' => 'USE_SCHEDULED_PICKUP',
            'confirm_warnings' => true,
        ]));

        $response->assertStatus(502);
    }

    public function test_store_creates_shipment_when_fedex_succeeds(): void
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
                                'masterTrackingNumber' => 'FX-TRACK-999',
                                'serviceType' => 'FEDEX_GROUND',
                                'shipTimestamp' => now()->toIso8601String(),
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-TRACK-999',
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

        $response = $this->postJson('/api/fedex/shipments', array_merge($this->sampleShipPayload(), [
            'pickupType' => 'USE_SCHEDULED_PICKUP',
            'confirm_warnings' => true,
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-TRACK-999')
            ->assertJsonPath('data.status', 'label_created');
    }

    public function test_store_creates_shipment_when_sandbox_address_validation_returns_virtual_response(): void
    {
        config(['fedex.environment' => 'sandbox']);

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
                    'errors' => [
                        ['code' => 'VIRTUAL.RESPONSE', 'message' => 'This is a Virtual Response.'],
                    ],
                ], 400);
            }
            if (str_contains($url, '/ship/v1/shipments/packages/validate')) {
                return Http::response(['output' => ['alerts' => []]], 200);
            }
            if ($request->method() === 'POST' && preg_match('#/ship/v1/shipments$#', $url)) {
                return Http::response([
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => 'FX-TRACK-VIRT',
                                'serviceType' => 'FEDEX_GROUND',
                                'shipTimestamp' => now()->toIso8601String(),
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-TRACK-VIRT',
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

        $response = $this->postJson('/api/fedex/shipments', array_merge($this->sampleShipPayload(), [
            'pickupType' => 'USE_SCHEDULED_PICKUP',
            'confirm_warnings' => true,
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'FX-TRACK-VIRT')
            ->assertJsonPath('data.status', 'label_created');
    }

    public function test_store_dispatches_async_label_job_when_job_id_without_label(): void
    {
        Queue::fake();

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
                        'jobId' => 'JOB-ASYNC-UI',
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => 'FX-ASYNC-TRACK',
                                'serviceType' => 'FEDEX_GROUND',
                                'shipTimestamp' => now()->toIso8601String(),
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-ASYNC-TRACK',
                                        'packageDocuments' => [],
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

        $this->postJson('/api/fedex/shipments', array_merge($this->sampleShipPayload(), [
            'pickupType' => 'USE_SCHEDULED_PICKUP',
            'confirm_warnings' => true,
        ]))->assertCreated();

        $shipmentId = (int) Shipment::query()->where('user_id', $user->id)->value('id');
        $this->assertGreaterThan(0, $shipmentId);

        Queue::assertPushed(CheckAsyncShipmentJob::class, function (CheckAsyncShipmentJob $job) use ($shipmentId) {
            return $job->shipmentId === $shipmentId && $job->pollCount === 0;
        });
    }

    public function test_validate_sends_account_number_object_and_version(): void
    {
        config([
            'fedex.env' => 'production',
            'fedex.environment' => 'production',
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
            if (str_contains($url, '/ship/v1/shipments/packages/validate')) {
                $data = $request->data();
                $this->assertIsArray($data['accountNumber'] ?? null);
                $this->assertSame('123456789', $data['accountNumber']['value'] ?? null);
                $this->assertArrayHasKey('version', $data);
                $this->assertSame('1', $data['version']['major'] ?? null);

                return Http::response(
                    ['transactionId' => 'fedex-pkg-validate-tx', 'output' => ['alerts' => []]],
                    200,
                );
            }

            return Http::response(['errors' => [['code' => 'UNEXPECTED', 'message' => $url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/shipments/validate', $this->sampleShipPayload())
            ->assertOk()
            ->assertJsonPath('fedex_transaction_id', 'fedex-pkg-validate-tx');
    }

    public function test_create_tag_returns_201_when_fedex_succeeds(): void
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
            if ($request->method() === 'POST' && str_contains($url, '/ship/v1/shipments/tag')) {
                $data = $request->data();
                $this->assertIsArray($data['accountNumber'] ?? null);
                $this->assertSame('123456789', $data['accountNumber']['value'] ?? null);
                $rs = $data['requestedShipment'] ?? [];
                $this->assertIsArray($rs['pickupDetail'] ?? null);
                $this->assertSame('2020-07-03T09:00:00Z', $rs['pickupDetail']['readyPickupDateTime'] ?? null);
                $this->assertSame('2020-07-03T17:00:00Z', $rs['pickupDetail']['latestPickupDateTime'] ?? null);
                $items = $rs['requestedPackageLineItems'] ?? [];
                $this->assertSame('Return merchandise', $items[0]['itemDescription'] ?? null);

                return Http::response([
                    'transactionId' => 'fedex-tag-tx-1',
                    'customerTransactionId' => 'cust-tag-1',
                    'output' => [
                        'masterTrackingNumber' => 'TAG-TRACK-1',
                        'serviceType' => 'FEDEX_GROUND',
                        'shipTimestamp' => now()->toIso8601String(),
                        'alerts' => [],
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['code' => 'UNEXPECTED', 'message' => $url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/shipments/tag', array_merge($this->sampleShipPayload(), [
            'pickupType' => 'USE_SCHEDULED_PICKUP',
            'confirm_warnings' => true,
            'pickup_detail' => [
                'ready_pickup_datetime' => '2020-07-03T09:00:00Z',
                'latest_pickup_datetime' => '2020-07-03T17:00:00Z',
            ],
            'packages' => [
                [
                    'description' => 'Return merchandise',
                    'weight' => ['value' => 2.5, 'units' => 'LB'],
                    'dimensions' => ['length' => 12, 'width' => 9, 'height' => 6, 'units' => 'IN'],
                ],
            ],
        ]));

        $response->assertStatus(201)
            ->assertJsonPath('tracking_number', 'TAG-TRACK-1')
            ->assertJsonPath('fedex_transaction_id', 'fedex-tag-tx-1')
            ->assertJsonPath('customer_transaction_id', 'cust-tag-1');
    }

    public function test_cancel_tag_requires_admin(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);

        $this->putJson('/api/fedex/shipments/tag/cancel/sid-1', [
            'serviceType' => 'FEDEX_GROUND',
            'trackingNumber' => '301025281523',
            'completedTagDetail' => [
                'confirmationNumber' => '275',
                'location' => 'NQAA',
                'dispatchDate' => '2019-08-03',
            ],
        ])->assertStatus(403);
    }

    public function test_cancel_tag_succeeds_for_admin(): void
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
            if (str_contains($url, '/ship/v1/shipments/tag/cancel/')) {
                $data = $request->data();
                $this->assertSame('123456789', $data['accountNumber']['value'] ?? null);
                $this->assertSame('FEDEX_GROUND', $data['serviceType'] ?? null);
                $this->assertSame('301025281523', $data['trackingNumber'] ?? null);
                $this->assertSame('275', $data['completedTagDetail']['confirmationNumber'] ?? null);
                $this->assertArrayHasKey('version', $data);

                return Http::response([
                    'transactionId' => 'fedex-cancel-tag-tx',
                    'customerTransactionId' => 'cust-cancel-tag',
                    'output' => [
                        'cancelledTag' => true,
                        'successMessage' => 'success',
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['code' => 'UNEXPECTED', 'message' => $url]]], 500);
        });

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $this->putJson('/api/fedex/shipments/tag/cancel/sid-abc', [
            'serviceType' => 'FEDEX_GROUND',
            'trackingNumber' => '301025281523',
            'completedTagDetail' => [
                'confirmationNumber' => '275',
                'location' => 'NQAA',
                'dispatchDate' => '2019-08-03',
            ],
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('cancelled', true)
            ->assertJsonPath('fedex_transaction_id', 'fedex-cancel-tag-tx')
            ->assertJsonPath('customer_transaction_id', 'cust-cancel-tag')
            ->assertJsonPath('output.cancelledTag', true)
            ->assertJsonPath('output.successMessage', 'success');
    }

    public function test_cancel_forbidden_for_other_customer(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $owner = User::factory()->create(['role' => 'customer']);
        $shipment = Shipment::query()->create([
            'user_id' => $owner->id,
            'tracking_number' => 'TRK1',
            'sender_details' => ['name' => 'a', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'receiver_details' => ['name' => 'b', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'package_details' => ['weightLb' => 1, 'lengthIn' => 1, 'widthIn' => 1, 'heightIn' => 1, 'description' => 'x'],
            'status' => 'label_created',
            'label_url' => null,
            'fedex_response' => [],
        ]);

        Sanctum::actingAs($customer);

        $this->deleteJson('/api/fedex/shipments/'.$shipment->id)->assertStatus(403);
    }

    public function test_customer_can_cancel_own_shipment_via_fedex(): void
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
            if (str_contains($url, '/ship/v1/shipments/cancel')) {
                return Http::response([
                    'transactionId' => 'tx-cancel-1',
                    'output' => [
                        'cancelledShipment' => true,
                        'message' => 'Shipment is successfully cancelled',
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['code' => 'UNEXPECTED', 'message' => $url]]], 500);
        });

        $owner = User::factory()->create(['role' => 'customer']);
        $shipment = Shipment::query()->create([
            'user_id' => $owner->id,
            'tracking_number' => '794953555571',
            'sender_details' => ['name' => 'a', 'street1' => '1', 'city' => 'c', 'state' => 'TN', 'postalCode' => '38116', 'country' => 'US', 'phone' => '9015551212'],
            'receiver_details' => ['name' => 'b', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'package_details' => ['weightLb' => 1, 'lengthIn' => 1, 'widthIn' => 1, 'heightIn' => 1, 'description' => 'x'],
            'status' => 'label_created',
            'label_url' => null,
            'fedex_response' => [],
        ]);

        Sanctum::actingAs($owner);

        $this->deleteJson('/api/fedex/shipments/'.$shipment->id)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertSame('cancelled', $shipment->fresh()->status);
    }

    public function test_async_job_status_returns_fedex_retrieve_async_ship_response(): void
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
            if (str_contains($url, '/ship/v1/shipments/results')) {
                $data = $request->data();
                $this->assertSame('async-job-1', $data['jobId'] ?? null);
                $this->assertArrayHasKey('accountNumber', $data);
                $this->assertArrayHasKey('version', $data);

                return Http::response([
                    'transactionId' => 'fedex-txn-async',
                    'customerTransactionId' => 'cust-async',
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => '794953535000',
                                'serviceType' => 'FEDEX_GROUND',
                            ],
                        ],
                    ],
                ], 200);
            }

            return Http::response(['errors' => [['code' => 'UNEXPECTED', 'message' => $url]]], 500);
        });

        $owner = User::factory()->create(['role' => 'customer']);
        Shipment::query()->create([
            'user_id' => $owner->id,
            'tracking_number' => 'FEDEX-ASYNC-PENDING',
            'sender_details' => ['name' => 'a', 'street1' => '1', 'city' => 'c', 'state' => 'TN', 'postalCode' => '38116', 'country' => 'US', 'phone' => '9015551212'],
            'receiver_details' => ['name' => 'b', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'package_details' => ['weightLb' => 1, 'lengthIn' => 1, 'widthIn' => 1, 'heightIn' => 1, 'description' => 'x'],
            'status' => 'label_created',
            'label_url' => null,
            'fedex_response' => [],
            'fedex_job_id' => 'async-job-1',
        ]);

        Sanctum::actingAs($owner);

        $this->getJson('/api/fedex/shipments/jobs/async-job-1/status')
            ->assertOk()
            ->assertJsonPath('transaction_id', 'fedex-txn-async')
            ->assertJsonPath('customer_transaction_id', 'cust-async')
            ->assertJsonPath('output.transactionShipments.0.masterTrackingNumber', '794953535000');
    }

    /**
     * @return array<string, mixed>
     */
    private function sampleShipPayload(): array
    {
        return [
            'serviceType' => 'FEDEX_GROUND',
            'packagingType' => 'YOUR_PACKAGING',
            'pickupType' => 'USE_SCHEDULED_PICKUP',
            'is_residential' => false,
            'shipper' => [
                'contact' => [
                    'personName' => 'Shipper Name',
                    'phoneNumber' => '9015551212',
                    'companyName' => 'Co',
                ],
                'address' => [
                    'streetLines' => ['2000 Freight Rd'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38116',
                    'countryCode' => 'US',
                ],
            ],
            'recipients' => [
                [
                    'contact' => [
                        'personName' => 'Receiver',
                        'phoneNumber' => '9015553434',
                    ],
                    'address' => [
                        'streetLines' => ['100 Receiver St'],
                        'city' => 'Nashville',
                        'stateOrProvinceCode' => 'TN',
                        'postalCode' => '37203',
                        'countryCode' => 'US',
                    ],
                ],
            ],
            'packages' => [
                [
                    'weight' => ['value' => 2.5, 'units' => 'LB'],
                    'dimensions' => ['length' => 12, 'width' => 9, 'height' => 6, 'units' => 'IN'],
                ],
            ],
        ];
    }
}

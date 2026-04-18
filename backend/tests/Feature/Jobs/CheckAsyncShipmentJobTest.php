<?php

namespace Tests\Feature\Jobs;

use App\Jobs\CheckAsyncShipmentJob;
use App\Models\Shipment;
use App\Models\User;
use App\Services\FedEx\FedExShipApiService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class CheckAsyncShipmentJobTest extends TestCase
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

    public function test_job_updates_shipment_when_results_contain_label_url(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $shipment = Shipment::query()->create([
            'user_id' => $user->id,
            'tracking_number' => 'FX-PENDING',
            'fedex_tracking_number' => 'FX-PENDING',
            'fedex_job_id' => 'JOB-ASYNC-TEST',
            'sender_details' => ['name' => 'S', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'receiver_details' => ['name' => 'R', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'package_details' => ['weightLb' => 1, 'lengthIn' => 1, 'widthIn' => 1, 'heightIn' => 1, 'description' => 'x'],
            'status' => 'label_created',
            'label_url' => null,
            'label_path' => null,
            'service_type' => 'FEDEX_GROUND',
            'pickup_type' => 'USE_SCHEDULED_PICKUP',
            'package_weight' => 1,
            'package_dimensions' => ['length' => 1, 'width' => 1, 'height' => 1, 'units' => 'IN'],
            'is_residential' => false,
            'fedex_response' => [],
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
            if (str_contains($url, '/ship/v1/shipments/results')) {
                $data = $request->data();
                $this->assertSame('JOB-ASYNC-TEST', $data['jobId'] ?? null);

                return Http::response([
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => 'FX-PENDING',
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-PENDING',
                                        'packageDocuments' => [
                                            [
                                                'url' => 'https://labels.example/final.pdf',
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

        (new CheckAsyncShipmentJob($shipment->id, 0))->handle(app(FedExShipApiService::class));

        $shipment->refresh();
        $this->assertSame('https://labels.example/final.pdf', $shipment->label_url);
        $this->assertNull($shipment->label_path);
        $this->assertSame('label_created', $shipment->status);
    }

    public function test_job_dispatches_follow_up_when_label_not_ready(): void
    {
        Queue::fake();

        $user = User::factory()->create(['role' => 'customer']);
        $shipment = Shipment::query()->create([
            'user_id' => $user->id,
            'tracking_number' => 'FX-PENDING',
            'fedex_tracking_number' => 'FX-PENDING',
            'fedex_job_id' => 'JOB-POLL',
            'sender_details' => ['name' => 'S', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'receiver_details' => ['name' => 'R', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'package_details' => ['weightLb' => 1, 'lengthIn' => 1, 'widthIn' => 1, 'heightIn' => 1, 'description' => 'x'],
            'status' => 'label_created',
            'label_url' => null,
            'label_path' => null,
            'service_type' => 'FEDEX_GROUND',
            'pickup_type' => 'USE_SCHEDULED_PICKUP',
            'package_weight' => 1,
            'package_dimensions' => ['length' => 1, 'width' => 1, 'height' => 1, 'units' => 'IN'],
            'is_residential' => false,
            'fedex_response' => [],
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
            if (str_contains($url, '/ship/v1/shipments/results')) {
                return Http::response([
                    'output' => [
                        'transactionShipments' => [
                            [
                                'masterTrackingNumber' => 'FX-PENDING',
                                'pieceResponses' => [
                                    [
                                        'trackingNumber' => 'FX-PENDING',
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

        (new CheckAsyncShipmentJob($shipment->id, 0))->handle(app(FedExShipApiService::class));

        Queue::assertPushed(CheckAsyncShipmentJob::class, function (CheckAsyncShipmentJob $job) use ($shipment) {
            return $job->shipmentId === $shipment->id && $job->pollCount === 1;
        });
    }
}

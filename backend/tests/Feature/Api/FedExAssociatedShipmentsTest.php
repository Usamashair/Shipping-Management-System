<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExAssociatedShipmentsTest extends TestCase
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

    public function test_returns_502_when_fedex_not_configured(): void
    {
        config(['fedex.account_number' => '']);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/associated-shipments', [
            'associatedType' => 'STANDARD_MPS',
            'masterTrackingNumberInfo' => [
                'trackingNumberInfo' => [
                    'trackingNumber' => '858488600850',
                ],
            ],
        ])->assertStatus(502)
            ->assertJsonPath('message', 'FedEx is not configured.');
    }

    public function test_returns_422_when_tracking_number_missing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/associated-shipments', [
            'associatedType' => 'STANDARD_MPS',
            'masterTrackingNumberInfo' => [
                'trackingNumberInfo' => [],
            ],
        ])->assertStatus(422);
    }

    public function test_returns_fedex_json_on_success(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-mps',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/associatedshipments' => Http::response([
                'transactionId' => 'txn-mps-1',
                'customerTransactionId' => 'cust-1',
                'output' => [
                    'completeTrackResults' => [],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $payload = [
            'includeDetailedScans' => true,
            'associatedType' => 'STANDARD_MPS',
            'masterTrackingNumberInfo' => [
                'shipDateBegin' => '2018-11-01',
                'shipDateEnd' => '2018-11-03',
                'trackingNumberInfo' => [
                    'trackingNumber' => '858488600850',
                    'carrierCode' => 'FDXE',
                    'trackingNumberUniqueId' => '245822~123456789012~FDEG',
                ],
            ],
        ];

        $this->postJson('/api/fedex/track/associated-shipments', $payload)
            ->assertOk()
            ->assertJsonPath('transactionId', 'txn-mps-1')
            ->assertJsonPath('output.completeTrackResults', []);
    }

    public function test_defaults_include_detailed_scans_when_omitted(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-mps',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/associatedshipments' => Http::response([
                'transactionId' => 'txn-mps-2',
                'output' => [],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/associated-shipments', [
            'associatedType' => 'STANDARD_MPS',
            'masterTrackingNumberInfo' => [
                'trackingNumberInfo' => [
                    'trackingNumber' => '858488600850',
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('transactionId', 'txn-mps-2');

        Http::assertSent(function (Request $request): bool {
            if ($request->url() !== 'https://apis-sandbox.fedex.com/track/v1/associatedshipments') {
                return false;
            }
            $data = $request->data();

            return ($data['includeDetailedScans'] ?? null) === true;
        });
    }

    public function test_returns_fedex_errors_on_http_400(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-mps',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/associatedshipments' => Http::response([
                'transactionId' => 'txn-err',
                'errors' => [
                    [
                        'code' => 'TRACKING.TRACKINGNUMBER.EMPTY',
                        'message' => 'Please provide tracking number.',
                    ],
                ],
            ], 400),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/associated-shipments', [
            'includeDetailedScans' => true,
            'associatedType' => 'STANDARD_MPS',
            'masterTrackingNumberInfo' => [
                'trackingNumberInfo' => [
                    'trackingNumber' => '858488600850',
                ],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'TRACKING.TRACKINGNUMBER.EMPTY')
            ->assertJsonPath('message', 'Please provide tracking number.');
    }
}

<?php

namespace Tests\Feature\Api;

use App\Http\Requests\StoreFedExFreightLtlRateRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExFreightLtlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.freight_ltl.account_number' => '987654321',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
        ]);
    }

    public function test_freight_ltl_rate_returns_502_when_freight_account_not_configured(): void
    {
        config(['fedex.freight_ltl.account_number' => '']);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/freight/ltl/rate-quotes', $this->minimalFreightLtlRatePayload())
            ->assertStatus(502)
            ->assertJsonPath('message', 'FedEx Freight LTL is not configured.');
    }

    public function test_freight_ltl_rate_returns_422_when_body_empty(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/freight/ltl/rate-quotes', [])
            ->assertStatus(422);
    }

    public function test_freight_ltl_rate_returns_422_when_freight_requested_shipment_missing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/freight/ltl/rate-quotes', [
            'accountNumber' => ['value' => '987654321'],
        ])
            ->assertStatus(422);
    }

    public function test_freight_ltl_rate_returns_fedex_json_on_success(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-ltl',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/rate/v1/freight/rates/quotes' => Http::response([
                'transactionId' => 'txn-ltl-1',
                'output' => ['rateReplyDetails' => []],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/freight/ltl/rate-quotes', $this->minimalFreightLtlRatePayload())
            ->assertOk()
            ->assertJsonPath('transactionId', 'txn-ltl-1')
            ->assertJsonPath('output.rateReplyDetails', []);
    }

    public function test_freight_ltl_rate_returns_422_on_fedex_http_400(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-ltl',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/rate/v1/freight/rates/quotes' => Http::response([
                'transactionId' => 'txn-err',
                'errors' => [
                    [
                        'code' => 'INVALID.INPUT',
                        'message' => 'Bad request.',
                    ],
                ],
            ], 400),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/freight/ltl/rate-quotes', $this->minimalFreightLtlRatePayload())
            ->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'INVALID.INPUT')
            ->assertJsonPath('message', 'Bad request.');
    }

    /**
     * Minimal shape so {@see StoreFedExFreightLtlRateRequest} passes; FedEx validates the rest.
     *
     * @return array<string, mixed>
     */
    private function minimalFreightLtlRatePayload(): array
    {
        return [
            'accountNumber' => ['value' => '987654321'],
            'freightRequestedShipment' => [
                'shipDateStamp' => '2026-04-20',
                'shipper' => [
                    'address' => [
                        'streetLines' => ['1550 Union Blvd'],
                        'city' => 'Beverly Hills',
                        'stateOrProvinceCode' => 'TN',
                        'postalCode' => '65247',
                        'countryCode' => 'US',
                    ],
                ],
                'recipient' => [
                    'address' => [
                        'streetLines' => ['1600 Main St'],
                        'city' => 'Dallas',
                        'stateOrProvinceCode' => 'TX',
                        'postalCode' => '75201',
                        'countryCode' => 'US',
                    ],
                ],
            ],
        ];
    }
}

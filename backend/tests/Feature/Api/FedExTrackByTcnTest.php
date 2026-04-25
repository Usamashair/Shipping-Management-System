<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExTrackByTcnTest extends TestCase
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

        $this->postJson('/api/fedex/track/tcn', $this->samplePayload())
            ->assertStatus(502)
            ->assertJsonPath('message', 'FedEx is not configured.');
    }

    public function test_returns_422_when_tcn_value_missing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/tcn', [
            'tcnInfo' => [
                'carrierCode' => 'FDXE',
            ],
            'includeDetailedScans' => true,
        ])->assertStatus(422);
    }

    public function test_returns_fedex_json_on_success(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-tcn',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/tcn' => Http::response([
                'transactionId' => 'txn-tcn-1',
                'customerTransactionId' => 'cust-1',
                'output' => [
                    'completeTrackResults' => [],
                    'alerts' => 'TRACKING.DATA.NOTFOUND -  Tracking data unavailable',
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/tcn', $this->samplePayload())
            ->assertOk()
            ->assertJsonPath('transactionId', 'txn-tcn-1')
            ->assertJsonPath('output.alerts', 'TRACKING.DATA.NOTFOUND -  Tracking data unavailable');
    }

    public function test_returns_fedex_errors_on_http_400(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-tcn',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/tcn' => Http::response([
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

        $this->postJson('/api/fedex/track/tcn', $this->samplePayload())
            ->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'TRACKING.TRACKINGNUMBER.EMPTY')
            ->assertJsonPath('message', 'Please provide tracking number.');
    }

    /**
     * @return array<string, mixed>
     */
    private function samplePayload(): array
    {
        return [
            'tcnInfo' => [
                'value' => 'N552428361Y555XXX',
                'carrierCode' => 'FDXE',
                'shipDateBegin' => '2019-02-13',
                'shipDateEnd' => '2019-02-13',
            ],
            'includeDetailedScans' => true,
        ];
    }
}

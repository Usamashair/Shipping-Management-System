<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExTrackByReferenceTest extends TestCase
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

        $this->postJson('/api/fedex/track/by-reference', $this->samplePayload())
            ->assertStatus(502)
            ->assertJsonPath('message', 'FedEx is not configured.');
    }

    public function test_returns_422_when_value_missing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/by-reference', [
            'referencesInformation' => [
                'accountNumber' => 'XXX61073',
            ],
            'includeDetailedScans' => true,
        ])->assertStatus(422);
    }

    public function test_returns_422_when_neither_account_nor_destination_pair(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/by-reference', [
            'referencesInformation' => [
                'type' => 'BILL_OF_LADING',
                'value' => '56754674567546754',
                'carrierCode' => 'FDXE',
                'shipDateBegin' => '2019-02-13',
                'shipDateEnd' => '2019-02-13',
            ],
            'includeDetailedScans' => true,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['referencesInformation']);
    }

    public function test_returns_fedex_json_on_success(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-ref',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/referencenumbers' => Http::response([
                'transactionId' => 'txn-ref-1',
                'customerTransactionId' => 'cust-1',
                'output' => [
                    'completeTrackResults' => [],
                    'successful' => true,
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/by-reference', $this->samplePayload())
            ->assertOk()
            ->assertJsonPath('transactionId', 'txn-ref-1')
            ->assertJsonPath('output.successful', true);
    }

    public function test_returns_fedex_errors_on_http_400(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-ref',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/referencenumbers' => Http::response([
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

        $this->postJson('/api/fedex/track/by-reference', $this->samplePayload())
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
            'referencesInformation' => [
                'type' => 'BILL_OF_LADING',
                'value' => '56754674567546754',
                'accountNumber' => 'XXX61073',
                'carrierCode' => 'FDXE',
                'shipDateBegin' => '2019-02-13',
                'shipDateEnd' => '2019-02-13',
                'destinationCountryCode' => 'US',
                'destinationPostalCode' => '75063',
            ],
            'includeDetailedScans' => true,
        ];
    }
}

<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExTrackDocumentTest extends TestCase
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

        $this->postJson('/api/fedex/track/documents', $this->sampleSpodPayload())
            ->assertStatus(502)
            ->assertJsonPath('message', 'FedEx is not configured.');
    }

    public function test_returns_422_when_tracking_number_missing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/documents', [
            'trackDocumentDetail' => [
                'documentType' => 'SIGNATURE_PROOF_OF_DELIVERY',
                'documentFormat' => 'PDF',
            ],
            'trackDocumentSpecification' => [
                [
                    'trackingNumberInfo' => [],
                ],
            ],
        ])->assertStatus(422);
    }

    public function test_returns_422_when_bill_of_lading_without_account_number(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/documents', [
            'trackDocumentDetail' => [
                'documentType' => 'BILL_OF_LADING',
                'documentFormat' => 'PDF',
            ],
            'trackDocumentSpecification' => [
                [
                    'trackingNumberInfo' => [
                        'trackingNumber' => '128667043726',
                        'carrierCode' => 'FDXE',
                    ],
                ],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['trackDocumentSpecification.0.accountNumber']);
    }

    public function test_returns_422_when_bill_of_lading_with_png(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/documents', [
            'trackDocumentDetail' => [
                'documentType' => 'BILL_OF_LADING',
                'documentFormat' => 'PNG',
            ],
            'trackDocumentSpecification' => [
                [
                    'accountNumber' => '123456789',
                    'trackingNumberInfo' => [
                        'trackingNumber' => '128667043726',
                    ],
                ],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['trackDocumentDetail.documentFormat']);
    }

    public function test_returns_fedex_json_on_success(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-doc',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/trackingdocuments' => Http::response([
                'transactionId' => 'txn-doc-1',
                'customerTransactionId' => 'cust-1',
                'output' => [
                    'documentFormat' => 'PNG',
                    'document' => [],
                    'alerts' => 'TRACKING.DATA.NOTFOUND -  Tracking data unavailable',
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/documents', $this->sampleSpodPayload())
            ->assertOk()
            ->assertJsonPath('transactionId', 'txn-doc-1')
            ->assertJsonPath('output.documentFormat', 'PNG');
    }

    public function test_returns_fedex_errors_on_http_400(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-doc',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/trackingdocuments' => Http::response([
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

        $this->postJson('/api/fedex/track/documents', $this->sampleSpodPayload())
            ->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'TRACKING.TRACKINGNUMBER.EMPTY')
            ->assertJsonPath('message', 'Please provide tracking number.');
    }

    /**
     * @return array<string, mixed>
     */
    private function sampleSpodPayload(): array
    {
        return [
            'trackDocumentDetail' => [
                'documentType' => 'SIGNATURE_PROOF_OF_DELIVERY',
                'documentFormat' => 'PNG',
            ],
            'trackDocumentSpecification' => [
                [
                    'trackingNumberInfo' => [
                        'trackingNumber' => '128667043726',
                        'carrierCode' => 'FDXE',
                        'trackingNumberUniqueId' => '245822~123456789012~FDEG',
                    ],
                    'shipDateBegin' => '2020-03-29',
                    'shipDateEnd' => '2020-04-01',
                    'accountNumber' => 'XXX61073',
                ],
            ],
        ];
    }
}

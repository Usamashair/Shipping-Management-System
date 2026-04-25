<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExRateQuoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_quote_rates(): void
    {
        $this->postJson('/api/fedex/rates/quotes', [])
            ->assertUnauthorized();
    }

    public function test_authenticated_user_receives_normalized_quotes_when_fedex_succeeds(): void
    {
        config([
            'fedex.env' => 'production',
            'fedex.environment' => 'production',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
            'fedex.client_id' => 'test',
            'fedex.client_secret' => 'secret',
            'fedex.account_number' => '123456789',
        ]);

        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 't',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/rate/v1/rates/quotes' => Http::response([
                'transactionId' => 'tx-rate-1',
                'customerTransactionId' => 'cust-1',
                'output' => [
                    'quoteDate' => '2020-01-01',
                    'alerts' => [],
                    'rateReplyDetails' => [
                        [
                            'serviceType' => 'FEDEX_GROUND',
                            'serviceName' => 'FedEx Ground',
                            'packagingType' => 'YOUR_PACKAGING',
                            'customerMessages' => [],
                            'operationalDetail' => ['transitTime' => 'ONE_DAY'],
                            'ratedShipmentDetails' => [
                                [
                                    'rateType' => 'ACCOUNT',
                                    'ratedWeightMethod' => 'ACTUAL',
                                    'totalNetCharge' => 12.5,
                                    'currency' => 'USD',
                                ],
                                [
                                    'rateType' => 'LIST',
                                    'totalNetCharge' => 15.0,
                                    'currency' => 'USD',
                                ],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/fedex/rates/quotes', [
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
                'description' => 'Test quote',
            ],
        ]);

        $response->assertOk()
            ->assertJsonPath('transactionId', 'tx-rate-1')
            ->assertJsonPath('quoteDate', '2020-01-01')
            ->assertJsonPath('rateReplyDetails.0.serviceType', 'FEDEX_GROUND')
            ->assertJsonPath('rateReplyDetails.0.ratedShipmentDetails.0.rateType', 'ACCOUNT');
    }
}

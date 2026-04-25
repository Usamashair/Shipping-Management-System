<?php

namespace Tests\Feature\Api;

use App\Contracts\FedEx\FedExClient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShipmentCountryAndFedExAddressTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, mixed>
     */
    private function baseShipmentPayload(): array
    {
        return [
            'sender_details' => [
                'name' => 'Shipper',
                'street1' => '2000 Freight Rd',
                'city' => 'Memphis',
                'state' => 'TN',
                'postalCode' => '38116',
                'country' => 'US',
                'phone' => '9015551212',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '100 Receiver St',
                'city' => 'Nashville',
                'state' => 'TN',
                'postalCode' => '37203',
                'country' => 'US',
                'phone' => '9015553434',
            ],
            'package_details' => [
                'weightLb' => 2.5,
                'lengthIn' => 12,
                'widthIn' => 9,
                'heightIn' => 6,
                'description' => 'Books',
            ],
        ];
    }

    public function test_customer_rejects_country_not_iso2_letters(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $payload = $this->baseShipmentPayload();
        $payload['sender_details']['country'] = 'USA';

        $response = $this->postJson('/api/customer/shipments', $payload);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['sender_details.country']);
    }

    public function test_two_letter_country_code_passes_request_validation(): void
    {
        $this->mock(FedExClient::class, function ($mock): void {
            $mock->shouldReceive('createShipment')
                ->once()
                ->andReturn([
                    'tracking_number' => 'MOCK-AB',
                    'label_base64' => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                    'fedex_response' => ['mock' => true],
                ]);
        });

        config(['fedex.mode' => 'stub']);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $payload = $this->baseShipmentPayload();
        $payload['sender_details']['country'] = 'AB';
        $payload['receiver_details']['country'] = 'AB';

        $response = $this->postJson('/api/customer/shipments', $payload);

        $response->assertCreated();
    }

    public function test_customer_accepts_lowercase_us_normalized_to_uppercase(): void
    {
        $this->mock(FedExClient::class, function ($mock): void {
            $mock->shouldReceive('createShipment')
                ->once()
                ->andReturn([
                    'tracking_number' => 'MOCK-1',
                    'label_base64' => 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
                    'fedex_response' => ['mock' => true],
                ]);
        });

        config(['fedex.mode' => 'stub']);

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $payload = $this->baseShipmentPayload();
        $payload['sender_details']['country'] = 'us';
        $payload['receiver_details']['country'] = 'us';

        $response = $this->postJson('/api/customer/shipments', $payload);

        $response->assertCreated();
    }

    public function test_admin_rejects_invalid_receiver_country(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($admin);

        $payload = $this->baseShipmentPayload();
        $payload['user_id'] = $customer->id;
        $payload['receiver_details']['country'] = 'X';

        $response = $this->postJson('/api/admin/shipments', $payload);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['receiver_details.country']);
    }

    public function test_fedex_address_resolve_http_400_returns_422_with_fedex_payload(): void
    {
        config([
            'fedex.mode' => 'rest',
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
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
            if (str_contains($url, '/address/v1/addresses/resolve')) {
                return Http::response([
                    'transactionId' => 'fedex-tx-400',
                    'errors' => [
                        [
                            'code' => 'INVALID.INPUT',
                            'message' => 'Invalid address payload from FedEx test.',
                        ],
                    ],
                ], 400);
            }

            return Http::response(['errors' => [['message' => 'unexpected '.$url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/customer/shipments', $this->baseShipmentPayload());

        $response->assertStatus(422)
            ->assertJsonPath('fedex_http_status', 400)
            ->assertJsonPath('message', 'Invalid address payload from FedEx test.')
            ->assertJsonPath('transaction_id', 'fedex-tx-400')
            ->assertJsonPath('fedex_errors.0.code', 'INVALID.INPUT');
    }

    public function test_fedex_address_resolve_400_with_empty_errors_includes_response_preview(): void
    {
        config([
            'fedex.mode' => 'rest',
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
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
            if (str_contains($url, '/address/v1/addresses/resolve')) {
                return Http::response([
                    'transactionId' => 'fedex-tx-empty-err',
                    'errors' => [],
                    'note' => 'FedEx sometimes omits error objects',
                ], 400);
            }

            return Http::response(['errors' => [['message' => 'unexpected '.$url]]], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/customer/shipments', $this->baseShipmentPayload());

        $response->assertStatus(422)
            ->assertJsonPath('fedex_http_status', 400)
            ->assertJsonPath('transaction_id', 'fedex-tx-empty-err')
            ->assertJsonPath('fedex_errors', [])
            ->assertJsonStructure(['fedex_response_preview'])
            ->assertJsonPath('message', 'FedEx address validation request failed (HTTP 400).');
    }

    public function test_fedex_virtual_response_code_maps_to_helpful_message(): void
    {
        config([
            'fedex.mode' => 'rest',
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
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
            if (str_contains($url, '/address/v1/addresses/resolve')) {
                return Http::response([
                    'transactionId' => 'fedex-virtual',
                    'errors' => [
                        [
                            'code' => 'VIRTUAL.RESPONSE',
                            'message' => 'This is a Virtual Response.',
                        ],
                    ],
                ], 400);
            }

            return Http::response([], 500);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/customer/shipments', $this->baseShipmentPayload());

        $response->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'VIRTUAL.RESPONSE');

        $msg = (string) $response->json('message');
        $this->assertStringNotContainsString('This is a Virtual Response.', $msg);
        $this->assertStringContainsString('virtualized', $msg);
    }
}

<?php

namespace Tests\Feature\Api;

use App\Contracts\FedEx\FedExClient;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerShipmentStoreTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_persists_tracking_number_and_label_url_with_fedex_client_mock(): void
    {
        $pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

        $this->mock(FedExClient::class, function ($mock) use ($pngBase64): void {
            $mock->shouldReceive('createShipment')
                ->once()
                ->andReturn([
                    'tracking_number' => 'MOCK-FX-TRACK-001',
                    'label_base64' => $pngBase64,
                    'fedex_response' => [
                        'mock' => true,
                        'source' => 'FedExClient_test_double',
                    ],
                ]);
        });

        $user = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/customer/shipments', $this->validCustomerShipmentPayload());

        $response->assertCreated()
            ->assertJsonPath('data.tracking_number', 'MOCK-FX-TRACK-001');

        $this->assertNotEmpty($response->json('data.label_url'));

        $this->assertDatabaseHas('shipments', [
            'user_id' => $user->id,
            'tracking_number' => 'MOCK-FX-TRACK-001',
        ]);

        $shipment = Shipment::query()->where('user_id', $user->id)->firstOrFail();
        $this->assertSame('MOCK-FX-TRACK-001', $shipment->tracking_number);
        $this->assertNotNull($shipment->label_url);
        $this->assertNotSame('', $shipment->label_url);
    }

    /**
     * @return array<string, mixed>
     */
    private function validCustomerShipmentPayload(): array
    {
        return [
            'sender_details' => [
                'name' => 'Sender',
                'street1' => '1 Main St',
                'city' => 'Memphis',
                'state' => 'TN',
                'postalCode' => '38101',
                'country' => 'US',
                'phone' => '9015551212',
            ],
            'receiver_details' => [
                'name' => 'Receiver',
                'street1' => '2 Oak Ave',
                'city' => 'Nashville',
                'state' => 'TN',
                'postalCode' => '37203',
                'country' => 'US',
                'phone' => '6155551212',
            ],
            'package_details' => [
                'weightLb' => 2.5,
                'lengthIn' => 10,
                'widthIn' => 8,
                'heightIn' => 4,
                'description' => 'Books',
            ],
        ];
    }
}

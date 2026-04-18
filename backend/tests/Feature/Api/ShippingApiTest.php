<?php

namespace Tests\Feature\Api;

use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShippingApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_for_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'password',
            'role' => 'customer',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role']]);
        $this->assertEquals($user->id, $response->json('user.id'));
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'login@example.com',
            'password' => 'password',
            'role' => 'customer',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(401)->assertJson(['message' => 'Invalid credentials.']);
    }

    public function test_customer_cannot_list_admin_users(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);

        Sanctum::actingAs($customer);

        $response = $this->getJson('/api/admin/users');

        $response->assertStatus(403);
    }

    public function test_customer_cannot_view_another_users_shipment(): void
    {
        $a = User::factory()->create(['role' => 'customer']);
        $b = User::factory()->create(['role' => 'customer']);
        $shipment = Shipment::query()->create([
            'user_id' => $b->id,
            'tracking_number' => 'FX-TEST-1',
            'sender_details' => ['name' => 'S', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'receiver_details' => ['name' => 'R', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1'],
            'package_details' => ['weightLb' => 1, 'lengthIn' => 1, 'widthIn' => 1, 'heightIn' => 1, 'description' => 'x'],
            'status' => 'pending',
            'label_url' => null,
            'fedex_response' => [],
        ]);

        Sanctum::actingAs($a);

        $response = $this->getJson('/api/customer/shipments/'.$shipment->id);

        $response->assertStatus(403);
    }
}

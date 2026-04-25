<?php

namespace Tests\Feature\Api;

use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminShipmentDestroyAndUpdateTest extends TestCase
{
    use RefreshDatabase;

    private function makeShipmentFor(User $owner): Shipment
    {
        return Shipment::query()->create([
            'user_id' => $owner->id,
            'tracking_number' => 'FX-ADM-1',
            'sender_details' => ['name' => 'S', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1234567890'],
            'receiver_details' => ['name' => 'R', 'street1' => '1', 'city' => 'c', 'state' => 's', 'postalCode' => '1', 'country' => 'US', 'phone' => '1234567890'],
            'package_details' => ['weightLb' => 1, 'lengthIn' => 1, 'widthIn' => 1, 'heightIn' => 1, 'description' => 'x'],
            'status' => 'pending',
            'label_url' => null,
            'label_path' => null,
            'fedex_response' => [],
        ]);
    }

    public function test_admin_can_delete_shipment(): void
    {
        Storage::fake('labels');

        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        $shipment = $this->makeShipmentFor($customer);
        $shipment->label_path = 'labels/test.pdf';
        $shipment->save();
        Storage::disk('labels')->put('labels/test.pdf', '%PDF-1.4 fake');

        Sanctum::actingAs($admin);

        $response = $this->deleteJson('/api/admin/shipments/'.$shipment->id);

        $response->assertStatus(204);
        $this->assertDatabaseMissing('shipments', ['id' => $shipment->id]);
        Storage::disk('labels')->assertMissing('labels/test.pdf');
    }

    public function test_customer_cannot_delete_shipment_via_admin_route(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        $other = User::factory()->create(['role' => 'customer']);
        $shipment = $this->makeShipmentFor($other);

        Sanctum::actingAs($customer);

        $response = $this->deleteJson('/api/admin/shipments/'.$shipment->id);

        $response->assertStatus(403);
        $this->assertDatabaseHas('shipments', ['id' => $shipment->id]);
    }

    public function test_admin_can_patch_shipment_owner_and_status(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $a = User::factory()->create(['role' => 'customer']);
        $b = User::factory()->create(['role' => 'customer']);
        $shipment = $this->makeShipmentFor($a);

        Sanctum::actingAs($admin);

        $response = $this->patchJson('/api/admin/shipments/'.$shipment->id, [
            'user_id' => $b->id,
            'status' => 'delivered',
        ]);

        $response->assertOk();
        $shipment->refresh();
        $this->assertSame($b->id, $shipment->user_id);
        $this->assertSame('delivered', $shipment->status);
    }
}

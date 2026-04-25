<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_fetch_profile(): void
    {
        $this->getJson('/api/user/profile')->assertUnauthorized();
    }

    public function test_authenticated_customer_can_fetch_profile(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
            'address_saved' => false,
        ]);
        Sanctum::actingAs($user);

        $this->getJson('/api/user/profile')
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('email', $user->email)
            ->assertJsonPath('has_address', false);
    }

    public function test_admin_can_fetch_profile(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);

        $this->getJson('/api/user/profile')
            ->assertOk()
            ->assertJsonPath('role', 'admin');
    }

    public function test_customer_save_address_persists_and_clears_verification(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
            'address_fedex_verified' => true,
            'address_verified_at' => now(),
        ]);
        Sanctum::actingAs($user);

        $payload = [
            'name' => 'Jane Customer',
            'phone' => '9015551212',
            'company' => 'Acme Co',
            'street' => '1 Main St',
            'street2' => 'Suite 2',
            'city' => 'Memphis',
            'state' => 'tn',
            'postal_code' => '38101',
            'country' => 'us',
        ];

        $response = $this->postJson('/api/user/profile/save-address', $payload);
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('profile.has_address', true)
            ->assertJsonPath('profile.address_saved', true)
            ->assertJsonPath('profile.address_fedex_verified', false);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Jane Customer',
            'address_street' => '1 Main St',
            'address_state' => 'TN',
            'address_saved' => true,
        ]);
    }

    public function test_customer_save_personal_without_address(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
            'name' => 'Old',
            'phone' => '9015550000',
            'address_street' => null,
            'address_saved' => false,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/user/profile/save-personal', [
            'name' => 'Pat Customer',
            'phone' => '9015551212',
            'company' => 'Solo',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('profile.name', 'Pat Customer')
            ->assertJsonPath('profile.has_address', false);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'name' => 'Pat Customer',
            'phone' => '9015551212',
        ]);
    }

    public function test_admin_cannot_post_save_personal(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);

        $this->postJson('/api/user/profile/save-personal', [
            'name' => 'A',
            'phone' => '9015551212',
            'company' => null,
        ])->assertForbidden();
    }

    public function test_admin_cannot_post_save_address(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($user);

        $this->postJson('/api/user/profile/save-address', [
            'name' => 'Admin',
            'phone' => '9015551212',
            'street' => '1 Main St',
            'city' => 'Memphis',
            'state' => 'TN',
            'postal_code' => '38101',
            'country' => 'US',
        ])->assertForbidden();
    }

    public function test_verify_address_requires_saved_address_first(): void
    {
        $user = User::factory()->create([
            'role' => 'customer',
            'address_street' => null,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/user/profile/verify-address', [])
            ->assertStatus(422)
            ->assertJsonPath('verified', false);
    }

    public function test_verify_address_sandbox_marks_verified(): void
    {
        config(['fedex.env' => 'sandbox']);

        $user = User::factory()->create([
            'role' => 'customer',
            'address_street' => '1 Main St',
            'address_city' => 'Memphis',
            'address_state' => 'TN',
            'address_postal_code' => '38101',
            'address_country' => 'US',
            'address_saved' => true,
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/user/profile/verify-address', [])
            ->assertOk()
            ->assertJsonPath('verified', true)
            ->assertJsonPath('sandbox_skipped', true)
            ->assertJsonPath('profile.address_fedex_verified', true);
    }
}

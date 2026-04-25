<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthRegisterTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_customer_and_returns_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'password' => 'password-12',
            'password_confirmation' => 'password-12',
            'phone' => '5551234567',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'name', 'role', 'phone']])
            ->assertJsonPath('user.role', 'customer')
            ->assertJsonPath('user.email', 'newuser@example.com')
            ->assertJsonPath('user.name', 'New User')
            ->assertJsonPath('user.phone', '5551234567');

        $this->assertDatabaseHas('users', [
            'email' => 'newuser@example.com',
            'role' => 'customer',
        ]);
    }

    public function test_register_rejects_invalid_phone(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'New User',
            'email' => 'bademail@example.com',
            'password' => 'password-12',
            'password_confirmation' => 'password-12',
            'phone' => 'not-a-valid-phone!@#',
        ]);

        $response->assertUnprocessable();
    }

    public function test_register_maps_company_to_address_company(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'ACME',
            'email' => 'acme@example.com',
            'password' => 'password-12',
            'password_confirmation' => 'password-12',
            'phone' => '5550001111',
            'company' => 'ACME Corp',
        ])->assertCreated();

        $u = User::query()->where('email', 'acme@example.com')->first();
        $this->assertNotNull($u);
        $this->assertSame('ACME Corp', $u->address_company);
    }
}

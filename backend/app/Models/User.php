<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'email',
    'password',
    'role',
    'address_street',
    'address_street2',
    'address_city',
    'address_state',
    'address_postal_code',
    'address_country',
    'address_company',
    'phone',
    'address_saved',
    'address_fedex_verified',
    'address_saved_at',
    'address_verified_at',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'address_saved' => 'boolean',
            'address_fedex_verified' => 'boolean',
            'address_saved_at' => 'datetime',
            'address_verified_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function hasAddress(): bool
    {
        return ! empty($this->address_street)
            && ! empty($this->address_city)
            && ! empty($this->address_state)
            && ! empty($this->address_postal_code);
    }

    /**
     * @return array{contact: array{personName: string, phoneNumber: string, companyName: string}, address: array{streetLines: array<int, string>, city: ?string, stateOrProvinceCode: ?string, postalCode: ?string, countryCode: string}}
     */
    public function toShipperArray(): array
    {
        return [
            'contact' => [
                'personName' => $this->name,
                'phoneNumber' => $this->phone ?? '',
                'companyName' => $this->address_company ?? $this->name,
            ],
            'address' => [
                'streetLines' => array_values(array_filter([
                    $this->address_street,
                    $this->address_street2,
                ], fn ($s) => is_string($s) && $s !== '')),
                'city' => $this->address_city,
                'stateOrProvinceCode' => $this->address_state,
                'postalCode' => $this->address_postal_code,
                'countryCode' => $this->address_country ?? 'US',
            ],
        ];
    }

    /**
     * @return array{streetLines: array<int, string>, city: ?string, stateOrProvinceCode: ?string, postalCode: ?string, countryCode: string}
     */
    public function getShippingAddressArray(): array
    {
        return $this->toShipperArray()['address'];
    }

    /**
     * @return array{personName: string, phoneNumber: string, companyName: string}
     */
    public function getShipperContactArray(): array
    {
        return $this->toShipperArray()['contact'];
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(Shipment::class);
    }
}

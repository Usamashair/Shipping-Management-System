<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'phone' => $this->phone,
            'address_street' => $this->address_street,
            'address_street2' => $this->address_street2,
            'address_city' => $this->address_city,
            'address_state' => $this->address_state,
            'address_postal_code' => $this->address_postal_code,
            'address_country' => $this->address_country ?? 'US',
            'address_company' => $this->address_company,
            'address_saved' => (bool) $this->address_saved,
            'address_fedex_verified' => (bool) $this->address_fedex_verified,
            'address_saved_at' => $this->address_saved_at?->toIso8601String(),
            'address_verified_at' => $this->address_verified_at?->toIso8601String(),
            'has_address' => $this->resource instanceof User ? $this->resource->hasAddress() : false,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}

<?php

namespace App\Policies;

use App\Models\Shipment;
use App\Models\User;

class ShipmentPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->isAdmin();
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['admin', 'customer'], true);
    }

    public function view(User $user, Shipment $shipment): bool
    {
        return $user->isAdmin() || $shipment->user_id === $user->id;
    }

    public function track(User $user, Shipment $shipment): bool
    {
        return $this->view($user, $shipment);
    }

    public function updateStatus(User $user, Shipment $shipment): bool
    {
        return $user->isAdmin();
    }
}

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

    public function update(User $user, Shipment $shipment): bool
    {
        return $user->isAdmin();
    }

    public function delete(User $user, Shipment $shipment): bool
    {
        return $user->isAdmin();
    }

    public function cancel(User $user, Shipment $shipment): bool
    {
        if (! $this->shipmentIsFedexCancellable($shipment)) {
            return false;
        }

        return $user->isAdmin() || $shipment->user_id === $user->id;
    }

    /**
     * FedEx cancel API only applies before tender; align with statuses we persist pre-delivery.
     */
    private function shipmentIsFedexCancellable(Shipment $shipment): bool
    {
        return in_array($shipment->status, ['label_created', 'pending', 'in_transit'], true);
    }

    public function downloadLabel(User $user, Shipment $shipment): bool
    {
        return $user->isAdmin() || $shipment->user_id === $user->id;
    }
}

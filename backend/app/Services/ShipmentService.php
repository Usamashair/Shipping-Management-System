<?php

namespace App\Services;

use App\Contracts\FedEx\FedExClient;
use App\Models\Shipment;
use App\Models\TrackingLog;
use App\Models\User;
use App\Services\FedEx\FedExStatusMapper;
use Illuminate\Support\Facades\Storage;

class ShipmentService
{
    public function __construct(
        protected FedExClient $fedEx,
        protected FedExStatusMapper $statusMapper,
    ) {}

    /**
     * @param  array<string, mixed>  $sender
     * @param  array<string, mixed>  $receiver
     * @param  array<string, mixed>  $package
     */
    public function createForUser(User $user, array $sender, array $receiver, array $package): Shipment
    {
        $result = $this->fedEx->createShipment($sender, $receiver, $package);

        $shipment = Shipment::query()->create([
            'user_id' => $user->id,
            'tracking_number' => $result['tracking_number'],
            'sender_details' => $sender,
            'receiver_details' => $receiver,
            'package_details' => $package,
            'status' => 'pending',
            'label_url' => null,
            'fedex_response' => $result['fedex_response'],
        ]);

        $relative = $this->storeLabelFile($shipment->id, $result['label_base64']);
        $shipment->label_url = Storage::disk('public')->url($relative);
        $shipment->status = 'in_transit';
        $shipment->save();

        TrackingLog::query()->create([
            'shipment_id' => $shipment->id,
            'status' => 'Label created (stub)',
            'location' => ($sender['city'] ?? 'Origin').', '.($sender['state'] ?? ''),
            'logged_at' => now(),
            'raw_response' => ['mock' => true, 'phase' => 'create'],
        ]);

        return $shipment->fresh(['trackingLogs']);
    }

    public function trackAndLog(Shipment $shipment): Shipment
    {
        $result = $this->fedEx->track($shipment->tracking_number);

        TrackingLog::query()->create([
            'shipment_id' => $shipment->id,
            'status' => $result['status'],
            'location' => $result['location'],
            'logged_at' => now(),
            'raw_response' => $result['raw_response'],
        ]);

        if (! empty($result['mapped_status'])) {
            $shipment->status = $this->statusMapper->toInternal($result['mapped_status']);
            $shipment->save();
        }

        return $shipment->fresh(['trackingLogs']);
    }

    private function storeLabelFile(int $shipmentId, string $labelBase64): string
    {
        $binary = base64_decode($labelBase64, true) ?: '';
        $relative = 'labels/shipment-'.$shipmentId.'.png';
        Storage::disk('public')->put($relative, $binary);

        return $relative;
    }
}

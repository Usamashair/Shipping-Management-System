<?php

namespace App\Services;

use App\Contracts\FedEx\FedExClient;
use App\Models\Shipment;
use App\Models\TrackingLog;
use App\Models\User;
use App\Services\FedEx\FedExShipmentCreateService;
use App\Services\FedEx\FedExStatusMapper;
use App\Services\FedEx\LegacyShipmentDetailsToFedExShipMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ShipmentService
{
    public function __construct(
        protected FedExClient $fedEx,
        protected FedExStatusMapper $statusMapper,
        protected LegacyShipmentDetailsToFedExShipMapper $legacyToFedExMapper,
        protected FedExShipmentCreateService $fedExShipmentCreate,
    ) {}

    /**
     * Legacy JSON shape (admin/customer POST) mapped to FedEx Ship via {@see LegacyShipmentDetailsToFedExShipMapper},
     * then {@see FedExShipmentCreateService::create}. When FEDEX_ENV=sandbox, FedEx pre-flight (Address, Rate, validate) is skipped or no-op; Ship create uses a virtualized sample.
     *
     * @param  array<string, mixed>  $sender
     * @param  array<string, mixed>  $receiver
     * @param  array<string, mixed>  $package
     */
    public function createForUser(User $user, array $sender, array $receiver, array $package): Shipment
    {
        if (config('fedex.mode') === 'rest' && FedExShipmentCreateService::isConfigured()) {
            $fedexPayload = $this->legacyToFedExMapper->toFedExShipPayload($sender, $receiver, $package);
            $shipment = $this->fedExShipmentCreate->create($user, $fedexPayload, true);

            TrackingLog::query()->create([
                'shipment_id' => $shipment->id,
                'status' => 'Label created (FedEx Ship)',
                'location' => ($sender['city'] ?? 'Origin').', '.($sender['state'] ?? ''),
                'logged_at' => now(),
                'raw_response' => [
                    'phase' => 'create',
                    'fedex_transaction_id' => $shipment->fedex_transaction_id,
                ],
            ]);

            return $shipment->fresh(['trackingLogs']);
        }

        $this->logFedExStubFallbackIfDebug();

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

    /**
     * When FEDEX_MODE is not rest or OAuth credentials are missing, legacy creates use StubFedExClient
     * (FX-STUB-* tracking, no FedEx Ship API). Log the reason in local/debug so misconfiguration is obvious.
     */
    private function logFedExStubFallbackIfDebug(): void
    {
        if (! config('app.debug') && ! app()->isLocal()) {
            return;
        }

        $reasons = [];
        if (config('fedex.mode') !== 'rest') {
            $reasons[] = 'FEDEX_MODE is not "rest" (current: '.(string) config('fedex.mode').')';
        }
        if (! filled(config('fedex.client_id'))) {
            $reasons[] = 'FEDEX_CLIENT_ID is empty';
        }
        if (! filled(config('fedex.client_secret'))) {
            $reasons[] = 'FEDEX_CLIENT_SECRET is empty';
        }
        if (! filled(config('fedex.account_number'))) {
            $reasons[] = 'FEDEX_ACCOUNT_NUMBER is empty';
        }

        Log::warning(
            'Shipment create using stub FedEx (no live tracking). Set FEDEX_MODE=rest and OAuth credentials, then php artisan config:clear.',
            ['reasons' => $reasons]
        );
    }
}

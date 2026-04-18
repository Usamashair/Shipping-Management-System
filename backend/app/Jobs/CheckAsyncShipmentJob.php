<?php

namespace App\Jobs;

use App\Models\Shipment;
use App\Services\FedEx\FedExShipApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class CheckAsyncShipmentJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    private const MAX_POLLS = 120;

    private const POLL_DELAY_SECONDS = 30;

    public function __construct(
        public int $shipmentId,
        public int $pollCount = 0,
    ) {}

    public function handle(FedExShipApiService $fedEx): void
    {
        $shipment = Shipment::query()->find($this->shipmentId);
        if ($shipment === null || $shipment->fedex_job_id === null || $shipment->fedex_job_id === '') {
            return;
        }

        if ($shipment->label_path !== null && $shipment->label_path !== '') {
            return;
        }

        if ($shipment->label_url !== null && $shipment->label_url !== '') {
            return;
        }

        try {
            $json = $fedEx->retrieveAsyncShipment($shipment->fedex_job_id);
        } catch (Throwable $e) {
            Log::warning('CheckAsyncShipmentJob: retrieve async shipment failed.', [
                'shipment_id' => $this->shipmentId,
                'message' => $e->getMessage(),
            ]);
            $this->rescheduleIfBelowLimit();

            return;
        }

        $parsed = $fedEx->parseShipmentCreateOrAsyncResult($json);
        $labelUrl = $parsed['labelUrl'] ?? null;
        $labelBase64 = $parsed['labelBase64'] ?? null;
        $hasLabel = ($labelUrl !== null && $labelUrl !== '')
            || ($labelBase64 !== null && $labelBase64 !== '');

        if ($hasLabel) {
            $tracking = $parsed['trackingNumber'] ?? $shipment->tracking_number;
            if ($tracking !== null && $tracking !== '') {
                $shipment->tracking_number = $tracking;
                $shipment->fedex_tracking_number = $tracking;
            }

            $shipment->fedex_response = $json;

            if ($labelBase64 !== null && $labelBase64 !== '') {
                $binary = base64_decode((string) $labelBase64, true) ?: '';
                $relative = $shipment->id.'.pdf';
                Storage::disk('labels')->put($relative, $binary);
                $shipment->label_path = $relative;
                $shipment->label_url = null;
            } elseif ($labelUrl !== null && $labelUrl !== '') {
                $shipment->label_url = $labelUrl;
                $shipment->label_path = null;
            }

            $shipment->status = 'label_created';
            $shipment->save();

            return;
        }

        $this->rescheduleIfBelowLimit();
    }

    private function rescheduleIfBelowLimit(): void
    {
        if ($this->pollCount + 1 >= self::MAX_POLLS) {
            Log::notice('CheckAsyncShipmentJob: max polls reached without label.', [
                'shipment_id' => $this->shipmentId,
            ]);

            return;
        }

        self::dispatch($this->shipmentId, $this->pollCount + 1)
            ->delay(now()->addSeconds(self::POLL_DELAY_SECONDS));
    }
}

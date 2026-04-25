<?php

namespace App\Services\FedEx;

use App\Models\Shipment;
use App\Models\TrackingLog;
use Illuminate\Support\Facades\Log;

/**
 * Applies FedEx Tracking Webhook payloads to local {@see Shipment} rows by tracking number.
 * Payload shape may vary; extraction tries several common paths aligned with Track API output.
 */
class FedExTrackingWebhookProcessor
{
    public function __construct(
        private readonly FedExStatusMapper $statusMapper,
    ) {}

    /**
     * @param  array<string, mixed>  $payload  Decoded JSON body
     */
    public function process(array $payload, string $rawBody): void
    {
        $trackingNumbers = $this->extractTrackingNumbers($payload);
        $statusText = $this->extractStatusText($payload);
        $location = $this->extractLocation($payload);

        if ($statusText === '') {
            $statusText = 'FedEx tracking update (webhook)';
        }

        $mapped = FedExWebhookEventMapper::guessMappedStatus($statusText, $payload);

        $logPayload = $this->buildLogPayload($payload, $rawBody);

        if ($trackingNumbers === []) {
            Log::info('FedEx webhook: no tracking number extracted.', [
                'payload_keys' => array_keys($payload),
            ]);

            return;
        }

        foreach ($trackingNumbers as $tn) {
            $tn = trim($tn);
            if ($tn === '') {
                continue;
            }

            $shipment = Shipment::query()
                ->where(function ($q) use ($tn): void {
                    $q->where('tracking_number', $tn)
                        ->orWhere('fedex_tracking_number', $tn);
                })
                ->first();

            if ($shipment === null) {
                Log::info('FedEx webhook: shipment not found for tracking number.', ['tracking_number' => $tn]);

                continue;
            }

            TrackingLog::query()->create([
                'shipment_id' => $shipment->id,
                'status' => $statusText,
                'location' => $location,
                'logged_at' => now(),
                'raw_response' => $logPayload,
            ]);

            if ($mapped !== null) {
                $shipment->status = $this->statusMapper->toInternal($mapped);
                $shipment->save();
            }
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<int, string>
     */
    private function extractTrackingNumbers(array $payload): array
    {
        $out = [];

        $push = function (mixed $v) use (&$out): void {
            if (is_string($v) && trim($v) !== '') {
                $out[] = trim($v);
            }
        };

        $push($payload['trackingNumber'] ?? null);
        $push($payload['masterTrackingNumber'] ?? null);

        $output = $payload['output'] ?? null;
        if (is_array($output)) {
            $this->collectTrackingFromTrackContainer($output, $out);
        }

        $this->collectTrackingFromTrackContainer($payload, $out);

        return array_values(array_unique($out));
    }

    /**
     * @param  array<string, mixed>  $root
     * @param  array<int, string>  $out
     */
    private function collectTrackingFromTrackContainer(array $root, array &$out): void
    {
        $complete = $root['completeTrackResults'] ?? null;
        if (! is_array($complete)) {
            return;
        }

        foreach ($complete as $item) {
            if (! is_array($item)) {
                continue;
            }
            $trackResults = $item['trackResults'] ?? null;
            if (! is_array($trackResults)) {
                continue;
            }
            foreach ($trackResults as $tr) {
                if (! is_array($tr)) {
                    continue;
                }
                $info = $tr['trackingNumberInfo'] ?? null;
                if (is_array($info) && isset($info['trackingNumber']) && is_string($info['trackingNumber'])) {
                    $out[] = trim($info['trackingNumber']);
                }
            }
        }

        $trackResults = $root['trackResults'] ?? null;
        if (is_array($trackResults)) {
            foreach ($trackResults as $tr) {
                if (! is_array($tr)) {
                    continue;
                }
                $info = $tr['trackingNumberInfo'] ?? null;
                if (is_array($info) && isset($info['trackingNumber']) && is_string($info['trackingNumber'])) {
                    $out[] = trim($info['trackingNumber']);
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function extractStatusText(array $payload): string
    {
        $output = $payload['output'] ?? $payload;
        if (! is_array($output)) {
            return '';
        }

        $complete = $output['completeTrackResults'][0] ?? null;
        $trackResults = is_array($complete) ? ($complete['trackResults'][0] ?? null) : null;
        if (! is_array($trackResults)) {
            $trackResults = $output['trackResults'][0] ?? null;
        }

        if (! is_array($trackResults)) {
            return '';
        }

        $latest = $trackResults['latestStatusDetail'] ?? null;
        if (is_array($latest)) {
            $text = (string) ($latest['description'] ?? $latest['statusByLocale'] ?? '');
            if ($text !== '') {
                return $text;
            }
        }

        $scanEvents = $trackResults['scanEvents'] ?? null;
        if (is_array($scanEvents) && isset($scanEvents[0]) && is_array($scanEvents[0])) {
            $ev = $scanEvents[0];
            $text = (string) ($ev['eventDescription'] ?? $ev['derivedStatus'] ?? '');
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function extractLocation(array $payload): string
    {
        $output = $payload['output'] ?? $payload;
        if (! is_array($output)) {
            return '';
        }

        $complete = $output['completeTrackResults'][0] ?? null;
        $trackResults = is_array($complete) ? ($complete['trackResults'][0] ?? null) : null;
        if (! is_array($trackResults)) {
            $trackResults = $output['trackResults'][0] ?? null;
        }

        if (! is_array($trackResults)) {
            return '';
        }

        $latest = $trackResults['latestStatusDetail'] ?? null;
        if (is_array($latest) && is_array($latest['scanLocation'] ?? null)) {
            $loc = $latest['scanLocation'];

            return $this->formatScanLocation($loc);
        }

        $scanEvents = $trackResults['scanEvents'] ?? null;
        if (is_array($scanEvents) && isset($scanEvents[0]) && is_array($scanEvents[0])) {
            $loc = $scanEvents[0]['scanLocation'] ?? null;
            if (is_array($loc)) {
                return $this->formatScanLocation($loc);
            }
        }

        return '';
    }

    /**
     * @param  array<string, mixed>  $loc
     */
    private function formatScanLocation(array $loc): string
    {
        return trim(implode(', ', array_filter([
            isset($loc['city']) ? (string) $loc['city'] : null,
            isset($loc['stateOrProvinceCode']) ? (string) $loc['stateOrProvinceCode'] : null,
            isset($loc['countryCode']) ? (string) $loc['countryCode'] : null,
        ])));
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function buildLogPayload(array $payload, string $rawBody): array
    {
        $max = 65535;
        if (strlen($rawBody) > $max) {
            return [
                'source' => 'webhook',
                'truncated' => true,
                'payload_preview' => substr($rawBody, 0, $max),
            ];
        }

        return [
            'source' => 'webhook',
            'payload' => $payload,
        ];
    }
}

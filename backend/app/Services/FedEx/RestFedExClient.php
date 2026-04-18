<?php

namespace App\Services\FedEx;

use App\Contracts\FedEx\FedExClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class RestFedExClient implements FedExClient
{
    public function __construct(
        private readonly StubFedExClient $stubLabels,
    ) {}

    /**
     * {@inheritdoc}
     *
     * Live FedEx Ship requests need extra account and payload fields; until those are
     * configured end-to-end, labels continue to come from {@see StubFedExClient}.
     */
    public function createShipment(
        array $senderDetails,
        array $receiverDetails,
        array $packageDetails,
    ): array {
        $result = $this->stubLabels->createShipment($senderDetails, $receiverDetails, $packageDetails);
        $fedex = $result['fedex_response'];
        $fedex['mode'] = 'rest';
        $fedex['create_shipment'] = 'stub_delegate';

        return [
            'tracking_number' => $result['tracking_number'],
            'label_base64' => $result['label_base64'],
            'fedex_response' => $fedex,
        ];
    }

    /**
     * {@inheritdoc}
     */
    public function track(string $trackingNumber): array
    {
        $token = $this->accessToken();
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);

        $response = Http::timeout($timeout)
            ->asJson()
            ->withToken($token)
            ->post($base.'/track/v1/trackingnumbers', [
                'includeDetailedScans' => true,
                'trackingInfo' => [
                    [
                        'trackingNumberInfo' => [
                            'trackingNumber' => $trackingNumber,
                        ],
                    ],
                ],
            ]);

        $body = $response->json() ?? [];

        if (! $response->successful()) {
            return [
                'status' => 'FedEx track error (HTTP '.$response->status().')',
                'location' => '',
                'raw_response' => array_merge($body, [
                    'http_status' => $response->status(),
                    'queried_tracking_number' => $trackingNumber,
                ]),
            ];
        }

        return $this->normalizeTrackResponse($body, $trackingNumber);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array{status: string, location: string, raw_response: array<string, mixed>, mapped_status?: string}
     */
    private function normalizeTrackResponse(array $body, string $trackingNumber): array
    {
        $output = $body['output'] ?? $body;
        $complete = $output['completeTrackResults'][0] ?? null;
        $trackResults = is_array($complete) ? ($complete['trackResults'][0] ?? null) : null;

        if (! is_array($trackResults)) {
            return [
                'status' => 'No tracking results',
                'location' => '',
                'raw_response' => array_merge($body, ['queried_tracking_number' => $trackingNumber]),
            ];
        }

        $latest = is_array($trackResults['latestStatusDetail'] ?? null)
            ? $trackResults['latestStatusDetail']
            : [];

        $statusText = (string) ($latest['description'] ?? $latest['statusByLocale'] ?? 'Unknown');

        $location = '';
        $scanEvents = $trackResults['scanEvents'] ?? [];
        if (is_array($scanEvents) && isset($scanEvents[0]) && is_array($scanEvents[0])) {
            $scan = $scanEvents[0];
            $loc = is_array($scan['scanLocation'] ?? null) ? $scan['scanLocation'] : [];
            $location = trim(implode(', ', array_filter([
                isset($loc['city']) ? (string) $loc['city'] : null,
                isset($loc['stateOrProvinceCode']) ? (string) $loc['stateOrProvinceCode'] : null,
                isset($loc['countryCode']) ? (string) $loc['countryCode'] : null,
            ])));
        }

        if ($location === '' && is_array($latest['scanLocation'] ?? null)) {
            $loc = $latest['scanLocation'];
            $location = trim(implode(', ', array_filter([
                isset($loc['city']) ? (string) $loc['city'] : null,
                isset($loc['stateOrProvinceCode']) ? (string) $loc['stateOrProvinceCode'] : null,
            ])));
        }

        $mapped = $this->guessMappedStatus($latest, $trackResults);

        $out = [
            'status' => $statusText,
            'location' => $location,
            'raw_response' => array_merge($body, ['queried_tracking_number' => $trackingNumber]),
        ];

        if ($mapped !== null) {
            $out['mapped_status'] = $mapped;
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $latest
     * @param  array<string, mixed>  $trackResults
     */
    private function guessMappedStatus(array $latest, array $trackResults): ?string
    {
        $desc = strtolower((string) ($latest['description'] ?? $latest['statusByLocale'] ?? ''));
        $code = strtoupper((string) ($latest['code'] ?? $latest['derivedCode'] ?? ''));

        if (str_contains($desc, 'deliver') || str_contains($code, 'DL')) {
            return 'delivered';
        }

        if (str_contains($desc, 'exception') || str_contains($desc, 'fail') || str_contains($code, 'EX')) {
            return 'failed';
        }

        $serviceCommit = $trackResults['serviceCommitMessage'] ?? null;
        if (is_string($serviceCommit) && str_contains(strtolower($serviceCommit), 'pending')) {
            return 'pending';
        }

        if ($desc !== '' || $code !== '') {
            return 'in_transit';
        }

        return null;
    }

    private function accessToken(): string
    {
        $ttl = (int) config('fedex.token_cache_seconds', 3300);

        return Cache::remember('fedex.oauth.access_token', max(60, $ttl), function (): string {
            $base = rtrim((string) config('fedex.base_url'), '/');
            $timeout = (int) config('fedex.http_timeout', 30);

            $response = Http::asForm()
                ->timeout($timeout)
                ->post($base.'/oauth/token', [
                    'grant_type' => 'client_credentials',
                    'client_id' => (string) config('fedex.client_id'),
                    'client_secret' => (string) config('fedex.client_secret'),
                ]);

            if (! $response->successful()) {
                throw new RuntimeException('FedEx OAuth failed: HTTP '.$response->status());
            }

            $token = $response->json('access_token');
            if (! is_string($token) || $token === '') {
                throw new RuntimeException('FedEx OAuth response missing access_token.');
            }

            return $token;
        });
    }
}

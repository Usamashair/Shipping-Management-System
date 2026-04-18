<?php

namespace App\Services\FedEx;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class FedExShipApiService
{
    public function __construct(
        private readonly FedExOAuthToken $fedExOAuthToken,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{alerts: array<int, string>, raw: array<string, mixed>, transaction_id: string}
     */
    public function validateShipment(array $data): array
    {
        $transactionId = (string) Str::uuid();
        $body = $this->buildRootPayload($data);

        $json = $this->postJson('/ship/v1/shipments/packages/validate', $body, $transactionId, 'validate');

        return [
            'alerts' => $this->collectShipAlerts($json),
            'raw' => $json,
            'transaction_id' => $transactionId,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{
     *   trackingNumber: string|null,
     *   labelUrl: string|null,
     *   labelBase64: string|null,
     *   serviceType: string|null,
     *   shipTimestamp: string|null,
     *   jobId: string|null,
     *   raw: array<string, mixed>,
     *   transaction_id: string
     * }
     */
    public function createShipment(array $data): array
    {
        $transactionId = (string) Str::uuid();
        $labelMode = (string) config('fedex.ship_label_response', 'URL_ONLY');
        $body = $this->buildRootPayload($data);
        $body['labelResponseOptions'] = $labelMode;
        $body['shipAction'] = 'CONFIRM';
        $body['processingOptionType'] = 'SYNCHRONOUS_ONLY';
        if (strtoupper($labelMode) === 'URL_ONLY') {
            $merge = (string) config('fedex.merge_label_doc_option', 'LABELS_AND_DOCS');
            if (in_array($merge, ['NONE', 'LABELS_AND_DOCS', 'LABELS_ONLY'], true)) {
                $body['mergeLabelDocOption'] = $merge;
            }
        }

        $json = $this->postJson('/ship/v1/shipments', $body, $transactionId, 'create');

        $parsed = $this->parseCreateShipmentOutput($json);

        Log::info('FedEx Ship API', [
            'transaction_id' => $transactionId,
            'tracking' => $parsed['trackingNumber'],
            'job_id' => $parsed['jobId'],
        ]);

        return array_merge($parsed, ['raw' => $json, 'transaction_id' => $transactionId]);
    }

    /**
     * @return array{cancelled: bool, message: string, raw: array<string, mixed>, transaction_id: string}
     */
    public function cancelShipment(string $trackingNumber, string $senderCountryCode = 'US'): array
    {
        $transactionId = (string) Str::uuid();
        $cc = strtoupper(substr(trim($senderCountryCode) !== '' ? $senderCountryCode : 'US', 0, 2));
        $body = [
            'accountNumber' => $this->accountNumberBlock(),
            'trackingNumber' => $trackingNumber,
            'deletionControl' => 'DELETE_ALL_PACKAGES',
            'emailShipment' => false,
            'senderCountryCode' => $cc,
            'version' => $this->versionBlock(),
        ];

        $json = $this->putJson('/ship/v1/shipments/cancel', $body, $transactionId, 'cancel');

        $cancelled = (bool) data_get($json, 'output.cancelledShipment')
            || (bool) data_get($json, 'output.cancelShipmentRequested')
            || ($json['output'] ?? null) === true;

        $message = (string) (data_get($json, 'output.message')
            ?? data_get($json, 'output.customerTransactionId')
            ?? ($cancelled ? 'Shipment cancelled.' : 'Cancellation response received.'));

        return [
            'cancelled' => $cancelled,
            'message' => $message,
            'raw' => $json,
            'transaction_id' => $transactionId,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function retrieveAsyncShipment(string $jobId): array
    {
        $transactionId = (string) Str::uuid();
        $body = [
            'accountNumber' => $this->accountNumberBlock(),
            'jobId' => $jobId,
            'version' => $this->versionBlock(),
        ];

        return $this->postJson('/ship/v1/shipments/results', $body, $transactionId, 'async_results');
    }

    /**
     * Parse a create-shipment or POST /ship/v1/shipments/results payload for tracking and labels.
     *
     * @param  array<string, mixed>  $json
     * @return array{
     *   trackingNumber: string|null,
     *   labelUrl: string|null,
     *   labelBase64: string|null,
     *   serviceType: string|null,
     *   shipTimestamp: string|null,
     *   jobId: string|null
     * }
     */
    public function parseShipmentCreateOrAsyncResult(array $json): array
    {
        return $this->parseCreateShipmentOutput($json);
    }

    /**
     * Create Return Tag (FedEx Ship Tag API).
     *
     * @param  array<string, mixed>  $data
     * @return array{
     *   trackingNumber: string|null,
     *   labelUrl: string|null,
     *   labelBase64: string|null,
     *   serviceType: string|null,
     *   shipTimestamp: string|null,
     *   jobId: string|null,
     *   raw: array<string, mixed>,
     *   transaction_id: string
     * }
     */
    public function createTag(array $data): array
    {
        $transactionId = (string) Str::uuid();
        $body = [
            'accountNumber' => $this->accountNumberBlock(),
            'requestedShipment' => $this->buildRequestedShipment($data),
            'version' => $this->versionBlock(),
        ];

        $json = $this->postJson('/ship/v1/shipments/tag', $body, $transactionId, 'create_tag');
        $parsed = $this->parseCreateTagOutput($json);

        Log::info('FedEx Ship Tag API', [
            'transaction_id' => $transactionId,
            'tracking' => $parsed['trackingNumber'],
        ]);

        return array_merge($parsed, ['raw' => $json, 'transaction_id' => $transactionId]);
    }

    /**
     * @param  array{
     *   serviceType: string,
     *   trackingNumber: string,
     *   completedTagDetail: array{confirmationNumber: string, location: string, dispatchDate: string}
     * }  $payload
     * @return array{cancelled: bool, message: string, raw: array<string, mixed>, transaction_id: string}
     */
    public function cancelTag(string $pathShipmentId, array $payload): array
    {
        $transactionId = (string) Str::uuid();
        $body = [
            'accountNumber' => $this->accountNumberBlock(),
            'serviceType' => $payload['serviceType'],
            'trackingNumber' => $payload['trackingNumber'],
            'completedTagDetail' => $payload['completedTagDetail'],
            'version' => $this->versionBlock(),
        ];

        $path = '/ship/v1/shipments/tag/cancel/'.rawurlencode($pathShipmentId);
        $json = $this->putJson($path, $body, $transactionId, 'cancel_tag');

        $cancelled = (bool) data_get($json, 'output.cancelledTag');
        $message = (string) (data_get($json, 'output.successMessage')
            ?? data_get($json, 'output.message')
            ?? ($cancelled ? 'Tag cancelled.' : 'Tag cancellation response received.'));

        return [
            'cancelled' => $cancelled,
            'message' => $message,
            'raw' => $json,
            'transaction_id' => $transactionId,
        ];
    }

    /**
     * @return array{value: string}
     */
    private function accountNumberBlock(): array
    {
        $value = (string) config('fedex.account_number');
        if ($value === '') {
            throw new RuntimeException('FedEx account number is not configured.');
        }

        return ['value' => $value];
    }

    /**
     * @return array{major: string, minor: string, patch: string}
     */
    private function versionBlock(): array
    {
        $v = config('fedex.ship_api_version', []);
        if (! is_array($v)) {
            $v = [];
        }

        return [
            'major' => (string) ($v['major'] ?? '1'),
            'minor' => (string) ($v['minor'] ?? '1'),
            'patch' => (string) ($v['patch'] ?? '0'),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function buildRootPayload(array $data): array
    {
        $requested = $this->buildRequestedShipment($data);

        return [
            'accountNumber' => $this->accountNumberBlock(),
            'requestedShipment' => $requested,
            'version' => $this->versionBlock(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function buildRequestedShipment(array $data): array
    {
        $packages = $data['packages'] ?? [];
        if (! is_array($packages) || $packages === []) {
            throw new RuntimeException('At least one package is required.');
        }

        $totalLb = 0.0;
        $lineItems = [];
        foreach ($packages as $pkg) {
            if (! is_array($pkg)) {
                continue;
            }
            $w = (float) data_get($pkg, 'weight.value', 0);
            $totalLb += $w;
            $lineItems[] = [
                'weight' => [
                    'units' => (string) (data_get($pkg, 'weight.units') ?: 'LB'),
                    'value' => $w,
                ],
                'dimensions' => [
                    'length' => (int) round((float) data_get($pkg, 'dimensions.length', 0)),
                    'width' => (int) round((float) data_get($pkg, 'dimensions.width', 0)),
                    'height' => (int) round((float) data_get($pkg, 'dimensions.height', 0)),
                    'units' => (string) (data_get($pkg, 'dimensions.units') ?: 'IN'),
                ],
            ];
        }

        $shipper = $this->normalizeParty($data['shipper'] ?? []);
        $recipients = $data['recipients'] ?? [];
        if (! is_array($recipients) || $recipients === []) {
            throw new RuntimeException('At least one recipient is required.');
        }
        $normalizedRecipients = [];
        foreach ($recipients as $r) {
            if (is_array($r)) {
                $normalizedRecipients[] = $this->normalizeParty($r, isRecipient: true, residential: (bool) ($data['is_residential'] ?? false));
            }
        }

        $pickupType = (string) ($data['pickupType'] ?? 'USE_SCHEDULED_PICKUP');

        return [
            'shipDatestamp' => now()->format('Y-m-d'),
            'pickupType' => $pickupType,
            'serviceType' => (string) $data['serviceType'],
            'packagingType' => (string) $data['packagingType'],
            'totalWeight' => [
                'units' => 'LB',
                'value' => $totalLb > 0 ? $totalLb : (float) data_get($packages[0], 'weight.value', 1),
            ],
            'shipper' => $shipper,
            'recipients' => $normalizedRecipients,
            'shippingChargesPayment' => [
                'paymentType' => 'SENDER',
            ],
            'labelSpecification' => [
                'labelFormatType' => 'COMMON2D',
                'imageType' => 'PDF',
                'labelStockType' => 'PAPER_4X6',
            ],
            'requestedPackageLineItems' => $lineItems,
        ];
    }

    /**
     * @param  array<string, mixed>  $party
     * @return array<string, mixed>
     */
    private function normalizeParty(array $party, bool $isRecipient = false, bool $residential = false): array
    {
        $contact = is_array($party['contact'] ?? null) ? $party['contact'] : [];
        $address = is_array($party['address'] ?? null) ? $party['address'] : [];

        $lines = $address['streetLines'] ?? [];
        if (! is_array($lines)) {
            $lines = [];
        }
        $lines = array_values(array_filter($lines, fn ($l) => is_string($l) && $l !== ''));

        $addrBlock = [
            'streetLines' => $lines,
            'city' => (string) ($address['city'] ?? ''),
            'stateOrProvinceCode' => (string) ($address['stateOrProvinceCode'] ?? ''),
            'postalCode' => (string) ($address['postalCode'] ?? ''),
            'countryCode' => (string) ($address['countryCode'] ?? ''),
        ];
        if ($isRecipient) {
            $addrBlock['residential'] = $residential;
        }

        return [
            'contact' => array_filter([
                'personName' => (string) ($contact['personName'] ?? ''),
                'phoneNumber' => (string) ($contact['phoneNumber'] ?? ''),
                'companyName' => isset($contact['companyName']) ? (string) $contact['companyName'] : null,
            ], fn ($v) => $v !== null && $v !== ''),
            'address' => $addrBlock,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function postJson(string $path, array $body, string $transactionId, string $operation): array
    {
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);
        $token = $this->fedExOAuthToken->getToken();

        $response = Http::timeout($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $transactionId,
            ])
            ->withToken($token)
            ->post($base.$path, $body);

        return $this->handleShipResponse($response, $transactionId, $operation);
    }

    /**
     * @return array<string, mixed>
     */
    private function putJson(string $path, array $body, string $transactionId, string $operation): array
    {
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);
        $token = $this->fedExOAuthToken->getToken();

        $response = Http::timeout($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $transactionId,
            ])
            ->withToken($token)
            ->put($base.$path, $body);

        return $this->handleShipResponse($response, $transactionId, $operation);
    }

    /**
     * @return array<string, mixed>
     */
    private function handleShipResponse(Response $response, string $transactionId, string $operation): array
    {
        $json = $response->json() ?? [];

        if (! $response->successful()) {
            $errors = is_array($json['errors'] ?? null) ? $json['errors'] : [];
            $messages = FedExShipErrorMapper::messagesFromErrors($errors);
            $snippet = Str::limit((string) json_encode($json), 4000);
            Log::error('FedEx Ship API Error', [
                'transaction_id' => $transactionId,
                'operation' => $operation,
                'http_status' => $response->status(),
                'error' => $snippet,
            ]);
            $msg = $messages[0] ?? 'FedEx Ship request failed (HTTP '.$response->status().').';
            throw new RuntimeException($msg);
        }

        if (! empty($json['errors']) && is_array($json['errors'])) {
            $messages = FedExShipErrorMapper::messagesFromErrors($json['errors']);
            if ($messages !== []) {
                Log::error('FedEx Ship API Error', [
                    'transaction_id' => $transactionId,
                    'operation' => $operation,
                    'error' => $messages,
                ]);
                throw new RuntimeException($messages[0]);
            }
        }

        return is_array($json) ? $json : [];
    }

    /**
     * @param  array<string, mixed>  $json
     * @return array<int, string>
     */
    private function collectShipAlerts(array $json): array
    {
        $out = [];
        $output = $json['output'] ?? [];
        if (! is_array($output)) {
            return [];
        }
        foreach ($output['alerts'] ?? [] as $a) {
            if (is_string($a)) {
                $out[] = $a;
            } elseif (is_array($a)) {
                $code = isset($a['code']) ? (string) $a['code'] : '';
                $msg = FedExShipErrorMapper::mapCode($code);
                $text = isset($a['message']) ? (string) $a['message'] : '';
                $out[] = trim($msg !== '' ? $msg : $text);
            }
        }
        $out = array_merge($out, FedExShipErrorMapper::messagesFromErrors(is_array($json['errors'] ?? null) ? $json['errors'] : []));

        return array_values(array_filter(array_unique($out)));
    }

    /**
     * @param  array<string, mixed>  $json
     * @return array{
     *   trackingNumber: string|null,
     *   labelUrl: string|null,
     *   labelBase64: string|null,
     *   serviceType: string|null,
     *   shipTimestamp: string|null,
     *   jobId: string|null
     * }
     */
    private function parseCreateShipmentOutput(array $json): array
    {
        $output = is_array($json['output'] ?? null) ? $json['output'] : [];

        $jobId = isset($output['jobId']) ? (string) $output['jobId'] : null;

        $txnShipments = $output['transactionShipments'] ?? [];
        $tracking = null;
        $labelUrl = null;
        $labelBase64 = null;
        $serviceType = null;
        $shipTimestamp = null;

        if (is_array($txnShipments) && isset($txnShipments[0]) && is_array($txnShipments[0])) {
            $ts = $txnShipments[0];
            $tracking = isset($ts['masterTrackingNumber']) ? (string) $ts['masterTrackingNumber'] : null;
            $shipTimestamp = isset($ts['shipTimestamp']) ? (string) $ts['shipTimestamp'] : null;
            $serviceType = isset($ts['serviceType']) ? (string) $ts['serviceType'] : null;

            $piece = $ts['pieceResponses'][0] ?? $ts['pieceResponse'] ?? null;
            if (is_array($piece)) {
                $tracking = $tracking ?? (isset($piece['trackingNumber']) ? (string) $piece['trackingNumber'] : null);
                $docs = $piece['packageDocuments'] ?? [];
                if (is_array($docs) && isset($docs[0]) && is_array($docs[0])) {
                    $doc = $docs[0];
                    $labelUrl = isset($doc['url']) ? (string) $doc['url'] : null;
                    $labelBase64 = isset($doc['encodedLabel']) ? (string) $doc['encodedLabel'] : null;
                }
            }
        }

        return [
            'trackingNumber' => $tracking,
            'labelUrl' => $labelUrl,
            'labelBase64' => $labelBase64,
            'serviceType' => $serviceType,
            'shipTimestamp' => $shipTimestamp,
            'jobId' => $jobId,
        ];
    }

    /**
     * Tag create responses may expose masterTrackingNumber on output per FedEx docs.
     *
     * @param  array<string, mixed>  $json
     * @return array{
     *   trackingNumber: string|null,
     *   labelUrl: string|null,
     *   labelBase64: string|null,
     *   serviceType: string|null,
     *   shipTimestamp: string|null,
     *   jobId: string|null
     * }
     */
    private function parseCreateTagOutput(array $json): array
    {
        $parsed = $this->parseCreateShipmentOutput($json);
        $output = is_array($json['output'] ?? null) ? $json['output'] : [];
        if (isset($output['masterTrackingNumber']) && is_string($output['masterTrackingNumber'])) {
            $parsed['trackingNumber'] = $output['masterTrackingNumber'];
        }

        return $parsed;
    }
}

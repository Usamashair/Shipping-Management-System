<?php

namespace App\Services\FedEx;

use App\Services\FixedRecipientService;
use App\Support\UsStateCodeNormalizer;
use Illuminate\Http\Client\Response;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class FedExShipApiService
{
    public function __construct(
        private readonly FedExOAuthToken $fedExOAuthToken,
        private readonly FedExDomesticShipPayloadSanitizer $domesticShipSanitizer,
    ) {}

    /**
     * Map app/legacy `pickupType` values to FedEx Ship `requestedShipment.pickupType` enum values.
     * The API accepts `DROP_BOX` in StoreFedExShipRequest; FedEx expects `DROPOFF_AT_FEDEX_LOCATION`.
     */
    public static function normalizePickupTypeForFedEx(string $pickupType): string
    {
        $t = trim($pickupType);
        if ($t === '') {
            return 'USE_SCHEDULED_PICKUP';
        }
        if ($t === 'DROP_BOX') {
            return 'DROPOFF_AT_FEDEX_LOCATION';
        }

        return $t;
    }

    /**
     * Map invalid or sandbox-problematic app-level `pickupType` before {@see normalizePickupTypeForFedEx()}.
     */
    private function sanitizePickupType(string $serviceType, string $pickupType): string
    {
        if ($serviceType === 'GROUND_HOME_DELIVERY' && $pickupType === 'DROP_BOX') {
            return 'USE_SCHEDULED_PICKUP';
        }

        if ((string) config('fedex.env') === 'sandbox' && $pickupType === 'CONTACT_FEDEX_TO_SCHEDULE') {
            return 'USE_SCHEDULED_PICKUP';
        }

        return $pickupType;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function applyFixedRecipientToShipData(array $data): array
    {
        $data['recipients'] = FixedRecipientService::asFedExRecipientsArray();

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{alerts: array<int, string>, raw: array<string, mixed>, transaction_id: string}
     */
    public function validateShipment(array $data): array
    {
        $data = $this->applyFixedRecipientToShipData($data);
        $data = $this->sanitizeDomesticShipData($data);
        $transactionId = (string) Str::uuid();
        $body = $this->isSandboxShipEnv()
            ? $this->buildValidateBodySandbox($data)
            : $this->buildRootPayload($data);

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
        $data = $this->applyFixedRecipientToShipData($data);
        $data = $this->sanitizeDomesticShipData($data);
        if ((string) config('fedex.env') === 'sandbox') {
            return $this->createShipmentSandboxVirtualized($data);
        }

        return $this->createShipmentProduction($data);
    }

    /**
     * Production: real party + package data with full Ship create options.
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
    private function createShipmentProduction(array $data): array
    {
        $transactionId = (string) Str::uuid();
        $labelMode = (string) config('fedex.ship_label_response', 'URL_ONLY');
        $body = $this->buildRootPayload($data);
        $body['labelResponseOptions'] = $labelMode;
        $body['shipAction'] = 'CONFIRM';
        $processing = (string) config('fedex.processing_option_type', 'ALLOW_ASYNCHRONOUS');
        if (in_array($processing, ['SYNCHRONOUS_ONLY', 'ALLOW_ASYNCHRONOUS'], true)) {
            $body['processingOptionType'] = $processing;
        }
        $procOpts = config('fedex.processing_options');
        if (is_array($procOpts) && $procOpts !== []) {
            $body['processingOptions'] = array_values($procOpts);
        }
        if (config('fedex.one_label_at_a_time', true)) {
            $body['oneLabelAtATime'] = true;
        }
        if (strtoupper($labelMode) === 'URL_ONLY') {
            $merge = (string) config('fedex.merge_label_doc_option', 'LABELS_ONLY');
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
     * FedEx sandbox is virtualized: only the JSON API Collection sample body returns a success path.
     * Sanitized ship data is still used by the app for DB storage; the sandbox host ignores it for label/tracking.
     *
     * @param  array<string, mixed>  $data  Sanitized domestic ship payload
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
    private function createShipmentSandboxVirtualized(array $data): array
    {
        Log::info('✅ FedEx sandbox virtualized path REACHED', ['user_service' => $data['serviceType'] ?? 'unknown']);

        $transactionId = (string) Str::uuid();
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);
        $account = $this->accountNumberBlock();

        // Virtualized sample only: do not merge $data['shipper'] / recipient contact phone or address into this body.

        $sandboxPayload = [
            'accountNumber' => $account,
            'labelResponseOptions' => 'LABEL',
            'requestedShipment' => [
                'shipper' => [
                    'contact' => [
                        'personName' => 'SHIPPER NAME',
                        'phoneNumber' => '1234567890',
                        'companyName' => 'Shipper Company Name',
                    ],
                    'address' => [
                        'streetLines' => ['SHIPPER STREET LINE 1'],
                        'city' => 'Harrison',
                        'stateOrProvinceCode' => 'AR',
                        'postalCode' => '72601',
                        'countryCode' => 'US',
                    ],
                ],
                'recipients' => [
                    [
                        'contact' => [
                            'personName' => 'RECIPIENT NAME',
                            'phoneNumber' => '1234567891',
                            'companyName' => 'Recipient Company Name',
                        ],
                        'address' => [
                            'streetLines' => ['RECIPIENT STREET LINE 1'],
                            'city' => 'Collierville',
                            'stateOrProvinceCode' => 'TN',
                            'postalCode' => '38017',
                            'countryCode' => 'US',
                            'residential' => false,
                        ],
                    ],
                ],
                'shipDatestamp' => now()->format('Y-m-d'),
                'serviceType' => 'FEDEX_GROUND',
                'packagingType' => 'YOUR_PACKAGING',
                'pickupType' => 'USE_SCHEDULED_PICKUP',
                'blockInsightVisibility' => false,
                'shippingChargesPayment' => [
                    'paymentType' => 'SENDER',
                    'payor' => [
                        'responsibleParty' => [
                            'accountNumber' => $account,
                        ],
                    ],
                ],
                'labelSpecification' => $this->shipmentLabelSpecification(),
                'requestedPackageLineItems' => [
                    [
                        'weight' => [
                            'value' => 1.0,
                            'units' => 'LB',
                        ],
                    ],
                ],
            ],
        ];

        $shipperContact = is_array($data['shipper']['contact'] ?? null) ? $data['shipper']['contact'] : [];
        $rec0 = is_array($data['recipients'][0] ?? null) ? $data['recipients'][0] : [];
        $recContact = is_array($rec0['contact'] ?? null) ? $rec0['contact'] : [];
        Log::info('FedEx sandbox virtualized ship request (sample body only; user data is stored in our DB from request payload)', [
            'transaction_id' => $transactionId,
            'user_service_type' => $data['serviceType'] ?? null,
            'user_shipper' => $shipperContact['personName'] ?? null,
            'user_recipient' => $recContact['personName'] ?? null,
        ]);
        Log::debug('FedEx sandbox ship payload (virtualized sample)', [
            'transaction_id' => $transactionId,
            'payload' => $sandboxPayload,
            'app_service_type' => $data['serviceType'] ?? null,
        ]);

        $response = FedExHttp::pending($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $transactionId,
            ])
            ->withToken($this->fedExOAuthToken->getToken())
            ->post($base.'/ship/v1/shipments', $sandboxPayload);

        Log::debug('FedEx sandbox ship HTTP response', [
            'transaction_id' => $transactionId,
            'http_status' => $response->status(),
        ]);

        $json = $this->handleShipResponse($response, $transactionId, 'create', $sandboxPayload);

        $parsed = $this->parseCreateShipmentOutput($json);
        $parsed['serviceType'] = (string) ($data['serviceType'] ?? $parsed['serviceType'] ?? 'FEDEX_GROUND');

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
     * FedEx Ship API — POST /ship/v1/shipments/results ("Retrieve Async Ship").
     * Retrieves deferred shipment artifacts (labels, tracking, etc.) for async create flows using the FedEx job id.
     *
     * @return array<string, mixed> Raw FedEx JSON (transactionId, customerTransactionId, output, …)
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
     * Create Return Tag — POST /ship/v1/shipments/tag.
     * Expects sanitized domestic fields plus {@see applyCreateTagRequestedShipmentAugments()}:
     * `pickup_detail.ready_pickup_datetime`, `pickup_detail.latest_pickup_datetime` (ISO-8601),
     * and `packages[0].description` (maps to requestedPackageLineItems[0].itemDescription for Ground tag).
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
        $data = $this->sanitizeDomesticShipData($data);
        $transactionId = (string) Str::uuid();
        $requested = $this->buildRequestedShipment($data);
        $requested = $this->applyCreateTagRequestedShipmentAugments($requested, $data);
        $body = [
            'accountNumber' => $this->accountNumberBlock(),
            'requestedShipment' => $requested,
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
     * Cancel Return Tag — PUT /ship/v1/shipments/tag/cancel/{shipmentid} (FedEx path param is the tag shipment id).
     *
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
            'completedTagDetail' => [
                'confirmationNumber' => (string) $payload['completedTagDetail']['confirmationNumber'],
                'location' => (string) $payload['completedTagDetail']['location'],
                'dispatchDate' => (string) $payload['completedTagDetail']['dispatchDate'],
            ],
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
     * SENDER billing: FedEx Ship often rejects validate/create when payor account is omitted (INVALID.INPUT.EXCEPTION).
     *
     * @return array<string, mixed>
     */
    private function shippingChargesPaymentBlock(): array
    {
        return [
            'paymentType' => 'SENDER',
            'payor' => [
                'responsibleParty' => [
                    'accountNumber' => $this->accountNumberBlock(),
                ],
            ],
        ];
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
     * Full JSON body for POST /rate/v1/rates/quotes. Caller should pass {@see FedExDomesticShipPayloadSanitizer}-sanitized data.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function buildRateQuotesRequestBody(array $data): array
    {
        $requested = $this->buildRequestedShipment($data);
        unset(
            $requested['serviceType'],
            $requested['shippingChargesPayment'],
            $requested['labelSpecification'],
        );

        $recipients = $requested['recipients'] ?? [];
        if (! is_array($recipients) || $recipients === []) {
            throw new RuntimeException('At least one recipient is required.');
        }

        $requested['recipient'] = $recipients[0];
        unset($requested['recipients']);
        $requested['rateRequestType'] = ['LIST', 'ACCOUNT'];

        // Rate API schema uses shipDateStamp (capital S). Ship API uses shipDatestamp; mismatch yields HTTP 422 from Rate.
        if (isset($requested['shipDatestamp'])) {
            $requested['shipDateStamp'] = $requested['shipDatestamp'];
            unset($requested['shipDatestamp']);
        }

        $body = [
            'accountNumber' => $this->accountNumberBlock(),
            'requestedShipment' => $requested,
            'version' => $this->rateVersionBlock(),
        ];

        return $this->mergeRateApiRootFragments($body);
    }

    /**
     * Optional root-level fields from config (FedEx Rates API): rateRequestControlParameters, carrierCodes, processingOptions.
     *
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function mergeRateApiRootFragments(array $body): array
    {
        $raw = trim((string) config('fedex.rate_request_control_parameters_json', ''));
        if ($raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && $decoded !== []) {
                $body['rateRequestControlParameters'] = $decoded;
            }
        }

        $carrierCodes = config('fedex.rate_carrier_codes');
        if (is_array($carrierCodes) && $carrierCodes !== []) {
            $body['carrierCodes'] = array_values($carrierCodes);
        }

        $proc = config('fedex.rate_processing_options');
        if (is_array($proc) && $proc !== []) {
            $body['processingOptions'] = array_values($proc);
        }

        return $body;
    }

    /**
     * @return array{major: string, minor: string, patch: string}
     */
    private function rateVersionBlock(): array
    {
        $v = config('fedex.rate_api_version', []);
        if (! is_array($v)) {
            $v = [];
        }

        return [
            'major' => (string) ($v['major'] ?? '1'),
            'minor' => (string) ($v['minor'] ?? '0'),
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

    private function isSandboxShipEnv(): bool
    {
        return (string) config('fedex.env', (string) config('fedex.environment', 'sandbox')) === 'sandbox';
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function buildValidateBodySandbox(array $data): array
    {
        return [
            'accountNumber' => $this->accountNumberBlock(),
            'requestedShipment' => $this->buildRequestedShipmentSandboxMinimal($data),
        ];
    }

    /**
     * FedEx Ship sandbox rejects many optional root and requestedShipment fields. Use a doc-aligned minimal
     * body for POST /ship/v1/shipments and packages/validate when FEDEX_ENV=sandbox.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function buildRequestedShipmentSandboxMinimal(array $data): array
    {
        $packages = $data['packages'] ?? [];
        if (! is_array($packages) || $packages === [] || ! is_array($packages[0])) {
            throw new RuntimeException('At least one package is required.');
        }
        $pkg0 = $packages[0];
        $w = (float) data_get($pkg0, 'weight.value', 0);
        if ($w <= 0) {
            $w = 1.0;
        }

        $shipperRaw = $data['shipper'] ?? [];
        if (! is_array($shipperRaw) || ! is_array($shipperRaw['address'] ?? null)) {
            throw new RuntimeException('Shipper address is required for FedEx Ship.');
        }
        $recipients = $data['recipients'] ?? [];
        if (! is_array($recipients) || $recipients === [] || ! is_array($recipients[0] ?? null)) {
            throw new RuntimeException('At least one recipient is required.');
        }
        $r0 = $recipients[0];
        if (! is_array($r0['address'] ?? null)) {
            throw new RuntimeException('Recipient address is required for FedEx Ship.');
        }
        $rAddr = is_array($r0['address']) ? $r0['address'] : [];
        $residential = (bool) ($rAddr['residential'] ?? $data['is_residential'] ?? false);

        $shipper = $this->normalizeParty($shipperRaw, isRecipient: false);
        $sContact = is_array($shipperRaw['contact'] ?? null) ? $shipperRaw['contact'] : [];
        $shipper['contact']['companyName'] = trim((string) ($sContact['companyName'] ?? '')) !== ''
            ? (string) $sContact['companyName']
            : 'Sender';

        $recipient = $this->normalizeParty($r0, isRecipient: true, residential: $residential);
        $rContact = is_array($r0['contact'] ?? null) ? $r0['contact'] : [];
        $recipient['contact']['companyName'] = trim((string) ($rContact['companyName'] ?? '')) !== ''
            ? (string) $rContact['companyName']
            : 'Recipient';

        $pickupType = $this->sanitizePickupType(
            (string) ($data['serviceType'] ?? ''),
            (string) ($data['pickupType'] ?? 'USE_SCHEDULED_PICKUP')
        );
        $pickupType = self::normalizePickupTypeForFedEx($pickupType);
        $packagingType = (string) ($data['packagingType'] ?? 'YOUR_PACKAGING');
        if (trim($packagingType) === '') {
            $packagingType = 'YOUR_PACKAGING';
        }

        $dimU = (string) (data_get($pkg0, 'dimensions.units') ?: 'IN');

        return [
            'shipDatestamp' => now()->format('Y-m-d'),
            'serviceType' => (string) $data['serviceType'],
            'packagingType' => $packagingType,
            'pickupType' => $pickupType,
            'totalPackageCount' => 1,
            'totalWeight' => [
                'units' => 'LB',
                'value' => (float) $w,
            ],
            'shipper' => $shipper,
            'recipients' => [$recipient],
            'shippingChargesPayment' => $this->shippingChargesPaymentBlock(),
            'labelSpecification' => $this->shipmentLabelSpecification(),
            'requestedPackageLineItems' => [
                [
                    'weight' => [
                        'units' => 'LB',
                        'value' => (float) $w,
                    ],
                    'dimensions' => [
                        'length' => (int) max(1, (int) round((float) data_get($pkg0, 'dimensions.length', 1))),
                        'width' => (int) max(1, (int) round((float) data_get($pkg0, 'dimensions.width', 1))),
                        'height' => (int) max(1, (int) round((float) data_get($pkg0, 'dimensions.height', 1))),
                        'units' => $dimU,
                    ],
                ],
            ],
            'version' => [
                'major' => '1',
                'minor' => '0',
                'patch' => '0',
            ],
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
        $seq = 0;
        foreach ($packages as $pkg) {
            if (! is_array($pkg)) {
                continue;
            }
            $seq++;
            $w = (float) data_get($pkg, 'weight.value', 0);
            $totalLb += $w;
            $line = [
                'sequenceNumber' => (string) $seq,
                'groupPackageCount' => 1,
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
            $pkgDesc = trim((string) data_get($pkg, 'description', ''));
            if ($pkgDesc !== '') {
                $line['customerReferences'] = [
                    [
                        'customerReferenceType' => 'CUSTOMER_REFERENCE',
                        'value' => Str::limit($pkgDesc, 40, ''),
                    ],
                ];
            }
            $lineItems[] = $line;
        }

        $shipperRaw = $data['shipper'] ?? [];
        if (! is_array($shipperRaw) || ! is_array($shipperRaw['address'] ?? null)) {
            throw new RuntimeException('Shipper address is required for FedEx Ship.');
        }
        $shipper = $this->normalizeParty($shipperRaw);
        $recipients = $data['recipients'] ?? [];
        if (! is_array($recipients) || $recipients === []) {
            throw new RuntimeException('At least one recipient is required.');
        }
        $normalizedRecipients = [];
        foreach ($recipients as $r) {
            if (is_array($r)) {
                $rAddr = is_array($r['address'] ?? null) ? $r['address'] : [];
                $recResidential = (bool) ($rAddr['residential'] ?? ($data['is_residential'] ?? false));
                $normalizedRecipients[] = $this->normalizeParty($r, isRecipient: true, residential: $recResidential);
            }
        }

        $pickupType = $this->sanitizePickupType(
            (string) ($data['serviceType'] ?? ''),
            (string) ($data['pickupType'] ?? 'USE_SCHEDULED_PICKUP')
        );
        $pickupType = self::normalizePickupTypeForFedEx($pickupType);
        $packageCount = count($lineItems);
        $totalPackageCount = $packageCount > 0 ? $packageCount : 1;

        return [
            'shipDatestamp' => now()->format('Y-m-d'),
            'pickupType' => $pickupType,
            'serviceType' => (string) $data['serviceType'],
            'packagingType' => (string) $data['packagingType'],
            'totalPackageCount' => $totalPackageCount,
            'totalWeight' => [
                'units' => 'LB',
                'value' => $totalLb > 0 ? $totalLb : (float) data_get($packages[0], 'weight.value', 1),
            ],
            'shipper' => $shipper,
            'recipients' => $normalizedRecipients,
            'shippingChargesPayment' => $this->shippingChargesPaymentBlock(),
            'labelSpecification' => $this->shipmentLabelSpecification(),
            'requestedPackageLineItems' => $lineItems,
        ];
    }

    /**
     * FedEx Create Tag (POST /ship/v1/shipments/tag) requires pickup windows plus
     * package itemDescription for Ground tag flows (FedEx Ship API reference).
     *
     * @param  array<string, mixed>  $requested  Output of {@see buildRequestedShipment()}
     * @param  array<string, mixed>  $data  Sanitized domestic ship payload (includes pickup_detail, packages[].description)
     * @return array<string, mixed>
     */
    private function applyCreateTagRequestedShipmentAugments(array $requested, array $data): array
    {
        $pd = $data['pickup_detail'] ?? null;
        if (! is_array($pd)) {
            throw new RuntimeException('pickup_detail is required for FedEx Create Tag.');
        }
        $ready = trim((string) ($pd['ready_pickup_datetime'] ?? ''));
        $latest = trim((string) ($pd['latest_pickup_datetime'] ?? ''));
        if ($ready === '' || $latest === '') {
            throw new RuntimeException('pickup_detail.ready_pickup_datetime and latest_pickup_datetime are required for FedEx Create Tag.');
        }
        $requested['pickupDetail'] = [
            'readyPickupDateTime' => $ready,
            'latestPickupDateTime' => $latest,
        ];

        $pkgs = $data['packages'] ?? [];
        $firstPkg = is_array($pkgs[0] ?? null) ? $pkgs[0] : [];
        $desc = trim((string) ($firstPkg['description'] ?? ''));
        if ($desc !== '' && isset($requested['requestedPackageLineItems'][0]) && is_array($requested['requestedPackageLineItems'][0])) {
            $requested['requestedPackageLineItems'][0]['itemDescription'] = Str::limit($desc, 50, '');
        }

        return $requested;
    }

    /**
     * FedEx Ship requestedShipment.labelSpecification (COMMON2D PDF).
     * Stock and orientation are configurable so PDF viewers show the label upright (avoid 85x11 half-page
     * unless explicitly requested — those responses often embed the label rotated vs. folding instructions).
     *
     * @return array<string, mixed>
     */
    private function shipmentLabelSpecification(): array
    {
        $stock = trim((string) config('fedex.label_stock_type', 'PAPER_4X6'));
        if ($stock === '') {
            $stock = 'PAPER_4X6';
        }
        $spec = [
            'labelFormatType' => 'COMMON2D',
            'imageType' => 'PDF',
            'labelStockType' => $stock,
        ];
        $orient = config('fedex.label_printing_orientation');
        if (is_string($orient)) {
            $orient = trim($orient);
            if ($orient !== '') {
                $spec['labelPrintingOrientation'] = $orient;
            }
        }

        return $spec;
    }

    /**
     * Assembles FedEx party blocks. Domestic validate/create callers run {@see FedExDomesticShipPayloadSanitizer} first.
     *
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
        if ($lines === []) {
            $lines = ['Address line required'];
        }

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

        $phone = $this->normalizePhoneForFedEx((string) ($contact['phoneNumber'] ?? ''), (string) ($address['countryCode'] ?? ''));
        $companyRaw = trim((string) ($contact['companyName'] ?? ''));

        return [
            'contact' => [
                'personName' => (string) ($contact['personName'] ?? ''),
                'phoneNumber' => $phone,
                'companyName' => $companyRaw !== '' ? $companyRaw : 'N/A',
            ],
            'address' => $addrBlock,
        ];
    }

    /**
     * FedEx often expects digits-only phone for US; avoid letters from test data.
     */
    private function normalizePhoneForFedEx(string $phone, string $countryCode): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        $cc = strtoupper(substr(trim($countryCode), 0, 2));
        if ($cc === 'US' || $cc === 'CA') {
            if (strlen($digits) >= 10) {
                return substr($digits, -10);
            }
            if (strlen($digits) >= 7) {
                return $digits;
            }

            return str_pad(substr($digits, 0, 10), 10, '0', STR_PAD_LEFT);
        }

        return $digits !== '' ? $digits : '5555555555';
    }

    /**
     * @return array<string, mixed>
     */
    private function postJson(string $path, array $body, string $transactionId, string $operation): array
    {
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);
        $token = $this->fedExOAuthToken->getToken();

        Log::debug('FedEx Ship payload', ['payload' => $body]);

        $response = FedExHttp::pending($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $transactionId,
            ])
            ->withToken($token)
            ->post($base.$path, $body);

        return $this->handleShipResponse($response, $transactionId, $operation, $body);
    }

    /**
     * @return array<string, mixed>
     */
    private function putJson(string $path, array $body, string $transactionId, string $operation): array
    {
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);
        $token = $this->fedExOAuthToken->getToken();

        Log::debug('FedEx Ship payload', ['payload' => $body]);

        $response = FedExHttp::pending($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $transactionId,
            ])
            ->withToken($token)
            ->put($base.$path, $body);

        return $this->handleShipResponse($response, $transactionId, $operation, $body);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function sanitizeDomesticShipData(array $data): array
    {
        try {
            return $this->domesticShipSanitizer->sanitize($data);
        } catch (FedExShipPayloadSanitizationException $e) {
            $isInvalidState = $e->errorCode === 'INVALID_STATE';
            $payload = [
                'message' => $isInvalidState
                    ? UsStateCodeNormalizer::INVALID_MESSAGE
                    : FedExShipErrorMapper::GENERIC_INVALID_INPUT_MESSAGE,
                'fedex_sanitizer_code' => $e->errorCode,
                'details' => $e->details,
            ];
            if ($isInvalidState) {
                $payload['code'] = UsStateCodeNormalizer::ERROR_CODE;
            }
            throw new HttpResponseException(response()->json($payload, 422));
        }
    }

    /**
     * @param  array<string, mixed>  $requestBody  Root JSON body sent to FedEx (accountNumber + requestedShipment + …).
     */
    private function handleShipResponse(Response $response, string $transactionId, string $operation, array $requestBody = []): array
    {
        $json = $response->json() ?? [];

        if (! $response->successful()) {
            $this->throwFedExShipHttpException($response, $json, $transactionId, $operation, $requestBody);
        }

        if (! empty($json['errors']) && is_array($json['errors'])) {
            $messages = FedExShipErrorMapper::messagesFromErrors($json['errors']);
            if ($messages !== []) {
                Log::error('FedEx Ship API Error', [
                    'transaction_id' => $transactionId,
                    'operation' => $operation,
                    'error' => $messages,
                ]);
                $this->throwFedExShipErrorResponse($json, $transactionId, $operation, $messages[0]);
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
        if (! is_array($txnShipments)) {
            $txnShipments = [];
        }

        $tracking = null;
        $labelUrl = null;
        $labelBase64 = null;
        $serviceType = null;
        $shipTimestamp = null;

        foreach ($txnShipments as $ts) {
            if (! is_array($ts)) {
                continue;
            }

            $serviceType = $serviceType ?? (isset($ts['serviceType']) ? (string) $ts['serviceType'] : null);
            $shipTimestamp = $shipTimestamp
                ?? (isset($ts['shipTimestamp']) ? (string) $ts['shipTimestamp'] : null)
                ?? (isset($ts['shipDatestamp']) ? (string) $ts['shipDatestamp'] : null);

            $tracking = $this->extractTrackingNumberFromTransactionShipment($ts);
            if ($tracking !== null && $tracking !== '') {
                [$labelUrl, $labelBase64] = $this->extractLabelFromTransactionShipment($ts);
                break;
            }
        }

        if (($tracking === null || $tracking === '') && is_array($output)) {
            $tracking = isset($output['masterTrackingNumber']) ? (string) $output['masterTrackingNumber'] : null;
        }

        return [
            'trackingNumber' => ($tracking !== null && $tracking !== '') ? $tracking : null,
            'labelUrl' => $labelUrl,
            'labelBase64' => $labelBase64,
            'serviceType' => $serviceType,
            'shipTimestamp' => $shipTimestamp,
            'jobId' => $jobId,
        ];
    }

    /**
     * FedEx nests tracking on transactionShipment, pieceResponses, shipmentDocuments, or completedShipmentDetail.
     *
     * @param  array<string, mixed>  $ts
     */
    private function extractTrackingNumberFromTransactionShipment(array $ts): ?string
    {
        $candidates = [];

        foreach ([
            'masterTrackingNumber',
            'completedShipmentDetail.masterTrackingId.trackingNumber',
            'completedShipmentDetail.masterTrackingNumber',
        ] as $path) {
            $v = data_get($ts, $path);
            if (is_string($v) && $v !== '') {
                $candidates[] = $v;
            }
        }

        foreach ((array) ($ts['shipmentDocuments'] ?? []) as $doc) {
            if (is_array($doc) && isset($doc['trackingNumber']) && is_string($doc['trackingNumber']) && $doc['trackingNumber'] !== '') {
                $candidates[] = $doc['trackingNumber'];
            }
        }

        foreach ((array) ($ts['pieceResponses'] ?? []) as $piece) {
            if (! is_array($piece)) {
                continue;
            }
            foreach (['trackingNumber', 'masterTrackingNumber', 'acceptanceTrackingNumber'] as $k) {
                if (isset($piece[$k]) && is_string($piece[$k]) && $piece[$k] !== '') {
                    $candidates[] = $piece[$k];
                }
            }
            foreach ((array) ($piece['packageDocuments'] ?? []) as $doc) {
                if (is_array($doc) && isset($doc['trackingNumber']) && is_string($doc['trackingNumber']) && $doc['trackingNumber'] !== '') {
                    $candidates[] = $doc['trackingNumber'];
                }
            }
        }

        foreach ((array) data_get($ts, 'completedShipmentDetail.completedPackageDetails', []) as $pkg) {
            if (! is_array($pkg)) {
                continue;
            }
            foreach ((array) ($pkg['trackingIds'] ?? []) as $tid) {
                if (is_array($tid) && isset($tid['trackingNumber']) && is_string($tid['trackingNumber']) && $tid['trackingNumber'] !== '') {
                    $candidates[] = $tid['trackingNumber'];
                }
            }
        }

        foreach ($candidates as $c) {
            if (is_string($c) && $c !== '') {
                return $c;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $ts
     * @return array{0: string|null, 1: string|null}
     */
    private function extractLabelFromTransactionShipment(array $ts): array
    {
        $labelUrl = null;
        $labelBase64 = null;

        foreach ((array) ($ts['shipmentDocuments'] ?? []) as $doc) {
            if (! is_array($doc)) {
                continue;
            }
            if ($labelUrl === null && isset($doc['url']) && is_string($doc['url']) && $doc['url'] !== '') {
                $labelUrl = $doc['url'];
            }
            if ($labelBase64 === null && isset($doc['encodedLabel']) && is_string($doc['encodedLabel']) && $doc['encodedLabel'] !== '') {
                $labelBase64 = $doc['encodedLabel'];
            }
        }

        foreach ((array) ($ts['pieceResponses'] ?? []) as $piece) {
            if (! is_array($piece)) {
                continue;
            }
            foreach ((array) ($piece['packageDocuments'] ?? []) as $doc) {
                if (! is_array($doc)) {
                    continue;
                }
                if ($labelUrl === null && isset($doc['url']) && is_string($doc['url']) && $doc['url'] !== '') {
                    $labelUrl = $doc['url'];
                }
                if ($labelBase64 === null && isset($doc['encodedLabel']) && is_string($doc['encodedLabel']) && $doc['encodedLabel'] !== '') {
                    $labelBase64 = $doc['encodedLabel'];
                }
            }
        }

        return [$labelUrl, $labelBase64];
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

    /**
     * @param  array<int, mixed>  $errors
     * @return array<int, array{code: string, message: string}>
     */
    private function normalizeFedExShipErrorsList(array $errors): array
    {
        $out = [];
        foreach ($errors as $err) {
            if (! is_array($err)) {
                continue;
            }
            $out[] = [
                'code' => isset($err['code']) ? (string) $err['code'] : '',
                'message' => isset($err['message']) ? (string) $err['message'] : '',
            ];
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $requestBody  Root JSON body last sent to FedEx (for diagnostics; no OAuth secrets).
     * @param  array<string, mixed>  $json
     */
    private function throwFedExShipHttpException(Response $response, array $json, string $transactionId, string $operation, array $requestBody = []): void
    {
        $errors = is_array($json['errors'] ?? null) ? $json['errors'] : [];
        $messages = FedExShipErrorMapper::messagesFromErrors($errors);
        $snippet = Str::limit((string) json_encode($json), 4000);
        Log::error('FedEx Ship API Error', [
            'transaction_id' => $transactionId,
            'operation' => $operation,
            'http_status' => $response->status(),
            'fedex_transaction_id' => $json['transactionId'] ?? null,
            'error' => $snippet,
            'requested_shipment_snapshot' => $this->snapshotRequestedShipmentForLog($requestBody),
            'debug_replay_hint' => 'Rebuild the Ship request body from requested_shipment_snapshot + accountNumber/version; replay against the same base_url in Postman and compare with FedEx Ship API reference payloads.',
        ]);
        $invalidInput = $this->fedexErrorsContainInvalidInput($errors);
        $msg = $invalidInput
            ? FedExShipErrorMapper::GENERIC_INVALID_INPUT_MESSAGE
            : ($messages[0] ?? 'FedEx Ship request failed (HTTP '.$response->status().').');
        $httpStatus = $response->status();
        $clientStatus = ($httpStatus >= 400 && $httpStatus < 500) ? 422 : 502;

        $snapshot = $this->snapshotRequestedShipmentForLog($requestBody);

        $payload = [
            'message' => $msg,
            'fedex_http_status' => $httpStatus,
            'fedex_errors' => $this->normalizeFedExShipErrorsList($errors),
            'transaction_id' => $json['transactionId'] ?? null,
            'fedex_operation' => $operation,
        ];
        if ($invalidInput && config('app.debug')) {
            $payload['fedex_ship_service_type'] = $snapshot['serviceType'] ?? null;
            $payload['fedex_ship_pickup_type'] = $snapshot['pickupType'] ?? null;
        }

        throw new HttpResponseException(response()->json($payload, $clientStatus));
    }

    /**
     * @param  array<int, mixed>  $errors
     */
    private function fedexErrorsContainInvalidInput(array $errors): bool
    {
        foreach ($errors as $err) {
            if (is_array($err) && (($err['code'] ?? '') === 'INVALID.INPUT.EXCEPTION')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Safe subset of `requestedShipment` for logs (addresses + service; no account numbers).
     *
     * @param  array<string, mixed>  $requestBody
     * @return array<string, mixed>
     */
    private function snapshotRequestedShipmentForLog(array $requestBody): array
    {
        $rs = $requestBody['requestedShipment'] ?? null;
        if (! is_array($rs)) {
            return [];
        }

        $partySnap = function (?array $party): array {
            if (! is_array($party)) {
                return [];
            }
            $addr = is_array($party['address'] ?? null) ? $party['address'] : [];
            $contact = is_array($party['contact'] ?? null) ? $party['contact'] : [];

            return [
                'contact' => [
                    'personName' => $contact['personName'] ?? null,
                    'phoneNumber' => $contact['phoneNumber'] ?? null,
                    'companyName' => $contact['companyName'] ?? null,
                ],
                'address' => [
                    'streetLines' => is_array($addr['streetLines'] ?? null) ? $addr['streetLines'] : null,
                    'city' => $addr['city'] ?? null,
                    'stateOrProvinceCode' => $addr['stateOrProvinceCode'] ?? null,
                    'postalCode' => $addr['postalCode'] ?? null,
                    'countryCode' => $addr['countryCode'] ?? null,
                    'residential' => isset($addr['residential']) ? (bool) $addr['residential'] : null,
                ],
            ];
        };

        $recipients = [];
        foreach ((array) ($rs['recipients'] ?? []) as $r) {
            if (is_array($r)) {
                $recipients[] = $partySnap($r);
            }
        }

        $lineItems = [];
        foreach ((array) ($rs['requestedPackageLineItems'] ?? []) as $line) {
            if (! is_array($line)) {
                continue;
            }
            $lineItems[] = [
                'sequenceNumber' => $line['sequenceNumber'] ?? null,
                'weight' => $line['weight'] ?? null,
                'dimensions' => $line['dimensions'] ?? null,
            ];
        }

        return [
            'serviceType' => $rs['serviceType'] ?? null,
            'packagingType' => $rs['packagingType'] ?? null,
            'pickupType' => $rs['pickupType'] ?? null,
            'totalPackageCount' => $rs['totalPackageCount'] ?? null,
            'shipDatestamp' => $rs['shipDatestamp'] ?? null,
            'shipper' => $partySnap($rs['shipper'] ?? null),
            'recipients' => $recipients,
            'requestedPackageLineItems' => $lineItems,
        ];
    }

    /**
     * HTTP 200 with top-level errors array (FedEx sometimes returns errors without non-2xx status).
     *
     * @param  array<string, mixed>  $json
     */
    private function throwFedExShipErrorResponse(array $json, string $transactionId, string $operation, string $message): void
    {
        $errors = is_array($json['errors'] ?? null) ? $json['errors'] : [];

        throw new HttpResponseException(response()->json([
            'message' => $message,
            'fedex_http_status' => 200,
            'fedex_errors' => $this->normalizeFedExShipErrorsList($errors),
            'transaction_id' => $json['transactionId'] ?? null,
            'fedex_operation' => $operation,
        ], 422));
    }
}

<?php

namespace App\Services\FedEx;

use App\Enums\FedExServiceType;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * FedEx Rate API (POST /rate/v1/rates/quotes) — source of truth for {@see FedExServiceType} before Ship validate/create.
 */
class FedExRateApiService
{
    public function __construct(
        private readonly FedExOAuthToken $fedExOAuthToken,
        private readonly FedExDomesticShipPayloadSanitizer $sanitizer,
        private readonly FedExShipApiService $fedExShip,
    ) {}

    /**
     * Sanitizes the payload, then resolves `serviceType` from FedEx Rate (unless disabled / sandbox bypass).
     *
     * @param  array<string, mixed>  $fedexShipData  Domestic FedEx ship shape (pre–address-validation).
     * @return array<string, mixed>
     */
    public function resolveAndApplyServiceType(array $fedexShipData): array
    {
        if ((string) config('fedex.env') === 'sandbox') {
            $data = $this->sanitizer->sanitize($fedexShipData);
            Log::info('FedEx Rate API skipped in sandbox (FEDEX_ENV=sandbox) — no POST /rate/v1/rates/quotes; client serviceType kept after sanitize; Ship uses virtualized body.');

            return $data;
        }

        if (! filter_var(config('fedex.rate_lookup_enabled', true), FILTER_VALIDATE_BOOL)) {
            return $this->sanitizer->sanitize($fedexShipData);
        }

        if ($this->shouldSkipRateForSandboxPolicy()) {
            $data = $this->sanitizer->sanitize($fedexShipData);

            return $this->applySandboxLegacyServiceType($data);
        }

        $data = $this->sanitizer->sanitize($fedexShipData);
        $lane = $this->laneLabel($data);
        $transactionId = (string) Str::uuid();
        $body = $this->fedExShip->buildRateQuotesRequestBody($data);

        $rateResult = $this->postRateRequest($body, $transactionId);

        if (! $rateResult['ok']) {
            if ($this->shouldFallbackSandboxAfterRateFailure()) {
                Log::warning('FedEx Rate API request failed in sandbox; using legacy default/non-contiguous serviceType.', [
                    'transaction_id' => $transactionId,
                    'lane' => $lane,
                    'http_status' => $rateResult['http_status'],
                    'fedex_errors' => $rateResult['json']['errors'] ?? null,
                ]);

                return $this->applySandboxLegacyServiceType($data);
            }

            throw $this->rateUnavailableException($transactionId, $rateResult, $body);
        }

        $json = $rateResult['json'];
        $available = $this->parseServiceTypesFromRateResponse($json);

        Log::info('FedEx Rate API', [
            'transaction_id' => $transactionId,
            'lane' => $lane,
            'requested_shipment_snapshot' => $this->snapshotRequestedShipmentForLog($body),
            'service_types_available' => $available,
            'fedex_transaction_id' => $json['transactionId'] ?? null,
            'rate_response' => $json,
        ]);

        if ($available === []) {
            if ($this->shouldFallbackSandboxAfterRateFailure()) {
                Log::warning('FedEx Rate API returned no rated services in sandbox; using legacy default/non-contiguous serviceType.', [
                    'transaction_id' => $transactionId,
                    'lane' => $lane,
                ]);

                return $this->applySandboxLegacyServiceType($data);
            }

            throw new HttpResponseException(response()->json([
                'message' => 'No FedEx service is available for this route.',
                'code' => 'SERVICE_NOT_AVAILABLE',
            ], 422));
        }

        $chosen = $this->selectServiceType($data, $available);
        if ($chosen === null) {
            if ($this->shouldFallbackSandboxAfterRateFailure()) {
                Log::warning('FedEx Rate API services did not match allowed enums in sandbox; using legacy default/non-contiguous serviceType.', [
                    'transaction_id' => $transactionId,
                    'lane' => $lane,
                    'available' => $available,
                ]);

                return $this->applySandboxLegacyServiceType($data);
            }

            throw new HttpResponseException(response()->json([
                'message' => 'No FedEx service is available for this route.',
                'code' => 'SERVICE_NOT_AVAILABLE',
            ], 422));
        }

        $data['serviceType'] = $chosen;

        Log::info('FedEx Rate API service selected', [
            'transaction_id' => $transactionId,
            'lane' => $lane,
            'serviceType' => $chosen,
        ]);

        return $data;
    }

    /**
     * POST /rate/v1/rates/quotes and return a normalized quote payload for UI.
     *
     * @param  array<string, mixed>  $fedexShipData  Domestic FedEx ship shape (sanitized via {@see FedExDomesticShipPayloadSanitizer}).
     * @return array<string, mixed>
     */
    public function getQuotesForShipment(array $fedexShipData): array
    {
        if ((string) config('fedex.env') === 'sandbox') {
            $data = $this->sanitizer->sanitize($fedexShipData);
            $st = (string) ($data['serviceType'] ?? 'FEDEX_GROUND');
            Log::info('FedEx Rate API quotes skipped in sandbox (FEDEX_ENV=sandbox) — placeholder quote row only (no network).');

            return [
                'transactionId' => null,
                'customerTransactionId' => null,
                'quoteDate' => null,
                'alerts' => [],
                'rateReplyDetails' => [
                    [
                        'serviceType' => $st,
                        'serviceName' => 'Sandbox (Rate API not called)',
                        'packagingType' => (string) ($data['packagingType'] ?? 'YOUR_PACKAGING'),
                        'customerMessages' => [],
                        'operationalDetail' => null,
                        'commit' => null,
                        'ratedShipmentDetails' => [
                            [
                                'rateType' => 'ACCOUNT',
                                'ratedWeightMethod' => null,
                                'totalNetCharge' => null,
                                'totalBaseCharge' => null,
                                'currency' => 'USD',
                                'totalNetChargeWithDutiesAndTaxes' => null,
                            ],
                        ],
                    ],
                ],
            ];
        }

        $data = $this->sanitizer->sanitize($fedexShipData);
        $lane = $this->laneLabel($data);
        $transactionId = (string) Str::uuid();
        $body = $this->fedExShip->buildRateQuotesRequestBody($data);

        $rateResult = $this->postRateRequest($body, $transactionId);

        Log::info('FedEx Rate API quote request', [
            'transaction_id' => $transactionId,
            'lane' => $lane,
            'http_status' => $rateResult['http_status'],
            'fedex_transaction_id' => $rateResult['json']['transactionId'] ?? null,
        ]);

        if (! $rateResult['ok']) {
            throw $this->rateUnavailableException($transactionId, $rateResult, $body);
        }

        $json = $rateResult['json'];
        $normalized = $this->normalizeRateQuoteResponse($json);

        if ($normalized['rateReplyDetails'] === []) {
            throw new HttpResponseException(response()->json([
                'message' => 'No FedEx rate quotes returned for this route.',
                'code' => 'SERVICE_NOT_AVAILABLE',
                'transaction_id' => $json['transactionId'] ?? null,
            ], 422));
        }

        return $normalized;
    }

    /**
     * Trim FedEx Rate response for API consumers (no full raw reply).
     *
     * @param  array<string, mixed>  $json
     * @return array<string, mixed>
     */
    private function normalizeRateQuoteResponse(array $json): array
    {
        $output = is_array($json['output'] ?? null) ? $json['output'] : [];
        $details = is_array($output['rateReplyDetails'] ?? null) ? $output['rateReplyDetails'] : [];
        $trimmed = [];

        foreach ($details as $d) {
            if (! is_array($d)) {
                continue;
            }
            $rated = [];
            foreach ((array) ($d['ratedShipmentDetails'] ?? []) as $rsd) {
                if (! is_array($rsd)) {
                    continue;
                }
                $rt = (string) ($rsd['rateType'] ?? '');
                if (! in_array($rt, ['ACCOUNT', 'LIST', 'PREFERRED_INCENTIVE', 'PREFERRED_CURRENCY'], true)) {
                    continue;
                }
                $rated[] = [
                    'rateType' => $rt,
                    'ratedWeightMethod' => $rsd['ratedWeightMethod'] ?? null,
                    'totalNetCharge' => $rsd['totalNetCharge'] ?? null,
                    'totalBaseCharge' => $rsd['totalBaseCharge'] ?? null,
                    'currency' => $rsd['currency'] ?? null,
                    'totalNetChargeWithDutiesAndTaxes' => $rsd['totalNetChargeWithDutiesAndTaxes'] ?? null,
                ];
            }

            $trimmed[] = [
                'serviceType' => $d['serviceType'] ?? null,
                'serviceName' => $d['serviceName'] ?? null,
                'packagingType' => $d['packagingType'] ?? null,
                'customerMessages' => $d['customerMessages'] ?? [],
                'operationalDetail' => $d['operationalDetail'] ?? null,
                'commit' => $d['commit'] ?? null,
                'ratedShipmentDetails' => $rated,
            ];
        }

        return [
            'transactionId' => $json['transactionId'] ?? null,
            'customerTransactionId' => $json['customerTransactionId'] ?? null,
            'quoteDate' => $output['quoteDate'] ?? null,
            'alerts' => is_array($output['alerts'] ?? null) ? $output['alerts'] : [],
            'rateReplyDetails' => $trimmed,
        ];
    }

    private function shouldSkipRateForSandboxPolicy(): bool
    {
        if (! filter_var(config('fedex.sandbox_skip_rate_eligibility', false), FILTER_VALIDATE_BOOL)) {
            return false;
        }

        return $this->isFedExSandboxApiHost();
    }

    private function shouldFallbackSandboxAfterRateFailure(): bool
    {
        if (! filter_var(config('fedex.sandbox_fallback_on_rate_failure', true), FILTER_VALIDATE_BOOL)) {
            return false;
        }

        return $this->isFedExSandboxApiHost();
    }

    private function isFedExSandboxApiHost(): bool
    {
        $base = strtolower(rtrim((string) config('fedex.base_url'), '/'));

        return str_contains($base, 'apis-sandbox.fedex.com');
    }

    /**
     * @param  array<string, mixed>  $data  Sanitized ship data
     * @return array<string, mixed>
     */
    private function applySandboxLegacyServiceType(array $data): array
    {
        $addr = is_array($data['shipper']['address'] ?? null) ? $data['shipper']['address'] : [];
        $country = strtoupper(substr((string) ($addr['countryCode'] ?? 'US'), 0, 2));
        $state = strtoupper(trim((string) ($addr['stateOrProvinceCode'] ?? '')));

        if ($country === 'US' && ($state === 'HI' || $state === 'AK')) {
            $svc = (string) config('fedex.non_contiguous_origin_service_type', 'FEDEX_EXPRESS_SAVER');
            $data['serviceType'] = $svc !== '' ? $svc : 'FEDEX_EXPRESS_SAVER';
        } else {
            $data['serviceType'] = (string) (config('fedex.default_service_type', 'FEDEX_GROUND') ?: 'FEDEX_GROUND');
        }

        Log::warning('FedEx Rate API skipped (FEDEX_SANDBOX_SKIP_RATE_ELIGIBILITY). Using legacy default/non-contiguous serviceType — not for production.', [
            'serviceType' => $data['serviceType'],
            'lane' => $this->laneLabel($data),
        ]);

        return $data;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $available
     */
    private function selectServiceType(array $data, array $available): ?string
    {
        $enumAllowed = [];
        foreach (FedExServiceType::cases() as $c) {
            $enumAllowed[$c->value] = true;
        }

        $filtered = [];
        foreach ($available as $svc) {
            if (! is_string($svc) || $svc === '') {
                continue;
            }
            if (isset($enumAllowed[$svc])) {
                $filtered[] = $svc;
            }
        }
        $filtered = array_values(array_unique($filtered));
        if ($filtered === []) {
            return null;
        }

        $workingSet = $filtered;
        if ($this->shouldDeprioritizeGroundForNonContiguousLane($data)) {
            $withoutGround = array_values(array_filter(
                $filtered,
                fn (string $s) => ! in_array($s, ['FEDEX_GROUND', 'GROUND_HOME_DELIVERY'], true)
            ));
            if ($withoutGround !== []) {
                $workingSet = $withoutGround;
            }
        }

        $requested = trim((string) ($data['serviceType'] ?? ''));
        // Contiguous US lanes: never replace the client's requested enum with a different Rate API option
        // (e.g. FIRST_OVERNIGHT) when Ground was not returned in rateReplyDetails.
        if ($requested !== '' && FedExServiceType::tryFrom($requested) !== null) {
            if (! $this->shouldDeprioritizeGroundForNonContiguousLane($data)) {
                return $requested;
            }
            if (in_array($requested, $workingSet, true)) {
                return $requested;
            }
        }

        $placeholder = (string) config('fedex.rate_placeholder_service_type', 'FEDEX_GROUND');
        $preference = $this->preferenceListForData($data);

        $ordered = [];
        $skipRequestedFirst = $this->isNonContiguousUsOrigin($data)
            && $requested === $placeholder
            && $requested !== '';

        if ($requested !== '' && in_array($requested, $workingSet, true) && ! $skipRequestedFirst) {
            $ordered[] = $requested;
        }
        foreach ($preference as $p) {
            if ($p !== '' && ! in_array($p, $ordered, true)) {
                $ordered[] = $p;
            }
        }
        foreach ($ordered as $svc) {
            if (in_array($svc, $workingSet, true)) {
                return $svc;
            }
        }

        return $workingSet[0];
    }

    /**
     * US shipper in HI or AK (FedEx non-contiguous origins).
     *
     * @param  array<string, mixed>  $data
     */
    private function isNonContiguousUsOrigin(array $data): bool
    {
        $addr = is_array($data['shipper']['address'] ?? null) ? $data['shipper']['address'] : [];
        $country = strtoupper(substr((string) ($addr['countryCode'] ?? 'US'), 0, 2));
        $state = strtoupper(trim((string) ($addr['stateOrProvinceCode'] ?? '')));

        return $country === 'US' && ($state === 'HI' || $state === 'AK');
    }

    /**
     * HI/AK → US domestic where Ground is often invalid for Ship even if Rate lists it (e.g. HI → AZ).
     * Intra-HI / intra-AK keeps Ground eligible when Rate returns it.
     *
     * @param  array<string, mixed>  $data
     */
    private function shouldDeprioritizeGroundForNonContiguousLane(array $data): bool
    {
        if (! $this->isNonContiguousUsOrigin($data)) {
            return false;
        }

        $rec = $data['recipients'][0] ?? null;
        if (! is_array($rec)) {
            return false;
        }
        $addr = is_array($rec['address'] ?? null) ? $rec['address'] : [];
        if (strtoupper(substr((string) ($addr['countryCode'] ?? ''), 0, 2)) !== 'US') {
            return false;
        }

        $destState = strtoupper(trim((string) ($addr['stateOrProvinceCode'] ?? '')));
        $shipAddr = is_array($data['shipper']['address'] ?? null) ? $data['shipper']['address'] : [];
        $originState = strtoupper(trim((string) ($shipAddr['stateOrProvinceCode'] ?? '')));

        if ($originState === 'HI' && $destState === 'HI') {
            return false;
        }
        if ($originState === 'AK' && $destState === 'AK') {
            return false;
        }

        return true;
    }

    /**
     * @return array<int, string>
     */
    private function preferenceListForData(array $data): array
    {
        $raw = (string) config('fedex.rate_service_preference', '');
        $parts = array_values(array_filter(array_map('trim', explode(',', $raw)), fn ($s) => $s !== ''));
        if ($parts !== []) {
            return $parts;
        }

        if ($this->shouldDeprioritizeGroundForNonContiguousLane($data)) {
            return [
                'FEDEX_2_DAY',
                'FEDEX_EXPRESS_SAVER',
                'PRIORITY_OVERNIGHT',
                'STANDARD_OVERNIGHT',
                'FIRST_OVERNIGHT',
                'FEDEX_GROUND',
                'GROUND_HOME_DELIVERY',
                'INTERNATIONAL_PRIORITY',
                'INTERNATIONAL_ECONOMY',
            ];
        }

        return [
            'FEDEX_GROUND',
            'GROUND_HOME_DELIVERY',
            'FEDEX_2_DAY',
            'FEDEX_EXPRESS_SAVER',
            'PRIORITY_OVERNIGHT',
            'STANDARD_OVERNIGHT',
            'FIRST_OVERNIGHT',
            'INTERNATIONAL_PRIORITY',
            'INTERNATIONAL_ECONOMY',
        ];
    }

    /**
     * @param  array<string, mixed>  $json
     * @return array<int, string>
     */
    private function parseServiceTypesFromRateResponse(array $json): array
    {
        $out = [];
        $details = data_get($json, 'output.rateReplyDetails', []);
        if (! is_array($details)) {
            return [];
        }
        foreach ($details as $d) {
            if (! is_array($d)) {
                continue;
            }
            $st = $d['serviceType'] ?? null;
            if (is_string($st) && $st !== '') {
                $out[] = $st;
            }
            $svcDesc = $d['serviceDescription'] ?? null;
            if (is_array($svcDesc) && isset($svcDesc['serviceType']) && is_string($svcDesc['serviceType']) && $svcDesc['serviceType'] !== '') {
                $out[] = $svcDesc['serviceType'];
            }
            foreach ((array) ($d['ratedShipmentDetails'] ?? []) as $rsd) {
                if (! is_array($rsd)) {
                    continue;
                }
                $r = $rsd['serviceType'] ?? null;
                if (is_string($r) && $r !== '') {
                    $out[] = $r;
                }
            }
        }

        return array_values(array_unique($out));
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function laneLabel(array $data): string
    {
        $ship = is_array($data['shipper']['address'] ?? null) ? $data['shipper']['address'] : [];
        $rec = is_array(($data['recipients'][0] ?? null) ? $data['recipients'][0]['address'] : null)
            ? $data['recipients'][0]['address']
            : [];

        $o = strtoupper((string) ($ship['stateOrProvinceCode'] ?? '?')).'/'.strtoupper((string) ($ship['countryCode'] ?? '?'));
        $d = strtoupper((string) ($rec['stateOrProvinceCode'] ?? '?')).'/'.strtoupper((string) ($rec['countryCode'] ?? '?'));

        return $o.' → '.$d;
    }

    /**
     * @param  array<string, mixed>  $requestBody  Rate API root body
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
            $addr = $party['address'] ?? [];
            $contact = $party['contact'] ?? [];

            return [
                'personName' => isset($contact['personName']) ? (string) $contact['personName'] : null,
                'phoneNumber' => isset($contact['phoneNumber']) ? (string) $contact['phoneNumber'] : null,
                'streetLines' => is_array($addr['streetLines'] ?? null) ? $addr['streetLines'] : null,
                'city' => isset($addr['city']) ? (string) $addr['city'] : null,
                'stateOrProvinceCode' => isset($addr['stateOrProvinceCode']) ? (string) $addr['stateOrProvinceCode'] : null,
                'postalCode' => isset($addr['postalCode']) ? (string) $addr['postalCode'] : null,
                'countryCode' => isset($addr['countryCode']) ? (string) $addr['countryCode'] : null,
                'residential' => isset($addr['residential']) ? (bool) $addr['residential'] : null,
            ];
        };

        $recipient = $rs['recipient'] ?? null;
        $recSnap = is_array($recipient) ? $partySnap($recipient) : [];

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
            'packagingType' => $rs['packagingType'] ?? null,
            'pickupType' => $rs['pickupType'] ?? null,
            'totalPackageCount' => $rs['totalPackageCount'] ?? null,
            'shipDateStamp' => $rs['shipDateStamp'] ?? $rs['shipDatestamp'] ?? null,
            'shipper' => $partySnap($rs['shipper'] ?? null),
            'recipient' => $recSnap,
            'requestedPackageLineItems' => $lineItems,
        ];
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array{ok: bool, http_status: int, json: array<string, mixed>}
     */
    private function postRateRequest(array $body, string $transactionId): array
    {
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);
        $token = $this->fedExOAuthToken->getToken();

        $response = FedExHttp::pending($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $transactionId,
            ])
            ->withToken($token)
            ->post($base.'/rate/v1/rates/quotes', $body);

        $json = $response->json() ?? [];
        if (! is_array($json)) {
            $json = [];
        }

        $hasTopLevelErrors = ! empty($json['errors']) && is_array($json['errors']);
        $ok = $response->successful() && ! $hasTopLevelErrors;

        if (! $response->successful()) {
            Log::error('FedEx Rate API HTTP error', [
                'transaction_id' => $transactionId,
                'http_status' => $response->status(),
                'fedex_transaction_id' => $json['transactionId'] ?? null,
                'error' => Str::limit((string) json_encode($json), 8000),
                'requested_shipment_snapshot' => $this->snapshotRequestedShipmentForLog($body),
            ]);
        } elseif ($hasTopLevelErrors) {
            Log::error('FedEx Rate API returned errors', [
                'transaction_id' => $transactionId,
                'fedex_transaction_id' => $json['transactionId'] ?? null,
                'error' => Str::limit((string) json_encode($json), 8000),
                'requested_shipment_snapshot' => $this->snapshotRequestedShipmentForLog($body),
            ]);
        }

        return [
            'ok' => $ok,
            'http_status' => $response->status(),
            'json' => $json,
        ];
    }

    /**
     * @param  array{ok: bool, http_status: int, json: array<string, mixed>}  $rateResult
     * @param  array<string, mixed>  $requestBody
     */
    private function rateUnavailableException(string $transactionId, array $rateResult, array $requestBody): HttpResponseException
    {
        $json = $rateResult['json'];

        return new HttpResponseException(response()->json([
            'message' => 'No FedEx service is available for this route.',
            'code' => 'SERVICE_NOT_AVAILABLE',
            'fedex_http_status' => $rateResult['http_status'],
            'transaction_id' => $json['transactionId'] ?? null,
            'fedex_errors' => $json['errors'] ?? null,
        ], 422));
    }
}

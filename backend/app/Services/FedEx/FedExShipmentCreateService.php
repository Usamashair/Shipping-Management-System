<?php

namespace App\Services\FedEx;

use App\Enums\FedExServiceType;
use App\Jobs\CheckAsyncShipmentJob;
use App\Models\Shipment;
use App\Models\User;
use App\Services\FixedRecipientService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Orchestrates FedEx label creation for validated Ship payloads.
 *
 * Call chain (POST /api/fedex/shipments and legacy ShipmentService::createForUser):
 *   FedExShipController::store() [or ShipmentService::createForUser]
 *     → FedExShipmentCreateService::create()
 *       → AddressValidationService::validateAddresses()     [POST /address/v1/addresses/resolve] — not called when FEDEX_ENV=sandbox
 *       → FedExRateApiService::resolveAndApplyServiceType()  [POST /rate/v1/rates/quotes] — not called when FEDEX_ENV=sandbox
 *       → FedExShipApiService::validateShipment()          [POST /ship/v1/shipments/packages/validate] — not called when FEDEX_ENV=sandbox
 *       → FedExShipApiService::createShipment()             [POST /ship/v1/shipments] — FEDEX_ENV=sandbox uses createShipmentSandboxVirtualized() only
 *
 * In sandbox, Rate/address/validate are skipped so real addresses never hit those hosts; Ship create posts FedEx’s virtualized sample JSON.
 * API error bodies use `fedex_operation` for validate vs create. Production create uses `FedExShipApiService::buildRootPayload()`.
 */
class FedExShipmentCreateService
{
    public function __construct(
        private readonly FedExShipApiService $fedExShip,
        private readonly AddressValidationService $addressValidation,
        private readonly FedExRateApiService $fedExRate,
    ) {}

    public static function isConfigured(): bool
    {
        return filled(config('fedex.client_id'))
            && filled(config('fedex.client_secret'))
            && filled(config('fedex.account_number'));
    }

    /**
     * @param  array<string, mixed>  $fedexShipData  Validated FedEx ship shape (includes is_residential; no confirm_warnings).
     */
    public function create(User $user, array $fedexShipData, bool $confirmWarnings): Shipment
    {
        if ((string) config('fedex.env') === 'sandbox') {
            Log::info('FedEx sandbox fast path: pre-flight will not call live Address or Rate (fedex.env=sandbox); Ship create will use virtualized sample payload only.');
        }

        $fixedRecipient = FixedRecipientService::rawOrDefault();
        $fedexShipData['recipients'] = FixedRecipientService::asFedExRecipientsArray();

        Log::info('Fixed recipient applied', [
            'recipient' => $fixedRecipient['personName'] ?? null,
            'address' => ($fixedRecipient['address']['city'] ?? '').', '
                .($fixedRecipient['address']['stateOrProvinceCode'] ?? ''),
        ]);

        Log::debug('Incoming FedEx ship create data', ['data' => $fedexShipData]);

        $recipient = $fedexShipData['recipients'][0];
        $addr = $recipient['address'];
        $addrLines = is_array($addr['streetLines'] ?? null) ? $addr['streetLines'] : [];

        if ($this->shouldSkipAddressValidationForShipCreate()) {
            Log::warning('FedEx address validation skipped (FEDEX_SKIP_ADDRESS_VALIDATION_IN_SANDBOX). Ship create only; not for production.');
            $addrResult = $this->syntheticAddressValidationPassResult(
                'Sandbox: address validation skipped. Use FedEx sample payloads or production for real validation.'
            );
        } elseif ((string) config('fedex.env') === 'sandbox') {
            Log::info('FedEx address validation skipped in sandbox (FEDEX_ENV=sandbox: virtualized Ship only; use production for real validation).');
            $addrResult = $this->syntheticAddressValidationPassResult(
                'Sandbox: address validation not called. Recipient data is still saved with your shipment. Use production for real FedEx address resolution.'
            );
        } else {
            $addrResult = $this->addressValidation->validateAddresses([
                [
                    'streetLines' => array_values(array_filter($addrLines, fn ($s) => is_string($s) && $s !== '')),
                    'city' => (string) ($addr['city'] ?? ''),
                    'stateOrProvinceCode' => (string) ($addr['stateOrProvinceCode'] ?? ''),
                    'postalCode' => (string) ($addr['postalCode'] ?? ''),
                    'countryCode' => (string) ($addr['countryCode'] ?? ''),
                ],
            ], $this->fedexAddressValidationInEffectDate());
        }

        $first = $addrResult['results'][0] ?? null;
        if (! is_array($first) || empty($first['isValid'])) {
            throw new HttpResponseException(response()->json([
                'message' => 'Recipient address must be validated and confirmed by FedEx before shipping.',
                'address_validation' => $first,
            ], 422));
        }

        $fedexShipData = $this->fedExRate->resolveAndApplyServiceType($fedexShipData);

        $skipValidate = filter_var(config('fedex.skip_ship_validate', false), FILTER_VALIDATE_BOOL);

        try {
            [$create, $fedexShipData] = $this->shipValidateAndCreateWithSandboxRetries(
                $fedexShipData,
                $confirmWarnings,
                $skipValidate
            );
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx ship create failed.', ['message' => $e->getMessage()]);
            throw new HttpResponseException(response()->json(['message' => $e->getMessage()], 502));
        }

        $tracking = $create['trackingNumber'] ?? null;
        if (($tracking === null || $tracking === '') && ! empty($create['jobId'])) {
            // Async flow: FedEx may return jobId before transactionShipments are populated; poll replaces this.
            $tracking = 'FEDEX-ASYNC-'.Str::upper(Str::limit((string) $create['jobId'], 32, ''));
        }
        if ($tracking === null || $tracking === '') {
            throw new HttpResponseException(response()->json([
                'message' => 'FedEx did not return a tracking number. If the shipment was queued, ensure the queue worker is running to poll /ship/v1/shipments/results.',
                'fedex_job_id' => $create['jobId'] ?? null,
            ], 502));
        }

        $senderDetails = $this->partyToLegacyAddress($fedexShipData['shipper']);
        $receiverDetails = $this->partyToLegacyAddress($recipient);
        if ($fixedRecipient['email'] !== '') {
            $receiverDetails['email'] = $fixedRecipient['email'];
        }
        $pkg = $fedexShipData['packages'][0];
        $packageDetails = [
            'weightLb' => (float) data_get($pkg, 'weight.value'),
            'lengthIn' => (int) data_get($pkg, 'dimensions.length'),
            'widthIn' => (int) data_get($pkg, 'dimensions.width'),
            'heightIn' => (int) data_get($pkg, 'dimensions.height'),
            'description' => (string) data_get($pkg, 'description', 'FedEx shipment'),
        ];

        $shipment = Shipment::query()->create([
            'user_id' => $user->id,
            'tracking_number' => $tracking,
            'fedex_tracking_number' => $tracking,
            'sender_details' => $senderDetails,
            'receiver_details' => $receiverDetails,
            'package_details' => $packageDetails,
            'status' => 'label_created',
            'label_url' => $create['labelUrl'],
            'label_path' => null,
            'service_type' => $fedexShipData['serviceType'],
            'pickup_type' => $fedexShipData['pickupType'],
            'package_weight' => $packageDetails['weightLb'],
            'package_dimensions' => [
                'length' => $packageDetails['lengthIn'],
                'width' => $packageDetails['widthIn'],
                'height' => $packageDetails['heightIn'],
                'units' => 'IN',
            ],
            'is_residential' => (bool) ($fedexShipData['is_residential'] ?? false),
            'fedex_response' => $create['raw'],
            'fedex_transaction_id' => $create['transaction_id'],
            'fedex_job_id' => $create['jobId'],
            'shipped_at' => now(),
        ]);

        if (! empty($create['labelBase64'])) {
            $binary = base64_decode((string) $create['labelBase64'], true) ?: '';
            $relative = $shipment->id.'.pdf';
            Storage::disk('labels')->put($relative, $binary);
            $shipment->label_path = $relative;
            $shipment->label_url = null;
            $shipment->save();
        }

        if (! empty($create['jobId'])
            && empty($create['labelUrl'])
            && empty($create['labelBase64'])) {
            CheckAsyncShipmentJob::dispatch($shipment->id);
        }

        return $shipment->fresh();
    }

    /**
     * @param  array<string, mixed>  $fedexShipData
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    private function shipValidateAndCreateWithSandboxRetries(
        array $fedexShipData,
        bool $confirmWarnings,
        bool $skipValidate,
    ): array {
        $pickupWaves = $this->sandboxPickupTypeWaves($fedexShipData);
        $lastException = null;

        foreach ($pickupWaves as $pickupIdx => $pickupType) {
            $base = $fedexShipData;
            $base['pickupType'] = $pickupType;

            $attempts = $this->shipCreateServiceTypeAttempts($base);

            foreach ($attempts as $index => $serviceType) {
                $data = $base;
                $data['serviceType'] = $serviceType;

                if ($skipValidate) {
                    Log::warning('FedEx Ship validate skipped (FEDEX_SKIP_SHIP_VALIDATE). Preflight alerts from packages/validate are not run.');
                } elseif ((string) config('fedex.env') === 'sandbox') {
                    Log::info('FedEx shipment validation skipped in sandbox (virtualized environment; packages/validate is stricter than Ship create and often fails in sandbox).');
                } else {
                    $validateResult = $this->fedExShip->validateShipment($data);
                    if ($validateResult['alerts'] !== [] && ! $confirmWarnings) {
                        throw new HttpResponseException(response()->json([
                            'message' => 'FedEx returned validation warnings. Review alerts and resubmit with confirm_warnings=true.',
                            'alerts' => $validateResult['alerts'],
                        ], 422));
                    }
                }

                try {
                    return [$this->fedExShip->createShipment($data), $data];
                } catch (HttpResponseException $e) {
                    $lastException = $e;

                    if (! $this->shouldRetryFedExShipCreate($e, $data)) {
                        throw $e;
                    }

                    $moreServices = $index < count($attempts) - 1;
                    $morePickups = $pickupIdx < count($pickupWaves) - 1;

                    if ($moreServices) {
                        Log::warning('FedEx Ship create returned INVALID.INPUT in sandbox; retrying with alternate serviceType.', [
                            'lane' => $this->laneLabel($data),
                            'pickupType' => $pickupType,
                            'failed_service_type' => $serviceType,
                            'remaining_service_types' => array_slice($attempts, $index + 1),
                        ]);

                        continue;
                    }

                    if ($morePickups) {
                        Log::warning('FedEx Ship create returned INVALID.INPUT in sandbox; retrying with alternate pickupType.', [
                            'lane' => $this->laneLabel($data),
                            'failed_pickup_type' => $pickupType,
                            'next_pickup_type' => $pickupWaves[$pickupIdx + 1] ?? null,
                            'failed_service_type' => $serviceType,
                        ]);

                        break;
                    }

                    throw $this->maybeWrapSandboxMainlandShipFailure($e, $fedexShipData);
                }
            }
        }

        if ($lastException instanceof HttpResponseException) {
            throw $this->maybeWrapSandboxMainlandShipFailure($lastException, $fedexShipData);
        }

        throw new HttpResponseException(response()->json(['message' => 'FedEx Ship create failed.'], 502));
    }

    /**
     * @param  array<string, mixed>  $fedexShipData
     * @return array<int, string>
     */
    private function sandboxPickupTypeWaves(array $fedexShipData): array
    {
        $current = trim((string) ($fedexShipData['pickupType'] ?? 'USE_SCHEDULED_PICKUP'));
        if ($current === '') {
            $current = 'USE_SCHEDULED_PICKUP';
        }

        if ((string) config('fedex.env') === 'sandbox') {
            return [$current];
        }

        if (! $this->isFedExSandboxApiHost()
            || ! filter_var(config('fedex.sandbox_retry_ship_create_on_invalid_input', true), FILTER_VALIDATE_BOOL)
            || ! $this->isNonContiguousUsToMainlandLane($fedexShipData)) {
            return [$current];
        }

        $alternates = config('fedex.sandbox_ship_create_alternate_pickup_types');
        if (! is_array($alternates)) {
            $alternates = [];
        }

        $out = [];
        foreach (array_merge([$current], $alternates) as $pt) {
            if (! is_string($pt) || $pt === '') {
                continue;
            }
            if (in_array($pt, $out, true)) {
                continue;
            }
            $out[] = $pt;
        }

        return $out !== [] ? $out : [$current];
    }

    /**
     * @param  array<string, mixed>  $fedexShipData  Original payload (pickup before wave overrides).
     */
    private function maybeWrapSandboxMainlandShipFailure(HttpResponseException $e, array $fedexShipData): HttpResponseException
    {
        if (! $this->isFedExSandboxApiHost() || ! $this->isNonContiguousUsToMainlandLane($fedexShipData)) {
            return $e;
        }

        $response = $e->getResponse();
        if ($response->getStatusCode() !== 422) {
            return $e;
        }

        $payload = $response instanceof JsonResponse
            ? $response->getData(true)
            : json_decode($response->getContent(), true);
        if (! is_array($payload)) {
            return $e;
        }

        if (($payload['fedex_operation'] ?? '') !== 'create') {
            return $e;
        }

        $hasInvalidInput = false;
        foreach ($payload['fedex_errors'] ?? [] as $err) {
            if (is_array($err) && (($err['code'] ?? '') === 'INVALID.INPUT.EXCEPTION')) {
                $hasInvalidInput = true;
                break;
            }
        }
        if (! $hasInvalidInput) {
            return $e;
        }

        $payload['code'] = 'FEDEX_SANDBOX_SHIP_RESTRICTED';
        $payload['message'] = 'FedEx sandbox rejected Ship create for this Hawaii/Alaska to mainland route after alternate service and pickup options. The sandbox often does not support real HI/AK outbound labels; use production API credentials, a FedEx-documented sandbox test lane, or FedEx Developer Support.';
        $payload['hint'] = 'Optional: set FEDEX_SANDBOX_SKIP_RATE_ELIGIBILITY=true for legacy selection only, or test a mainland lane (e.g. TN→GA).';

        return new HttpResponseException(response()->json($payload, 422));
    }

    /**
     * @param  array<string, mixed>  $fedexShipData
     * @return array<int, string>
     */
    private function shipCreateServiceTypeAttempts(array $fedexShipData): array
    {
        $current = trim((string) ($fedexShipData['serviceType'] ?? ''));
        if ($current === '') {
            return [];
        }

        if ((string) config('fedex.env') === 'sandbox') {
            return [$current];
        }

        if (! $this->isFedExSandboxApiHost()
            || ! filter_var(config('fedex.sandbox_retry_ship_create_on_invalid_input', true), FILTER_VALIDATE_BOOL)
            || ! $this->isSandboxShipCreateRetryLane($fedexShipData)) {
            return [$current];
        }

        $alternates = config('fedex.sandbox_ship_create_alternate_service_types');
        if (! is_array($alternates)) {
            $alternates = [];
        }
        $alternates = $this->mergeSandboxShipCreateAlternateDefaults($alternates);

        $out = [];
        foreach (array_merge([$current], $alternates) as $svc) {
            if (! is_string($svc) || $svc === '') {
                continue;
            }
            if (in_array($svc, $out, true)) {
                continue;
            }
            if (FedExServiceType::tryFrom($svc) === null) {
                continue;
            }
            $out[] = $svc;
        }

        return $out !== [] ? $out : [$current];
    }

    /**
     * Env may set FEDEX_SANDBOX_SHIP_CREATE_ALTERNATE_SERVICE_TYPES to a single value (e.g. FEDEX_2_DAY only),
     * which exhausts retries after one alternate. Merge FedEx-supported express fallbacks (deduped later).
     *
     * @param  array<int, string>  $alternates
     * @return array<int, string>
     */
    private function mergeSandboxShipCreateAlternateDefaults(array $alternates): array
    {
        foreach ([
            'FEDEX_2_DAY',
            'FEDEX_EXPRESS_SAVER',
            'PRIORITY_OVERNIGHT',
            'STANDARD_OVERNIGHT',
            'FIRST_OVERNIGHT',
        ] as $svc) {
            if (! in_array($svc, $alternates, true)) {
                $alternates[] = $svc;
            }
        }

        return $alternates;
    }

    private function shouldRetryFedExShipCreate(HttpResponseException $e, array $fedexShipData): bool
    {
        if ((string) config('fedex.env') === 'sandbox') {
            return false;
        }

        if (! $this->isFedExSandboxApiHost()) {
            return false;
        }

        if (! $this->isSandboxShipCreateRetryLane($fedexShipData)) {
            return false;
        }

        $response = $e->getResponse();
        if ($response->getStatusCode() !== 422) {
            return false;
        }

        $payload = $response instanceof JsonResponse
            ? $response->getData(true)
            : json_decode($response->getContent(), true);
        if (! is_array($payload)) {
            return false;
        }

        if (($payload['fedex_operation'] ?? '') !== 'create') {
            return false;
        }

        foreach ($payload['fedex_errors'] ?? [] as $err) {
            if (is_array($err) && (($err['code'] ?? '') === 'INVALID.INPUT.EXCEPTION')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Sandbox: retry Ship create with alternate service types for HI/AK→mainland and for contiguous US domestic
     * lanes (sandbox often rejects FEDEX_GROUND on create even when Rate returns it).
     *
     * @param  array<string, mixed>  $data
     */
    private function isSandboxShipCreateRetryLane(array $data): bool
    {
        return $this->isNonContiguousUsToMainlandLane($data)
            || $this->isContiguousUsDomesticLane($data);
    }

    /**
     * US→US where neither origin nor destination is HI or AK (lower 48 + DC-style domestic; excludes non-contiguous).
     *
     * @param  array<string, mixed>  $data
     */
    private function isContiguousUsDomesticLane(array $data): bool
    {
        $ship = is_array($data['shipper']['address'] ?? null) ? $data['shipper']['address'] : [];
        $rec = $data['recipients'][0] ?? null;
        if (! is_array($rec)) {
            return false;
        }
        $r = is_array($rec['address'] ?? null) ? $rec['address'] : [];

        if (strtoupper(substr((string) ($ship['countryCode'] ?? 'US'), 0, 2)) !== 'US'
            || strtoupper(substr((string) ($r['countryCode'] ?? ''), 0, 2)) !== 'US') {
            return false;
        }

        $originState = strtoupper(trim((string) ($ship['stateOrProvinceCode'] ?? '')));
        $destState = strtoupper(trim((string) ($r['stateOrProvinceCode'] ?? '')));
        $nonContiguous = ['HI', 'AK'];

        if ($originState === '' || $destState === '') {
            return false;
        }

        if (in_array($originState, $nonContiguous, true) || in_array($destState, $nonContiguous, true)) {
            return false;
        }

        return true;
    }

    /**
     * US HI/AK origin to another US state (not intra-HI / intra-AK).
     *
     * @param  array<string, mixed>  $data
     */
    private function isNonContiguousUsToMainlandLane(array $data): bool
    {
        $addr = is_array($data['shipper']['address'] ?? null) ? $data['shipper']['address'] : [];
        $country = strtoupper(substr((string) ($addr['countryCode'] ?? 'US'), 0, 2));
        $originState = strtoupper(trim((string) ($addr['stateOrProvinceCode'] ?? '')));
        if ($country !== 'US' || ($originState !== 'HI' && $originState !== 'AK')) {
            return false;
        }

        $rec = $data['recipients'][0] ?? null;
        if (! is_array($rec)) {
            return false;
        }
        $r = is_array($rec['address'] ?? null) ? $rec['address'] : [];
        if (strtoupper(substr((string) ($r['countryCode'] ?? ''), 0, 2)) !== 'US') {
            return false;
        }

        $destState = strtoupper(trim((string) ($r['stateOrProvinceCode'] ?? '')));
        if ($originState === 'HI' && $destState === 'HI') {
            return false;
        }
        if ($originState === 'AK' && $destState === 'AK') {
            return false;
        }

        return true;
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
     * @return array{results: array<int, array{isValid: bool, resolvedAddress: null, alerts: array<int, string>}>}
     */
    private function syntheticAddressValidationPassResult(string $alert): array
    {
        return [
            'results' => [
                [
                    'isValid' => true,
                    'resolvedAddress' => null,
                    'alerts' => [$alert],
                ],
            ],
        ];
    }

    private function shouldSkipAddressValidationForShipCreate(): bool
    {
        if (! filter_var(config('fedex.skip_address_validation_in_sandbox', false), FILTER_VALIDATE_BOOL)) {
            return false;
        }

        return $this->isFedExSandboxApiHost();
    }

    /**
     * Optional FedEx Address Validation `inEffectAsOfTimestamp` (Y-m-d) for ship create from config.
     */
    private function fedexAddressValidationInEffectDate(): ?string
    {
        $v = config('fedex.address_validation_in_effect_as_of');

        return is_string($v) && $v !== '' ? $v : null;
    }

    private function isFedExSandboxApiHost(): bool
    {
        $base = strtolower(rtrim((string) config('fedex.base_url'), '/'));

        return str_contains($base, 'apis-sandbox.fedex.com');
    }

    /**
     * @param  array<string, mixed>  $party
     * @return array<string, mixed>
     */
    private function partyToLegacyAddress(array $party): array
    {
        $c = is_array($party['contact'] ?? null) ? $party['contact'] : [];
        $a = is_array($party['address'] ?? null) ? $party['address'] : [];
        $lines = is_array($a['streetLines'] ?? null) ? $a['streetLines'] : [];

        return [
            'name' => (string) ($c['personName'] ?? ''),
            'company' => (string) ($c['companyName'] ?? ''),
            'street1' => (string) ($lines[0] ?? ''),
            'street2' => (string) ($lines[1] ?? ''),
            'city' => (string) ($a['city'] ?? ''),
            'state' => (string) ($a['stateOrProvinceCode'] ?? ''),
            'postalCode' => (string) ($a['postalCode'] ?? ''),
            'country' => (string) ($a['countryCode'] ?? ''),
            'phone' => (string) ($c['phoneNumber'] ?? ''),
        ];
    }
}

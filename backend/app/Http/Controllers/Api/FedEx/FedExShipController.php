<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\CancelFedExTagRequest;
use App\Http\Requests\Api\StoreFedExShipRequest;
use App\Http\Requests\Api\StoreFedExTagRequest;
use App\Http\Requests\Api\ValidateFedExShipRequest;
use App\Http\Resources\ShipmentResource;
use App\Models\Shipment;
use App\Services\FedEx\AddressValidationService;
use App\Services\FedEx\FedExShipApiService;
use App\Services\FedEx\FedExShipmentCreateService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class FedExShipController extends Controller
{
    public function __construct(
        private readonly FedExShipApiService $fedExShip,
        private readonly AddressValidationService $addressValidation,
        private readonly FedExShipmentCreateService $fedExShipmentCreate,
    ) {}

    public function validateShipment(ValidateFedExShipRequest $request): JsonResponse
    {
        if (! $this->fedExConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        try {
            $data = $request->validated();
            $data['is_residential'] = (bool) ($data['is_residential'] ?? false);
            Log::debug('Incoming FedEx ship validate data', ['data' => $data]);
            $result = $this->fedExShip->validateShipment($data);
            $raw = $result['raw'];

            return response()->json([
                'alerts' => $result['alerts'],
                'transaction_id' => $result['transaction_id'],
                'fedex_transaction_id' => isset($raw['transactionId']) ? (string) $raw['transactionId'] : null,
            ]);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx ship validate failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function store(StoreFedExShipRequest $request): JsonResponse
    {
        if (! $this->fedExConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        $user = $request->user();
        $data = $request->validated();
        $data['is_residential'] = (bool) ($data['is_residential'] ?? false);
        $confirmWarnings = (bool) ($data['confirm_warnings'] ?? false);
        unset($data['confirm_warnings']);

        Log::debug('Incoming request data', ['data' => $data]);

        // FedEx pre-flight (Address, Rate, packages/validate) is handled inside FedExShipmentCreateService::create; sandbox is gated by config('fedex.env').

        try {
            $shipment = $this->fedExShipmentCreate->create($user, $data, $confirmWarnings);

            return (new ShipmentResource($shipment))->response()->setStatusCode(201);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx ship create failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function cancel(Request $request, Shipment $shipment): JsonResponse
    {
        $this->authorize('cancel', $shipment);

        if (! $this->fedExConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        if (! filled(config('fedex.account_number'))) {
            return response()->json(['message' => 'FedEx account number is not configured.'], 502);
        }

        try {
            $sender = is_array($shipment->sender_details) ? $shipment->sender_details : [];
            $country = strtoupper(substr((string) ($sender['country'] ?? 'US'), 0, 2));
            $result = $this->fedExShip->cancelShipment($shipment->tracking_number, $country);
            if ($result['cancelled']) {
                $shipment->status = 'cancelled';
                $shipment->save();
            }

            return response()->json([
                'success' => $result['cancelled'],
                'message' => $result['message'],
            ]);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx ship cancel failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function asyncStatus(Request $request, string $jobId): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $shipment = Shipment::query()->where('fedex_job_id', $jobId)->first();
        if ($shipment === null) {
            return response()->json(['message' => 'Shipment job not found.'], 404);
        }

        $this->authorize('view', $shipment);

        if (! $this->fedExConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        if (! filled(config('fedex.account_number'))) {
            return response()->json(['message' => 'FedEx account number is not configured.'], 502);
        }

        try {
            $raw = $this->fedExShip->retrieveAsyncShipment($jobId);

            return response()->json([
                'transaction_id' => $raw['transactionId'] ?? null,
                'customer_transaction_id' => $raw['customerTransactionId'] ?? null,
                'output' => $raw['output'] ?? null,
            ]);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx async status failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function createTag(StoreFedExTagRequest $request): JsonResponse
    {
        if (! $this->fedExConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        $data = $request->validated();
        $data['is_residential'] = (bool) ($data['is_residential'] ?? false);
        $confirmWarnings = (bool) ($data['confirm_warnings'] ?? false);
        unset($data['confirm_warnings']);

        try {
            $recipient = $data['recipients'][0];
            $addr = $recipient['address'];
            $addrLines = is_array($addr['streetLines'] ?? null) ? $addr['streetLines'] : [];

            $inEffect = config('fedex.address_validation_in_effect_as_of');
            $addrResult = $this->addressValidation->validateAddresses([
                [
                    'streetLines' => array_values(array_filter($addrLines, fn ($s) => is_string($s) && $s !== '')),
                    'city' => (string) ($addr['city'] ?? ''),
                    'stateOrProvinceCode' => (string) ($addr['stateOrProvinceCode'] ?? ''),
                    'postalCode' => (string) ($addr['postalCode'] ?? ''),
                    'countryCode' => (string) ($addr['countryCode'] ?? ''),
                ],
            ], is_string($inEffect) && $inEffect !== '' ? $inEffect : null);

            $first = $addrResult['results'][0] ?? null;
            if (! is_array($first) || empty($first['isValid'])) {
                return response()->json([
                    'message' => 'Recipient address must be validated and confirmed by FedEx before creating a tag.',
                    'address_validation' => $first,
                ], 422);
            }

            $validateResult = $this->fedExShip->validateShipment($data);
            if ($validateResult['alerts'] !== [] && ! $confirmWarnings) {
                return response()->json([
                    'message' => 'FedEx returned validation warnings. Review alerts and resubmit with confirm_warnings=true.',
                    'alerts' => $validateResult['alerts'],
                ], 422);
            }

            $created = $this->fedExShip->createTag($data);
            $raw = $created['raw'];

            return response()->json([
                'tracking_number' => $created['trackingNumber'],
                'label_url' => $created['labelUrl'],
                'service_type' => $created['serviceType'],
                'ship_timestamp' => $created['shipTimestamp'],
                'job_id' => $created['jobId'],
                'transaction_id' => $created['transaction_id'],
                'fedex_transaction_id' => isset($raw['transactionId']) ? (string) $raw['transactionId'] : null,
                'customer_transaction_id' => $raw['customerTransactionId'] ?? null,
                'fedex_response' => $raw,
            ], 201);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx create tag failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    public function cancelTag(CancelFedExTagRequest $request, string $fedexShipmentId): JsonResponse
    {
        if (! $this->fedExConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        if (! filled(config('fedex.account_number'))) {
            return response()->json(['message' => 'FedEx account number is not configured.'], 502);
        }

        try {
            $payload = $request->validated();
            $result = $this->fedExShip->cancelTag($fedexShipmentId, $payload);
            $raw = $result['raw'];
            $output = is_array($raw['output'] ?? null) ? $raw['output'] : null;

            return response()->json([
                'cancelled' => $result['cancelled'],
                'success' => $result['cancelled'],
                'message' => $result['message'],
                'transaction_id' => $result['transaction_id'],
                'fedex_transaction_id' => isset($raw['transactionId']) ? (string) $raw['transactionId'] : null,
                'customer_transaction_id' => $raw['customerTransactionId'] ?? null,
                'output' => $output,
                'fedex_response' => $raw,
            ]);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx cancel tag failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    private function fedExConfigured(): bool
    {
        return FedExShipmentCreateService::isConfigured();
    }
}

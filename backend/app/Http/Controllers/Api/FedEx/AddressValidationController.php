<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ValidateFedExAddressRequest;
use App\Services\FedEx\AddressValidationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class AddressValidationController extends Controller
{
    public function __construct(
        private readonly AddressValidationService $addressValidation,
    ) {}

    public function validate(ValidateFedExAddressRequest $request): JsonResponse
    {
        if (! filled(config('fedex.client_id')) || ! filled(config('fedex.client_secret'))) {
            return response()->json([
                'message' => 'FedEx API credentials are not configured.',
            ], 502);
        }

        try {
            $validated = $request->validated();
            $data = $this->addressValidation->validateAddresses(
                $validated['addresses'],
                $validated['in_effect_as_of_timestamp'] ?? null,
            );

            return response()->json([
                'resolvedAddresses' => $data['resolvedAddresses'],
                'alerts' => $data['alerts'],
                'results' => $data['results'],
                'fedex_transaction_id' => $data['fedex_transaction_id'],
                'fedex_customer_transaction_id' => $data['fedex_customer_transaction_id'],
            ]);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx address validation failed.', [
                'message' => $e->getMessage(),
                'exception' => $e::class,
            ]);

            return response()->json([
                'message' => 'Unable to validate addresses with FedEx at this time.',
            ], 502);
        }
    }
}

<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFedExFreightLtlPassthroughRequest;
use App\Services\FedEx\FreightLtl\FedExFreightLtlIntegration;
use App\Services\FedEx\FreightLtl\FedExFreightLtlPickupService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class FedExFreightLtlPickupController extends Controller
{
    public function __construct(
        private readonly FedExFreightLtlPickupService $pickupService,
    ) {}

    /**
     * Check Freight LTL pickup availability (FedEx JSON body).
     */
    public function availability(StoreFedExFreightLtlPassthroughRequest $request): JsonResponse
    {
        if (! FedExFreightLtlIntegration::isConfigured()) {
            return response()->json(['message' => 'FedEx Freight LTL is not configured.'], 502);
        }
        if (! config('fedex.freight_ltl.pickup_enabled')) {
            return response()->json(['message' => 'FedEx Freight LTL pickup endpoints are disabled.'], 503);
        }

        $locale = $request->header('x-locale') ?: 'en_US';

        try {
            /** @var array<string, mixed> $payload */
            $payload = $request->json()->all();
            $out = $this->pickupService->pickupAvailability(
                $payload,
                $request->header('x-customer-transaction-id'),
                is_string($locale) ? $locale : 'en_US',
            );

            return response()->json($out);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx Freight LTL pickup availability failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    /**
     * Create / schedule Freight LTL pickup (FedEx JSON body).
     */
    public function store(StoreFedExFreightLtlPassthroughRequest $request): JsonResponse
    {
        if (! FedExFreightLtlIntegration::isConfigured()) {
            return response()->json(['message' => 'FedEx Freight LTL is not configured.'], 502);
        }
        if (! config('fedex.freight_ltl.pickup_enabled')) {
            return response()->json(['message' => 'FedEx Freight LTL pickup endpoints are disabled.'], 503);
        }

        $locale = $request->header('x-locale') ?: 'en_US';

        try {
            /** @var array<string, mixed> $payload */
            $payload = $request->json()->all();
            $out = $this->pickupService->createPickup(
                $payload,
                $request->header('x-customer-transaction-id'),
                is_string($locale) ? $locale : 'en_US',
            );

            return response()->json($out);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx Freight LTL create pickup failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }

    /**
     * Cancel Freight LTL pickup (FedEx JSON body; FedEx typically expects PUT).
     */
    public function cancel(StoreFedExFreightLtlPassthroughRequest $request): JsonResponse
    {
        if (! FedExFreightLtlIntegration::isConfigured()) {
            return response()->json(['message' => 'FedEx Freight LTL is not configured.'], 502);
        }
        if (! config('fedex.freight_ltl.pickup_enabled')) {
            return response()->json(['message' => 'FedEx Freight LTL pickup endpoints are disabled.'], 503);
        }

        $locale = $request->header('x-locale') ?: 'en_US';

        try {
            /** @var array<string, mixed> $payload */
            $payload = $request->json()->all();
            $out = $this->pickupService->cancelPickup(
                $payload,
                $request->header('x-customer-transaction-id'),
                is_string($locale) ? $locale : 'en_US',
            );

            return response()->json($out);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx Freight LTL cancel pickup failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}

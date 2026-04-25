<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFedExFreightLtlPassthroughRequest;
use App\Services\FedEx\FreightLtl\FedExFreightLtlIntegration;
use App\Services\FedEx\FreightLtl\FedExFreightLtlShipService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class FedExFreightLtlShipController extends Controller
{
    public function __construct(
        private readonly FedExFreightLtlShipService $shipService,
    ) {}

    /**
     * POST body matches FedEx Freight LTL shipments JSON (see FedEx Developer Portal).
     */
    public function store(StoreFedExFreightLtlPassthroughRequest $request): JsonResponse
    {
        if (! FedExFreightLtlIntegration::isConfigured()) {
            return response()->json(['message' => 'FedEx Freight LTL is not configured.'], 502);
        }
        if (! config('fedex.freight_ltl.ship_enabled')) {
            return response()->json(['message' => 'FedEx Freight LTL ship endpoint is disabled.'], 503);
        }

        $locale = $request->header('x-locale') ?: 'en_US';

        try {
            /** @var array<string, mixed> $payload */
            $payload = $request->json()->all();
            $out = $this->shipService->ship(
                $payload,
                $request->header('x-customer-transaction-id'),
                is_string($locale) ? $locale : 'en_US',
            );

            return response()->json($out);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx Freight LTL ship failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}

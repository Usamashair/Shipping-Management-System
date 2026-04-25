<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Services\FedEx\FedExLocationSearchService;
use App\Services\FedEx\FedExShipmentCreateService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class FedExLocationController extends Controller
{
    public function __construct(
        private readonly FedExLocationSearchService $locationSearch,
    ) {}

    /**
     * POST body is the FedEx Location Search JSON (see FedEx docs). Requires `location` object.
     */
    public function search(Request $request): JsonResponse
    {
        if (! FedExShipmentCreateService::isConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        $payload = $request->all();
        if (! is_array($payload['location'] ?? null)) {
            return response()->json([
                'message' => 'Request must include a JSON object with a "location" property.',
            ], 422);
        }

        try {
            $out = $this->locationSearch->search(
                $payload,
                $request->header('x-customer-transaction-id'),
            );

            return response()->json($out);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx location search failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}

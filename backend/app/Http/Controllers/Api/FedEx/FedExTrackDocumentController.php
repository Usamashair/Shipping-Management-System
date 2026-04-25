<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFedExTrackDocumentRequest;
use App\Services\FedEx\FedExShipmentCreateService;
use App\Services\FedEx\FedExTrackDocumentService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class FedExTrackDocumentController extends Controller
{
    public function __construct(
        private readonly FedExTrackDocumentService $trackDocument,
    ) {}

    /**
     * POST body matches FedEx `POST /track/v1/trackingdocuments` JSON (see FedEx docs).
     */
    public function store(StoreFedExTrackDocumentRequest $request): JsonResponse
    {
        if (! FedExShipmentCreateService::isConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        $locale = $request->header('x-locale') ?: 'en_US';

        try {
            $out = $this->trackDocument->request(
                $request->validated(),
                $request->header('x-customer-transaction-id'),
                is_string($locale) ? $locale : 'en_US',
            );

            return response()->json($out);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx track document failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}

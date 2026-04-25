<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFedExTrackingNotificationRequest;
use App\Services\FedEx\FedExShipmentCreateService;
use App\Services\FedEx\FedExTrackingNotificationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class FedExTrackingNotificationController extends Controller
{
    public function __construct(
        private readonly FedExTrackingNotificationService $trackingNotifications,
    ) {}

    /**
     * POST body matches FedEx `POST /track/v1/notifications` JSON (see FedEx docs).
     */
    public function store(StoreFedExTrackingNotificationRequest $request): JsonResponse
    {
        if (! FedExShipmentCreateService::isConfigured()) {
            return response()->json(['message' => 'FedEx is not configured.'], 502);
        }

        $locale = $request->header('x-locale') ?: 'en_US';

        try {
            $out = $this->trackingNotifications->send(
                $request->validated(),
                $request->header('x-customer-transaction-id'),
                is_string($locale) ? $locale : 'en_US',
            );

            return response()->json($out);
        } catch (HttpResponseException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('FedEx tracking notification send failed.', ['message' => $e->getMessage()]);

            return response()->json(['message' => $e->getMessage()], 502);
        }
    }
}

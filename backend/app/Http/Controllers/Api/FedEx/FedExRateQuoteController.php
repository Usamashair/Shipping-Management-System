<?php

namespace App\Http\Controllers\Api\FedEx;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreFedExRateQuoteRequest;
use App\Services\FedEx\FedExRateApiService;
use App\Services\FedEx\FedExShipmentCreateService;
use App\Services\FedEx\LegacyShipmentDetailsToFedExShipMapper;
use Illuminate\Http\JsonResponse;

class FedExRateQuoteController extends Controller
{
    public function __construct(
        private readonly FedExRateApiService $fedExRate,
        private readonly LegacyShipmentDetailsToFedExShipMapper $mapper,
    ) {}

    public function store(StoreFedExRateQuoteRequest $request): JsonResponse
    {
        if (! FedExShipmentCreateService::isConfigured()) {
            return response()->json([
                'message' => 'FedEx API credentials are not configured.',
            ], 502);
        }

        $data = $request->validated();
        $fedex = $this->mapper->toFedExShipPayload(
            $data['sender_details'],
            $data['receiver_details'],
            $data['package_details'],
        );

        $quotes = $this->fedExRate->getQuotesForShipment($fedex);

        return response()->json($quotes);
    }
}

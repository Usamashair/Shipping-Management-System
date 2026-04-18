<?php

namespace App\Http\Controllers\Api\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreCustomerShipmentRequest;
use App\Http\Resources\ShipmentResource;
use App\Models\Shipment;
use App\Services\ShipmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShipmentController extends Controller
{
    public function __construct(
        protected ShipmentService $shipments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $paginated = Shipment::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->paginate((int) $request->query('per_page', 15));

        return ShipmentResource::collection($paginated)->response();
    }

    public function store(StoreCustomerShipmentRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        $shipment = $this->shipments->createForUser(
            $user,
            $data['sender_details'],
            $data['receiver_details'],
            $data['package_details'],
        );

        return (new ShipmentResource($shipment))->response()->setStatusCode(201);
    }

    public function show(Request $request, Shipment $shipment): JsonResponse
    {
        $this->authorize('view', $shipment);
        $shipment->load('trackingLogs');

        return (new ShipmentResource($shipment))->response();
    }

    public function track(Request $request, Shipment $shipment): JsonResponse
    {
        $this->authorize('track', $shipment);
        $shipment = $this->shipments->trackAndLog($shipment);

        return (new ShipmentResource($shipment))->response();
    }
}

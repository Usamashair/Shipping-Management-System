<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreAdminShipmentRequest;
use App\Http\Requests\Api\UpdateAdminShipmentRequest;
use App\Http\Requests\Api\UpdateShipmentStatusRequest;
use App\Http\Resources\ShipmentResource;
use App\Models\Shipment;
use App\Models\User;
use App\Services\ShipmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ShipmentController extends Controller
{
    public function __construct(
        protected ShipmentService $shipments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Shipment::class);

        $query = Shipment::query()->with('user')->orderByDesc('id');

        $paginated = $query->paginate((int) $request->query('per_page', 15));

        return ShipmentResource::collection($paginated)->response();
    }

    public function show(Shipment $shipment): JsonResponse
    {
        $this->authorize('view', $shipment);
        $shipment->load('trackingLogs');

        return (new ShipmentResource($shipment))->response();
    }

    public function store(StoreAdminShipmentRequest $request): JsonResponse
    {
        $data = $request->validated();
        $owner = User::query()->findOrFail($data['user_id']);

        $shipment = $this->shipments->createForUser(
            $owner,
            $data['sender_details'],
            $data['receiver_details'],
            $data['package_details'],
        );

        return (new ShipmentResource($shipment))->response()->setStatusCode(201);
    }

    public function updateStatus(UpdateShipmentStatusRequest $request, Shipment $shipment): JsonResponse
    {
        $shipment->status = $request->validated()['status'];
        $shipment->save();

        return (new ShipmentResource($shipment->fresh()->load('trackingLogs')))->response();
    }

    public function update(UpdateAdminShipmentRequest $request, Shipment $shipment): JsonResponse
    {
        $data = $request->validated();

        if (array_key_exists('user_id', $data)) {
            $shipment->user_id = (int) $data['user_id'];
        }
        if (array_key_exists('status', $data)) {
            $shipment->status = $data['status'];
        }

        $shipment->save();

        return (new ShipmentResource($shipment->fresh()->load('trackingLogs')))->response();
    }

    public function destroy(Shipment $shipment): JsonResponse
    {
        $this->authorize('delete', $shipment);

        if ($shipment->label_path !== null && $shipment->label_path !== '') {
            Storage::disk('labels')->delete($shipment->label_path);
        }

        $shipment->delete();

        return response()->json(null, 204);
    }
}

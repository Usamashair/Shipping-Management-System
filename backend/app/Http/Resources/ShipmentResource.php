<?php

namespace App\Http\Resources;

use App\Models\Shipment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Shipment */
class ShipmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'tracking_number' => $this->tracking_number,
            'fedex_tracking_number' => $this->fedex_tracking_number,
            'sender_details' => $this->sender_details,
            'receiver_details' => $this->receiver_details,
            'package_details' => $this->package_details,
            'status' => $this->status,
            'label_url' => $this->label_url,
            'label_path' => $this->label_path,
            'service_type' => $this->service_type,
            'pickup_type' => $this->pickup_type,
            'package_weight' => $this->package_weight !== null ? (float) $this->package_weight : null,
            'package_dimensions' => $this->package_dimensions,
            'is_residential' => $this->is_residential,
            'fedex_transaction_id' => $this->fedex_transaction_id,
            'fedex_job_id' => $this->fedex_job_id,
            'shipped_at' => $this->shipped_at?->toIso8601String(),
            'fedex_response' => $this->fedex_response ?? [],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'tracking_logs' => TrackingLogResource::collection($this->whenLoaded('trackingLogs')),
        ];
    }
}

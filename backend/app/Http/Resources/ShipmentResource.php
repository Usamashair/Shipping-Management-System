<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Shipment */
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
            'sender_details' => $this->sender_details,
            'receiver_details' => $this->receiver_details,
            'package_details' => $this->package_details,
            'status' => $this->status,
            'label_url' => $this->label_url,
            'fedex_response' => $this->fedex_response ?? [],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'tracking_logs' => TrackingLogResource::collection($this->whenLoaded('trackingLogs')),
        ];
    }
}

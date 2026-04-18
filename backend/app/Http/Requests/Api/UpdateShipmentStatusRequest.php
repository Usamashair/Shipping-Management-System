<?php

namespace App\Http\Requests\Api;

use App\Models\Shipment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShipmentStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        $shipment = $this->route('shipment');

        return $shipment instanceof Shipment
            && ($this->user()?->can('updateStatus', $shipment) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['pending', 'in_transit', 'delivered', 'failed', 'label_created', 'cancelled'])],
        ];
    }
}

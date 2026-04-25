<?php

namespace App\Http\Requests\Api;

use App\Models\Shipment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateAdminShipmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $shipment = $this->route('shipment');

        return $shipment instanceof Shipment
            && ($this->user()?->can('update', $shipment) ?? false);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'status' => ['sometimes', 'string', Rule::in(['pending', 'in_transit', 'delivered', 'failed', 'label_created', 'cancelled'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if (! $this->hasAny(['user_id', 'status'])) {
                $validator->errors()->add('user_id', 'Provide at least one of: user_id, status.');
            }
        });
    }
}

<?php

namespace App\Http\Requests\Api;

use Illuminate\Validation\Rule;

class StoreFedExTagRequest extends ValidateFedExShipRequest
{
    public function authorize(): bool
    {
        $role = $this->user()?->role;

        return in_array($role, ['admin', 'customer'], true);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'pickupType' => ['required', 'string', Rule::in([
                'USE_SCHEDULED_PICKUP',
                'CONTACT_FEDEX_TO_SCHEDULE',
                'DROPOFF_AT_FEDEX_LOCATION',
            ])],
            'confirm_warnings' => ['sometimes', 'boolean'],
            'pickup_detail' => ['required', 'array'],
            'pickup_detail.ready_pickup_datetime' => ['required', 'string', 'max:64'],
            'pickup_detail.latest_pickup_datetime' => ['required', 'string', 'max:64'],
            'packages.0.description' => ['required', 'string', 'max:50'],
        ]);
    }
}

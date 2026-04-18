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
            'pickupType' => ['required', 'string', Rule::in(['USE_SCHEDULED_PICKUP', 'DROP_BOX'])],
            'confirm_warnings' => ['sometimes', 'boolean'],
        ]);
    }
}

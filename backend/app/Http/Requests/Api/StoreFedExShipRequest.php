<?php

namespace App\Http\Requests\Api;

class StoreFedExShipRequest extends ValidateFedExShipRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'customer';
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'confirm_warnings' => ['sometimes', 'boolean'],
        ]);
    }
}

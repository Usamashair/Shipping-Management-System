<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class ValidateFedExAddressRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'in_effect_as_of_timestamp' => ['nullable', 'date_format:Y-m-d'],
            'addresses' => ['required', 'array', 'min:1', 'max:100'],
            'addresses.*.streetLines' => ['required', 'array', 'min:1'],
            'addresses.*.streetLines.*' => ['required', 'string', 'max:255'],
            'addresses.*.countryCode' => ['required', 'string', 'max:8'],
            'addresses.*.city' => ['nullable', 'string', 'max:120'],
            'addresses.*.stateOrProvinceCode' => ['nullable', 'string', 'max:32'],
            'addresses.*.postalCode' => ['nullable', 'string', 'max:32'],
            'addresses.*.clientReferenceId' => ['nullable', 'string', 'max:128'],
        ];
    }
}

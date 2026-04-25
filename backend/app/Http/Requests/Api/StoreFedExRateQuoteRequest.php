<?php

namespace App\Http\Requests\Api;

use App\Http\Requests\Api\Concerns\ValidatesFedExLegacyShipmentFields;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Legacy shipment fields for FedEx Rate quotes (same shape as shipment create, without user_id).
 */
class StoreFedExRateQuoteRequest extends FormRequest
{
    use ValidatesFedExLegacyShipmentFields;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $this->prepareFedExLegacyAddressFields();
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $iso2 = ['required', 'string', 'regex:/^[A-Za-z]{2}$/'];

        return [
            'sender_details' => ['required', 'array'],
            'sender_details.name' => ['required', 'string', 'max:255'],
            'sender_details.street1' => ['required', 'string', 'max:150'],
            'sender_details.city' => ['required', 'string', 'max:120'],
            'sender_details.state' => ['required', 'string', 'max:120'],
            'sender_details.postalCode' => ['required', 'string', 'max:32'],
            'sender_details.country' => $iso2,
            'sender_details.phone' => ['required', 'string', 'regex:/^[0-9]{7,15}$/'],
            'sender_details.company' => ['nullable', 'string', 'max:255'],
            'sender_details.street2' => ['nullable', 'string', 'max:255'],
            'receiver_details' => ['required', 'array'],
            'receiver_details.name' => ['required', 'string', 'max:255'],
            'receiver_details.street1' => ['required', 'string', 'max:150'],
            'receiver_details.city' => ['required', 'string', 'max:120'],
            'receiver_details.state' => ['required', 'string', 'max:120'],
            'receiver_details.postalCode' => ['required', 'string', 'max:32'],
            'receiver_details.country' => $iso2,
            'receiver_details.phone' => ['required', 'string', 'regex:/^[0-9]{7,15}$/'],
            'receiver_details.company' => ['nullable', 'string', 'max:255'],
            'receiver_details.street2' => ['nullable', 'string', 'max:255'],
            'package_details' => ['required', 'array'],
            'package_details.weightLb' => ['required', 'numeric', 'min:0.1'],
            'package_details.lengthIn' => ['required', 'numeric', 'min:1'],
            'package_details.widthIn' => ['required', 'numeric', 'min:1'],
            'package_details.heightIn' => ['required', 'numeric', 'min:1'],
            'package_details.description' => ['required', 'string', 'max:500'],
        ];
    }
}

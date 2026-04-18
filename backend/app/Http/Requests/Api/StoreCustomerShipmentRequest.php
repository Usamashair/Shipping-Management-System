<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreCustomerShipmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', \App\Models\Shipment::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'sender_details' => ['required', 'array'],
            'sender_details.name' => ['required', 'string', 'max:255'],
            'sender_details.street1' => ['required', 'string', 'max:255'],
            'sender_details.city' => ['required', 'string', 'max:120'],
            'sender_details.state' => ['required', 'string', 'max:120'],
            'sender_details.postalCode' => ['required', 'string', 'max:32'],
            'sender_details.country' => ['required', 'string', 'max:8'],
            'sender_details.phone' => ['required', 'string', 'max:64'],
            'sender_details.company' => ['nullable', 'string', 'max:255'],
            'sender_details.street2' => ['nullable', 'string', 'max:255'],
            'receiver_details' => ['required', 'array'],
            'receiver_details.name' => ['required', 'string', 'max:255'],
            'receiver_details.street1' => ['required', 'string', 'max:255'],
            'receiver_details.city' => ['required', 'string', 'max:120'],
            'receiver_details.state' => ['required', 'string', 'max:120'],
            'receiver_details.postalCode' => ['required', 'string', 'max:32'],
            'receiver_details.country' => ['required', 'string', 'max:8'],
            'receiver_details.phone' => ['required', 'string', 'max:64'],
            'receiver_details.company' => ['nullable', 'string', 'max:255'],
            'receiver_details.street2' => ['nullable', 'string', 'max:255'],
            'package_details' => ['required', 'array'],
            'package_details.weightLb' => ['required', 'numeric', 'min:0.01'],
            'package_details.lengthIn' => ['required', 'numeric', 'min:0.01'],
            'package_details.widthIn' => ['required', 'numeric', 'min:0.01'],
            'package_details.heightIn' => ['required', 'numeric', 'min:0.01'],
            'package_details.description' => ['required', 'string', 'max:500'],
        ];
    }
}

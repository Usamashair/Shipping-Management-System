<?php

namespace App\Http\Requests\Api;

use App\Enums\FedExServiceType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ValidateFedExShipRequest extends FormRequest
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
        return [
            'serviceType' => ['required', 'string', Rule::enum(FedExServiceType::class)],
            'packagingType' => ['required', 'string', 'max:64'],
            'is_residential' => ['sometimes', 'boolean'],
            'shipper' => ['required', 'array'],
            'shipper.contact' => ['required', 'array'],
            'shipper.contact.personName' => ['required', 'string', 'max:255'],
            'shipper.contact.phoneNumber' => ['required', 'string', 'max:64'],
            'shipper.contact.companyName' => ['nullable', 'string', 'max:255'],
            'shipper.address' => ['required', 'array'],
            'shipper.address.streetLines' => ['required', 'array', 'min:1'],
            'shipper.address.streetLines.*' => ['required', 'string', 'max:255'],
            'shipper.address.city' => ['required', 'string', 'max:120'],
            'shipper.address.stateOrProvinceCode' => ['required', 'string', 'max:32'],
            'shipper.address.postalCode' => ['required', 'string', 'max:32'],
            'shipper.address.countryCode' => ['required', 'string', 'max:8'],

            'recipients' => ['required', 'array', 'min:1', 'max:1'],
            'recipients.0' => ['required', 'array'],
            'recipients.0.contact' => ['required', 'array'],
            'recipients.0.contact.personName' => ['required', 'string', 'max:255'],
            'recipients.0.contact.phoneNumber' => ['required', 'string', 'max:64'],
            'recipients.0.address' => ['required', 'array'],
            'recipients.0.address.streetLines' => ['required', 'array', 'min:1'],
            'recipients.0.address.streetLines.*' => ['required', 'string', 'max:255'],
            'recipients.0.address.city' => ['required', 'string', 'max:120'],
            'recipients.0.address.stateOrProvinceCode' => ['required', 'string', 'max:32'],
            'recipients.0.address.postalCode' => ['required', 'string', 'max:32'],
            'recipients.0.address.countryCode' => ['required', 'string', 'max:8'],

            'packages' => ['required', 'array', 'min:1', 'max:1'],
            'packages.*' => ['required', 'array'],
            'packages.*.weight' => ['required', 'array'],
            'packages.*.weight.value' => ['required', 'numeric', 'min:0.01'],
            'packages.*.weight.units' => ['nullable', 'string', 'max:8'],
            'packages.*.dimensions' => ['required', 'array'],
            'packages.*.dimensions.length' => ['required', 'numeric', 'min:1'],
            'packages.*.dimensions.width' => ['required', 'numeric', 'min:1'],
            'packages.*.dimensions.height' => ['required', 'numeric', 'min:1'],
            'packages.*.dimensions.units' => ['nullable', 'string', 'max:8'],
        ];
    }
}

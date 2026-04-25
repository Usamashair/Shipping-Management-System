<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates the minimum FedEx Rate API body for Freight LTL rate quotes.
 *
 * Full schema: FedEx Developer Portal — Rate Freight LTL (POST /rate/v1/freight/rates/quotes).
 */
class StoreFedExFreightLtlRateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'accountNumber' => ['required', 'array'],
            'accountNumber.value' => ['required', 'string', 'max:9'],
            'rateRequestControlParameters' => ['nullable', 'array'],
            'rateRequestControlParameters.returnTransitTimes' => ['nullable', 'boolean'],
            'rateRequestControlParameters.servicesNeededOnRateFailure' => ['nullable', 'boolean'],
            'rateRequestControlParameters.variableOptions' => ['nullable', 'string'],
            'rateRequestControlParameters.rateSortOrder' => ['nullable', 'string'],
            'freightRequestedShipment' => ['required', 'array'],
            'version' => ['nullable', 'array'],
            'version.major' => ['nullable', 'string'],
            'version.minor' => ['nullable', 'string'],
            'version.patch' => ['nullable', 'string'],
        ];
    }
}

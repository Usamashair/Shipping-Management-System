<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreFedExTrackByReferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('includeDetailedScans')) {
            $this->merge(['includeDetailedScans' => true]);
        } else {
            $v = $this->input('includeDetailedScans');
            if ($v === 'true' || $v === '1' || $v === 1) {
                $this->merge(['includeDetailedScans' => true]);
            } elseif ($v === 'false' || $v === '0' || $v === 0) {
                $this->merge(['includeDetailedScans' => false]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $referenceTypes = [
            'BILL_OF_LADING',
            'COD_RETURN_TRACKING_NUMBER',
            'CUSTOMER_AUTHORIZATION_NUMBER',
            'CUSTOMER_REFERENCE',
            'DEPARTMENT',
            'DOCUMENT_AIRWAY_BILL',
            'EXPRESS_ALTERNATE_REFERENCE',
            'FEDEX_OFFICE_JOB_ORDER_NUMBER',
            'FREE_FORM_REFERENCE',
            'GROUND_INTERNATIONAL',
            'GROUND_SHIPMENT_ID',
            'INTERNATIONAL_DISTRIBUTION',
            'INVOICE',
            'JOB_GLOBAL_TRACKING_NUMBER',
            'ORDER_GLOBAL_TRACKING_NUMBER',
            'ORDER_TO_PAY_NUMBER',
            'PART_NUMBER',
            'PARTNER_CARRIER_NUMBER',
            'PURCHASE_ORDER',
            'REROUTE_TRACKING_NUMBER',
            'RETURN_MATERIALS_AUTHORIZATION',
            'RETURNED_TO_SHIPPER_TRACKING_NUMBER',
            'SHIPPER_REFERENCE',
            'TRANSBORDER_DISTRIBUTION',
            'TRANSPORTATION_CONTROL_NUMBER',
            'VIRTUAL_CONSOLIDATION',
        ];

        return [
            'referencesInformation' => ['required', 'array'],
            'referencesInformation.type' => ['nullable', 'string', Rule::in($referenceTypes)],
            'referencesInformation.value' => ['required', 'string', 'max:512'],
            'referencesInformation.carrierCode' => ['nullable', 'string', 'max:64'],
            'referencesInformation.accountNumber' => ['nullable', 'string', 'max:32'],
            'referencesInformation.shipDateBegin' => ['nullable', 'date_format:Y-m-d'],
            'referencesInformation.shipDateEnd' => ['nullable', 'date_format:Y-m-d'],
            'referencesInformation.destinationCountryCode' => ['nullable', 'string', 'size:2'],
            'referencesInformation.destinationPostalCode' => ['nullable', 'string', 'max:32'],
            'includeDetailedScans' => ['required', 'boolean'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $ref = $v->getData()['referencesInformation'] ?? null;
            if (! is_array($ref)) {
                return;
            }

            $account = isset($ref['accountNumber']) && is_string($ref['accountNumber']) && trim($ref['accountNumber']) !== '';
            $country = isset($ref['destinationCountryCode']) && is_string($ref['destinationCountryCode']) && trim($ref['destinationCountryCode']) !== '';
            $postal = isset($ref['destinationPostalCode']) && is_string($ref['destinationPostalCode']) && trim($ref['destinationPostalCode']) !== '';

            if (! $account && (! $country || ! $postal)) {
                $v->errors()->add(
                    'referencesInformation',
                    'Either referencesInformation.accountNumber or both destinationCountryCode and destinationPostalCode are required.',
                );
            }
        });
    }
}

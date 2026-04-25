<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFedExAssociatedShipmentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('includeDetailedScans')) {
            $this->merge(['includeDetailedScans' => true]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'includeDetailedScans' => ['required', 'boolean'],
            'associatedType' => ['required', 'string', 'in:OUTBOUND_LINK_TO_RETURN,STANDARD_MPS,GROUP_MPS'],
            'masterTrackingNumberInfo' => ['required', 'array'],
            'masterTrackingNumberInfo.shipDateBegin' => ['nullable', 'date_format:Y-m-d'],
            'masterTrackingNumberInfo.shipDateEnd' => ['nullable', 'date_format:Y-m-d'],
            'masterTrackingNumberInfo.trackingNumberInfo' => ['required', 'array'],
            'masterTrackingNumberInfo.trackingNumberInfo.trackingNumber' => ['required', 'string', 'max:64'],
            'masterTrackingNumberInfo.trackingNumberInfo.carrierCode' => ['nullable', 'string', 'max:64'],
            'masterTrackingNumberInfo.trackingNumberInfo.trackingNumberUniqueId' => ['nullable', 'string', 'max:255'],
            'pagingDetails' => ['nullable', 'array'],
            'pagingDetails.resultsPerPage' => ['nullable', 'integer', 'min:1'],
            'pagingDetails.pagingToken' => ['nullable', 'string'],
        ];
    }
}

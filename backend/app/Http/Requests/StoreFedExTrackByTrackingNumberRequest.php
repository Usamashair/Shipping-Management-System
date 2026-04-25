<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFedExTrackByTrackingNumberRequest extends FormRequest
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
        return [
            'includeDetailedScans' => ['required', 'boolean'],
            'trackingInfo' => ['required', 'array', 'min:1', 'max:30'],
            'trackingInfo.*.trackingNumberInfo' => ['required', 'array'],
            'trackingInfo.*.trackingNumberInfo.trackingNumber' => ['required', 'string', 'max:64'],
            'trackingInfo.*.trackingNumberInfo.carrierCode' => ['nullable', 'string', 'max:64'],
            'trackingInfo.*.trackingNumberInfo.trackingNumberUniqueId' => ['nullable', 'string', 'max:255'],
            'trackingInfo.*.shipDateBegin' => ['nullable', 'date_format:Y-m-d'],
            'trackingInfo.*.shipDateEnd' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}

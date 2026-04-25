<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreFedExTrackByTcnRequest extends FormRequest
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
            'tcnInfo' => ['required', 'array'],
            'tcnInfo.value' => ['required', 'string', 'max:128'],
            'tcnInfo.carrierCode' => ['nullable', 'string', 'max:64'],
            'tcnInfo.shipDateBegin' => ['nullable', 'date_format:Y-m-d'],
            'tcnInfo.shipDateEnd' => ['nullable', 'date_format:Y-m-d'],
            'includeDetailedScans' => ['required', 'boolean'],
        ];
    }
}

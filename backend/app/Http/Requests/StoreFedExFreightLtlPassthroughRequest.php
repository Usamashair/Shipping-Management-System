<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Validates that the JSON body is present; schema matches FedEx Freight LTL per endpoint (see FedEx docs).
 */
class StoreFedExFreightLtlPassthroughRequest extends FormRequest
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
            '*' => ['sometimes'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $json = $this->json();
            if ($json === null || count($json->all()) === 0) {
                $v->errors()->add('body', 'A non-empty JSON object is required.');
            }
        });
    }
}

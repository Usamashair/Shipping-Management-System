<?php

namespace App\Http\Requests\Api;

use App\Enums\FedExServiceType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CancelFedExTagRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'admin';
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'serviceType' => ['required', 'string', Rule::enum(FedExServiceType::class)],
            'trackingNumber' => ['required', 'string', 'max:64'],
            'completedTagDetail' => ['required', 'array'],
            'completedTagDetail.confirmationNumber' => ['required', 'string', 'max:64'],
            'completedTagDetail.location' => ['required', 'string', 'max:64'],
            'completedTagDetail.dispatchDate' => ['required', 'string', 'max:32'],
        ];
    }
}

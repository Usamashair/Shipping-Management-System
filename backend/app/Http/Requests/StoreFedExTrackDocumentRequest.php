<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreFedExTrackDocumentRequest extends FormRequest
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
        $documentTypes = [
            'SIGNATURE_PROOF_OF_DELIVERY',
            'BILL_OF_LADING',
            'FREIGHT_BILLING_DOCUMENT',
        ];

        return [
            'trackDocumentDetail' => ['required', 'array'],
            'trackDocumentDetail.documentType' => ['required', 'string', Rule::in($documentTypes)],
            'trackDocumentDetail.documentFormat' => ['nullable', 'string', 'in:PDF,PNG'],
            'trackDocumentSpecification' => ['required', 'array', 'min:1', 'max:30'],
            'trackDocumentSpecification.*.trackingNumberInfo' => ['required', 'array'],
            'trackDocumentSpecification.*.trackingNumberInfo.trackingNumber' => ['required', 'string', 'max:64'],
            'trackDocumentSpecification.*.trackingNumberInfo.carrierCode' => ['nullable', 'string', 'max:64'],
            'trackDocumentSpecification.*.trackingNumberInfo.trackingNumberUniqueId' => ['nullable', 'string', 'max:255'],
            'trackDocumentSpecification.*.shipDateBegin' => ['nullable', 'date_format:Y-m-d'],
            'trackDocumentSpecification.*.shipDateEnd' => ['nullable', 'date_format:Y-m-d'],
            'trackDocumentSpecification.*.accountNumber' => ['nullable', 'string', 'max:32'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v): void {
            $data = $v->getData();
            $detail = $data['trackDocumentDetail'] ?? null;
            if (! is_array($detail)) {
                return;
            }

            $docType = $detail['documentType'] ?? null;
            $docFormat = $detail['documentFormat'] ?? null;

            if (in_array($docType, ['BILL_OF_LADING', 'FREIGHT_BILLING_DOCUMENT'], true)) {
                if ($docFormat === 'PNG') {
                    $v->errors()->add(
                        'trackDocumentDetail.documentFormat',
                        'PNG is not supported for BILL_OF_LADING or FREIGHT_BILLING_DOCUMENT.',
                    );
                }

                $specs = $data['trackDocumentSpecification'] ?? [];
                if (is_array($specs)) {
                    foreach ($specs as $i => $spec) {
                        if (! is_array($spec)) {
                            continue;
                        }
                        $acct = $spec['accountNumber'] ?? null;
                        if (! is_string($acct) || trim($acct) === '') {
                            $v->errors()->add(
                                'trackDocumentSpecification.'.$i.'.accountNumber',
                                'Account number is required for this document type.',
                            );
                        }
                    }
                }
            }
        });
    }
}

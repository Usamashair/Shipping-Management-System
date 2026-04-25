<?php

namespace App\Http\Requests\Api;

use App\Enums\FedExServiceType;
use App\Services\FixedRecipientService;
use App\Services\FedEx\UsLocationDatasetValidator;
use App\Support\UsNationalPhoneNormalizer;
use App\Support\UsStateCodeNormalizer;
use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ValidateFedExShipRequest extends FormRequest
{
    public function authorize(): bool
    {
        $role = $this->user()?->role;

        return in_array($role, ['admin', 'customer'], true);
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['recipients' => FixedRecipientService::asFedExRecipientsArray()]);

        $data = $this->all();
        foreach (['shipper', 'recipients'] as $partyKey) {
            if (! isset($data[$partyKey])) {
                continue;
            }
            if ($partyKey === 'recipients' && is_array($data['recipients'])) {
                foreach ($data['recipients'] as $i => $recipient) {
                    if (! is_array($recipient)) {
                        continue;
                    }
                    $data['recipients'][$i] = $this->normalizeFedExParty($recipient);
                }
            } elseif ($partyKey === 'shipper' && is_array($data['shipper'])) {
                $data['shipper'] = $this->normalizeFedExParty($data['shipper']);
            }
        }
        $this->replace($data);
    }

    /**
     * @param  array<string, mixed>  $party
     * @return array<string, mixed>
     */
    private function normalizeFedExParty(array $party): array
    {
        if (isset($party['contact']['phoneNumber']) && is_string($party['contact']['phoneNumber'])) {
            $party['contact']['phoneNumber'] = preg_replace('/\D+/', '', $party['contact']['phoneNumber']) ?? '';
        }
        if (isset($party['address']['countryCode']) && is_string($party['address']['countryCode'])) {
            $party['address']['countryCode'] = strtoupper(trim($party['address']['countryCode']));
        }
        $cc = $party['address']['countryCode'] ?? '';
        if ($cc === 'US' && isset($party['contact']['phoneNumber']) && is_string($party['contact']['phoneNumber'])) {
            $party['contact']['phoneNumber'] = UsNationalPhoneNormalizer::stripAndNormalizeUsNationalToTen(
                $party['contact']['phoneNumber']
            );
        }
        if ($cc === 'US' && isset($party['address']['stateOrProvinceCode']) && is_string($party['address']['stateOrProvinceCode'])) {
            $raw = trim($party['address']['stateOrProvinceCode']);
            $normalized = UsStateCodeNormalizer::normalizeForUs($raw);
            if ($normalized !== null) {
                $party['address']['stateOrProvinceCode'] = $normalized;
            } else {
                $party['address']['stateOrProvinceCode'] = $raw;
            }
        } elseif (isset($party['address']['stateOrProvinceCode']) && is_string($party['address']['stateOrProvinceCode'])) {
            $party['address']['stateOrProvinceCode'] = strtoupper(trim($party['address']['stateOrProvinceCode']));
        }
        if (isset($party['address']['streetLines']) && is_array($party['address']['streetLines'])) {
            foreach ($party['address']['streetLines'] as $k => $line) {
                if (is_string($line)) {
                    $party['address']['streetLines'][$k] = trim($line);
                }
            }
        }

        return $party;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'serviceType' => ['required', 'string', Rule::enum(FedExServiceType::class)],
            'packagingType' => ['required', 'string', 'max:64'],
            'pickupType' => ['required', 'string', Rule::in([
                'USE_SCHEDULED_PICKUP',
                'DROP_BOX', // app label; mapped to DROPOFF_AT_FEDEX_LOCATION in FedExShipApiService
                'DROPOFF_AT_FEDEX_LOCATION',
                'CONTACT_FEDEX_TO_SCHEDULE',
            ])],
            'is_residential' => ['sometimes', 'boolean'],
            'shipper' => ['required', 'array'],
            'shipper.contact' => ['required', 'array'],
            'shipper.contact.personName' => ['required', 'string', 'max:255'],
            'shipper.contact.phoneNumber' => ['required', 'string', 'regex:/^[0-9]{7,15}$/'],
            'shipper.contact.companyName' => ['nullable', 'string', 'max:255'],
            'shipper.address' => ['required', 'array'],
            'shipper.address.streetLines' => ['required', 'array', 'min:1'],
            'shipper.address.streetLines.*' => ['required', 'string', 'max:150'],
            'shipper.address.city' => ['required', 'string', 'max:120'],
            'shipper.address.stateOrProvinceCode' => ['required', 'string', 'max:32'],
            'shipper.address.postalCode' => ['required', 'string', 'max:32'],
            'shipper.address.countryCode' => ['required', 'string', 'max:8'],

            'recipients' => ['required', 'array', 'min:1', 'max:1'],
            'recipients.0' => ['required', 'array'],
            'recipients.0.contact' => ['required', 'array'],
            'recipients.0.contact.personName' => ['required', 'string', 'max:255'],
            'recipients.0.contact.phoneNumber' => ['required', 'string', 'regex:/^[0-9]{7,15}$/'],
            'recipients.0.address' => ['required', 'array'],
            'recipients.0.address.streetLines' => ['required', 'array', 'min:1'],
            'recipients.0.address.streetLines.*' => ['required', 'string', 'max:150'],
            'recipients.0.address.city' => ['required', 'string', 'max:120'],
            'recipients.0.address.stateOrProvinceCode' => ['required', 'string', 'max:32'],
            'recipients.0.address.postalCode' => ['required', 'string', 'max:32'],
            'recipients.0.address.countryCode' => ['required', 'string', 'max:8'],
            'recipients.0.address.residential' => ['sometimes', 'boolean'],

            'packages' => ['required', 'array', 'min:1', 'max:1'],
            'packages.*' => ['required', 'array'],
            'packages.*.weight' => ['required', 'array'],
            'packages.*.weight.value' => ['required', 'numeric', 'min:0.1'],
            'packages.*.weight.units' => ['nullable', 'string', 'max:8'],
            'packages.*.dimensions' => ['required', 'array'],
            'packages.*.dimensions.length' => ['required', 'numeric', 'min:1'],
            'packages.*.dimensions.width' => ['required', 'numeric', 'min:1'],
            'packages.*.dimensions.height' => ['required', 'numeric', 'min:1'],
            'packages.*.dimensions.units' => ['nullable', 'string', 'max:8'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (['shipper' => 'shipper', 'recipients.0' => 'recipients.0'] as $inputKey => $errorPrefix) {
                $party = data_get($this->all(), $inputKey);
                if (! is_array($party)) {
                    continue;
                }
                $addr = $party['address'] ?? [];
                if (! is_array($addr)) {
                    continue;
                }
                $cc = strtoupper((string) ($addr['countryCode'] ?? ''));
                if ($cc === 'US') {
                    $st = trim((string) ($addr['stateOrProvinceCode'] ?? ''));
                    if ($st !== '' && UsStateCodeNormalizer::normalizeForUs($st) === null) {
                        $validator->errors()->add($errorPrefix.'.address.stateOrProvinceCode', UsStateCodeNormalizer::INVALID_MESSAGE);
                    }
                }
            }

            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $dataset = app(UsLocationDatasetValidator::class);

            foreach (['shipper' => 'shipper', 'recipients.0' => 'recipients.0'] as $inputKey => $errorPrefix) {
                $party = data_get($this->all(), $inputKey);
                if (! is_array($party)) {
                    continue;
                }
                $addr = $party['address'] ?? [];
                if (! is_array($addr)) {
                    continue;
                }
                $cc = strtoupper((string) ($addr['countryCode'] ?? ''));
                $phone = (string) data_get($party, 'contact.phoneNumber');

                if ($phone !== '' && ! preg_match('/^[0-9]{7,15}$/', $phone)) {
                    $validator->errors()->add($errorPrefix.'.contact.phoneNumber', UsLocationDatasetValidator::COMPLIANCE_MESSAGE);
                }
                if ($cc === 'US') {
                    if ($phone !== '' && ! preg_match('/^[0-9]{10}$/', $phone)) {
                        $validator->errors()->add($errorPrefix.'.contact.phoneNumber', UsLocationDatasetValidator::COMPLIANCE_MESSAGE);
                    }
                    $postal = trim((string) ($addr['postalCode'] ?? ''));
                    if (! preg_match('/^\d{5}(-\d{4})?$/', $postal)) {
                        $validator->errors()->add($errorPrefix.'.address.postalCode', UsLocationDatasetValidator::COMPLIANCE_MESSAGE);
                    }
                    $legacy = [
                        'country' => 'US',
                        'state' => (string) ($addr['stateOrProvinceCode'] ?? ''),
                        'city' => trim((string) ($addr['city'] ?? '')),
                        'postalCode' => $postal,
                    ];
                    if ($dataset->validateUsLegacyRow($legacy) !== []) {
                        $validator->errors()->add($errorPrefix.'.address', UsLocationDatasetValidator::COMPLIANCE_MESSAGE);
                    }
                }
                if ($cc === 'CA') {
                    $compact = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($addr['postalCode'] ?? '')) ?? '');
                    if (strlen($compact) !== 6 || ! preg_match('/^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$/', $compact)) {
                        $validator->errors()->add($errorPrefix.'.address.postalCode', UsLocationDatasetValidator::COMPLIANCE_MESSAGE);
                    }
                    if ($phone !== '' && ! preg_match('/^[0-9]{7,15}$/', $phone)) {
                        $validator->errors()->add($errorPrefix.'.contact.phoneNumber', UsLocationDatasetValidator::COMPLIANCE_MESSAGE);
                    }
                }
            }
        });
    }

    protected function failedValidation(ValidatorContract $validator): void
    {
        $errors = $validator->errors();
        $response = [
            'message' => 'The given data was invalid.',
            'errors' => $errors->toArray(),
        ];
        foreach (['shipper.address.stateOrProvinceCode', 'recipients.0.address.stateOrProvinceCode'] as $key) {
            if (! $errors->has($key)) {
                continue;
            }
            foreach ($errors->get($key) as $msg) {
                if ($msg === UsStateCodeNormalizer::INVALID_MESSAGE) {
                    $response['code'] = UsStateCodeNormalizer::ERROR_CODE;
                    $response['message'] = UsStateCodeNormalizer::INVALID_MESSAGE;
                    break 2;
                }
            }
        }

        throw new HttpResponseException(response()->json($response, 422));
    }
}

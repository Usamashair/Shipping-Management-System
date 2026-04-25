<?php

namespace App\Http\Requests\Api\Concerns;

use App\Services\FedEx\UsLocationDatasetValidator;
use App\Support\UsNationalPhoneNormalizer;
use Illuminate\Validation\Validator;

/**
 * FedEx Ship API rejects invalid US/CA postal formats; validate before calling FedEx.
 * US: city/state/ZIP must match the bundled dataset; phone digits-only; street1 max 150.
 */
trait ValidatesFedExLegacyShipmentFields
{
    protected function prepareFedExLegacyAddressFields(): void
    {
        $data = $this->all();
        foreach (['sender_details', 'receiver_details'] as $prefix) {
            if (! isset($data[$prefix]) || ! is_array($data[$prefix])) {
                continue;
            }
            $row = $data[$prefix];
            if (isset($row['street1']) && is_string($row['street1'])) {
                $row['street1'] = trim($row['street1']);
            }
            if (isset($row['street2']) && is_string($row['street2'])) {
                $row['street2'] = trim($row['street2']);
            }
            if (isset($row['phone'])) {
                $row['phone'] = preg_replace('/\D+/', '', (string) $row['phone']) ?? '';
            }
            if (isset($row['country']) && is_string($row['country'])) {
                $row['country'] = strtoupper(trim($row['country']));
            }
            if (($row['country'] ?? '') === 'US' && isset($row['phone']) && is_string($row['phone'])) {
                $row['phone'] = UsNationalPhoneNormalizer::stripAndNormalizeUsNationalToTen($row['phone']);
            }
            if (isset($row['state']) && is_string($row['state'])) {
                $row['state'] = strtoupper(trim($row['state']));
            }
            $data[$prefix] = $row;
        }
        $this->replace($data);
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $dataset = app(UsLocationDatasetValidator::class);

            foreach (['sender_details', 'receiver_details'] as $prefix) {
                $row = $this->input($prefix);
                if (! is_array($row)) {
                    continue;
                }
                $country = strtoupper((string) ($row['country'] ?? ''));
                $postal = trim((string) ($row['postalCode'] ?? ''));
                $state = trim((string) ($row['state'] ?? ''));
                $street1 = (string) ($row['street1'] ?? '');
                $phone = (string) ($row['phone'] ?? '');

                if ($country === 'US') {
                    if (! preg_match('/^\d{5}(-\d{4})?$/', $postal)) {
                        $this->addFedExComplianceError($validator, $prefix.'.postalCode');
                    }
                    if (! preg_match('/^[A-Za-z]{2}$/', $state)) {
                        $this->addFedExComplianceError($validator, $prefix.'.state');
                    }
                    if ($phone !== '' && ! preg_match('/^[0-9]{10}$/', $phone)) {
                        $this->addFedExComplianceError($validator, $prefix.'.phone');
                    }
                    $reasons = $dataset->validateUsLegacyRow($row);
                    if ($reasons !== []) {
                        $this->addFedExComplianceError($validator, $prefix.'.city');
                    }
                }

                if ($country === 'CA') {
                    $compact = strtoupper(preg_replace('/[^A-Z0-9]/', '', $postal) ?? '');
                    if (strlen($compact) !== 6 || ! preg_match('/^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$/', $compact)) {
                        $this->addFedExComplianceError($validator, $prefix.'.postalCode');
                    }
                    if (! preg_match('/^[A-Za-z]{2}$/', $state)) {
                        $this->addFedExComplianceError($validator, $prefix.'.state');
                    }
                    if ($phone !== '' && ! preg_match('/^[0-9]{7,15}$/', $phone)) {
                        $this->addFedExComplianceError($validator, $prefix.'.phone');
                    }
                }

                if ($country !== 'US' && $country !== 'CA' && $phone !== '' && ! preg_match('/^[0-9]{7,15}$/', $phone)) {
                    $this->addFedExComplianceError($validator, $prefix.'.phone');
                }
            }
        });
    }

    private function addFedExComplianceError(Validator $validator, string $key): void
    {
        $validator->errors()->add($key, UsLocationDatasetValidator::COMPLIANCE_MESSAGE);
    }
}

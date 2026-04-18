<?php

namespace App\Services\FedEx;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

class AddressValidationService
{
    public function __construct(
        private readonly FedExOAuthToken $fedExOAuthToken,
    ) {}

    /**
     * @param  array<int, array{streetLines: array<int, string>, countryCode: string, city?: string, stateOrProvinceCode?: string, postalCode?: string}>  $addresses
     * @return array{
     *   resolvedAddresses: array<int, mixed>,
     *   alerts: array<int, string>,
     *   results: array<int, array{isValid: bool, resolvedAddress: ?array<string, mixed>, alerts: array<int, string>}>,
     *   fedex_transaction_id: string|null,
     *   fedex_customer_transaction_id: string|null
     * }
     */
    public function validateAddresses(array $addresses, ?string $inEffectAsOfTimestamp = null): array
    {
        if (count($addresses) > 100) {
            throw new RuntimeException('A maximum of 100 addresses may be validated per request.');
        }

        $transactionId = (string) Str::uuid();
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);

        $effectDate = ($inEffectAsOfTimestamp !== null && $inEffectAsOfTimestamp !== '')
            ? $inEffectAsOfTimestamp
            : now()->format('Y-m-d');

        $payload = [
            'inEffectAsOfTimestamp' => $effectDate,
            'validateAddressControlParameters' => [
                'includeResolutionTokens' => true,
            ],
            'addressesToValidate' => array_map(function (array $row): array {
                $lines = array_values(array_filter($row['streetLines'], fn ($s) => is_string($s) && $s !== ''));
                $addr = [
                    'streetLines' => $lines,
                    'countryCode' => $row['countryCode'],
                ];
                if (! empty($row['city'])) {
                    $addr['city'] = (string) $row['city'];
                }
                if (! empty($row['stateOrProvinceCode'])) {
                    $addr['stateOrProvinceCode'] = (string) $row['stateOrProvinceCode'];
                }
                if (! empty($row['postalCode'])) {
                    $addr['postalCode'] = (string) $row['postalCode'];
                }

                return ['address' => $addr];
            }, $addresses),
        ];

        try {
            $token = $this->fedExOAuthToken->getToken();
        } catch (\Throwable $e) {
            Log::error('FedEx OAuth failed before address validation.', [
                'x-customer-transaction-id' => $transactionId,
                'exception' => $e->getMessage(),
            ]);
            throw $e;
        }

        $response = Http::timeout($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $transactionId,
            ])
            ->withToken($token)
            ->post($base.'/address/v1/addresses/resolve', $payload);

        $body = $response->json() ?? [];

        if (! $response->successful()) {
            $snippet = Str::limit((string) json_encode($body), 2000);
            Log::error('FedEx address validation HTTP error.', [
                'x-customer-transaction-id' => $transactionId,
                'http_status' => $response->status(),
                'body' => $snippet,
            ]);
            throw new RuntimeException('FedEx address validation request failed (HTTP '.$response->status().').');
        }

        $output = is_array($body['output'] ?? null) ? $body['output'] : [];
        $resolvedRaw = $output['resolvedAddresses'] ?? [];
        if (! is_array($resolvedRaw)) {
            $resolvedRaw = [];
        }

        $globalAlerts = $this->collectAlerts($body, $output);
        $globalAlerts = array_merge($globalAlerts, $this->alertsFromErrors($body['errors'] ?? null));

        $results = [];
        $count = count($addresses);
        for ($i = 0; $i < $count; $i++) {
            $entry = is_array($resolvedRaw[$i] ?? null) ? $resolvedRaw[$i] : [];
            $addressState = $this->readAddressState($entry);
            $rollup = $this->readDeliveryPointRollup($entry);
            $isValid = $addressState === 'Standardized' && $rollup === 'CONFIRMED';

            $resolvedAddress = $this->mapToClientAddressShape($entry);
            $rowAlerts = $this->alertsForEntry($entry);
            $rowAlerts = array_merge($rowAlerts, $this->mapKnownErrorCodesFromEntry($entry));

            $results[] = [
                'isValid' => $isValid,
                'resolvedAddress' => $resolvedAddress,
                'alerts' => array_values(array_unique(array_filter([...$rowAlerts, ...$globalAlerts]))),
            ];
        }

        return [
            'resolvedAddresses' => $resolvedRaw,
            'alerts' => array_values(array_unique($globalAlerts)),
            'results' => $results,
            'fedex_transaction_id' => isset($body['transactionId']) && is_string($body['transactionId']) ? $body['transactionId'] : null,
            'fedex_customer_transaction_id' => isset($body['customerTransactionId']) && is_string($body['customerTransactionId'])
                ? $body['customerTransactionId']
                : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, mixed>  $output
     * @return array<int, string>
     */
    private function collectAlerts(array $body, array $output): array
    {
        $out = [];
        foreach ($output['alerts'] ?? [] as $alert) {
            if (is_string($alert)) {
                $out[] = $alert;
            } elseif (is_array($alert)) {
                $code = isset($alert['code']) ? (string) $alert['code'] : '';
                $msg = isset($alert['message']) ? (string) $alert['message'] : '';
                $out[] = trim($code.($code !== '' && $msg !== '' ? ': ' : '').$msg);
            }
        }

        return array_values(array_filter($out));
    }

    /**
     * @return array<int, string>
     */
    private function alertsFromErrors(mixed $errors): array
    {
        if (! is_array($errors)) {
            return [];
        }

        $out = [];
        foreach ($errors as $err) {
            if (! is_array($err)) {
                continue;
            }
            $code = isset($err['code']) ? (string) $err['code'] : '';
            $msg = $this->mapFedExErrorCode($code);
            if (isset($err['message']) && is_string($err['message']) && $err['message'] !== '') {
                $msg = $msg !== '' ? $msg.' — '.$err['message'] : $err['message'];
            }
            if ($msg !== '') {
                $out[] = $msg;
            }
        }

        return $out;
    }

    private function mapFedExErrorCode(string $code): string
    {
        return match ($code) {
            'COUNTRY.CODE.INVALID' => 'The country code is not valid.',
            'STANDARDIZED.ADDRESS.NOTFOUND' => 'FedEx could not standardize this address.',
            'DATESTAMP.FORMAT.INVALID' => 'The in-effect date format is invalid.',
            'ACCOUNTVERIFICATION.ACCOUNT.NOTFOUND' => 'FedEx reports this account is not shippable.',
            default => $code !== '' ? 'FedEx error: '.$code : '',
        };
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<int, string>
     */
    private function alertsForEntry(array $entry): array
    {
        $out = [];
        foreach ($entry['customerMessages'] ?? [] as $msg) {
            if (is_string($msg)) {
                $out[] = $msg;
            } elseif (is_array($msg)) {
                $code = isset($msg['code']) ? (string) $msg['code'] : '';
                $text = isset($msg['message']) ? (string) $msg['message'] : '';
                $mapped = $this->mapFedExErrorCode($code);
                $out[] = trim($mapped !== '' ? $mapped : $text);
            }
        }

        return array_values(array_filter($out));
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<int, string>
     */
    private function mapKnownErrorCodesFromEntry(array $entry): array
    {
        $codes = [];
        foreach ($entry['errors'] ?? [] as $e) {
            if (is_array($e) && isset($e['code'])) {
                $codes[] = $this->mapFedExErrorCode((string) $e['code']);
            }
        }

        return array_values(array_filter($codes));
    }

    /**
     * @param  array<string, mixed>  $entry
     */
    private function readAddressState(array $entry): ?string
    {
        $attrs = is_array($entry['attributes'] ?? null) ? $entry['attributes'] : [];
        $v = $entry['addressState'] ?? $attrs['addressState'] ?? null;

        return is_string($v) ? $v : null;
    }

    /**
     * @param  array<string, mixed>  $entry
     */
    private function readDeliveryPointRollup(array $entry): ?string
    {
        $attrs = is_array($entry['attributes'] ?? null) ? $entry['attributes'] : [];
        $v = $entry['deliveryPointValidationRollup'] ?? $attrs['deliveryPointValidationRollup'] ?? null;

        return is_string($v) ? $v : null;
    }

    /**
     * Map FedEx resolved entry to the shape expected by the SPA (AddressInput).
     *
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>|null
     */
    private function mapToClientAddressShape(array $entry): ?array
    {
        $addr = $entry['address'] ?? $entry['resolvedAddress'] ?? $entry['standardizedAddress'] ?? null;
        if (! is_array($addr)) {
            return null;
        }

        $lines = $addr['streetLines'] ?? $addr['streetlines'] ?? [];
        if (! is_array($lines)) {
            $lines = [];
        }
        $lines = array_values(array_filter(array_map(fn ($l) => is_string($l) ? $l : null, $lines)));

        $country = $addr['countryCode'] ?? $addr['country'] ?? null;
        if (! is_string($country) || $country === '') {
            return null;
        }

        $out = [
            'streetLines' => $lines,
            'countryCode' => $country,
        ];

        if (isset($addr['city']) && is_string($addr['city']) && $addr['city'] !== '') {
            $out['city'] = $addr['city'];
        }
        if (isset($addr['stateOrProvinceCode']) && is_string($addr['stateOrProvinceCode']) && $addr['stateOrProvinceCode'] !== '') {
            $out['stateOrProvinceCode'] = $addr['stateOrProvinceCode'];
        }
        if (isset($addr['postalCode']) && is_string($addr['postalCode']) && $addr['postalCode'] !== '') {
            $out['postalCode'] = $addr['postalCode'];
        }

        return $out;
    }
}

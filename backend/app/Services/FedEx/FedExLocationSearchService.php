<?php

namespace App\Services\FedEx;

use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Proxies FedEx Location Search API: POST /location/v1/locations.
 *
 * @see https://developer.fedex.com/api/en-us/catalog/locations/v1/docs.html
 */
class FedExLocationSearchService
{
    public function __construct(
        private readonly FedExOAuthToken $fedExOAuthToken,
    ) {}

    /**
     * @param  array<string, mixed>  $payload  FedEx request body (locationsSummaryRequestControlParameters, location, etc.)
     * @return array<string, mixed>
     */
    public function search(array $payload, ?string $customerTransactionId = null): array
    {
        $internalTxnId = (string) Str::uuid();
        $base = rtrim((string) config('fedex.base_url'), '/');
        $timeout = (int) config('fedex.http_timeout', 30);

        $txnHeader = (is_string($customerTransactionId) && $customerTransactionId !== '')
            ? $customerTransactionId
            : $internalTxnId;

        try {
            $token = $this->fedExOAuthToken->getToken();
        } catch (RuntimeException $e) {
            Log::error('FedEx OAuth failed before location search.', [
                'x-customer-transaction-id' => $txnHeader,
                'exception' => $e->getMessage(),
            ]);
            throw $e;
        }

        $response = FedExHttp::pending($timeout)
            ->asJson()
            ->withHeaders([
                'x-locale' => 'en_US',
                'x-customer-transaction-id' => $txnHeader,
            ])
            ->withToken($token)
            ->post($base.'/location/v1/locations', $payload);

        $body = $response->json();
        if (! is_array($body)) {
            $body = [];
        }

        if (! $response->successful()) {
            $snippet = Str::limit((string) json_encode($body), 4000);
            Log::error('FedEx location search HTTP error.', [
                'x-customer-transaction-id' => $txnHeader,
                'http_status' => $response->status(),
                'body' => $snippet,
            ]);
            $normalizedErrors = $this->enrichLocationSearchErrors(
                $this->normalizeFedExHttpErrorList($body),
            );
            $message = $this->firstFedExErrorMessage($normalizedErrors, $body, $response->status());
            $httpStatus = $response->status();
            $clientStatus = ($httpStatus >= 400 && $httpStatus < 500) ? 422 : 502;

            $out = [
                'message' => $message,
                'fedex_http_status' => $httpStatus,
                'fedex_errors' => $normalizedErrors,
                'transaction_id' => $body['transactionId'] ?? null,
            ];
            if ($normalizedErrors === []) {
                $out['fedex_response_preview'] = $snippet;
            }

            throw new HttpResponseException(response()->json($out, $clientStatus));
        }

        return $body;
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<int, array{code: string, message: string}>
     */
    private function normalizeFedExHttpErrorList(array $body): array
    {
        $out = [];

        $append = function (mixed $err) use (&$out): void {
            if (! is_array($err)) {
                return;
            }
            $code = $err['code'] ?? $err['errorCode'] ?? '';
            $msg = $err['message'] ?? $err['errorMessage'] ?? $err['localizedMessage'] ?? '';
            $code = is_string($code) ? $code : (is_scalar($code) ? (string) $code : '');
            $msg = is_string($msg) ? $msg : (is_scalar($msg) ? (string) $msg : '');
            if ($code === '' && $msg === '') {
                return;
            }
            $out[] = ['code' => $code, 'message' => $msg];
        };

        foreach (['errors', 'error'] as $key) {
            $block = $body[$key] ?? null;
            if (! is_array($block) || $block === []) {
                continue;
            }
            if (array_is_list($block)) {
                foreach ($block as $item) {
                    $append($item);
                }
            } else {
                $append($block);
            }
        }

        $output = $body['output'] ?? null;
        if (is_array($output)) {
            foreach (['errors', 'alerts'] as $key) {
                $block = $output[$key] ?? null;
                if (! is_array($block) || $block === []) {
                    continue;
                }
                if (array_is_list($block)) {
                    foreach ($block as $item) {
                        if (is_array($item)) {
                            $code = $item['code'] ?? '';
                            $msg = $item['message'] ?? $item['alertMessage'] ?? '';
                            $append(['code' => is_string($code) ? $code : '', 'message' => is_string($msg) ? $msg : '']);
                        }
                    }
                } else {
                    $append($block);
                }
            }
        }

        return $out;
    }

    /**
     * @param  array<int, array{code: string, message: string}>  $errors
     * @return array<int, array{code: string, message: string}>
     */
    private function enrichLocationSearchErrors(array $errors): array
    {
        $out = [];
        foreach ($errors as $err) {
            $code = (string) ($err['code'] ?? '');
            $msg = (string) ($err['message'] ?? '');
            $out[] = [
                'code' => $code,
                'message' => FedExLocationSearchErrorMapper::enrichMessage($code, $msg),
            ];
        }

        return $out;
    }

    /**
     * @param  array<int, array{code: string, message: string}>  $normalizedErrors  Already enriched
     */
    private function firstFedExErrorMessage(array $normalizedErrors, array $body, int $httpStatus): string
    {
        foreach ($normalizedErrors as $err) {
            $message = (string) ($err['message'] ?? '');
            if ($message !== '') {
                return $message;
            }
        }

        if (isset($body['message']) && is_string($body['message']) && $body['message'] !== '') {
            return $body['message'];
        }

        return 'FedEx location search failed (HTTP '.$httpStatus.').';
    }
}

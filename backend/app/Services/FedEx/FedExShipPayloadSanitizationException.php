<?php

namespace App\Services\FedEx;

use RuntimeException;

/**
 * Thrown when domestic Ship payload fails pre-flight validation before calling FedEx.
 */
final class FedExShipPayloadSanitizationException extends RuntimeException
{
    /**
     * @param  array<int, string>  $details
     */
    public function __construct(
        public readonly string $errorCode,
        public readonly array $details = [],
        string $message = '',
    ) {
        parent::__construct($message !== '' ? $message : $errorCode);
    }
}

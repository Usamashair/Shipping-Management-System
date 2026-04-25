<?php

namespace App\Services\FedEx;

/**
 * User-facing strings for FedEx Track / tracking-related API error codes.
 *
 * @see https://developer.fedex.com/api/en-us/catalog/track/v1/docs.html
 */
class FedExTrackingErrorMapper
{
    /**
     * Map a FedEx tracking-related error code to a catalog message. Returns empty string when unknown.
     */
    public static function mapCode(?string $code): string
    {
        if ($code === null || $code === '') {
            return '';
        }

        return match ($code) {
            'CUSTOMER.REVOKE.REQUIRED' => 'Customer has been revoked to view invited shipments.',
            'CUSTOMER.SIZE.INVALID' => 'Extraordinary sized customer.',
            'CUSTOMER.USAGE.LOCKED' => 'Customer is locked out.',
            'REFERENCETRACKING.SHIPDATERANGE.INVALID' => 'Please provide a valid ship date range as a part of search criteria when entering account number.',
            'TRACKING.ACCOUNTNUMBER.EMPTY' => 'If not providing FedEx account number, please enter destination country/territory and postal code.',
            'TRACKING.CUSTOMCRITICAL.ERROR' => 'For tracking information, please log in to customcritical.fedex.com or contact Customer Service at 1.866.274.6117.',
            'TRACKING.DATA.NOTUNIQUE' => 'A unique match was not found. Please resubmit your request with a FedEx service or enter your FedEx account number.',
            'TRACKING.DESTINATIONCOUNTRYCODE.INVALID' => 'Please provide a valid destination country/territory code.',
            'TRACKING.MULTISTOP.ERROR' => 'For tracking information, please log in to customcritical.fedex.com or contact Customer Service at 1.866.274.6117.',
            'TRACKING.POSTALCODE.INVALID' => 'Please provide a valid postal code.',
            'TRACKING.REFERENCEDATA.INCOMPLETE' => 'Please enter an account number or destination country/territory and postal code.',
            'TRACKING.REFERENCENUMBER.NOTFOUND' => 'Reference number cannot be found. Please correct the reference number and try again.',
            'TRACKING.REFERENCETYPE.INVALID' => 'Please provide a valid reference/associated type.',
            'TRACKING.REFERENCEVALUE.EMPTY' => 'Missing or invalid shipment. Please enter a valid shipment number.',
            'TRACKING.REFRENCEVALUE.INVALID' => 'Invalid reference number. Please correct the request and try again.',
            'TRACKING.REFERENCEVALUE.INVALID' => 'Invalid reference number. Please correct the request and try again.',
            'TRACKING.SHIPDATE.ENDDATEBEFOREBEGINDATE' => 'Invalid ship date range. End date should not be before begin date.',
            'TRACKING.SHIPDATEBEGIN.INVALID' => 'Please provide valid ship begin date.',
            'TRACKING.SHIPDATEBEGIN.TOOOLD' => 'We are unable to provide tracking information. Begin date is too far in the past.',
            'TRACKING.SHIPDATEEND.FUTURE' => 'Invalid ship date range. End date must not be in the future.',
            'TRACKING.SHIPDATEEND.INVALID' => 'Please provide valid ship end date.',
            'TRACKING.SHIPDATERANGE.ERROR' => 'Invalid date range. Please check for following conditions: 1. End date is before Begin date. 2. Begin date is beyond 2 years. 3. Begin to End date exceeds 30 days.',
            'TRACKING.SHIPDATERANGE.INVALID' => 'Invalid ship date range. Please provide valid ship begin and end date.',
            'TRACKING.SHIPDATERANGE.TOOLONG' => 'Ship date range is too long. Please reduce the range and try again.',
            'TRACKING.TCN.NOTFOUND' => 'Transportation control number cannot be found. Please correct the transportation control number and try again.',
            'TRACKING.TCNVALUE.EMPTY' => 'Please provide a valid Transportation Control Number.',
            'TRACKING.TRACKINGNUMBER.EMPTY' => 'Please provide tracking number.',
            'TRACKING.TRACKINGNUMBER.INVALID' => 'Invalid tracking number. Please correct the tracking number format and try again.',
            'TRACKING.TRACKINGNUMBER.NOTFOUND' => 'Tracking number cannot be found. Please correct the tracking number and try again.',
            'TRACKING.TRACKINGNUMBERS.LIMITEXCEEDED' => 'Please limit your inquiry to 30 tracking numbers or references.',
            'USER.RELOGIN.REQUIRED' => 'We are unable to process this shipment for the moment. Try again later or contact FedEx Customer Service.',
            'INTERNAL.SERVER.ERROR' => 'We encountered an unexpected error and are working to resolve the issue. We apologize for any inconvenience. Please check back at a later time.',
            'TRACKING.MULTIPIECE.ERROR' => 'We are unable to provide notifications because either the package is too old or there is more than one package with the provided tracking number.',
            'NOTIFICATION.TRACKINGNBR.NOTFOUND' => 'Tracking number cannot be found. Please update and try again.',
            'TRACKING.EMAILADDRESS.INVALID' => 'One or more of the Email addresses you entered is invalid. Please update and try again.',
            'TRACKING.LOCALE.INVALID' => 'Requested localization is invalid or not supported. Please update and try again.',
            'TRACKING.SENDERCONTACTNAME.INVALID' => 'Sender contact name is missing or invalid. Please update and try again.',
            'TRACKING.SENDEREMAILADDRESS.INVALID' => 'Sender email address is missing or invalid. Please update and try again.',
            'TRACKINGDOCUMENT.DOCUMENT.UNAVAILABLE' => 'Signature Proof of Delivery is not currently available for this Tracking Number. Availability of signature images may take up to 5 days after delivery date. Please try later.',
            default => '',
        };
    }

    /**
     * FedEx API message when present; otherwise catalog text for the code, else a generic code fallback.
     */
    public static function enrichMessage(string $code, string $apiMessage): string
    {
        if ($apiMessage !== '') {
            return $apiMessage;
        }
        $mapped = self::mapCode($code);
        if ($mapped !== '') {
            return $mapped;
        }

        return $code !== '' ? 'FedEx error: '.$code : '';
    }

    /**
     * @param  array<int, array{code: string, message: string}>  $errors
     * @return array<int, array{code: string, message: string}>
     */
    public static function enrichErrorList(array $errors): array
    {
        $out = [];
        foreach ($errors as $err) {
            $code = (string) ($err['code'] ?? '');
            $msg = (string) ($err['message'] ?? '');
            $out[] = [
                'code' => $code,
                'message' => self::enrichMessage($code, $msg),
            ];
        }

        return $out;
    }
}

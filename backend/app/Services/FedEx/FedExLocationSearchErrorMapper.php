<?php

namespace App\Services\FedEx;

/**
 * User-facing strings for FedEx Location Search API error codes (POST /location/v1/locations).
 *
 * @see https://developer.fedex.com/api/en-us/catalog/locations/v1/docs.html
 */
class FedExLocationSearchErrorMapper
{
    /**
     * Map a FedEx Location Search error code to a catalog message. Returns empty string when unknown.
     */
    public static function mapCode(?string $code): string
    {
        if ($code === null || $code === '') {
            return '';
        }

        return match ($code) {
            'ADDRESS.DETAILS.REQUIRED' => 'Address is required',
            'ADDRESS.MINIMUMLENGTH.REQUIRED' => 'Address must be at least 3 characters.',
            'CARRIAGEVALUE.EXCEEDS.CUSTOMVALUE' => 'The carriage value cannot exceed the customs value. The carriage value is optional. Please refer to the FedEx Service Guide.',
            'CITYNAME.MINIMUMLENGTH.ERROR' => 'City name must be at least 3 characters.',
            'COMPANYNAME.MINIMUMLENGTH.ERROR' => 'Company name must be at least 3 characters.',
            'CONTACT.NAME.REQUIRED' => 'Contact name is required',
            'CONTACTNAME.MINIMUMLENGTH.ERROR' => 'Contact name must be at least 2 characters',
            'COUNTRY.LOCATION.REQUIRED' => 'Select a Country/Location.',
            'COUNTRY.POSTALCODEORZIP.INVALID' => 'Invalid postal code/ZIP for the country selected. Please correct and try again.',
            'CURRENCY.TYPE.INVALID' => 'The currency type you selected is invalid. Please select another currency type.',
            'CURRENCYTYPE.CADORUSD.REQUIRED' => 'CAD or USD are the only currency types available. Please select CAD or USD as your currency type.',
            'POSTALCODE.ZIPCODE.REQUIRED' => 'Postal code/ZIP is required',
            'WEIGHT.NONNUMERIC.ERROR' => 'Enter a numeric value for weight',
            'ADDRESS.MATCHTYPE.INVALID' => 'Address match type is invalid.',
            'ERROR.LONGLAT.REQUIRED' => 'Longitude and Latitude are required.',
            'CONTENT.OPTIONS.INVALID' => 'Invalid Content Options.',
            'COUNTRY.CODE.SUPPORTED' => 'This Country Code is not supported.',
            'DESTINATION.ADDRESS.INVALID' => 'Destination address is invalid.',
            'DESTINATION.COUNTRY.INVALID' => 'Invalid destination country code',
            'DESTINATION.GEO.INVALID' => 'Destination geo coordinates is invalid.',
            'DESTINATION.POSTALCITY.INVALID' => 'Destination postal code and city are required.',
            'DESTINATION.STATE.REQUIRED' => 'Destination state is required.',
            'DISTANCE.UNIT.INVALID' => 'Distance unit is invalid.',
            'DROPOFF.TIME.INVALID' => 'Invalid Drop off Time.',
            'EFFECTIVE.DATE.INVALID' => 'Invalid effective date.',
            'FEDEX.LOCATIONTYPE.INVALID' => 'Invalid FedEx Location Type.',
            'GEO.BLANK.INVALID' => 'Geographical Coordinates is blank or invalid.',
            'LOCATION.ATTRIBUTE.INVALID' => 'Invalid Location Attributes..',
            'LOCATIONS.ORIGINCOUNTRY.NOTFOUND' => 'Origin country is invalid.',
            'LOCATIONSEARCH.CRITERION.REQUIRED' => 'The Locations Search Criterion is required.',
            'LOCATIONSERVICES.ADDRESSDETAILS.REQUIRED' => 'The Address is required.',
            'LOCKER.NOT.AVAILABLE' => 'Locker availability is not available',
            'MULTIPLEMATCH.NULL.INVALID' => 'MultipleMatchesAction is null or invalid.',
            'NORESULT.TO.RETURN' => 'No result returned.',
            'ORIGIN.ADDRESS.INVALID' => 'Origin address is invalid.',
            'ORIGIN.GEO.INVALID' => 'Origin geo coordinates is invalid.',
            'ORIGIN.STATE.REQUIRED' => 'Origin state is required.',
            'ORIGINALPOSTAL.CITY.REQUIRED' => 'Original postal code and city are required.',
            'POSTALCODE.VALUE.REQUIRED' => 'Postal Code is required.',
            'RADIUS.UNITS.INVALID' => 'Invalid Radius units.',
            'DISTANCE.VALUE.INVALID' => 'Invalid Distance value.',
            'REDIRECTHOLD.COUNTRY.INVALID' => 'Invalid country for redirect to hold.',
            'REDIRECTTO.HOLDSERVICES.INVALID' => 'Invalid Redirect To Hold Services.',
            'REQUEST.POSITIVE.NUMBER' => 'Results requested must be a non-negative integer.',
            'RESULT.TOSKIP.ZERO' => 'Results to skip is less than 0.',
            'RESULTS.FILTER.INVALID' => 'Invalid Results Filters.',
            'SEARCH.ORDER.INVALID' => 'Invalid Sort order.',
            'ACCOUNTNUMBER.MINIMUMLENGTH.REQUIRED' => 'Enter a valid 9-digit FedEx account number.',
            'PHONE.NUMBER.REQUIRED' => 'Phone Number is a required field. Please update and try again.',
            'INTERNAL.SERVER.ERROR' => 'We encountered an unexpected error and are working to resolve the issue. We apologize for any inconvenience. Please check back at a later time.',
            'LOCATION.COUNTRYCODE.REQUIRED' => 'Country Code is required and must be 2 characters long.',
            'LOCATION.ID.REQUIRED' => 'Location Id is required.',
            'LOCATION.SORTCRITERIA.INVALID' => 'Invalid Sort criterion.',
            'LOCATION.SEARCHCRITERIA.INVALID' => 'Invalid Location Search Criterion.',
            'PHONE.MINIMUMLENGTH.REQUIRED' => 'Phone no. must be 10 digits for U.S. and Canada.',
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
}

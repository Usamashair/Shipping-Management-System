<?php

namespace App\Support;

/**
 * Normalizes US state input to a 2-letter code for FedEx (never full names).
 */
final class UsStateCodeNormalizer
{
    public const ERROR_CODE = 'INVALID_STATE';

    public const INVALID_MESSAGE = 'Invalid state. Please select a valid US state.';

    /** @var array<int, string> */
    private const VALID_CODES = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
        'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
        'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
        'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    ];

    /**
     * Full name (any casing) / common spelling → ISO 3166-2:US code.
     *
     * @var array<string, string> lowercase name => code
     */
    private const NAME_TO_CODE = [
        'alabama' => 'AL',
        'alaska' => 'AK',
        'arizona' => 'AZ',
        'arkansas' => 'AR',
        'california' => 'CA',
        'colorado' => 'CO',
        'connecticut' => 'CT',
        'delaware' => 'DE',
        'district of columbia' => 'DC',
        'florida' => 'FL',
        'georgia' => 'GA',
        'hawaii' => 'HI',
        'idaho' => 'ID',
        'illinois' => 'IL',
        'indiana' => 'IN',
        'iowa' => 'IA',
        'kansas' => 'KS',
        'kentucky' => 'KY',
        'louisiana' => 'LA',
        'maine' => 'ME',
        'maryland' => 'MD',
        'massachusetts' => 'MA',
        'michigan' => 'MI',
        'minnesota' => 'MN',
        'mississippi' => 'MS',
        'missouri' => 'MO',
        'montana' => 'MT',
        'nebraska' => 'NE',
        'nevada' => 'NV',
        'new hampshire' => 'NH',
        'new jersey' => 'NJ',
        'new mexico' => 'NM',
        'new york' => 'NY',
        'north carolina' => 'NC',
        'north dakota' => 'ND',
        'ohio' => 'OH',
        'oklahoma' => 'OK',
        'oregon' => 'OR',
        'pennsylvania' => 'PA',
        'rhode island' => 'RI',
        'south carolina' => 'SC',
        'south dakota' => 'SD',
        'tennessee' => 'TN',
        'texas' => 'TX',
        'utah' => 'UT',
        'vermont' => 'VT',
        'virginia' => 'VA',
        'washington' => 'WA',
        'west virginia' => 'WV',
        'wisconsin' => 'WI',
        'wyoming' => 'WY',
    ];

    /**
     * Returns a 2-letter uppercase US state code, or null if the value cannot be mapped.
     */
    public static function normalizeForUs(string $input): ?string
    {
        $t = trim($input);
        if ($t === '') {
            return null;
        }

        if (preg_match('/^[A-Za-z]{2}$/', $t) === 1) {
            $code = strtoupper($t);

            return in_array($code, self::VALID_CODES, true) ? $code : null;
        }

        $key = strtolower(preg_replace('/\s+/', ' ', $t) ?? '');

        return self::NAME_TO_CODE[$key] ?? null;
    }
}

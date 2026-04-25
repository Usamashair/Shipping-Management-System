<?php

namespace Tests\Unit\Support;

use App\Support\UsNationalPhoneNormalizer;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class UsNationalPhoneNormalizerTest extends TestCase
{
    #[Test]
    public function it_strips_leading_country_code_1_for_eleven_digits(): void
    {
        $this->assertSame('9172511533', UsNationalPhoneNormalizer::stripAndNormalizeUsNationalToTen('19172511533'));
        $this->assertSame('9172511533', UsNationalPhoneNormalizer::stripAndNormalizeUsNationalToTen('1-917-251-1533'));
    }

    #[Test]
    public function to_null_from_digits_matches_ten_national(): void
    {
        $this->assertSame('9172511533', UsNationalPhoneNormalizer::toTenDigitNationalOrNullFromDigits('19172511533'));
        $this->assertNull(UsNationalPhoneNormalizer::toTenDigitNationalOrNullFromDigits('12345'));
    }
}

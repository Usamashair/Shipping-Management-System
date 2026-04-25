<?php

namespace Tests\Unit\Support;

use App\Support\UsStateCodeNormalizer;
use Tests\TestCase;

class UsStateCodeNormalizerTest extends TestCase
{
    public function test_uppercases_valid_two_letter_code(): void
    {
        $this->assertSame('TN', UsStateCodeNormalizer::normalizeForUs('tn'));
    }

    public function test_maps_full_state_name(): void
    {
        $this->assertSame('TN', UsStateCodeNormalizer::normalizeForUs('Tennessee'));
    }

    public function test_maps_district_of_columbia(): void
    {
        $this->assertSame('DC', UsStateCodeNormalizer::normalizeForUs('District of Columbia'));
    }

    public function test_rejects_invalid_code(): void
    {
        $this->assertNull(UsStateCodeNormalizer::normalizeForUs('ZZ'));
    }

    public function test_rejects_garbage(): void
    {
        $this->assertNull(UsStateCodeNormalizer::normalizeForUs('Not a state'));
    }
}

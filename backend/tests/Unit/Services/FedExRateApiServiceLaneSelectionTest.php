<?php

namespace Tests\Unit\Services;

use App\Services\FedEx\FedExRateApiService;
use ReflectionMethod;
use Tests\TestCase;

class FedExRateApiServiceLaneSelectionTest extends TestCase
{
    private function invokeSelectServiceType(FedExRateApiService $svc, array $data, array $available): ?string
    {
        $m = new ReflectionMethod(FedExRateApiService::class, 'selectServiceType');
        $m->setAccessible(true);

        return $m->invoke($svc, $data, $available);
    }

    public function test_hi_to_az_prefers_express_when_rate_lists_ground_and_2day(): void
    {
        config([
            'fedex.rate_placeholder_service_type' => 'FEDEX_GROUND',
            'fedex.rate_service_preference' => '',
        ]);

        $svc = $this->app->make(FedExRateApiService::class);
        $data = [
            'serviceType' => 'FEDEX_GROUND',
            'shipper' => ['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'HI']],
            'recipients' => [['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'AZ']]],
        ];

        $chosen = $this->invokeSelectServiceType($svc, $data, ['FEDEX_GROUND', 'FEDEX_2_DAY']);

        $this->assertSame('FEDEX_2_DAY', $chosen);
    }

    public function test_mainland_lane_still_prefers_ground_when_available(): void
    {
        config(['fedex.rate_service_preference' => '']);

        $svc = $this->app->make(FedExRateApiService::class);
        $data = [
            'serviceType' => 'FEDEX_GROUND',
            'shipper' => ['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'TN']],
            'recipients' => [['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'GA']]],
        ];

        $chosen = $this->invokeSelectServiceType($svc, $data, ['FEDEX_GROUND', 'FEDEX_2_DAY']);

        $this->assertSame('FEDEX_GROUND', $chosen);
    }

    public function test_mainland_lane_preserves_requested_service_when_not_in_rate_list(): void
    {
        config(['fedex.rate_service_preference' => 'FIRST_OVERNIGHT,FEDEX_2_DAY']);

        $svc = $this->app->make(FedExRateApiService::class);
        $data = [
            'serviceType' => 'FEDEX_GROUND',
            'shipper' => ['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'TN']],
            'recipients' => [['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'GA']]],
        ];

        $chosen = $this->invokeSelectServiceType($svc, $data, ['FIRST_OVERNIGHT', 'FEDEX_2_DAY']);

        $this->assertSame('FEDEX_GROUND', $chosen);
    }

    public function test_intra_hi_does_not_strip_ground_from_working_set(): void
    {
        config(['fedex.rate_service_preference' => '']);

        $svc = $this->app->make(FedExRateApiService::class);
        $data = [
            'serviceType' => 'FEDEX_GROUND',
            'shipper' => ['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'HI']],
            'recipients' => [['address' => ['countryCode' => 'US', 'stateOrProvinceCode' => 'HI']]],
        ];

        $chosen = $this->invokeSelectServiceType($svc, $data, ['FEDEX_GROUND', 'FEDEX_2_DAY']);

        $this->assertSame('FEDEX_GROUND', $chosen);
    }
}

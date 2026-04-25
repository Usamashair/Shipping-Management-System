<?php

namespace Tests\Unit\Services;

use App\Services\FedEx\LegacyShipmentDetailsToFedExShipMapper;
use Tests\TestCase;

class LegacyShipmentDetailsToFedExShipMapperTest extends TestCase
{
    private LegacyShipmentDetailsToFedExShipMapper $mapper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mapper = new LegacyShipmentDetailsToFedExShipMapper;
        config(['fedex.rate_lookup_enabled' => false]);
    }

    public function test_hawaii_origin_uses_non_contiguous_service_type(): void
    {
        config([
            'fedex.default_service_type' => 'FEDEX_GROUND',
            'fedex.non_contiguous_origin_service_type' => 'FEDEX_EXPRESS_SAVER',
            'fedex.non_contiguous_origin_pickup_type' => 'DROPOFF_AT_FEDEX_LOCATION',
        ]);

        $payload = $this->mapper->toFedExShipPayload(
            $this->sender(['state' => 'HI']),
            $this->receiver(),
            $this->package(),
        );

        $this->assertSame('FEDEX_EXPRESS_SAVER', $payload['serviceType']);
        $this->assertSame('DROPOFF_AT_FEDEX_LOCATION', $payload['pickupType']);
    }

    public function test_hawaii_full_name_maps_to_express_saver(): void
    {
        config([
            'fedex.default_service_type' => 'FEDEX_GROUND',
            'fedex.non_contiguous_origin_service_type' => 'FEDEX_EXPRESS_SAVER',
        ]);

        $payload = $this->mapper->toFedExShipPayload(
            $this->sender(['state' => 'Hawaii']),
            $this->receiver(),
            $this->package(),
        );

        $this->assertSame('FEDEX_EXPRESS_SAVER', $payload['serviceType']);
    }

    public function test_alaska_origin_uses_non_contiguous_service_type(): void
    {
        config([
            'fedex.default_service_type' => 'FEDEX_GROUND',
            'fedex.non_contiguous_origin_service_type' => 'FEDEX_EXPRESS_SAVER',
        ]);

        $payload = $this->mapper->toFedExShipPayload(
            $this->sender(['state' => 'AK']),
            $this->receiver(),
            $this->package(),
        );

        $this->assertSame('FEDEX_EXPRESS_SAVER', $payload['serviceType']);
    }

    public function test_contiguous_us_uses_default_service_type(): void
    {
        config([
            'fedex.default_service_type' => 'FEDEX_GROUND',
            'fedex.non_contiguous_origin_service_type' => 'FEDEX_EXPRESS_SAVER',
            'fedex.default_pickup_type' => 'USE_SCHEDULED_PICKUP',
        ]);

        $payload = $this->mapper->toFedExShipPayload(
            $this->sender(['state' => 'TN']),
            $this->receiver(),
            $this->package(),
        );

        $this->assertSame('FEDEX_GROUND', $payload['serviceType']);
        $this->assertSame('USE_SCHEDULED_PICKUP', $payload['pickupType']);
    }

    public function test_non_contiguous_override_reads_from_config(): void
    {
        config([
            'fedex.default_service_type' => 'FEDEX_GROUND',
            'fedex.non_contiguous_origin_service_type' => 'FEDEX_2_DAY',
        ]);

        $payload = $this->mapper->toFedExShipPayload(
            $this->sender(['state' => 'HI']),
            $this->receiver(),
            $this->package(),
        );

        $this->assertSame('FEDEX_2_DAY', $payload['serviceType']);
    }

    public function test_when_rate_lookup_enabled_mapper_uses_placeholder_service_only(): void
    {
        config([
            'fedex.rate_lookup_enabled' => true,
            'fedex.rate_placeholder_service_type' => 'FEDEX_GROUND',
            'fedex.non_contiguous_origin_pickup_type' => 'DROPOFF_AT_FEDEX_LOCATION',
        ]);

        $payload = $this->mapper->toFedExShipPayload(
            $this->sender(['state' => 'HI']),
            $this->receiver(),
            $this->package(),
        );

        $this->assertSame('FEDEX_GROUND', $payload['serviceType']);
        $this->assertSame('DROPOFF_AT_FEDEX_LOCATION', $payload['pickupType']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function sender(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Sender',
            'street1' => '1 Main St',
            'city' => 'City',
            'state' => 'TN',
            'postalCode' => '37203',
            'country' => 'US',
            'phone' => '9015551212',
        ], $overrides);
    }

    /**
     * @return array<string, mixed>
     */
    private function receiver(): array
    {
        return [
            'name' => 'Receiver',
            'street1' => '2 Oak Ave',
            'city' => 'Nashville',
            'state' => 'TN',
            'postalCode' => '37203',
            'country' => 'US',
            'phone' => '9015553434',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function package(): array
    {
        return [
            'weightLb' => 2,
            'lengthIn' => 12,
            'widthIn' => 9,
            'heightIn' => 6,
            'description' => 'Test',
        ];
    }
}

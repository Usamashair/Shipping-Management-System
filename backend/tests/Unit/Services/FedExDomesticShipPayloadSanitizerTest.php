<?php

namespace Tests\Unit\Services;

use App\Services\FedEx\FedExDomesticShipPayloadSanitizer;
use App\Services\FedEx\FedExShipErrorMapper;
use App\Services\FedEx\FedExShipPayloadSanitizationException;
use App\Support\UsStateCodeNormalizer;
use Tests\TestCase;

class FedExDomesticShipPayloadSanitizerTest extends TestCase
{
    private FedExDomesticShipPayloadSanitizer $sanitizer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->sanitizer = new FedExDomesticShipPayloadSanitizer;
    }

    public function test_valid_minimal_payload_passes(): void
    {
        $out = $this->sanitizer->sanitize($this->validPayload());

        $this->assertSame('FEDEX_GROUND', $out['serviceType']);
        $this->assertSame('US', $out['shipper']['address']['countryCode']);
        $this->assertSame('9015551212', $out['shipper']['contact']['phoneNumber']);
        $this->assertSame('9015551234', $out['recipients'][0]['contact']['phoneNumber']); // 11 digits -> national 10
        $this->assertFalse($out['recipients'][0]['address']['residential']);
        $this->assertCount(1, $out['packages']);
    }

    public function test_missing_phone_throws_phone_invalid(): void
    {
        $p = $this->validPayload();
        $p['shipper']['contact']['phoneNumber'] = '';

        try {
            $this->sanitizer->sanitize($p);
            $this->fail('Expected FedExShipPayloadSanitizationException');
        } catch (FedExShipPayloadSanitizationException $e) {
            $this->assertSame('PHONE_INVALID', $e->errorCode);
        }
    }

    public function test_weight_at_or_below_point_one_throws_package_invalid(): void
    {
        $p = $this->validPayload();
        $p['packages'][0]['weight']['value'] = 0.1;

        try {
            $this->sanitizer->sanitize($p);
            $this->fail('Expected FedExShipPayloadSanitizationException');
        } catch (FedExShipPayloadSanitizationException $e) {
            $this->assertSame('PACKAGE_INVALID', $e->errorCode);
        }
    }

    public function test_weight_below_point_one_throws_package_invalid(): void
    {
        $p = $this->validPayload();
        $p['packages'][0]['weight']['value'] = 0.05;

        try {
            $this->sanitizer->sanitize($p);
            $this->fail('Expected FedExShipPayloadSanitizationException');
        } catch (FedExShipPayloadSanitizationException $e) {
            $this->assertSame('PACKAGE_INVALID', $e->errorCode);
        }
    }

    public function test_long_street_line_is_truncated_to_150(): void
    {
        $p = $this->validPayload();
        $long = str_repeat('A', 151);
        $p['shipper']['address']['streetLines'] = [$long];

        $out = $this->sanitizer->sanitize($p);

        $this->assertSame(150, mb_strlen($out['shipper']['address']['streetLines'][0]));
    }

    public function test_invalid_service_type_throws_service_not_available(): void
    {
        $p = $this->validPayload();
        $p['serviceType'] = 'NOT_A_REAL_SERVICE';

        try {
            $this->sanitizer->sanitize($p);
            $this->fail('Expected FedExShipPayloadSanitizationException');
        } catch (FedExShipPayloadSanitizationException $e) {
            $this->assertSame('SERVICE_NOT_AVAILABLE', $e->errorCode);
        }
    }

    public function test_fedex_ship_error_mapper_skips_raw_message_for_invalid_input(): void
    {
        $messages = FedExShipErrorMapper::messagesFromErrors([
            ['code' => 'INVALID.INPUT.EXCEPTION', 'message' => 'Raw FedEx diagnostic text'],
        ]);

        $this->assertSame([FedExShipErrorMapper::GENERIC_INVALID_INPUT_MESSAGE], $messages);
    }

    public function test_invalid_us_state_throws_invalid_state(): void
    {
        $p = $this->validPayload();
        $p['shipper']['address']['stateOrProvinceCode'] = 'NotAState';

        try {
            $this->sanitizer->sanitize($p);
            $this->fail('Expected FedExShipPayloadSanitizationException');
        } catch (FedExShipPayloadSanitizationException $e) {
            $this->assertSame('INVALID_STATE', $e->errorCode);
            $this->assertSame(UsStateCodeNormalizer::INVALID_MESSAGE, $e->getMessage());
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validPayload(): array
    {
        return [
            'serviceType' => 'FEDEX_GROUND',
            'packagingType' => 'YOUR_PACKAGING',
            'is_residential' => false,
            'shipper' => [
                'contact' => [
                    'personName' => 'Shipper Name',
                    'phoneNumber' => '9015551212',
                    'companyName' => 'Co',
                ],
                'address' => [
                    'streetLines' => ['2000 Freight Rd'],
                    'city' => 'Memphis',
                    'stateOrProvinceCode' => 'TN',
                    'postalCode' => '38116',
                    'countryCode' => 'US',
                ],
            ],
            'recipients' => [
                [
                    'contact' => [
                        'personName' => 'Receiver',
                        'phoneNumber' => '19015551234',
                    ],
                    'address' => [
                        'streetLines' => ['100 Receiver St'],
                        'city' => 'Nashville',
                        'stateOrProvinceCode' => 'TN',
                        'postalCode' => '37203',
                        'countryCode' => 'US',
                    ],
                ],
            ],
            'packages' => [
                [
                    'weight' => ['value' => 2.5, 'units' => 'LB'],
                    'dimensions' => ['length' => 12, 'width' => 9, 'height' => 6, 'units' => 'IN'],
                ],
            ],
        ];
    }
}

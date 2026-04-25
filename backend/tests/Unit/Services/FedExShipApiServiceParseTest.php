<?php

namespace Tests\Unit\Services;

use App\Services\FedEx\FedExDomesticShipPayloadSanitizer;
use App\Services\FedEx\FedExOAuthToken;
use App\Services\FedEx\FedExShipApiService;
use Tests\TestCase;

class FedExShipApiServiceParseTest extends TestCase
{
    public function test_parse_extracts_tracking_from_nested_completed_shipment_detail(): void
    {
        $svc = new FedExShipApiService($this->createMock(FedExOAuthToken::class), $this->createMock(FedExDomesticShipPayloadSanitizer::class));

        $json = [
            'output' => [
                'transactionShipments' => [
                    [
                        'serviceType' => 'STANDARD_OVERNIGHT',
                        'shipDatestamp' => '2010-03-04',
                        'completedShipmentDetail' => [
                            'masterTrackingId' => [
                                'trackingNumber' => '49092000070120032835',
                            ],
                            'completedPackageDetails' => [
                                [
                                    'trackingIds' => [
                                        [
                                            'trackingNumber' => '49092000070120032835',
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $parsed = $svc->parseShipmentCreateOrAsyncResult($json);

        $this->assertSame('49092000070120032835', $parsed['trackingNumber']);
    }

    public function test_parse_prefers_master_tracking_on_transaction_shipment(): void
    {
        $svc = new FedExShipApiService($this->createMock(FedExOAuthToken::class), $this->createMock(FedExDomesticShipPayloadSanitizer::class));

        $json = [
            'output' => [
                'transactionShipments' => [
                    [
                        'masterTrackingNumber' => '794953535000',
                        'pieceResponses' => [
                            [
                                'trackingNumber' => '794953535000',
                                'packageDocuments' => [
                                    [
                                        'url' => 'https://example.com/label',
                                        'trackingNumber' => '794953535000',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $parsed = $svc->parseShipmentCreateOrAsyncResult($json);

        $this->assertSame('794953535000', $parsed['trackingNumber']);
        $this->assertSame('https://example.com/label', $parsed['labelUrl']);
    }

    public function test_normalize_pickup_type_maps_drop_box_to_fedex_dropoff_enum(): void
    {
        $this->assertSame('DROPOFF_AT_FEDEX_LOCATION', FedExShipApiService::normalizePickupTypeForFedEx('DROP_BOX'));
        $this->assertSame('USE_SCHEDULED_PICKUP', FedExShipApiService::normalizePickupTypeForFedEx('USE_SCHEDULED_PICKUP'));
        $this->assertSame('DROPOFF_AT_FEDEX_LOCATION', FedExShipApiService::normalizePickupTypeForFedEx('DROPOFF_AT_FEDEX_LOCATION'));
        $this->assertSame('USE_SCHEDULED_PICKUP', FedExShipApiService::normalizePickupTypeForFedEx(''));
    }
}

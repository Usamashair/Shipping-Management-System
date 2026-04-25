<?php

namespace Tests\Feature\Api;

use App\Models\Shipment;
use App\Models\TrackingLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FedExTrackingWebhookTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'Y1F6OiVUQW2JPSElmRE9U0IY5';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'fedex.webhook_secret' => self::SECRET,
            'fedex.webhook_enabled' => true,
            'fedex.webhook_allowed_ips' => [],
        ]);
    }

    public function test_returns_503_when_webhook_secret_not_configured(): void
    {
        config(['fedex.webhook_secret' => '']);

        $raw = '{"trackingNumber":"123"}';
        $sig = hash_hmac('sha256', $raw, self::SECRET, false);

        $this->call('POST', '/api/webhooks/fedex/tracking', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_FEDEX_SIGNATURE' => $sig,
        ], $raw)
            ->assertStatus(503)
            ->assertJsonPath('message', 'Webhook not configured.');
    }

    public function test_returns_401_when_signature_invalid(): void
    {
        $raw = '{"trackingNumber":"123"}';

        $this->call('POST', '/api/webhooks/fedex/tracking', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_FEDEX_SIGNATURE' => 'deadbeef',
        ], $raw)
            ->assertStatus(401)
            ->assertJsonPath('message', 'Invalid signature.');
    }

    public function test_returns_200_and_creates_tracking_log_when_signature_valid(): void
    {
        $user = User::factory()->create();
        $tn = '794953555571';
        $shipment = Shipment::query()->create([
            'user_id' => $user->id,
            'tracking_number' => $tn,
            'sender_details' => ['city' => 'A'],
            'receiver_details' => ['city' => 'B'],
            'package_details' => ['weightLb' => 1],
            'status' => 'in_transit',
        ]);

        $payload = [
            'output' => [
                'completeTrackResults' => [
                    [
                        'trackResults' => [
                            [
                                'trackingNumberInfo' => [
                                    'trackingNumber' => $tn,
                                ],
                                'latestStatusDetail' => [
                                    'description' => 'Delivered',
                                    'scanLocation' => [
                                        'city' => 'Memphis',
                                        'stateOrProvinceCode' => 'TN',
                                        'countryCode' => 'US',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $raw = json_encode($payload);
        $this->assertIsString($raw);
        $sig = hash_hmac('sha256', $raw, self::SECRET, false);

        $this->call('POST', '/api/webhooks/fedex/tracking', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_FEDEX_SIGNATURE' => $sig,
        ], $raw)
            ->assertOk()
            ->assertJsonPath('received', true);

        $shipment->refresh();
        $this->assertSame('delivered', $shipment->status);

        $this->assertSame(1, TrackingLog::query()->where('shipment_id', $shipment->id)->count());
        $log = TrackingLog::query()->where('shipment_id', $shipment->id)->first();
        $this->assertNotNull($log);
        $this->assertSame('Delivered', $log->status);
        $this->assertStringContainsString('Memphis', $log->location ?? '');
        $this->assertIsArray($log->raw_response);
        $this->assertSame('webhook', $log->raw_response['source'] ?? null);
    }

    public function test_returns_403_when_ip_not_allowlisted(): void
    {
        config(['fedex.webhook_allowed_ips' => ['203.0.113.50']]);

        $raw = '{}';
        $sig = hash_hmac('sha256', $raw, self::SECRET, false);

        $this->call('POST', '/api/webhooks/fedex/tracking', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_FEDEX_SIGNATURE' => $sig,
            'REMOTE_ADDR' => '127.0.0.1',
        ], $raw)
            ->assertStatus(403);
    }
}

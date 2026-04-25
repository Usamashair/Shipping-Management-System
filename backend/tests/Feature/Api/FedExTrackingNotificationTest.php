<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FedExTrackingNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'fedex.client_id' => 'test-client',
            'fedex.client_secret' => 'test-secret',
            'fedex.account_number' => '123456789',
            'fedex.base_url' => 'https://apis-sandbox.fedex.com',
        ]);
    }

    public function test_returns_502_when_fedex_not_configured(): void
    {
        config(['fedex.account_number' => '']);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/notifications', $this->samplePayload())
            ->assertStatus(502)
            ->assertJsonPath('message', 'FedEx is not configured.');
    }

    public function test_returns_422_when_sender_missing(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/notifications', [
            'trackingNumberInfo' => ['trackingNumber' => '128667043726'],
        ])->assertStatus(422);
    }

    public function test_returns_fedex_json_on_success(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-notify',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/notifications' => Http::response([
                'transactionId' => 'txn-notify-1',
                'customerTransactionId' => 'cust-1',
                'output' => [
                    'TrackingNumberInfo' => [
                        'trackingNumber' => '128667043726',
                        'carrierCode' => 'FDXE',
                    ],
                ],
            ], 200),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/notifications', $this->samplePayload())
            ->assertOk()
            ->assertJsonPath('transactionId', 'txn-notify-1')
            ->assertJsonPath('output.TrackingNumberInfo.trackingNumber', '128667043726');
    }

    public function test_returns_fedex_errors_on_http_400(): void
    {
        Http::fake([
            'https://apis-sandbox.fedex.com/oauth/token' => Http::response([
                'access_token' => 'tok-notify',
                'token_type' => 'bearer',
                'expires_in' => 3600,
            ], 200),
            'https://apis-sandbox.fedex.com/track/v1/notifications' => Http::response([
                'transactionId' => 'txn-err',
                'errors' => [
                    [
                        'code' => 'TRACKING.TRACKINGNUMBER.EMPTY',
                        'message' => 'Please provide tracking number.',
                    ],
                ],
            ], 400),
        ]);

        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/fedex/track/notifications', $this->samplePayload())
            ->assertStatus(422)
            ->assertJsonPath('fedex_errors.0.code', 'TRACKING.TRACKINGNUMBER.EMPTY')
            ->assertJsonPath('message', 'Please provide tracking number.');
    }

    /**
     * @return array<string, mixed>
     */
    private function samplePayload(): array
    {
        return [
            'senderContactName' => 'Sam Smith',
            'senderEMailAddress' => 'lsr1234@gmail.com',
            'trackingEventNotificationDetail' => [
                'trackingNotifications' => [
                    [
                        'notificationDetail' => [
                            'localization' => [
                                'languageCode' => 'en',
                                'localeCode' => 'US',
                            ],
                            'emailDetail' => [
                                'emailAddress' => 'p1@fedex.com',
                                'name' => 'Preethi',
                            ],
                            'notificationType' => 'HTML',
                        ],
                        'role' => 'SHIPPER',
                        'notificationEventTypes' => [
                            'ON_DELIVERY',
                            'ON_EXCEPTION',
                            'ON_ESTIMATED_DELIVERY',
                        ],
                        'currentResultRequestedFlag' => true,
                    ],
                ],
                'personalMessage' => 'Personal message content',
                'supportHTML' => null,
            ],
            'trackingNumberInfo' => [
                'trackingNumber' => '128667043726',
                'carrierCode' => 'FDXE',
                'trackingNumberUniqueId' => '245822~123456789012~FDEG',
            ],
            'shipDateBegin' => '2019-10-13',
            'shipDateEnd' => '2019-10-31',
        ];
    }
}

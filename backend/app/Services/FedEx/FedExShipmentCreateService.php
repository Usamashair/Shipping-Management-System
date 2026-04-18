<?php

namespace App\Services\FedEx;

use App\Jobs\CheckAsyncShipmentJob;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class FedExShipmentCreateService
{
    public function __construct(
        private readonly FedExShipApiService $fedExShip,
        private readonly AddressValidationService $addressValidation,
    ) {}

    public static function isConfigured(): bool
    {
        return filled(config('fedex.client_id'))
            && filled(config('fedex.client_secret'))
            && filled(config('fedex.account_number'));
    }

    /**
     * @param  array<string, mixed>  $fedexShipData  Validated FedEx ship shape (includes is_residential; no confirm_warnings).
     */
    public function create(User $user, array $fedexShipData, bool $confirmWarnings): Shipment
    {
        $recipient = $fedexShipData['recipients'][0];
        $addr = $recipient['address'];
        $addrLines = is_array($addr['streetLines'] ?? null) ? $addr['streetLines'] : [];

        $addrResult = $this->addressValidation->validateAddresses([
            [
                'streetLines' => array_values(array_filter($addrLines, fn ($s) => is_string($s) && $s !== '')),
                'city' => (string) ($addr['city'] ?? ''),
                'stateOrProvinceCode' => (string) ($addr['stateOrProvinceCode'] ?? ''),
                'postalCode' => (string) ($addr['postalCode'] ?? ''),
                'countryCode' => (string) ($addr['countryCode'] ?? ''),
            ],
        ]);

        $first = $addrResult['results'][0] ?? null;
        if (! is_array($first) || empty($first['isValid'])) {
            throw new HttpResponseException(response()->json([
                'message' => 'Recipient address must be validated and confirmed by FedEx before shipping.',
                'address_validation' => $first,
            ], 422));
        }

        $validateResult = $this->fedExShip->validateShipment($fedexShipData);
        if ($validateResult['alerts'] !== [] && ! $confirmWarnings) {
            throw new HttpResponseException(response()->json([
                'message' => 'FedEx returned validation warnings. Review alerts and resubmit with confirm_warnings=true.',
                'alerts' => $validateResult['alerts'],
            ], 422));
        }

        try {
            $create = $this->fedExShip->createShipment($fedexShipData);
        } catch (Throwable $e) {
            Log::error('FedEx ship create failed.', ['message' => $e->getMessage()]);
            throw new HttpResponseException(response()->json(['message' => $e->getMessage()], 502));
        }

        $tracking = $create['trackingNumber'] ?? null;
        if ($tracking === null || $tracking === '') {
            throw new HttpResponseException(response()->json(['message' => 'FedEx did not return a tracking number.'], 502));
        }

        $senderDetails = $this->partyToLegacyAddress($fedexShipData['shipper']);
        $receiverDetails = $this->partyToLegacyAddress($recipient);
        $pkg = $fedexShipData['packages'][0];
        $packageDetails = [
            'weightLb' => (float) data_get($pkg, 'weight.value'),
            'lengthIn' => (int) data_get($pkg, 'dimensions.length'),
            'widthIn' => (int) data_get($pkg, 'dimensions.width'),
            'heightIn' => (int) data_get($pkg, 'dimensions.height'),
            'description' => (string) data_get($pkg, 'description', 'FedEx shipment'),
        ];

        $shipment = Shipment::query()->create([
            'user_id' => $user->id,
            'tracking_number' => $tracking,
            'fedex_tracking_number' => $tracking,
            'sender_details' => $senderDetails,
            'receiver_details' => $receiverDetails,
            'package_details' => $packageDetails,
            'status' => 'label_created',
            'label_url' => $create['labelUrl'],
            'label_path' => null,
            'service_type' => $fedexShipData['serviceType'],
            'pickup_type' => $fedexShipData['pickupType'],
            'package_weight' => $packageDetails['weightLb'],
            'package_dimensions' => [
                'length' => $packageDetails['lengthIn'],
                'width' => $packageDetails['widthIn'],
                'height' => $packageDetails['heightIn'],
                'units' => 'IN',
            ],
            'is_residential' => (bool) ($fedexShipData['is_residential'] ?? false),
            'fedex_response' => $create['raw'],
            'fedex_transaction_id' => $create['transaction_id'],
            'fedex_job_id' => $create['jobId'],
            'shipped_at' => now(),
        ]);

        if (! empty($create['labelBase64'])) {
            $binary = base64_decode((string) $create['labelBase64'], true) ?: '';
            $relative = $shipment->id.'.pdf';
            Storage::disk('labels')->put($relative, $binary);
            $shipment->label_path = $relative;
            $shipment->label_url = null;
            $shipment->save();
        }

        if (! empty($create['jobId'])
            && empty($create['labelUrl'])
            && empty($create['labelBase64'])) {
            CheckAsyncShipmentJob::dispatch($shipment->id);
        }

        return $shipment->fresh();
    }

    /**
     * @param  array<string, mixed>  $party
     * @return array<string, mixed>
     */
    private function partyToLegacyAddress(array $party): array
    {
        $c = is_array($party['contact'] ?? null) ? $party['contact'] : [];
        $a = is_array($party['address'] ?? null) ? $party['address'] : [];
        $lines = is_array($a['streetLines'] ?? null) ? $a['streetLines'] : [];

        return [
            'name' => (string) ($c['personName'] ?? ''),
            'company' => (string) ($c['companyName'] ?? ''),
            'street1' => (string) ($lines[0] ?? ''),
            'street2' => (string) ($lines[1] ?? ''),
            'city' => (string) ($a['city'] ?? ''),
            'state' => (string) ($a['stateOrProvinceCode'] ?? ''),
            'postalCode' => (string) ($a['postalCode'] ?? ''),
            'country' => (string) ($a['countryCode'] ?? ''),
            'phone' => (string) ($c['phoneNumber'] ?? ''),
        ];
    }
}

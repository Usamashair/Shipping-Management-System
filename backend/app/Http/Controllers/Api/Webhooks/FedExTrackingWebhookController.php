<?php

namespace App\Http\Controllers\Api\Webhooks;

use App\Http\Controllers\Controller;
use App\Services\FedEx\FedExTrackingWebhookProcessor;
use App\Services\FedEx\FedExTrackingWebhookSignatureValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class FedExTrackingWebhookController extends Controller
{
    public function __construct(
        private readonly FedExTrackingWebhookProcessor $processor,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        if (! config('fedex.webhook_enabled', true)) {
            return response()->json(['message' => 'Webhook disabled.'], 503);
        }

        $secret = (string) config('fedex.webhook_secret', '');
        if ($secret === '') {
            return response()->json(['message' => 'Webhook not configured.'], 503);
        }

        $raw = $request->getContent();
        $sig = $request->header('x-fedex-signature');

        if (! FedExTrackingWebhookSignatureValidator::isValid($raw, $sig, $secret)) {
            if (config('app.debug')) {
                Log::warning('FedEx webhook: invalid or missing x-fedex-signature.');
            }

            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $payload = json_decode($raw, true);
        if (! is_array($payload)) {
            return response()->json(['message' => 'Invalid JSON.'], 400);
        }

        try {
            $this->processor->process($payload, $raw);
        } catch (Throwable $e) {
            Log::error('FedEx webhook processing failed.', [
                'exception' => $e->getMessage(),
            ]);

            return response()->json(['message' => 'Processing failed.'], 500);
        }

        return response()->json(['received' => true], 200);
    }
}

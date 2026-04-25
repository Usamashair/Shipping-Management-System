<?php

use App\Http\Controllers\Api\Admin\AppSettingsController;
use App\Http\Controllers\Api\Admin\ShipmentController as AdminShipmentController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Services\FixedRecipientService;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Customer\ShipmentController as CustomerShipmentController;
use App\Http\Controllers\Api\FedEx\AddressValidationController;
use App\Http\Controllers\Api\FedEx\FedExAssociatedShipmentsController;
use App\Http\Controllers\Api\FedEx\FedExFreightLtlPickupController;
use App\Http\Controllers\Api\FedEx\FedExFreightLtlRateController;
use App\Http\Controllers\Api\FedEx\FedExFreightLtlShipController;
use App\Http\Controllers\Api\FedEx\FedExLocationController;
use App\Http\Controllers\Api\FedEx\FedExRateQuoteController;
use App\Http\Controllers\Api\FedEx\FedExShipController;
use App\Http\Controllers\Api\FedEx\FedExTrackByReferenceController;
use App\Http\Controllers\Api\FedEx\FedExTrackByTcnController;
use App\Http\Controllers\Api\FedEx\FedExTrackByTrackingNumberController;
use App\Http\Controllers\Api\FedEx\FedExTrackDocumentController;
use App\Http\Controllers\Api\FedEx\FedExTrackingNotificationController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ShipmentLabelController;
use App\Http\Controllers\Api\Webhooks\FedExTrackingWebhookController;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/fedex/tracking', FedExTrackingWebhookController::class)
    ->middleware(['throttle:300,1', 'fedex.webhook.ip']);

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'laravel',
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::post('/auth/register', [AuthController::class, 'register'])
    ->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::prefix('user')->group(function (): void {
        Route::get('/profile', [ProfileController::class, 'show']);
        Route::post('/profile/save-personal', [ProfileController::class, 'savePersonal'])
            ->middleware('customer');
        Route::post('/profile/save-address', [ProfileController::class, 'saveAddress'])
            ->middleware('customer');
        Route::post('/profile/verify-address', [ProfileController::class, 'verifyAddress'])
            ->middleware('customer');
    });

    Route::post('/fedex/validate-address', [AddressValidationController::class, 'validate']);
    Route::post('/fedex/locations/search', [FedExLocationController::class, 'search'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/track/associated-shipments', [FedExAssociatedShipmentsController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/track/notifications', [FedExTrackingNotificationController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/track/by-reference', [FedExTrackByReferenceController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/track/tcn', [FedExTrackByTcnController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/track/documents', [FedExTrackDocumentController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/track/tracking-numbers', [FedExTrackByTrackingNumberController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/rates/quotes', [FedExRateQuoteController::class, 'store'])
        ->middleware('throttle:60,1');

    Route::post('/fedex/freight/ltl/rate-quotes', [FedExFreightLtlRateController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/freight/ltl/shipments', [FedExFreightLtlShipController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/freight/ltl/pickups/availability', [FedExFreightLtlPickupController::class, 'availability'])
        ->middleware('throttle:60,1');
    Route::post('/fedex/freight/ltl/pickups', [FedExFreightLtlPickupController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::put('/fedex/freight/ltl/pickups/cancel', [FedExFreightLtlPickupController::class, 'cancel'])
        ->middleware('throttle:60,1');

    Route::get('/fedex/shipments/jobs/{jobId}/status', [FedExShipController::class, 'asyncStatus']);
    Route::post('/fedex/shipments/validate', [FedExShipController::class, 'validateShipment']);
    Route::post('/fedex/shipments', [FedExShipController::class, 'store'])->middleware('customer');
    Route::post('/fedex/shipments/tag', [FedExShipController::class, 'createTag']);
    Route::put('/fedex/shipments/tag/cancel/{fedexShipmentId}', [FedExShipController::class, 'cancelTag'])->middleware('admin');
    Route::delete('/fedex/shipments/{shipment}', [FedExShipController::class, 'cancel']);

    Route::get('shipments/fixed-recipient', function () {
        return response()->json(['recipient' => FixedRecipientService::rawOrDefault()]);
    })->middleware('customer');

    Route::prefix('admin')->middleware('admin')->group(function (): void {
        Route::apiResource('users', UserController::class);
        Route::get('shipments', [AdminShipmentController::class, 'index']);
        Route::post('shipments', [AdminShipmentController::class, 'store']);
        Route::get('shipments/{shipment}', [AdminShipmentController::class, 'show']);
        Route::patch('shipments/{shipment}', [AdminShipmentController::class, 'update']);
        Route::delete('shipments/{shipment}', [AdminShipmentController::class, 'destroy']);
        Route::get('shipments/{shipment}/label', [ShipmentLabelController::class, 'download']);
        Route::patch('shipments/{shipment}/status', [AdminShipmentController::class, 'updateStatus']);

        Route::prefix('settings')->group(function (): void {
            Route::get('recipient', [AppSettingsController::class, 'getRecipient']);
            Route::put('recipient', [AppSettingsController::class, 'updateRecipient']);
        });
    });

    Route::prefix('customer')->middleware('customer')->group(function (): void {
        Route::get('shipments', [CustomerShipmentController::class, 'index']);
        Route::post('shipments', [CustomerShipmentController::class, 'store']);
        Route::get('shipments/{shipment}', [CustomerShipmentController::class, 'show']);
        Route::get('shipments/{shipment}/label', [ShipmentLabelController::class, 'download']);
        Route::post('shipments/{shipment}/track', [CustomerShipmentController::class, 'track']);
    });
});

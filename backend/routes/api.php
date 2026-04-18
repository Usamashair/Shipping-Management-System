<?php

use App\Http\Controllers\Api\Admin\ShipmentController as AdminShipmentController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Customer\ShipmentController as CustomerShipmentController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'laravel',
    ]);
});

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::prefix('admin')->middleware('admin')->group(function (): void {
        Route::apiResource('users', UserController::class);
        Route::get('shipments', [AdminShipmentController::class, 'index']);
        Route::post('shipments', [AdminShipmentController::class, 'store']);
        Route::get('shipments/{shipment}', [AdminShipmentController::class, 'show']);
        Route::patch('shipments/{shipment}/status', [AdminShipmentController::class, 'updateStatus']);
    });

    Route::prefix('customer')->middleware('customer')->group(function (): void {
        Route::get('shipments', [CustomerShipmentController::class, 'index']);
        Route::post('shipments', [CustomerShipmentController::class, 'store']);
        Route::get('shipments/{shipment}', [CustomerShipmentController::class, 'show']);
        Route::post('shipments/{shipment}/track', [CustomerShipmentController::class, 'track']);
    });
});

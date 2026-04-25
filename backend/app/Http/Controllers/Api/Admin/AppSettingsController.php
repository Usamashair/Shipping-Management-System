<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\User;
use App\Services\FixedRecipientService;
use App\Support\UsNationalPhoneNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AppSettingsController extends Controller
{
    public function getRecipient(): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        return response()->json([
            'recipient' => FixedRecipientService::rawOrDefault(),
        ]);
    }

    public function updateRecipient(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $validated = $request->validate([
            'personName' => 'required|string|max:255',
            'companyName' => 'nullable|string|max:255',
            'phoneNumber' => 'required|string|max:20',
            'email' => 'nullable|email|max:255',
            'address.streetLines' => 'required|array|min:1',
            'address.streetLines.*' => 'required|string|max:255',
            'address.city' => 'required|string|max:100',
            'address.stateOrProvinceCode' => 'required|string|max:10',
            'address.postalCode' => 'required|string|max:20',
            'address.countryCode' => 'required|string|size:2',
            'address.residential' => 'boolean',
        ]);

        $phoneNumber = $validated['phoneNumber'];
        if (strtoupper($validated['address']['countryCode'] ?? '') === 'US') {
            $phoneNumber = UsNationalPhoneNormalizer::stripAndNormalizeUsNationalToTen($phoneNumber);
        } else {
            $phoneNumber = preg_replace('/\D+/', '', (string) $phoneNumber) ?? (string) $phoneNumber;
        }

        AppSetting::set('fixed_recipient', [
            'personName' => $validated['personName'],
            'companyName' => $validated['companyName'] ?? '',
            'phoneNumber' => $phoneNumber,
            'email' => $validated['email'] ?? '',
            'address' => [
                'streetLines' => $validated['address']['streetLines'],
                'city' => $validated['address']['city'],
                'stateOrProvinceCode' => strtoupper($validated['address']['stateOrProvinceCode']),
                'postalCode' => $validated['address']['postalCode'],
                'countryCode' => strtoupper($validated['address']['countryCode']),
                'residential' => $validated['address']['residential'] ?? false,
            ],
        ]);

        Log::info('Fixed recipient updated by admin', [
            'admin_id' => $request->user()->id,
            'new_name' => $validated['personName'],
            'new_city' => $validated['address']['city'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Recipient address updated successfully.',
            'recipient' => FixedRecipientService::rawOrDefault(),
        ]);
    }
}

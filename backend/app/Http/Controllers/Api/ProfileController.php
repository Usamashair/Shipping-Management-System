<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\FedEx\AddressValidationService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProfileController extends Controller
{
    public function __construct(
        private readonly AddressValidationService $addressValidationService
    ) {}

    /** GET /api/user/profile */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json($this->buildProfileResponse($user));
    }

    /** POST /api/user/profile/save-personal — name, phone, company (no address required) */
    public function savePersonal(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => ['required', 'string', 'max:32', 'regex:/^[0-9+\-\s()]+$/u'],
            'company' => 'nullable|string|max:255',
        ]);

        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->update([
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'address_company' => $validated['company'] ?? null,
        ]);
        $user->refresh();
        Log::info('User personal profile updated', ['user_id' => $user->id]);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated.',
            'profile' => $this->buildProfileResponse($user),
        ]);
    }

    /** POST /api/user/profile/save-address */
    public function saveAddress(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => ['required', 'string', 'max:32', 'regex:/^[0-9+\-\s()]+$/u'],
            'company' => 'nullable|string|max:255',
            'street' => 'required|string|max:255',
            'street2' => 'nullable|string|max:255',
            'city' => 'required|string|max:100',
            'state' => 'required|string|max:10',
            'postal_code' => 'required|string|max:20',
            'country' => 'required|string|max:5',
        ]);

        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->update([
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'address_company' => $validated['company'] ?? null,
            'address_street' => $validated['street'],
            'address_street2' => $validated['street2'] ?? null,
            'address_city' => $validated['city'],
            'address_state' => strtoupper(substr($validated['state'], 0, 10)),
            'address_postal_code' => $validated['postal_code'],
            'address_country' => strtoupper(substr($validated['country'], 0, 5)),
            'address_saved' => true,
            'address_saved_at' => now(),
            'address_fedex_verified' => false,
            'address_verified_at' => null,
        ]);

        Log::info('User profile address saved', ['user_id' => $user->id]);

        $user->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Address saved successfully.',
            'profile' => $this->buildProfileResponse($user),
        ]);
    }

    /** POST /api/user/profile/verify-address — verifies saved address (no body) */
    public function verifyAddress(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->hasAddress()) {
            return response()->json([
                'verified' => false,
                'message' => 'Please save your address first before verifying.',
            ], 422);
        }

        if (config('fedex.env') === 'sandbox') {
            $user->update([
                'address_fedex_verified' => true,
                'address_verified_at' => now(),
            ]);
            $user->refresh();

            return response()->json([
                'verified' => true,
                'sandbox_skipped' => true,
                'message' => 'Address verified (sandbox mode).',
                'profile' => $this->buildProfileResponse($user),
            ]);
        }

        if (! filled(config('fedex.client_id')) || ! filled(config('fedex.client_secret'))) {
            return response()->json([
                'verified' => false,
                'sandbox_skipped' => false,
                'message' => 'FedEx API credentials are not configured.',
                'profile' => $this->buildProfileResponse($user),
            ], 200);
        }

        try {
            $result = $this->addressValidationService->validateAddresses([[
                'streetLines' => array_values(array_filter([
                    $user->address_street,
                    $user->address_street2,
                ], fn ($s) => is_string($s) && $s !== '')),
                'city' => (string) $user->address_city,
                'stateOrProvinceCode' => (string) $user->address_state,
                'postalCode' => (string) $user->address_postal_code,
                'countryCode' => $user->address_country ?? 'US',
            ]]);

            $first = is_array($result['results'][0] ?? null) ? $result['results'][0] : null;
            $isValid = is_array($first) && ($first['isValid'] ?? false);
            $resolved = is_array($first) ? ($first['resolvedAddress'] ?? null) : null;
            $rowAlerts = is_array($first) && isset($first['alerts']) && is_array($first['alerts'])
                ? $first['alerts']
                : [];
            $globalAlerts = is_array($result['alerts'] ?? null) ? $result['alerts'] : [];
            $alerts = array_values(array_unique(array_filter([...$rowAlerts, ...$globalAlerts])));

            $user->update([
                'address_fedex_verified' => $isValid,
                'address_verified_at' => $isValid ? now() : null,
            ]);
            $user->refresh();

            $resolvedFlat = $this->normalizeResolvedForProfile(
                is_array($resolved) ? $resolved : null
            );

            return response()->json([
                'verified' => $isValid,
                'sandbox_skipped' => false,
                'resolved_address' => $resolvedFlat,
                'alerts' => $alerts,
                'message' => $isValid
                    ? 'Address verified by FedEx successfully.'
                    : 'FedEx could not verify this address. You can still use it for shipping.',
                'profile' => $this->buildProfileResponse($user),
            ]);
        } catch (HttpResponseException $e) {
            Log::warning('Profile address FedEx verification HTTP response', [
                'user_id' => $user->id,
            ]);

            return response()->json([
                'verified' => false,
                'sandbox_skipped' => false,
                'message' => 'FedEx verification is temporarily unavailable. Your address is saved and can still be used.',
                'profile' => $this->buildProfileResponse($user->fresh()),
            ], 200);
        } catch (Throwable $e) {
            Log::error('FedEx address verification failed for user profile', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'verified' => false,
                'sandbox_skipped' => false,
                'message' => 'FedEx verification is temporarily unavailable. Your address is saved and can still be used.',
                'profile' => $this->buildProfileResponse($user->fresh()),
            ], 200);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function buildProfileResponse(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'phone' => $user->phone,
            'address_company' => $user->address_company,
            'address_street' => $user->address_street,
            'address_street2' => $user->address_street2,
            'address_city' => $user->address_city,
            'address_state' => $user->address_state,
            'address_postal_code' => $user->address_postal_code,
            'address_country' => $user->address_country ?? 'US',
            'address_saved' => (bool) $user->address_saved,
            'address_fedex_verified' => (bool) $user->address_fedex_verified,
            'address_saved_at' => $user->address_saved_at?->toIso8601String(),
            'address_verified_at' => $user->address_verified_at?->toIso8601String(),
            'has_address' => $user->hasAddress(),
        ];
    }

    /**
     * @param  array<string, mixed>|null  $resolved
     * @return array<string, mixed>|null
     */
    private function normalizeResolvedForProfile(?array $resolved): ?array
    {
        if ($resolved === null) {
            return null;
        }

        $lines = $resolved['streetLines'] ?? [];
        if (! is_array($lines)) {
            $lines = [];
        }
        $lines = array_values(array_filter(array_map(fn ($l) => is_string($l) ? $l : null, $lines)));

        return [
            'street' => $lines[0] ?? null,
            'street2' => $lines[1] ?? null,
            'city' => $resolved['city'] ?? null,
            'state' => $resolved['stateOrProvinceCode'] ?? null,
            'postal_code' => $resolved['postalCode'] ?? null,
            'country' => $resolved['countryCode'] ?? null,
        ];
    }
}

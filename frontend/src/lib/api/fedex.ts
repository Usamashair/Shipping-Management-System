import { apiFetch } from "@/lib/api/client";

export type AddressInput = {
  streetLines: string[];
  city?: string;
  stateOrProvinceCode?: string;
  postalCode?: string;
  countryCode: string;
};

export type AddressValidationResult = {
  isValid: boolean;
  resolvedAddress?: AddressInput;
  alerts?: string[];
};

type ValidateAddressApiResponse = {
  results: Array<{
    isValid: boolean;
    resolvedAddress?: AddressInput | null;
    alerts?: string[];
  }>;
};

/**
 * Validates a single address via Laravel (FedEx proxy). Requires a Sanctum token.
 */
export async function validateAddress(
  address: AddressInput,
  token: string,
): Promise<AddressValidationResult> {
  const res = await apiFetch<ValidateAddressApiResponse>("/api/fedex/validate-address", {
    method: "POST",
    token,
    body: { addresses: [address] },
  });

  const row = res.results?.[0];
  if (!row) {
    return {
      isValid: false,
      alerts: ["No validation result returned."],
    };
  }

  return {
    isValid: Boolean(row.isValid),
    resolvedAddress: row.resolvedAddress ?? undefined,
    alerts: Array.isArray(row.alerts) ? row.alerts : undefined,
  };
}

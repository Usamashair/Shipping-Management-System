import { apiFetch, ApiError } from "@/lib/api/client";
import {
  FEDEX_SANDBOX_LIMITED_USER_MESSAGE,
  isFedexSandboxVirtualResponseBody,
} from "@/lib/fedexSandbox";

export type AddressInput = {
  streetLines: string[];
  city?: string;
  stateOrProvinceCode?: string;
  postalCode?: string;
  countryCode: string;
};

export type AddressValidationResult = {
  isValid: boolean;
  /** FedEx sandbox virtual response — treat as “good enough” to proceed. */
  sandboxLimited?: boolean;
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
 * FedEx sandbox often returns VIRTUAL.RESPONSE (HTTP 422 from Laravel); that is converted to
 * `sandboxLimited: true` so callers can enable proceed without relying on catch-side heuristics.
 */
export async function validateAddress(
  address: AddressInput,
  token: string,
): Promise<AddressValidationResult> {
  try {
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
  } catch (e) {
    if (e instanceof ApiError && isFedexSandboxVirtualResponseBody(e.body)) {
      return {
        isValid: true,
        sandboxLimited: true,
        alerts: [FEDEX_SANDBOX_LIMITED_USER_MESSAGE],
      };
    }
    throw e;
  }
}

/** FedEx Location Search API response (POST /location/v1/locations) proxied by Laravel. */
export type FedExLocationSearchResponse = {
  transactionId?: string;
  customerTransactionId?: string;
  output?: Record<string, unknown>;
};

/** Common envelope for FedEx Track API JSON returned by the Laravel proxy. */
export type FedExTrackApiEnvelope = {
  transactionId?: string;
  customerTransactionId?: string;
  output?: Record<string, unknown>;
};

/**
 * Search FedEx locations (pickup/drop-off) via Laravel proxy to FedEx Location Search API.
 * Body matches FedEx `POST /location/v1/locations` JSON (requires `location`).
 */
export async function searchFedExLocations(
  token: string,
  body: Record<string, unknown>,
): Promise<FedExLocationSearchResponse> {
  return apiFetch<FedExLocationSearchResponse>("/api/fedex/locations/search", {
    method: "POST",
    token,
    body,
  });
}

/** FedEx Track Multiple Piece Shipment response (POST /track/v1/associatedshipments) proxied by Laravel. */
export type FedExAssociatedShipmentsResponse = FedExTrackApiEnvelope;

/**
 * Track MPS / Group MPS / outbound linked to return via Laravel proxy to FedEx
 * `POST /track/v1/associatedshipments`.
 */
export async function trackFedExAssociatedShipments(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExAssociatedShipmentsResponse> {
  const headers: Record<string, string> = {};
  if (options?.customerTransactionId) {
    headers["x-customer-transaction-id"] = options.customerTransactionId;
  }
  if (options?.locale) {
    headers["x-locale"] = options.locale;
  }
  return apiFetch<FedExAssociatedShipmentsResponse>("/api/fedex/track/associated-shipments", {
    method: "POST",
    token,
    body,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

/** FedEx Send Notification response (POST /track/v1/notifications) proxied by Laravel. */
export type FedExTrackingNotificationResponse = {
  transactionId?: string;
  customerTransactionId?: string;
  output?: Record<string, unknown>;
};

/**
 * Register tracking email notifications via Laravel proxy to FedEx
 * `POST /track/v1/notifications`.
 */
export async function sendFedExTrackingNotifications(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExTrackingNotificationResponse> {
  const headers: Record<string, string> = {};
  if (options?.customerTransactionId) {
    headers["x-customer-transaction-id"] = options.customerTransactionId;
  }
  if (options?.locale) {
    headers["x-locale"] = options.locale;
  }
  return apiFetch<FedExTrackingNotificationResponse>("/api/fedex/track/notifications", {
    method: "POST",
    token,
    body,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

/** FedEx Track by References response (POST /track/v1/referencenumbers) proxied by Laravel. */
export type FedExTrackByReferenceResponse = FedExTrackApiEnvelope;

/**
 * Track by alternate reference (customer ref, PO, etc.) via Laravel proxy to FedEx
 * `POST /track/v1/referencenumbers`.
 */
export async function trackFedExByReference(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExTrackByReferenceResponse> {
  const headers: Record<string, string> = {};
  if (options?.customerTransactionId) {
    headers["x-customer-transaction-id"] = options.customerTransactionId;
  }
  if (options?.locale) {
    headers["x-locale"] = options.locale;
  }
  return apiFetch<FedExTrackByReferenceResponse>("/api/fedex/track/by-reference", {
    method: "POST",
    token,
    body,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

/** FedEx Track by TCN response (POST /track/v1/tcn) proxied by Laravel. */
export type FedExTrackByTcnResponse = FedExTrackApiEnvelope;

/**
 * Track by Transportation Control Number via Laravel proxy to FedEx `POST /track/v1/tcn`.
 */
export async function trackFedExByTcn(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExTrackByTcnResponse> {
  const headers: Record<string, string> = {};
  if (options?.customerTransactionId) {
    headers["x-customer-transaction-id"] = options.customerTransactionId;
  }
  if (options?.locale) {
    headers["x-locale"] = options.locale;
  }
  return apiFetch<FedExTrackByTcnResponse>("/api/fedex/track/tcn", {
    method: "POST",
    token,
    body,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

/** FedEx Track Document response (POST /track/v1/trackingdocuments) proxied by Laravel. */
export type FedExTrackDocumentResponse = {
  transactionId?: string;
  customerTransactionId?: string;
  output?: Record<string, unknown>;
};

/**
 * Request SPOD / BOL / freight billing documents via Laravel proxy to FedEx
 * `POST /track/v1/trackingdocuments`.
 */
export async function requestFedExTrackDocument(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExTrackDocumentResponse> {
  const headers: Record<string, string> = {};
  if (options?.customerTransactionId) {
    headers["x-customer-transaction-id"] = options.customerTransactionId;
  }
  if (options?.locale) {
    headers["x-locale"] = options.locale;
  }
  return apiFetch<FedExTrackDocumentResponse>("/api/fedex/track/documents", {
    method: "POST",
    token,
    body,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

/** FedEx Track by Tracking Number response (POST /track/v1/trackingnumbers) proxied by Laravel. */
export type FedExTrackByTrackingNumberResponse = FedExTrackApiEnvelope;

/** Request body for `POST /track/v1/trackingnumbers` (matches FedEx API + backend validation). */
export type FedExTrackByTrackingNumberRequestBody = {
  includeDetailedScans: boolean;
  trackingInfo: Array<{
    trackingNumberInfo: {
      trackingNumber: string;
      carrierCode?: string;
    };
    shipDateBegin?: string;
    shipDateEnd?: string;
  }>;
};

/**
 * Builds a FedEx-shaped track-by-number payload for one or more numbers (max 30).
 * Optional `carrierCode` (e.g. FDXE, FDXG) is applied to every `trackingInfo` entry when set.
 */
export function buildFedExTrackByTrackingNumberPayload(
  trackingNumbers: string[],
  options?: { includeDetailedScans?: boolean; carrierCode?: string | null },
): FedExTrackByTrackingNumberRequestBody {
  const includeDetailedScans = options?.includeDetailedScans ?? true;
  const carrier = options?.carrierCode?.trim();
  const byNumber = trackingNumbers
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 30);

  return {
    includeDetailedScans,
    trackingInfo: byNumber.map((trackingNumber) => ({
      trackingNumberInfo: {
        trackingNumber,
        ...(carrier ? { carrierCode: carrier } : {}),
      },
    })),
  };
}

/**
 * Shaped for `POST /track/v1/referencenumbers` (matches `StoreFedExTrackByReferenceRequest`).
 * Server requires: `value` and either `accountNumber` or both `destinationCountryCode` + `destinationPostalCode`.
 */
export function buildFedExTrackByReferencePayload(params: {
  value: string;
  includeDetailedScans: boolean;
  type?: string | null;
  carrierCode?: string;
  accountNumber?: string;
  destinationCountryCode?: string;
  destinationPostalCode?: string;
  shipDateBegin?: string;
  shipDateEnd?: string;
}): Record<string, unknown> {
  const {
    value,
    includeDetailedScans,
    type: refType,
    carrierCode,
    accountNumber,
    destinationCountryCode,
    destinationPostalCode,
    shipDateBegin,
    shipDateEnd,
  } = params;
  const referencesInformation: Record<string, unknown> = {
    value: value.trim(),
  };
  if (refType?.trim()) {
    referencesInformation.type = refType.trim();
  }
  if (carrierCode?.trim()) {
    referencesInformation.carrierCode = carrierCode.trim();
  }
  if (accountNumber?.trim()) {
    referencesInformation.accountNumber = accountNumber.trim();
  }
  if (destinationCountryCode?.trim()) {
    referencesInformation.destinationCountryCode = destinationCountryCode.trim().toUpperCase().slice(0, 2);
  }
  if (destinationPostalCode?.trim()) {
    referencesInformation.destinationPostalCode = destinationPostalCode.trim();
  }
  if (shipDateBegin?.trim()) {
    referencesInformation.shipDateBegin = shipDateBegin.trim();
  }
  if (shipDateEnd?.trim()) {
    referencesInformation.shipDateEnd = shipDateEnd.trim();
  }
  return {
    includeDetailedScans,
    referencesInformation,
  };
}

/** Shaped for `POST /track/v1/tcn` (matches `StoreFedExTrackByTcnRequest`). */
export function buildFedExTrackByTcnPayload(params: {
  value: string;
  includeDetailedScans: boolean;
  carrierCode?: string;
  shipDateBegin?: string;
  shipDateEnd?: string;
}): Record<string, unknown> {
  const tcnInfo: Record<string, unknown> = {
    value: params.value.trim(),
  };
  if (params.carrierCode?.trim()) {
    tcnInfo.carrierCode = params.carrierCode.trim();
  }
  if (params.shipDateBegin?.trim()) {
    tcnInfo.shipDateBegin = params.shipDateBegin.trim();
  }
  if (params.shipDateEnd?.trim()) {
    tcnInfo.shipDateEnd = params.shipDateEnd.trim();
  }
  return {
    includeDetailedScans: params.includeDetailedScans,
    tcnInfo,
  };
}

/** Shaped for `POST /track/v1/associatedshipments` (matches `StoreFedExAssociatedShipmentsRequest`). */
export function buildFedExAssociatedShipmentsPayload(params: {
  associatedType: "OUTBOUND_LINK_TO_RETURN" | "STANDARD_MPS" | "GROUP_MPS";
  masterTrackingNumber: string;
  includeDetailedScans: boolean;
  carrierCode?: string;
  shipDateBegin?: string;
  shipDateEnd?: string;
}): Record<string, unknown> {
  const master: Record<string, unknown> = {
    trackingNumberInfo: {
      trackingNumber: params.masterTrackingNumber.trim(),
      ...(params.carrierCode?.trim() ? { carrierCode: params.carrierCode.trim() } : {}),
    },
  };
  if (params.shipDateBegin?.trim()) {
    master.shipDateBegin = params.shipDateBegin.trim();
  }
  if (params.shipDateEnd?.trim()) {
    master.shipDateEnd = params.shipDateEnd.trim();
  }
  return {
    includeDetailedScans: params.includeDetailedScans,
    associatedType: params.associatedType,
    masterTrackingNumberInfo: master,
  };
}

/**
 * Track packages by tracking number(s) via Laravel proxy to FedEx
 * `POST /track/v1/trackingnumbers`.
 */
export async function trackFedExByTrackingNumber(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExTrackByTrackingNumberResponse> {
  const headers: Record<string, string> = {};
  if (options?.customerTransactionId) {
    headers["x-customer-transaction-id"] = options.customerTransactionId;
  }
  if (options?.locale) {
    headers["x-locale"] = options.locale;
  }
  return apiFetch<FedExTrackByTrackingNumberResponse>("/api/fedex/track/tracking-numbers", {
    method: "POST",
    token,
    body,
    headers: Object.keys(headers).length ? headers : undefined,
  });
}

/** FedEx Freight LTL API JSON envelope (proxied by Laravel). */
export type FedExFreightLtlResponse = {
  transactionId?: string;
  customerTransactionId?: string;
  output?: Record<string, unknown>;
};

function fedExFreightLtlHeaders(options?: {
  customerTransactionId?: string;
  locale?: string;
}): Record<string, string> | undefined {
  const headers: Record<string, string> = {};
  if (options?.customerTransactionId) {
    headers["x-customer-transaction-id"] = options.customerTransactionId;
  }
  if (options?.locale) {
    headers["x-locale"] = options.locale;
  }
  return Object.keys(headers).length ? headers : undefined;
}

/**
 * Rate Freight LTL via Laravel proxy to FedEx `POST /rate/v1/freight/rates/quotes`.
 */
export async function fedExFreightLtlRateQuotes(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExFreightLtlResponse> {
  return apiFetch<FedExFreightLtlResponse>("/api/fedex/freight/ltl/rate-quotes", {
    method: "POST",
    token,
    body,
    headers: fedExFreightLtlHeaders(options),
  });
}

/**
 * Ship Freight LTL via Laravel proxy to FedEx `POST /ltl-freight/v1/shipments`.
 */
export async function fedExFreightLtlShipments(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExFreightLtlResponse> {
  return apiFetch<FedExFreightLtlResponse>("/api/fedex/freight/ltl/shipments", {
    method: "POST",
    token,
    body,
    headers: fedExFreightLtlHeaders(options),
  });
}

/**
 * Check Freight LTL pickup availability via FedEx `POST .../freight-ltl-pickups/availabilities`.
 */
export async function fedExFreightLtlPickupAvailability(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExFreightLtlResponse> {
  return apiFetch<FedExFreightLtlResponse>("/api/fedex/freight/ltl/pickups/availability", {
    method: "POST",
    token,
    body,
    headers: fedExFreightLtlHeaders(options),
  });
}

/**
 * Create Freight LTL pickup via FedEx `POST .../freight-ltl-pickups`.
 */
export async function fedExFreightLtlCreatePickup(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExFreightLtlResponse> {
  return apiFetch<FedExFreightLtlResponse>("/api/fedex/freight/ltl/pickups", {
    method: "POST",
    token,
    body,
    headers: fedExFreightLtlHeaders(options),
  });
}

/**
 * Cancel Freight LTL pickup via FedEx `PUT .../freight-ltl-pickups/cancel`.
 */
export async function fedExFreightLtlCancelPickup(
  token: string,
  body: Record<string, unknown>,
  options?: { customerTransactionId?: string; locale?: string },
): Promise<FedExFreightLtlResponse> {
  return apiFetch<FedExFreightLtlResponse>("/api/fedex/freight/ltl/pickups/cancel", {
    method: "PUT",
    token,
    body,
    headers: fedExFreightLtlHeaders(options),
  });
}

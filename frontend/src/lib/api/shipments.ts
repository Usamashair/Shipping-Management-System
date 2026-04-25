import { apiFetch, getApiBaseUrl, ApiError } from "@/lib/api/client";
import type { AddressDetails, FixedRecipient, PackageDetails, Shipment } from "@/lib/types";

/** Mirrors `App\Enums\FedExServiceType` for dropdowns and validation. */
export const FEDEX_SERVICE_TYPES = [
  { value: "PRIORITY_OVERNIGHT", label: "Priority Overnight" },
  { value: "FEDEX_GROUND", label: "FedEx Ground" },
  { value: "GROUND_HOME_DELIVERY", label: "FedEx Home Delivery" },
  { value: "FEDEX_2_DAY", label: "FedEx 2Day" },
  { value: "INTERNATIONAL_PRIORITY", label: "International Priority" },
  { value: "INTERNATIONAL_ECONOMY", label: "International Economy" },
  { value: "STANDARD_OVERNIGHT", label: "Standard Overnight" },
  { value: "FIRST_OVERNIGHT", label: "First Overnight" },
  { value: "FEDEX_EXPRESS_SAVER", label: "FedEx Express Saver" },
] as const;

export type FedExServiceTypeValue = (typeof FEDEX_SERVICE_TYPES)[number]["value"];

const FEDEX_SERVICE_SHORT_BY_VALUE: Record<FedExServiceTypeValue, string> = {
  PRIORITY_OVERNIGHT: "P.O.",
  FEDEX_GROUND: "Ground",
  GROUND_HOME_DELIVERY: "Home",
  FEDEX_2_DAY: "2Day",
  INTERNATIONAL_PRIORITY: "Intl P",
  INTERNATIONAL_ECONOMY: "Intl E",
  STANDARD_OVERNIGHT: "Std ON",
  FIRST_OVERNIGHT: "1st ON",
  FEDEX_EXPRESS_SAVER: "Saver",
};

/** Compact label for tables and dense UI; full code available from API `service_type`. */
export function fedExServiceTypeShortLabel(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "—";
  const key = String(value).trim();
  if (key in FEDEX_SERVICE_SHORT_BY_VALUE) {
    return FEDEX_SERVICE_SHORT_BY_VALUE[key as FedExServiceTypeValue];
  }
  const cleaned = String(value)
    .replace(/^FEDEX_/i, "")
    .replace(/_/g, " ")
    .trim();
  return cleaned.length > 14 ? `${cleaned.slice(0, 12)}…` : cleaned || "—";
}

/** Matches `ValidateFedExShipRequest` pickupType + `FedExShipApiService::normalizePickupTypeForFedEx` (DROP_BOX → DROPOFF). */
export type FedExPickupTypeValue =
  | "USE_SCHEDULED_PICKUP"
  | "DROP_BOX"
  | "DROPOFF_AT_FEDEX_LOCATION"
  | "CONTACT_FEDEX_TO_SCHEDULE";

export function pickupOptionsForServiceType(
  serviceType: FedExServiceTypeValue,
): { value: FedExPickupTypeValue; label: string }[] {
  if (serviceType === "GROUND_HOME_DELIVERY") {
    return [
      { value: "USE_SCHEDULED_PICKUP", label: "Scheduled Pickup" },
      { value: "DROPOFF_AT_FEDEX_LOCATION", label: "Drop off at FedEx" },
      { value: "CONTACT_FEDEX_TO_SCHEDULE", label: "Contact FedEx" },
    ];
  }
  return [
    { value: "USE_SCHEDULED_PICKUP", label: "Scheduled Pickup" },
    { value: "DROPOFF_AT_FEDEX_LOCATION", label: "Drop off at FedEx" },
    { value: "DROP_BOX", label: "FedEx Drop Box" },
    { value: "CONTACT_FEDEX_TO_SCHEDULE", label: "Contact FedEx" },
  ];
}

/** FedEx Ship API normalized error entries returned on 422/502 bodies as `fedex_errors`. */
export type FedExApiErrorItem = { code: string; message: string };

export function parseFedExErrorsFromBody(body: unknown): FedExApiErrorItem[] {
  if (typeof body !== "object" || body === null) {
    return [];
  }
  const raw = (body as Record<string, unknown>).fedex_errors;
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: FedExApiErrorItem[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const o = item as Record<string, unknown>;
    const code = typeof o.code === "string" ? o.code : "";
    const message = typeof o.message === "string" ? o.message : "";
    if (code !== "" || message !== "") {
      out.push({ code, message });
    }
  }
  return out;
}

export type FedExShipPayload = {
  serviceType: string;
  packagingType: string;
  pickupType: FedExPickupTypeValue;
  is_residential: boolean;
  shipper: FedExParty;
  recipients: FedExParty[];
  packages: FedExPackage[];
};

export type FedExParty = {
  contact: {
    personName: string;
    phoneNumber: string;
    companyName: string;
  };
  address: {
    streetLines: string[];
    city: string;
    stateOrProvinceCode: string;
    postalCode: string;
    countryCode: string;
    residential?: boolean;
  };
};

export type FedExPackage = {
  weight: { value: number; units?: string };
  dimensions: { length: number; width: number; height: number; units?: string };
};

type ShipmentApiEnvelope = { data: Shipment };

function addressToParty(a: AddressDetails, options?: { residential?: boolean }): FedExParty {
  const lines = [a.street1.trim(), (a.street2 ?? "").trim()].filter((s) => s.length > 0);
  // US state dropdown stores 2-letter ISO code (value); backend also maps full names defensively.
  const stateCode = a.state.trim().toUpperCase();
  const company = (a.company ?? "").trim();
  return {
    contact: {
      personName: a.name.trim() || "Contact",
      phoneNumber: a.phone.trim() || "0000000000",
      companyName: company.length > 0 ? company : "N/A",
    },
    address: {
      streetLines: lines.length > 0 ? lines : [""],
      city: a.city.trim(),
      stateOrProvinceCode: stateCode,
      postalCode: a.postalCode.trim(),
      countryCode: (a.country.trim() || "US").toUpperCase(),
      ...(options?.residential !== undefined ? { residential: options.residential } : {}),
    },
  };
}

/**
 * Placeholder only — the API overwrites `recipients` with the system fixed address before validation/ship.
 */
export const FEDEX_CUSTOMER_RECIPIENT_STUB: AddressDetails = {
  name: "Fixed recipient",
  company: "",
  street1: "—",
  street2: "",
  city: "—",
  state: "NJ",
  postalCode: "00000",
  country: "US",
  phone: "0000000000",
};

export function buildFedExShipPayload(
  sender: AddressDetails,
  receiver: AddressDetails,
  pkg: PackageDetails,
  serviceType: string,
  pickupType: FedExPickupTypeValue,
  isResidential: boolean,
): FedExShipPayload {
  return {
    serviceType,
    packagingType: "YOUR_PACKAGING",
    pickupType,
    is_residential: isResidential,
    shipper: addressToParty({ ...sender, name: sender.name.trim() || "Sender" }),
    recipients: [addressToParty(receiver, { residential: isResidential })],
    packages: [
      {
        weight: { value: Math.max(0.01, pkg.weightLb), units: "LB" },
        dimensions: {
          length: Math.max(1, Math.floor(pkg.lengthIn)),
          width: Math.max(1, Math.floor(pkg.widthIn)),
          height: Math.max(1, Math.floor(pkg.heightIn)),
          units: "IN",
        },
      },
    ],
  };
}

/** Customer new shipment: shipper + package only; fixed recipient is applied server-side. */
export function buildCustomerFedExShipPayload(
  sender: AddressDetails,
  pkg: PackageDetails,
  serviceType: string,
  pickupType: FedExPickupTypeValue,
  isResidential: boolean,
): FedExShipPayload {
  return buildFedExShipPayload(
    sender,
    FEDEX_CUSTOMER_RECIPIENT_STUB,
    pkg,
    serviceType,
    pickupType,
    isResidential,
  );
}

export async function fetchFixedRecipient(token: string): Promise<FixedRecipient> {
  const res = await apiFetch<{ recipient: FixedRecipient }>("/api/shipments/fixed-recipient", {
    token,
  });
  if (!res.recipient?.address?.streetLines) {
    throw new Error("Invalid fixed recipient response.");
  }
  return res.recipient;
}

export async function validateFedExShipment(
  token: string,
  payload: FedExShipPayload,
): Promise<{
  alerts: string[];
  transaction_id?: string;
  fedex_transaction_id?: string | null;
}> {
  const res = await apiFetch<{
    alerts: string[];
    transaction_id?: string;
    fedex_transaction_id?: string | null;
  }>("/api/fedex/shipments/validate", {
    method: "POST",
    token,
    body: payload,
  });
  return {
    alerts: Array.isArray(res.alerts) ? res.alerts : [],
    transaction_id: res.transaction_id,
    fedex_transaction_id: res.fedex_transaction_id ?? null,
  };
}

export async function createFedExShipment(
  token: string,
  payload: FedExShipPayload,
  options: { confirm_warnings?: boolean } = {},
): Promise<Shipment> {
  const res = await apiFetch<ShipmentApiEnvelope>("/api/fedex/shipments", {
    method: "POST",
    token,
    body: {
      ...payload,
      confirm_warnings: Boolean(options.confirm_warnings),
    },
  });
  return res.data;
}

export async function fetchFedExShipmentJobStatus(
  token: string,
  jobId: string,
): Promise<unknown> {
  return apiFetch<unknown>(
    `/api/fedex/shipments/jobs/${encodeURIComponent(jobId)}/status`,
    { token },
  );
}

export async function cancelFedExShipment(
  token: string,
  shipmentId: number,
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch<{ success: boolean; message: string }>(
    `/api/fedex/shipments/${shipmentId}`,
    {
      method: "DELETE",
      token,
    },
  );
  return res;
}

export async function downloadShipmentLabelBlob(
  token: string,
  shipmentId: number,
  scope: "customer" | "admin",
): Promise<Blob> {
  const prefix = scope === "admin" ? "/api/admin/shipments" : "/api/customer/shipments";
  const url = `${getApiBaseUrl()}${prefix}/${shipmentId}/label`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/pdf",
    },
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = { message: await res.text() };
    }
    const msg =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : res.statusText;
    throw new ApiError(msg || "Download failed", res.status, body);
  }
  return res.blob();
}

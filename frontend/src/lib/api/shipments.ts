import { apiFetch, getApiBaseUrl, ApiError } from "@/lib/api/client";
import type { AddressDetails, PackageDetails, Shipment } from "@/lib/types";

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

export type FedExShipPayload = {
  serviceType: string;
  packagingType: string;
  pickupType: "USE_SCHEDULED_PICKUP" | "DROP_BOX";
  is_residential: boolean;
  shipper: FedExParty;
  recipients: FedExParty[];
  packages: FedExPackage[];
};

export type FedExParty = {
  contact: {
    personName: string;
    phoneNumber: string;
    companyName?: string;
  };
  address: {
    streetLines: string[];
    city: string;
    stateOrProvinceCode: string;
    postalCode: string;
    countryCode: string;
  };
};

export type FedExPackage = {
  weight: { value: number; units?: string };
  dimensions: { length: number; width: number; height: number; units?: string };
};

type ShipmentApiEnvelope = { data: Shipment };

function addressToParty(a: AddressDetails): FedExParty {
  const lines = [a.street1.trim(), (a.street2 ?? "").trim()].filter((s) => s.length > 0);
  return {
    contact: {
      personName: a.name.trim() || "Contact",
      phoneNumber: a.phone.trim() || "0000000000",
      companyName: a.company?.trim() || undefined,
    },
    address: {
      streetLines: lines.length > 0 ? lines : [""],
      city: a.city.trim(),
      stateOrProvinceCode: a.state.trim(),
      postalCode: a.postalCode.trim(),
      countryCode: (a.country.trim() || "US").toUpperCase(),
    },
  };
}

export function buildFedExShipPayload(
  sender: AddressDetails,
  receiver: AddressDetails,
  pkg: PackageDetails,
  serviceType: string,
  pickupType: "USE_SCHEDULED_PICKUP" | "DROP_BOX",
  isResidential: boolean,
): FedExShipPayload {
  return {
    serviceType,
    packagingType: "YOUR_PACKAGING",
    pickupType,
    is_residential: isResidential,
    shipper: addressToParty({ ...sender, name: sender.name.trim() || "Sender" }),
    recipients: [addressToParty(receiver)],
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

export async function validateFedExShipment(
  token: string,
  payload: FedExShipPayload,
): Promise<{ alerts: string[] }> {
  const res = await apiFetch<{ alerts: string[] }>("/api/fedex/shipments/validate", {
    method: "POST",
    token,
    body: payload,
  });
  return { alerts: Array.isArray(res.alerts) ? res.alerts : [] };
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

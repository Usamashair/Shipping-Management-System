import { apiFetch } from "@/lib/api/client";
import type { FixedRecipient } from "@/lib/types";

export async function fetchAdminFixedRecipient(token: string): Promise<FixedRecipient> {
  const res = await apiFetch<{ recipient: FixedRecipient }>("/api/admin/settings/recipient", { token });
  if (!res.recipient?.address?.streetLines) {
    throw new Error("Invalid recipient response.");
  }
  return res.recipient;
}

export type AdminUpdateFixedRecipientInput = {
  personName: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  streetLine1: string;
  streetLine2: string;
  city: string;
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode: string;
  residential: boolean;
};

export async function updateAdminFixedRecipient(
  token: string,
  body: AdminUpdateFixedRecipientInput,
): Promise<{ success: boolean; message: string; recipient: FixedRecipient }> {
  const lines = [body.streetLine1, body.streetLine2].map((s) => s.trim()).filter((s) => s.length > 0);
  return apiFetch("/api/admin/settings/recipient", {
    method: "PUT",
    token,
    body: {
      personName: body.personName,
      companyName: body.companyName.trim() === "" ? null : body.companyName.trim(),
      phoneNumber: body.phoneNumber,
      email: body.email.trim() === "" ? null : body.email.trim(),
      address: {
        streetLines: lines,
        city: body.city,
        stateOrProvinceCode: body.stateOrProvinceCode,
        postalCode: body.postalCode,
        countryCode: body.countryCode,
        residential: body.residential,
      },
    },
  });
}

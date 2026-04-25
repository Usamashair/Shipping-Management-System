import type { AddressDetails } from "@/lib/types";

/** Matches backend `UsLocationDatasetValidator::COMPLIANCE_MESSAGE`. */
export const FEDEX_ADDRESS_COMPLIANCE_MESSAGE =
  "Invalid field value in address. Please verify state, city, ZIP, street, and phone format according to FedEx requirements.";

/** Strip to digits only (FedEx phone rules). */
export function digitsOnlyPhone(input: string): string {
  return input.replace(/\D/g, "");
}

/** US national 10 digits; treats +1 / leading 1 as country code. */
export function nationalUs10DigitPhone(input: string): string {
  const d = digitsOnlyPhone(input);
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

const US_ZIP = /^\d{5}(-\d{4})?$/;
const US_STATE = /^[A-Za-z]{2}$/;

/** `12345`, `12345-6789`, or 9 digits without hyphen (storage noise). */
export function isUsZipFormatLoose(postal: string): boolean {
  const t = postal.trim();
  if (US_ZIP.test(t)) return true;
  const digits = t.replace(/\D/g, "");
  return digits.length === 5 || digits.length === 9;
}

function baseZip(zip: string): string {
  const d = zip.replace(/\D/g, "");
  return d.length >= 5 ? d.slice(0, 5) : "";
}

/**
 * Client-side checks (street, phone, US postal/state). Does not load city JSON.
 */
export function validateUsAddressBasics(address: AddressDetails): boolean {
  const street1 = address.street1.trim();
  if (street1.length === 0 || street1.length > 150) return false;
  if ((address.street2 ?? "").trim().length > 255) return false;

  const cc = (address.country || "US").toUpperCase();
  const phone = cc === "US" ? nationalUs10DigitPhone(address.phone) : digitsOnlyPhone(address.phone);
  if (cc === "US") {
    if (phone.length !== 10) return false;
  } else if (!/^[0-9]{7,15}$/.test(phone)) {
    return false;
  }

  if (cc === "US") {
    if (!US_STATE.test(address.state.trim())) return false;
    if (!isUsZipFormatLoose(address.postalCode)) return false;
  }

  return true;
}

type CitiesPayload = { cities: Array<{ name: string; zips: string[] }> };

/**
 * Ensures city + ZIP exist in the same dataset as the dropdowns (strict US).
 */
export async function validateUsCityStateZipDataset(address: AddressDetails): Promise<boolean> {
  const cc = (address.country || "US").toUpperCase();
  if (cc !== "US") return true;

  const state = address.state.trim().toUpperCase();
  const city = address.city.trim();
  const postal = address.postalCode.trim();
  if (!state || !city || !postal) return false;

  try {
    const res = await fetch(`/data/us/cities/${state}.json`);
    if (!res.ok) return false;
    const data = (await res.json()) as CitiesPayload;
    const row = data.cities?.find((c) => c.name === city);
    if (!row) return false;
    const want = baseZip(postal);
    return row.zips.some((z) => baseZip(z) === want);
  } catch {
    return false;
  }
}

/** Full gate before API submission (US addresses). */
export async function validateUsAddressForFedExSubmission(address: AddressDetails): Promise<boolean> {
  if (!validateUsAddressBasics(address)) return false;
  const cc = (address.country || "US").toUpperCase();
  if (cc === "US") {
    return validateUsCityStateZipDataset(address);
  }
  return true;
}

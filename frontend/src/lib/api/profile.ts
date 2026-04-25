import { apiFetch } from "@/lib/api/client";
import type { ProfileFormData, User, UserProfile } from "@/lib/types";

export async function getUserProfile(token: string): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/user/profile", { token });
}

export type SaveAddressResponse = {
  success: boolean;
  message: string;
  profile: UserProfile;
};

export type SavePersonalResponse = SaveAddressResponse;

export async function savePersonalDetails(
  token: string,
  data: { name: string; phone: string; company: string },
): Promise<SavePersonalResponse> {
  return apiFetch<SavePersonalResponse>("/api/user/profile/save-personal", {
    method: "POST",
    token,
    body: {
      name: data.name,
      phone: data.phone,
      company: data.company,
    },
  });
}

export async function saveUserAddress(
  token: string,
  data: ProfileFormData,
): Promise<SaveAddressResponse> {
  return apiFetch<SaveAddressResponse>("/api/user/profile/save-address", {
    method: "POST",
    token,
    body: {
      name: data.name,
      phone: data.phone,
      company: data.company,
      street: data.street,
      street2: data.street2,
      city: data.city,
      state: data.state,
      postal_code: data.postal_code,
      country: data.country,
    },
  });
}

export type VerifySavedAddressResponse = {
  verified: boolean;
  sandbox_skipped?: boolean;
  resolved_address?: {
    street?: string | null;
    street2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  alerts?: string[];
  message: string;
  profile: UserProfile;
};

export async function verifySavedAddress(token: string): Promise<VerifySavedAddressResponse> {
  return apiFetch<VerifySavedAddressResponse>("/api/user/profile/verify-address", {
    method: "POST",
    token,
    body: {},
  });
}

/** Map API profile to session `User` for auth storage */
export function userProfileToSessionUser(partial: User, profile: UserProfile): User {
  return {
    ...partial,
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    phone: profile.phone,
    address_street: profile.address_street,
    address_street2: profile.address_street2,
    address_city: profile.address_city,
    address_state: profile.address_state,
    address_postal_code: profile.address_postal_code,
    address_country: profile.address_country,
    address_company: profile.address_company,
    address_saved: profile.address_saved,
    address_fedex_verified: profile.address_fedex_verified,
    address_saved_at: profile.address_saved_at,
    address_verified_at: profile.address_verified_at,
    has_address: profile.has_address,
  };
}

import { apiFetch } from "@/lib/api/client";
import type { User } from "@/lib/types";

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone: string;
  company?: string;
};

export async function loginRequest(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function registerRequest(payload: RegisterPayload): Promise<{ token: string; user: User }> {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: {
      name: payload.name.trim(),
      email: payload.email.trim(),
      password: payload.password,
      password_confirmation: payload.password_confirmation,
      phone: payload.phone.trim(),
      ...(payload.company?.trim() ? { company: payload.company.trim() } : {}),
    },
  });
}

export async function logoutRequest(token: string): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST", token });
}

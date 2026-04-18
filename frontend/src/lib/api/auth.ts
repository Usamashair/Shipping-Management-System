import { apiFetch } from "@/lib/api/client";
import type { User } from "@/lib/types";

export async function loginRequest(
  email: string,
  password: string,
): Promise<{ token: string; user: User }> {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function logoutRequest(token: string): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST", token });
}

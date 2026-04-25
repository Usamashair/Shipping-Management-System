/**
 * FedEx sandbox returns HTTP 4xx with VIRTUAL.RESPONSE for payloads that don’t match
 * “virtualized” sample transactions. Laravel maps that to 422 with the same body fields.
 */

export const FEDEX_SANDBOX_LIMITED_USER_MESSAGE =
  "Address validation is limited in sandbox mode. You can still proceed to create the shipment.";

/**
 * Detects FedEx sandbox virtualization / virtual response errors from Laravel proxy JSON.
 */
export function isFedexSandboxVirtualResponseBody(body: unknown): boolean {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;

  const errors = b.fedex_errors;
  const hasVirtualError =
    Array.isArray(errors) &&
    errors.some((err) => {
      if (typeof err !== "object" || err === null) {
        return false;
      }
      const e = err as Record<string, unknown>;
      if (e.code === "VIRTUAL.RESPONSE") {
        return true;
      }
      const msg = e.message;
      return typeof msg === "string" && /virtual response/i.test(msg);
    });

  // Any VIRTUAL.RESPONSE in the list is sandbox-limited; do not require fedex_http_status (defensive).
  if (hasVirtualError) {
    return true;
  }

  const top = b.message;
  if (typeof top === "string") {
    if (/VIRTUAL\.RESPONSE/i.test(top)) {
      return true;
    }
    if (/virtualiz/i.test(top) && /address validation/i.test(top)) {
      return true;
    }
    if (/sandbox uses virtualized/i.test(top)) {
      return true;
    }
  }

  return false;
}

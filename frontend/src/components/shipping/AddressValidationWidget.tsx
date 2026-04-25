"use client";

import { useCallback, useEffect, useState } from "react";
import { validateAddress, type AddressInput } from "@/lib/api/fedex";
import { FEDEX_SANDBOX_LIMITED_USER_MESSAGE } from "@/lib/fedexSandbox";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { DASHBOARD_CARD_INSET } from "@/lib/dashboardCardStyles";
import type { AddressDetails } from "@/lib/types";

export type RecipientValidationState =
  | "skipped"
  | "valid"
  | "warning"
  | "invalid"
  | "error"
  | "sandbox_limited";

type Props = {
  receiver: AddressDetails;
  /** Sign-in help text. Use `pickup` for ship-from (sender) on new shipment. */
  signInContext?: "recipient" | "pickup";
  onApplyReceiver: (next: AddressDetails) => void;
  onValidationStateChange: (state: RecipientValidationState) => void;
  /**
   * When validation finishes as green (`valid`) or sandbox (`sandbox_limited`), called with `true` (deferred, same
   * timing as the parent `onValidationStateChange` for those results). `false` when a new run starts or the outcome
   * does not allow continuing. Use on the new-shipment page so Continue stays enabled if `onValidationStateChange`
   * is overwritten by other effects in the same frame.
   */
  onRecipientCheckOkChange?: (ok: boolean) => void;
};

function toAddressInput(a: AddressDetails): AddressInput {
  const lines = [a.street1.trim(), (a.street2 ?? "").trim()].filter((s) => s.length > 0);
  return {
    streetLines: lines,
    city: a.city.trim() || undefined,
    stateOrProvinceCode: a.state.trim() || undefined,
    postalCode: a.postalCode.trim() || undefined,
    countryCode: (a.country.trim() || "US").toUpperCase(),
  };
}

function firstLaravelValidationMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const errors = (body as { errors?: unknown }).errors;
  if (!errors || typeof errors !== "object") return null;
  for (const val of Object.values(errors)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") return val[0];
    if (typeof val === "string") return val;
  }
  return null;
}

/**
 * Parent `recipientValidation` can be overwritten in the same frame; defer only that. `onRecipientCheckOkChange(true)` is
 * called synchronously in `runValidate` (not here) so Continue can enable in the same update as `setLastResult`.
 */
function scheduleRecipientValidationResult(
  state: RecipientValidationState,
  onValidationStateChange: (state: RecipientValidationState) => void,
) {
  setTimeout(() => {
    onValidationStateChange(state);
  }, 0);
}

function suggestedToAddressDetails(suggested: AddressInput, prev: AddressDetails): AddressDetails {
  const street1 = suggested.streetLines[0] ?? prev.street1;
  const street2 = suggested.streetLines[1] ?? "";
  return {
    ...prev,
    street1,
    street2,
    city: suggested.city ?? prev.city,
    state: suggested.stateOrProvinceCode ?? prev.state,
    postalCode: suggested.postalCode ?? prev.postalCode,
    country: suggested.countryCode ?? prev.country,
  };
}

export function AddressValidationWidget({
  receiver,
  signInContext = "recipient",
  onApplyReceiver,
  onValidationStateChange,
  onRecipientCheckOkChange,
}: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    kind: "valid" | "warning" | "invalid" | "error" | "sandbox_limited";
    message?: string;
    alerts?: string[];
    suggested?: AddressInput;
    /** When `kind === "error"`, overrides the default “Could not reach validation service” heading. */
    errorTitle?: string;
  } | null>(null);

  useEffect(() => {
    if (lastResult?.kind === "valid" || lastResult?.kind === "sandbox_limited") {
      onRecipientCheckOkChange?.(true);
    }
  }, [lastResult, onRecipientCheckOkChange]);

  const runValidate = useCallback(async () => {
    if (!token) {
      onRecipientCheckOkChange?.(false);
      onValidationStateChange("error");
      setLastResult({
        kind: "error",
        errorTitle: "Sign in required",
        message: "You must be signed in to validate addresses.",
      });
      return;
    }
    if (!receiver.street1.trim()) {
      onRecipientCheckOkChange?.(false);
      onValidationStateChange("error");
      setLastResult({
        kind: "error",
        errorTitle: "Address incomplete",
        message:
          "Enter street line 1 before validating. If you rely on your profile, ensure My profile includes a full street address.",
      });
      return;
    }
    setLoading(true);
    setLastResult(null);
    onRecipientCheckOkChange?.(false);
    onValidationStateChange("skipped");
    try {
      const res = await validateAddress(toAddressInput(receiver), token);
      if (res.isValid) {
        onRecipientCheckOkChange?.(true);
        setLastResult({ kind: "valid", alerts: res.alerts });
        scheduleRecipientValidationResult("valid", onValidationStateChange);
      } else if (res.resolvedAddress) {
        onRecipientCheckOkChange?.(false);
        onValidationStateChange("warning");
        setLastResult({
          kind: "warning",
          alerts: res.alerts,
          suggested: res.resolvedAddress,
        });
      } else {
        onRecipientCheckOkChange?.(false);
        onValidationStateChange("invalid");
        setLastResult({
          kind: "invalid",
          message: res.alerts?.[0],
          alerts: res.alerts,
        });
      }
    } catch (e) {
      onRecipientCheckOkChange?.(false);
      onValidationStateChange("error");
      let message =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Validation request failed.";
      let errorTitle: string | undefined;
      if (e instanceof ApiError && e.status === 422) {
        errorTitle = "Request not accepted";
        const v = firstLaravelValidationMessage(e.body);
        if (v) message = v;
      }
      setLastResult({ kind: "error", message, errorTitle });
    } finally {
      setLoading(false);
    }
  }, [token, receiver, onValidationStateChange, onRecipientCheckOkChange]);

  const applySuggested = useCallback(() => {
    if (!lastResult?.suggested) return;
    onApplyReceiver(suggestedToAddressDetails(lastResult.suggested, receiver));
    onRecipientCheckOkChange?.(false);
    onValidationStateChange("skipped");
    setLastResult(null);
  }, [lastResult, onApplyReceiver, onRecipientCheckOkChange, onValidationStateChange, receiver]);

  return (
    <div
      className="admin-dashboard-surface-bg w-full min-w-0 max-w-full overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle shadow-card ring-1 ring-slate-900/[0.04]"
      style={DASHBOARD_CARD_INSET}
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0 shrink pr-0 sm:max-w-[min(100%,36rem)] sm:pr-2">
          <span className="block text-base font-semibold text-text-primary">
            {signInContext === "pickup" ? "FedEx pickup (ship-from) check" : "FedEx address check"}
          </span>
          {signInContext === "pickup" ? (
            <p className="mt-1.5 min-w-0 text-sm leading-relaxed text-text-secondary">
              This validates <strong className="font-semibold text-text-primary">your sender (pickup) address</strong>{" "}
              only. The company delivery address shown above is fixed by your administrator; it is{" "}
              <strong className="font-semibold text-text-primary">not</strong> sent through this field-level check. The
              server still applies that fixed address when you validate or create the shipment.
            </p>
          ) : null}
        </div>
        <div className="flex w-full min-w-0 flex-shrink-0 items-center justify-stretch gap-3 sm:w-auto sm:justify-end sm:pt-0.5">
          <Button
            type="button"
            variant="secondary"
            disabled={loading || !token || !receiver.street1.trim()}
            className="h-auto min-h-12 w-full min-w-0 max-w-md border-2 border-accent-amber/60 !bg-white/90 !px-6 !py-3 text-base font-semibold !text-text-primary shadow-sm backdrop-blur-[1px] hover:!border-accent-amber hover:!bg-white disabled:opacity-50 sm:min-w-[11.5rem]"
            onClick={() => void runValidate()}
          >
            {loading ? "Validating…" : signInContext === "pickup" ? "Validate pickup address" : "Validate address"}
          </Button>
          {loading ? (
            <span
              className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-border-accent border-t-accent-amber"
              aria-hidden
            />
          ) : null}
        </div>
      </div>

      {!token ? (
        <p className="mt-4 min-w-0 break-words text-sm text-text-secondary sm:mt-5">
          {signInContext === "pickup"
            ? "Sign in to validate your ship-from (pickup) address with FedEx."
            : "Sign in to validate the recipient address with FedEx."}
        </p>
      ) : null}

      {lastResult?.kind === "valid" ? (
        <div className="mt-4 min-w-0 max-w-full rounded-lg border border-accent-green/40 bg-white/80 px-4 py-3 text-sm text-accent-green shadow-sm sm:mt-5">
          <p className="min-w-0 break-words font-semibold text-text-primary">Address confirmed</p>
          {lastResult.alerts?.length ? (
            <ul className="mt-2 min-w-0 list-inside list-disc space-y-1 break-words text-sm text-text-secondary">
              {lastResult.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lastResult?.kind === "warning" ? (
        <div className="mt-4 min-w-0 max-w-full rounded-lg border border-accent-amber/45 bg-white/80 px-4 py-3 text-sm shadow-sm sm:mt-5">
          <p className="min-w-0 break-words font-semibold text-text-primary">Suggestion from FedEx</p>
          {lastResult.alerts?.length ? (
            <ul className="mt-2 min-w-0 list-inside list-disc space-y-1 break-words text-sm text-text-secondary">
              {lastResult.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          {lastResult.suggested ? (
            <Button
              type="button"
              variant="primary"
              className="mt-4 h-auto min-h-12 w-full min-w-0 !px-6 !py-3 text-base font-bold sm:max-w-md"
              onClick={applySuggested}
            >
              Use suggested address
            </Button>
          ) : null}
        </div>
      ) : null}

      {lastResult?.kind === "sandbox_limited" ? (
        <div
          className="mt-4 min-w-0 max-w-full rounded-lg border px-4 py-3 text-sm sm:mt-5"
          style={{
            borderColor: "var(--amber)",
            background: "rgba(255,255,255,0.75)",
            color: "var(--text-secondary)",
          }}
        >
          <p className="min-w-0 break-words font-semibold" style={{ color: "var(--amber)" }}>
            Sandbox limitation
          </p>
          <p className="mt-1 min-w-0 break-words text-sm">
            {lastResult.message ?? FEDEX_SANDBOX_LIMITED_USER_MESSAGE}
          </p>
        </div>
      ) : null}

      {lastResult?.kind === "invalid" ? (
        <div className="mt-4 min-w-0 max-w-full rounded-lg border border-accent-red/40 bg-white/80 px-4 py-3 text-sm text-accent-red shadow-sm sm:mt-5">
          <p className="min-w-0 break-words font-semibold">Address not confirmed</p>
          {lastResult.message ? (
            <p className="mt-1 min-w-0 break-words text-sm text-text-secondary">{lastResult.message}</p>
          ) : null}
          {lastResult.alerts?.length ? (
            <ul className="mt-2 min-w-0 list-inside list-disc space-y-1 break-words text-sm">
              {lastResult.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lastResult?.kind === "error" ? (
        <div className="mt-4 min-w-0 max-w-full rounded-lg border border-border-accent bg-white/80 px-4 py-3 text-sm text-text-secondary shadow-sm sm:mt-5">
          <p className="min-w-0 break-words font-semibold text-text-primary">
            {lastResult.errorTitle ?? "Could not reach validation service"}
          </p>
          <p className="mt-1 min-w-0 break-words text-sm">{lastResult.message ?? "Try again later."}</p>
        </div>
      ) : null}
    </div>
  );
}

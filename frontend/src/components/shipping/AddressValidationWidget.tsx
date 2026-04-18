"use client";

import { useCallback, useState } from "react";
import { validateAddress, type AddressInput } from "@/lib/api/fedex";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import type { AddressDetails } from "@/lib/types";

export type RecipientValidationState = "skipped" | "valid" | "warning" | "invalid" | "error";

type Props = {
  receiver: AddressDetails;
  onApplyReceiver: (next: AddressDetails) => void;
  onValidationStateChange: (state: RecipientValidationState) => void;
};

function toAddressInput(a: AddressDetails): AddressInput {
  const lines = [a.street1.trim(), (a.street2 ?? "").trim()].filter((s) => s.length > 0);
  return {
    streetLines: lines.length > 0 ? lines : [""],
    city: a.city.trim() || undefined,
    stateOrProvinceCode: a.state.trim() || undefined,
    postalCode: a.postalCode.trim() || undefined,
    countryCode: (a.country.trim() || "US").toUpperCase(),
  };
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
  onApplyReceiver,
  onValidationStateChange,
}: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    kind: "valid" | "warning" | "invalid" | "error";
    message?: string;
    alerts?: string[];
    suggested?: AddressInput;
  } | null>(null);

  const runValidate = useCallback(async () => {
    if (!token) {
      onValidationStateChange("error");
      setLastResult({ kind: "error", message: "You must be signed in to validate addresses." });
      return;
    }
    setLoading(true);
    setLastResult(null);
    try {
      const res = await validateAddress(toAddressInput(receiver), token);
      if (res.isValid) {
        onValidationStateChange("valid");
        setLastResult({ kind: "valid", alerts: res.alerts });
      } else if (res.resolvedAddress) {
        onValidationStateChange("warning");
        setLastResult({
          kind: "warning",
          alerts: res.alerts,
          suggested: res.resolvedAddress,
        });
      } else {
        onValidationStateChange("invalid");
        setLastResult({
          kind: "invalid",
          message: res.alerts?.[0],
          alerts: res.alerts,
        });
      }
    } catch (e) {
      onValidationStateChange("error");
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Validation request failed.";
      setLastResult({ kind: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [token, receiver, onValidationStateChange]);

  const applySuggested = useCallback(() => {
    if (!lastResult?.suggested) return;
    onApplyReceiver(suggestedToAddressDetails(lastResult.suggested, receiver));
    onValidationStateChange("skipped");
    setLastResult(null);
  }, [lastResult, onApplyReceiver, onValidationStateChange, receiver]);

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-text-primary">FedEx address check</span>
        <Button type="button" variant="secondary" disabled={loading || !token} onClick={() => void runValidate()}>
          {loading ? "Validating…" : "Validate address"}
        </Button>
        {loading ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border-accent border-t-accent-amber"
            aria-hidden
          />
        ) : null}
      </div>

      {!token ? (
        <p className="mt-2 text-xs text-text-muted">Sign in to validate the recipient address with FedEx.</p>
      ) : null}

      {lastResult?.kind === "valid" ? (
        <div className="mt-3 rounded-lg border border-accent-green/40 bg-accent-green/10 px-3 py-2 text-sm text-accent-green">
          <p className="font-semibold text-text-primary">Address confirmed</p>
          {lastResult.alerts?.length ? (
            <ul className="mt-1 list-inside list-disc text-xs text-text-secondary">
              {lastResult.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lastResult?.kind === "warning" ? (
        <div className="mt-3 rounded-lg border border-accent-amber/50 bg-[var(--accent-amber-glow)] px-3 py-2 text-sm">
          <p className="font-semibold text-text-primary">Suggestion from FedEx</p>
          {lastResult.alerts?.length ? (
            <ul className="mt-1 list-inside list-disc text-xs text-text-secondary">
              {lastResult.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          {lastResult.suggested ? (
            <Button type="button" variant="primary" className="mt-2" onClick={applySuggested}>
              Use suggested address
            </Button>
          ) : null}
        </div>
      ) : null}

      {lastResult?.kind === "invalid" ? (
        <div className="mt-3 rounded-lg border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          <p className="font-semibold">Address not confirmed</p>
          {lastResult.message ? <p className="mt-1 text-xs text-text-secondary">{lastResult.message}</p> : null}
          {lastResult.alerts?.length ? (
            <ul className="mt-1 list-inside list-disc text-xs">
              {lastResult.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {lastResult?.kind === "error" ? (
        <div className="mt-3 rounded-lg border border-border-accent bg-surface-card px-3 py-2 text-sm text-text-secondary">
          <p className="font-semibold text-text-primary">Could not reach validation service</p>
          <p className="mt-1 text-xs">{lastResult.message ?? "Try again later."}</p>
        </div>
      ) : null}
    </div>
  );
}

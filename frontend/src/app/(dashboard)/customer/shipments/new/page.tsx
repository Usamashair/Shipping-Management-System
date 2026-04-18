"use client";

import { Box, Check, ChevronLeft, ChevronRight, Lock, Mail, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AddressValidationWidget,
  type RecipientValidationState,
} from "@/components/shipping/AddressValidationWidget";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  buildFedExShipPayload,
  createFedExShipment,
  FEDEX_SERVICE_TYPES,
  validateFedExShipment,
  type FedExServiceTypeValue,
} from "@/lib/api/shipments";
import { useAuth } from "@/lib/auth/context";
import { HeroRouteArt } from "@/components/marketing/hero-route-art";
import type { AddressDetails, PackageDetails } from "@/lib/types";

const SELECT =
  "mt-1 w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-sm text-text-primary transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)]";

function emptyAddress(placeholderName: string): AddressDetails {
  return {
    name: placeholderName,
    company: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
  };
}

function serviceOptionsForResidential(isResidential: boolean) {
  return FEDEX_SERVICE_TYPES.filter((row) =>
    isResidential ? true : row.value !== "GROUND_HOME_DELIVERY",
  );
}

const PACKAGING_CARDS = [
  {
    id: "your" as const,
    title: "Your packaging",
    description: "Your box or poly mailer — matches FedEx YOUR_PACKAGING.",
    Icon: Package,
    selectable: true,
  },
  {
    id: "fedex_box" as const,
    title: "FedEx box",
    description: "Server currently sends YOUR_PACKAGING only.",
    Icon: Box,
    selectable: false,
  },
  {
    id: "envelope" as const,
    title: "Envelope",
    description: "Same payload mapping until backend adds packaging types.",
    Icon: Mail,
    selectable: false,
  },
];

type Step = 1 | 2 | 3;

export default function CustomerNewShipmentPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [sender, setSender] = useState<AddressDetails>(() => emptyAddress(""));
  const [receiver, setReceiver] = useState<AddressDetails>(() => emptyAddress(""));
  const [pkg, setPkg] = useState<PackageDetails>({
    weightLb: 2,
    lengthIn: 12,
    widthIn: 9,
    heightIn: 6,
    description: "",
  });
  const [serviceType, setServiceType] = useState<FedExServiceTypeValue>("FEDEX_GROUND");
  const [pickupType, setPickupType] = useState<"USE_SCHEDULED_PICKUP" | "DROP_BOX">(
    "USE_SCHEDULED_PICKUP",
  );
  const [isResidential, setIsResidential] = useState(false);
  const [packagingVisual, setPackagingVisual] = useState<"your" | "fedex_box" | "envelope">("your");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fedexAlerts, setFedexAlerts] = useState<string[]>([]);
  const [recipientValidation, setRecipientValidation] =
    useState<RecipientValidationState>("skipped");

  useEffect(() => {
    if (isResidential) {
      setServiceType((prev) => (prev === "GROUND_HOME_DELIVERY" ? prev : "GROUND_HOME_DELIVERY"));
    } else {
      setServiceType((prev) => (prev === "GROUND_HOME_DELIVERY" ? "FEDEX_GROUND" : prev));
    }
  }, [isResidential]);

  const setAddr =
    (which: "sender" | "receiver") =>
    (field: keyof AddressDetails, value: string) => {
      if (which === "sender") setSender((a) => ({ ...a, [field]: value }));
      else setReceiver((a) => ({ ...a, [field]: value }));
    };

  const setReceiverField = useCallback((field: keyof AddressDetails, value: string) => {
    setRecipientValidation("skipped");
    setReceiver((a) => ({ ...a, [field]: value }));
  }, []);

  const serviceOptions = serviceOptionsForResidential(isResidential);

  const buildPayload = useCallback(() => {
    return buildFedExShipPayload(
      { ...sender, name: sender.name.trim() || "Sender" },
      receiver,
      {
        ...pkg,
        description: pkg.description.trim() || "General merchandise",
        lengthIn: Math.max(1, Math.floor(pkg.lengthIn)),
        widthIn: Math.max(1, Math.floor(pkg.widthIn)),
        heightIn: Math.max(1, Math.floor(pkg.heightIn)),
        weightLb: Math.max(0.01, pkg.weightLb),
      },
      serviceType,
      pickupType,
      isResidential,
    );
  }, [sender, receiver, pkg, serviceType, pickupType, isResidential]);

  const runValidateFedEx = useCallback(async () => {
    if (!token) {
      setError("You must be signed in.");
      return;
    }
    setError(null);
    setFedexAlerts([]);
    if (recipientValidation !== "valid") {
      setError("Validate the recipient address with FedEx until it shows as confirmed (green).");
      return;
    }
    const payload = buildPayload();
    setBusy(true);
    try {
      const { alerts } = await validateFedExShipment(token, payload);
      setFedexAlerts(alerts);
      showToast("FedEx validation finished.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "FedEx validation failed.");
    } finally {
      setBusy(false);
    }
  }, [token, recipientValidation, buildPayload, showToast]);

  const submitCreate = useCallback(
    async (confirmWarnings: boolean) => {
      if (!token) {
        setError("You must be signed in.");
        return;
      }
      setError(null);
      if (!receiver.name.trim() || !receiver.street1.trim() || !receiver.city.trim()) {
        setError("Please fill receiver name, street, and city.");
        return;
      }
      if (recipientValidation !== "valid") {
        setError(
          "FedEx must confirm the recipient address (validated green). Use Validate address until it succeeds.",
        );
        return;
      }
      const payload = buildPayload();
      setBusy(true);
      try {
        const created = await createFedExShipment(token, payload, {
          confirm_warnings: confirmWarnings,
        });
        showToast("Shipment created.");
        router.push(`/customer/shipments/${created.id}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 422) {
          const body = e.body as { alerts?: string[]; message?: string } | null;
          const alerts = Array.isArray(body?.alerts) ? body.alerts : [];
          if (alerts.length > 0) {
            setFedexAlerts(alerts);
            setError(
              body?.message ??
                "FedEx reported validation warnings. Review the alerts, then create again with confirmation.",
            );
            return;
          }
        }
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [token, receiver, recipientValidation, buildPayload, router, showToast],
  );

  const canAdvanceFromStep1 =
    Boolean(receiver.name.trim() && receiver.street1.trim() && receiver.city.trim()) &&
    recipientValidation === "valid";

  const stepTitle = step === 1 ? "Addresses" : step === 2 ? "Package" : "Service & pickup";

  return (
    <div className="mx-auto grid max-w-3xl gap-8 xl:max-w-5xl xl:grid-cols-[minmax(0,1fr)_minmax(0,120px)] xl:gap-10">
      <div className="space-y-8">
      <div>
        <Link href="/customer/shipments" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
          My shipments
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-text-primary">New shipment</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Creates a live label via{" "}
          <code className="mono rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
            POST /api/fedex/shipments
          </code>{" "}
          (FedEx Ship API on the server). Three quick steps.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold tabular-nums transition-colors ${
                step === n
                  ? "border-accent-amber bg-[var(--accent-amber-glow)] text-accent-amber"
                  : step > n
                    ? "border-accent-green/50 bg-accent-green/10 text-accent-green"
                    : "border-border-default bg-surface-raised text-text-muted"
              }`}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
            {n < 3 ? (
              <div
                className={`h-0.5 flex-1 rounded ${step > n ? "bg-accent-green/40" : "bg-border-default"}`}
                aria-hidden
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {(["Addresses", "Package", "Service"] as const).map((label, i) => (
          <p
            key={label}
            className={`text-[10px] font-semibold uppercase tracking-wider ${
              step === i + 1 ? "text-accent-amber" : "text-text-muted"
            }`}
          >
            {label}
          </p>
        ))}
      </div>
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-text-muted">
        Step {step} — {stepTitle}
      </p>

      {error ? (
        <p className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {error}
        </p>
      ) : null}

      {fedexAlerts.length > 0 ? (
        <div className="rounded-lg border border-accent-amber/40 bg-[var(--accent-amber-glow)] px-3 py-2 text-sm text-accent-amber-bright">
          <p className="font-semibold text-text-primary">FedEx alerts</p>
          <ul className="mt-1 list-inside list-disc text-text-secondary">
            {fedexAlerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (step !== 3) return;
          void submitCreate(fedexAlerts.length > 0);
        }}
      >
        {step === 1 ? (
          <>
            <Card className="!p-5">
              <h3 className="text-sm font-bold text-text-primary">Sender</h3>
              <div className="mt-4 space-y-3">
                <Field label="Name" value={sender.name} onChange={(v) => setAddr("sender")("name", v)} />
                <Field
                  label="Street"
                  value={sender.street1}
                  onChange={(v) => setAddr("sender")("street1", v)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="City" value={sender.city} onChange={(v) => setAddr("sender")("city", v)} />
                  <Field label="State" value={sender.state} onChange={(v) => setAddr("sender")("state", v)} />
                  <Field
                    label="Postal code"
                    value={sender.postalCode}
                    onChange={(v) => setAddr("sender")("postalCode", v)}
                  />
                  <Field label="Phone" value={sender.phone} onChange={(v) => setAddr("sender")("phone", v)} />
                </div>
              </div>
            </Card>

            <Card className="!p-5">
              <h3 className="text-sm font-bold text-text-primary">Receiver</h3>
              <div className="mt-4 space-y-3">
                <Field
                  label="Name"
                  value={receiver.name}
                  onChange={(v) => setReceiverField("name", v)}
                  required
                />
                <Field
                  label="Street line 1"
                  value={receiver.street1}
                  onChange={(v) => setReceiverField("street1", v)}
                  required
                />
                <Field
                  label="Street line 2 (optional)"
                  value={receiver.street2 ?? ""}
                  onChange={(v) => setReceiverField("street2", v)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="City"
                    value={receiver.city}
                    onChange={(v) => setReceiverField("city", v)}
                    required
                  />
                  <Field label="State" value={receiver.state} onChange={(v) => setReceiverField("state", v)} />
                  <Field
                    label="Postal code"
                    value={receiver.postalCode}
                    onChange={(v) => setReceiverField("postalCode", v)}
                  />
                  <Field
                    label="Country"
                    value={receiver.country}
                    onChange={(v) => setReceiverField("country", v)}
                  />
                  <Field label="Phone" value={receiver.phone} onChange={(v) => setReceiverField("phone", v)} />
                </div>
              </div>
            </Card>

            <AddressValidationWidget
              receiver={receiver}
              onApplyReceiver={(next) => {
                setRecipientValidation("skipped");
                setReceiver(next);
              }}
              onValidationStateChange={setRecipientValidation}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Card className="!p-5">
              <h3 className="text-sm font-bold text-text-primary">Residential delivery</h3>
              <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={isResidential}
                  onChange={(e) => setIsResidential(e.target.checked)}
                  className="size-4 rounded border-border-default bg-surface-raised text-accent-amber focus:ring-accent-amber"
                />
                Ship to a residential address
              </label>
            </Card>

            <div>
              <h3 className="text-sm font-bold text-text-primary">Packaging</h3>
              <p className="mt-1 text-xs text-text-muted">
                Shipment requests use <span className="mono text-accent-amber">YOUR_PACKAGING</span> until the
                backend exposes more FedEx packaging codes.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {PACKAGING_CARDS.map((opt) => {
                  const active = packagingVisual === opt.id;
                  const Icon = opt.Icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!opt.selectable}
                      onClick={() => {
                        if (opt.selectable) setPackagingVisual(opt.id);
                      }}
                      className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                        active
                          ? "border-accent-amber bg-[var(--accent-amber-glow)] shadow-glow"
                          : "border-border-default bg-surface-card hover:border-border-accent"
                      } ${!opt.selectable ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Icon className="h-5 w-5 shrink-0 text-accent-amber" aria-hidden />
                        {!opt.selectable ? <Lock className="h-4 w-4 text-text-muted" aria-hidden /> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-text-primary">{opt.title}</p>
                      <p className="mt-1 text-xs text-text-muted">{opt.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <Card className="!p-5">
              <h3 className="text-sm font-bold text-text-primary">Package details</h3>
              <div className="mt-4 space-y-3">
                <Field
                  label="Description"
                  value={pkg.description}
                  onChange={(v) => setPkg((p) => ({ ...p, description: v }))}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Weight (lb)"
                    value={String(pkg.weightLb)}
                    onChange={(v) => setPkg((p) => ({ ...p, weightLb: Number(v) || 0 }))}
                  />
                  <Field
                    label="Length (in, integer)"
                    value={String(Math.floor(pkg.lengthIn))}
                    onChange={(v) =>
                      setPkg((p) => ({ ...p, lengthIn: Math.max(1, Math.floor(Number(v) || 1)) }))
                    }
                  />
                  <Field
                    label="Width (in, integer)"
                    value={String(Math.floor(pkg.widthIn))}
                    onChange={(v) =>
                      setPkg((p) => ({ ...p, widthIn: Math.max(1, Math.floor(Number(v) || 1)) }))
                    }
                  />
                  <Field
                    label="Height (in, integer)"
                    value={String(Math.floor(pkg.heightIn))}
                    onChange={(v) =>
                      setPkg((p) => ({ ...p, heightIn: Math.max(1, Math.floor(Number(v) || 1)) }))
                    }
                  />
                </div>
              </div>
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <Card className="!p-5">
            <h3 className="text-sm font-bold text-text-primary">Service & pickup</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Service type
                </label>
                <select
                  className={SELECT}
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as FedExServiceTypeValue)}
                >
                  {serviceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Pickup</p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-text-secondary">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="pickup"
                      checked={pickupType === "USE_SCHEDULED_PICKUP"}
                      onChange={() => setPickupType("USE_SCHEDULED_PICKUP")}
                      className="size-4 border-border-default text-accent-amber focus:ring-accent-amber"
                    />
                    Scheduled pickup
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="pickup"
                      checked={pickupType === "DROP_BOX"}
                      onChange={() => setPickupType("DROP_BOX")}
                      className="size-4 border-border-default text-accent-amber focus:ring-accent-amber"
                    />
                    Drop box
                  </label>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {step > 1 ? (
              <Button type="button" variant="ghost" className="border-border-accent" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}>
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <Link
                href="/customer/shipments"
                className="inline-flex items-center justify-center rounded-lg border border-border-accent px-4 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
              >
                Cancel
              </Link>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {step < 3 ? (
              <Button
                type="button"
                variant="primary"
                disabled={step === 1 && !canAdvanceFromStep1}
                onClick={() => {
                  setError(null);
                  if (step === 1 && !canAdvanceFromStep1) {
                    setError(
                      "Fill receiver name, street, and city, then run FedEx address check until the address is confirmed.",
                    );
                    return;
                  }
                  setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
                }}
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  className="border-border-accent"
                  onClick={() => void runValidateFedEx()}
                >
                  Validate with FedEx
                </Button>
                <Button type="submit" variant="primary" disabled={busy}>
                  {fedexAlerts.length > 0 ? "Create shipment (confirm warnings)" : "Create shipment"}
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
      </div>
      <div className="hidden justify-center pt-4 xl:flex xl:pt-24" aria-hidden>
        <HeroRouteArt className="h-48 w-28 shrink-0 text-accent-amber/25" />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

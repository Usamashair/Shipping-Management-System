"use client";

import {
  AlertTriangle,
  Box,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Lock,
  Mail,
  MapPin,
  Package,
  Ruler,
  Truck,
  Weight,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AddressValidationWidget,
  type RecipientValidationState,
} from "@/components/shipping/AddressValidationWidget";
import { UsAddressFields, US_ADDRESS_FORM_GRID } from "@/components/shipping/UsAddressFields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, InputWithLeadingIcon, SelectWithLeadingIcon } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  buildCustomerFedExShipPayload,
  createFedExShipment,
  FEDEX_SERVICE_TYPES,
  fetchFixedRecipient,
  parseFedExErrorsFromBody,
  pickupOptionsForServiceType,
  validateFedExShipment,
  type FedExApiErrorItem,
  type FedExPickupTypeValue,
  type FedExServiceTypeValue,
} from "@/lib/api/shipments";
import { getUserProfile, saveUserAddress, userProfileToSessionUser } from "@/lib/api/profile";
import { useProfile } from "@/lib/context/ProfileContext";
import { useAuth } from "@/lib/auth/context";
import {
  digitsOnlyPhone,
  FEDEX_ADDRESS_COMPLIANCE_MESSAGE,
  isUsZipFormatLoose,
  nationalUs10DigitPhone,
  validateUsAddressForFedExSubmission,
} from "@/lib/fedexAddressValidation";
import type { AddressDetails, FixedRecipient, PackageDetails, ProfileFormData } from "@/lib/types";
import {
  DASHBOARD_CARD_INSET,
  DASHBOARD_GRADIENT_CARD_CLASS,
  DASHBOARD_SECTION_HEADER_CLASS,
} from "@/lib/dashboardCardStyles";

const FORM_STACK = "flex w-full min-w-0 max-w-full flex-col gap-6 sm:gap-8";
/** Same grid as `UsAddressFields` so street rows align with city / country / phone. */
const RECEIVER_TWO_COL = US_ADDRESS_FORM_GRID;
const FIELD = "flex min-w-0 flex-col gap-2";
const L = "block text-[13px] font-semibold uppercase tracking-[0.06em] text-text-secondary";
const INPUT_BASE =
  "h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-border-default !bg-white text-[15px] leading-normal text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--amber-glow)]";
const INPUT_CLASS = `${INPUT_BASE} px-4`;
const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`;
const DISABLED_INPUT = `${INPUT_BASE} !cursor-not-allowed !bg-slate-50 !text-text-primary !opacity-100`;
const STEP_LABEL_CLASS =
  "w-full min-w-0 break-words px-0.5 text-center text-sm font-semibold sm:text-base";
const STEP_CIRCLE = "relative z-[2] flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold tabular-nums transition-colors sm:h-14 sm:w-14 sm:text-xl";
/** Horizontal flex segment between step circles; sits on the row’s cross-axis center. */
const STEP_LINE_CONNECTOR =
  "h-[3px] min-h-[3px] min-w-2 flex-1 rounded-full self-center sm:min-w-4";
const STEP_LINE_SPACER = "h-[3px] min-h-[3px] min-w-0 flex-1 shrink self-center";

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

function addressValidationAllowsProceed(state: RecipientValidationState): boolean {
  return state === "valid" || state === "sandbox_limited";
}

/** FedEx widget may set `fedExSenderCheckOk` when validation was reset to `skipped` by another effect. */
function senderAddressCheckAllowsStep1(
  senderValidation: RecipientValidationState,
  fedExSenderCheckOk: boolean,
): boolean {
  return addressValidationAllowsProceed(senderValidation) || fedExSenderCheckOk;
}

const norm = (s: string | null | undefined) => (s ?? "").trim();
const samePhone = (a: string | undefined, b: string | undefined) =>
  digitsOnlyPhone(a ?? "") === digitsOnlyPhone(b ?? "");

/** Only clear FedEx sender check when material address fields change. */
function senderAddressAffectsFedExCheck(prev: AddressDetails, next: AddressDetails): boolean {
  if (norm(prev.name) !== norm(next.name)) return true;
  if (norm(prev.company) !== norm(next.company)) return true;
  if (norm(prev.street1) !== norm(next.street1)) return true;
  if (norm(prev.street2) !== norm(next.street2)) return true;
  if (norm(prev.city) !== norm(next.city)) return true;
  if (norm(prev.state).toUpperCase() !== norm(next.state).toUpperCase()) return true;
  if (norm(prev.postalCode) !== norm(next.postalCode)) return true;
  if ((prev.country || "US").toUpperCase() !== (next.country || "US").toUpperCase()) return true;
  if (!samePhone(prev.phone, next.phone)) return true;
  return false;
}

/** Minimum sender (pickup) fields; fixed recipient is loaded from the server. */
function addressLooseAfterFedExWidgetOk(a: AddressDetails): boolean {
  if (!a.street1.trim()) return false;
  if ((a.country || "US").toUpperCase() !== "US") return false;
  if (nationalUs10DigitPhone(a.phone).length !== 10) return false;
  if (!/^[A-Za-z]{2}$/.test(a.state.trim())) return false;
  if (!isUsZipFormatLoose(a.postalCode)) return false;
  if (!a.city.trim()) return false;
  return true;
}

function step1ContinueDisabledReason(
  sender: AddressDetails,
  fixedRecipientLoaded: boolean,
  senderFedExValidation: RecipientValidationState,
  fedExSenderCheckOk: boolean,
): string | undefined {
  if (!fixedRecipientLoaded) {
    return "Loading fixed delivery address…";
  }
  if (!addressLooseAfterFedExWidgetOk(sender)) {
    return "Complete sender: US city, 2-letter state, ZIP, 10-digit phone, and street line 1.";
  }
  if (!senderAddressCheckAllowsStep1(senderFedExValidation, fedExSenderCheckOk)) {
    return 'Use "Validate address" on your ship-from address until it shows as confirmed (green), or continue in sandbox if you see the sandbox limitation notice.';
  }
  return undefined;
}

export default function CustomerNewShipmentPage() {
  const router = useRouter();
  const { token, user, setUser } = useAuth();
  const { profile, setProfile } = useProfile();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [sender, setSender] = useState<AddressDetails>(() => emptyAddress(""));
  const [fixedRecipient, setFixedRecipient] = useState<FixedRecipient | null>(null);
  const [pkg, setPkg] = useState<PackageDetails>({
    weightLb: 2,
    lengthIn: 12,
    widthIn: 9,
    heightIn: 6,
    description: "",
  });
  const [serviceType, setServiceType] = useState<FedExServiceTypeValue>("FEDEX_GROUND");
  const [pickupType, setPickupType] = useState<FedExPickupTypeValue>("USE_SCHEDULED_PICKUP");
  const [isResidential, setIsResidential] = useState(false);
  const [packagingVisual, setPackagingVisual] = useState<"your" | "fedex_box" | "envelope">("your");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fedexAlerts, setFedexAlerts] = useState<string[]>([]);
  const [fedexShipErrors, setFedexShipErrors] = useState<FedExApiErrorItem[]>([]);
  const senderPrefillDone = useRef(false);
  const [editingSender, setEditingSender] = useState(false);
  const [senderFedExValidation, setSenderFedExValidation] =
    useState<RecipientValidationState>("skipped");
  const [fedExSenderCheckOk, setFedExSenderCheckOk] = useState(false);
  const senderRef = useRef<AddressDetails | null>(null);

  const resetSenderFedExValidation = useCallback(() => {
    setSenderFedExValidation("skipped");
    setFedExSenderCheckOk(false);
  }, []);

  useLayoutEffect(() => {
    senderRef.current = sender;
  }, [sender]);

  useEffect(() => {
    if (profile?.has_address) {
      setEditingSender(false);
    } else {
      setEditingSender(true);
    }
  }, [profile?.has_address, profile?.id]);

  useEffect(() => {
    if (!token) return;
    if (senderPrefillDone.current) return;

    const applyFromProfile = (name: string, company: string | null | undefined, p: {
      address_street: string | null;
      address_street2: string | null;
      address_city: string | null;
      address_state: string | null;
      address_postal_code: string | null;
      address_country: string;
      phone: string | null;
    }) => {
      if (!p.address_street) return;
      const line1 = p.address_street;
      senderPrefillDone.current = true;
      setSender((prev) => ({
        ...prev,
        name,
        company: company ?? "",
        street1: line1,
        street2: p.address_street2 ?? "",
        city: p.address_city ?? "",
        state: p.address_state ?? "",
        postalCode: p.address_postal_code ?? "",
        country: p.address_country ?? "US",
        phone: p.phone ? digitsOnlyPhone(p.phone) : prev.phone,
      }));
      resetSenderFedExValidation();
    };

    if (user?.has_address && user.address_street) {
      applyFromProfile(user.name, user.address_company, {
        address_street: user.address_street,
        address_street2: user.address_street2 ?? null,
        address_city: user.address_city ?? null,
        address_state: user.address_state ?? null,
        address_postal_code: user.address_postal_code ?? null,
        address_country: user.address_country ?? "US",
        phone: user.phone ?? null,
      });
      return;
    }
    if (profile?.has_address && profile.address_street) {
      applyFromProfile(profile.name, profile.address_company, profile);
      return;
    }
    void getUserProfile(token)
      .then((p) => {
        if (!p.address_street) return;
        applyFromProfile(p.name, p.address_company, p);
      })
      .catch((err) => {
        console.error("getUserProfile (sender prefill)", err);
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Could not load profile.";
        showToast(`${msg} You can still enter your pickup address manually.`, "error");
      });
  }, [
    token,
    user?.id,
    user?.has_address,
    user?.address_street,
    user?.address_street2,
    user?.address_company,
    user?.address_state,
    user?.address_postal_code,
    user?.address_country,
    user?.phone,
    profile?.has_address,
    profile?.address_street,
    user?.name,
    user?.address_city,
    profile,
    resetSenderFedExValidation,
    showToast,
  ]);

  useEffect(() => {
    if (isResidential) {
      setServiceType((prev) => (prev === "GROUND_HOME_DELIVERY" ? prev : "GROUND_HOME_DELIVERY"));
    } else {
      setServiceType((prev) => (prev === "GROUND_HOME_DELIVERY" ? "FEDEX_GROUND" : prev));
    }
  }, [isResidential]);

  useEffect(() => {
    const opts = pickupOptionsForServiceType(serviceType);
    const allowed = new Set(opts.map((o) => o.value));
    setPickupType((prev) => (allowed.has(prev) ? prev : opts[0].value));
  }, [serviceType]);

  useEffect(() => {
    if (!token) return;
    void fetchFixedRecipient(token)
      .then((r) => setFixedRecipient(r))
      .catch((err) => {
        console.error(err);
        setError("Could not load fixed delivery address. Contact support or try again.");
      });
  }, [token]);

  const setAddr = useCallback((field: keyof AddressDetails, value: string) => {
    setSenderFedExValidation("skipped");
    setFedExSenderCheckOk(false);
    setSender((a) => ({ ...a, [field]: value }));
  }, []);

  const onSenderUsAddressChange = useCallback(
    (next: AddressDetails) => {
      const prev = senderRef.current;
      if (prev !== null && senderAddressAffectsFedExCheck(prev, next)) {
        resetSenderFedExValidation();
      }
      setSender(next);
    },
    [resetSenderFedExValidation],
  );

  const addressDetailsToProfilePayload = useCallback(
    (a: AddressDetails): ProfileFormData => ({
      name: a.name.trim(),
      phone: digitsOnlyPhone(a.phone),
      company: (a.company ?? "").trim(),
      street: a.street1,
      street2: (a.street2 ?? "").trim(),
      city: a.city,
      state: a.state,
      postal_code: a.postalCode,
      country: a.country || "US",
    }),
    [],
  );

  const handleSaveSenderToProfile = useCallback(async () => {
    if (!token) {
      setError("You must be signed in.");
      return;
    }
    if (!(await validateUsAddressForFedExSubmission({ ...sender, name: sender.name.trim() || "Sender" }))) {
      setError(FEDEX_ADDRESS_COMPLIANCE_MESSAGE);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await saveUserAddress(token, addressDetailsToProfilePayload(sender));
      setProfile(res.profile);
      if (user) setUser(userProfileToSessionUser(user, res.profile));
      const p = res.profile;
      if (p.address_street) {
        setSender((prev) => ({
          ...prev,
          name: p.name,
          company: p.address_company ?? "",
          street1: p.address_street ?? "",
          street2: p.address_street2 ?? "",
          city: p.address_city ?? "",
          state: p.address_state ?? "",
          postalCode: p.address_postal_code ?? "",
          country: p.address_country ?? "US",
          phone: p.phone ? digitsOnlyPhone(p.phone) : prev.phone,
        }));
      }
      showToast(res.message || "Address saved to your profile.");
      setEditingSender(false);
      resetSenderFedExValidation();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save address to profile.");
    } finally {
      setBusy(false);
    }
  }, [token, sender, setProfile, user, setUser, showToast, addressDetailsToProfilePayload, resetSenderFedExValidation]);

  const serviceOptions = serviceOptionsForResidential(isResidential);
  const pickupOptions = pickupOptionsForServiceType(serviceType);

  const buildPayload = useCallback(() => {
    const s = { ...sender, name: sender.name.trim() || "Sender", phone: nationalUs10DigitPhone(sender.phone) };
    return buildCustomerFedExShipPayload(
      s,
      {
        ...pkg,
        description: pkg.description.trim() || "General merchandise",
        lengthIn: Math.max(1, Math.floor(pkg.lengthIn)),
        widthIn: Math.max(1, Math.floor(pkg.widthIn)),
        heightIn: Math.max(1, Math.floor(pkg.heightIn)),
        weightLb: Math.max(0.1, pkg.weightLb),
      },
      serviceType,
      pickupType,
      isResidential,
    );
  }, [sender, pkg, serviceType, pickupType, isResidential]);

  const runValidateFedEx = useCallback(async () => {
    if (!token) {
      setError("You must be signed in.");
      return;
    }
    setError(null);
    setFedexAlerts([]);
    setFedexShipErrors([]);
    const s = { ...sender, name: sender.name.trim() || "Sender", phone: nationalUs10DigitPhone(sender.phone) };
    if (!(await validateUsAddressForFedExSubmission(s))) {
      setError(FEDEX_ADDRESS_COMPLIANCE_MESSAGE);
      return;
    }
    const payload = buildPayload();
    setBusy(true);
    try {
      const { alerts } = await validateFedExShipment(token, payload);
      setFedexAlerts(alerts);
      setFedexShipErrors([]);
      showToast("FedEx validation finished.");
    } catch (e) {
      if (e instanceof ApiError) {
        const fedexErrors = parseFedExErrorsFromBody(e.body);
        if (fedexErrors.length > 0) {
          setFedexShipErrors(fedexErrors);
          const body = e.body as { message?: string } | null;
          setError(
            typeof body?.message === "string" && body.message.length > 0 ? body.message : e.message,
          );
        } else {
          setFedexShipErrors([]);
          setError(e instanceof Error ? e.message : "FedEx validation failed.");
        }
      } else {
        setFedexShipErrors([]);
        setError(e instanceof Error ? e.message : "FedEx validation failed.");
      }
    } finally {
      setBusy(false);
    }
  }, [token, buildPayload, showToast, sender]);

  const submitCreate = useCallback(
    async (confirmWarnings: boolean) => {
      if (!token) {
        setError("You must be signed in.");
        return;
      }
      setError(null);
      setFedexShipErrors([]);
      const s = { ...sender, name: sender.name.trim() || "Sender", phone: nationalUs10DigitPhone(sender.phone) };
      if (!(await validateUsAddressForFedExSubmission(s))) {
        setError(FEDEX_ADDRESS_COMPLIANCE_MESSAGE);
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
            setFedexShipErrors([]);
            setFedexAlerts(alerts);
            setError(
              body?.message ??
                "FedEx reported validation warnings. Review the alerts, then create again with confirmation.",
            );
            return;
          }
        }
        if (e instanceof ApiError) {
          const fedexErrors = parseFedExErrorsFromBody(e.body);
          if (fedexErrors.length > 0) {
            setFedexShipErrors(fedexErrors);
            const body = e.body as { message?: string } | null;
            setError(
              typeof body?.message === "string" && body.message.length > 0
                ? body.message
                : e.message || "FedEx could not create this shipment.",
            );
            return;
          }
        }
        setFedexShipErrors([]);
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [token, sender, buildPayload, router, showToast],
  );

  const canAdvanceFromStep1 =
    Boolean(fixedRecipient) &&
    addressLooseAfterFedExWidgetOk(sender) &&
    senderAddressCheckAllowsStep1(senderFedExValidation, fedExSenderCheckOk);

  const step1ShowPickupAddressHint =
    step === 1 &&
    Boolean(fixedRecipient) &&
    senderAddressCheckAllowsStep1(senderFedExValidation, fedExSenderCheckOk) &&
    !addressLooseAfterFedExWidgetOk(sender);

  const stepTitle = step === 1 ? "Addresses" : step === 2 ? "Package" : "Service & pickup";

  const hasSavedAddress = Boolean(profile?.has_address ?? user?.has_address);
  /** Saved street on session/profile; `has_address` alone can be true with a missing street (bad data). */
  const streetOnFile = norm(profile?.address_street ?? user?.address_street);
  const senderFedexVerified = Boolean(
    profile?.address_fedex_verified ?? user?.address_fedex_verified,
  );
  const showSenderProfileCard = Boolean(streetOnFile) && !editingSender;

  return (
    <div className="flex min-h-0 flex-col gap-[var(--space-8)] pb-[var(--space-8)]">
      <div
        className="admin-dashboard-surface-bg overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle shadow-card ring-1 ring-slate-900/[0.04]"
        style={{
          padding: "var(--ds-card-padding) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div className="min-w-0 flex-1 text-left">
          <h1
            className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            New shipment
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            Create a label via{" "}
            <code className="mono rounded-md border border-border-subtle bg-white px-1.5 py-0.5 text-sm text-text-muted">
              POST /api/fedex/shipments
            </code>{" "}
            — three steps: addresses, package, service.
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Link
            href="/customer/shipments"
            className="admin-dashboard-cta inline-flex max-w-full items-center gap-2 rounded-[var(--radius-md)] border-2 border-accent-amber bg-transparent px-5 py-2.5 text-base font-semibold text-accent-amber transition-[filter,transform,background] duration-200 motion-safe:hover:bg-[var(--selection-tint)] motion-safe:active:scale-[0.98]"
          >
            <Package className="h-5 w-5 shrink-0" aria-hidden />
            My shipments
          </Link>
        </div>
      </div>

      <div
        className="flex flex-col gap-[var(--space-4)] overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised/30 shadow-sm ring-1 ring-slate-900/[0.04] sm:gap-[var(--space-6)]"
        style={DASHBOARD_CARD_INSET}
      >
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-text-secondary">
          Progress
        </p>
        {/*
          One row: [spacer?] [circle] [line] — lines share the circle’s vertical center (items-center).
          Segments: 1→2 uses step>1; 2→3 uses step>2 for “done” coloring.
        */}
        <ol
          className="m-0 flex w-full min-w-0 list-none items-stretch p-0"
          aria-label="Shipment steps"
        >
          {(
            [
              { n: 1, label: "Addresses" as const },
              { n: 2, label: "Package" as const },
              { n: 3, label: "Service" as const },
            ] as const
          ).map((s, i) => {
            const active = step === s.n;
            const done = step > s.n;
            const rightSegmentDone = i === 0 ? step > 1 : i === 1 ? step > 2 : false;
            const leftSegmentDone = i === 1 ? step > 1 : i === 2 ? step > 2 : false;
            return (
              <li
                key={s.n}
                className="flex min-w-0 flex-1 flex-col items-center justify-start px-0.5 text-center sm:px-1"
                aria-current={active ? "step" : undefined}
              >
                <div className="flex w-full min-w-0 max-w-full items-center gap-0">
                  {i > 0 ? (
                    <div
                      className={`${STEP_LINE_CONNECTOR} ${
                        leftSegmentDone ? "bg-emerald-500/80" : "bg-border-default"
                      }`}
                      aria-hidden
                    />
                  ) : (
                    <div className={STEP_LINE_SPACER} aria-hidden />
                  )}
                  <div
                    className={`${STEP_CIRCLE} ${
                      active
                        ? "border-accent-amber bg-[var(--accent-amber-glow)] text-accent-amber"
                        : done
                          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                          : "border-border-default bg-white text-text-muted"
                    }`}
                  >
                    {done ? <Check className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} /> : s.n}
                  </div>
                  {i < 2 ? (
                    <div
                      className={`${STEP_LINE_CONNECTOR} ${
                        rightSegmentDone ? "bg-emerald-500/80" : "bg-border-default"
                      }`}
                      aria-hidden
                    />
                  ) : (
                    <div className={STEP_LINE_SPACER} aria-hidden />
                  )}
                </div>
                <p
                  className={`${STEP_LABEL_CLASS} mt-[var(--space-3)] ${
                    active ? "text-accent-amber" : done ? "text-text-secondary" : "text-text-muted"
                  }`}
                >
                  {s.label}
                </p>
              </li>
            );
          })}
        </ol>
        <p className="text-center text-sm font-medium text-text-secondary sm:text-base">
          Step {step} — {stepTitle}
        </p>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-accent-red/30 bg-accent-red/10 text-sm text-accent-red"
          style={DASHBOARD_CARD_INSET}
        >
          {error}
        </p>
      ) : null}

      {fedexShipErrors.length > 0 ? (
        <div className="rounded-lg border border-accent-red/25 bg-accent-red/5 px-3 py-2 text-sm">
          <p className="font-semibold text-text-primary">FedEx error details</p>
          <ul className="mt-1 list-inside list-disc space-y-1.5 text-text-secondary">
            {fedexShipErrors.map((err, i) => (
              <li key={`${err.code}-${i}`} className="text-sm">
                {err.code ? (
                  <code className="mono rounded bg-surface-raised px-1 py-0.5 text-xs text-text-muted">
                    {err.code}
                  </code>
                ) : null}
                {err.code && err.message ? <span className="text-text-muted"> — </span> : null}
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
        </div>
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
        className="flex w-full min-w-0 flex-col gap-[var(--space-8)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (step !== 3) return;
          void submitCreate(fedexAlerts.length > 0);
        }}
      >
        {step === 1 ? (
          <div className="flex w-full min-w-0 flex-col gap-[var(--space-8)]">
            <div className="flex w-full min-w-0 flex-col gap-[var(--space-8)]">
              <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
                <div className={`${DASHBOARD_SECTION_HEADER_CLASS} border-l-[3px] border-l-accent-blue`} style={DASHBOARD_CARD_INSET}>
                  <h2 className="text-lg font-bold text-text-primary">Sender</h2>
                  <p className="mt-1.5 text-sm text-text-muted">Ship-from address. Prefilled from your profile when available.</p>
                </div>
                <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
                  <div className={FORM_STACK}>
                    {hasSavedAddress && !streetOnFile ? (
                      <div className="flex gap-2 rounded-lg border border-accent-amber/35 bg-surface-raised/40 px-3 py-2 text-sm text-text-primary shadow-sm">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" aria-hidden />
                        <p>
                          Your profile says you have a saved address, but the street line is missing. Enter your full
                          pickup address below, or fix it on{" "}
                          <Link
                            href="/customer/profile"
                            className="font-semibold text-accent-blue underline-offset-2 hover:underline"
                          >
                            My profile
                          </Link>
                          .
                        </p>
                      </div>
                    ) : null}
                    {showSenderProfileCard ? (
                      <>
                        <div className="flex w-full min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-3">
                          <span className="inline-flex min-h-12 w-full min-w-0 max-w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200/80 bg-surface-raised/40 px-4 py-2.5 text-sm font-semibold text-text-secondary shadow-sm sm:min-w-0 sm:max-w-[min(100%,20rem)] sm:px-5 sm:py-3 sm:text-base">
                            From profile
                          </span>
                          {senderFedexVerified ? (
                            <span className="inline-flex min-h-12 w-full min-w-0 max-w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-500/45 bg-emerald-500/[0.12] px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm sm:min-w-0 sm:max-w-[min(100%,22rem)] sm:px-5 sm:py-3 sm:text-base">
                              <CheckCircle2 className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" strokeWidth={2} aria-hidden />
                              <span className="min-w-0 break-words text-center">FedEx verified</span>
                            </span>
                          ) : hasSavedAddress ? (
                            <span className="inline-flex min-h-12 w-full min-w-0 max-w-full items-center justify-center rounded-xl border-2 border-amber-200/80 bg-amber-50/50 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm sm:min-w-0 sm:max-w-[min(100%,20rem)] sm:px-5 sm:py-3 sm:text-base">
                              <span className="min-w-0 break-words text-center">Not FedEx verified</span>
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-text-secondary">
                          This ship-from address is read-only here. To update your saved home address, use{" "}
                          <Link
                            href="/customer/profile"
                            className="font-semibold text-accent-blue underline-offset-2 hover:underline"
                          >
                            My profile
                          </Link>
                          , or choose &quot;Use a different address&quot; and then save to profile.
                        </p>
                        <div className="min-w-0 border-t border-border-subtle/70 pt-5 sm:pt-6">
                          <div className={`${RECEIVER_TWO_COL} sm:items-start`}>
                            <div className={`${FIELD} sm:col-span-2`}>
                              <span className={L}>Company (optional)</span>
                              <Input
                                className={DISABLED_INPUT}
                                readOnly
                                disabled
                                value={sender.company ?? ""}
                                placeholder="—"
                              />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>Name</span>
                              <Input
                                className={DISABLED_INPUT}
                                readOnly
                                disabled
                                value={sender.name}
                                autoComplete="name"
                              />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>State</span>
                              <Input className={DISABLED_INPUT} readOnly disabled value={sender.state} />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>City</span>
                              <Input className={DISABLED_INPUT} readOnly disabled value={sender.city} />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>ZIP</span>
                              <Input
                                className={`${DISABLED_INPUT} tabular-nums`}
                                readOnly
                                disabled
                                value={sender.postalCode}
                              />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>Country</span>
                              <Input className={DISABLED_INPUT} readOnly disabled value={sender.country} />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>Phone (digits only)</span>
                              <Input
                                className={`${DISABLED_INPUT} tabular-nums`}
                                readOnly
                                disabled
                                value={sender.phone}
                              />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>Street line 1</span>
                              <Input
                                className={DISABLED_INPUT}
                                readOnly
                                disabled
                                value={sender.street1}
                              />
                            </div>
                            <div className={FIELD}>
                              <span className={L}>Street line 2 (optional)</span>
                              <Input
                                className={DISABLED_INPUT}
                                readOnly
                                disabled
                                value={sender.street2 ?? ""}
                                placeholder="—"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex w-full min-w-0 flex-col items-stretch sm:flex-row sm:justify-center">
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-auto min-h-12 w-full min-w-0 max-w-lg border-2 border-accent-amber/55 bg-surface-raised/50 px-5 py-3 text-base font-semibold text-text-primary shadow-sm transition-colors hover:border-accent-amber hover:bg-[var(--selection-tint)]"
                            onClick={() => setEditingSender(true)}
                          >
                            Use a different address
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {!hasSavedAddress ? (
                          <div className="flex gap-2 rounded-lg border border-accent-amber/35 bg-surface-raised/40 px-3 py-2 text-sm text-text-primary shadow-sm">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" aria-hidden />
                            <p>
                              Add a saved address on{" "}
                              <Link
                                href="/customer/profile"
                                className="font-semibold text-accent-blue underline-offset-2 hover:underline"
                              >
                                My profile
                              </Link>{" "}
                              to prefill the sender next time, or complete the form below.
                            </p>
                          </div>
                        ) : null}
                        <div className={RECEIVER_TWO_COL}>
                          <div className="sm:col-span-2">
                            <Field
                              label="Company (optional)"
                              value={sender.company ?? ""}
                              onChange={(v) => setAddr("company", v)}
                            />
                          </div>
                        </div>
                        <UsAddressFields
                          value={sender}
                          onChange={onSenderUsAddressChange}
                          idPrefix="cust-sender"
                          selectClassName={SELECT_CLASS}
                          labelClassName={L}
                          inputClassName={INPUT_CLASS}
                          combineNameStateRow={{
                            name: sender.name,
                            onNameChange: (v) => setAddr("name", v),
                          }}
                          phoneField={{
                            value: sender.phone,
                            onChange: (v) => setAddr("phone", digitsOnlyPhone(v).slice(0, 15)),
                            maxLength: 15,
                            inputMode: "numeric",
                            autoComplete: "tel",
                          }}
                        />
                        <div className={RECEIVER_TWO_COL}>
                          <Field
                            label="Street line 1"
                            value={sender.street1}
                            maxLength={150}
                            onChange={(v) => setAddr("street1", v)}
                            required
                            icon={MapPin}
                            placeholder="123 Main Street"
                          />
                          <Field
                            label="Street line 2 (optional)"
                            value={sender.street2 ?? ""}
                            maxLength={255}
                            onChange={(v) => setAddr("street2", v)}
                            icon={MapPin}
                            placeholder="Apt, suite, unit (optional)"
                          />
                        </div>
                        <div className="space-y-3 border-t border-border-subtle pt-6">
                          <p className="text-sm text-text-secondary">
                            Prefer editing on{" "}
                            <Link
                              href="/customer/profile"
                              className="font-semibold text-accent-blue underline-offset-2 hover:underline"
                            >
                              My profile
                            </Link>
                            ? Your saved address there loads here on the next visit. Or use{" "}
                            <strong className="font-semibold text-text-primary">Save to my profile</strong> below to
                            store what you entered on this form.
                          </p>
                          <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
                            <Button
                              type="button"
                              variant="primary"
                              className="h-auto min-h-12 w-full min-w-0 max-w-lg !px-6 py-3 text-base font-bold shadow-sm"
                              disabled={busy}
                              onClick={() => void handleSaveSenderToProfile()}
                            >
                              Save to my profile
                            </Button>
                            {hasSavedAddress ? (
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-auto min-h-12 w-full min-w-0 max-w-lg border-2 border-slate-200 !bg-white !text-text-primary !shadow-sm hover:!border-accent-amber/40 hover:!bg-slate-50"
                                disabled={busy}
                                onClick={() => {
                                  if (!token) {
                                    setEditingSender(false);
                                    return;
                                  }
                                  void (async () => {
                                    const p = await getUserProfile(token);
                                    if (p.address_street) {
                                      setSender((prev) => ({
                                        ...prev,
                                        name: p.name,
                                        company: p.address_company ?? "",
                                        street1: p.address_street ?? "",
                                        street2: p.address_street2 ?? "",
                                        city: p.address_city ?? "",
                                        state: p.address_state ?? "",
                                        postalCode: p.address_postal_code ?? "",
                                        country: p.address_country ?? "US",
                                        phone: p.phone ? digitsOnlyPhone(p.phone) : prev.phone,
                                      }));
                                      resetSenderFedExValidation();
                                    }
                                    setEditingSender(false);
                                  })();
                                }}
                              >
                                Use profile address
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>

              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "var(--amber)",
                      paddingLeft: 14,
                      borderLeft: "3px solid var(--amber)",
                    }}
                  >
                    To (recipient)
                  </div>
                  <div
                    style={{
                      marginLeft: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "3px 10px",
                      background: "var(--amber-dim)",
                      border: "1px solid var(--border-accent)",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--amber)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    <Lock size={11} />
                    Fixed — admin managed
                  </div>
                </div>

                {fixedRecipient ? (
                  <div
                    style={{
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      padding: "20px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <MapPin
                        size={18}
                        color="var(--amber)"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: 2,
                          }}
                        >
                          {fixedRecipient.personName}
                        </p>
                        {fixedRecipient.companyName ? (
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--text-secondary)",
                              marginBottom: 6,
                            }}
                          >
                            {fixedRecipient.companyName}
                          </p>
                        ) : null}
                        <p
                          style={{
                            fontSize: 14,
                            color: "var(--text-secondary)",
                            lineHeight: 1.6,
                          }}
                        >
                          {fixedRecipient.address.streetLines.join(", ")}
                          <br />
                          {fixedRecipient.address.city}, {fixedRecipient.address.stateOrProvinceCode}{" "}
                          {fixedRecipient.address.postalCode}
                          <br />
                          {fixedRecipient.address.countryCode}
                        </p>
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--text-muted)",
                            fontFamily: "Fira Code",
                            marginTop: 8,
                          }}
                        >
                          +1 {fixedRecipient.phoneNumber}
                        </p>
                        {fixedRecipient.email ? (
                          <p
                            style={{
                              fontSize: 13,
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {fixedRecipient.email}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "20px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "var(--radius-md)",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 14,
                    }}
                  >
                    Loading recipient…
                  </div>
                )}

                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    marginTop: 10,
                    textAlign: "center",
                  }}
                >
                  All shipments are sent to this address. Contact your admin to change the recipient.
                </p>
              </div>
            </div>

            <AddressValidationWidget
              signInContext="pickup"
              receiver={sender}
              onApplyReceiver={(next) => {
                resetSenderFedExValidation();
                setSender(next);
              }}
              onValidationStateChange={setSenderFedExValidation}
              onRecipientCheckOkChange={setFedExSenderCheckOk}
            />
          </div>
        ) : null}

        {step === 2 ? (
          <>
            <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
              <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
                <h2 className="text-lg font-bold text-text-primary">Residential delivery</h2>
              </div>
              <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
                <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-3 text-sm text-text-primary shadow-sm">
                  <input
                    type="checkbox"
                    checked={isResidential}
                    onChange={(e) => setIsResidential(e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded border border-border-default text-accent-amber focus:ring-2 focus:ring-[var(--amber-glow)]"
                  />
                  Ship to a residential address
                </label>
              </div>
            </Card>

            <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
              <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
                <h2 className="text-lg font-bold text-text-primary">Packaging</h2>
                <p className="mt-1.5 text-sm text-text-muted">
                  Requests use <span className="mono text-accent-amber">YOUR_PACKAGING</span> until the server adds more
                  package types.
                </p>
              </div>
              <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
                <div className="grid grid-cols-1 gap-[15px] sm:grid-cols-3">
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
                        className={`btn-text-wrap rounded-xl border text-left transition-all duration-200 ${
                          active
                            ? "border-accent-amber bg-[var(--accent-amber-glow)] shadow-glow"
                            : "border-border-default bg-surface-card hover:border-border-accent"
                        } ${!opt.selectable ? "cursor-not-allowed opacity-60" : ""}`}
                        style={{ padding: "15px" }}
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
            </Card>

            <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
              <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
                <h2 className="text-lg font-bold text-text-primary">Package details</h2>
              </div>
              <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
                <div className="space-y-4">
                  <Field
                    label="Description"
                    value={pkg.description}
                    onChange={(v) => setPkg((p) => ({ ...p, description: v }))}
                    icon={FileText}
                    placeholder="e.g. Electronics, documents"
                  />
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-8">
                    <Field
                      label="Weight (lb)"
                      value={String(pkg.weightLb)}
                      onChange={(v) => setPkg((p) => ({ ...p, weightLb: Number(v) || 0 }))}
                      icon={Weight}
                      placeholder="e.g. 2.5"
                    />
                    <Field
                      label="Length (in, integer)"
                      value={String(Math.floor(pkg.lengthIn))}
                      onChange={(v) =>
                        setPkg((p) => ({ ...p, lengthIn: Math.max(1, Math.floor(Number(v) || 1)) }))
                      }
                      icon={Ruler}
                      placeholder="e.g. 12"
                    />
                    <Field
                      label="Width (in, integer)"
                      value={String(Math.floor(pkg.widthIn))}
                      onChange={(v) =>
                        setPkg((p) => ({ ...p, widthIn: Math.max(1, Math.floor(Number(v) || 1)) }))
                      }
                      icon={Ruler}
                      placeholder="e.g. 9"
                    />
                    <Field
                      label="Height (in, integer)"
                      value={String(Math.floor(pkg.heightIn))}
                      onChange={(v) =>
                        setPkg((p) => ({ ...p, heightIn: Math.max(1, Math.floor(Number(v) || 1)) }))
                      }
                      icon={Ruler}
                      placeholder="e.g. 6"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        {step === 3 ? (
          <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
            <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
              <h2 className="text-lg font-bold text-text-primary">Service & pickup</h2>
            </div>
            <div className="min-w-0 w-full box-border" style={DASHBOARD_CARD_INSET}>
              <div className={FORM_STACK}>
                <div className={FIELD}>
                  <label className={L} htmlFor="new-ship-service">
                    Service type
                  </label>
                  <SelectWithLeadingIcon
                    id="new-ship-service"
                    icon={Truck}
                    className={SELECT_CLASS}
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as FedExServiceTypeValue)}
                  >
                    {serviceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </SelectWithLeadingIcon>
                </div>
                <div className={FIELD}>
                  <p className={L}>Pickup</p>
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-sm text-text-secondary">
                    {pickupOptions.map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-2.5 shadow-sm"
                      >
                        <input
                          type="radio"
                          name="pickup"
                          checked={pickupType === opt.value}
                          onChange={() => setPickupType(opt.value)}
                          className="size-4 border-border-default text-accent-amber focus:ring-2 focus:ring-[var(--amber-glow)]"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        {step1ShowPickupAddressHint ? (
          <div
            className="rounded-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 shadow-sm"
            role="status"
          >
            <p className="font-semibold text-text-primary">Finish your pickup (sender) address</p>
            <p className="mt-1.5 leading-relaxed text-amber-900/95">
              FedEx confirmed your ship-from address, but <strong>Continue</strong> also needs the pickup form to be
              complete: 10-digit US phone, 2-letter state, city, street line 1, and ZIP. If fields are read-only, click
              to edit your address.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-[var(--space-8)]">
          <div className="flex flex-wrap gap-3">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-h-12 min-w-[8.5rem] border-2 border-border-accent px-7 py-3 text-base font-bold"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
              >
                <ChevronLeft className="h-4 w-4 shrink-0" />
                Back
              </Button>
            ) : (
              <Link
                href="/customer/shipments"
                className="inline-flex h-auto min-h-12 min-w-[8.5rem] items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border-2 border-border-accent px-7 py-3 text-base font-bold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
              >
                Cancel
              </Link>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            {step < 3 ? (
              <Button
                type="button"
                variant="primary"
                className="h-auto min-h-12 min-w-[10.5rem] !px-8 !py-3 text-base font-bold"
                disabled={busy || (step === 1 && !canAdvanceFromStep1)}
                title={
                  step === 1 && !busy && !canAdvanceFromStep1
                    ? step1ContinueDisabledReason(
                        sender,
                        Boolean(fixedRecipient),
                        senderFedExValidation,
                        fedExSenderCheckOk,
                      )
                    : undefined
                }
                onClick={() => {
                  void (async () => {
                    setError(null);
                    if (step === 1) {
                      const s = {
                        ...sender,
                        name: sender.name.trim() || "Sender",
                        phone: nationalUs10DigitPhone(sender.phone),
                      };
                      if (!canAdvanceFromStep1) {
                        setError(
                          step1ContinueDisabledReason(
                            sender,
                            Boolean(fixedRecipient),
                            senderFedExValidation,
                            fedExSenderCheckOk,
                          ) ?? "Complete your pickup address and FedEx check.",
                        );
                        return;
                      }
                      if (!(await validateUsAddressForFedExSubmission(s))) {
                        setError(FEDEX_ADDRESS_COMPLIANCE_MESSAGE);
                        return;
                      }
                      setStep(2);
                      return;
                    }
                    if (step === 2) {
                      setStep(3);
                    }
                  })();
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
                  className="h-auto min-h-12 min-w-[10.5rem] border-2 border-border-accent !px-7 !py-3 text-base font-bold"
                  onClick={() => void runValidateFedEx()}
                >
                  Validate with FedEx
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="h-auto min-h-12 min-w-[11rem] !px-8 !py-3 text-base font-bold"
                  disabled={busy}
                >
                  {fedexAlerts.length > 0 ? "Create shipment (confirm warnings)" : "Create shipment"}
                </Button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  maxLength,
  inputMode,
  autoComplete,
  placeholder,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  maxLength?: number;
  inputMode?: "numeric" | "text" | "tel" | "search" | "email" | "url" | "decimal" | "none";
  autoComplete?: string;
  placeholder?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className={FIELD}>
      <label className={L}>{label}</label>
      {Icon ? (
        <InputWithLeadingIcon
          icon={Icon}
          className={INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
      ) : (
        <Input
          className={INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

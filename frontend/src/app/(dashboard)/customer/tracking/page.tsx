"use client";

import { Loader2, Package, Search } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FedExTrackResult } from "@/components/shipping/fedex-track-result";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import {
  buildFedExAssociatedShipmentsPayload,
  buildFedExTrackByReferencePayload,
  buildFedExTrackByTrackingNumberPayload,
  buildFedExTrackByTcnPayload,
  type FedExTrackApiEnvelope,
  trackFedExAssociatedShipments,
  trackFedExByReference,
  trackFedExByTrackingNumber,
  trackFedExByTcn,
} from "@/lib/api/fedex";
import { parseFedExErrorsFromBody } from "@/lib/api/shipments";
import { useAuth } from "@/lib/auth/context";
import {
  DASHBOARD_CARD_INSET,
  DASHBOARD_GRADIENT_CARD_CLASS,
  DASHBOARD_SECTION_HEADER_CLASS,
} from "@/lib/dashboardCardStyles";

const FORM_STACK = "flex w-full min-w-0 max-w-full flex-col gap-8";
const FIELD = "flex min-w-0 flex-col gap-2";
const L = "block text-[13px] font-semibold uppercase tracking-[0.06em] text-text-secondary";
const INPUT_BASE =
  "w-full min-w-0 rounded-[var(--radius-md)] border border-border-default !bg-white text-[15px] leading-normal text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--amber-glow)]";
const INPUT_LINE = `${INPUT_BASE} h-11 px-4`;
const SELECT_CLASS = `${INPUT_BASE} h-11 cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10 px-4`;
const PRIMARY_ACTION =
  "h-auto !min-h-11 w-full !min-w-0 !px-8 py-3 sm:mx-auto sm:w-auto sm:min-w-[20rem] sm:max-w-[min(100%,24rem)]";
const RADIO_ROW =
  "flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-border-default !bg-white p-3 shadow-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--amber-glow)] hover:border-border-accent";

const CARRIER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Default (let FedEx infer)" },
  { value: "FDXE", label: "FDXE — Express" },
  { value: "FDXG", label: "FDXG — Ground" },
  { value: "FXSP", label: "FXSP — SmartPost" },
];

/** Matches `StoreFedExTrackByReferenceRequest` (FedEx track by reference). */
const FEDEX_REFERENCE_TYPE_VALUES = [
  "BILL_OF_LADING",
  "COD_RETURN_TRACKING_NUMBER",
  "CUSTOMER_AUTHORIZATION_NUMBER",
  "CUSTOMER_REFERENCE",
  "DEPARTMENT",
  "DOCUMENT_AIRWAY_BILL",
  "EXPRESS_ALTERNATE_REFERENCE",
  "FEDEX_OFFICE_JOB_ORDER_NUMBER",
  "FREE_FORM_REFERENCE",
  "GROUND_INTERNATIONAL",
  "GROUND_SHIPMENT_ID",
  "INTERNATIONAL_DISTRIBUTION",
  "INVOICE",
  "JOB_GLOBAL_TRACKING_NUMBER",
  "ORDER_GLOBAL_TRACKING_NUMBER",
  "ORDER_TO_PAY_NUMBER",
  "PART_NUMBER",
  "PARTNER_CARRIER_NUMBER",
  "PURCHASE_ORDER",
  "REROUTE_TRACKING_NUMBER",
  "RETURN_MATERIALS_AUTHORIZATION",
  "RETURNED_TO_SHIPPER_TRACKING_NUMBER",
  "SHIPPER_REFERENCE",
  "TRANSBORDER_DISTRIBUTION",
  "TRANSPORTATION_CONTROL_NUMBER",
  "VIRTUAL_CONSOLIDATION",
] as const;

function refTypeLabel(v: string): string {
  return v
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

const REFERENCE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Not specified" },
  ...FEDEX_REFERENCE_TYPE_VALUES.map((value) => ({ value, label: refTypeLabel(value) })),
];

const ASSOCIATED_TYPE_OPTIONS: { value: "OUTBOUND_LINK_TO_RETURN" | "STANDARD_MPS" | "GROUP_MPS"; label: string }[] = [
  { value: "STANDARD_MPS", label: "Standard MPS" },
  { value: "GROUP_MPS", label: "Group MPS" },
  { value: "OUTBOUND_LINK_TO_RETURN", label: "Outbound link to return" },
];

type TrackMode = "tracking_number" | "reference" | "tcn" | "associated_mps";

const TRACK_MODES: { id: TrackMode; label: string; description: string }[] = [
  {
    id: "tracking_number",
    label: "Tracking number",
    description: "Standard FedEx tracking number (one number per search).",
  },
  {
    id: "reference",
    label: "Reference number",
    description: "PO, customer reference, RMA, invoice, and other reference types.",
  },
  {
    id: "tcn",
    label: "TCN (transportation control)",
    description: "Track by transportation control number.",
  },
  {
    id: "associated_mps",
    label: "Related shipments (MPS)",
    description: "Group MPS, standard MPS, or outbound linked to return — uses master tracking.",
  },
];

function firstQueryToken(raw: string): string {
  return raw.split(/[\n,;]+/)[0]?.trim() ?? "";
}

function trackModeFromParam(raw: string | null | undefined): TrackMode {
  const m = (raw ?? "").toLowerCase().trim();
  if (m === "reference" || m === "ref") return "reference";
  if (m === "tcn") return "tcn";
  if (m === "associated" || m === "mps" || m === "related") return "associated_mps";
  if (m === "tracking" || m === "number" || m === "tracking_number") return "tracking_number";
  return "tracking_number";
}

function TrackingPageInner() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [initialized, setInitialized] = useState(false);
  const [trackMode, setTrackMode] = useState<TrackMode>("tracking_number");

  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrierCode, setCarrierCode] = useState("");
  const [includeDetailedScans, setIncludeDetailedScans] = useState(true);

  const [refValue, setRefValue] = useState("");
  const [refType, setRefType] = useState("");
  const [refCarrier, setRefCarrier] = useState("");
  const [refAccount, setRefAccount] = useState("");
  const [refCountry, setRefCountry] = useState("");
  const [refPostal, setRefPostal] = useState("");
  const [refDateBegin, setRefDateBegin] = useState("");
  const [refDateEnd, setRefDateEnd] = useState("");
  const [refIdMethod, setRefIdMethod] = useState<"account" | "destination">("account");

  const [tcnValue, setTcnValue] = useState("");
  const [tcnCarrier, setTcnCarrier] = useState("");
  const [tcnDateBegin, setTcnDateBegin] = useState("");
  const [tcnDateEnd, setTcnDateEnd] = useState("");

  const [assocType, setAssocType] = useState<"OUTBOUND_LINK_TO_RETURN" | "STANDARD_MPS" | "GROUP_MPS">("STANDARD_MPS");
  const [assocMaster, setAssocMaster] = useState("");
  const [assocCarrier, setAssocCarrier] = useState("");
  const [assocDateBegin, setAssocDateBegin] = useState("");
  const [assocDateEnd, setAssocDateEnd] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fedexErrors, setFedexErrors] = useState<{ code: string; message: string }[]>([]);
  const [result, setResult] = useState<FedExTrackApiEnvelope | null>(null);

  const fromQuery = useMemo(() => {
    const q = searchParams.get("q")?.trim() ?? "";
    const t = searchParams.get("tracking")?.trim() ?? "";
    return q || t || "";
  }, [searchParams]);

  useEffect(() => {
    if (initialized) {
      return;
    }
    const mode = trackModeFromParam(searchParams.get("mode"));
    setTrackMode(mode);
    const tokenStr = fromQuery ? firstQueryToken(fromQuery) : "";
    if (tokenStr) {
      if (mode === "tracking_number") {
        setTrackingNumber(tokenStr);
      } else if (mode === "reference") {
        setRefValue(tokenStr);
      } else if (mode === "tcn") {
        setTcnValue(tokenStr);
      } else {
        setAssocMaster(tokenStr);
      }
    }
    setInitialized(true);
  }, [fromQuery, initialized, searchParams]);

  const onModeChange = (next: TrackMode) => {
    setTrackMode(next);
    setError(null);
    setResult(null);
    setFedexErrors([]);
  };

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
            Track shipments
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            Choose a FedEx track method, enter your details, then search — responses match the Track API
            envelope returned by your account proxy.
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

      <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
        <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
          <h2 className="text-lg font-bold text-text-primary">Query FedEx</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            1) Select how to track. 2) Enter the value for that method. 3) Search.
            {fromQuery && initialized ? (
              <span className="ms-1 text-text-secondary">
                URL <code className="mono rounded border border-border-subtle bg-white px-1 py-0.5 text-xs">q=</code>{" "}
                pre-fills a single value for the current mode.
              </span>
            ) : null}
          </p>
        </div>
        <form
          className="min-w-0"
          style={DASHBOARD_CARD_INSET}
          onSubmit={(e) => {
            e.preventDefault();
            if (!token) {
              showToast("Sign in to track.", "error");
              return;
            }
            setError(null);
            setFedexErrors([]);
            setLoading(true);
            setResult(null);

            if (trackMode === "tracking_number") {
              const n = trackingNumber.trim();
              if (n.length === 0) {
                setError("Enter a tracking number.");
                setLoading(false);
                return;
              }
              const body = buildFedExTrackByTrackingNumberPayload([n], {
                includeDetailedScans,
                carrierCode: carrierCode || undefined,
              });
              void (async () => {
                try {
                  const data = await trackFedExByTrackingNumber(token, body as Record<string, unknown>);
                  setResult(data);
                  showToast("Track request completed.");
                } catch (err) {
                  if (err instanceof ApiError) {
                    setError(err.message);
                    setFedexErrors(parseFedExErrorsFromBody(err.body));
                  } else {
                    setError(err instanceof Error ? err.message : "Request failed.");
                  }
                } finally {
                  setLoading(false);
                }
              })();
              return;
            }

            if (trackMode === "reference") {
              const v = refValue.trim();
              if (!v) {
                setError("Enter a reference value.");
                setLoading(false);
                return;
              }
              const hasAccount = refIdMethod === "account" && refAccount.trim() !== "";
              const hasDest =
                refIdMethod === "destination" && refCountry.trim() !== "" && refPostal.trim() !== "";
              if (!hasAccount && !hasDest) {
                setError("Provide a FedEx account number, or both destination country and postal code (FedEx requirement).");
                setLoading(false);
                return;
              }
              const body = buildFedExTrackByReferencePayload({
                value: v,
                includeDetailedScans,
                type: refType || null,
                carrierCode: refCarrier || undefined,
                accountNumber: refIdMethod === "account" ? refAccount : undefined,
                destinationCountryCode: refIdMethod === "destination" ? refCountry : undefined,
                destinationPostalCode: refIdMethod === "destination" ? refPostal : undefined,
                shipDateBegin: refDateBegin || undefined,
                shipDateEnd: refDateEnd || undefined,
              });
              void (async () => {
                try {
                  const data = await trackFedExByReference(token, body);
                  setResult(data);
                  showToast("Track by reference completed.");
                } catch (err) {
                  if (err instanceof ApiError) {
                    setError(err.message);
                    setFedexErrors(parseFedExErrorsFromBody(err.body));
                  } else {
                    setError(err instanceof Error ? err.message : "Request failed.");
                  }
                } finally {
                  setLoading(false);
                }
              })();
              return;
            }

            if (trackMode === "tcn") {
              const v = tcnValue.trim();
              if (!v) {
                setError("Enter a TCN.");
                setLoading(false);
                return;
              }
              const body = buildFedExTrackByTcnPayload({
                value: v,
                includeDetailedScans,
                carrierCode: tcnCarrier || undefined,
                shipDateBegin: tcnDateBegin || undefined,
                shipDateEnd: tcnDateEnd || undefined,
              });
              void (async () => {
                try {
                  const data = await trackFedExByTcn(token, body);
                  setResult(data);
                  showToast("Track by TCN completed.");
                } catch (err) {
                  if (err instanceof ApiError) {
                    setError(err.message);
                    setFedexErrors(parseFedExErrorsFromBody(err.body));
                  } else {
                    setError(err instanceof Error ? err.message : "Request failed.");
                  }
                } finally {
                  setLoading(false);
                }
              })();
              return;
            }

            const master = assocMaster.trim();
            if (master.length === 0) {
              setError("Enter the master tracking number.");
              setLoading(false);
              return;
            }
            const body = buildFedExAssociatedShipmentsPayload({
              associatedType: assocType,
              masterTrackingNumber: master,
              includeDetailedScans,
              carrierCode: assocCarrier || undefined,
              shipDateBegin: assocDateBegin || undefined,
              shipDateEnd: assocDateEnd || undefined,
            });
            void (async () => {
              try {
                const data = await trackFedExAssociatedShipments(token, body);
                setResult(data);
                showToast("Related shipments request completed.");
              } catch (err) {
                if (err instanceof ApiError) {
                  setError(err.message);
                  setFedexErrors(parseFedExErrorsFromBody(err.body));
                } else {
                  setError(err instanceof Error ? err.message : "Request failed.");
                }
              } finally {
                setLoading(false);
              }
            })();
          }}
        >
          <div className={FORM_STACK}>
            <div className={FIELD}>
              <label className={L} htmlFor="track-method">
                Track by <span className="text-accent-red">*</span>
              </label>
              <p className="text-sm text-text-muted">Select the FedEx method first; the form below will match that choice.</p>
              <select
                id="track-method"
                className={SELECT_CLASS}
                value={trackMode}
                onChange={(e) => onModeChange(e.target.value as TrackMode)}
              >
                {TRACK_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-text-muted">
                {TRACK_MODES.find((m) => m.id === trackMode)?.description}
              </p>
            </div>

            {trackMode === "tracking_number" ? (
              <>
                <div className={FIELD}>
                  <label className={L} htmlFor="track-number">
                    Tracking number <span className="text-accent-red">*</span>
                  </label>
                  <p className="text-sm text-text-muted">One number per search (links with several values use the first only).</p>
                  <input
                    id="track-number"
                    className={INPUT_LINE}
                    placeholder="e.g. 794806501323"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    maxLength={64}
                    autoComplete="off"
                  />
                </div>
                <div className="grid w-full min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0">
                  <div className={FIELD}>
                    <label className={L} htmlFor="carrier-tn">
                      carrierCode <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <select
                      id="carrier-tn"
                      className={SELECT_CLASS}
                      value={carrierCode}
                      onChange={(e) => setCarrierCode(e.target.value)}
                    >
                      {CARRIER_OPTIONS.map((o) => (
                        <option key={o.value || "default"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`${FIELD} sm:pt-[1.75rem]`}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-2.5 text-sm text-text-primary shadow-sm transition-colors hover:border-border-accent">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border border-border-default text-accent-amber focus:ring-2 focus:ring-[var(--amber-glow)]"
                        checked={includeDetailedScans}
                        onChange={(e) => setIncludeDetailedScans(e.target.checked)}
                      />
                      <span className="leading-snug">includeDetailedScans</span>
                    </label>
                  </div>
                </div>
              </>
            ) : null}

            {trackMode === "reference" ? (
              <>
                <div className={FIELD}>
                  <label className={L} htmlFor="ref-value">
                    Reference value <span className="text-accent-red">*</span>
                  </label>
                  <p className="text-sm text-text-muted">The reference string FedEx should look up (e.g. PO, customer ref).</p>
                  <input
                    id="ref-value"
                    className={INPUT_LINE}
                    value={refValue}
                    onChange={(e) => setRefValue(e.target.value)}
                    maxLength={512}
                    autoComplete="off"
                  />
                </div>
                <div className={FIELD}>
                  <label className={L} htmlFor="ref-type">
                    Reference type <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <select
                    id="ref-type"
                    className={SELECT_CLASS}
                    value={refType}
                    onChange={(e) => setRefType(e.target.value)}
                  >
                    {REFERENCE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value || "none"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={FIELD}>
                  <label className={L} htmlFor="ref-carrier">
                    carrierCode <span className="font-normal text-text-muted">(optional)</span>
                  </label>
                  <select
                    id="ref-carrier"
                    className={SELECT_CLASS}
                    value={refCarrier}
                    onChange={(e) => setRefCarrier(e.target.value)}
                  >
                    {CARRIER_OPTIONS.map((o) => (
                      <option key={o.value || "default"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={FIELD} role="group" aria-labelledby="ref-identity-label">
                  <p id="ref-identity-label" className={L}>
                    Shipment scope <span className="text-accent-red">*</span>
                  </p>
                  <p className="text-sm text-text-muted">FedEx requires a FedEx account, or both destination country and postal code.</p>
                  <div className="mt-2 flex flex-col gap-2">
                    <label className={RADIO_ROW}>
                      <input
                        type="radio"
                        name="ref-id"
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber"
                        checked={refIdMethod === "account"}
                        onChange={() => setRefIdMethod("account")}
                      />
                      <span className="font-medium text-text-primary">FedEx account number</span>
                    </label>
                    {refIdMethod === "account" ? (
                      <input
                        className={INPUT_LINE}
                        aria-label="FedEx account number"
                        value={refAccount}
                        onChange={(e) => setRefAccount(e.target.value)}
                        maxLength={32}
                        autoComplete="off"
                      />
                    ) : null}
                    <label className={RADIO_ROW}>
                      <input
                        type="radio"
                        name="ref-id"
                        className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber"
                        checked={refIdMethod === "destination"}
                        onChange={() => setRefIdMethod("destination")}
                      />
                      <span className="font-medium text-text-primary">Destination country + postal code</span>
                    </label>
                    {refIdMethod === "destination" ? (
                      <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6">
                        <div className={FIELD}>
                          <label className="text-sm font-medium text-text-secondary" htmlFor="ref-country">
                            Country (ISO-2) <span className="text-accent-red">*</span>
                          </label>
                          <input
                            id="ref-country"
                            className={INPUT_LINE}
                            placeholder="US"
                            value={refCountry}
                            onChange={(e) => setRefCountry(e.target.value.toUpperCase().slice(0, 2))}
                            maxLength={2}
                            inputMode="text"
                            autoComplete="off"
                          />
                        </div>
                        <div className={FIELD}>
                          <label className="text-sm font-medium text-text-secondary" htmlFor="ref-postal">
                            Postal code <span className="text-accent-red">*</span>
                          </label>
                          <input
                            id="ref-postal"
                            className={INPUT_LINE}
                            value={refPostal}
                            onChange={(e) => setRefPostal(e.target.value)}
                            maxLength={32}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8">
                  <div className={FIELD}>
                    <label className={L} htmlFor="ref-ship-start">
                      Ship date begin <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="ref-ship-start"
                      type="date"
                      className={INPUT_LINE}
                      value={refDateBegin}
                      onChange={(e) => setRefDateBegin(e.target.value)}
                    />
                  </div>
                  <div className={FIELD}>
                    <label className={L} htmlFor="ref-ship-end">
                      Ship date end <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="ref-ship-end"
                      type="date"
                      className={INPUT_LINE}
                      value={refDateEnd}
                      onChange={(e) => setRefDateEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className={FIELD}>
                  <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-2.5 text-sm text-text-primary shadow-sm">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded border border-border-default text-accent-amber focus:ring-2 focus:ring-[var(--amber-glow)]"
                      checked={includeDetailedScans}
                      onChange={(e) => setIncludeDetailedScans(e.target.checked)}
                    />
                    includeDetailedScans
                  </label>
                </div>
              </>
            ) : null}

            {trackMode === "tcn" ? (
              <>
                <div className={FIELD}>
                  <label className={L} htmlFor="tcn-value">
                    TCN <span className="text-accent-red">*</span>
                  </label>
                  <input
                    id="tcn-value"
                    className={INPUT_LINE}
                    value={tcnValue}
                    onChange={(e) => setTcnValue(e.target.value)}
                    maxLength={128}
                    autoComplete="off"
                  />
                </div>
                <div className="grid w-full min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0">
                  <div className={FIELD}>
                    <label className={L} htmlFor="tcn-carrier">
                      carrierCode <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <select
                      id="tcn-carrier"
                      className={SELECT_CLASS}
                      value={tcnCarrier}
                      onChange={(e) => setTcnCarrier(e.target.value)}
                    >
                      {CARRIER_OPTIONS.map((o) => (
                        <option key={o.value || "default"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`${FIELD} sm:pt-[1.75rem]`}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-2.5 text-sm text-text-primary shadow-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border border-border-default text-accent-amber focus:ring-2 focus:ring-[var(--amber-glow)]"
                        checked={includeDetailedScans}
                        onChange={(e) => setIncludeDetailedScans(e.target.checked)}
                      />
                      includeDetailedScans
                    </label>
                  </div>
                </div>
                <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8">
                  <div className={FIELD}>
                    <label className={L} htmlFor="tcn-ship-start">
                      Ship date begin <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="tcn-ship-start"
                      type="date"
                      className={INPUT_LINE}
                      value={tcnDateBegin}
                      onChange={(e) => setTcnDateBegin(e.target.value)}
                    />
                  </div>
                  <div className={FIELD}>
                    <label className={L} htmlFor="tcn-ship-end">
                      Ship date end <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="tcn-ship-end"
                      type="date"
                      className={INPUT_LINE}
                      value={tcnDateEnd}
                      onChange={(e) => setTcnDateEnd(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            {trackMode === "associated_mps" ? (
              <>
                <div className={FIELD}>
                  <label className={L} htmlFor="assoc-type">
                    Related shipment type <span className="text-accent-red">*</span>
                  </label>
                  <select
                    id="assoc-type"
                    className={SELECT_CLASS}
                    value={assocType}
                    onChange={(e) => setAssocType(e.target.value as typeof assocType)}
                  >
                    {ASSOCIATED_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={FIELD}>
                  <label className={L} htmlFor="assoc-master">
                    Master tracking number <span className="text-accent-red">*</span>
                  </label>
                  <input
                    id="assoc-master"
                    className={INPUT_LINE}
                    value={assocMaster}
                    onChange={(e) => setAssocMaster(e.target.value)}
                    maxLength={64}
                    autoComplete="off"
                  />
                </div>
                <div className="grid w-full min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0">
                  <div className={FIELD}>
                    <label className={L} htmlFor="assoc-carrier">
                      carrierCode <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <select
                      id="assoc-carrier"
                      className={SELECT_CLASS}
                      value={assocCarrier}
                      onChange={(e) => setAssocCarrier(e.target.value)}
                    >
                      {CARRIER_OPTIONS.map((o) => (
                        <option key={o.value || "default"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={`${FIELD} sm:pt-[1.75rem]`}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-2.5 text-sm text-text-primary shadow-sm">
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0 rounded border border-border-default text-accent-amber focus:ring-2 focus:ring-[var(--amber-glow)]"
                        checked={includeDetailedScans}
                        onChange={(e) => setIncludeDetailedScans(e.target.checked)}
                      />
                      includeDetailedScans
                    </label>
                  </div>
                </div>
                <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8">
                  <div className={FIELD}>
                    <label className={L} htmlFor="assoc-ship-start">
                      Ship date begin <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="assoc-ship-start"
                      type="date"
                      className={INPUT_LINE}
                      value={assocDateBegin}
                      onChange={(e) => setAssocDateBegin(e.target.value)}
                    />
                  </div>
                  <div className={FIELD}>
                    <label className={L} htmlFor="assoc-ship-end">
                      Ship date end <span className="font-normal text-text-muted">(optional)</span>
                    </label>
                    <input
                      id="assoc-ship-end"
                      type="date"
                      className={INPUT_LINE}
                      value={assocDateEnd}
                      onChange={(e) => setAssocDateEnd(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : null}

            <div className="flex min-w-0 flex-col items-stretch gap-3 border-t border-border-subtle pt-8 sm:flex-row sm:items-center sm:justify-center">
              <Button type="submit" variant="primary" disabled={loading} className={PRIMARY_ACTION}>
                {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Search className="h-5 w-5 shrink-0" />}
                <span>Search</span>
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {error ? (
        <Card className={`${DASHBOARD_GRADIENT_CARD_CLASS} !border-red-500/35 ring-1 ring-red-500/15`}>
          <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
            <p className="text-base font-semibold leading-relaxed text-accent-red">{error}</p>
            {fedexErrors.length > 0 ? (
              <ul className="mt-4 list-outside list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-secondary marker:text-text-muted sm:text-base">
                {fedexErrors.map((fe, i) => (
                  <li key={i} className="pl-0.5">
                    {fe.code ? <span className="mono text-sm text-text-muted">[{fe.code}] </span> : null}
                    {fe.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>
      ) : null}

      {result ? <FedExTrackResult data={result} /> : null}
    </div>
  );
}

export default function CustomerTrackingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-3 text-lg text-text-secondary">
          <Loader2 className="h-6 w-6 shrink-0 animate-spin text-accent-amber" /> Loading…
        </div>
      }
    >
      <TrackingPageInner />
    </Suspense>
  );
}

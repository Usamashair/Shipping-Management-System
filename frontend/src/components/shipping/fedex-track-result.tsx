"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FedExTrackApiEnvelope } from "@/lib/api/fedex";
import {
  DASHBOARD_CARD_INSET,
  DASHBOARD_GRADIENT_CARD_CLASS,
  DASHBOARD_SECTION_HEADER_CLASS,
} from "@/lib/dashboardCardStyles";

function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v !== "object" || v === null) {
    return null;
  }
  return v as Record<string, unknown>;
}

function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim() !== "") {
      return v;
    }
  }
  return "";
}

function formatScanDate(ev: unknown): string {
  const o = asRecord(ev);
  if (!o) {
    return "";
  }
  if (typeof o.date === "string") {
    return o.date;
  }
  const dts = o.dateAndTimes;
  if (Array.isArray(dts)) {
    for (const row of dts) {
      const r = asRecord(row);
      if (r && typeof r.dateTime === "string") {
        return r.dateTime;
      }
    }
  }
  return "";
}

function formatLocation(loc: unknown): string {
  const o = asRecord(loc);
  if (!o) {
    return "";
  }
  return [o.city, o.stateOrProvinceCode, o.countryName, o.countryCode, o.postalCode, o.name]
    .filter((x) => typeof x === "string" && (x as string).trim() !== "")
    .join(", ");
}

function scanEventDescription(ev: unknown): string {
  const o = asRecord(ev);
  if (!o) {
    return "Event";
  }
  return (
    firstString(
      o.eventDescription,
      o.derivedEventDescription,
      o.exceptionDescription,
    ) || firstString(o.eventType) || "Status update"
  );
}

type Props = {
  data: FedExTrackApiEnvelope;
};

/**
 * Renders the FedEx Track API envelope (`transactionId` + `output` with
 * `completeTrackResults` / `trackResults` / `scanEvents`) without inventing a parallel shape.
 */
const valueBox = "rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-3 shadow-sm";
const labelClass =
  "text-xs font-medium uppercase tracking-wider text-text-muted sm:text-[13px] sm:font-semibold sm:tracking-[0.06em]";

export function FedExTrackResult({ data }: Props) {
  const [rawOpen, setRawOpen] = useState(false);
  const output = asRecord(data.output);
  const complete = useMemo(
    () => (output && Array.isArray(output.completeTrackResults) ? output.completeTrackResults : []),
    [output],
  );

  const outputAlerts = useMemo(() => {
    if (!output) {
      return [];
    }
    const a = output.alerts;
    if (!Array.isArray(a)) {
      return [];
    }
    return a.filter((x) => x !== null && x !== undefined);
  }, [output]);

  return (
    <div className="flex flex-col gap-[var(--space-8)]">
      <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
        <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
          <h3
            className="text-lg font-bold text-text-primary"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Response metadata
          </h3>
          <p className="mt-1.5 text-sm text-text-muted">From the track API envelope (transaction IDs).</p>
        </div>
        <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
          <dl className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-4">
            <div className={`min-w-0 ${valueBox}`}>
              <dt className={labelClass}>transactionId</dt>
              <dd className="mono mt-2 break-all text-[15px] leading-snug text-text-primary tabular-nums">
                {data.transactionId ?? "—"}
              </dd>
            </div>
            <div className={`min-w-0 ${valueBox}`}>
              <dt className={labelClass}>customerTransactionId</dt>
              <dd className="mono mt-2 break-all text-[15px] leading-snug text-text-primary tabular-nums">
                {data.customerTransactionId ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      {outputAlerts.length > 0 ? (
        <Card className={`${DASHBOARD_GRADIENT_CARD_CLASS} !border-amber-500/40 ring-1 ring-amber-500/15`}>
          <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
            <h3 className="text-base font-bold text-amber-900">Alerts (FedEx output.alerts)</h3>
            <ul className="mt-4 list-outside list-disc space-y-2 pl-5 text-sm leading-relaxed text-text-secondary sm:text-base marker:text-amber-700/50">
              {outputAlerts.map((al, i) => (
                <li key={i} className="break-words pl-0.5">
                  {JSON.stringify(al)}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}

      {complete.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface-raised/40 px-4 py-3 text-sm leading-relaxed text-text-secondary sm:text-base">
          No{" "}
          <code className="mono rounded border border-border-subtle bg-white px-1.5 py-0.5 text-xs sm:text-sm">
            output.completeTrackResults
          </code>{" "}
          in this response. Open raw JSON below to inspect the payload.
        </p>
      ) : null}

      {complete.map((block, bIdx) => {
        const b = asRecord(block);
        const tn = firstString(b?.trackingNumber) || `Result ${bIdx + 1}`;
        const trackResults = Array.isArray(b?.trackResults) ? b.trackResults : [];
        return (
          <div key={bIdx} className="flex flex-col gap-6">
            <h3
              className="text-xl font-bold text-text-primary sm:text-2xl"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              <span className="text-text-secondary">Tracking number </span>
              <span className="mono text-accent-amber tabular-nums">{tn}</span>
            </h3>

            {trackResults.map((tr, trIdx) => {
              const row = asRecord(tr);
              const latest = asRecord(row?.latestStatusDetail);
              const service = asRecord(row?.serviceDetail);
              const tni = asRecord(row?.trackingNumberInfo);
              const scans = Array.isArray(row?.scanEvents) ? row.scanEvents : [];
              return (
                <Card key={trIdx} className={DASHBOARD_GRADIENT_CARD_CLASS}>
                  <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
                      <div className="min-w-0 flex-1 space-y-3">
                        {service ? (
                          <p className="text-base leading-relaxed text-text-secondary sm:text-lg">
                            <span className="font-semibold text-text-primary">Service </span>
                            <span className="text-text-primary">
                              {firstString(
                                service.type,
                                service.description,
                                (service as Record<string, unknown>).serviceName,
                              ) || "—"}
                            </span>
                          </p>
                        ) : null}
                        {tni && firstString(tni.trackingNumber) ? (
                          <p className="mono text-sm text-text-muted tabular-nums leading-relaxed">
                            trackingNumberInfo.trackingNumber: {String(tni.trackingNumber)}
                          </p>
                        ) : null}
                      </div>
                      {latest ? (
                        <div className="w-full shrink-0 rounded-[var(--radius-md)] border border-border-default !bg-white px-4 py-4 shadow-sm lg:max-w-md lg:self-start">
                          <p className={labelClass}>latestStatusDetail</p>
                          <p className="mt-2 text-lg font-semibold leading-snug text-text-primary sm:text-xl">
                            {firstString(
                              latest.description,
                              latest.statusByLocale,
                              latest.derivedCode,
                              latest.code,
                            ) || "—"}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {scans.length > 0 ? (
                      <div className="mt-8 border-t border-border-subtle pt-8">
                        <h4 className="text-base font-bold text-text-primary sm:text-lg">Scan events</h4>
                        <ol className="relative ms-0 mt-5 border-s-2 border-border-subtle ps-6 sm:ps-7">
                          {scans.map((ev, i) => {
                            const when = formatScanDate(ev);
                            const loc = formatLocation(asRecord(asRecord(ev)?.scanLocation));
                            return (
                              <li key={i} className="relative pb-8 last:pb-0 sm:pb-10">
                                <span
                                  className="absolute -start-[9px] top-1.5 h-3 w-3 rounded-full border-2 border-accent-amber bg-white sm:-start-[11px] sm:top-2 sm:h-3.5 sm:w-3.5"
                                  aria-hidden
                                />
                                <p className="mono text-sm text-text-muted tabular-nums leading-relaxed sm:text-base">
                                  {when || "—"}
                                </p>
                                <p className="mt-1.5 text-base font-semibold leading-snug text-text-primary sm:mt-2 sm:text-lg">
                                  {scanEventDescription(ev)}
                                </p>
                                {loc ? (
                                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary sm:mt-2 sm:text-base">
                                    {loc}
                                  </p>
                                ) : null}
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        );
      })}

      <Card className={`${DASHBOARD_GRADIENT_CARD_CLASS} !p-0`}>
        <button
          type="button"
          onClick={() => setRawOpen((o) => !o)}
          className="box-border flex min-h-14 w-full min-w-0 items-center justify-between gap-4 text-left text-base font-semibold text-text-primary transition-colors hover:bg-[var(--selection-tint)]/30 sm:min-h-[3.25rem] sm:text-lg"
          style={DASHBOARD_CARD_INSET}
        >
          <span className="min-w-0 flex-1 truncate pr-2">Raw FedEx response (JSON)</span>
          {rawOpen ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-text-muted sm:h-6 sm:w-6" aria-hidden />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-text-muted sm:h-6 sm:w-6" aria-hidden />
          )}
        </button>
        {rawOpen ? (
          <pre className="mono max-h-[min(32rem,70vh)] overflow-auto border-t border-border-subtle !bg-white p-4 text-sm leading-relaxed text-text-secondary sm:p-6 sm:text-base">
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
      </Card>
    </div>
  );
}

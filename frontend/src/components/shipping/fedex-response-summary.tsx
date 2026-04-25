"use client";

import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_CARD_INSET,
  DASHBOARD_GRADIENT_CARD_CLASS,
  DASHBOARD_SECTION_HEADER_CLASS,
} from "@/lib/dashboardCardStyles";
import { extractFedExResponseTableRows } from "@/lib/fedexResponseDisplay";

function asRecordOrEmpty(data: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data) ? data : {};
}

export function FedExResponseSummary({ data }: { data: Record<string, unknown> }) {
  const [rawOpen, setRawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const flat = asRecordOrEmpty(data);
  const tableRows = extractFedExResponseTableRows(flat);
  const rawJson = JSON.stringify(flat, null, 2);
  const hasAnyPayload = Object.keys(flat).length > 0;

  const copyRaw = () => {
    void navigator.clipboard.writeText(rawJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
      <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
        <h3
          className="text-lg font-bold text-text-primary"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          FedEx response
        </h3>
        <p className="mt-1.5 text-sm text-text-secondary">
          Shipment details from FedEx (structured). Technical JSON is available below for support.
        </p>
      </div>
      <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
        {!hasAnyPayload ? (
          <p className="text-base text-text-muted">No FedEx response was stored for this shipment.</p>
        ) : tableRows.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border-default bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
            <table className="w-full min-w-[min(100%,20rem)] border-collapse text-left">
              <thead>
                <tr className="border-b border-border-default bg-slate-50/90">
                  <th
                    scope="col"
                    className="py-4 pl-8 pr-4 text-left text-xs font-bold uppercase tracking-wide text-text-muted sm:py-4 sm:pl-10 sm:pr-5 sm:text-sm sm:font-semibold sm:normal-case sm:tracking-normal sm:text-text-secondary"
                  >
                    Detail
                  </th>
                  <th
                    scope="col"
                    className="py-4 pl-6 pr-6 text-left text-xs font-bold uppercase tracking-wide text-text-muted sm:py-4 sm:pl-8 sm:pr-8 sm:text-sm sm:font-semibold sm:normal-case sm:tracking-normal sm:text-text-secondary"
                  >
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {tableRows.map((row, i) => (
                  <tr key={`${row.label}-${i}`} className="align-top">
                    {/*
                      Use <td role="rowheader"> instead of <th scope="row"> so dashboard globals
                      (`.admin-overview-recent-card table > tbody > tr > td { padding: … }`) apply.
                      A bare <th> in tbody keeps padding:0 from the `*` reset and ignores our Tailwind.
                    */}
                    <td
                      role="rowheader"
                      className="w-[min(12rem,38%)] max-w-[42%] text-left text-sm font-semibold leading-relaxed text-text-secondary sm:w-[min(14rem,40%)] sm:text-base"
                    >
                      {row.label}
                    </td>
                    <td className="!text-base leading-relaxed break-words text-text-primary sm:!text-lg">
                      {row.value.startsWith("http://") || row.value.startsWith("https://") ? (
                        <a
                          href={row.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-accent-blue underline decoration-accent-blue/30 underline-offset-2 hover:decoration-accent-amber"
                        >
                          {row.value}
                        </a>
                      ) : (
                        <span className="font-medium">{row.value}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hasAnyPayload ? (
          <p className="text-base text-text-muted">
            No structured FedEx details could be read from this response. Use technical JSON below or contact support
            with the raw payload.
          </p>
        ) : null}

        {hasAnyPayload ? (
          <>
            <button
              type="button"
              onClick={() => setRawOpen((o) => !o)}
              className="btn-text-wrap mt-6 flex w-full min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border-accent bg-surface-raised/50 px-4 py-3 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-accent-amber/50 hover:!bg-white hover:text-text-primary"
            >
              {rawOpen ? (
                <>
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                  Hide technical JSON
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                  Technical: raw response (JSON)
                </>
              )}
            </button>
            {rawOpen ? (
              <div className="relative mt-4 min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  className="absolute right-2 top-2 z-10 !min-h-0 border border-border-default !bg-white !px-3 !py-2 !text-sm shadow-sm"
                  onClick={copyRaw}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                  {copied ? "Copied" : "Copy"}
                </Button>
                <pre className="mono max-h-56 overflow-auto rounded-[var(--radius-md)] border border-border-default !bg-white p-4 pr-24 pt-12 text-sm leading-relaxed text-text-secondary tabular-nums">
                  {rawJson}
                </pre>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

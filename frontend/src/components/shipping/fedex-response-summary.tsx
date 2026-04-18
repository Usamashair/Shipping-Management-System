"use client";

import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") {
      out[k] = v;
    }
  }
  return out;
}

function formatSummaryValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  }
  return String(v);
}

export function FedExResponseSummary({ data }: { data: Record<string, unknown> }) {
  const [rawOpen, setRawOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const flat = typeof data === "object" && data !== null ? data : {};
  const summary = pick(flat, [
    "transactionId",
    "jobId",
    "mock",
    "mode",
    "customerTransactionId",
  ]);
  const rawJson = JSON.stringify(data, null, 2);

  const copyRaw = useCallback(() => {
    void navigator.clipboard.writeText(rawJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rawJson]);

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised ring-1 ring-white/[0.03]">
      <div className="border-b border-border-default px-5 py-3">
        <h3
          className="text-sm font-bold uppercase tracking-wide text-text-secondary"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          FedEx response
        </h3>
        <p className="mt-0.5 text-[11px] text-text-muted">Summary fields; raw payload is optional.</p>
      </div>
      <div className="p-5">
        {Object.keys(summary).length === 0 ? (
          <p className="text-sm text-text-muted">No summary fields available.</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {Object.entries(summary).map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg border border-border-default bg-surface-card/60 px-3 py-2.5"
              >
                <dt className="text-xs uppercase tracking-wider text-text-muted">{k}</dt>
                <dd className="mono mt-1 break-all text-sm text-text-primary tabular-nums">
                  {formatSummaryValue(v)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <button
          type="button"
          onClick={() => setRawOpen((o) => !o)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-accent py-2.5 text-sm font-medium text-text-muted transition-all duration-200 hover:border-accent-amber/50 hover:text-text-secondary"
        >
          {rawOpen ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden />
              Hide advanced raw JSON
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden />
              Advanced: view raw JSON
            </>
          )}
        </button>
        {rawOpen ? (
          <div className="relative mt-3">
            <Button
              type="button"
              variant="ghost"
              className="absolute right-2 top-2 z-10 border border-border-accent bg-surface-card/95 text-xs"
              onClick={copyRaw}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </Button>
            <pre className="mono max-h-56 overflow-auto rounded-lg border border-border-default bg-surface-deep p-3 pr-24 pt-10 text-xs leading-relaxed text-text-secondary tabular-nums">
              {rawJson}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { Activity, CheckCircle2, ChevronDown, ChevronUp, Copy, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

function flattenHealthPayload(data: unknown): { key: string; value: string }[] {
  if (data === null || data === undefined) return [];
  if (typeof data !== "object") {
    return [{ key: "value", value: String(data) }];
  }
  const rows: { key: string; value: string }[] = [];
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, key);
      } else if (Array.isArray(v)) {
        rows.push({ key, value: JSON.stringify(v) });
      } else {
        rows.push({ key, value: v === undefined || v === null ? "—" : String(v) });
      }
    }
  };
  walk(data as Record<string, unknown>, "");
  return rows;
}

function healthApiHost(): string {
  try {
    const base = getApiBaseUrl().replace(/\/$/, "");
    return new URL(base).host || base;
  } catch {
    return getApiBaseUrl().replace(/^https?:\/\//, "").split("/")[0] ?? "—";
  }
}

export function ApiHealthStatus() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [data, setData] = useState<unknown>(null);
  const [rawOpen, setRawOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const base = getApiBaseUrl();
    fetch(`${base.replace(/\/$/, "")}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json: unknown) => {
        setData(json);
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  const rows = useMemo(() => flattenHealthPayload(data), [data]);
  const rawJson = useMemo(
    () => (data !== null ? JSON.stringify(data, null, 2) : ""),
    [data],
  );

  const statusPill = useCallback(() => {
    if (state === "loading") {
      return (
        <span className="rounded-full bg-surface-deep px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          Checking
        </span>
      );
    }
    if (state === "error") {
      return (
        <span className="rounded-full bg-accent-red/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-red">
          Unreachable
        </span>
      );
    }
    const d = data as Record<string, unknown> | null;
    const st = typeof d?.status === "string" ? d.status : "ok";
    const ok = st === "ok";
    return (
      <span
        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
          ok ? "bg-accent-green/15 text-accent-green" : "bg-accent-amber/15 text-accent-amber-bright"
        }`}
      >
        {ok ? "Healthy" : st}
      </span>
    );
  }, [state, data]);

  const copyRaw = useCallback(() => {
    if (!rawJson) return;
    void navigator.clipboard.writeText(rawJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rawJson]);

  return (
    <div className="w-full rounded-2xl border border-border-default bg-surface-card p-5 shadow-card ring-1 ring-white/[0.04]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-amber-glow)] ring-1 ring-accent-amber/20">
          <Activity className="h-5 w-5 text-accent-amber" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text-primary">Laravel API</p>
          <p className="mono mt-0.5 truncate text-xs text-text-muted">GET /api/health · {healthApiHost()}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusPill()}
          {state === "ok" ? (
            <CheckCircle2 className="h-6 w-6 text-accent-green" aria-label="OK" />
          ) : null}
          {state === "error" ? (
            <XCircle className="h-6 w-6 text-accent-red" aria-label="Error" />
          ) : null}
        </div>
      </div>

      {state === "loading" ? (
        <p className="mt-5 text-sm text-text-secondary">Checking API…</p>
      ) : null}

      {state === "error" ? (
        <p className="mt-5 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          Could not reach the API. Start the backend (e.g.{" "}
          <code className="mono text-xs">php artisan serve</code> on port 8000) and verify{" "}
          <code className="mono text-xs">NEXT_PUBLIC_API_URL</code>.
        </p>
      ) : null}

      {state === "ok" && rows.length > 0 ? (
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {rows.map(({ key, value }) => (
            <div
              key={key}
              className="rounded-lg border border-border-default bg-surface-raised/80 px-3 py-2.5"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{key}</dt>
              <dd className="mono mt-1 break-all text-sm text-text-primary tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {state === "ok" && data !== null ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={() => setRawOpen((o) => !o)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border-accent py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
          >
            {rawOpen ? (
              <>
                <ChevronUp className="h-4 w-4" aria-hidden />
                Hide raw JSON
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" aria-hidden />
                View raw JSON
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
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy"}
              </Button>
              <pre className="mono max-h-56 overflow-auto rounded-lg border border-border-default bg-surface-deep p-3 pr-24 pt-10 text-xs leading-relaxed text-text-secondary tabular-nums">
                {rawJson}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

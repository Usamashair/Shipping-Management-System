"use client";

import Link from "next/link";
import { getApiBaseUrl } from "@/lib/api/client";

function apiHostBadge(): string {
  try {
    const u = getApiBaseUrl().replace(/\/$/, "");
    return new URL(u).host || u;
  } catch {
    const raw = process.env.NEXT_PUBLIC_API_URL ?? "";
    return raw.replace(/^https?:\/\//, "").split("/")[0] || "not configured";
  }
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  const host = apiHostBadge();

  return (
    <footer className="border-t border-border-subtle bg-surface-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-[var(--ds-section-gap)] px-[var(--ds-container-margin)] py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p
            className="text-sm font-bold text-text-primary"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            ShipFlow
          </p>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-text-muted">
            FedEx shipping, labels, and tracking when your Laravel API is configured.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          <Link href="/login" className="text-accent-blue transition-colors hover:text-accent-amber">
            Sign in
          </Link>
          <Link href="/dev/api-health" className="text-accent-blue transition-colors hover:text-accent-amber">
            API health
          </Link>
          <span className="text-text-muted">Privacy</span>
        </nav>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <span
            className="rounded-full border border-border-accent bg-surface-card-hover px-3 py-1 text-[11px] text-text-muted"
            title="API host from NEXT_PUBLIC_API_URL (no secrets)"
          >
            API: <span className="mono font-medium text-text-secondary">{host}</span>
          </span>
          <p className="text-xs text-text-muted">© {year} ShipFlow</p>
        </div>
      </div>
    </footer>
  );
}

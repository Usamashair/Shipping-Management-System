import { Activity, Home, LogIn, Package } from "lucide-react";
import Link from "next/link";

const linkClass =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-surface-card-hover hover:text-text-primary";

export function MarketingSidebar() {
  return (
    <aside
      className="relative z-20 hidden w-56 shrink-0 flex-col border-r border-border-default bg-surface-raised/95 backdrop-blur-md md:flex lg:w-60"
      aria-label="Site"
    >
      <div className="border-b border-border-default p-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-amber-glow)] ring-1 ring-accent-amber/25">
            <Package className="h-5 w-5 text-accent-amber" aria-hidden />
          </span>
          <span
            className="text-lg font-bold tracking-tight text-text-primary"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            ShipFlow
          </span>
        </Link>
        <p className="mt-3 text-xs leading-snug text-text-muted">Shipping operations for teams.</p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        <Link href="/" className={`${linkClass} bg-[var(--accent-amber-glow)] text-accent-amber-bright`} aria-current="page">
          <Home className="h-5 w-5 shrink-0 text-accent-amber" aria-hidden />
          Overview
        </Link>
        <Link href="/login" className={linkClass}>
          <LogIn className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
          Sign in
        </Link>
        <Link href="/dev/api-health" className={linkClass}>
          <Activity className="h-5 w-5 shrink-0 text-text-muted" aria-hidden />
          API health
        </Link>
      </nav>
    </aside>
  );
}

"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-subtle)",
        padding: "16px var(--ds-container-margin)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 7L12 3L4 7M20 7V17L12 21M20 7L12 11M4 7V17L12 21M4 7L12 11M12 11V21"
            stroke="var(--brand-primary)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
          © 2026 ShipFlow. Powered by FedEx API.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        <Link href="#" className="transition-colors hover:text-[var(--brand-primary)]">
          Docs
        </Link>
        <span aria-hidden>·</span>
        <Link href="#" className="transition-colors hover:text-[var(--brand-primary)]">
          Support
        </Link>
        <span aria-hidden>·</span>
        <Link href="/dev/api-health" className="transition-colors hover:text-[var(--brand-primary)]">
          API Status
        </Link>
      </div>

      <span
        style={{
          background: "var(--selection-tint)",
          color: "var(--brand-primary)",
          border: "1px solid var(--border-accent)",
          borderRadius: 4,
          padding: "2px 8px",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        FedEx Integrated
      </span>
    </footer>
  );
}

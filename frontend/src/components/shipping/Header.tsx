"use client";

import { Bell, ChevronDown, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth/context";

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/admin" || pathname === "/admin/") return "Dashboard";
  if (pathname.startsWith("/admin/shipments/new")) return "New Shipment";
  if (pathname.startsWith("/admin/shipments")) return "Shipments";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/settings")) return "Settings";
  if (pathname.startsWith("/customer/shipments/new")) return "New Shipment";
  if (pathname.startsWith("/customer/shipments")) return "My Shipments";
  if (pathname.startsWith("/customer/tracking")) return "Track shipments";
  if (pathname.startsWith("/customer/profile")) return "Profile";
  if (pathname.startsWith("/dev/api-health")) return "API Health";
  return "ShipFlow";
}

export function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const pageTitle = pageTitleFromPath(pathname);
  const [searchFocus, setSearchFocus] = useState(false);
  const displayName = user?.name?.trim() || user?.email || "User";

  return (
    <header
      className="dashboard-header"
      style={{
        height: "var(--header-height)",
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 var(--ds-container-margin)`,
        gap: 16,
        boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="min-w-0">
        <h1
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          {pageTitle}
        </h1>
        <p style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
          ShipFlow / {pageTitle}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="relative hidden min-w-0 sm:block">
          <Search
            size={16}
            aria-hidden
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="search"
            placeholder="Search…"
            aria-label="Search"
            className="header-search-input placeholder:text-text-muted"
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            style={{
              width: searchFocus ? 280 : 220,
              maxWidth: "min(280px, 36vw)",
              height: 40,
              background: "var(--bg-card)",
              border: `1px solid ${searchFocus ? "var(--brand-primary)" : "var(--border-default)"}`,
              borderRadius: 9999,
              color: "var(--text-primary)",
              outline: "none",
              boxShadow: searchFocus ? "0 0 0 3px var(--amber-glow)" : "none",
              transition: "width 0.2s ease, border-color 0.18s ease, box-shadow 0.18s ease",
            }}
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="icon-only-btn relative border-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "border-color 0.18s ease, color 0.18s ease, background 0.18s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.background = "var(--bg-card-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.background = "var(--bg-card)";
          }}
        >
          <Bell size={18} aria-hidden />
          <span
            className="absolute right-2 top-2 h-2 w-2 rounded-full"
            style={{ background: "var(--brand-primary)" }}
            aria-hidden
          />
        </button>

        <div
          style={{
            height: 40,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            padding: "0 12px 0 10px",
            gap: 8,
            display: "none",
            alignItems: "center",
          }}
          className="sm:flex"
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--selection-tint)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand-primary)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span
            className="max-w-[140px] truncate"
            style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}
          >
            {displayName}
          </span>
          <ChevronDown size={14} style={{ color: "var(--text-muted)" }} aria-hidden />
        </div>
      </div>
    </header>
  );
}

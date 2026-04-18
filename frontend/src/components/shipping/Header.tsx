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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "var(--header-height)",
        background: "rgba(6,10,16,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        zIndex: 99,
      }}
      className="md:left-[var(--sidebar-width)]"
    >
      <div>
        <h1
          style={{
            fontFamily: "Outfit, var(--font-display), sans-serif",
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          {pageTitle}
        </h1>
        <p style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
          ShipFlow / {pageTitle}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="relative hidden sm:block">
          <Search
            size={15}
            aria-hidden
            style={{
              position: "absolute",
              left: 12,
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
            className="placeholder:text-text-muted"
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            style={{
              width: searchFocus ? 260 : 200,
              height: 36,
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              padding: "0 12px 0 36px",
              color: "var(--text-primary)",
              fontSize: 13,
              outline: "none",
              transition: "width 0.2s ease, border-color 0.18s ease, box-shadow 0.18s ease",
              ...(searchFocus
                ? {
                    borderColor: "var(--amber)",
                    boxShadow: "0 0 0 3px var(--amber-dim)",
                  }
                : {}),
            }}
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative border-0"
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "border-color 0.18s ease, color 0.18s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }}
        >
          <Bell size={16} aria-hidden />
        </button>

        <div
          style={{
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-default)",
            padding: "0 12px",
            gap: 8,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--amber), var(--amber-light))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{displayName}</span>
          <ChevronDown size={12} style={{ color: "var(--text-muted)" }} aria-hidden />
        </div>
      </div>
    </header>
  );
}

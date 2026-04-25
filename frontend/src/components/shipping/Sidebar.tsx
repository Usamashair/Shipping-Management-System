"use client";

import { useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Search,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { useProfile } from "@/lib/context/ProfileContext";

type NavItem = { href: string; icon: LucideIcon; label: string };

function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (
    href !== "/admin" &&
    href !== "/customer/shipments" &&
    href !== "/customer/tracking" &&
    href !== "/customer/profile" &&
    pathname.startsWith(href)
  ) {
    return true;
  }
  return false;
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(pathname, item.href);
  const [hover, setHover] = useState(false);

  return (
    <Link
      href={item.href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        minHeight: "40px",
        padding: "10px 16px",
        margin: "2px 10px",
        borderRadius: "var(--radius-md)",
        fontSize: "14px",
        fontWeight: 500,
        textDecoration: "none",
        transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease",
        borderLeft: active ? "4px solid var(--selection-bar)" : "4px solid transparent",
        color: active ? "var(--brand-primary)" : hover ? "var(--text-primary)" : "var(--text-secondary)",
        background: active ? "var(--selection-tint)" : hover ? "var(--bg-card-hover)" : "transparent",
      }}
    >
      <item.icon
        size={20}
        strokeWidth={active ? 2 : 1.75}
        style={{
          flexShrink: 0,
          color: active ? "var(--brand-primary)" : "var(--text-muted)",
        }}
        aria-hidden
      />
      <span>{item.label}</span>
    </Link>
  );
}

function MobileNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      title={item.label}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium no-underline"
      style={{
        color: active ? "var(--brand-primary)" : "var(--text-secondary)",
      }}
    >
      <item.icon size={20} strokeWidth={active ? 2.25 : 2} aria-hidden />
      <span className="max-w-[72px] truncate">{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { profile, profileLoading } = useProfile();

  const adminNav: NavItem[] = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/shipments", icon: Package, label: "Shipments" },
    { href: "/admin/users", icon: Users, label: "Users" },
    { href: "/admin/settings", icon: Settings, label: "Settings" },
    { href: "/dev/api-health", icon: Activity, label: "API Health" },
  ];

  const customerNav: NavItem[] = [
    { href: "/customer/shipments", icon: Package, label: "My Shipments" },
    { href: "/customer/profile", icon: UserCircle, label: "My Profile" },
    { href: "/customer/tracking", icon: Search, label: "Track" },
    { href: "/customer/shipments/new", icon: PlusCircle, label: "New Shipment" },
  ];

  const items = user?.role === "admin" ? adminNav : customerNav;
  const isAdmin = user?.role === "admin";
  const displayName = user?.name?.trim() || user?.email || "User";

  const hasAddr = Boolean(profile?.has_address ?? user?.has_address);
  const addressVerified = Boolean(
    profile?.address_fedex_verified ?? user?.address_fedex_verified,
  );
  let addressStatusLine: string;
  if (isAdmin) {
    addressStatusLine = "Administrator";
  } else if (profileLoading && user?.has_address == null) {
    addressStatusLine = "Loading address…";
  } else if (!hasAddr) {
    addressStatusLine = "No saved address";
  } else if (addressVerified) {
    addressStatusLine = "Address verified";
  } else {
    addressStatusLine = "Address saved";
  }

  const badgeStyle: CSSProperties = {
    background: "var(--selection-tint)",
    color: "var(--brand-primary)",
    border: "1px solid var(--border-accent)",
  };

  return (
    <>
      <aside
        className="hidden flex-col md:flex"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "var(--sidebar-width)",
          height: "100vh",
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          zIndex: 100,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div
          style={{
            height: "var(--header-height)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 var(--ds-card-padding)",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{ animation: "float 3s ease-in-out infinite" }}
          >
            <path
              d="M20 7L12 3L4 7M20 7V17L12 21M20 7L12 11M4 7V17L12 21M4 7L12 11M12 11V21"
              stroke="var(--brand-primary)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-display), sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            ShipFlow
          </span>
        </div>

        <div style={{ padding: "16px var(--ds-card-padding) 12px" }}>
          <span
            style={{
              borderRadius: 9999,
              padding: "6px 14px",
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              ...badgeStyle,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "currentColor",
              }}
            />
            {isAdmin ? "Admin" : "Customer"}
          </span>
        </div>

        <div
          style={{
            padding: "8px var(--ds-card-padding) 8px",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
          }}
        >
          Menu
        </div>

        <nav className="flex flex-col pb-2">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            margin: "var(--space-4)",
            padding: "var(--space-4)",
            background: "var(--bg-card-hover)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--selection-tint)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--brand-primary)",
              fontWeight: 700,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{addressStatusLine}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Log out"
            className="icon-only-btn border-0 bg-transparent p-0"
            style={{
              marginLeft: "auto",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--accent-red)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[101] flex h-[60px] items-stretch border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] md:hidden"
        aria-label="Primary"
      >
        {items.map((item) => (
          <MobileNavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </>
  );
}

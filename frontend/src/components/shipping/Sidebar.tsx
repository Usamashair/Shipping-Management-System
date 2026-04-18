"use client";

import { useState, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  LayoutDashboard,
  LogOut,
  Package,
  PlusCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

type NavItem = { href: string; icon: LucideIcon; label: string };

function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== "/admin" && href !== "/customer/shipments" && pathname.startsWith(href)) {
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
        padding: "10px 20px",
        margin: "2px 10px",
        borderRadius: "var(--radius-md)",
        fontSize: "14px",
        fontWeight: 500,
        textDecoration: "none",
        transition: "all 0.18s ease",
        color: active ? "var(--amber)" : hover ? "var(--text-primary)" : "var(--text-secondary)",
        background: active ? "var(--amber-dim)" : hover ? "var(--bg-card)" : "transparent",
        border: active ? "1px solid var(--border-accent)" : "1px solid transparent",
      }}
    >
      <item.icon size={17} style={{ flexShrink: 0 }} aria-hidden />
      <span>{item.label}</span>
      {active ? (
        <div
          style={{
            marginLeft: "auto",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--amber)",
          }}
        />
      ) : null}
    </Link>
  );
}

function MobileNavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      title={item.label}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium no-underline"
      style={{
        color: active ? "var(--amber)" : "var(--text-secondary)",
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

  const adminNav: NavItem[] = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/shipments", icon: Package, label: "Shipments" },
    { href: "/admin/users", icon: Users, label: "Users" },
    { href: "/dev/api-health", icon: Activity, label: "API Health" },
  ];

  const customerNav: NavItem[] = [
    { href: "/customer/shipments", icon: Package, label: "My Shipments" },
    { href: "/customer/shipments/new", icon: PlusCircle, label: "New Shipment" },
  ];

  const items = user?.role === "admin" ? adminNav : customerNav;
  const isAdmin = user?.role === "admin";
  const displayName = user?.name?.trim() || user?.email || "User";

  const badgeStyle: CSSProperties = isAdmin
    ? {
        background: "var(--amber-dim)",
        color: "var(--amber)",
        border: "1px solid var(--border-accent)",
      }
    : {
        background: "var(--blue-dim)",
        color: "var(--blue)",
        border: "1px solid rgba(59,130,246,0.3)",
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
            padding: "0 20px",
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
              stroke="var(--amber)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "Outfit, var(--font-display), sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--text-primary)",
              marginLeft: 10,
            }}
          >
            ShipFlow
          </span>
        </div>

        <div style={{ padding: "16px 20px 8px" }}>
          <span
            style={{
              borderRadius: 20,
              padding: "3px 10px",
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
            padding: "8px 20px 6px",
            fontSize: 10,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--text-muted)",
          }}
        >
          MENU
        </div>

        <nav className="flex flex-col">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div
          style={{
            margin: 12,
            padding: 12,
            background: "var(--bg-card)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: isAdmin
                ? "linear-gradient(135deg, var(--amber), var(--amber-light))"
                : "linear-gradient(135deg, var(--blue), #60a5fa)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
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
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{isAdmin ? "Administrator" : "Customer"}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Log out"
            className="border-0 bg-transparent p-0"
            style={{
              marginLeft: "auto",
              color: "var(--text-muted)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--red)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <LogOut size={16} />
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

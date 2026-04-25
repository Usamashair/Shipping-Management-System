"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  LogOut,
  MapPin,
  Menu,
  Package,
  PlusCircle,
  Search,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DashboardFooterBar } from "@/components/shipping/dashboard-footer-bar";
import { useAuth } from "@/lib/auth/context";

export type AppShellNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Group label shown once above the first item in the group */
  section?: string;
};

type AppShellProps = {
  portal: "admin" | "customer";
  nav: AppShellNavItem[];
  children: ReactNode;
  /** Optional controlled search (e.g. shipment list filters) */
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
};

function titleFromPath(pathname: string, portal: "admin" | "customer"): string {
  if (pathname === "/admin" || pathname === "/admin/") return "Overview";
  if (pathname.startsWith("/admin/users/new")) return "New user";
  if (pathname.match(/^\/admin\/users\/\d+\/edit/)) return "Edit user";
  if (pathname.startsWith("/admin/users/")) return "User";
  if (pathname.startsWith("/admin/shipments/new")) return "New shipment";
  if (pathname.match(/^\/admin\/shipments\/\d+\/status/)) return "Update status";
  if (pathname.startsWith("/admin/shipments/")) return "Shipment";
  if (pathname.startsWith("/admin/shipments")) return "Shipments";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/settings")) return "Settings";
  if (pathname === "/customer/shipments/new") return "New shipment";
  if (pathname.startsWith("/customer/shipments/")) return "Shipment";
  if (pathname.startsWith("/customer/shipments")) return "My shipments";
  if (pathname.startsWith("/customer/profile")) return "Profile";
  if (pathname.startsWith("/dev/api-health")) return "API health";
  return portal === "admin" ? "Admin" : "Customer";
}

/** Secondary breadcrumb line (path-based; no store access). */
function breadcrumbFromPath(pathname: string, portal: "admin" | "customer"): string | null {
  const shipMatch = pathname.match(/^\/(admin|customer)\/shipments\/(\d+)(?:\/(status))?$/);
  if (shipMatch) {
    const id = shipMatch[2];
    const tail = shipMatch[3] === "status" ? " · Update status" : "";
    return portal === "admin" ? `Shipments · #${id}${tail}` : `My shipments · #${id}${tail}`;
  }
  if (pathname.match(/^\/admin\/users\/(\d+)\/edit$/)) {
    const id = pathname.match(/^\/admin\/users\/(\d+)\/edit$/)?.[1];
    return id ? `Users · #${id} · Edit` : "Users · Edit";
  }
  const userMatch = pathname.match(/^\/admin\/users\/(\d+)$/);
  if (userMatch) return `Users · #${userMatch[1]}`;
  if (pathname.startsWith("/admin/users/new")) return "Users · New";
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ShellNavLinks({
  nav,
  isActive,
  mobile = false,
}: {
  nav: AppShellNavItem[];
  isActive: (href: string) => boolean;
  mobile?: boolean;
}) {
  return (
    <ul className={`flex flex-col gap-0.5 ${mobile ? "p-3" : "p-2"}`}>
      {nav.map((item, idx) => {
        const prev = nav[idx - 1];
        const showSection = Boolean(item.section && item.section !== prev?.section);
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Fragment key={`${item.href}-${item.label}`}>
            {showSection ? (
              <li className="list-none px-3 pb-1 pt-3 first:pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  {item.section}
                </p>
              </li>
            ) : null}
            <li>
              <Link
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ease-out ${
                  active
                    ? "border-l-[4px] border-[var(--brand-primary)] bg-[var(--selection-tint)] text-[var(--brand-primary)]"
                    : "border-l-[4px] border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${active ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"}`}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}

export function AppShell({
  portal,
  nav,
  children,
  searchQuery,
  onSearchChange,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const pageTitle = useMemo(
    () => titleFromPath(pathname, portal),
    [pathname, portal],
  );

  const breadcrumb = useMemo(
    () => breadcrumbFromPath(pathname, portal),
    [pathname, portal],
  );

  useEffect(() => {
    queueMicrotask(() => setMobileOpen(false));
  }, [pathname]);

  const isActive = useCallback(
    (href: string) =>
      href === "/admin" || href === "/customer/shipments"
        ? pathname === href || pathname === `${href}/`
        : pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  return (
    <div className="min-h-screen bg-surface-deep text-text-primary">
      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-full w-[var(--sidebar-width)] flex-col border-r border-border-subtle bg-surface-card md:flex`}
        aria-label="Main navigation"
      >
        <div className="border-b border-border-default px-4 py-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--selection-tint)]">
              <Package
                className="h-5 w-5 text-accent-amber animate-float motion-reduce:animate-none"
                aria-hidden
              />
            </span>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display), sans-serif" }}>
              ShipFlow
            </span>
          </Link>
          <div className="mt-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                portal === "admin"
                  ? "bg-[var(--selection-tint)] text-[var(--brand-primary)]"
                  : "bg-[var(--blue-dim)] text-[var(--accent-blue)]"
              }`}
            >
              {portal === "admin" ? "Admin panel" : "Customer portal"}
            </span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto">
          <ShellNavLinks nav={nav} isActive={isActive} />
        </nav>
        <div className="border-t border-border-default p-4">
          <div className="mb-3 flex justify-center gap-1 opacity-40" aria-hidden>
            <MapPin className="h-3 w-3 text-accent-amber animate-pulse-dot motion-reduce:animate-none" />
            <Package className="h-4 w-4 text-[var(--text-muted)] animate-float motion-reduce:animate-none" />
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-[var(--selection-tint)] text-xs font-semibold text-accent-amber">
                {initials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  {user.name}
                </p>
                <p className="truncate text-xs capitalize text-text-muted">
                  {user.role}
                </p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace("/login");
              router.refresh();
            }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border-default py-2 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-[var(--brand-primary)] hover:text-text-primary"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Log out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
        <div
          className={`absolute left-0 top-0 flex h-full w-[var(--sidebar-width)] max-w-[85vw] flex-col bg-surface-card shadow-card transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-border-default px-3 py-3">
            <span className="text-base font-bold" style={{ fontFamily: "var(--font-display), sans-serif" }}>
              ShipFlow
            </span>
            <button
              type="button"
              className="rounded-lg p-2 text-text-secondary hover:bg-surface-card-hover hover:text-text-primary"
              onClick={() => setMobileOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto">
            <ShellNavLinks nav={nav} isActive={isActive} mobile />
          </nav>
        </div>
      </div>

      {/* Top header */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center border-b border-border-subtle bg-[var(--header-bg)] md:left-[var(--sidebar-width)]">
        <div className="flex w-full items-center gap-3 px-[var(--ds-container-margin)]">
          <button
            type="button"
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-card-hover hover:text-text-primary md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-xl font-bold tracking-tight text-text-primary md:text-2xl"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              {pageTitle}
            </h1>
            {breadcrumb ? (
              <p className="truncate text-xs font-medium text-text-muted md:text-sm">{breadcrumb}</p>
            ) : null}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="relative rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-card-hover hover:text-text-primary"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-amber" />
            </button>
            {onSearchChange ? (
              <div
                className={`relative overflow-hidden transition-all duration-300 ease-out ${
                  searchFocused ? "w-52" : "w-36"
                }`}
              >
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  placeholder="Search…"
                  value={searchQuery ?? ""}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="w-full rounded-full border border-border-default bg-surface-card py-2 pl-8 pr-3 text-sm text-text-primary placeholder:text-text-muted transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                />
              </div>
            ) : null}
          </div>
          {user ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-accent bg-surface-card text-xs font-semibold md:hidden">
              {initials(user.name)}
            </div>
          ) : null}
        </div>
      </header>

      {/* Main */}
      <main className="min-h-screen pb-20 pt-16 md:pb-0 md:pl-[var(--sidebar-width)]">
        <div className="relative flex min-h-[calc(100vh-4rem)] flex-col">
          <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-[var(--ds-container-margin)] py-[var(--ds-container-margin)]">
            <div className="main-stage-animate motion-reduce:opacity-100 motion-reduce:transform-none flex-1">
              {children}
            </div>
            <DashboardFooterBar user={user} portal={portal} />
          </div>
        </div>
      </main>

      {/* Mobile bottom nav (customer) */}
      {portal === "customer" ? (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border-default bg-[var(--header-bg)] backdrop-blur-xl md:hidden"
          aria-label="Quick navigation"
        >
          <Link
            href="/customer/shipments"
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium ${
              pathname.startsWith("/customer/shipments") &&
              !pathname.includes("/new") &&
              !pathname.match(/\/\d+/)
                ? "text-accent-amber"
                : "text-text-muted"
            }`}
          >
            <Package className="h-5 w-5" />
            Shipments
          </Link>
          <Link
            href="/customer/shipments/new"
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium ${
              pathname === "/customer/shipments/new"
                ? "text-accent-amber"
                : "text-text-muted"
            }`}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-amber text-white">
              <PlusCircle className="h-4 w-4" />
            </span>
            New
          </Link>
          <Link
            href="/customer/profile"
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium ${
              pathname.startsWith("/customer/profile")
                ? "text-accent-amber"
                : "text-text-muted"
            }`}
          >
            <User className="h-5 w-5" />
            Profile
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

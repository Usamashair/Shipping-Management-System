"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Boxes, CircleCheck, CircleX, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { StatusBadge } from "@/components/shipping/status-badge";
import { Card } from "@/components/ui/card";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";

function useCountUp(target: number, durationMs = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      queueMicrotask(() => setV(target));
      return;
    }
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min((t - start) / durationMs, 1);
      setV(Math.floor(target * p));
      if (p < 1) requestAnimationFrame(step);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, durationMs]);
  return v;
}

function StatCard({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: number;
  trend: { dir: "up" | "down"; pct: string };
  icon: LucideIcon;
}) {
  const display = useCountUp(value);

  return (
    <div
      className="group relative w-full overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent hover:ring-accent-amber/10 motion-reduce:hover:shadow-card"
      style={{ boxSizing: "border-box", boxShadow: "var(--shadow-card)" }}
    >
      {/* Gradient clipped to radius only — outer card stays overflow-visible for text/descenders */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, var(--selection-tint) 42%, rgba(77, 209, 197, 0.2) 100%)",
        }}
        aria-hidden
      />

      {/* Faint watermark: upper-center; does not replace the visible header icon */}
      <div
        className="pointer-events-none absolute left-[var(--space-8)] right-[var(--space-8)] top-0 z-[1] flex justify-center pt-6 sm:pt-8"
        style={{ height: "58%" }}
        aria-hidden
      >
        <Icon
          strokeWidth={1}
          className="-translate-y-1 text-accent-amber sm:-translate-y-0"
          style={{
            width: "min(7.5rem, 42%)",
            height: "min(7.5rem, 42%)",
            opacity: 0.09,
            maxHeight: "100%",
          }}
        />
      </div>

      <div
        className="relative z-10 flex min-h-0 flex-col gap-3 text-left"
        style={{
          isolation: "isolate",
          padding: "var(--ds-card-padding) var(--space-8)",
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-text-secondary sm:text-sm">
            {label}
          </p>
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] bg-[var(--accent-amber-glow)] ring-1 ring-accent-amber/25"
            aria-hidden
          >
            <Icon className="h-5 w-5 text-accent-amber" strokeWidth={2} />
          </div>
        </div>
        <p
          className="break-words text-3xl font-bold tabular-nums leading-tight tracking-tight text-accent-amber sm:text-4xl"
          style={{ fontFamily: "var(--font-mono), monospace" }}
        >
          {display}
        </p>

        {/* Footer strip: full width of padded content only — no negative margins (avoids bleeding outside card) */}
        <div className="relative z-20 mt-3 w-full min-w-0 border-t border-border-subtle bg-white/90 pt-3 pb-2 backdrop-blur-[2px] sm:mt-4 sm:pt-3.5 sm:pb-2.5">
          <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
            <div
              className="flex min-h-7 min-w-0 items-end justify-start gap-0.5 overflow-x-auto sm:pb-0"
              aria-hidden
            >
              {[12, 20, 14, 24, 16, 22, 15].map((px, i) => (
                <span
                  key={i}
                  className="w-1 shrink-0 rounded-sm bg-accent-amber/45 transition-[height,background-color] duration-300 motion-safe:group-hover:bg-accent-amber/65"
                  style={{ height: `${px}px` }}
                />
              ))}
            </div>
            <p
              className={`flex min-w-0 shrink-0 flex-wrap items-center justify-start gap-1.5 self-end text-left text-sm font-semibold leading-relaxed tabular-nums sm:flex-nowrap sm:justify-end sm:self-center sm:text-right sm:text-base ${
                trend.dir === "up" ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {trend.dir === "up" ? (
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <ArrowDownRight className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 whitespace-normal sm:whitespace-nowrap">
                {trend.pct}{" "}
                <span className="font-medium text-text-secondary">vs last week</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const { listUsers, listShipments, refreshUsers, refreshShipments } = useApiStore();
  const users = listUsers();
  const shipments = listShipments({ scope: "all" });

  useEffect(() => {
    void refreshUsers();
    void refreshShipments("all");
  }, [refreshUsers, refreshShipments]);

  const stats = useMemo(() => {
    const total = shipments.length;
    const active = shipments.filter((s) =>
      ["pending", "in_transit", "label_created"].includes(s.status),
    ).length;
    const delivered = shipments.filter((s) => s.status === "delivered").length;
    const cancelled = shipments.filter((s) => s.status === "cancelled").length;
    return { total, active, delivered, cancelled };
  }, [shipments]);

  const recent = useMemo(
    () => [...shipments].sort((a, b) => b.id - a.id).slice(0, 6),
    [shipments],
  );

  const activity = useMemo(() => {
    return [...shipments]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8)
      .map((s) => ({
        id: s.id,
        line: `${s.tracking_number} · ${s.status.replace(/_/g, " ")}`,
        sub: `${s.receiver_details.city} · ${new Date(s.updated_at).toLocaleString()}`,
      }));
  }, [shipments]);

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-[var(--space-8)] pb-[var(--space-8)]">
      <div
        className="admin-dash-section admin-dashboard-surface-bg overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent"
        style={{
          padding: "var(--ds-card-padding) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          animationDelay: "0ms",
        }}
      >
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary sm:text-sm">Welcome back</p>
          <h2
            className="mt-2 text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            {user?.name ? `Hello, ${user.name}` : "Operations overview"}
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
            <span className="tabular-nums font-medium text-text-primary">{users.length}</span> users ·{" "}
            <span className="tabular-nums font-medium text-text-primary">{shipments.length}</span> shipments in store
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Link
            href="/admin/shipments/new"
            className="admin-dashboard-cta rounded-[var(--radius-md)] bg-accent-amber text-base font-semibold text-white transition-[filter,transform] duration-200 motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98]"
          >
            New shipment
          </Link>
          <Link
            href="/admin/shipments"
            className="admin-dashboard-cta rounded-[var(--radius-md)] border border-border-accent text-base font-semibold text-text-secondary transition-colors duration-200 hover:border-accent-amber hover:text-text-primary"
          >
            All shipments
          </Link>
        </div>
      </div>

      <section
        aria-label="Key metrics"
        className="admin-dash-section grid gap-[var(--space-6)]"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          animationDelay: "70ms",
        }}
      >
        <StatCard label="Total shipments" value={stats.total} trend={{ dir: "up", pct: "+12%" }} icon={Boxes} />
        <StatCard label="Active" value={stats.active} trend={{ dir: "up", pct: "+4%" }} icon={Truck} />
        <StatCard label="Delivered" value={stats.delivered} trend={{ dir: "up", pct: "+9%" }} icon={CircleCheck} />
        <StatCard label="Cancelled" value={stats.cancelled} trend={{ dir: "down", pct: "-2%" }} icon={CircleX} />
      </section>

      <div
        className="admin-dash-section min-h-0 w-full min-w-0 flex-1"
        style={{ animationDelay: "140ms" }}
      >
        <Card className="admin-overview-recent-card !border-border-subtle !bg-[linear-gradient(135deg,#ffffff_0%,var(--selection-tint)_42%,rgba(77,209,197,0.2)_100%)] !p-0 !shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent hover:ring-accent-amber/10">
          <div className="admin-recent-shipments-header flex flex-col gap-3 border-b border-border-subtle sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 text-left">
              <h2
                className="text-lg font-bold text-text-primary sm:text-xl"
                style={{ fontFamily: "var(--font-display), sans-serif" }}
              >
                Recent shipments
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">Latest six by ID</p>
            </div>
            <Link
              href="/admin/shipments"
              className="inline-flex shrink-0 items-center gap-1 self-start text-base font-semibold text-accent-amber transition-colors hover:text-accent-amber-bright sm:self-auto"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-hidden rounded-b-2xl">
            <DataTable
              embedded
              cellPadClass="px-[var(--space-8)]"
              columns={[
                { key: "tracking", label: "Tracking ID" },
                { key: "to", label: "Recipient" },
                { key: "status", label: "Status" },
                { key: "date", label: "Date" },
                { key: "actions", label: "", className: "w-28 text-right" },
              ]}
              pageSize={100}
              emptyMessage="No shipments in the system yet."
              emptyCta={
                <Link
                  href="/admin/shipments/new"
                  className="admin-dashboard-cta rounded-[var(--radius-md)] bg-accent-amber text-sm font-semibold text-white"
                >
                  Create shipment
                </Link>
              }
            >
              {recent.map((s) => (
                <tr key={s.id}>
                  <td className="mono py-3.5 text-sm tabular-nums text-accent-amber">
                    {s.tracking_number}
                  </td>
                  <td className="py-3.5 text-sm leading-snug text-text-primary">
                    {s.receiver_details.name}, {s.receiver_details.city}
                  </td>
                  <td className="py-3.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="mono py-3.5 text-xs tabular-nums text-text-muted">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 text-right">
                    <Link
                      href={`/admin/shipments/${s.id}`}
                      className="inline-flex items-center justify-end rounded-md px-2 py-1 text-sm font-semibold text-accent-blue transition-colors hover:bg-accent-blue-glow/30 hover:text-accent-amber"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>
      </div>

      <section
        aria-label="Activity"
        className="admin-dash-section w-full min-w-0"
        style={{ animationDelay: "200ms" }}
      >
        <Card className="admin-overview-activity-card !border-border-subtle !bg-[linear-gradient(135deg,#ffffff_0%,var(--selection-tint)_42%,rgba(77,209,197,0.2)_100%)] !p-0 !shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent hover:ring-accent-amber/10">
          <div className="admin-activity-card-header border-b border-border-subtle text-left">
            <h2
              className="text-lg font-bold text-text-primary sm:text-xl"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              Activity
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">Latest shipment updates</p>
          </div>
          <ul className="admin-activity-card-list">
            {activity.length === 0 ? (
              <li className="rounded-lg border border-dashed border-border-subtle py-10 text-center text-sm text-text-muted">
                No activity yet.
              </li>
            ) : (
              activity.map((item, i) => (
                <li
                  key={item.id}
                  className="admin-activity-item admin-activity-row opacity-0 transition-colors duration-200 motion-safe:hover:bg-[var(--bg-card-hover)]"
                  style={{
                    animation: "fadeSlideIn 0.45s ease forwards",
                    animationDelay: `${220 + i * 45}ms`,
                  }}
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-amber ring-2 ring-white" />
                  <div className="min-w-0 flex-1 pb-0.5">
                    <p className="text-sm font-semibold leading-snug text-text-primary">{item.line}</p>
                    <p className="mono mt-1.5 text-xs leading-relaxed text-text-muted tabular-nums">{item.sub}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </section>
    </div>
  );
}

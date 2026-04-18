"use client";

import { ArrowDownRight, ArrowUpRight, Package, Truck } from "lucide-react";
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
  icon: typeof Package;
}) {
  const display = useCountUp(value);
  return (
    <div className="flex min-h-[132px] flex-col justify-between rounded-xl border border-border-default bg-gradient-to-br from-surface-card to-surface-raised p-5 shadow-card ring-1 ring-white/[0.04] transition-all duration-200 hover:border-border-accent hover:shadow-glow motion-reduce:hover:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
          <p
            className="mt-2 text-3xl font-bold tabular-nums text-accent-amber sm:text-4xl"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            {display}
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-amber-glow)] ring-1 ring-accent-amber/20">
          <Icon className="h-5 w-5 text-accent-amber" aria-hidden />
        </div>
      </div>
      <div className="mt-3 flex h-7 items-end gap-0.5" aria-hidden>
        {[12, 20, 14, 24, 16, 22, 15].map((px, i) => (
          <span
            key={i}
            className="w-1 rounded-sm bg-accent-amber/40"
            style={{ height: `${px}px` }}
          />
        ))}
      </div>
      <p
        className={`mt-2 flex items-center gap-1 text-xs font-medium tabular-nums ${
          trend.dir === "up" ? "text-accent-green" : "text-accent-red"
        }`}
      >
        {trend.dir === "up" ? (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        {trend.pct} vs last week
      </p>
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
    <div className="flex min-h-[calc(100vh-5rem)] flex-col gap-8 pb-8">
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(245,158,11,0.05) 100%)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Welcome back</p>
          <h2
            className="mt-2 text-xl font-bold tracking-tight text-text-primary md:text-2xl"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            {user?.name ? `Hello, ${user.name}` : "Operations overview"}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-text-secondary">
            <span className="tabular-nums font-medium text-text-primary">{users.length}</span> users ·{" "}
            <span className="tabular-nums font-medium text-text-primary">{shipments.length}</span> shipments in store
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/shipments/new"
            className="inline-flex items-center justify-center rounded-lg bg-accent-amber px-4 py-2.5 text-sm font-semibold text-surface-deep transition-all duration-200 hover:brightness-110"
          >
            New shipment
          </Link>
          <Link
            href="/admin/shipments"
            className="inline-flex items-center justify-center rounded-lg border border-border-accent px-4 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
          >
            All shipments
          </Link>
        </div>
      </div>

      {/* Stats: always 4 equal columns from lg up; 2×2 on small screens */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total shipments" value={stats.total} trend={{ dir: "up", pct: "+12%" }} icon={Package} />
        <StatCard label="Active" value={stats.active} trend={{ dir: "up", pct: "+4%" }} icon={Truck} />
        <StatCard label="Delivered" value={stats.delivered} trend={{ dir: "up", pct: "+9%" }} icon={Package} />
        <StatCard label="Cancelled" value={stats.cancelled} trend={{ dir: "down", pct: "-2%" }} icon={Package} />
      </section>

      {/* Main + sidebar: 12-col grid, aligned stretch */}
      <div className="grid flex-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="flex min-h-0 flex-col gap-6 lg:col-span-8">
          <Card className="!p-0 !shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-5 py-4 md:px-6">
              <div>
                <h2
                  className="text-lg font-bold text-text-primary md:text-xl"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  Recent shipments
                </h2>
                <p className="mt-0.5 text-xs text-text-muted">Latest six by ID</p>
              </div>
              <Link
                href="/admin/shipments"
                className="text-sm font-semibold text-accent-amber transition-colors hover:text-accent-amber-bright"
              >
                View all →
              </Link>
            </div>
            <div className="overflow-hidden rounded-b-2xl">
              <DataTable
                embedded
                columns={[
                  { key: "tracking", label: "Tracking ID" },
                  { key: "to", label: "Recipient" },
                  { key: "status", label: "Status" },
                  { key: "date", label: "Date" },
                  { key: "actions", label: "", className: "w-24 text-right" },
                ]}
                pageSize={100}
                emptyMessage="No shipments in the system yet."
                emptyCta={
                  <Link href="/admin/shipments/new">
                    <span className="inline-flex rounded-lg bg-accent-amber px-4 py-2 text-sm font-semibold text-surface-deep">
                      Create shipment
                    </span>
                  </Link>
                }
              >
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td className="mono px-4 py-3 text-sm tabular-nums text-accent-amber">
                      {s.tracking_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary">
                      {s.receiver_details.name}, {s.receiver_details.city}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="mono px-4 py-3 text-xs text-text-muted tabular-nums">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/shipments/${s.id}`}
                        className="text-sm font-semibold text-accent-blue hover:text-accent-amber"
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

        <aside className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="!p-5 !shadow-card ring-1 ring-white/[0.04]">
            <h2
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Activity
            </h2>
            <p className="mt-1 text-xs text-text-muted">Latest shipment updates</p>
            <ul className="mt-5 space-y-0 border-l border-dashed border-border-accent ps-5">
              {activity.length === 0 ? (
                <li className="py-2 text-sm text-text-muted">No activity yet.</li>
              ) : (
                activity.map((item, i) => (
                  <li
                    key={item.id}
                    className="relative border-b border-border-default py-3.5 last:border-b-0 last:pb-0"
                    style={{
                      animation: "fadeSlideIn 0.4s ease forwards",
                      animationDelay: `${i * 45}ms`,
                      opacity: 0,
                    }}
                  >
                    <span className="absolute -start-[calc(1.25rem+3px)] top-[1.35rem] h-2 w-2 rounded-full bg-accent-amber ring-2 ring-surface-card" />
                    <p className="text-sm font-medium text-text-primary">{item.line}</p>
                    <p className="mono mt-1 text-xs text-text-muted tabular-nums">{item.sub}</p>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

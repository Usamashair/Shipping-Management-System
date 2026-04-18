"use client";

import { ChevronRight, Download, PlusCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { StatusBadge } from "@/components/shipping/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ShipmentStatus } from "@/lib/types";
import { useApiStore } from "@/lib/api/store";

const FILTERS: { id: ShipmentStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "label_created", label: "Created" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default function AdminShipmentsPage() {
  const { listUsers, listShipments, refreshUsers, refreshShipments } = useApiStore();
  const shipments = listShipments({ scope: "all" });
  const users = listUsers();
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const [filter, setFilter] = useState<ShipmentStatus | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    void refreshUsers();
    void refreshShipments("all");
  }, [refreshUsers, refreshShipments]);

  const filtered = useMemo(() => {
    let rows = [...shipments].sort((a, b) => b.id - a.id);
    if (filter !== "all") {
      rows = rows.filter((s) => s.status === filter);
    }
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      rows = rows.filter(
        (s) =>
          s.tracking_number.toLowerCase().includes(n) ||
          s.receiver_details.name.toLowerCase().includes(n) ||
          (userMap.get(s.user_id)?.name ?? "").toLowerCase().includes(n),
      );
    }
    return rows;
  }, [shipments, filter, q, userMap]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="text-[28px] font-bold text-text-primary"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Shipments
          </h2>
          <p className="mt-1 text-sm text-text-secondary">All accounts · FedEx-backed when configured</p>
        </div>
        <Link href="/admin/shipments/new">
          <Button className="inline-flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New shipment
          </Button>
        </Link>
      </div>

      <Card className="!p-4 !shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Input
            className="max-w-md border-border-default lg:flex-1"
            placeholder="Search tracking, recipient, customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search shipments"
          />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium tabular-nums text-text-muted">
              Showing <span className="text-text-secondary">{filtered.length}</span> of{" "}
              <span className="text-text-secondary">{shipments.length}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
                    filter === f.id
                      ? "border-accent-amber bg-[var(--accent-amber-glow)] text-accent-amber-bright"
                      : "border-transparent text-text-muted hover:border-border-accent"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="hidden md:block">
        <DataTable
          columns={[
            { key: "id", label: "ID", className: "w-14" },
            { key: "tracking", label: "Tracking ID" },
            { key: "customer", label: "Customer" },
            { key: "svc", label: "Service" },
            { key: "wt", label: "Weight" },
            { key: "status", label: "Status", className: "w-36" },
            { key: "date", label: "Date" },
            { key: "actions", label: "Actions", className: "w-32 text-right" },
          ]}
          pageSize={10}
          emptyMessage="No shipments match your filters."
        >
          {filtered.map((s) => (
            <tr key={s.id}>
              <td className="mono px-4 py-3 text-xs text-text-muted tabular-nums">{s.id}</td>
              <td className="mono px-4 py-3 text-sm tabular-nums text-accent-amber">{s.tracking_number}</td>
              <td className="px-4 py-3 text-sm text-text-primary">
                {userMap.get(s.user_id)?.name ?? `User #${s.user_id}`}
              </td>
              <td className="px-4 py-3 text-sm text-text-secondary">{s.service_type ?? "—"}</td>
              <td className="mono px-4 py-3 text-sm tabular-nums text-text-secondary">
                {s.package_weight ?? s.package_details.weightLb} lb
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={s.status} />
              </td>
              <td className="mono px-4 py-3 text-xs text-text-muted tabular-nums">
                {new Date(s.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-1">
                  <Link
                    href={`/admin/shipments/${s.id}`}
                    className="inline-flex items-center gap-0.5 rounded-md px-2 py-1.5 text-sm font-semibold text-accent-blue hover:bg-surface-card-hover hover:text-accent-amber"
                    aria-label="View shipment"
                  >
                    Open
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                  {s.label_path || s.label_url ? (
                    <span className="inline-flex p-1.5 text-text-muted" title="Label available on detail">
                      <Download className="h-4 w-4" />
                    </span>
                  ) : null}
                  {s.status !== "cancelled" ? (
                    <span className="inline-flex p-1.5 text-text-muted" title="Cancel from detail">
                      <XCircle className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div className="space-y-3 md:hidden stagger-children">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-border-default bg-surface-card p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="mono text-sm font-semibold tabular-nums text-accent-amber">
                {s.tracking_number}
              </span>
              <StatusBadge status={s.status} />
            </div>
            <p className="mt-2 text-sm text-text-primary">{s.receiver_details.name}</p>
            <p className="text-xs text-text-muted">
              {s.receiver_details.city}, {s.receiver_details.state}
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
              <span>{s.service_type ?? "—"}</span>
              <span className="mono tabular-nums">{s.package_weight ?? s.package_details.weightLb} lb</span>
            </div>
            <Link
              href={`/admin/shipments/${s.id}`}
              className="mt-3 inline-block text-sm font-semibold text-accent-blue"
            >
              View details →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

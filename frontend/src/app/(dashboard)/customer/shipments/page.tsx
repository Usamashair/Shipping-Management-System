"use client";

import { Eye, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { StatusBadge } from "@/components/shipping/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ShipmentStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { useApiStore } from "@/lib/api/store";

const FILTERS: { id: ShipmentStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "label_created", label: "Created" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default function CustomerShipmentsPage() {
  const { user } = useAuth();
  const { listShipments, refreshShipments } = useApiStore();
  const shipments = listShipments({ scope: "mine" });
  const [filter, setFilter] = useState<ShipmentStatus | "all">("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    void refreshShipments("mine");
  }, [refreshShipments]);

  const filtered = useMemo(() => {
    let rows = [...shipments].sort((a, b) => b.id - a.id);
    if (filter !== "all") rows = rows.filter((s) => s.status === filter);
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      rows = rows.filter(
        (s) =>
          s.tracking_number.toLowerCase().includes(n) ||
          s.receiver_details.name.toLowerCase().includes(n) ||
          s.receiver_details.city.toLowerCase().includes(n),
      );
    }
    return rows;
  }, [shipments, filter, q]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="text-[28px] font-bold text-text-primary"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            My shipments
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Signed in as <span className="font-medium text-text-primary">{user?.name}</span>{" "}
            <span className="mono text-text-muted tabular-nums">({user?.email})</span>
          </p>
        </div>
        <Link href="/customer/shipments/new">
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
            placeholder="Search tracking or recipient…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
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
            { key: "tracking", label: "Tracking ID" },
            { key: "to", label: "Recipient" },
            { key: "svc", label: "Service" },
            { key: "wt", label: "Weight" },
            { key: "status", label: "Status", className: "w-36" },
            { key: "date", label: "Date" },
            { key: "actions", label: "", className: "w-20 text-right" },
          ]}
          pageSize={10}
          emptyMessage="You have no shipments yet. Create one to get started."
          emptyCta={
            <Link
              href="/customer/shipments/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-amber px-4 py-2.5 text-sm font-semibold text-surface-deep transition-all duration-200 hover:scale-[1.02] hover:shadow-glow"
            >
              Create shipment
            </Link>
          }
        >
          {filtered.map((s) => (
            <tr key={s.id}>
              <td className="mono px-4 py-3 text-sm tabular-nums text-accent-amber">{s.tracking_number}</td>
              <td className="px-4 py-3 text-sm text-text-primary">
                {s.receiver_details.name}, {s.receiver_details.city}
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
                <Link
                  href={`/customer/shipments/${s.id}`}
                  className="inline-flex rounded-md p-1.5 text-text-secondary hover:bg-surface-card-hover hover:text-accent-amber"
                  aria-label="View"
                >
                  <Eye className="h-4 w-4" />
                </Link>
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
            <p className="text-xs text-text-muted">{s.receiver_details.city}</p>
            <div className="mt-2 flex justify-between text-xs text-text-secondary">
              <span>{s.service_type ?? "—"}</span>
              <span className="mono tabular-nums">{s.package_weight ?? s.package_details.weightLb} lb</span>
            </div>
            <Link href={`/customer/shipments/${s.id}`} className="mt-3 inline-block text-sm font-semibold text-accent-blue">
              View →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

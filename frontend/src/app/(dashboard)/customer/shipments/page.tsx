"use client";

import { ApiError } from "@/lib/api/client";
import { downloadShipmentLabelBlob } from "@/lib/api/shipments";
import { DataTable } from "@/components/shipping/data-table";
import { StatusBadge } from "@/components/shipping/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { ShipmentStatus } from "@/lib/types";
import { useAuth } from "@/lib/auth/context";
import { useApiStore } from "@/lib/api/store";
import { Ban, ChevronRight, Download, Lock, MoreVertical, PlusCircle, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function canCancelWithFedEx(status: ShipmentStatus): boolean {
  return status === "label_created" || status === "pending" || status === "in_transit";
}

const FILTERS: { id: ShipmentStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "label_created", label: "Created" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

export default function CustomerShipmentsPage() {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { listShipments, refreshShipments, cancelCustomerShipment } = useApiStore();
  const shipments = listShipments({ scope: "mine" });
  const [filter, setFilter] = useState<ShipmentStatus | "all">("all");
  const [q, setQ] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<{
    id: number;
    right: number;
    top: number;
    placement: "down" | "up";
  } | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.('[data-customer-shipments-menu="1"]')) return;
      if (t.closest?.('[data-customer-shipments-menu-trigger="1"]')) return;
      setOpenMenu(null);
    };
    const onScrollOrResize = () => setOpenMenu(null);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [openMenu]);

  const downloadLabel = async (shipmentId: number) => {
    if (!token) return;
    const blob = await downloadShipmentLabelBlob(token, shipmentId, "customer");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipment-${shipmentId}-label.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

  const tableCardClass =
    "admin-overview-recent-card !border-border-subtle !bg-[linear-gradient(135deg,#ffffff_0%,var(--selection-tint)_42%,rgba(77,209,197,0.2)_100%)] !p-0 !shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent hover:ring-accent-amber/10";

  return (
    <div className="flex min-h-0 flex-col gap-[var(--space-8)] pb-[var(--space-8)]">
      <div
        className="admin-dashboard-surface-bg overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle shadow-card ring-1 ring-slate-900/[0.04]"
        style={{
          padding: "var(--ds-card-padding) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div className="min-w-0 flex-1 text-left">
          <h2
            className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            My shipments
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            {user?.name ? (
              <>
                <span className="font-medium text-text-primary">{user.name}</span>
                {user?.email ? <span className="mono text-text-muted tabular-nums"> · {user.email}</span> : null} ·
                FedEx-backed when configured
              </>
            ) : (
              "Your account · FedEx-backed when configured"
            )}
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Link
            href="/customer/shipments/new"
            className="admin-dashboard-cta !min-h-12 !gap-2.5 !px-7 !py-3.5 inline-flex max-w-full items-center justify-center rounded-[var(--radius-md)] bg-accent-amber text-base font-semibold text-white shadow-sm ring-1 ring-black/[0.05] transition-[filter,transform,box-shadow] duration-200 motion-safe:hover:brightness-110 motion-safe:hover:shadow-glow motion-safe:active:scale-[0.98]"
          >
            <PlusCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            New shipment
          </Link>
        </div>
      </div>

      <Card className={tableCardClass}>
        <div className="admin-recent-shipments-header flex flex-col gap-4 border-b border-border-subtle lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 w-full flex-1 flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
            <div className="min-w-0 flex-1">
              <Input
                className="h-11 w-full min-w-0 border-border-default"
                placeholder="Search tracking, recipient, city…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search shipments"
              />
            </div>
            <div className="min-w-0 flex-1">
              <select
                id="customer-shipments-status-filter"
                className="h-11 w-full cursor-pointer rounded-[var(--radius-md)] border border-border-default bg-bg-input py-0 pl-3 pr-10 text-sm font-medium text-text-primary shadow-sm focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--amber-glow)]"
                value={filter}
                onChange={(e) => setFilter(e.target.value as ShipmentStatus | "all")}
                aria-label="Filter by shipment status"
              >
                {FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span className="text-sm font-medium tabular-nums text-text-muted">
              Showing <span className="text-text-secondary">{filtered.length}</span> of{" "}
              <span className="text-text-secondary">{shipments.length}</span>
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-b-[var(--radius-lg)]">
          <div className="hidden md:block">
            <DataTable
              embedded
              cellPadClass="!px-2"
              columns={[
                { key: "id", label: "ID", className: "w-12" },
                { key: "tracking", label: "Tracking ID", className: "w-[9.5rem] min-w-[9.5rem]" },
                { key: "to", label: "Recipient", className: "w-[12rem] min-w-[12rem]" },
                { key: "svc", label: "Service", className: "w-[6rem] min-w-[6rem]" },
                { key: "wt", label: "Weight", className: "w-[4.5rem] min-w-[4.5rem] whitespace-nowrap" },
                { key: "status", label: "Status", className: "w-[6.5rem] min-w-[6.5rem]" },
                { key: "date", label: "Date", className: "w-[6rem] min-w-[6rem] whitespace-nowrap" },
                { key: "actions", label: "Actions", className: "w-14 text-right" },
              ]}
              pageSize={10}
              emptyMessage="No shipments match your filters, or you have not created a shipment yet."
              emptyCta={
                <Link
                  href="/customer/shipments/new"
                  className="admin-dashboard-cta !min-h-12 !gap-2.5 !px-7 !py-3.5 inline-flex items-center justify-center rounded-[var(--radius-md)] bg-accent-amber text-base font-semibold text-white shadow-sm ring-1 ring-black/[0.05] transition-all duration-200 motion-safe:hover:scale-[1.01] motion-safe:hover:shadow-glow"
                >
                  <PlusCircle className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                  Create shipment
                </Link>
              }
            >
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="mono !px-2 py-3.5 text-xs text-text-muted tabular-nums">{s.id}</td>
                  <td
                    className="mono w-[9.5rem] min-w-[9.5rem] overflow-hidden text-clip whitespace-nowrap !pl-2 !pr-4 py-3.5 text-sm tabular-nums text-accent-amber"
                    title={s.tracking_number}
                  >
                    {s.tracking_number}
                  </td>
                  <td
                    className="w-[12rem] min-w-[12rem] overflow-hidden text-clip whitespace-nowrap !px-2 py-3.5 text-sm text-text-primary"
                    title={`${s.receiver_details.name} — ${s.receiver_details.city}, ${s.receiver_details.state}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Lock size={11} color="var(--amber)" className="shrink-0" aria-hidden />
                      <span>
                        {s.receiver_details.name} — {s.receiver_details.city}, {s.receiver_details.state}
                      </span>
                    </span>
                  </td>
                  <td className="w-[6rem] min-w-[6rem] overflow-hidden text-clip whitespace-nowrap !px-2 py-3.5 text-sm text-text-secondary">
                    {s.service_type ?? "—"}
                  </td>
                  <td className="mono w-[4.5rem] min-w-[4.5rem] !px-2 py-3.5 text-sm tabular-nums text-text-secondary whitespace-nowrap">
                    {s.package_weight ?? s.package_details.weightLb} lb
                  </td>
                  <td className="w-[6.5rem] min-w-[6.5rem] !px-2 py-3.5">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="mono w-[6rem] min-w-[6rem] !px-2 py-3.5 text-xs text-text-muted tabular-nums whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="!px-2 py-3.5 text-right">
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        data-customer-shipments-menu-trigger="1"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-default text-text-primary transition-colors hover:border-accent-amber hover:text-accent-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber-glow)]"
                        aria-label="Shipment actions"
                        title="Actions"
                        onClick={(e) => {
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          const MENU_H = 280;
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const placement: "down" | "up" = spaceBelow < MENU_H ? "up" : "down";
                          const top =
                            placement === "down"
                              ? Math.min(rect.bottom + 8, window.innerHeight - 8)
                              : Math.max(rect.top - 8, 8);
                          const right = Math.max(window.innerWidth - rect.right, 8);
                          setOpenMenu((prev) =>
                            prev?.id === s.id ? null : { id: s.id, right, top, placement },
                          );
                        }}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </button>

                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </div>
      </Card>

      {openMenu && typeof document !== "undefined"
        ? createPortal(
            <div
              data-customer-shipments-menu="1"
              className="fixed z-[1000] w-56 overflow-hidden rounded-[var(--radius-md)] border border-border-default bg-white shadow-card ring-1 ring-slate-900/[0.06]"
              style={{
                right: openMenu.right,
                top: openMenu.placement === "down" ? openMenu.top : undefined,
                bottom: openMenu.placement === "up" ? window.innerHeight - openMenu.top : undefined,
              }}
            >
              <div className="flex flex-col gap-1 p-2.5">
                <Link
                  href={`/customer/shipments/${openMenu.id}`}
                  className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                  onClick={() => setOpenMenu(null)}
                >
                  <span>View</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                </Link>
                {(() => {
                  const s = filtered.find((x) => x.id === openMenu.id);
                  if (!s) return null;
                  return (
                    <>
                      <Link
                        href={`/customer/tracking?q=${encodeURIComponent(s.tracking_number)}`}
                        className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                        onClick={() => setOpenMenu(null)}
                      >
                        <span>Track on FedEx</span>
                        <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                      </Link>
                      {s.label_url ? (
                        <a
                          href={s.label_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                          onClick={() => setOpenMenu(null)}
                        >
                          <span>Open label</span>
                          <Download className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                        </a>
                      ) : null}
                      {s.label_path && token ? (
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 !justify-start overflow-visible rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                          onClick={() => {
                            void (async () => {
                              try {
                                await downloadLabel(s.id);
                                showToast("Label downloaded.");
                              } catch (e) {
                                showToast(e instanceof ApiError ? e.message : "Could not download label.");
                              } finally {
                                setOpenMenu(null);
                              }
                            })();
                          }}
                        >
                          <span>Download label (PDF)</span>
                          <Download className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                        </button>
                      ) : null}
                      {canCancelWithFedEx(s.status) ? (
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 !justify-start overflow-visible rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-semibold leading-5 text-accent-red transition-colors hover:bg-red-500/10 disabled:opacity-40"
                          disabled={cancellingId === s.id}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Cancel this shipment with FedEx? This only works if the package has not been tendered to FedEx yet.",
                              )
                            ) {
                              return;
                            }
                            setCancellingId(s.id);
                            void (async () => {
                              try {
                                await cancelCustomerShipment(s.id);
                                showToast("Shipment cancelled with FedEx.", "success");
                              } catch (e) {
                                const msg =
                                  e instanceof ApiError
                                    ? e.message
                                    : e instanceof Error
                                      ? e.message
                                      : "Cancel failed.";
                                showToast(msg, "error");
                              } finally {
                                setCancellingId(null);
                                setOpenMenu(null);
                              }
                            })();
                          }}
                        >
                          <span>Cancel label</span>
                          <Ban className="h-4 w-4 shrink-0" aria-hidden />
                        </button>
                      ) : s.status !== "cancelled" ? (
                        <div className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-muted">
                          <span>Cancel label</span>
                          <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            </div>,
            document.body,
          )
        : null}

      <div className="flex flex-col gap-4 md:hidden">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-card px-[var(--space-8)] py-[var(--ds-card-padding)] shadow-card ring-1 ring-slate-900/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="mono text-xs text-text-muted tabular-nums">#{s.id}</span>
                <p className="mono text-sm font-semibold tabular-nums text-accent-amber">{s.tracking_number}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <p
              className="mt-3 text-sm font-medium text-text-primary"
              style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
            >
              <Lock size={12} color="var(--amber)" className="shrink-0" aria-hidden />
              <span>
                {s.receiver_details.name} — {s.receiver_details.city}, {s.receiver_details.state}
              </span>
            </p>
            <div className="mt-3 flex items-center justify-between text-xs text-text-secondary">
              <span>{s.service_type ?? "—"}</span>
              <span className="mono tabular-nums">{s.package_weight ?? s.package_details.weightLb} lb</span>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Link
                href={`/customer/shipments/${s.id}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-accent-blue"
              >
                View details
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
              <Link
                href={`/customer/tracking?q=${encodeURIComponent(s.tracking_number)}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-text-secondary"
              >
                <Search className="h-4 w-4" aria-hidden />
                Track
              </Link>
            </div>
            {canCancelWithFedEx(s.status) ? (
              <button
                type="button"
                className="mt-3 w-full text-left text-sm font-semibold text-accent-red hover:underline disabled:opacity-40"
                disabled={cancellingId === s.id}
                onClick={() => {
                  if (!window.confirm("Cancel this shipment with FedEx? Only if it has not been tendered yet.")) {
                    return;
                  }
                  setCancellingId(s.id);
                  void (async () => {
                    try {
                      await cancelCustomerShipment(s.id);
                      showToast("Shipment cancelled with FedEx.", "success");
                    } catch (e) {
                      const msg =
                        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Cancel failed.";
                      showToast(msg, "error");
                    } finally {
                      setCancellingId(null);
                    }
                  })();
                }}
              >
                Cancel with FedEx
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}


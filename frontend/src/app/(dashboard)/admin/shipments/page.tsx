"use client";

import { ApiError } from "@/lib/api/client";
import { downloadShipmentLabelBlob } from "@/lib/api/shipments";
import { Download, Eye, ExternalLink, MoreVertical, PlusCircle, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ADMIN_SHIPMENT_ACTION_ICON_CLASS,
  AdminShipmentLabelIconButton,
} from "./admin-shipment-label-icon-button";
import { DataTable } from "@/components/shipping/data-table";
import { StatusBadge } from "@/components/shipping/status-badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { fedExServiceTypeShortLabel } from "@/lib/api/shipments";
import type { ShipmentStatus } from "@/lib/types";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";

const FILTERS: { id: ShipmentStatus | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "label_created", label: "Created" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "cancelled", label: "Cancelled" },
];

function canCancelFromList(status: ShipmentStatus): boolean {
  return status === "label_created" || status === "pending";
}

export default function AdminShipmentsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const { listUsers, listShipments, refreshUsers, refreshShipments, deleteAdminShipment } = useApiStore();
  const shipments = listShipments({ scope: "all" });
  const users = listUsers();
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const [filter, setFilter] = useState<ShipmentStatus | "all">("all");
  const [q, setQ] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const downloadLabel = async (shipmentId: number) => {
    if (!token) return;
    const blob = await downloadShipmentLabelBlob(token, shipmentId, "admin");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shipment-${shipmentId}-label.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            Shipments
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            All accounts · FedEx-backed when configured
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Link
            href="/admin/shipments/new"
            className="admin-dashboard-cta rounded-[var(--radius-md)] bg-accent-amber text-base font-semibold text-white transition-[filter,transform] duration-200 motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98]"
          >
            <PlusCircle className="h-5 w-5 shrink-0" aria-hidden />
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
                placeholder="Search tracking, recipient, customer…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search shipments"
              />
            </div>
            <div className="min-w-0 flex-1">
              <select
                id="admin-shipments-status-filter"
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
                { key: "customer", label: "Customer", className: "w-[9rem] min-w-[9rem]" },
                { key: "recipient", label: "Recipient", className: "w-[9rem] min-w-[9rem]" },
                { key: "svc", label: "Service", className: "w-[6rem] min-w-[6rem]" },
                { key: "wt", label: "Weight", className: "w-[4.5rem] min-w-[4.5rem] whitespace-nowrap" },
                { key: "status", label: "Status", className: "w-[6.5rem] min-w-[6.5rem]" },
                { key: "date", label: "Date", className: "w-[6rem] min-w-[6rem] whitespace-nowrap" },
                { key: "actions", label: "Actions", className: "w-14 text-right" },
              ]}
              pageSize={10}
              emptyMessage="No shipments match your filters."
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
                    className="w-[9rem] min-w-[9rem] overflow-hidden text-clip whitespace-nowrap !px-2 py-3.5 text-sm text-text-primary"
                    title={userMap.get(s.user_id)?.name ?? `User #${s.user_id}`}
                  >
                    {userMap.get(s.user_id)?.name ?? `User #${s.user_id}`}
                  </td>
                  <td
                    className="w-[9rem] min-w-[9rem] overflow-hidden text-clip whitespace-nowrap !px-2 py-3.5 text-sm text-text-primary"
                    title={s.receiver_details.name}
                  >
                    {s.receiver_details.name.trim() || "—"}
                  </td>
                  <td
                    className="w-[6rem] min-w-[6rem] overflow-hidden text-clip whitespace-nowrap !px-2 py-3.5 text-sm text-text-secondary"
                    title={s.service_type ?? ""}
                  >
                    {fedExServiceTypeShortLabel(s.service_type)}
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
                        className={ADMIN_SHIPMENT_ACTION_ICON_CLASS}
                        aria-label="Shipment actions"
                        title="Actions"
                        onClick={() => setOpenMenuId((prev) => (prev === s.id ? null : s.id))}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </button>
                      {openMenuId === s.id ? (
                        <div
                          className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-[var(--radius-md)] border border-border-default bg-white shadow-card ring-1 ring-slate-900/[0.04]"
                        >
                          <div className="flex flex-col gap-1 p-2.5">
                            <Link
                              href={`/admin/shipments/${s.id}`}
                              className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                              onClick={() => setOpenMenuId(null)}
                            >
                              <Eye className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                              View
                            </Link>

                            {s.label_url ? (
                              <a
                                href={s.label_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                                onClick={() => setOpenMenuId(null)}
                              >
                                <ExternalLink className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                                Open label
                              </a>
                            ) : null}
                            {s.label_path && token ? (
                              <button
                                type="button"
                                className="flex w-full items-center gap-3 !justify-start overflow-visible rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      await downloadLabel(s.id);
                                      showToast("Label downloaded.");
                                    } catch (e) {
                                      showToast(e instanceof ApiError ? e.message : "Could not download label.");
                                    } finally {
                                      setOpenMenuId(null);
                                    }
                                  })();
                                }}
                              >
                                <Download className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                                Download label (PDF)
                              </button>
                            ) : null}

                            {canCancelFromList(s.status) ? (
                              <Link
                                href={`/admin/shipments/${s.id}#shipment-fedex-cancel`}
                                className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium leading-5 text-text-primary transition-colors hover:bg-[var(--selection-tint)]"
                                onClick={() => setOpenMenuId(null)}
                              >
                                <XCircle className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                                Cancel label
                              </Link>
                            ) : null}

                            <div className="my-1 h-px w-full bg-border-subtle" />
                            <button
                              type="button"
                              disabled={deletingId === s.id}
                              className="flex w-full items-center gap-3 !justify-start overflow-visible rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-semibold leading-5 text-accent-red transition-colors hover:bg-red-500/10 disabled:opacity-50"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Delete shipment #${s.id} (${s.tracking_number}) from the database? This does not call FedEx; cancel there first if the label is live.`,
                                  )
                                ) {
                                  return;
                                }
                                setDeletingId(s.id);
                                void (async () => {
                                  try {
                                    await deleteAdminShipment(s.id);
                                    showToast("Shipment deleted.");
                                  } catch (e) {
                                    showToast(e instanceof ApiError ? e.message : "Could not delete shipment.");
                                  } finally {
                                    setDeletingId(null);
                                    setOpenMenuId(null);
                                  }
                                })();
                              }}
                            >
                              <Trash2 className="h-4 w-4 shrink-0 text-accent-red" aria-hidden />
                              Delete shipment
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4 md:hidden">
        {filtered.map((s) => (
          <div
            key={s.id}
            className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-card px-[var(--space-8)] py-[var(--ds-card-padding)] shadow-card ring-1 ring-slate-900/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="mono min-w-0 text-sm font-semibold tabular-nums text-accent-amber">{s.tracking_number}</span>
              <StatusBadge status={s.status} />
            </div>
            <p className="mt-3 break-words text-sm font-medium text-text-primary" title={s.receiver_details.name}>
              {s.receiver_details.name.trim() || "—"}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-secondary">
              <span className="min-w-0 break-words" title={s.service_type ?? ""}>
                {fedExServiceTypeShortLabel(s.service_type)}
              </span>
              <span className="mono shrink-0 tabular-nums">{s.package_weight ?? s.package_details.weightLb} lb</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/shipments/${s.id}`}
                className={ADMIN_SHIPMENT_ACTION_ICON_CLASS}
                aria-label="View shipment"
                title="View shipment"
              >
                <Eye className="h-4 w-4" aria-hidden />
              </Link>
              <AdminShipmentLabelIconButton shipmentId={s.id} labelUrl={s.label_url} labelPath={s.label_path} />
              {canCancelFromList(s.status) ? (
                <Link
                  href={`/admin/shipments/${s.id}#shipment-fedex-cancel`}
                  className={ADMIN_SHIPMENT_ACTION_ICON_CLASS}
                  aria-label="Cancel on shipment page"
                  title="Cancel on shipment page"
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              <button
                type="button"
                disabled={deletingId === s.id}
                className={`${ADMIN_SHIPMENT_ACTION_ICON_CLASS} hover:border-accent-red/60 hover:text-accent-red disabled:opacity-50`}
                aria-label="Delete shipment"
                title="Delete shipment record"
                onClick={() => {
                  if (
                    !window.confirm(
                      `Delete shipment #${s.id} (${s.tracking_number}) from the database? This does not call FedEx; cancel there first if the label is live.`,
                    )
                  ) {
                    return;
                  }
                  setDeletingId(s.id);
                  void (async () => {
                    try {
                      await deleteAdminShipment(s.id);
                      showToast("Shipment deleted.");
                    } catch (e) {
                      showToast(e instanceof ApiError ? e.message : "Could not delete shipment.");
                    } finally {
                      setDeletingId(null);
                    }
                  })();
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

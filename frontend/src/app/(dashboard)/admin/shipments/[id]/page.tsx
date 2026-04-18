"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { JsonPanel } from "@/components/shipping/json-panel";
import { StatusBadge } from "@/components/shipping/status-badge";
import { TrackingTimeline } from "@/components/shipping/tracking-timeline";
import { useApiStore } from "@/lib/api/store";
import type { ShipmentStatus } from "@/lib/types";

export default function AdminShipmentDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { getShipment, listUsers, loadShipment, updateShipmentStatus, getTrackingLogs } =
    useApiStore();
  const shipment = getShipment(id);
  const users = listUsers();
  const logs = getTrackingLogs(id);
  const owner = useMemo(() => users.find((u) => u.id === shipment?.user_id), [users, shipment]);
  const [statusDraft, setStatusDraft] = useState<ShipmentStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    startTransition(() => setLoadError(null));
    void loadShipment(id).catch(() => {
      startTransition(() => setLoadError("Unable to load this shipment."));
    });
  }, [id, loadShipment]);

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Invalid shipment.</p>
        <Link href="/admin/shipments" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Back to list
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link href="/admin/shipments" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Back to list
        </Link>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        <Link href="/admin/shipments" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Back to list
        </Link>
      </div>
    );
  }

  const effectiveStatus = statusDraft ?? shipment.status;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/shipments"
            className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            All shipments
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {shipment.tracking_number}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Owner: {owner?.name ?? `User #${shipment.user_id}`} · Updated{" "}
            {new Date(shipment.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={effectiveStatus} />
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Update status</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Persists via{" "}
          <code className="font-mono">{`PATCH /api/admin/shipments/{id}/status`}</code>.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={effectiveStatus}
            onChange={(e) => setStatusDraft(e.target.value as ShipmentStatus)}
          >
            <option value="pending">pending</option>
            <option value="in_transit">in_transit</option>
            <option value="delivered">delivered</option>
            <option value="failed">failed</option>
          </select>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                await updateShipmentStatus(id, effectiveStatus);
                setStatusDraft(null);
                await loadShipment(id);
              })();
            }}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save status
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Label</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          URL points to Laravel <code className="font-mono">storage</code> (stub FedEx label).
        </p>
        {shipment.label_url ? (
          <a
            href={shipment.label_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Open label file
          </a>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">No label URL</p>
        )}
      </section>

      <section className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
        <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">System</h3>
        <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/80">
          FedEx OAuth, queues, and scheduled tracking are backend concerns. Current mode uses the
          stub <code className="font-mono">FedExClient</code> implementation.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonPanel title="Sender details" data={shipment.sender_details} defaultOpen />
        <JsonPanel title="Receiver details" data={shipment.receiver_details} defaultOpen />
      </div>
      <JsonPanel title="Package details" data={shipment.package_details} defaultOpen />
      <JsonPanel title="fedex_response (stored)" data={shipment.fedex_response} defaultOpen />

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tracking log</h3>
        <div className="mt-4">
          <TrackingTimeline logs={logs} />
        </div>
      </section>
    </div>
  );
}

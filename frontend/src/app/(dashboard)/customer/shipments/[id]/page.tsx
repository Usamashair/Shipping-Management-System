"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { JsonPanel } from "@/components/shipping/json-panel";
import { StatusBadge } from "@/components/shipping/status-badge";
import { TrackingTimeline } from "@/components/shipping/tracking-timeline";
import { useAuth } from "@/lib/auth/context";
import { useApiStore } from "@/lib/api/store";

export default function CustomerShipmentDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const { getShipment, getTrackingLogs, loadShipment, trackShipment } = useApiStore();
  const shipment = getShipment(id);
  const logs = getTrackingLogs(id);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    startTransition(() => setLoadError(null));
    void loadShipment(id).catch(() => {
      startTransition(() => setLoadError("Unable to load this shipment."));
    });
  }, [id, loadShipment]);

  const allowed = shipment && user && shipment.user_id === user.id;

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Invalid shipment.</p>
        <Link href="/customer/shipments" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Back to list
        </Link>
      </div>
    );
  }

  if (!user) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading session…</p>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError}</p>
        <Link href="/customer/shipments" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Back to my shipments
        </Link>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
        <Link href="/customer/shipments" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Back to list
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This shipment belongs to another account (or you are not signed in as its owner).
        </p>
        <Link href="/customer/shipments" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Back to my shipments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/customer/shipments"
          className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          My shipments
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {shipment.tracking_number}
          </h2>
          <StatusBadge status={shipment.status} />
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Last updated {new Date(shipment.updated_at).toLocaleString()}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                await trackShipment(id);
                await loadShipment(id);
              } finally {
                setBusy(false);
              }
            })();
          }}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Simulate tracking refresh
        </button>
        {shipment.label_url ? (
          <a
            href={shipment.label_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Open label
          </a>
        ) : null}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tracking timeline</h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Calls <code className="font-mono">{`POST /api/customer/shipments/{id}/track`}</code> (stub FedEx).
        </p>
        <div className="mt-4">
          <TrackingTimeline logs={logs} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonPanel title="Sender" data={shipment.sender_details} />
        <JsonPanel title="Receiver" data={shipment.receiver_details} />
      </div>
      <JsonPanel title="Package" data={shipment.package_details} />
      <JsonPanel title="fedex_response" data={shipment.fedex_response} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useApiStore } from "@/lib/api/store";
import type { ShipmentStatus } from "@/lib/types";

const STATUS_OPTIONS: ShipmentStatus[] = [
  "pending",
  "label_created",
  "in_transit",
  "delivered",
  "failed",
  "cancelled",
];

export default function AdminShipmentStatusPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { getShipment, loadShipment, updateShipmentStatus } = useApiStore();
  const { showToast } = useToast();
  const shipment = getShipment(id);
  const [status, setStatus] = useState<ShipmentStatus>("pending");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    startTransition(() => setLoadError(null));
    void loadShipment(id).catch(() => {
      startTransition(() => setLoadError("Unable to load this shipment."));
    });
  }, [id, loadShipment]);

  useEffect(() => {
    if (shipment) setStatus(shipment.status);
  }, [shipment]);

  if (!Number.isFinite(id)) {
    return (
      <p className="text-sm text-text-secondary">
        Invalid shipment.{" "}
        <Link href="/admin/shipments" className="text-accent-blue hover:text-accent-amber">
          Back
        </Link>
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">{loadError}</p>
        <Link href="/admin/shipments" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
          Back to list
        </Link>
      </div>
    );
  }

  if (!shipment) {
    return <p className="text-sm text-text-secondary">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href={`/admin/shipments/${id}`}
          className="text-sm font-semibold text-accent-blue hover:text-accent-amber"
        >
          Shipment {shipment.tracking_number}
        </Link>
        <h2
          className="mt-2 text-2xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Update status
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          <code className="mono rounded bg-surface-card-hover px-1 py-0.5">PATCH /api/admin/shipments/{id}/status</code>
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-accent-red/40 bg-[rgba(239,68,68,0.12)] px-3 py-2 text-sm text-accent-red">
          {error}
        </p>
      ) : null}

      <Card className="!p-6">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setBusy(true);
            void (async () => {
              try {
                await updateShipmentStatus(id, status);
                await loadShipment(id);
                showToast("Status updated.");
                router.push(`/admin/shipments/${id}`);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Update failed.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Status
            </label>
            <select
              className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-sm text-text-primary transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)]"
              value={status}
              onChange={(e) => setStatus(e.target.value as ShipmentStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link
              href={`/admin/shipments/${id}`}
              className="inline-flex items-center justify-center rounded-lg border border-border-default px-4 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-border-accent hover:text-text-primary"
            >
              Cancel
            </Link>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Update status"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

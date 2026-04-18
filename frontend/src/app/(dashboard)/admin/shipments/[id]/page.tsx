"use client";

import { Download, FileText, Loader2, Truck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { FedExResponseSummary } from "@/components/shipping/fedex-response-summary";
import { ShipmentAddressCard } from "@/components/shipping/shipment-address-card";
import { ShipmentPackageCard } from "@/components/shipping/shipment-package-card";
import { StatusBadge } from "@/components/shipping/status-badge";
import { TrackingTimeline } from "@/components/shipping/tracking-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { cancelFedExShipment, downloadShipmentLabelBlob, fetchFedExShipmentJobStatus } from "@/lib/api/shipments";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";

export default function AdminShipmentDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { token } = useAuth();
  const { showToast } = useToast();
  const { getShipment, listUsers, loadShipment, getTrackingLogs } = useApiStore();
  const shipment = getShipment(id);
  const users = listUsers();
  const logs = getTrackingLogs(id);
  const owner = useMemo(() => users.find((u) => u.id === shipment?.user_id), [users, shipment]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [jobBusy, setJobBusy] = useState(false);
  const [jobOutput, setJobOutput] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

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
        <p className="text-sm text-text-secondary">Invalid shipment.</p>
        <Link href="/admin/shipments" className="text-sm font-semibold text-accent-blue">
          Back to list
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{loadError}</p>
        <Link href="/admin/shipments" className="text-sm font-semibold text-accent-blue">
          Back to list
        </Link>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Loading…</p>
        <Link href="/admin/shipments" className="text-sm font-semibold text-accent-blue">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/admin/shipments" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
        ← All shipments
      </Link>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="!p-6 ring-1 ring-accent-amber/20 [background:linear-gradient(135deg,var(--bg-card)_0%,rgba(17,25,39,0.98)_50%,rgba(13,30,48,0.95)_100%)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Tracking</p>
                <p className="mono mt-1 text-xl font-bold tabular-nums text-accent-amber">
                  {shipment.tracking_number}
                </p>
                <div className="mt-3">
                  <StatusBadge status={shipment.status} size="lg" />
                </div>
                <p className="mt-3 text-sm text-text-secondary">
                  Owner: {owner?.name ?? `User #${shipment.user_id}`} · Updated{" "}
                  <span className="mono tabular-nums text-text-muted">
                    {new Date(shipment.updated_at).toLocaleString()}
                  </span>
                </p>
                <Link
                  href={`/admin/shipments/${id}/status`}
                  className="mt-4 inline-flex text-sm font-semibold text-accent-blue hover:text-accent-amber"
                >
                  Update status →
                </Link>
              </div>
              <div className="rounded-xl border border-border-default bg-surface-deep p-4 text-sm text-text-secondary">
                <div className="flex items-center gap-2 text-text-primary">
                  <Truck className="h-4 w-4 text-accent-amber" />
                  {shipment.service_type ?? "—"}
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  Pickup: {shipment.pickup_type ?? "—"} · Residential:{" "}
                  {shipment.is_residential ? "Yes" : "No"}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border-default bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase text-text-muted">Weight</p>
              <p className="mono mt-1 text-lg tabular-nums text-text-primary">
                {shipment.package_weight ?? shipment.package_details.weightLb} lb
              </p>
            </div>
            <div className="rounded-xl border border-border-default bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase text-text-muted">Dimensions</p>
              <p className="mono mt-1 text-lg tabular-nums text-text-primary">
                {shipment.package_dimensions
                  ? `${shipment.package_dimensions.length}×${shipment.package_dimensions.width}×${shipment.package_dimensions.height} ${shipment.package_dimensions.units}`
                  : `${shipment.package_details.lengthIn}×${shipment.package_details.widthIn}×${shipment.package_details.heightIn} IN`}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ShipmentAddressCard title="Shipper" accent="blue" address={shipment.sender_details} />
            <ShipmentAddressCard title="Recipient" accent="amber" address={shipment.receiver_details} />
          </div>
          <ShipmentPackageCard pkg={shipment.package_details} />

          <FedExResponseSummary data={shipment.fedex_response} />

          {shipment.fedex_job_id && token ? (
            <Card className="!p-5">
              <h3 className="text-sm font-bold text-text-primary">FedEx async job</h3>
              <p className="mt-1 text-xs text-text-muted">
                Job ID <span className="mono text-accent-amber">{shipment.fedex_job_id}</span>
              </p>
              {jobError ? <p className="mt-2 text-sm text-accent-red">{jobError}</p> : null}
              {jobOutput ? (
                <pre className="mono mt-3 max-h-48 overflow-auto rounded-lg bg-surface-deep p-3 text-xs text-text-secondary">
                  {jobOutput}
                </pre>
              ) : null}
              <Button
                variant="secondary"
                className="mt-3"
                disabled={jobBusy}
                onClick={() => {
                  if (!shipment.fedex_job_id || !token) return;
                  setJobError(null);
                  setJobBusy(true);
                  void (async () => {
                    try {
                      const data = await fetchFedExShipmentJobStatus(token, shipment.fedex_job_id!);
                      setJobOutput(JSON.stringify(data, null, 2));
                    } catch (e) {
                      setJobError(e instanceof Error ? e.message : "Request failed.");
                    } finally {
                      setJobBusy(false);
                    }
                  })();
                }}
              >
                {jobBusy ? "Loading…" : "Check job status"}
              </Button>
            </Card>
          ) : null}

          <Card className="!p-5">
            <h3 className="flex items-center gap-2 text-sm font-bold text-text-primary">
              <FileText className="h-4 w-4 text-accent-amber" />
              Label
            </h3>
            {labelError ? <p className="mt-2 text-sm text-accent-red">{labelError}</p> : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {shipment.label_url ? (
                <a
                  href={shipment.label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-accent px-4 py-2 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-accent-amber hover:text-accent-amber"
                >
                  Open label URL
                </a>
              ) : null}
              {shipment.label_path && token ? (
                <Button
                  variant="primary"
                  disabled={labelBusy}
                  className="inline-flex items-center gap-2"
                  onClick={() => {
                    void (async () => {
                      setLabelError(null);
                      setLabelBusy(true);
                      try {
                        const blob = await downloadShipmentLabelBlob(token, id, "admin");
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `shipment-${id}-label.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast("Label downloaded.");
                      } catch {
                        setLabelError("Could not download the label.");
                      } finally {
                        setLabelBusy(false);
                      }
                    })();
                  }}
                >
                  {labelBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Downloading…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download label (PDF)
                    </>
                  )}
                </Button>
              ) : null}
              {!shipment.label_url && !shipment.label_path ? (
                <p className="flex items-center gap-2 text-sm text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-accent-amber" />
                  Label generating…
                </p>
              ) : null}
            </div>
          </Card>

          {shipment.status === "label_created" || shipment.status === "pending" ? (
            <Card className="!p-5">
              <h3 className="text-sm font-bold text-text-primary">FedEx cancel</h3>
              {cancelError ? <p className="mt-2 text-sm text-accent-red">{cancelError}</p> : null}
              <Button
                variant="danger"
                className="mt-3"
                disabled={cancelBusy || !token}
                onClick={() => {
                  if (
                    !window.confirm(
                      "Cancel this shipment with FedEx? Tracking will be voided when FedEx accepts the request.",
                    )
                  ) {
                    return;
                  }
                  void (async () => {
                    if (!token) return;
                    setCancelError(null);
                    setCancelBusy(true);
                    try {
                      await cancelFedExShipment(token, id);
                      await loadShipment(id);
                      showToast("Cancel request sent.");
                    } catch (e) {
                      setCancelError(e instanceof Error ? e.message : "Cancel failed.");
                    } finally {
                      setCancelBusy(false);
                    }
                  })();
                }}
              >
                {cancelBusy ? "Cancelling…" : "Cancel with FedEx"}
              </Button>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <Card className="!p-5">
            <h3
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Tracking history
            </h3>
            <div className="mt-4">
              <TrackingTimeline logs={logs} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

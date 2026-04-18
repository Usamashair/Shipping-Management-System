"use client";

import { Download, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { FedExResponseSummary } from "@/components/shipping/fedex-response-summary";
import { ShipmentAddressCard } from "@/components/shipping/shipment-address-card";
import { ShipmentPackageCard } from "@/components/shipping/shipment-package-card";
import { StatusBadge } from "@/components/shipping/status-badge";
import { TrackingTimeline } from "@/components/shipping/tracking-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { downloadShipmentLabelBlob, fetchFedExShipmentJobStatus } from "@/lib/api/shipments";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";

export default function CustomerShipmentDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { getShipment, getTrackingLogs, loadShipment, trackShipment } = useApiStore();
  const shipment = getShipment(id);
  const logs = getTrackingLogs(id);
  const [busy, setBusy] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const allowed = shipment && user && shipment.user_id === user.id;

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Invalid shipment.</p>
        <Link href="/customer/shipments" className="text-sm font-semibold text-accent-blue">
          Back to list
        </Link>
      </div>
    );
  }

  if (!user) {
    return <p className="text-sm text-text-secondary">Loading session…</p>;
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{loadError}</p>
        <Link href="/customer/shipments" className="text-sm font-semibold text-accent-blue">
          Back to my shipments
        </Link>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Loading…</p>
        <Link href="/customer/shipments" className="text-sm font-semibold text-accent-blue">
          Back to list
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          This shipment belongs to another account (or you are not signed in as its owner).
        </p>
        <Link href="/customer/shipments" className="text-sm font-semibold text-accent-blue">
          Back to my shipments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/customer/shipments" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
        ← My shipments
      </Link>

      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card className="!p-6 ring-1 ring-accent-amber/20 [background:linear-gradient(135deg,var(--bg-card)_0%,rgba(17,25,39,0.98)_50%,rgba(13,30,48,0.95)_100%)]">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="mono text-xl font-bold tabular-nums text-accent-amber">{shipment.tracking_number}</h2>
              <StatusBadge status={shipment.status} size="lg" />
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Last updated{" "}
              <span className="mono tabular-nums text-text-muted">
                {new Date(shipment.updated_at).toLocaleString()}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="ghost"
                disabled={busy}
                className="border-border-accent"
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await trackShipment(id);
                      await loadShipment(id);
                      showToast("Tracking refreshed.");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Simulate tracking refresh
              </Button>
              {shipment.label_url ? (
                <a
                  href={shipment.label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-accent px-4 py-2 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
                >
                  Open label
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
                        const blob = await downloadShipmentLabelBlob(token, id, "customer");
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `shipment-${id}-label.pdf`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast("Label downloaded.");
                      } catch {
                        setLabelError("Could not download the label. Try again or contact support.");
                      } finally {
                        setLabelBusy(false);
                      }
                    })();
                  }}
                >
                  {labelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download label (PDF)
                </Button>
              ) : null}
            </div>
            {labelError ? <p className="mt-2 text-sm text-accent-red">{labelError}</p> : null}
          </Card>

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
                <pre className="mono mt-3 max-h-48 overflow-auto rounded-lg bg-surface-deep p-3 text-xs">
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
        </div>

        <div className="lg:col-span-2">
          <Card className="!p-5">
            <h3
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Tracking history
            </h3>
            <p className="mt-1 text-xs text-text-muted">
              <code className="mono">POST /api/customer/shipments/{"{id}"}/track</code>
            </p>
            <div className="mt-4">
              <TrackingTimeline logs={logs} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

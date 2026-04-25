"use client";

import { Download, Loader2, Lock, Package, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { FedExResponseSummary } from "@/components/shipping/fedex-response-summary";
import { ShipmentAddressCard } from "@/components/shipping/shipment-address-card";
import { ShipmentPackageCard } from "@/components/shipping/shipment-package-card";
import { StatusBadge } from "@/components/shipping/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { downloadShipmentLabelBlob, fetchFedExShipmentJobStatus } from "@/lib/api/shipments";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";
import {
  DASHBOARD_CARD_INSET,
  DASHBOARD_GRADIENT_CARD_CLASS,
  DASHBOARD_SECTION_HEADER_CLASS,
} from "@/lib/dashboardCardStyles";

const CTA_OUTLINE =
  "admin-dashboard-cta inline-flex h-auto min-h-11 min-w-0 w-full max-w-full shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border-2 border-accent-amber bg-transparent px-6 py-2.5 text-sm font-semibold text-accent-amber transition-[filter,transform,background] duration-200 sm:w-auto sm:min-w-[12rem] motion-safe:hover:bg-[var(--selection-tint)] motion-safe:active:scale-[0.98]";

const CTA_LINK_SECONDARY =
  "inline-flex h-auto min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border-accent bg-transparent px-6 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 sm:w-auto sm:min-w-[10rem] hover:border-accent-amber hover:text-text-primary";

const PRIMARY_ACTION =
  "h-auto !min-h-11 w-full !min-w-0 !px-8 py-3 sm:min-w-[12rem] sm:max-w-[min(100%,20rem)]";

export default function CustomerShipmentDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const { getShipment, loadShipment } = useApiStore();
  const shipment = getShipment(id);
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
      <div className="max-w-6xl space-y-5">
        <p className="text-base text-text-secondary">Invalid shipment.</p>
        <Link href="/customer/shipments" className="text-base font-semibold text-accent-blue">
          Back to list
        </Link>
      </div>
    );
  }

  if (!user) {
    return <p className="text-base text-text-secondary">Loading session…</p>;
  }

  if (loadError) {
    return (
      <div className="max-w-6xl space-y-5">
        <p className="text-base text-text-secondary">{loadError}</p>
        <Link href="/customer/shipments" className="text-base font-semibold text-accent-blue">
          Back to my shipments
        </Link>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="max-w-6xl space-y-5">
        <p className="text-base text-text-secondary">Loading…</p>
        <Link href="/customer/shipments" className="text-base font-semibold text-accent-blue">
          Back to list
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-6xl space-y-5">
        <p className="text-base text-text-secondary">
          This shipment belongs to another account (or you are not signed in as its owner).
        </p>
        <Link href="/customer/shipments" className="text-base font-semibold text-accent-blue">
          Back to my shipments
        </Link>
      </div>
    );
  }

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
          <h1
            className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Shipment details
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            <span className="font-medium text-text-primary">Tracking {shipment.tracking_number}</span> ·
            FedEx label and delivery status
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Link
            href="/customer/shipments"
            className={CTA_OUTLINE}
          >
            <Package className="h-5 w-5 shrink-0" aria-hidden />
            My shipments
          </Link>
        </div>
      </div>

      <Link
        href="/customer/shipments"
        className="-mt-1 inline-flex text-sm font-semibold text-accent-blue hover:text-accent-amber"
      >
        ← Back to list
      </Link>

      <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
        <div
          className={`${DASHBOARD_SECTION_HEADER_CLASS} flex flex-wrap items-center justify-between gap-4 sm:min-h-[3.5rem]`}
          style={DASHBOARD_CARD_INSET}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 sm:gap-4">
            <h2
              className="mono min-w-0 break-all text-2xl font-bold leading-tight text-accent-amber sm:text-3xl"
            >
              {shipment.tracking_number}
            </h2>
            <StatusBadge status={shipment.status} size="lg" />
          </div>
        </div>
        <div className="border-b border-border-subtle" style={DASHBOARD_CARD_INSET}>
          <p className="text-base text-text-secondary">
            Last updated{" "}
            <span className="mono tabular-nums text-text-primary">
              {new Date(shipment.updated_at).toLocaleString()}
            </span>
          </p>
        </div>
        <div
          className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
          style={DASHBOARD_CARD_INSET}
        >
          <Link
            href={`/customer/tracking?q=${encodeURIComponent(shipment.tracking_number)}`}
            className={`${CTA_OUTLINE} sm:w-auto`}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            Track on FedEx
          </Link>
          {shipment.label_url ? (
            <a
              href={shipment.label_url}
              target="_blank"
              rel="noopener noreferrer"
              className={CTA_LINK_SECONDARY}
            >
              Open label
            </a>
          ) : null}
          {shipment.label_path && token ? (
            <Button
              variant="primary"
              disabled={labelBusy}
              className={PRIMARY_ACTION}
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
              {labelBusy ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Download className="h-5 w-5 shrink-0" />}
              <span>Download label (PDF)</span>
            </Button>
          ) : null}
        </div>
        {labelError ? (
          <p className="border-t border-border-subtle text-sm text-accent-red" style={DASHBOARD_CARD_INSET}>
            {labelError}
          </p>
        ) : null}
      </Card>

      <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <ShipmentAddressCard title="Shipper" accent="blue" address={shipment.sender_details} />
        <ShipmentAddressCard
          title="Recipient"
          accent="amber"
          address={shipment.receiver_details}
          titleExtra={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-accent bg-[var(--amber-dim)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-amber">
              <Lock className="h-3 w-3" aria-hidden />
              Fixed address
            </span>
          }
        />
      </div>
      <ShipmentPackageCard pkg={shipment.package_details} />
      <FedExResponseSummary data={shipment.fedex_response} />

      {shipment.fedex_job_id && token ? (
        <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
          <div className={DASHBOARD_SECTION_HEADER_CLASS} style={DASHBOARD_CARD_INSET}>
            <h3
              className="text-lg font-bold text-text-primary"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              FedEx async job
            </h3>
            <p className="mt-2 text-sm text-text-muted">
              Job ID <span className="mono text-base text-accent-amber">{shipment.fedex_job_id}</span>
            </p>
          </div>
          <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
            {jobError ? <p className="text-sm text-accent-red">{jobError}</p> : null}
            {jobOutput ? (
              <pre className="mono mt-3 max-h-48 overflow-auto rounded-[var(--radius-md)] border border-border-default !bg-white p-4 text-sm leading-relaxed">
                {jobOutput}
              </pre>
            ) : null}
            <Button
              variant="secondary"
              className="mt-4 min-w-0 sm:min-w-[10rem]"
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
          </div>
        </Card>
      ) : null}
    </div>
  );
}

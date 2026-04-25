"use client";

import { ChevronLeft, Package } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { useApiStore } from "@/lib/api/store";
import { UsAddressFields } from "@/components/shipping/UsAddressFields";
import {
  digitsOnlyPhone,
  FEDEX_ADDRESS_COMPLIANCE_MESSAGE,
  validateUsAddressForFedExSubmission,
} from "@/lib/fedexAddressValidation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AddressDetails, PackageDetails } from "@/lib/types";

const SELECT =
  "mt-1.5 w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-sm text-text-primary transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)]";

const LABEL = "block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted";

function emptyAddress(label: string): AddressDetails {
  return {
    name: label,
    company: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
  };
}

function SectionCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="!overflow-hidden !p-0 !shadow-card ring-1 ring-slate-900/[0.04]">
      <div className="flex items-center gap-3 border-b border-border-default bg-surface-raised/40 px-5 py-4 sm:px-6">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums text-accent-amber ring-1 ring-accent-amber/20"
          style={{ background: "var(--accent-amber-glow)" }}
        >
          {step}
        </span>
        <h3
          className="text-base font-bold tracking-tight text-text-primary"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {title}
        </h3>
      </div>
      <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </Card>
  );
}

export default function AdminNewShipmentPage() {
  const router = useRouter();
  const { listUsers, refreshUsers, createAdminShipment } = useApiStore();
  const allUsers = listUsers();
  const [userId, setUserId] = useState<number | "">("");
  const [sender, setSender] = useState<AddressDetails>(() => emptyAddress("Sender"));
  const [receiver, setReceiver] = useState<AddressDetails>(() => emptyAddress("Receiver"));
  const [pkg, setPkg] = useState<PackageDetails>({
    weightLb: 1,
    lengthIn: 12,
    widthIn: 9,
    heightIn: 6,
    description: "Admin-created shipment",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const customers = useMemo(() => allUsers.filter((u) => u.role === "customer"), [allUsers]);

  const setAddr =
    (which: "sender" | "receiver") =>
    (field: keyof AddressDetails, value: string) => {
      if (which === "sender") setSender((a) => ({ ...a, [field]: value }));
      else setReceiver((a) => ({ ...a, [field]: value }));
    };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8 w-full">
        <Link
          href="/admin/shipments"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent-blue transition-colors hover:text-accent-amber"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          All shipments
        </Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1
              className="text-2xl font-bold tracking-tight text-text-primary md:text-3xl"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              New shipment
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
              Assign to a customer account, then add sender, receiver, and package details. Creates via{" "}
              <code className="mono rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
                POST /api/admin/shipments
              </code>
              .
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-amber-glow)] ring-1 ring-accent-amber/25 sm:mt-0">
            <Package className="h-5 w-5 text-accent-amber" aria-hidden />
          </div>
        </div>
      </header>

      {error ? (
        <p
          className="mb-6 rounded-xl border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (userId === "") {
            setError("Select a customer (owner).");
            return;
          }
          if (!sender.street1.trim() || !receiver.street1.trim()) {
            setError("Sender and receiver need at least street line 1.");
            return;
          }
          void (async () => {
            const s = { ...sender, name: sender.name.trim() || "Sender", phone: digitsOnlyPhone(sender.phone) };
            const r = { ...receiver, name: receiver.name.trim() || "Receiver", phone: digitsOnlyPhone(receiver.phone) };
            if (!(await validateUsAddressForFedExSubmission(s)) || !(await validateUsAddressForFedExSubmission(r))) {
              setError(FEDEX_ADDRESS_COMPLIANCE_MESSAGE);
              return;
            }
            setBusy(true);
            try {
              const created = await createAdminShipment({
                user_id: userId,
                sender_details: s,
                receiver_details: r,
                package_details: {
                  ...pkg,
                  description: pkg.description.trim() || "Shipment",
                  weightLb: Math.max(0.1, pkg.weightLb),
                  lengthIn: Math.max(1, pkg.lengthIn),
                  widthIn: Math.max(1, pkg.widthIn),
                  heightIn: Math.max(1, pkg.heightIn),
                },
              });
              router.push(`/admin/shipments/${created.id}`);
            } catch (err) {
              setError(err instanceof ApiError ? err.message : "Could not create shipment.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <SectionCard step={1} title="Owner">
          <div>
            <label className={LABEL}>Customer</label>
            <select
              required
              className={SELECT}
              value={userId === "" ? "" : String(userId)}
              onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
            {customers.length === 0 ? (
              <p className="mt-2 text-xs text-text-muted">No customer users in the system yet. Seed users first.</p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard step={2} title="Sender">
          <div className="space-y-4">
            <Field label="Name" value={sender.name} onChange={(v) => setAddr("sender")("name", v)} />
            <UsAddressFields
              value={sender}
              onChange={setSender}
              idPrefix="admin-sender"
              selectClassName={SELECT}
              labelClassName={LABEL}
              inputClassName="mt-1.5 w-full"
              phoneField={{
                value: sender.phone,
                onChange: (v) => setAddr("sender")("phone", digitsOnlyPhone(v).slice(0, 15)),
                maxLength: 15,
                inputMode: "numeric",
                autoComplete: "tel",
              }}
            />
            <Field
              label="Street 1"
              value={sender.street1}
              maxLength={150}
              onChange={(v) => setAddr("sender")("street1", v)}
            />
          </div>
        </SectionCard>

        <SectionCard step={3} title="Receiver">
          <div className="space-y-4">
            <Field label="Name" value={receiver.name} onChange={(v) => setAddr("receiver")("name", v)} />
            <UsAddressFields
              value={receiver}
              onChange={setReceiver}
              idPrefix="admin-receiver"
              selectClassName={SELECT}
              labelClassName={LABEL}
              inputClassName="mt-1.5 w-full"
              phoneField={{
                value: receiver.phone,
                onChange: (v) => setAddr("receiver")("phone", digitsOnlyPhone(v).slice(0, 15)),
                maxLength: 15,
                inputMode: "numeric",
                autoComplete: "tel",
              }}
            />
            <Field
              label="Street 1"
              value={receiver.street1}
              maxLength={150}
              onChange={(v) => setAddr("receiver")("street1", v)}
            />
          </div>
        </SectionCard>

        <SectionCard step={4} title="Package">
          <div className="space-y-4">
            <Field
              label="Description"
              value={pkg.description}
              onChange={(v) => setPkg((p) => ({ ...p, description: v }))}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3">
              <Field
                label="Weight (lb)"
                value={String(pkg.weightLb)}
                onChange={(v) => setPkg((p) => ({ ...p, weightLb: Number(v) || 0 }))}
              />
              <Field
                label="Length (in)"
                value={String(pkg.lengthIn)}
                onChange={(v) => setPkg((p) => ({ ...p, lengthIn: Number(v) || 0 }))}
              />
              <Field
                label="Width (in)"
                value={String(pkg.widthIn)}
                onChange={(v) => setPkg((p) => ({ ...p, widthIn: Number(v) || 0 }))}
              />
              <Field
                label="Height (in)"
                value={String(pkg.heightIn)}
                onChange={(v) => setPkg((p) => ({ ...p, heightIn: Number(v) || 0 }))}
              />
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <Link
            href="/admin/shipments"
            className="inline-flex items-center justify-center rounded-lg border border-border-accent px-4 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary sm:min-w-[120px]"
          >
            Cancel
          </Link>
          <Button type="submit" variant="primary" className="w-full sm:w-auto sm:min-w-[160px]" disabled={busy}>
            {busy ? "Creating…" : "Create shipment"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  maxLength,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  inputMode?: "numeric" | "text" | "tel" | "search" | "email" | "url" | "decimal" | "none";
  autoComplete?: string;
}) {
  return (
    <div className="min-w-0">
      <label className={LABEL}>{label}</label>
      <Input
        className="mt-1.5 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
      />
    </div>
  );
}

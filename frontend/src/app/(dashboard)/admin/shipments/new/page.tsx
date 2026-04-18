"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useApiStore } from "@/lib/api/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AddressDetails, PackageDetails } from "@/lib/types";

const SELECT =
  "mt-1 w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-sm text-text-primary transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)]";

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
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link href="/admin/shipments" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
          All shipments
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-text-primary">New shipment (stub)</h2>
        <p className="mt-1 text-sm text-text-secondary">
          <code className="mono rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
            POST /api/admin/shipments
          </code>{" "}
          — assigns to a customer; label uses server stub FedEx flow.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {error}
        </p>
      ) : null}

      <form
        className="space-y-8"
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
          setBusy(true);
          void (async () => {
            try {
              const created = await createAdminShipment({
                user_id: userId,
                sender_details: { ...sender, name: sender.name.trim() || "Sender" },
                receiver_details: { ...receiver, name: receiver.name.trim() || "Receiver" },
                package_details: {
                  ...pkg,
                  description: pkg.description.trim() || "Shipment",
                  weightLb: Math.max(0.01, pkg.weightLb),
                  lengthIn: Math.max(0.01, pkg.lengthIn),
                  widthIn: Math.max(0.01, pkg.widthIn),
                  heightIn: Math.max(0.01, pkg.heightIn),
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
        <Card className="!p-5">
          <h3 className="text-sm font-bold text-text-primary">Owner</h3>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-text-muted">
            Customer
          </label>
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
        </Card>

        <Card className="!p-5">
          <h3 className="text-sm font-bold text-text-primary">Sender</h3>
          <div className="mt-4 space-y-3">
            <Field label="Name" value={sender.name} onChange={(v) => setAddr("sender")("name", v)} />
            <Field label="Street 1" value={sender.street1} onChange={(v) => setAddr("sender")("street1", v)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City" value={sender.city} onChange={(v) => setAddr("sender")("city", v)} />
              <Field label="State" value={sender.state} onChange={(v) => setAddr("sender")("state", v)} />
              <Field label="Postal" value={sender.postalCode} onChange={(v) => setAddr("sender")("postalCode", v)} />
              <Field label="Country" value={sender.country} onChange={(v) => setAddr("sender")("country", v)} />
              <Field label="Phone" value={sender.phone} onChange={(v) => setAddr("sender")("phone", v)} />
            </div>
          </div>
        </Card>

        <Card className="!p-5">
          <h3 className="text-sm font-bold text-text-primary">Receiver</h3>
          <div className="mt-4 space-y-3">
            <Field label="Name" value={receiver.name} onChange={(v) => setAddr("receiver")("name", v)} />
            <Field label="Street 1" value={receiver.street1} onChange={(v) => setAddr("receiver")("street1", v)} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="City" value={receiver.city} onChange={(v) => setAddr("receiver")("city", v)} />
              <Field label="State" value={receiver.state} onChange={(v) => setAddr("receiver")("state", v)} />
              <Field
                label="Postal"
                value={receiver.postalCode}
                onChange={(v) => setAddr("receiver")("postalCode", v)}
              />
              <Field
                label="Country"
                value={receiver.country}
                onChange={(v) => setAddr("receiver")("country", v)}
              />
              <Field label="Phone" value={receiver.phone} onChange={(v) => setAddr("receiver")("phone", v)} />
            </div>
          </div>
        </Card>

        <Card className="!p-5">
          <h3 className="text-sm font-bold text-text-primary">Package</h3>
          <div className="mt-4 space-y-3">
            <Field
              label="Description"
              value={pkg.description}
              onChange={(v) => setPkg((p) => ({ ...p, description: v }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
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
        </Card>

        <div className="flex justify-end gap-2">
          <Link
            href="/admin/shipments"
            className="inline-flex items-center justify-center rounded-lg border border-border-accent px-4 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
          >
            Cancel
          </Link>
          <Button type="submit" variant="primary" disabled={busy}>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</label>
      <Input className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

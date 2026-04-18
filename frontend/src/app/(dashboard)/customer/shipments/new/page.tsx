"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiStore } from "@/lib/api/store";
import type { AddressDetails, PackageDetails } from "@/lib/types";

function emptyAddress(placeholderName: string): AddressDetails {
  return {
    name: placeholderName,
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

export default function CustomerNewShipmentPage() {
  const router = useRouter();
  const { createShipment } = useApiStore();
  const [sender, setSender] = useState<AddressDetails>(() => emptyAddress(""));
  const [receiver, setReceiver] = useState<AddressDetails>(() => emptyAddress(""));
  const [pkg, setPkg] = useState<PackageDetails>({
    weightLb: 2,
    lengthIn: 12,
    widthIn: 9,
    heightIn: 6,
    description: "",
  });
  const [error, setError] = useState<string | null>(null);

  const setAddr =
    (which: "sender" | "receiver") =>
    (field: keyof AddressDetails, value: string) => {
      if (which === "sender") setSender((a) => ({ ...a, [field]: value }));
      else setReceiver((a) => ({ ...a, [field]: value }));
    };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href="/customer/shipments"
          className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          My shipments
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">New shipment</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Submits to <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">POST /api/customer/shipments</code>{" "}
          (stub FedEx label on the server).
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <form
        className="space-y-8"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (!receiver.name.trim() || !receiver.street1.trim() || !receiver.city.trim()) {
            setError("Please fill receiver name, street, and city.");
            return;
          }
          try {
            const created = await createShipment({
              sender_details: { ...sender, name: sender.name || "Sender" },
              receiver_details: receiver,
              package_details: {
                ...pkg,
                description: pkg.description || "General merchandise",
              },
            });
            router.push(`/customer/shipments/${created.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Request failed");
          }
        }}
      >
        <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Sender
          </legend>
          <Field label="Name" value={sender.name} onChange={(v) => setAddr("sender")("name", v)} />
          <Field label="Street" value={sender.street1} onChange={(v) => setAddr("sender")("street1", v)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City" value={sender.city} onChange={(v) => setAddr("sender")("city", v)} />
            <Field label="State" value={sender.state} onChange={(v) => setAddr("sender")("state", v)} />
            <Field
              label="Postal code"
              value={sender.postalCode}
              onChange={(v) => setAddr("sender")("postalCode", v)}
            />
            <Field label="Phone" value={sender.phone} onChange={(v) => setAddr("sender")("phone", v)} />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Receiver
          </legend>
          <Field label="Name" value={receiver.name} onChange={(v) => setAddr("receiver")("name", v)} required />
          <Field
            label="Street"
            value={receiver.street1}
            onChange={(v) => setAddr("receiver")("street1", v)}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City" value={receiver.city} onChange={(v) => setAddr("receiver")("city", v)} required />
            <Field label="State" value={receiver.state} onChange={(v) => setAddr("receiver")("state", v)} />
            <Field
              label="Postal code"
              value={receiver.postalCode}
              onChange={(v) => setAddr("receiver")("postalCode", v)}
            />
            <Field label="Phone" value={receiver.phone} onChange={(v) => setAddr("receiver")("phone", v)} />
          </div>
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Package</legend>
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
        </fieldset>

        <div className="flex justify-end gap-2">
          <Link
            href="/customer/shipments"
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create shipment
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500">{label}</label>
      <input
        className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

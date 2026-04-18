"use client";

import { MapPin, Phone, User } from "lucide-react";
import type { AddressDetails } from "@/lib/types";

export function ShipmentAddressCard({
  title,
  accent,
  address,
}: {
  title: string;
  accent: "blue" | "amber";
  address: AddressDetails;
}) {
  const lines = [address.street1, address.street2].filter(Boolean).join(", ");
  const topAccent =
    accent === "blue" ? "border-t-accent-blue" : "border-t-accent-amber";

  return (
    <div
      className={`rounded-xl border border-border-default border-t-[3px] bg-surface-raised p-5 ${topAccent}`}
    >
      <h3
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-text-secondary"
        style={{ fontFamily: "var(--font-syne), sans-serif" }}
      >
        {title}
      </h3>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex gap-2">
          <User className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <div>
            <dt className="sr-only">Name</dt>
            <dd className="font-medium text-text-primary">{address.name}</dd>
            {address.company ? (
              <dd className="text-text-secondary">{address.company}</dd>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <div>
            <dt className="sr-only">Phone</dt>
            <dd className="mono text-text-primary tabular-nums">{address.phone}</dd>
          </div>
        </div>
        <div className="flex gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          <div>
            <dt className="sr-only">Address</dt>
            <dd className="text-text-primary">{lines}</dd>
            <dd className="text-text-secondary">
              {address.city}, {address.state} {address.postalCode}
            </dd>
            <dd className="text-text-muted">{address.country}</dd>
          </div>
        </div>
      </dl>
    </div>
  );
}

"use client";

import { Box } from "lucide-react";
import type { PackageDetails } from "@/lib/types";

export function ShipmentPackageCard({ pkg }: { pkg: PackageDetails }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-5">
      <h3
        className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-text-secondary"
        style={{ fontFamily: "var(--font-syne), sans-serif" }}
      >
        <Box className="h-4 w-4 text-accent-amber" aria-hidden />
        Package
      </h3>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-text-muted">Weight</dt>
          <dd className="mono mt-1 font-medium tabular-nums text-text-primary">
            {pkg.weightLb} lb
          </dd>
        </div>
        <div>
          <dt className="text-text-muted">Dimensions (in)</dt>
          <dd className="mono mt-1 font-medium tabular-nums text-text-primary">
            {pkg.lengthIn} × {pkg.widthIn} × {pkg.heightIn}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-text-muted">Description</dt>
          <dd className="mt-1 text-text-primary">{pkg.description}</dd>
        </div>
      </dl>
    </div>
  );
}

"use client";

import { Box } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DASHBOARD_CARD_INSET,
  DASHBOARD_GRADIENT_CARD_CLASS,
  DASHBOARD_SECTION_HEADER_CLASS,
} from "@/lib/dashboardCardStyles";
import type { PackageDetails } from "@/lib/types";

const DT =
  "mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:tracking-wide";
const DD = "mono text-xl font-semibold tabular-nums leading-snug text-text-primary sm:text-2xl";

export function ShipmentPackageCard({ pkg }: { pkg: PackageDetails }) {
  return (
    <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
      <div
        className={`${DASHBOARD_SECTION_HEADER_CLASS} flex flex-wrap items-center gap-3`}
        style={DASHBOARD_CARD_INSET}
      >
        <h3
          className="flex items-center gap-2.5 text-lg font-bold text-text-primary"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          <Box className="h-5 w-5 shrink-0 text-accent-amber" aria-hidden />
          Package
        </h3>
      </div>
      <div className="min-w-0 space-y-6" style={DASHBOARD_CARD_INSET}>
        <dl className="grid w-full min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4 md:gap-x-8 md:gap-y-6">
          <div className="min-h-[4.25rem] rounded-[var(--radius-md)] border border-border-subtle/80 bg-surface-raised/30 px-4 py-3 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <dt className={DT}>Weight</dt>
            <dd className={DD}>{pkg.weightLb} lb</dd>
          </div>
          <div className="min-h-[4.25rem] rounded-[var(--radius-md)] border border-border-subtle/80 bg-surface-raised/30 px-4 py-3 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <dt className={DT}>Length (in)</dt>
            <dd className={DD}>{pkg.lengthIn}</dd>
          </div>
          <div className="min-h-[4.25rem] rounded-[var(--radius-md)] border border-border-subtle/80 bg-surface-raised/30 px-4 py-3 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <dt className={DT}>Width (in)</dt>
            <dd className={DD}>{pkg.widthIn}</dd>
          </div>
          <div className="min-h-[4.25rem] rounded-[var(--radius-md)] border border-border-subtle/80 bg-surface-raised/30 px-4 py-3 sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
            <dt className={DT}>Height (in)</dt>
            <dd className={DD}>{pkg.heightIn}</dd>
          </div>
        </dl>
        <div className="border-t border-border-subtle pt-2">
          <dl className="min-w-0">
            <dt className="mb-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-sm sm:tracking-wide">
              Description
            </dt>
            <dd className="text-base font-medium leading-relaxed text-text-primary sm:text-lg">
              {pkg.description}
            </dd>
          </dl>
        </div>
      </div>
    </Card>
  );
}

"use client";

import type { ShipmentStatus } from "@/lib/types";

const labels: Record<ShipmentStatus, string> = {
  pending: "Pending",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Failed",
  label_created: "Label created",
  cancelled: "Cancelled",
};

const styleVars: Record<
  ShipmentStatus,
  { fg: string; bg: string; pulse?: boolean; dot?: boolean }
> = {
  pending: {
    fg: "var(--status-pending-fg)",
    bg: "var(--status-pending-bg)",
    dot: true,
  },
  in_transit: {
    fg: "var(--status-in-transit-fg)",
    bg: "var(--status-in-transit-bg)",
    dot: true,
    pulse: true,
  },
  delivered: {
    fg: "var(--status-delivered-fg)",
    bg: "var(--status-delivered-bg)",
    dot: false,
  },
  failed: {
    fg: "var(--status-failed-fg)",
    bg: "var(--status-failed-bg)",
    dot: true,
  },
  label_created: {
    fg: "var(--status-label-fg)",
    bg: "var(--status-label-bg)",
    dot: false,
  },
  cancelled: {
    fg: "var(--status-cancelled-fg)",
    bg: "var(--status-cancelled-bg)",
    dot: false,
  },
};

export function StatusBadge({
  status,
  size = "default",
}: {
  status: ShipmentStatus;
  size?: "default" | "lg";
}) {
  const cfg = styleVars[status];
  const textSize = size === "lg" ? "text-xs" : "text-[11px]";
  const pad = size === "lg" ? "px-2.5 py-1" : "px-2 py-0.5";

  return (
    <span
      className={`mono inline-flex items-center gap-1.5 rounded font-semibold uppercase tracking-wider tabular-nums ${textSize} ${pad}`}
      style={{
        color: cfg.fg,
        backgroundColor: cfg.bg,
        letterSpacing: "0.08em",
      }}
    >
      {cfg.dot ? (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.pulse ? "animate-pulse-dot motion-reduce:animate-none" : ""}`}
          style={{ backgroundColor: cfg.fg }}
          aria-hidden
        />
      ) : null}
      {labels[status]}
    </span>
  );
}

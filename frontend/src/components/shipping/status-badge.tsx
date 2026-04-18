import type { ShipmentStatus } from "@/lib/types";

const styles: Record<ShipmentStatus, string> = {
  pending:
    "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-100 dark:ring-amber-900",
  in_transit:
    "bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-100 dark:ring-sky-900",
  delivered:
    "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:ring-emerald-900",
  failed:
    "bg-red-100 text-red-900 ring-red-200 dark:bg-red-950/60 dark:text-red-100 dark:ring-red-900",
};

const labels: Record<ShipmentStatus, string> = {
  pending: "Pending",
  in_transit: "In transit",
  delivered: "Delivered",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

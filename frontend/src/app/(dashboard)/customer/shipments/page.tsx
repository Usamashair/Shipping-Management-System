"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { StatusBadge } from "@/components/shipping/status-badge";
import { useAuth } from "@/lib/auth/context";
import { useApiStore } from "@/lib/api/store";

export default function CustomerShipmentsPage() {
  const { user } = useAuth();
  const { listShipments, refreshShipments } = useApiStore();
  const shipments = listShipments({ scope: "mine" });

  useEffect(() => {
    void refreshShipments("mine");
  }, [refreshShipments]);

  const sorted = useMemo(
    () => [...shipments].sort((a, b) => b.id - a.id),
    [shipments],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">My shipments</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as <span className="font-medium">{user?.name}</span> (
            <span className="font-mono">{user?.email}</span>). Data from{" "}
            <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">GET /api/customer/shipments</code>.
          </p>
        </div>
        <Link
          href="/customer/shipments/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New shipment
        </Link>
      </div>

      <DataTable
        columns={[
          { key: "tracking", label: "Tracking #" },
          { key: "to", label: "Ship to" },
          { key: "status", label: "Status", className: "w-32" },
          { key: "actions", label: "", className: "w-24 text-right" },
        ]}
        emptyMessage="You have no shipments yet. Create one to get started."
      >
        {sorted.map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-3 font-mono text-sm text-zinc-800 dark:text-zinc-200">
              {s.tracking_number}
            </td>
            <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
              {s.receiver_details.name}, {s.receiver_details.city}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={s.status} />
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                href={`/customer/shipments/${s.id}`}
                className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                View
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { StatusBadge } from "@/components/shipping/status-badge";
import { useApiStore } from "@/lib/api/store";

const PAGE_SIZE = 5;

export default function AdminShipmentsPage() {
  const { listUsers, listShipments, refreshUsers, refreshShipments } = useApiStore();
  const shipments = listShipments({ scope: "all" });
  const users = listUsers();
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    void refreshUsers();
    void refreshShipments("all");
  }, [refreshUsers, refreshShipments]);

  const sorted = useMemo(
    () => [...shipments].sort((a, b) => b.id - a.id),
    [shipments],
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const slice = sorted.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">All shipments</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Client-side pagination of the list returned by{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs dark:bg-zinc-800">GET /api/admin/shipments</code>.
        </p>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID", className: "w-14" },
          { key: "tracking", label: "Tracking #" },
          { key: "customer", label: "Customer" },
          { key: "status", label: "Status", className: "w-32" },
          { key: "actions", label: "", className: "w-28 text-right" },
        ]}
        emptyMessage="No shipments."
      >
        {slice.map((s) => (
          <tr key={s.id}>
            <td className="px-4 py-3 font-mono text-xs text-zinc-500">{s.id}</td>
            <td className="px-4 py-3 font-mono text-sm text-zinc-800 dark:text-zinc-200">
              {s.tracking_number}
            </td>
            <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
              {userMap.get(s.user_id)?.name ?? `User #${s.user_id}`}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={s.status} />
            </td>
            <td className="px-4 py-3 text-right">
              <Link
                href={`/admin/shipments/${s.id}`}
                className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                View
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>

      {sorted.length > PAGE_SIZE ? (
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            Page {pageSafe + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pageSafe <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-zinc-200 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pageSafe >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="rounded-lg border border-zinc-200 px-3 py-1 disabled:opacity-40 dark:border-zinc-700"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

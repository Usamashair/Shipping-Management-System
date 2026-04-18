"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useApiStore } from "@/lib/api/store";

export default function AdminOverviewPage() {
  const { listUsers, listShipments, refreshUsers, refreshShipments } = useApiStore();
  const users = listUsers();
  const shipments = listShipments({ scope: "all" });

  useEffect(() => {
    void refreshUsers();
    void refreshShipments("all");
  }, [refreshUsers, refreshShipments]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Overview</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Counts load from the Laravel API. Use the sidebar to manage users and shipments.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/users"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
        >
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Users</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{users.length}</p>
        </Link>
        <Link
          href="/admin/shipments"
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
        >
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Shipments</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{shipments.length}</p>
        </Link>
      </div>
    </div>
  );
}

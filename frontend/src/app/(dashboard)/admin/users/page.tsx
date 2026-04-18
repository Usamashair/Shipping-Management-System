"use client";

import { Pencil, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { Button } from "@/components/ui/button";
import { useApiStore } from "@/lib/api/store";

function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 55% 42%)`;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function AdminUsersPage() {
  const { listUsers, refreshUsers, listShipments, refreshShipments } = useApiStore();
  const users = listUsers();
  const shipments = listShipments({ scope: "all" });

  useEffect(() => {
    void refreshUsers();
    void refreshShipments("all");
  }, [refreshUsers, refreshShipments]);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of shipments) {
      m.set(s.user_id, (m.get(s.user_id) ?? 0) + 1);
    }
    return m;
  }, [shipments]);

  const sorted = useMemo(() => [...users].sort((a, b) => a.id - b.id), [users]);

  return (
    <div className="space-y-8">
      <header className="border-b border-border-default pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Directory</p>
            <h1
              className="mt-2 text-2xl font-bold tracking-tight text-text-primary md:text-3xl"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Users
            </h1>
            <p className="mt-2 text-sm text-text-secondary">Manage accounts and roles</p>
          </div>
          <Link href="/admin/users/new">
            <Button className="inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Add user
            </Button>
          </Link>
        </div>
      </header>

      <DataTable
        columns={[
          { key: "avatar", label: "", className: "w-14" },
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role", className: "w-32" },
          { key: "ship", label: "Shipments", className: "w-28 tabular-nums" },
          { key: "joined", label: "Joined", className: "w-28" },
          { key: "actions", label: "Actions", className: "w-24 text-right" },
        ]}
        pageSize={15}
        emptyMessage="No users yet."
      >
        {sorted.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: avatarColor(u.name) }}
              >
                {initials(u.name)}
              </div>
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/admin/users/${u.id}`}
                className="font-medium text-text-primary hover:text-accent-amber"
              >
                {u.name}
              </Link>
            </td>
            <td className="mono px-4 py-3 text-sm text-text-secondary tabular-nums">{u.email}</td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                  u.role === "admin"
                    ? "bg-[var(--accent-amber-glow)] text-accent-amber-bright"
                    : "bg-[rgba(59,130,246,0.15)] text-accent-blue"
                }`}
              >
                {u.role}
              </span>
            </td>
            <td className="mono px-4 py-3 text-sm tabular-nums text-text-secondary">
              {counts.get(u.id) ?? 0}
            </td>
            <td className="px-4 py-3 text-xs text-text-muted">—</td>
            <td className="px-4 py-3 text-right">
              <Link
                href={`/admin/users/${u.id}/edit`}
                className="inline-flex rounded-md p-1.5 text-text-secondary hover:bg-surface-card-hover hover:text-accent-amber"
                aria-label="Edit user"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

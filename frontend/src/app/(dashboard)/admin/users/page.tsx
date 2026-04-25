"use client";

import { ApiError } from "@/lib/api/client";
import { ChevronRight, Pencil, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { UserRole } from "@/lib/types";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";

const FILTERS: { id: UserRole | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "admin", label: "Admin" },
  { id: "customer", label: "Customer" },
];

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
  const { user: authUser } = useAuth();
  const { showToast } = useToast();
  const { listUsers, refreshUsers, deleteUser, listShipments, refreshShipments } = useApiStore();
  const users = listUsers();
  const shipments = listShipments({ scope: "all" });
  const [filter, setFilter] = useState<UserRole | "all">("all");
  const [q, setQ] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const filtered = useMemo(() => {
    let rows = sorted;
    if (filter !== "all") {
      rows = rows.filter((u) => u.role === filter);
    }
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      rows = rows.filter(
        (u) => u.name.toLowerCase().includes(n) || u.email.toLowerCase().includes(n),
      );
    }
    return rows;
  }, [sorted, filter, q]);

  const tableCardClass =
    "admin-overview-recent-card !border-border-subtle !bg-[linear-gradient(135deg,#ffffff_0%,var(--selection-tint)_42%,rgba(77,209,197,0.2)_100%)] !p-0 !shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent hover:ring-accent-amber/10";

  return (
    <div className="flex min-h-0 flex-col gap-[var(--space-8)] pb-[var(--space-8)]">
      <div
        className="admin-dashboard-surface-bg overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle shadow-card ring-1 ring-slate-900/[0.04]"
        style={{
          padding: "var(--ds-card-padding) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div className="min-w-0 flex-1 text-left">
          <h2
            className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Users
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            Manage accounts and roles
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Link
            href="/admin/users/new"
            className="admin-dashboard-cta rounded-[var(--radius-md)] bg-accent-amber text-base font-semibold text-white transition-[filter,transform] duration-200 motion-safe:hover:brightness-110 motion-safe:active:scale-[0.98]"
          >
            <PlusCircle className="h-5 w-5 shrink-0" aria-hidden />
            Add user
          </Link>
        </div>
      </div>

      <Card className={tableCardClass}>
        <div className="admin-recent-shipments-header flex flex-col gap-4 border-b border-border-subtle lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 w-full flex-1 flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
            <Input
              className="max-w-full min-w-0 border-border-default sm:max-w-md sm:flex-1"
              placeholder="Search name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search users"
            />
            <div className="w-full shrink-0 sm:w-[min(100%,220px)]">
              <label
                htmlFor="admin-users-role-filter"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
              >
                Role
              </label>
              <select
                id="admin-users-role-filter"
                className="w-full cursor-pointer rounded-[var(--radius-md)] border border-border-default bg-bg-input py-2.5 pl-3 pr-10 text-sm font-medium text-text-primary shadow-sm focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--amber-glow)]"
                value={filter}
                onChange={(e) => setFilter(e.target.value as UserRole | "all")}
                aria-label="Filter by role"
              >
                {FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span className="text-sm font-medium tabular-nums text-text-muted">
              Showing <span className="text-text-secondary">{filtered.length}</span> of{" "}
              <span className="text-text-secondary">{users.length}</span>
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-b-[var(--radius-lg)]">
          <div className="hidden md:block">
            <DataTable
              embedded
              cellPadClass="px-[var(--space-8)]"
              columns={[
                { key: "user", label: "Name" },
                { key: "role", label: "Role", className: "w-36" },
                { key: "ship", label: "Shipments", className: "w-28 tabular-nums" },
                { key: "joined", label: "Joined", className: "w-28" },
                { key: "actions", label: "Actions", className: "w-28 text-right" },
              ]}
              pageSize={15}
              emptyMessage="No users match your filters."
            >
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="align-middle py-3.5">
                    <div className="flex items-center gap-3.5">
                      <div
                        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: avatarColor(u.name) }}
                      >
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="block text-[15px] font-semibold text-text-primary hover:text-accent-amber"
                        >
                          {u.name}
                        </Link>
                        <p className="mono mt-0.5 text-[13px] text-text-secondary tabular-nums">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="align-middle py-3.5">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-[5px] px-3 py-1 text-xs font-bold uppercase tracking-[0.06em] ${
                        u.role === "admin"
                          ? "bg-[var(--accent-amber-glow)] text-accent-amber-bright"
                          : "bg-[rgba(59,130,246,0.15)] text-accent-blue"
                      }`}
                      style={{ fontFamily: "var(--font-mono), monospace" }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="mono align-middle py-3.5 text-sm tabular-nums text-text-secondary">
                    {counts.get(u.id) ?? 0}
                  </td>
                  <td className="align-middle py-3.5 text-xs text-text-muted">—</td>
                  <td className="align-middle py-3.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-0.5">
                      <Link
                        href={`/admin/users/${u.id}/edit`}
                        className="inline-flex rounded-md p-1.5 text-text-secondary hover:bg-surface-card-hover hover:text-accent-amber"
                        aria-label="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {authUser && u.id !== authUser.id ? (
                        <button
                          type="button"
                          disabled={deletingId === u.id}
                          className="inline-flex rounded-md p-1.5 text-text-secondary hover:bg-red-500/10 hover:text-accent-red disabled:opacity-50"
                          aria-label="Delete user"
                          title="Delete user"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Delete user “${u.name}”? This cannot be undone. Shipments for this account are removed from the database.`,
                              )
                            ) {
                              return;
                            }
                            setDeletingId(u.id);
                            void (async () => {
                              try {
                                await deleteUser(u.id);
                                showToast("User deleted.");
                              } catch (e) {
                                showToast(e instanceof ApiError ? e.message : "Could not delete user.");
                              } finally {
                                setDeletingId(null);
                              }
                            })();
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4 md:hidden">
        {filtered.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-card px-[var(--space-8)] py-10 text-center text-sm text-text-secondary shadow-card ring-1 ring-slate-900/[0.04]">
            No users match your filters.
          </p>
        ) : null}
        {filtered.map((u) => (
          <div
            key={u.id}
            className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-card px-[var(--space-8)] py-[var(--ds-card-padding)] shadow-card ring-1 ring-slate-900/[0.04]"
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: avatarColor(u.name) }}
              >
                {initials(u.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-[15px] font-semibold text-text-primary hover:text-accent-amber"
                  >
                    {u.name}
                  </Link>
                  <span
                    className={`inline-flex shrink-0 whitespace-nowrap rounded-[5px] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${
                      u.role === "admin"
                        ? "bg-[var(--accent-amber-glow)] text-accent-amber-bright"
                        : "bg-[rgba(59,130,246,0.15)] text-accent-blue"
                    }`}
                    style={{ fontFamily: "var(--font-mono), monospace" }}
                  >
                    {u.role}
                  </span>
                </div>
                <p className="mono mt-1 text-xs text-text-secondary tabular-nums">{u.email}</p>
                <p className="mt-2 text-xs text-text-muted">
                  <span className="font-medium text-text-secondary">Shipments:</span>{" "}
                  <span className="mono tabular-nums">{counts.get(u.id) ?? 0}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/admin/users/${u.id}/edit`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-accent-blue"
                  >
                    Edit
                    <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-accent-blue"
                  >
                    Profile
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                  {authUser && u.id !== authUser.id ? (
                    <button
                      type="button"
                      disabled={deletingId === u.id}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-accent-red disabled:opacity-50"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete user “${u.name}”? This cannot be undone. Shipments for this account are removed from the database.`,
                          )
                        ) {
                          return;
                        }
                        setDeletingId(u.id);
                        void (async () => {
                          try {
                            await deleteUser(u.id);
                            showToast("User deleted.");
                          } catch (e) {
                            showToast(e instanceof ApiError ? e.message : "Could not delete user.");
                          } finally {
                            setDeletingId(null);
                          }
                        })();
                      }}
                    >
                      Delete
                      <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

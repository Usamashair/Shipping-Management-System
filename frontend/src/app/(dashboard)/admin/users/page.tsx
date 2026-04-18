"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/shipping/data-table";
import { useApiStore } from "@/lib/api/store";
import type { CreateUserInput, UpdateUserInput, UserRole } from "@/lib/types";

export default function AdminUsersPage() {
  const { listUsers, refreshUsers, createUser, updateUser, deleteUser } = useApiStore();
  const users = listUsers();
  const [openCreate, setOpenCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const sorted = useMemo(
    () => [...users].sort((a, b) => a.id - b.id),
    [users],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Users</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create, update, or delete users via the Laravel API (admin only).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Add user
        </button>
      </div>

      <DataTable
        columns={[
          { key: "id", label: "ID", className: "w-14" },
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role", className: "w-28" },
          { key: "actions", label: "", className: "w-40 text-right" },
        ]}
        emptyMessage="No users yet."
      >
        {sorted.map((u) => (
          <tr key={u.id}>
            <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.id}</td>
            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{u.name}</td>
            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{u.email}</td>
            <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">{u.role}</td>
            <td className="px-4 py-3 text-right">
              <button
                type="button"
                onClick={() => setEditId(u.id)}
                className="mr-2 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete user ${u.name}?`)) void deleteUser(u.id);
                }}
                className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </DataTable>

      {openCreate ? (
        <UserFormModal
          key="create-user"
          title="Create user"
          mode="create"
          onClose={() => setOpenCreate(false)}
          onSave={async (data) => {
            await createUser(data as CreateUserInput);
            setOpenCreate(false);
          }}
        />
      ) : null}

      {editId !== null ? (
        <UserFormModal
          key={`edit-user-${editId}`}
          title="Edit user"
          mode="edit"
          initial={sorted.find((u) => u.id === editId)}
          onClose={() => setEditId(null)}
          onSave={async (data) => {
            await updateUser(editId, data as UpdateUserInput);
            setEditId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function UserFormModal({
  title,
  mode,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  mode: "create" | "edit";
  initial?: { name: string; email: string; role: UserRole };
  onClose: () => void;
  onSave: (data: CreateUserInput | UpdateUserInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<UserRole>(initial?.role ?? "customer");
  const [password, setPassword] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim() || !email.trim()) return;
            if (mode === "create" && password.length < 8) return;
            if (mode === "create") {
              await onSave({
                name: name.trim(),
                email: email.trim(),
                role,
                password,
              });
            } else {
              const payload: UpdateUserInput = {
                name: name.trim(),
                email: email.trim(),
                role,
              };
              if (password.trim()) payload.password = password.trim();
              await onSave(payload);
            }
          }}
        >
          <div>
            <label className="block text-xs font-medium text-zinc-500">Name</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">
              Password {mode === "edit" ? "(leave blank to keep)" : ""}
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={mode === "create"}
              minLength={mode === "create" ? 8 : undefined}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">Role</label>
            <select
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

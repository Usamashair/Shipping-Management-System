"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useApiStore } from "@/lib/api/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/lib/types";

const SELECT =
  "mt-1 w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-sm text-text-primary transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)]";

export default function AdminEditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { loadUser, getUser, updateUser } = useApiStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    startTransition(() => setLoadError(null));
    void loadUser(id).catch(() => {
      startTransition(() => setLoadError("User not found or inaccessible."));
    });
  }, [id, loadUser]);

  const existing = Number.isFinite(id) ? getUser(id) : undefined;

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setEmail(existing.email);
    setRole(existing.role);
    setPassword("");
  }, [existing]);

  if (!Number.isFinite(id)) {
    return (
      <p className="text-sm text-text-secondary">
        Invalid user.{" "}
        <Link href="/admin/users" className="font-semibold text-accent-blue">
          Back
        </Link>
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-text-secondary">{loadError}</p>
        <Link href="/admin/users" className="text-sm font-semibold text-accent-blue">
          Back to users
        </Link>
      </div>
    );
  }

  if (!existing) {
    return <p className="text-sm text-text-secondary">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href={`/admin/users/${id}`} className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
          User #{id}
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-text-primary">Edit user</h2>
        <p className="mt-1 text-sm text-text-secondary">
          <code className="mono rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
            PUT /api/admin/users/{id}
          </code>
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {error}
        </p>
      ) : null}

      <Card className="!p-5">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!name.trim() || !email.trim()) {
              setError("Name and email are required.");
              return;
            }
            setBusy(true);
            void (async () => {
              try {
                const payload: {
                  name: string;
                  email: string;
                  role: UserRole;
                  password?: string;
                } = {
                  name: name.trim(),
                  email: email.trim(),
                  role,
                };
                if (password.trim()) payload.password = password.trim();
                await updateUser(id, payload);
                router.push(`/admin/users/${id}`);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Could not update user.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <Field label="Name" value={name} onChange={setName} required />
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password (leave blank to keep)" type="password" value={password} onChange={setPassword} />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">Role</label>
            <select className={SELECT} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link
              href={`/admin/users/${id}`}
              className="inline-flex items-center justify-center rounded-lg border border-border-accent px-4 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
            >
              Cancel
            </Link>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</label>
      <Input
        type={type}
        className="mt-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

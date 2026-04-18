"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useApiStore } from "@/lib/api/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/lib/types";

const SELECT =
  "mt-1 w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-sm text-text-primary transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)]";

export default function AdminNewUserPage() {
  const router = useRouter();
  const { createUser } = useApiStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
          Users
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-text-primary">New user</h2>
        <p className="mt-1 text-sm text-text-secondary">
          <code className="mono rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
            POST /api/admin/users
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
            if (!name.trim() || !email.trim() || password.length < 8) {
              setError("Name and email are required; password must be at least 8 characters.");
              return;
            }
            setBusy(true);
            void (async () => {
              try {
                const created = await createUser({
                  name: name.trim(),
                  email: email.trim(),
                  password,
                  role,
                });
                router.push(`/admin/users/${created.id}`);
              } catch (err) {
                setError(err instanceof ApiError ? err.message : "Could not create user.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <Field label="Name" value={name} onChange={setName} required />
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            required
            minLength={8}
          />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">Role</label>
            <select
              className={SELECT}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link
              href="/admin/users"
              className="inline-flex items-center justify-center rounded-lg border border-border-accent px-4 py-2.5 text-sm font-semibold text-text-secondary transition-all duration-200 hover:border-accent-amber hover:text-text-primary"
            >
              Cancel
            </Link>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : "Create user"}
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
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
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
        minLength={minLength}
      />
    </div>
  );
}

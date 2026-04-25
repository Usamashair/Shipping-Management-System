"use client";

import { ChevronLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { UserRole } from "@/lib/types";

/** Same horizontal + vertical inset as the hero strip (“Edit user” block) */
const ADMIN_SECTION_INSET: CSSProperties = {
  boxSizing: "border-box",
  padding: "var(--ds-card-padding) var(--space-8)",
};

const ROLE_SELECT =
  "w-full cursor-pointer rounded-[var(--radius-md)] border border-border-default bg-bg-input py-2.5 pl-3 pr-10 text-sm font-medium text-text-primary shadow-sm focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--amber-glow)]";

const FORM_CARD_CLASS =
  "admin-overview-recent-card !border-border-subtle !bg-[linear-gradient(135deg,#ffffff_0%,var(--selection-tint)_42%,rgba(77,209,197,0.2)_100%)] !p-0 !shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent hover:ring-accent-amber/10";

export default function AdminEditUserPage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { showToast } = useToast();
  const id = Number(params.id);
  const { loadUser, getUser, updateUser, deleteUser } = useApiStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const backHref = Number.isFinite(id) ? `/admin/users/${id}` : "/admin/users";
  const backLabel = Number.isFinite(id) ? "User profile" : "All users";

  const hero = (
    <div
      className="admin-dashboard-surface-bg overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle shadow-card ring-1 ring-slate-900/[0.04]"
      style={{
        ...ADMIN_SECTION_INSET,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 20,
        flexWrap: "wrap",
      }}
    >
      <div className="min-w-0 flex-1 text-left">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent-blue transition-colors hover:text-accent-amber"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          {backLabel}
        </Link>
        <h2
          className="mt-3 text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Edit user
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
          Update name, email, role, or set a new password.
        </p>
        {Number.isFinite(id) ? (
          <p className="mt-2 text-sm text-text-muted">
            <code className="mono rounded bg-surface-raised px-1.5 py-0.5 text-xs text-text-muted">
              PUT /api/admin/users/{id}
            </code>
          </p>
        ) : null}
      </div>
    </div>
  );

  const shell = (body: ReactNode) => (
    <div className="flex min-h-0 w-full min-w-0 flex-col gap-[var(--space-8)] pb-[var(--space-8)]">
      {hero}
      {body}
    </div>
  );

  const cardBody = (children: ReactNode) => (
    <Card className={FORM_CARD_CLASS}>
      <div style={ADMIN_SECTION_INSET}>{children}</div>
    </Card>
  );

  if (!Number.isFinite(id)) {
    return shell(
      cardBody(
        <p className="text-sm leading-relaxed text-text-secondary">
          Invalid user.{" "}
          <Link href="/admin/users" className="font-semibold text-accent-blue hover:text-accent-amber">
            Back to users
          </Link>
        </p>,
      ),
    );
  }

  if (loadError) {
    return shell(
      cardBody(
        <>
          <p className="text-sm leading-relaxed text-text-secondary">{loadError}</p>
          <Link
            href="/admin/users"
            className="mt-4 inline-block text-sm font-semibold text-accent-blue hover:text-accent-amber"
          >
            Back to users
          </Link>
        </>,
      ),
    );
  }

  if (!existing) {
    return shell(
      cardBody(<p className="text-sm text-text-secondary">Loading…</p>),
    );
  }

  const canDeleteAccount = authUser && existing.id !== authUser.id;

  return shell(
    <>
      {cardBody(
        <>
        <header className="border-b border-border-subtle pb-[var(--ds-card-padding)]">
          <h3
            className="text-lg font-bold tracking-tight text-text-primary sm:text-xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Account details
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
            Each field is on its own row. Leave password empty to keep the current one.
          </p>
        </header>

        {error ? (
          <p
            className="mt-[var(--ds-card-padding)] rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm leading-relaxed text-accent-red"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <form
          className="mt-[var(--ds-card-padding)] flex w-full min-w-0 flex-col gap-[var(--space-6)]"
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
          <Field
            label="Password"
            hint="Leave blank to keep the current password."
            type="password"
            value={password}
            onChange={setPassword}
          />
          <div className="flex w-full min-w-0 flex-col gap-2">
            <label
              htmlFor="admin-edit-user-role"
              className="text-xs font-semibold uppercase tracking-wide text-text-secondary"
            >
              Role
            </label>
            <select
              id="admin-edit-user-role"
              className={ROLE_SELECT}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              aria-label="User role"
            >
              <option value="customer">Customer</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex w-full min-w-0 flex-col-reverse gap-3 border-t border-border-subtle pt-[var(--ds-card-padding)] sm:flex-row sm:justify-end">
            <Link
              href={`/admin/users/${id}`}
              className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-md)] border border-border-accent text-sm font-semibold text-text-secondary transition-colors hover:border-accent-amber hover:text-text-primary sm:w-auto sm:min-w-[7.5rem]"
            >
              Cancel
            </Link>
            <Button type="submit" variant="primary" className="h-11 w-full sm:w-auto sm:min-w-[10rem]" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
        </>,
      )}
      {canDeleteAccount ? (
        <Card
          className={`${FORM_CARD_CLASS} !border-accent-red/25 ring-1 ring-accent-red/10`}
        >
          <div style={ADMIN_SECTION_INSET}>
            <h3 className="text-base font-bold text-text-primary">Delete user</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
              Permanently remove this account. Associated shipments are removed from the database.
            </p>
            <Button
              type="button"
              variant="danger"
              className="mt-4 h-11 gap-2 px-5"
              disabled={deleteBusy}
              onClick={() => {
                if (
                  !window.confirm(
                    `Delete user “${existing.name}”? This cannot be undone.`,
                  )
                ) {
                  return;
                }
                setDeleteBusy(true);
                void (async () => {
                  try {
                    await deleteUser(existing.id);
                    showToast("User deleted.");
                    router.push("/admin/users");
                  } catch (e) {
                    showToast(e instanceof ApiError ? e.message : "Could not delete user.");
                  } finally {
                    setDeleteBusy(false);
                  }
                })();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete user"}
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            </Button>
          </div>
        </Card>
      ) : null}
    </>,
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">{label}</label>
        {hint ? <p className="mt-1 text-xs leading-relaxed text-text-muted">{hint}</p> : null}
      </div>
      <Input
        type={type}
        className="h-11 w-full min-w-0 border-border-default"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

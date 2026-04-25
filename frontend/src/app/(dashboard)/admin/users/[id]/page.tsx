"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useApiStore } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { user: sessionUser } = useAuth();
  const { loadUser, getUser, deleteUser } = useApiStore();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    startTransition(() => setLoadError(null));
    void loadUser(id).catch(() => {
      startTransition(() => setLoadError("User not found or inaccessible."));
    });
  }, [id, loadUser]);

  const u = Number.isFinite(id) ? getUser(id) : undefined;
  const isSelf = sessionUser !== null && u !== undefined && sessionUser.id === u.id;

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

  if (!u) {
    return <p className="text-sm text-text-secondary">Loading…</p>;
  }

  const canDelete = !isSelf;
  const deleteEnabled =
    canDelete && confirmChecked && confirmEmail.trim().toLowerCase() === u.email.toLowerCase();

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
          Users
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-text-primary">{u.name}</h2>
        <p className="mt-1 text-sm text-text-secondary">
          <span className="mono tabular-nums text-text-muted">ID {u.id}</span> · {u.email} ·{" "}
          <span className="capitalize">{u.role}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/users/${id}/edit`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-amber px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-amber-glow)]"
          >
            Edit user
          </Link>
        </div>
      </div>

      <Card className="!border-accent-red/30 !bg-accent-red/5 !p-5">
        <h3 className="text-sm font-bold text-accent-red">Delete user</h3>
        <p className="mt-1 text-xs text-text-secondary">
          <code className="mono text-text-muted">DELETE /api/admin/users/{id}</code>. This cannot be undone.
        </p>
        {isSelf ? (
          <p className="mt-3 text-sm text-text-secondary">
            You cannot delete your own account while signed in.
          </p>
        ) : (
          <>
            {deleteError ? <p className="mt-3 text-sm text-accent-red">{deleteError}</p> : null}
            <label className="mt-4 flex items-start gap-2 text-sm text-text-primary">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-1 size-4 rounded border-border-default text-accent-amber focus:ring-accent-amber"
              />
              <span>I understand this permanently deletes this user and their access.</span>
            </label>
            <div className="mt-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
                Type the user&apos;s email to confirm
              </label>
              <Input
                type="email"
                className="mt-1 border-accent-red/30"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={u.email}
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="danger"
              className="mt-4"
              disabled={!deleteEnabled || deleteBusy}
              onClick={() => {
                setDeleteError(null);
                setDeleteBusy(true);
                void (async () => {
                  try {
                    await deleteUser(id);
                    router.push("/admin/users");
                  } catch (err) {
                    setDeleteError(err instanceof ApiError ? err.message : "Delete failed.");
                  } finally {
                    setDeleteBusy(false);
                  }
                })();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete user"}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

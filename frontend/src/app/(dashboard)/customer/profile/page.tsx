"use client";

import { useAuth } from "@/lib/auth/context";

export default function CustomerProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-border-default bg-surface-card p-8 shadow-card">
        <h2
          className="text-xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          Profile
        </h2>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-text-muted">Name</dt>
            <dd className="mt-1 font-medium text-text-primary">{user.name}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Email</dt>
            <dd className="mono mt-1 text-text-primary">{user.email}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Role</dt>
            <dd className="mt-1 capitalize text-text-primary">{user.role}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

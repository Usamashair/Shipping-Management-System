"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

export default function LoginPage() {
  const router = useRouter();
  const { login, token, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (token && user) {
      router.replace(user.role === "admin" ? "/admin" : "/customer/shipments");
    }
  }, [loading, token, user, router]);

  if (loading || (token && user)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Use seeded accounts (see backend{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-900">DatabaseSeeder</code>
          ).
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setBusy(true);
            try {
              const signedIn = await login(email.trim(), password);
              router.replace(signedIn.role === "admin" ? "/admin" : "/customer/shipments");
              router.refresh();
            } catch (err) {
              const msg =
                err instanceof ApiError ? err.message : "Unable to sign in. Check the API URL.";
              setError(msg);
            } finally {
              setBusy(false);
            }
          }}
        >
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          ) : null}
          <div>
            <label className="block text-xs font-medium text-zinc-500">Email</label>
            <input
              type="email"
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-sky-600 dark:text-sky-400"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

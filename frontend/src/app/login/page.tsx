"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Package } from "lucide-react";
import { HeroRouteArt } from "@/components/marketing/hero-route-art";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

export default function LoginPage() {
  const router = useRouter();
  const { login, token, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (token && user) {
      router.replace(user.role === "admin" ? "/admin" : "/customer/shipments");
    }
  }, [loading, token, user, router]);

  useEffect(() => {
    if (!error || !cardRef.current) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    setShake(true);
    const t = window.setTimeout(() => setShake(false), 500);
    return () => window.clearTimeout(t);
  }, [error]);

  if (loading || (token && user)) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-surface-deep text-text-secondary">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border-default border-t-accent-amber" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-deep text-text-primary supports-[min-height:100dvh]:min-h-[100dvh]">
      <div className="grid flex-1 lg:grid-cols-[minmax(280px,1fr)_minmax(0,520px)]">
        <aside className="relative hidden overflow-hidden border-b border-border-default bg-gradient-to-br from-surface-raised via-surface-deep to-surface-raised lg:flex lg:flex-col lg:border-b-0 lg:border-r">
          <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-12">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-amber-glow)] ring-1 ring-accent-amber/25">
                <Package className="h-6 w-6 text-accent-amber" aria-hidden />
              </span>
              <span
                className="text-xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                ShipFlow
              </span>
            </Link>
            <div>
              <h1
                className="max-w-sm text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Operations-grade shipping, without the clutter.
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-text-secondary">
                Sign in to manage labels, tracking, and customer shipments from one dashboard.
              </p>
            </div>
            <p className="text-xs text-text-muted">FedEx Ship API when configured on the server.</p>
          </div>
          <HeroRouteArt className="pointer-events-none absolute bottom-8 right-4 h-52 w-64 text-accent-amber opacity-[0.12]" />
        </aside>

        <div className="flex flex-col items-center justify-center px-4 py-12 lg:px-10 lg:py-16">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Package className="h-7 w-7 text-accent-amber" aria-hidden />
            <span
              className="text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              ShipFlow
            </span>
          </div>
          <div ref={cardRef} className={`w-full max-w-md ${shake ? "form-error-shake" : ""}`}>
            <Card className="!p-8">
            <h2
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Sign in
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              Use seeded accounts (see backend{" "}
              <code className="mono rounded bg-surface-deep px-1 text-xs text-text-muted">DatabaseSeeder</code>).
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
                <p className="rounded-lg border border-accent-red/40 bg-[rgba(239,68,68,0.12)] px-3 py-2 text-sm text-accent-red">
                  {error}
                </p>
              ) : null}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
                  Email
                </label>
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
                  Password
                </label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full !py-3" disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            <Link
              href="/"
              className="mt-6 inline-block text-sm font-semibold text-accent-blue transition-colors hover:text-accent-amber"
            >
              Back to home
            </Link>
            </Card>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

import Link from "next/link";
import { ApiHealthStatus } from "@/components/api-health-status";
import { SiteFooter } from "@/components/marketing/site-footer";

export default function ApiHealthDevPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface-deep text-text-primary supports-[min-height:100dvh]:min-h-[100dvh]">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-16">
        <div>
          <Link href="/" className="text-sm font-semibold text-accent-blue hover:text-accent-amber">
            ← Home
          </Link>
          <h1
            className="mt-4 text-2xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            Backend health
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Optional check against <code className="mono text-xs text-text-muted">NEXT_PUBLIC_API_URL</code>
          </p>
        </div>
        <ApiHealthStatus />
      </div>
      <SiteFooter />
    </div>
  );
}

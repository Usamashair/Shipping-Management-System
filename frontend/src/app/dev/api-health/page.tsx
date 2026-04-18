import Link from "next/link";
import { ApiHealthStatus } from "@/components/api-health-status";

export default function ApiHealthDevPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
      <div>
        <Link href="/" className="text-sm font-medium text-sky-600 dark:text-sky-400">
          Home
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Backend health (dev)
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Optional check against <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code>.
        </p>
      </div>
      <ApiHealthStatus />
    </div>
  );
}

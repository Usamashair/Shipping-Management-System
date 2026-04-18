"use client";

import { ApiStoreProvider } from "@/lib/api/store";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

function DashboardGate({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Loading session…
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return <ApiStoreProvider>{children}</ApiStoreProvider>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardGate>{children}</DashboardGate>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shipping/app-shell";
import { useAuth } from "@/lib/auth/context";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && user.role !== "admin") {
      router.replace("/customer/shipments");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Checking access…
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Redirecting…
      </div>
    );
  }

  return (
    <AppShell
      title="Admin"
      badge="API"
      nav={[
        { href: "/admin", label: "Overview" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/shipments", label: "All shipments" },
      ]}
    >
      {children}
    </AppShell>
  );
}

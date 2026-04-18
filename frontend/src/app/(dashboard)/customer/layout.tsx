"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shipping/app-shell";
import { useAuth } from "@/lib/auth/context";

export default function CustomerLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user && user.role !== "customer") {
      router.replace("/admin");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Checking access…
      </div>
    );
  }

  if (user.role !== "customer") {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
        Redirecting…
      </div>
    );
  }

  return (
    <AppShell
      title="Customer"
      badge="API"
      nav={[
        { href: "/customer/shipments", label: "My shipments" },
        { href: "/customer/shipments/new", label: "New shipment" },
      ]}
    >
      {children}
    </AppShell>
  );
}

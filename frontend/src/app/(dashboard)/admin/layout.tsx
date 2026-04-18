"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/shipping/loading-screen";
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
    return <LoadingScreen message="Checking access…" />;
  }

  if (user.role !== "admin") {
    return <LoadingScreen message="Redirecting…" />;
  }

  return <>{children}</>;
}

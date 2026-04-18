"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/shipping/loading-screen";
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
    return <LoadingScreen message="Checking access…" />;
  }

  if (user.role !== "customer") {
    return <LoadingScreen message="Redirecting…" />;
  }

  return <>{children}</>;
}

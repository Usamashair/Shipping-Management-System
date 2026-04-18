"use client";

import { ApiStoreProvider } from "@/lib/api/store";
import { Footer } from "@/components/shipping/Footer";
import { Header } from "@/components/shipping/Header";
import { LoadingScreen } from "@/components/shipping/loading-screen";
import { Sidebar } from "@/components/shipping/Sidebar";
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
    return <LoadingScreen message="Loading session…" />;
  }

  if (!token) {
    return null;
  }

  return <ApiStoreProvider>{children}</ApiStoreProvider>;
}

function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <div className="flex min-h-screen w-full flex-col pb-[70px] md:ml-[var(--sidebar-width)] md:w-[calc(100%-var(--sidebar-width))] md:pb-0">
        <Header />
        <main
          style={{
            flex: 1,
            padding: "2rem",
            paddingTop: "calc(var(--header-height) + 2rem)",
            overflowY: "auto",
          }}
        >
          <div className="page-enter">{children}</div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardGate>
      <DashboardShell>{children}</DashboardShell>
    </DashboardGate>
  );
}

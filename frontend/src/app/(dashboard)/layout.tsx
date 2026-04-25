"use client";

import { ApiStoreProvider } from "@/lib/api/store";
import { AddressBanner } from "@/components/shipping/AddressBanner";
import { Footer } from "@/components/shipping/Footer";
import { Header } from "@/components/shipping/Header";
import { LoadingScreen } from "@/components/shipping/loading-screen";
import { Sidebar } from "@/components/shipping/Sidebar";
import { ProfileProvider } from "@/lib/context/ProfileContext";
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

  return (
    <ApiStoreProvider>
      <ProfileProvider>{children}</ProfileProvider>
    </ApiStoreProvider>
  );
}

function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <Sidebar />
      <div className="dashboard-content-column">
        <Header />
        <main className="dashboard-main">
          <div className="page-enter">
            <AddressBanner />
            {children}
          </div>
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

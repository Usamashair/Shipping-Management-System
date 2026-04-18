"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api/client";
import type { User } from "@/lib/types";

type HealthDot = "ok" | "error" | "pending";

export function DashboardFooterBar({
  user,
  portal,
}: {
  user: User | null;
  portal: "admin" | "customer";
}) {
  const [dot, setDot] = useState<HealthDot>("pending");

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      const base = getApiBaseUrl();
      fetch(`${base.replace(/\/$/, "")}/api/health`)
        .then((r) => {
          if (!r.ok) throw new Error("bad");
          return r.json();
        })
        .then(() => {
          if (!cancelled) setDot("ok");
        })
        .catch(() => {
          if (!cancelled) setDot("error");
        });
    };
    run();
    const id = setInterval(run, 90_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const visibility = portal === "customer" ? "hidden md:flex" : "flex";

  return (
    <div
      className={`${visibility} mt-auto items-center justify-between gap-3 border-t border-border-default bg-surface-raised/90 px-4 py-2.5 text-[11px] text-text-muted backdrop-blur-sm`}
    >
      <span className="min-w-0 truncate">
        {user ? (
          <>
            Signed in as <span className="font-semibold text-text-secondary">{user.name}</span>
            <span className="mx-1 text-border-accent">·</span>
            <span className="capitalize text-text-muted">{user.role}</span>
          </>
        ) : (
          "Not signed in"
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 tabular-nums">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            dot === "ok"
              ? "bg-accent-green shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              : dot === "error"
                ? "bg-accent-red"
                : "bg-text-muted"
          }`}
          aria-hidden
        />
        <span className="uppercase tracking-wide">API</span>
        <span className="text-text-secondary">
          {dot === "ok" ? "reachable" : dot === "error" ? "unreachable" : "…"}
        </span>
      </span>
    </div>
  );
}

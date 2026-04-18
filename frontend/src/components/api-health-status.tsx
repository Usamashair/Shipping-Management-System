"use client";

import { useEffect, useState } from "react";

export function ApiHealthStatus() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [payload, setPayload] = useState<string | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
    fetch(`${base.replace(/\/$/, "")}/api/health`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: unknown) => {
        setPayload(JSON.stringify(data));
        setState("ok");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <div className="mt-8 w-full rounded-lg border border-zinc-200 bg-zinc-100/80 px-4 py-3 text-left text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="font-medium text-zinc-800 dark:text-zinc-200">Laravel API</p>
      <p className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {state === "loading" && "Checking /api/health…"}
        {state === "ok" && payload}
        {state === "error" &&
          "Could not reach the API (start the backend with php artisan serve on port 8000)."}
      </p>
    </div>
  );
}

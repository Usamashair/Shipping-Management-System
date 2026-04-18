"use client";

import { useState } from "react";

type JsonPanelProps = {
  title: string;
  data: unknown;
  defaultOpen?: boolean;
};

export function JsonPanel({ title, data, defaultOpen = false }: JsonPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const text =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        {title}
        <span className="text-xs font-normal text-zinc-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <pre className="max-h-64 overflow-auto border-t border-zinc-200 p-3 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
          {text}
        </pre>
      ) : null}
    </div>
  );
}

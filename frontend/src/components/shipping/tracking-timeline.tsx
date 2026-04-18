"use client";

import type { TrackingLog } from "@/lib/types";

export function TrackingTimeline({ logs }: { logs: TrackingLog[] }) {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-text-secondary">No tracking events yet.</p>;
  }

  const latestId = sorted[sorted.length - 1]?.id;

  return (
    <div className="relative ms-2">
      <div
        className="pointer-events-none absolute start-0 top-2 bottom-6 w-px bg-gradient-to-b from-accent-amber/55 via-border-accent to-border-accent/25"
        aria-hidden
      />
      <ol className="relative space-y-0 border-s border-dashed border-border-accent ps-6">
        {sorted.map((log) => {
          const isLatest = log.id === latestId;
          return (
            <li key={log.id} className="pb-8 last:pb-0">
              <span
                className={`absolute -start-[7px] mt-1.5 rounded-full border-2 border-surface-deep ${
                  isLatest
                    ? "h-3.5 w-3.5 bg-accent-amber shadow-[0_0_12px_rgba(245,158,11,0.45)]"
                    : "h-2.5 w-2.5 bg-text-muted"
                }`}
                aria-hidden
              />
              <time className="mono mb-1 block text-xs text-text-muted tabular-nums">
                {new Date(log.timestamp).toLocaleString()}
              </time>
              <p className="text-sm font-medium text-text-primary">{log.status}</p>
              <p className="mono mt-0.5 text-xs text-text-secondary">{log.location}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

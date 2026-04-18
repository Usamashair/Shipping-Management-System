import type { TrackingLog } from "@/lib/types";

export function TrackingTimeline({ logs }: { logs: TrackingLog[] }) {
  const sorted = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">No tracking events yet.</p>
    );
  }

  return (
    <ol className="relative border-s border-zinc-200 ps-4 dark:border-zinc-800">
      {sorted.map((log) => (
        <li key={log.id} className="mb-6 ms-2">
          <span className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-zinc-400 dark:border-zinc-950 dark:bg-zinc-500" />
          <time className="mb-1 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
            {new Date(log.timestamp).toLocaleString()}
          </time>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{log.status}</p>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{log.location}</p>
        </li>
      ))}
    </ol>
  );
}

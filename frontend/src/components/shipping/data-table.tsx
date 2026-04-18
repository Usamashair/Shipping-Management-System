import { Children, type ReactNode } from "react";

type DataTableProps = {
  columns: { key: string; label: string; className?: string }[];
  emptyMessage?: string;
  children: ReactNode;
};

export function DataTable({ columns, emptyMessage, children }: DataTableProps) {
  const empty = Children.count(children) === 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      {empty ? (
        <p className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {emptyMessage ?? "No rows."}
        </p>
      ) : (
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400 ${c.className ?? ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {children}
          </tbody>
        </table>
      )}
    </div>
  );
}

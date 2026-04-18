"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Children,
  cloneElement,
  isValidElement,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";

export type DataTableColumn = {
  key: string;
  label: string;
  className?: string;
};

type DataTableProps = {
  columns: DataTableColumn[];
  emptyMessage?: string;
  emptyCta?: ReactNode;
  loading?: boolean;
  skeletonRows?: number;
  pageSize?: number;
  /** Omit outer chrome when nested inside a Card or panel */
  embedded?: boolean;
  children: ReactNode;
};

function SkeletonRows({ count, colCount }: { count: number; colCount: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, r) => (
        <tr key={`sk-${r}`} className="border-b border-border-default">
          {Array.from({ length: colCount }).map((_, c) => (
            <td key={`sk-${r}-${c}`} className="px-4 py-3">
              <div className="skeleton h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function PackageIllustration() {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 80 80"
      fill="none"
      className="text-accent-amber"
      aria-hidden
    >
      <path
        d="M12 28L40 12L68 28V52L40 68L12 52V28Z"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.6"
      />
      <path d="M12 28L40 44L68 28" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <path d="M40 44V68" stroke="currentColor" strokeWidth="2" opacity="0.4" />
    </svg>
  );
}

export function DataTable({
  columns,
  emptyMessage,
  emptyCta,
  loading,
  skeletonRows = 5,
  pageSize = 100,
  embedded,
  children,
}: DataTableProps) {
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const arr: ReactElement[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === "tr") {
        arr.push(child);
      }
    });
    return arr;
  }, [children]);

  const empty = !loading && rows.length === 0;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const shell = embedded
    ? "rounded-none border-0 bg-transparent shadow-none"
    : "rounded-2xl border border-border-default bg-surface-card shadow-card";

  if (empty) {
    return (
      <div
        className={`flex flex-col items-center justify-center px-8 py-16 text-center ${embedded ? "rounded-none border-0 bg-transparent py-12 shadow-none" : "rounded-2xl border border-border-default bg-surface-card shadow-card"}`}
      >
        <PackageIllustration />
        <h3
          className="mt-6 text-xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          No shipments found
        </h3>
        <p className="mt-2 max-w-sm text-sm text-text-secondary">
          {emptyMessage ?? "No rows."}
        </p>
        {emptyCta ? <div className="mt-6">{emptyCta}</div> : null}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${shell}`}>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-raised">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-text-muted ${c.className ?? ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows count={skeletonRows} colCount={columns.length} />
            ) : (
              pagedRows.map((row, i) => {
                const r = row as ReactElement<HTMLAttributes<HTMLTableRowElement>>;
                return cloneElement(r, {
                  key: r.key ?? `row-${i}`,
                  className: `border-b border-border-default transition-colors duration-200 hover:bg-surface-card-hover ${
                    i % 2 === 0 ? "bg-surface-card" : "bg-surface-deep"
                  } border-l-[3px] border-l-transparent hover:border-l-accent-amber ${r.props.className ?? ""}`,
                });
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > pageSize ? (
        <div className="flex items-center justify-between border-t border-border-default bg-surface-raised px-4 py-3">
          <Button
            variant="ghost"
            className="!px-2 !py-1"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`min-w-8 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  n === currentPage
                    ? "bg-accent-amber text-surface-deep"
                    : "text-text-secondary hover:bg-surface-card-hover hover:text-text-primary"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            className="!px-2 !py-1"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

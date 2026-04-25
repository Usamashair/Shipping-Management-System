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
  /** Horizontal padding for header cells, body cells, skeleton, and footer (Tailwind class) */
  cellPadClass?: string;
  children: ReactNode;
};

function SkeletonRows({
  count,
  colCount,
  cellPadClass,
}: {
  count: number;
  colCount: number;
  cellPadClass: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, r) => (
        <tr key={`sk-${r}`} className="border-b border-border-subtle">
          {Array.from({ length: colCount }).map((_, c) => (
            <td key={`sk-${r}-${c}`} className={`${cellPadClass} py-3.5 align-middle`}>
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
      width="52"
      height="52"
      viewBox="0 0 80 80"
      fill="none"
      className="text-text-muted"
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

const DEFAULT_CELL_PAD = "px-[var(--ds-card-padding)]";

export function DataTable({
  columns,
  emptyMessage,
  emptyCta,
  loading,
  skeletonRows = 5,
  pageSize = 100,
  embedded,
  cellPadClass = DEFAULT_CELL_PAD,
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
    : "rounded-[var(--radius-lg)] border border-border-default bg-surface-card shadow-card";

  if (empty) {
    return (
      <div
        className={`flex flex-col items-center justify-center px-6 py-16 text-center sm:px-8 ${embedded ? "rounded-none border-0 bg-transparent py-12 shadow-none" : "rounded-[var(--radius-lg)] border border-border-default bg-surface-card shadow-card"}`}
        style={{ paddingTop: 64, paddingBottom: 64 }}
      >
        <PackageIllustration />
        <h3 className="mt-4 text-lg font-semibold text-text-primary sm:text-[18px]">
          No shipments found
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary sm:text-[14px]">
          {emptyMessage ?? "No rows."}
        </p>
        {emptyCta ? <div className="mt-5 sm:mt-6">{emptyCta}</div> : null}
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${shell}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-[#EDF9F7]">
            <tr className="border-b border-border-subtle">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap ${cellPadClass} py-3 text-left text-xs font-semibold uppercase tracking-wide text-text-secondary ${c.className ?? ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows count={skeletonRows} colCount={columns.length} cellPadClass={cellPadClass} />
            ) : (
              pagedRows.map((row, i) => {
                const r = row as ReactElement<HTMLAttributes<HTMLTableRowElement>>;
                return cloneElement(r, {
                  key: r.key ?? `row-${i}`,
                  className: `border-b border-border-subtle bg-surface-card transition-colors duration-150 hover:bg-[var(--bg-card-hover)] border-l-[4px] border-l-transparent hover:border-l-[var(--selection-bar)] ${r.props.className ?? ""}`,
                });
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > pageSize ? (
        <div className={`flex items-center justify-between border-t border-border-subtle bg-surface-card py-3 ${cellPadClass}`}>
          <Button
            variant="ghost"
            className="datatable-page-btn !min-h-9 !px-2 !py-1"
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
                className={`datatable-page-btn min-w-8 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                  n === currentPage
                    ? "bg-[var(--selection-tint)] text-accent-amber"
                    : "text-text-secondary hover:bg-[var(--bg-card-hover)] hover:text-text-primary"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            className="datatable-page-btn !min-h-9 !px-2 !py-1"
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

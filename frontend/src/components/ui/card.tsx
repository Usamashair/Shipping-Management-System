"use client";

import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-border-subtle bg-surface-card p-[var(--ds-card-padding)] shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

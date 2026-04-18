"use client";

import type { HTMLAttributes, ReactNode } from "react";

export function Card({
  children,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-2xl border border-border-default bg-surface-card p-6 shadow-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

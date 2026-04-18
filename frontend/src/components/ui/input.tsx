"use client";

import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-lg border border-border-default bg-surface-raised px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all duration-200 focus:border-accent-amber focus:outline-none focus:ring-[3px] focus:ring-[var(--accent-amber-glow)] ${className}`}
      {...props}
    />
  );
}

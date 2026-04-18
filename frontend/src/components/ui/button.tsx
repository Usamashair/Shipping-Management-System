"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-accent-amber text-surface-deep hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]",
  secondary:
    "border border-accent-amber bg-transparent text-accent-amber hover:bg-[var(--accent-amber-glow)]",
  ghost:
    "border border-transparent text-text-secondary hover:border-border-accent hover:bg-surface-card-hover hover:text-text-primary",
  danger:
    "border border-accent-red/50 bg-transparent text-accent-red hover:bg-[rgba(239,68,68,0.12)]",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 ease-out focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-amber-glow)] disabled:pointer-events-none disabled:opacity-50 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 ${variantClass[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

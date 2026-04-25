"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-accent-amber text-white shadow-sm hover:bg-[var(--brand-primary-hover)] hover:shadow-md active:scale-[0.99]",
  secondary:
    "border border-accent-amber bg-transparent text-accent-amber hover:bg-[var(--selection-tint)]",
  ghost:
    "border border-transparent text-text-secondary hover:border-border-default hover:bg-surface-card-hover hover:text-text-primary",
  danger:
    "border border-accent-red/50 bg-transparent text-accent-red hover:bg-accent-red-glow",
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
      className={`box-border inline-flex min-h-11 max-w-full min-w-0 items-center justify-center gap-2.5 rounded-[var(--radius-md)] px-7 py-2.5 text-center text-sm font-semibold leading-snug transition-colors duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:px-8 [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0 motion-reduce:active:scale-100 sm:text-sm ${variantClass[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

"use client";

import type { LucideIcon } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const inputBaseClass =
  "h-10 w-full rounded-[var(--radius-md)] border border-border-default bg-surface-card px-3 text-sm leading-normal text-text-primary placeholder:text-text-muted transition-colors duration-200 focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-1";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBaseClass} ${className}`} {...props} />;
}

const iconLeftClass =
  "pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-text-muted sm:left-3.5";

type InputWithIconProps = InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon };

export function InputWithLeadingIcon({ icon: Icon, className = "", ...props }: InputWithIconProps) {
  return (
    <div className="relative min-w-0">
      <Icon className={iconLeftClass} strokeWidth={2} aria-hidden />
      <Input className={`!pl-10 ${className}`} {...props} />
    </div>
  );
}

type SelectWithIconProps = SelectHTMLAttributes<HTMLSelectElement> & {
  icon: LucideIcon;
  children: ReactNode;
};

export function SelectWithLeadingIcon({ icon: Icon, className = "", children, ...rest }: SelectWithIconProps) {
  return (
    <div className="relative min-w-0">
      <Icon className={iconLeftClass} strokeWidth={2} aria-hidden />
      <select className={`!pl-10 ${className}`} {...rest}>
        {children}
      </select>
    </div>
  );
}

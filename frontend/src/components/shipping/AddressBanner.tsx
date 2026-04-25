"use client";

import { AlertTriangle, MapPin, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { useProfile } from "@/lib/context/ProfileContext";

const DISMISS_KEY = "sms_address_banner_dismissed";

export function AddressBanner() {
  const pathname = usePathname();
  const { profile, profileLoading } = useProfile();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });

  const onDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }, []);

  if (profileLoading) return null;
  if (!profile) return null;
  if (profile.role === "admin") return null;
  if (profile.has_address) return null;
  if (dismissed) return null;
  if (pathname?.startsWith("/customer/profile")) return null;

  return (
    <div
      className="mb-6 flex flex-col gap-4 rounded-2xl border border-amber-200/80 border-l-4 border-l-amber-500 bg-gradient-to-b from-amber-50 to-amber-100/50 px-4 py-4 shadow-[0_4px_18px_rgba(15,23,42,0.08)] ring-1 ring-amber-200/50 sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-4"
      role="status"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/60 bg-white/80 text-amber-600 shadow-sm"
          aria-hidden
        >
          <AlertTriangle className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-sm font-semibold leading-snug text-amber-950 sm:text-[15px]">
            Complete your shipping address
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
            Add your address to auto-fill the sender section when creating shipments.
          </p>
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto sm:justify-end sm:pl-0">
        <Link
          href="/customer/profile"
          className="inline-flex min-h-11 w-full flex-1 items-center justify-center gap-2.5 rounded-xl bg-accent-amber px-5 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-black/[0.04] transition-[filter,transform] hover:brightness-105 motion-safe:active:scale-[0.99] sm:w-auto sm:min-w-[10.75rem] sm:flex-initial"
        >
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Add address
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-white/90 text-amber-900/50 shadow-sm transition-colors hover:border-amber-300 hover:bg-white hover:text-amber-900"
          aria-label="Dismiss banner"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

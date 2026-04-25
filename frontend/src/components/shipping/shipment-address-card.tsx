"use client";

import type { ReactNode } from "react";
import { MapPin, Phone, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DASHBOARD_CARD_INSET,
  DASHBOARD_GRADIENT_CARD_CLASS,
  DASHBOARD_SECTION_HEADER_CLASS,
} from "@/lib/dashboardCardStyles";
import type { AddressDetails } from "@/lib/types";

const LABEL =
  "mb-2.5 text-xs font-bold uppercase tracking-[0.08em] text-text-muted sm:text-[13px] sm:tracking-[0.1em]";
const ROW = "flex min-w-0 items-start gap-3.5 sm:gap-4";
const ICON_WRAP = "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-text-muted";
const ICON = "h-5 w-5";

export function ShipmentAddressCard({
  title,
  accent,
  address,
  titleExtra,
}: {
  title: string;
  accent: "blue" | "amber";
  address: AddressDetails;
  /** e.g. “Fixed address” chip for the recipient panel */
  titleExtra?: ReactNode;
}) {
  const streetLines = [address.street1, address.street2].filter(Boolean);
  const accentBorder = accent === "blue" ? "border-l-accent-blue" : "border-l-accent-amber";

  return (
    <Card className={`${DASHBOARD_GRADIENT_CARD_CLASS} flex h-full min-h-0 flex-col`}>
      <div
        className={`${DASHBOARD_SECTION_HEADER_CLASS} flex flex-wrap items-center justify-between gap-2`}
        style={DASHBOARD_CARD_INSET}
      >
        <h3
          className="text-lg font-bold text-text-primary"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          {title}
        </h3>
        {titleExtra}
      </div>
      <div className="min-w-0 flex-1" style={DASHBOARD_CARD_INSET}>
        <div className="grid w-full min-w-0 grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-0">
          <div
            className={`flex min-w-0 flex-col gap-6 border-l-[3px] !pl-14 pr-2 sm:!pl-16 ${accentBorder}`}
          >
            <div>
              <p className={LABEL}>Name</p>
              <div className={ROW}>
                <span className={ICON_WRAP} aria-hidden>
                  <User className={ICON} />
                </span>
                <div className="min-w-0 space-y-2">
                  <p className="break-words text-base font-semibold leading-snug text-text-primary">
                    {address.name}
                  </p>
                  {address.company ? (
                    <p className="break-words text-base leading-relaxed text-text-secondary">
                      {address.company}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div>
              <p className={LABEL}>Phone</p>
              <div className={ROW}>
                <span className={ICON_WRAP} aria-hidden>
                  <Phone className={ICON} />
                </span>
                <p className="mono min-w-0 break-all text-base leading-relaxed tabular-nums text-text-primary">
                  {address.phone}
                </p>
              </div>
            </div>
            {address.email ? (
              <div>
                <p className={LABEL}>Email</p>
                <p className="min-w-0 break-words text-base leading-relaxed text-text-secondary">
                  {address.email}
                </p>
              </div>
            ) : null}
          </div>
          <div className={`min-w-0 border-l-[3px] !pl-14 pr-2 sm:!pl-16 ${accentBorder}`}>
            <p className={LABEL}>Address</p>
            <div className={ROW}>
              <span className={ICON_WRAP} aria-hidden>
                <MapPin className={ICON} />
              </span>
              <div className="min-w-0 space-y-2.5 text-base leading-[1.65] text-text-secondary">
                {streetLines.map((line) => (
                  <p key={line} className="break-words text-text-primary">
                    {line}
                  </p>
                ))}
                <p className="break-words">
                  {address.city}, {address.state} {address.postalCode}
                </p>
                <p className="text-text-muted">{address.country}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

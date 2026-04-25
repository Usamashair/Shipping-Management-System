import type { CSSProperties } from "react";

/** Padding aligned with the “My profile” hero and admin recent-shipments header. */
export const DASHBOARD_CARD_INSET: CSSProperties = {
  boxSizing: "border-box",
  // Fallbacks so content never sits flush to the border if CSS vars are missing in a subtree
  padding: "var(--ds-card-padding, 1.5rem) var(--space-8, 2rem)",
};

/** Gradient shell used on `/customer/profile` and customer shipment details. */
export const DASHBOARD_GRADIENT_CARD_CLASS =
  "admin-overview-recent-card !border-border-subtle !bg-[linear-gradient(135deg,#ffffff_0%,var(--selection-tint)_42%,rgba(77,209,197,0.2)_100%)] !p-0 !shadow-card ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow,border-color] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-glow motion-reduce:hover:translate-y-0 hover:border-border-accent hover:ring-accent-amber/10";

export const DASHBOARD_SECTION_HEADER_CLASS =
  "admin-recent-shipments-header border-b border-border-subtle";

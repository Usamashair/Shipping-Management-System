"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { downloadShipmentLabelBlob } from "@/lib/api/shipments";
import { useAuth } from "@/lib/auth/context";

export const ADMIN_SHIPMENT_ACTION_ICON_CLASS =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-default text-text-primary transition-colors hover:border-accent-amber hover:text-accent-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber-glow)]";

type Props = {
  shipmentId: number;
  labelUrl: string | null;
  labelPath?: string | null;
};

export function AdminShipmentLabelIconButton({ shipmentId, labelUrl, labelPath }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  if (labelUrl) {
    return (
      <a
        href={labelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={ADMIN_SHIPMENT_ACTION_ICON_CLASS}
        aria-label="Open label"
        title="Open label"
      >
        <Download className="h-4 w-4" aria-hidden />
      </a>
    );
  }

  if (labelPath && token) {
    return (
      <button
        type="button"
        className={ADMIN_SHIPMENT_ACTION_ICON_CLASS}
        disabled={busy}
        aria-label="Download label PDF"
        title="Download label PDF"
        onClick={() => {
          void (async () => {
            setBusy(true);
            try {
              const blob = await downloadShipmentLabelBlob(token, shipmentId, "admin");
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `shipment-${shipmentId}-label.pdf`;
              a.click();
              URL.revokeObjectURL(url);
              showToast("Label downloaded.");
            } catch (e) {
              showToast(e instanceof ApiError ? e.message : "Could not download the label.", "error");
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
      </button>
    );
  }

  return null;
}

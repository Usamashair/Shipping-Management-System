/**
 * Build human-readable rows from stored FedEx Ship API JSON (same shape as backend `$create['raw']`).
 * Does not stringify nested objects for display — only scalar fields and short messages.
 */
export type FedExResponseTableRow = { label: string; value: string };

function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function getOutput(data: Record<string, unknown>): Record<string, unknown> | null {
  return asRecord(data.output);
}

function getFirstTransactionShipment(
  data: Record<string, unknown>,
): Record<string, unknown> | null {
  const out = getOutput(data);
  if (!out) return null;
  const list = out.transactionShipments;
  if (!Array.isArray(list) || list.length === 0) return null;
  return asRecord(list[0]);
}

function pickTrackingFromTransactionShipment(ts: Record<string, unknown>): string | null {
  const a = toStr(ts.masterTrackingNumber);
  if (a) return a;

  const csd = asRecord(ts.completedShipmentDetail);
  if (csd) {
    const mti = asRecord(csd.masterTrackingId);
    if (mti) {
      const t = toStr(mti.trackingNumber);
      if (t) return t;
    }
    const m = toStr(csd.masterTrackingNumber);
    if (m) return m;
  }

  const pr = ts.pieceResponses;
  if (Array.isArray(pr)) {
    for (const p of pr) {
      const row = asRecord(p);
      if (!row) continue;
      const t = toStr(row.trackingNumber);
      if (t) return t;
      const pkgs = row.packageDocuments;
      if (Array.isArray(pkgs)) {
        for (const d of pkgs) {
          const doc = asRecord(d);
          if (doc) {
            const t2 = toStr(doc.trackingNumber);
            if (t2) return t2;
          }
        }
      }
    }
  }

  return null;
}

function pickLabelUrlFromTransactionShipment(ts: Record<string, unknown>): string | null {
  const pr = ts.pieceResponses;
  if (!Array.isArray(pr)) return null;
  for (const p of pr) {
    const row = asRecord(p);
    if (!row) continue;
    const docs = row.packageDocuments;
    if (Array.isArray(docs)) {
      for (const d of docs) {
        const doc = asRecord(d);
        if (!doc) continue;
        const u = toStr(doc.url);
        if (u) return u;
      }
    }
  }
  return null;
}

function firstErrorLine(data: Record<string, unknown>): string | null {
  const errors = data.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const e0 = asRecord(errors[0]);
  if (!e0) return null;
  const code = toStr(e0.code) ?? "";
  const message = toStr(e0.message) ?? "";
  if (!code && !message) return null;
  if (code && message) return `${code}: ${message}`;
  return code || message;
}

function formatIfIsoDate(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) || /^\d{4}-\d{2}-\d{2}Z?$/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  return s;
}

/**
 * @returns rows in a stable, user-friendly order. Omits empty values.
 */
export function extractFedExResponseTableRows(
  data: Record<string, unknown> | null | undefined,
): FedExResponseTableRow[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const rows: FedExResponseTableRow[] = [];

  const push = (label: string, value: string | null | undefined) => {
    if (value === null || value === undefined) return;
    const v = String(value).trim();
    if (v === "") return;
    rows.push({ label, value: v });
  };

  if (data.mock === true) push("Mode (stub)", "Test / mock");
  else {
    const mockStr = toStr((data as { mock?: unknown }).mock);
    if (mockStr) push("Mode (stub)", mockStr);
  }

  const mode = toStr((data as { mode?: unknown }).mode);
  if (mode) push("Integration mode", mode);

  const err = firstErrorLine(data);
  if (err) push("Last error", err);

  const transactionId = toStr(data.transactionId);
  if (transactionId) push("Transaction ID", transactionId);

  const customerTransactionId = toStr(
    (data as { customerTransactionId?: unknown }).customerTransactionId,
  );
  if (customerTransactionId) push("Customer transaction ID", customerTransactionId);

  const out = getOutput(data);
  const jobRoot = toStr((data as { jobId?: unknown }).jobId);
  const jobOut = out ? toStr((out as { jobId?: unknown }).jobId) : null;
  if (jobRoot) push("Job ID (async)", jobRoot);
  else if (jobOut) push("Job ID (async)", jobOut);

  const ts = getFirstTransactionShipment(data);
  if (ts) {
    const tracking = pickTrackingFromTransactionShipment(ts);
    if (tracking) push("Master tracking", tracking);

    const svc = toStr(ts.serviceType);
    if (svc) push("Service type (FedEx)", svc);

    const shipStamp = toStr(ts.shipTimestamp) ?? toStr(ts.shipDatestamp);
    if (shipStamp) push("Ship time / date", formatIfIsoDate(shipStamp));

    const labelUrl = pickLabelUrlFromTransactionShipment(ts);
    if (labelUrl) push("Label URL (FedEx)", labelUrl);
  } else {
    // Some responses put tracking on output
    if (out) {
      const mtn = toStr((out as { masterTrackingNumber?: unknown }).masterTrackingNumber);
      if (mtn) push("Master tracking", mtn);
    }
  }

  return rows;
}

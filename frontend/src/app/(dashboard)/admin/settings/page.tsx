"use client";

import { Info, Loader2, Lock, MapPin, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import { fetchAdminFixedRecipient, updateAdminFixedRecipient } from "@/lib/api/adminSettings";
import { DASHBOARD_CARD_INSET, DASHBOARD_GRADIENT_CARD_CLASS } from "@/lib/dashboardCardStyles";
import { US_STATE_OPTIONS } from "@/lib/usStates";
import { useAuth } from "@/lib/auth/context";
import type { FixedRecipient } from "@/lib/types";

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [recipient, setRecipient] = useState<FixedRecipient | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [personName, setPersonName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("NJ");
  const [postalCode, setPostalCode] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [residential, setResidential] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoadError(null);
    try {
      const r = await fetchAdminFixedRecipient(token);
      setRecipient(r);
      setPersonName(r.personName);
      setCompanyName(r.companyName ?? "");
      setPhoneNumber(r.phoneNumber);
      setEmail(r.email ?? "");
      setStreet1(r.address.streetLines[0] ?? "");
      setStreet2(r.address.streetLines[1] ?? "");
      setCity(r.address.city);
      setStateCode(r.address.stateOrProvinceCode);
      setPostalCode(r.address.postalCode);
      setCountryCode(r.address.countryCode);
      setResidential(r.address.residential);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load settings.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = () => {
    if (recipient) {
      setPersonName(recipient.personName);
      setCompanyName(recipient.companyName ?? "");
      setPhoneNumber(recipient.phoneNumber);
      setEmail(recipient.email ?? "");
      setStreet1(recipient.address.streetLines[0] ?? "");
      setStreet2(recipient.address.streetLines[1] ?? "");
      setCity(recipient.address.city);
      setStateCode(recipient.address.stateOrProvinceCode);
      setPostalCode(recipient.address.postalCode);
      setCountryCode(recipient.address.countryCode);
      setResidential(recipient.address.residential);
    }
    setFormError(null);
    setEditing(true);
  };

  const save = async () => {
    if (!token) return;
    setFormError(null);
    setSaving(true);
    try {
      const res = await updateAdminFixedRecipient(token, {
        personName: personName.trim(),
        companyName: companyName.trim(),
        phoneNumber: phoneNumber.replace(/\D/g, "").slice(0, 20),
        email: email.trim(),
        streetLine1: street1.trim(),
        streetLine2: street2.trim(),
        city: city.trim(),
        stateOrProvinceCode: stateCode,
        postalCode: postalCode.trim(),
        countryCode: countryCode.toUpperCase().slice(0, 2) || "US",
        residential,
      });
      setRecipient(res.recipient);
      setEditing(false);
      showToast("Recipient updated.", "success");
    } catch (e) {
      if (e instanceof ApiError) {
        const b = e.body as { message?: string; errors?: Record<string, string[]> } | null;
        if (b?.errors) {
          setFormError(Object.values(b.errors).flat().join(" ") || b.message || e.message);
        } else {
          setFormError(b?.message ?? e.message);
        }
      } else {
        setFormError(e instanceof Error ? e.message : "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          Settings
        </h1>
        <p className="mt-2 text-text-secondary">Manage system-wide configuration</p>
      </div>

      {loadError ? (
        <p className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-3 text-sm text-accent-red">
          {loadError}
        </p>
      ) : null}

      <div
        className="rounded-lg border border-accent-blue/40 px-4 py-3"
        style={{ background: "var(--blue-dim)" }}
      >
        <div className="flex gap-3">
          <Info className="h-5 w-5 shrink-0 text-accent-blue" aria-hidden />
          <p className="text-sm leading-relaxed text-text-secondary">
            This is the address all customer shipments are delivered to. Only administrators can change this.
          </p>
        </div>
      </div>

      <div className={DASHBOARD_GRADIENT_CARD_CLASS}>
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle"
          style={DASHBOARD_CARD_INSET}
        >
          <h2 className="text-lg font-bold text-text-primary">Fixed recipient address</h2>
          {!editing ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-accent bg-[var(--amber-dim)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-amber">
              <span className="text-accent-amber" aria-hidden>
                <Lock className="h-3 w-3" />
              </span>
              Active recipient
            </span>
          ) : null}
        </div>

        {recipient && !editing ? (
          <div style={DASHBOARD_CARD_INSET}>
            <div className="flex items-start justify-end gap-3">
              <Button type="button" variant="secondary" onClick={openEdit} className="gap-2">
                <Pencil className="h-4 w-4" />
                Edit recipient
              </Button>
            </div>
            <div
              className="mt-4 rounded-[var(--radius-md)] border border-border-subtle p-5"
              style={{ background: "var(--bg-surface)" }}
            >
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 shrink-0 text-accent-amber" />
                <div>
                  <p className="text-base font-bold text-text-primary">{recipient.personName}</p>
                  {recipient.companyName ? (
                    <p className="text-sm text-text-secondary">{recipient.companyName}</p>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                    {recipient.address.streetLines.join(", ")}
                    <br />
                    {recipient.address.city}, {recipient.address.stateOrProvinceCode} {recipient.address.postalCode}
                    <br />
                    {recipient.address.countryCode}
                  </p>
                  <p className="mono mt-2 text-sm text-text-muted">+1 {recipient.phoneNumber}</p>
                  {recipient.email ? <p className="mt-1 text-sm text-text-muted">{recipient.email}</p> : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {editing ? (
          <div className="space-y-4" style={DASHBOARD_CARD_INSET}>
            {formError ? <p className="text-sm text-accent-red">{formError}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">Contact name *</span>
                <Input value={personName} onChange={(e) => setPersonName(e.target.value)} className="h-11" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">Company</span>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-11" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">Phone *</span>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                  className="h-11 tabular-nums"
                  inputMode="numeric"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">Email</span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-semibold text-text-secondary">Street line 1 *</span>
              <Input value={street1} onChange={(e) => setStreet1(e.target.value)} className="h-11" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-semibold text-text-secondary">Street line 2</span>
              <Input value={street2} onChange={(e) => setStreet2(e.target.value)} className="h-11" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">City *</span>
                <Input value={city} onChange={(e) => setCity(e.target.value)} className="h-11" />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">State *</span>
                <select
                  className="h-11 w-full rounded-[var(--radius-md)] border border-border-default bg-white px-3 text-sm"
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                >
                  {US_STATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label} ({o.value})
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">ZIP *</span>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="h-11" />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-text-secondary">Country</span>
                <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase().slice(0, 2))} className="h-11" maxLength={2} />
              </label>
              <label className="flex cursor-pointer items-center gap-2 pt-8 text-sm text-text-primary">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border-default"
                  checked={residential}
                  onChange={(e) => setResidential(e.target.checked)}
                />
                Residential address
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setFormError(null);
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void save()}
                disabled={saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        ) : !recipient && !loadError ? (
          <p className="text-text-muted" style={DASHBOARD_CARD_INSET}>
            Loading…
          </p>
        ) : null}
      </div>
    </div>
  );
}

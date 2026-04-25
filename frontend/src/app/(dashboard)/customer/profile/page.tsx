"use client";

import {
  Building2,
  CheckCircle2,
  Info,
  Loader2,
  Package,
  Pencil,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import {
  savePersonalDetails,
  saveUserAddress,
  userProfileToSessionUser,
  verifySavedAddress,
} from "@/lib/api/profile";
import { useProfile } from "@/lib/context/ProfileContext";
import { useAuth } from "@/lib/auth/context";
import { US_STATE_OPTIONS } from "@/lib/usStates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { ProfileFormData } from "@/lib/types";
import { DASHBOARD_CARD_INSET, DASHBOARD_GRADIENT_CARD_CLASS } from "@/lib/dashboardCardStyles";

/** Use full content width of the card so two-column rows align evenly (no large empty right band). */
const FORM_STACK = "flex w-full min-w-0 max-w-full flex-col gap-8";

/** Tight stack inside each field: label → control → optional hint. */
const FIELD = "flex min-w-0 flex-col gap-2";

/** Two fields per row on `sm+`. */
const FIELD_ROW = "grid w-full min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-0";

const L =
  "block text-[13px] font-semibold uppercase tracking-[0.06em] text-text-secondary";

const INPUT_BASE =
  "h-11 w-full min-w-0 rounded-[var(--radius-md)] border border-border-default !bg-white text-[15px] leading-normal text-text-primary shadow-sm transition-colors placeholder:text-text-muted focus:border-accent-amber focus:outline-none focus:ring-2 focus:ring-[var(--amber-glow)]";

const INPUT_CLASS = `${INPUT_BASE} px-4`;

/**
 * Left padding is larger than the icon column so text never overlaps the icon.
 * Icon at `left-3.5` (14px); 16px icon → ~30px; `pl-14` (56px) gives a clear gap to typed text.
 */
const INPUT_WITH_ICON = `${INPUT_BASE} !pl-14 pr-4 text-left`;
const ICON_CLASS =
  "pointer-events-none absolute left-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-text-muted";

const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-10`;

/** Wider primary actions (Save personal / Save address). */
const PRIMARY_ACTION_CLASS =
  "h-auto !min-h-11 w-full !min-w-0 !px-8 py-3 sm:mx-auto sm:w-auto sm:min-w-[20rem] sm:max-w-[min(100%,24rem)]";

/** Short status chips (Saved / No address) — compact pill. */
const SHIPPING_STATUS_BADGE = [
  "inline-flex min-h-8 w-fit max-w-full shrink-0 select-none items-center justify-center gap-1.5",
  "rounded-full border px-3.5 py-2 text-xs font-bold uppercase leading-none tracking-wider",
].join(" ");

/** FedEx verified — full width on small screens, wraps inside card; not all-caps (saves width vs upper tracking). */
const FEDEX_VERIFIED_HEADER_BADGE = [
  "box-border flex w-full min-w-0 max-w-full select-none",
  "items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold leading-snug tracking-normal",
  "sm:inline-flex sm:w-auto sm:max-w-[min(100%,20rem)] sm:shrink",
].join(" ");

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export default function CustomerProfilePage() {
  const { token, user, setUser } = useAuth();
  const { profile, profileLoading, setProfile } = useProfile();
  const { showToast } = useToast();

  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerifyPrompt, setShowVerifyPrompt] = useState(false);

  const [form, setForm] = useState<ProfileFormData>({
    name: "",
    phone: "",
    company: "",
    street: "",
    street2: "",
    city: "",
    state: "TN",
    postal_code: "",
    country: "US",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name ?? "",
      phone: profile.phone ?? "",
      company: profile.address_company ?? "",
      street: profile.address_street ?? "",
      street2: profile.address_street2 ?? "",
      city: profile.address_city ?? "",
      state: (profile.address_state ?? "TN").slice(0, 2),
      postal_code: profile.address_postal_code ?? "",
      country: profile.address_country ?? "US",
    });
    if (!profile.has_address) {
      setIsEditingAddress(true);
    }
  }, [profile]);

  const handleSavePersonal = useCallback(async () => {
    if (!token || !user) return;
    setSavingInfo(true);
    setError(null);
    try {
      const res = await savePersonalDetails(token, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
      });
      setProfile(res.profile);
      setUser(userProfileToSessionUser(user, res.profile));
      showToast("Personal details saved.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save personal details.");
    } finally {
      setSavingInfo(false);
    }
  }, [token, user, form.name, form.phone, form.company, setProfile, setUser, showToast]);

  const handleSaveAddress = useCallback(async () => {
    if (!token || !user) return;
    setSaving(true);
    setError(null);
    setShowVerifyPrompt(false);
    try {
      const res = await saveUserAddress(token, form);
      setProfile(res.profile);
      setUser(userProfileToSessionUser(user, res.profile));
      showToast("Address saved.");
      setIsEditingAddress(false);
      setShowVerifyPrompt(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save address.");
    } finally {
      setSaving(false);
    }
  }, [token, user, form, setProfile, setUser, showToast]);

  /** Saves the current form, then calls FedEx verify. If verification fails, the address remains saved (API behavior). */
  const handleSaveThenVerify = useCallback(async () => {
    if (!token || !user) return;
    setError(null);
    setShowVerifyPrompt(false);
    try {
      setSaving(true);
      const saveRes = await saveUserAddress(token, form);
      setProfile(saveRes.profile);
      setUser(userProfileToSessionUser(user, saveRes.profile));
      setSaving(false);

      setVerifying(true);
      const verifyRes = await verifySavedAddress(token);
      setProfile(verifyRes.profile);
      setUser(userProfileToSessionUser(user, verifyRes.profile));
      showToast(verifyRes.message, "success");
      setIsEditingAddress(false);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not save or verify address.",
      );
    } finally {
      setSaving(false);
      setVerifying(false);
    }
  }, [token, user, form, setProfile, setUser, showToast]);

  const handleVerify = useCallback(async () => {
    if (!token || !user) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await verifySavedAddress(token);
      setProfile(res.profile);
      setUser(userProfileToSessionUser(user, res.profile));
      showToast(res.message, "success");
      setShowVerifyPrompt(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }, [token, user, setProfile, setUser, showToast]);

  if (!user) return null;
  if (profileLoading && !profile) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 pb-[var(--space-8)] text-sm text-text-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-accent-amber" aria-hidden />
        <span>Loading profile…</span>
      </div>
    );
  }

  const p = profile;
  if (!p) return null;

  const addressFormFields = (
    <div className="grid w-full min-w-0 grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-5">
      <div className={`${FIELD} sm:col-span-2`}>
        <label className={L} htmlFor="addr-street">
          Street <span className="text-accent-red">*</span>
        </label>
        <Input
          id="addr-street"
          className={INPUT_CLASS}
          value={form.street}
          onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
          autoComplete="street-address"
        />
      </div>
      <div className={`${FIELD} sm:col-span-2`}>
        <label className={L} htmlFor="addr-street2">
          Street line 2
        </label>
        <Input
          id="addr-street2"
          className={INPUT_CLASS}
          value={form.street2}
          onChange={(e) => setForm((f) => ({ ...f, street2: e.target.value }))}
        />
      </div>
      <div className={FIELD}>
        <label className={L} htmlFor="addr-city">
          City <span className="text-accent-red">*</span>
        </label>
        <Input
          id="addr-city"
          className={INPUT_CLASS}
          value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          autoComplete="address-level2"
        />
      </div>
      <div className={FIELD}>
        <label className={L} htmlFor="addr-state">
          State <span className="text-accent-red">*</span>
        </label>
        <select
          id="addr-state"
          className={SELECT_CLASS}
          value={form.state}
          onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
        >
          {US_STATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className={FIELD}>
        <label className={L} htmlFor="addr-zip">
          ZIP code <span className="text-accent-red">*</span>
        </label>
        <Input
          id="addr-zip"
          className={INPUT_CLASS}
          value={form.postal_code}
          onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
          maxLength={10}
          inputMode="numeric"
          autoComplete="postal-code"
        />
      </div>
      <div className={FIELD}>
        <label className={L} htmlFor="addr-country">
          Country <span className="text-accent-red">*</span>
        </label>
        <select
          id="addr-country"
          className={SELECT_CLASS}
          value={form.country}
          onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
        >
          <option value="US">United States (US)</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-col gap-[var(--space-8)] pb-[var(--space-8)]">
      <div
        className="admin-dashboard-surface-bg overflow-hidden rounded-[var(--radius-lg)] border border-border-subtle shadow-card ring-1 ring-slate-900/[0.04]"
        style={{
          padding: "var(--ds-card-padding) var(--space-8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div className="min-w-0 flex-1 text-left">
          <h1
            className="text-2xl font-bold leading-tight tracking-tight text-text-primary sm:text-3xl"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            My profile
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-text-secondary sm:text-lg">
            Your account, shipping address, and optional FedEx verification
          </p>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-3">
          <Link
            href="/customer/shipments"
            className="admin-dashboard-cta inline-flex max-w-full items-center gap-2 rounded-[var(--radius-md)] border-2 border-accent-amber bg-transparent px-5 py-2.5 text-base font-semibold text-accent-amber transition-[filter,transform,background] duration-200 motion-safe:hover:bg-[var(--selection-tint)] motion-safe:active:scale-[0.98]"
          >
            <Package className="h-5 w-5 shrink-0" aria-hidden />
            My shipments
          </Link>
        </div>
      </div>

      {error ? (
        <p
          className="rounded-lg border border-accent-red/30 bg-accent-red/10 text-sm text-accent-red"
          style={DASHBOARD_CARD_INSET}
        >
          {error}
        </p>
      ) : null}

      {/* Personal information — full-width form column, standard padding from card edges */}
      <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
        <div
          className="admin-recent-shipments-header border-b border-border-subtle"
          style={DASHBOARD_CARD_INSET}
        >
          <h2 className="text-lg font-bold text-text-primary">Personal information</h2>
        </div>
        <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
          <div className={FORM_STACK}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold"
                style={{ background: "var(--accent-amber-glow)", color: "var(--brand-primary)" }}
              >
                {initials(form.name || p.name)}
              </div>
              <p className="min-w-0 text-sm leading-relaxed text-text-secondary">
                Update your name, phone, and company. Email is managed by your administrator.
              </p>
            </div>

            <div className={FIELD_ROW}>
              <div className={FIELD}>
                <label className={L} htmlFor="pi-name">
                  Full name <span className="text-accent-red">*</span>
                </label>
                <Input
                  id="pi-name"
                  className={INPUT_CLASS}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoComplete="name"
                />
              </div>
              <div className={FIELD}>
                <label className={L} htmlFor="pi-email">
                  Email
                </label>
                <div className="relative min-w-0">
                  <User className={ICON_CLASS} aria-hidden />
                  <Input
                    id="pi-email"
                    readOnly
                    tabIndex={-1}
                    className={`${INPUT_WITH_ICON} cursor-not-allowed !bg-white text-text-secondary`}
                    value={p.email}
                  />
                </div>
                <p className="text-xs text-text-muted">Read-only. Contact support to change your email.</p>
              </div>
            </div>
            <div className={FIELD_ROW}>
              <div className={FIELD}>
                <label className={L} htmlFor="pi-phone">
                  Phone <span className="text-accent-red">*</span>
                </label>
                <div className="relative min-w-0">
                  <Phone className={ICON_CLASS} aria-hidden />
                  <Input
                    id="pi-phone"
                    className={INPUT_WITH_ICON}
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div className={FIELD}>
                <label className={L} htmlFor="pi-company">
                  Company
                </label>
                <div className="relative min-w-0">
                  <Building2 className={ICON_CLASS} aria-hidden />
                  <Input
                    id="pi-company"
                    className={INPUT_WITH_ICON}
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    autoComplete="organization"
                  />
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col items-stretch gap-3 border-t border-border-subtle pt-8 sm:flex-row sm:items-center sm:justify-center">
              <Button
                type="button"
                variant="primary"
                className={PRIMARY_ACTION_CLASS}
                disabled={savingInfo}
                onClick={() => void handleSavePersonal()}
              >
                {savingInfo ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                <span>Save personal details</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Shipping address — same card shell; address fields one per row */}
      <Card className={DASHBOARD_GRADIENT_CARD_CLASS}>
        <div
          className="admin-recent-shipments-header flex min-w-0 flex-col gap-2.5 border-b border-border-subtle sm:min-h-[3.25rem] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          style={DASHBOARD_CARD_INSET}
        >
          <h2 className="min-w-0 shrink-0 text-lg font-bold text-text-primary">Shipping address</h2>
          <div className="flex min-w-0 w-full max-w-full flex-1 items-center justify-end self-stretch sm:w-auto sm:justify-end sm:self-center">
            {p.address_fedex_verified ? (
              <span
                className={`${FEDEX_VERIFIED_HEADER_BADGE} border-emerald-500/35 bg-emerald-500/[0.12] text-emerald-800`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 break-words text-center sm:text-left">
                  Verified by FedEx
                </span>
              </span>
            ) : p.has_address ? (
              <span
                className={`${SHIPPING_STATUS_BADGE} border-accent-blue/40 bg-accent-blue/[0.12] text-accent-blue`}
              >
                <span className="whitespace-nowrap">Saved</span>
              </span>
            ) : (
              <span
                className={`${SHIPPING_STATUS_BADGE} border-accent-amber/50 bg-[rgba(245,158,11,0.14)] text-accent-amber-bright shadow-[0_0_0_1px_rgba(245,158,11,0.08)]`}
              >
                <span className="whitespace-nowrap">No address</span>
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0" style={DASHBOARD_CARD_INSET}>
          {p.has_address && !isEditingAddress ? (
            <div className={FORM_STACK}>
              <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface-raised/60 p-5 sm:p-6">
                <div className="flex gap-4 sm:gap-5">
                  <div className="shrink-0 text-accent-amber" aria-hidden>
                    <Building2 className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 space-y-1.5 text-base leading-relaxed sm:space-y-2">
                    <p className="text-xl font-semibold leading-snug text-text-primary sm:text-2xl">{p.name}</p>
                    {p.address_company ? <p className="text-text-secondary">{p.address_company}</p> : null}
                    <p className="text-text-primary">{p.address_street}</p>
                    {p.address_street2 ? <p className="text-text-primary">{p.address_street2}</p> : null}
                    <p className="text-text-secondary">
                      {p.address_city}, {p.address_state} {p.address_postal_code}
                    </p>
                    <p className="text-text-secondary">{p.address_country}</p>
                    {p.phone ? (
                      <p className="mono mt-1 tabular-nums text-text-secondary sm:mt-2">{p.phone}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {p.address_fedex_verified ? (
                <div className="flex min-w-0 items-start gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-[13px] text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 break-words leading-relaxed">
                    Verified by FedEx
                    {p.address_verified_at ? ` on ${new Date(p.address_verified_at).toLocaleString()}` : ""}.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-border-accent bg-[rgba(245,158,11,0.06)] p-3 text-[13px] text-text-secondary">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-amber" aria-hidden />
                  <span>Address saved but not yet verified with FedEx. Verify to help ensure deliverability.</span>
                </div>
              )}

              <div className="flex min-w-0 flex-col items-stretch gap-3 border-t border-border-subtle pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-11 w-full min-w-0 py-3 sm:w-auto"
                  onClick={() => setIsEditingAddress(true)}
                >
                  <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                  <span>Edit address</span>
                </Button>
                {!p.address_fedex_verified ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-auto min-h-11 w-full min-w-0 py-3 sm:w-auto"
                    disabled={verifying}
                    onClick={() => void handleVerify()}
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 shrink-0" />
                    )}
                    <span>Verify with FedEx</span>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={FORM_STACK}>
              <p className="text-sm leading-relaxed text-text-secondary">
                Name, phone, and company on file are used as the ship-from contact when you create labels.{" "}
                <strong className="font-semibold text-text-primary">Save address</strong> stores this address.{" "}
                <strong className="font-semibold text-text-primary">Validate with FedEx</strong> saves the form first, then
                checks it with FedEx; if validation does not pass, your address is still kept on file.
              </p>
              {addressFormFields}
              <div className="flex min-w-0 flex-col items-stretch gap-3 border-t border-border-subtle pt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
                {p.has_address ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-h-11 w-full min-w-0 py-3 sm:min-w-[10rem] sm:max-w-xs sm:flex-1"
                    disabled={saving || verifying}
                    onClick={() => setIsEditingAddress(false)}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="primary"
                  className={PRIMARY_ACTION_CLASS}
                  disabled={saving || verifying}
                  onClick={() => void handleSaveAddress()}
                >
                  {saving ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
                  <span>Save address</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className={PRIMARY_ACTION_CLASS}
                  disabled={saving || verifying}
                  onClick={() => void handleSaveThenVerify()}
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <span>Validate with FedEx</span>
                </Button>
              </div>
            </div>
          )}

          {showVerifyPrompt && p.has_address && !p.address_fedex_verified && !isEditingAddress ? (
            <div className="mt-2 w-full min-w-0">
              <div
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border-accent p-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ background: "var(--accent-amber-glow)" }}
              >
                <span className="text-[13px] font-medium text-text-primary">
                  Address saved. Verify with FedEx for better deliverability?
                </span>
                <Button
                  type="button"
                  variant="primary"
                  className="h-auto min-h-11 w-full min-w-0 py-3 sm:ml-auto sm:w-auto"
                  onClick={() => void handleVerify()}
                >
                  <span>Verify now</span>
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

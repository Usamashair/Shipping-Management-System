"use client";

import { AlertCircle, ChevronLeft, Eye, EyeOff, Lock, Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

const LOGIN_ICON_COL_WIDTH = 48;
const LOGIN_EYE_COL_WIDTH = 44;

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

function inputFocusStyle(focused: boolean): CSSProperties {
  return focused ? { boxShadow: "0 0 0 3px var(--amber-dim)" } : {};
}

function authIconInputShellStyle(focused: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "stretch",
    width: "100%",
    minHeight: 44,
    boxSizing: "border-box",
    background: "var(--bg-input)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: focused ? "var(--amber)" : "var(--border-default)",
    borderRadius: "var(--radius-md)",
    transition: "border-color 0.18s, box-shadow 0.18s",
    ...inputFocusStyle(focused),
  };
}

const textInputBase = (focused: boolean): CSSProperties => ({
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 14px",
  background: "var(--bg-input)",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: focused ? "var(--amber)" : "var(--border-default)",
  borderRadius: "var(--radius-md)",
  color: "var(--text-primary)",
  fontSize: 14,
  fontFamily: "var(--font-display)",
  outline: "none",
  transition: "border-color 0.18s, box-shadow 0.18s",
  ...inputFocusStyle(focused),
});

export default function SignupPage() {
  const router = useRouter();
  const { register, token, user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [pw2Focused, setPw2Focused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [companyFocused, setCompanyFocused] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (token && user) {
      router.replace(user.role === "admin" ? "/admin" : "/customer/shipments");
    }
  }, [authLoading, token, user, router]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        await register({
          name: name.trim(),
          email: email.trim(),
          password,
          password_confirmation: passwordConfirmation,
          phone: phone.trim(),
          company: company.trim() || undefined,
        });
        router.replace("/customer/shipments");
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError) {
          const b = err.body as { message?: string; errors?: Record<string, string[]> } | null;
          if (b?.errors) {
            const first = Object.values(b.errors).flat()[0];
            setError(first ?? err.message);
          } else {
            setError(b?.message ?? err.message);
          }
        } else {
          setError(err instanceof Error ? err.message : "Could not create account.");
        }
      } finally {
        setLoading(false);
      }
    },
    [name, email, password, passwordConfirmation, phone, company, register, router],
  );

  if (authLoading || (token && user)) {
    return (
      <div
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-base)",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-display)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            borderWidth: 2,
            borderStyle: "solid",
            borderColor: "var(--border-default)",
            borderTopColor: "var(--amber)",
            animation: "loginSpin 0.8s linear infinite",
          }}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <main
      className="login-grid"
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        background: "var(--bg-base)",
        fontFamily: "var(--font-display)",
      }}
    >
      <AuthMarketingPanel />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "var(--bg-base)",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            animation: "loginFadeUp 0.4s ease forwards",
          }}
        >
          <div
            className="login-mobile-logo"
            style={{
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              marginBottom: "1.5rem",
              gap: 8,
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M20 7L12 3L4 7M20 7V17L12 21M20 7L12 11M4 7V17L12 21M4 7L12 11M12 11V21"
                stroke="var(--amber)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>
              ShipFlow
            </span>
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              Create an account
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Customer accounts only — your name, contact details, and sign-in. Add your shipping address later in My profile.
            </p>
          </div>

          <form
            onSubmit={(e) => void handleSubmit(e)}
            style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
          >
            <div>
              <label htmlFor="signup-name" style={labelStyle}>
                Full name
              </label>
              <input
                id="signup-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                style={textInputBase(nameFocused)}
              />
            </div>

            <div>
              <label htmlFor="signup-phone" style={labelStyle}>
                Phone
              </label>
              <input
                id="signup-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onFocus={() => setPhoneFocused(true)}
                onBlur={() => setPhoneFocused(false)}
                placeholder="Digits and common symbols"
                style={textInputBase(phoneFocused)}
              />
            </div>

            <div>
              <label htmlFor="signup-company" style={labelStyle}>
                Company (optional)
              </label>
              <input
                id="signup-company"
                name="company"
                type="text"
                autoComplete="organization"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onFocus={() => setCompanyFocused(true)}
                onBlur={() => setCompanyFocused(false)}
                style={textInputBase(companyFocused)}
              />
            </div>

            <div>
              <label htmlFor="signup-email" style={labelStyle}>
                Email
              </label>
              <div style={authIconInputShellStyle(emailFocused)}>
                <span
                  aria-hidden
                  style={{
                    display: "flex",
                    width: LOGIN_ICON_COL_WIDTH,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  <Mail size={18} strokeWidth={2} />
                </span>
                <input
                  id="signup-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    boxSizing: "border-box",
                    padding: "11px 14px 11px 0",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontFamily: "var(--font-display)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-password" style={labelStyle}>
                Password
              </label>
              <div style={authIconInputShellStyle(pwFocused)}>
                <span
                  aria-hidden
                  style={{
                    display: "flex",
                    width: LOGIN_ICON_COL_WIDTH,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  <Lock size={18} strokeWidth={2} />
                </span>
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    boxSizing: "border-box",
                    padding: "11px 8px 11px 0",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontFamily: "var(--font-display)",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((s) => !s)}
                  style={{
                    display: "flex",
                    width: LOGIN_EYE_COL_WIDTH,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="signup-password-confirmation" style={labelStyle}>
                Confirm password
              </label>
              <div style={authIconInputShellStyle(pw2Focused)}>
                <span
                  aria-hidden
                  style={{
                    display: "flex",
                    width: LOGIN_ICON_COL_WIDTH,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  <Lock size={18} strokeWidth={2} />
                </span>
                <input
                  id="signup-password-confirmation"
                  type={showPassword2 ? "text" : "password"}
                  name="password_confirmation"
                  autoComplete="new-password"
                  required
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  onFocus={() => setPw2Focused(true)}
                  onBlur={() => setPw2Focused(false)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    background: "transparent",
                    boxSizing: "border-box",
                    padding: "11px 8px 11px 0",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontFamily: "var(--font-display)",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword2 ? "Hide password" : "Show password"}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword2((s) => !s)}
                  style={{
                    display: "flex",
                    width: LOGIN_EYE_COL_WIDTH,
                    flexShrink: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: 0,
                  }}
                >
                  {showPassword2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: "var(--red-dim)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  color: "var(--red)",
                }}
              >
                <AlertCircle size={14} aria-hidden />
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: 12,
                background: loading ? "rgba(40, 180, 164, 0.45)" : "var(--amber)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-md)",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.18s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              {loading ? "Creating account…" : (
                <>
                  <UserPlus size={16} aria-hidden />
                  Create account
                </>
              )}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", marginTop: "1.25rem", marginBottom: 0 }}>
            Already have an account?{" "}
            <Link
              href="/login"
              style={{ color: "var(--amber)", fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              Sign in
            </Link>
          </p>

          <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              <ChevronLeft size={14} aria-hidden />
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

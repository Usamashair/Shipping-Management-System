"use client";

import { AlertCircle, ChevronLeft, Eye, EyeOff, Lock, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { AuthMarketingPanel } from "@/components/auth/auth-marketing-panel";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/context";

/** Fixed column for the leading icon — text field is separate, so placeholder/value never touches the icon. */
const LOGIN_ICON_COL_WIDTH = 48;
const LOGIN_EYE_COL_WIDTH = 44;

export default function LoginPage() {
  const router = useRouter();
  const { login, token, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (token && user) {
      router.replace(user.role === "admin" ? "/admin" : "/customer/shipments");
    }
  }, [authLoading, token, user, router]);

  const submitLogin = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const signedIn = await login(email.trim(), password);
      router.replace(signedIn.role === "admin" ? "/admin" : "/customer/shipments");
      router.refresh();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Invalid email or password. Check your credentials and try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [email, password, login, router]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitLogin();
  };

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

  const inputFocusStyle = (focused: boolean): CSSProperties =>
    focused
      ? {
          boxShadow: "0 0 0 3px var(--amber-dim)",
        }
      : {};

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
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
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
              marginBottom: "2rem",
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
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              ShipFlow
            </span>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Sign in to your ShipFlow account
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Email Address
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  width: "100%",
                  minHeight: 44,
                  boxSizing: "border-box",
                  background: "var(--bg-input)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: emailFocused ? "var(--amber)" : "var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  transition: "border-color 0.18s, box-shadow 0.18s",
                  ...inputFocusStyle(emailFocused),
                }}
              >
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
                  type="email"
                  name="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  required
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
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Password
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  width: "100%",
                  minHeight: 44,
                  boxSizing: "border-box",
                  background: "var(--bg-input)",
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: passwordFocused ? "var(--amber)" : "var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  transition: "border-color 0.18s, box-shadow 0.18s",
                  ...inputFocusStyle(passwordFocused),
                }}
              >
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
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ textAlign: "right", marginTop: -4 }}>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--amber)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                Forgot password?
              </a>
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
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "var(--amber-light)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = loading
                  ? "rgba(40, 180, 164, 0.45)"
                  : "var(--amber)";
                e.currentTarget.style.transform = "none";
              }}
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
              {loading ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    style={{ animation: "loginSpin 0.8s linear infinite" }}
                    aria-hidden
                  >
                    <circle cx="8" cy="8" r="6" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
                    <path
                      d="M8 2 A6 6 0 0 1 14 8"
                      fill="none"
                      stroke="#000"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn size={16} aria-hidden />
                  Sign In
                </>
              )}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)", marginTop: "1.5rem", marginBottom: 0 }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              style={{ color: "var(--amber)", fontWeight: 600, textDecoration: "none" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.textDecoration = "none";
              }}
            >
              Create an account
            </Link>
          </p>

          <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
                color: "var(--text-muted)",
                textDecoration: "none",
                transition: "color 0.18s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
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

"use client";

import { MapPin, Package, ShieldCheck } from "lucide-react";

const features = [
  { Icon: Package, title: "Instant Label Generation", sub: "Real FedEx labels in seconds" },
  { Icon: MapPin, title: "Live Package Tracking", sub: "Real-time scan events from FedEx" },
  { Icon: ShieldCheck, title: "Address Validation", sub: "Smart correction before you ship" },
] as const;

/** Left column used on `/login` and `/signup`. */
export function AuthMarketingPanel() {
  return (
    <div
      className="login-left-panel"
      style={{
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem",
        position: "relative",
        overflow: "hidden",
        minHeight: "100%",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          backgroundImage: "radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.8,
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 400,
          height: 400,
          background: "radial-gradient(circle, rgba(40,180,164,0.1) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: -80,
          right: -80,
          width: 350,
          height: 350,
          background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 65%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          maxWidth: 380,
          width: "100%",
        }}
      >
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          style={{
            animation: "loginFloat 3s ease-in-out infinite",
            marginBottom: 16,
            marginLeft: "auto",
            marginRight: "auto",
            display: "block",
          }}
        >
          <path
            d="M20 7L12 3L4 7M20 7V17L12 21M20 7L12 11M4 7V17L12 21M4 7L12 11M12 11V21"
            stroke="var(--amber)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            fontWeight: 800,
            color: "var(--text-primary)",
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          ShipFlow
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--text-secondary)",
            marginBottom: 48,
            lineHeight: 1.6,
          }}
        >
          Professional FedEx shipping management.
          <br />
          Labels, tracking, and validation — unified.
        </p>

        <div style={{ maxWidth: 280, margin: "0 auto" }}>
          {features.map(({ Icon, title, sub }) => (
            <div
              key={title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 14,
                marginBottom: 20,
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--amber-dim)",
                  border: "1px solid var(--border-accent)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon size={16} color="var(--amber)" aria-hidden />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--amber-dim)",
          border: "1px solid var(--border-accent)",
          borderRadius: 20,
          padding: "6px 14px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--amber)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--amber)",
            display: "inline-block",
          }}
        />
        FedEx Certified Integration
      </div>
    </div>
  );
}

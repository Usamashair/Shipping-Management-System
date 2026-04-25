import { ArrowRight, CheckCircle, Package, Radio } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -200,
          left: -200,
          width: 600,
          height: 600,
          background: "radial-gradient(circle, rgba(40,180,164,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: -100,
          right: -100,
          width: 500,
          height: 500,
          background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          backgroundImage: "radial-gradient(circle, var(--border-subtle) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          opacity: 0.6,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 1.25rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--amber-dim)",
            color: "var(--amber)",
            border: "1px solid var(--border-accent)",
            borderRadius: 20,
            padding: "6px 16px",
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 24,
            animation: "fadeUp 0.5s ease forwards",
          }}
        >
          ✦ FedEx Certified Shipping Platform
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "clamp(40px, 8vw, 72px)",
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: 24,
            animation: "fadeUp 0.5s 0.1s ease both",
          }}
        >
          Ship Smarter.{" "}
          <span
            style={{
              background: "linear-gradient(135deg, var(--amber), var(--amber-light))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Track Everything.
          </span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: "var(--text-secondary)",
            maxWidth: 500,
            margin: "0 auto 40px",
            animation: "fadeUp 0.5s 0.2s ease both",
          }}
        >
          Professional FedEx shipping management — labels, tracking, and address validation in one platform.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
            animation: "fadeUp 0.5s 0.25s ease both",
          }}
        >
          <Link
            href="/login"
            style={{
              background: "var(--amber)",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: "var(--radius-md)",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.18s ease",
            }}
            className="hover:brightness-110 motion-safe:hover:-translate-y-px"
          >
            Sign in
            <ArrowRight size={18} aria-hidden />
          </Link>
          <Link
            href="/signup"
            style={{
              background: "transparent",
              color: "var(--amber)",
              border: "1px solid var(--border-accent)",
              padding: "12px 28px",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "all 0.18s ease",
            }}
            className="hover:bg-[var(--amber-dim)]"
          >
            Create account
            <ArrowRight size={18} aria-hidden />
          </Link>
        </div>

        <div
          style={{
            marginTop: 64,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "center",
          }}
        >
          {[
            {
              Icon: Package,
              title: "Label Generation",
              sub: "Instant FedEx labels",
              delay: "0.3s",
              color: "var(--amber)",
            },
            {
              Icon: Radio,
              title: "Live Tracking",
              sub: "Real-time updates",
              delay: "0.4s",
              color: "var(--text-secondary)",
            },
            {
              Icon: CheckCircle,
              title: "Address Validation",
              sub: "Smart correction",
              delay: "0.5s",
              color: "var(--green)",
            },
          ].map((c) => (
            <div
              key={c.title}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-lg)",
                padding: 24,
                width: 200,
                textAlign: "center",
                animation: `fadeUp 0.5s ${c.delay} ease both`,
                transition: "all 0.2s ease",
              }}
              className="motion-safe:hover:-translate-y-1 motion-safe:hover:border-[var(--border-accent)]"
            >
              <c.Icon size={32} color={c.color} style={{ margin: "0 auto 12px" }} aria-hidden />
              <p
                style={{
                  fontFamily: "var(--font-display), sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--text-primary)",
                  marginBottom: 8,
                }}
              >
                {c.title}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

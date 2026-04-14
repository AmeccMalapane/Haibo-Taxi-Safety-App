import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../api/client";
import { Button } from "../components/Button";
import {
  colors,
  radius,
  shadows,
  spacing,
  gradients,
  fonts,
  transitions,
} from "../lib/brand";

type Mode = "email" | "phone";
type PhoneStep = "enter" | "verify";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/";

  const [mode, setMode] = useState<Mode>("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [phoneStep, setPhoneStep] = useState<PhoneStep>("enter");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const reset = () => {
    setError(null);
    setLoading(false);
  };

  const switchMode = (next: Mode) => {
    reset();
    setMode(next);
    setPhoneStep("enter");
    setOtpCode("");
  };

  const finishLogin = (result: any) => {
    if (result.user?.role !== "admin") {
      setError(`Admin access required. Your role: ${result.user?.role || "unknown"}`);
      auth.logout();
      return;
    }
    navigate(from, { replace: true });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await auth.login(email, password);
      finishLogin(result);
    } catch (err: any) {
      setError(err.message?.includes("401") ? "Invalid credentials" : "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await auth.sendOTP(phone);
      setPhoneStep("verify");
    } catch (err: any) {
      const msg = err.message || "";
      setError(
        msg.includes("429")
          ? "Too many requests. Try again in a moment."
          : "Could not send OTP. Check the number and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await auth.verifyOTP(phone, otpCode);
      finishLogin(result);
    } catch (err: any) {
      const msg = err.message || "";
      setError(
        msg.includes("429")
          ? "Too many failed attempts. Request a new OTP."
          : "Invalid or expired code. Check and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Rose tint radial background anchored at top-right — matches the
        // mobile app's AuthScreen hero band treatment but adapted for a
        // desktop viewport.
        background: `
          radial-gradient(ellipse at top right, ${colors.roseAccent} 0%, transparent 55%),
          radial-gradient(ellipse at bottom left, rgba(26, 26, 46, 0.06) 0%, transparent 50%),
          ${colors.bg}
        `,
        padding: spacing.xl,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle decorative glow in the background */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: gradients.primary,
          opacity: 0.08,
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          background: colors.surface,
          borderRadius: radius.xl,
          padding: `${spacing["2xl"]}px ${spacing["2xl"]}px`,
          width: 440,
          maxWidth: "100%",
          boxShadow: shadows.xl,
          position: "relative",
          zIndex: 1,
          border: `1px solid ${colors.border}`,
        }}
      >
        {/* Hero — logo + brand name + welcome copy */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            marginBottom: spacing["2xl"],
          }}
        >
          <img
            src="/logo.svg"
            alt="Haibo!"
            width={64}
            height={64}
            style={{
              marginBottom: spacing.md,
              filter: "drop-shadow(0 8px 24px rgba(200, 30, 94, 0.35))",
            }}
          />
          <h1
            style={{
              fontFamily: fonts.heading,
              fontSize: 28,
              fontWeight: 700,
              color: colors.text,
              letterSpacing: -0.5,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Welcome back
          </h1>
          <div
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: spacing.xs,
            }}
          >
            Sign in to the Haibo Command Center
          </div>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Sign-in method"
          style={{
            display: "flex",
            gap: 4,
            padding: 4,
            background: colors.bg,
            borderRadius: radius.full,
            marginBottom: spacing.xl,
          }}
        >
          {(["email", "phone"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(m)}
                style={{
                  flex: 1,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  borderRadius: radius.full,
                  border: "none",
                  background: active ? colors.surface : "transparent",
                  color: active ? colors.rose : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: fonts.sans,
                  cursor: "pointer",
                  boxShadow: active ? shadows.sm : "none",
                  transition: transitions.medium,
                }}
              >
                {m === "email" ? "Email" : "Phone OTP"}
              </button>
            );
          })}
        </div>

        {mode === "email" ? (
          <form onSubmit={handleEmailSubmit}>
            <FieldLabel>EMAIL</FieldLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />

            <FieldLabel>PASSWORD</FieldLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />

            {error ? <ErrorBanner>{error}</ErrorBanner> : null}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              style={{ width: "100%", marginTop: spacing.md }}
            >
              Sign in
            </Button>
          </form>
        ) : phoneStep === "enter" ? (
          <form onSubmit={handleSendOtp}>
            <FieldLabel>PHONE</FieldLabel>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="+27…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
            />

            {error ? <ErrorBanner>{error}</ErrorBanner> : null}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={!phone.trim()}
              style={{ width: "100%", marginTop: spacing.md }}
            >
              Send OTP
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <FieldLabel>CODE SENT TO {phone}</FieldLabel>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
              required
              autoComplete="one-time-code"
              maxLength={6}
              style={{
                letterSpacing: 8,
                textAlign: "center",
                fontSize: 22,
                fontWeight: 700,
                fontFamily: fonts.mono,
              }}
            />

            {error ? <ErrorBanner>{error}</ErrorBanner> : null}

            <Button
              type="submit"
              size="lg"
              loading={loading}
              disabled={otpCode.length < 4}
              style={{ width: "100%", marginTop: spacing.md }}
            >
              Verify &amp; sign in
            </Button>

            <button
              type="button"
              onClick={() => {
                setPhoneStep("enter");
                setOtpCode("");
                setError(null);
              }}
              style={{
                marginTop: spacing.md,
                width: "100%",
                background: "transparent",
                border: "none",
                color: colors.textSecondary,
                fontSize: 13,
                cursor: "pointer",
                padding: spacing.sm,
                borderRadius: radius.sm,
                fontFamily: fonts.sans,
                transition: transitions.color,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = colors.rose)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = colors.textSecondary)
              }
            >
              Use a different number
            </button>
          </form>
        )}

        {/* Footer — admin-only notice */}
        <div
          style={{
            marginTop: spacing.xl,
            paddingTop: spacing.lg,
            borderTop: `1px solid ${colors.border}`,
            textAlign: "center",
            fontSize: 11,
            color: colors.textTertiary,
            letterSpacing: 0.3,
          }}
        >
          Admin accounts only · Activity is logged
        </div>
      </div>
    </div>
  );
}

// ─── Local presentational helpers ──────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
        letterSpacing: 0.5,
        fontFamily: fonts.sans,
      }}
    >
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={{
        width: "100%",
        padding: `${spacing.md}px ${spacing.lg}px`,
        borderRadius: radius.md,
        border: `1.5px solid ${focused ? colors.rose : colors.border}`,
        fontSize: 15,
        outline: "none",
        boxSizing: "border-box",
        fontFamily: fonts.sans,
        color: colors.text,
        background: colors.surface,
        transition: transitions.medium,
        boxShadow: focused ? `0 0 0 3px ${colors.roseAccent}` : "none",
        ...style,
      }}
    />
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        marginTop: spacing.md,
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderRadius: radius.md,
        background: colors.dangerSoft,
        color: colors.danger,
        fontSize: 13,
        fontWeight: 500,
        border: `1px solid ${colors.danger}20`,
      }}
    >
      {children}
    </div>
  );
}

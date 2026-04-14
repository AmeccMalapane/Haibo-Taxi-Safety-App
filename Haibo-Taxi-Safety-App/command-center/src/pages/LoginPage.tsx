import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../api/client";
import { Button } from "../components/Button";
import { colors, radius, shadows, spacing } from "../lib/brand";

type Mode = "email" | "phone";
type PhoneStep = "enter" | "verify";

/**
 * Mobile app is phone-first, so admins provisioned via the phone-OTP flow
 * need a matching entry point here. Email+password still works for admins
 * that were seeded with a password. The role gate (auth check for
 * user.role === "admin") is identical for both paths.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/";

  const [mode, setMode] = useState<Mode>("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Email form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone form
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
        background: colors.bg,
      }}
    >
      <div
        style={{
          background: colors.surface,
          borderRadius: radius.xl,
          padding: spacing["2xl"],
          width: 420,
          boxShadow: shadows.lg,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: spacing.xl }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: colors.rose }}>Haibo!</div>
          <div style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
            Command Center
          </div>
        </div>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Sign-in method"
          style={{
            display: "flex",
            gap: spacing.xs,
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
                  cursor: "pointer",
                  boxShadow: active ? shadows.sm : "none",
                  transition: "background 0.15s, color 0.15s",
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
            />

            <FieldLabel>PASSWORD</FieldLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error ? <ErrorBanner>{error}</ErrorBanner> : null}

            <Button type="submit" size="lg" loading={loading} style={{ width: "100%", marginTop: spacing.md }}>
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
              style={{ letterSpacing: 4, textAlign: "center", fontSize: 18, fontWeight: 600 }}
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
              }}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Local presentational helpers (scoped — not exported) ──────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginTop: spacing.md,
      }}
    >
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: "100%",
        padding: `${spacing.md}px ${spacing.lg}px`,
        borderRadius: radius.md,
        border: `1px solid ${colors.border}`,
        fontSize: 15,
        outline: "none",
        boxSizing: "border-box",
        fontFamily: "inherit",
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
      }}
    >
      {children}
    </div>
  );
}

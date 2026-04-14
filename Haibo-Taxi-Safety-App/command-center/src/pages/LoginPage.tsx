import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "../api/client";
import { Button } from "../components/Button";
import { colors, radius, shadows, spacing } from "../lib/brand";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await auth.login(email, password);
      if (result.user?.role !== "admin") {
        setError(`Admin access required. Your role: ${result.user?.role || "unknown"}`);
        auth.logout();
        return;
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message?.includes("401") ? "Invalid credentials" : "Login failed. Please try again.");
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
        <div style={{ textAlign: "center", marginBottom: spacing["2xl"] }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: colors.rose }}>Haibo!</div>
          <div style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
            Command Center
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: spacing.md }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: spacing.xs }}>
              EMAIL
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: "100%",
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </label>

          <label style={{ display: "block", marginBottom: spacing.lg }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginBottom: spacing.xs }}>
              PASSWORD
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: `${spacing.md}px ${spacing.lg}px`,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </label>

          {error ? (
            <div
              style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radius.md,
                background: colors.dangerSoft,
                color: colors.danger,
                fontSize: 13,
                marginBottom: spacing.md,
              }}
            >
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            style={{ width: "100%" }}
          >
            Sign in to Command Center
          </Button>
        </form>
      </div>
    </div>
  );
}

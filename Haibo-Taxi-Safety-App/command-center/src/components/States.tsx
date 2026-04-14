import React from "react";
import { colors, radius, spacing } from "../lib/brand";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        padding: `${spacing["2xl"]}px ${spacing.xl}px`,
        textAlign: "center",
        color: colors.textTertiary,
        fontSize: 14,
        background: colors.surface,
        borderRadius: radius.lg,
        border: `1px dashed ${colors.border}`,
      }}
    >
      {label}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  hint?: React.ReactNode;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: `${spacing["2xl"]}px ${spacing.xl}px`,
        textAlign: "center",
        background: colors.surface,
        borderRadius: radius.lg,
        border: `1px dashed ${colors.border}`,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{title}</div>
      {hint ? (
        <div style={{ marginTop: spacing.xs, fontSize: 13, color: colors.textSecondary }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ title = "Couldn't load data", error, onRetry }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div
      style={{
        padding: `${spacing.xl}px`,
        background: colors.dangerSoft,
        borderRadius: radius.lg,
        border: `1px solid ${colors.danger}`,
        color: colors.danger,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: spacing.xs }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.85 }}>{message}</div>
      {onRetry ? (
        <button
          onClick={onRetry}
          style={{
            marginTop: spacing.md,
            padding: `${spacing.sm}px ${spacing.lg}px`,
            borderRadius: radius.md,
            border: `1px solid ${colors.danger}`,
            background: "transparent",
            color: colors.danger,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

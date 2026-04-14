import React from "react";
import { colors, radius, shadows, spacing, typography } from "../lib/brand";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "default" | "danger" | "success" | "rose";
}

const accentColors = {
  default: colors.text,
  danger: colors.danger,
  success: colors.success,
  rose: colors.rose,
};

export function StatCard({ label, value, sub, accent = "default" }: StatCardProps) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        padding: `${spacing.lg}px ${spacing.xl}px`,
        boxShadow: shadows.sm,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ ...typography.cardLabel, marginBottom: spacing.xs }}>{label}</div>
      <div style={{ ...typography.cardValue, color: accentColors[accent] }}>{value}</div>
      {sub ? (
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: spacing.xs }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

interface CardProps {
  children: React.ReactNode;
  padded?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, padded = true, style }: CardProps) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: shadows.sm,
        border: `1px solid ${colors.border}`,
        padding: padded ? spacing.xl : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

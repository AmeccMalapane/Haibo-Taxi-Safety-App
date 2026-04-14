import React, { useState } from "react";
import { LucideIcon } from "lucide-react";
import {
  colors,
  radius,
  shadows,
  spacing,
  typography,
  transitions,
  gradients,
} from "../lib/brand";

type Accent = "default" | "danger" | "success" | "rose";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: Accent;
  Icon?: LucideIcon;
  onClick?: () => void;
}

const accentColors: Record<Accent, string> = {
  default: colors.text,
  danger: colors.danger,
  success: colors.success,
  rose: colors.rose,
};

const accentBadgeBg: Record<Accent, string> = {
  default: colors.bg,
  danger: colors.dangerSoft,
  success: colors.successSoft,
  rose: colors.roseAccent,
};

export function StatCard({
  label,
  value,
  sub,
  accent = "default",
  Icon,
  onClick,
}: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  const clickable = !!onClick;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        padding: `${spacing.xl}px ${spacing.xl}px ${spacing.lg}px`,
        boxShadow: hovered && clickable ? shadows.md : shadows.sm,
        border: `1px solid ${
          hovered && clickable ? colors.borderStrong : colors.border
        }`,
        cursor: clickable ? "pointer" : "default",
        transition: transitions.medium,
        transform: hovered && clickable ? "translateY(-1px)" : "none",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top row: label + optional icon badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: spacing.xs,
          gap: spacing.md,
        }}
      >
        <div style={{ ...typography.cardLabel, flex: 1 }}>{label}</div>
        {Icon ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: accentBadgeBg[accent],
              color: accentColors[accent],
              flexShrink: 0,
            }}
          >
            <Icon size={16} strokeWidth={2.2} />
          </div>
        ) : null}
      </div>

      <div
        style={{
          ...typography.cardValue,
          color: accentColors[accent],
          fontVariant: "tabular-nums",
        }}
      >
        {value}
      </div>

      {sub ? (
        <div
          style={{
            fontSize: 12,
            color: colors.textTertiary,
            marginTop: spacing.xs,
            fontFamily: "inherit",
          }}
        >
          {sub}
        </div>
      ) : null}

      {/* Accent bar on the left — subtle hint of the card's status */}
      {accent !== "default" ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background:
              accent === "rose"
                ? gradients.primary
                : accentColors[accent],
          }}
        />
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

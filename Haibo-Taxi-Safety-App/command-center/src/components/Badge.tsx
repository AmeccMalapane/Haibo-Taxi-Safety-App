import React from "react";
import { colors, radius } from "../lib/brand";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "rose";

interface BadgeProps {
  tone?: BadgeTone;
  children: React.ReactNode;
}

const toneStyles: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.border, fg: colors.textSecondary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  rose: { bg: colors.roseAccent, fg: colors.rose },
};

export function Badge({ tone = "neutral", children }: BadgeProps) {
  const { bg, fg } = toneStyles[tone];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: radius.full,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Map a complaint/incident severity string to a Badge tone so callers don't
 * sprinkle ternary tone lookups across every table cell.
 */
export function severityTone(severity?: string | null): BadgeTone {
  switch (severity) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    case "low":
      return "neutral";
    default:
      return "neutral";
  }
}

export function statusTone(status?: string | null): BadgeTone {
  switch (status) {
    case "resolved":
    case "completed":
    case "verified":
      return "success";
    case "pending":
    case "in_progress":
      return "warning";
    case "failed":
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

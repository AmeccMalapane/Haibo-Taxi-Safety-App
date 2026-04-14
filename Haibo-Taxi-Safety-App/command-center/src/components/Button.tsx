import React from "react";
import { colors, radius, spacing } from "../lib/brand";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: colors.rose,
    color: "#FFFFFF",
    border: "none",
  },
  secondary: {
    background: colors.surface,
    color: colors.text,
    border: `1px solid ${colors.border}`,
  },
  ghost: {
    background: "transparent",
    color: colors.rose,
    border: "none",
  },
  danger: {
    background: colors.dangerSoft,
    color: colors.danger,
    border: `1px solid ${colors.danger}`,
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: `${spacing.xs}px ${spacing.md}px`, fontSize: 12 },
  md: { padding: `${spacing.sm}px ${spacing.lg}px`, fontSize: 14 },
  lg: { padding: `${spacing.md}px ${spacing.xl}px`, fontSize: 15 },
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        borderRadius: radius.md,
        fontWeight: 600,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.6 : 1,
        transition: "opacity 0.15s, transform 0.05s",
        ...style,
      }}
    >
      {loading ? "…" : children}
    </button>
  );
}

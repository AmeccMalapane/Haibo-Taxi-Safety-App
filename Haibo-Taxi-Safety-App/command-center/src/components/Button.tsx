import React, { useState } from "react";
import { colors, radius, shadows, spacing, transitions, gradients, fonts } from "../lib/brand";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantBase: Record<Variant, React.CSSProperties> = {
  primary: {
    background: gradients.primary,
    color: "#FFFFFF",
    border: "1px solid transparent",
    boxShadow: shadows.brandSm,
  },
  secondary: {
    background: colors.surface,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    boxShadow: "none",
  },
  ghost: {
    background: "transparent",
    color: colors.rose,
    border: "1px solid transparent",
    boxShadow: "none",
  },
  danger: {
    background: colors.dangerSoft,
    color: colors.danger,
    border: `1px solid ${colors.danger}`,
    boxShadow: "none",
  },
};

const variantHover: Record<Variant, React.CSSProperties> = {
  primary: {
    boxShadow: shadows.brandLg,
    transform: "translateY(-1px)",
  },
  secondary: {
    background: colors.surfaceAlt,
    borderColor: colors.borderStrong,
    transform: "translateY(-1px)",
    boxShadow: shadows.sm,
  },
  ghost: {
    background: colors.roseFaint,
  },
  danger: {
    background: colors.danger,
    color: "#FFFFFF",
    transform: "translateY(-1px)",
    boxShadow: shadows.dangerLg,
  },
};

const variantActive: Record<Variant, React.CSSProperties> = {
  primary: { transform: "translateY(0)", boxShadow: shadows.brandSm },
  secondary: { transform: "translateY(0)", boxShadow: "none" },
  ghost: {},
  danger: { transform: "translateY(0)" },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: {
    padding: `${spacing.sm}px ${spacing.lg}px`,
    fontSize: 12,
    minHeight: 30,
  },
  md: {
    padding: `${spacing.md}px ${spacing.xl}px`,
    fontSize: 14,
    minHeight: 38,
  },
  lg: {
    padding: `${spacing.lg}px ${spacing["2xl"]}px`,
    fontSize: 15,
    minHeight: 46,
  },
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
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);

  const base = variantBase[variant];
  const hover = hovered && !isDisabled ? variantHover[variant] : {};
  const pressed = active && !isDisabled ? variantActive[variant] : {};

  const focusRing =
    focused && !isDisabled
      ? { boxShadow: `${base.boxShadow || "0 0 0 0 transparent"}, 0 0 0 3px ${colors.roseAccent}` }
      : {};

  return (
    <button
      {...rest}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={{
        fontFamily: fonts.sans,
        fontWeight: 600,
        borderRadius: radius.md,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        transition: transitions.medium,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        outline: "none",
        letterSpacing: 0.1,
        ...base,
        ...sizeStyles[size],
        ...hover,
        ...pressed,
        ...focusRing,
        ...style,
      }}
    >
      {loading ? (
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: `2px solid currentColor`,
            borderTopColor: "transparent",
            animation: "btn-spin 0.7s linear infinite",
          }}
          aria-hidden
        />
      ) : (
        children
      )}
      <style>{`
        @keyframes btn-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

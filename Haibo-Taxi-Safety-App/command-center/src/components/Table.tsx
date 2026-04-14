import React from "react";
import { colors, radius, shadows, spacing } from "../lib/brand";

interface TableProps {
  children: React.ReactNode;
}

export function Table({ children }: TableProps) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius.lg,
        boxShadow: shadows.sm,
        border: `1px solid ${colors.border}`,
        overflow: "hidden",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        {children}
      </table>
    </div>
  );
}

interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

export function TH({ children, style, ...rest }: THProps) {
  return (
    <th
      {...rest}
      style={{
        textAlign: "left",
        padding: `${spacing.md}px ${spacing.lg}px`,
        fontSize: 11,
        color: colors.textTertiary,
        borderBottom: `1px solid ${colors.border}`,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.4,
        background: colors.surfaceAlt,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  truncate?: boolean;
}

export function TD({ children, truncate, style, ...rest }: TDProps) {
  return (
    <td
      {...rest}
      style={{
        padding: `${spacing.md}px ${spacing.lg}px`,
        fontSize: 14,
        color: colors.text,
        borderBottom: `1px solid ${colors.border}`,
        ...(truncate
          ? {
              maxWidth: 280,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </td>
  );
}

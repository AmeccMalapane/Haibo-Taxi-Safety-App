import React from "react";
import { colors, spacing, typography } from "../lib/brand";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <div>
        <h1 style={{ ...typography.pageTitle, color: colors.text, margin: 0 }}>{title}</h1>
        {subtitle ? (
          <div style={{ ...typography.pageSub, marginTop: spacing.xs }}>{subtitle}</div>
        ) : null}
      </div>
      {right ? <div>{right}</div> : null}
    </div>
  );
}

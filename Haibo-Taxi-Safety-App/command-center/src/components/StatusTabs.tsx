import React from "react";
import { colors, radius, spacing, transitions } from "../lib/brand";

export interface StatusTab {
  label: string;
  value: string;
  count?: number;
}

interface StatusTabsProps {
  tabs: StatusTab[];
  active: string;
  onChange: (value: string) => void;
}

/**
 * Reusable status tab strip. Extracted so that Withdrawals, SOS,
 * Pasop, Drivers, Group rides, and Deliveries all share the same
 * pill + count-badge look without each page inlining 30 lines of
 * the same JSX.
 */
export function StatusTabs({ tabs, active, onChange }: StatusTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: spacing.sm,
        marginBottom: spacing.lg,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value || "all"}
            onClick={() => onChange(tab.value)}
            aria-pressed={isActive}
            style={{
              padding: `${spacing.sm}px ${spacing.lg}px`,
              borderRadius: radius.full,
              border: `1px solid ${isActive ? colors.rose : colors.border}`,
              background: isActive ? colors.rose : colors.surface,
              color: isActive ? "#FFFFFF" : colors.text,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              transition: transitions.medium,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {tab.label}
            {typeof tab.count === "number" && tab.count > 0 ? (
              <span
                style={{
                  padding: "1px 7px",
                  borderRadius: radius.full,
                  background: isActive ? "rgba(255,255,255,0.22)" : colors.rose,
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 700,
                  fontVariant: "tabular-nums",
                }}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

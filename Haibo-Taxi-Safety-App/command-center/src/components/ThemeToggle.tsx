import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";
import { colors, radius, transitions } from "../lib/brand";

/**
 * Round icon button that flips the command-center between light and dark.
 * Uses the shared ThemeProvider so the state persists across sessions and
 * follows the OS preference when the user hasn't picked one explicitly.
 * Drop anywhere — the navbar mounts one in the top-right.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        appearance: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: radius.full,
        border: `1px solid ${colors.border}`,
        background: colors.card,
        color: colors.foreground,
        cursor: "pointer",
        transition: transitions.fast,
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

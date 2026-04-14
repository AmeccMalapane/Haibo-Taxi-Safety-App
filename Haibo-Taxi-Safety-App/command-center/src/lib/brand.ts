/**
 * Command Center brand tokens — mirrors client/constants/theme.ts so the
 * admin UI stays visually consistent with the mobile app. Rose was darkened
 * from #E72369 → #C81E5E to meet WCAG AA 4.5:1 on white; gradient end
 * moved from #EA4F52 → #D13A52 for the same reason.
 */

export const colors = {
  // Rose brand (WCAG AA on white)
  rose: "#C81E5E",
  roseDark: "#A01849",
  roseLight: "#D13A52",
  roseSoft: "#FCE4EC",
  roseFaint: "rgba(200, 30, 94, 0.08)",
  roseAccent: "rgba(200, 30, 94, 0.15)",

  // Surfaces
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFAFB",
  border: "#EEEEEF",
  borderStrong: "#D9DADD",

  // Sidebar (dark)
  sidebarBg: "#1A1A2E",
  sidebarFgDim: "rgba(255, 255, 255, 0.7)",
  sidebarFgFaint: "rgba(255, 255, 255, 0.4)",
  sidebarDivider: "rgba(255, 255, 255, 0.08)",

  // Text
  text: "#1A1A1F",
  textSecondary: "#5A5A62",
  textTertiary: "#8A8A92",

  // Status
  success: "#2E7D32",
  successSoft: "#E8F5E9",
  warning: "#F57F17",
  warningSoft: "#FFF8E1",
  danger: "#C62828",
  dangerSoft: "#FCE4EC",
  info: "#1565C0",
  infoSoft: "#E3F2FD",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  pageTitle: {
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  pageSub: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    fontWeight: 600,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
} as const;

export const shadows = {
  sm: "0 1px 3px rgba(0, 0, 0, 0.05)",
  md: "0 4px 12px rgba(0, 0, 0, 0.06)",
  lg: "0 8px 24px rgba(0, 0, 0, 0.08)",
} as const;

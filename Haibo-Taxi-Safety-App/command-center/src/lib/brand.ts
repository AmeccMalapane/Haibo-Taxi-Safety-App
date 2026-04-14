/**
 * Command Center brand tokens — mirrors client/constants/theme.ts so the
 * admin UI stays visually consistent with the mobile app.
 *
 * Rose was darkened from #E72369 → #C81E5E to meet WCAG AA 4.5:1 on white;
 * gradient end moved from #EA4F52 → #D13A52 for the same reason. Small white
 * bold text on the gradient now passes across the full range.
 */

export const colors = {
  // Rose brand (WCAG AA on white)
  rose: "#C81E5E",
  roseDark: "#A01849",
  roseLight: "#D13A52",
  roseSoft: "#FCE4EC",
  roseFaint: "rgba(200, 30, 94, 0.08)",
  roseAccent: "rgba(200, 30, 94, 0.15)",

  // Gradient stops — use via `gradients.primary` below
  gradientStart: "#C81E5E",
  gradientEnd: "#D13A52",

  // Surfaces
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  surfaceAlt: "#FAFAFB",
  surfaceElevated: "#FFFFFF",
  border: "#EEEEEF",
  borderStrong: "#D9DADD",

  // Sidebar (dark — matches mobile's dark-mode nav tone)
  sidebarBg: "#1A1A2E",
  sidebarFgDim: "rgba(255, 255, 255, 0.72)",
  sidebarFgFaint: "rgba(255, 255, 255, 0.42)",
  sidebarDivider: "rgba(255, 255, 255, 0.08)",

  // Text
  text: "#1A1A1F",
  textSecondary: "#5A5A62",
  textTertiary: "#8A8A92",
  textOnBrand: "#FFFFFF",

  // Status (match mobile BrandColors.status)
  success: "#2E7D32",
  successSoft: "#E8F5E9",
  warning: "#F57F17",
  warningSoft: "#FFF8E1",
  danger: "#C62828",
  dangerSoft: "#FCE4EC",
  info: "#1565C0",
  infoSoft: "#E3F2FD",

  // Grayscale (mobile BrandColors.gray)
  gray50: "#FAFAFA",
  gray100: "#F5F5F5",
  gray200: "#EEEEEE",
  gray300: "#E0E0E0",
  gray400: "#BDBDBD",
  gray500: "#9E9E9E",
  gray600: "#757575",
  gray700: "#616161",
  gray800: "#424242",
  gray900: "#212121",
} as const;

/** CSS gradient strings — drop straight into `background`. */
export const gradients = {
  primary: `linear-gradient(135deg, ${colors.gradientStart} 0%, ${colors.gradientEnd} 100%)`,
  primaryReversed: `linear-gradient(135deg, ${colors.gradientEnd} 0%, ${colors.gradientStart} 100%)`,
  subtle: `linear-gradient(180deg, ${colors.surface} 0%, ${colors.surfaceAlt} 100%)`,
} as const;

/**
 * Spacing — 9-tier scale matching mobile theme.ts.
 * xs(4) sm(6) md(10) lg(14) xl(18) 2xl(22) 3xl(28) 4xl(34) 5xl(42)
 */
export const spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  "2xl": 22,
  "3xl": 28,
  "4xl": 34,
  "5xl": 42,
} as const;

/**
 * Border radius — rounder than a typical admin dashboard to match the mobile
 * app's friendly feel. Mobile uses xs(6) → 3xl(44). We use the same scale.
 */
export const radius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  "2xl": 34,
  "3xl": 44,
  full: 9999,
} as const;

/**
 * Shadow tokens — tiered elevation + brand-tinted variants for gradient CTAs.
 * Web equivalents of BrandShadows from mobile theme.ts.
 */
export const shadows = {
  none: "none",
  sm: "0 2px 8px rgba(0, 0, 0, 0.05)",
  md: "0 4px 12px rgba(0, 0, 0, 0.08)",
  lg: "0 8px 16px rgba(0, 0, 0, 0.12)",
  xl: "0 12px 24px rgba(0, 0, 0, 0.18)",
  brandSm: "0 4px 12px rgba(200, 30, 94, 0.25)",
  brandLg: "0 8px 20px rgba(200, 30, 94, 0.35)",
  successLg: "0 8px 20px rgba(46, 125, 50, 0.25)",
  dangerLg: "0 8px 20px rgba(198, 40, 40, 0.25)",
} as const;

/**
 * Font family stacks — Space Grotesk for headings, Inter for body.
 * Matches mobile `Fonts.web` in theme.ts.
 */
export const fonts = {
  sans: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  heading: "'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif",
  mono: "'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
} as const;

/**
 * Typography tokens — drop-in style objects.
 * Headings use Space Grotesk, body uses Inter. Sizes and weights mirror
 * mobile Typography in theme.ts but scaled up slightly for desktop reading.
 */
export const typography = {
  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.4,
    lineHeight: 1.2,
  },
  pageSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 400,
    color: colors.textSecondary,
    lineHeight: 1.5,
  },
  cardLabel: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textTertiary,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    fontWeight: 600,
  },
  cardValue: {
    fontFamily: fonts.heading,
    fontSize: 30,
    fontWeight: 700,
    letterSpacing: -0.4,
    lineHeight: 1.1,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.55,
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
} as const;

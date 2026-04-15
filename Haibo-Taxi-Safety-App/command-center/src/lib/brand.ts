/**
 * Command Center brand tokens.
 *
 * The deployed reference at app.haibo.africa uses Tailwind v4 with
 * shadcn-style CSS variables (`--background`, `--foreground`, `--primary`
 * etc.) and a `.dark` class on `<html>` to flip between light and dark
 * themes. We mirror that token system here as `var(--name)` strings so
 * every inline style in the codebase participates in the theme flip
 * automatically — no React-side re-render needed.
 *
 * The literal hex fallbacks are only used when a component reaches for
 * a brand-specific color the semantic tokens don't expose (e.g.
 * `colors.haiboPink` for a gradient stop or shadow tint). Everything
 * else should prefer the semantic tokens (`colors.background`,
 * `colors.foreground`, etc.) so dark mode just works.
 *
 * CSS variable definitions live in `command-center/index.html` inside
 * the inline `:root` / `html.dark` blocks so the very first paint
 * respects the persisted theme before React mounts.
 */

// Semantic tokens — values come from CSS variables so `.dark` on <html>
// flips them automatically. Same names as the deployed reference uses.
export const colors = {
  // shadcn-style semantic tokens
  background: "var(--background)",
  foreground: "var(--foreground)",
  card: "var(--card)",
  cardForeground: "var(--card-foreground)",
  popover: "var(--popover)",
  popoverForeground: "var(--popover-foreground)",
  primary: "var(--primary)",
  primaryForeground: "var(--primary-foreground)",
  secondary: "var(--secondary)",
  secondaryForeground: "var(--secondary-foreground)",
  muted: "var(--muted)",
  mutedForeground: "var(--muted-foreground)",
  accent: "var(--accent)",
  accentForeground: "var(--accent-foreground)",
  destructive: "var(--destructive)",
  destructiveForeground: "var(--destructive-foreground)",
  border: "var(--border)",
  input: "var(--input)",
  ring: "var(--ring)",
  sidebarBg: "var(--sidebar)",
  sidebarFg: "var(--sidebar-foreground)",
  sidebarBorder: "var(--sidebar-border)",

  // Brand-literal hex values — use only for gradient stops, shadow tints,
  // or anywhere you need a specific swatch rather than the semantic token.
  // These match the deployed reference's haibo-* custom palette.
  haiboPink: "#E72369",
  haiboPinkDark: "#D42281",
  haiboCoral: "#DD4D57",
  haiboCoralAccent: "#EA4F52",
  haiboGold: "#E49E22",
  haiboError: "#C21725",
  haiboSuccess: "#2F9F3D",
  haiboInfo: "#0079B3",
  haiboDark: "#0C121A",

  // Haibo gray scale — used for non-semantic accents (e.g. divider tints).
  haiboGray100: "#F0F2F4",
  haiboGray200: "#E7E8EA",
  haiboGray300: "#D6D7D9",
  haiboGray400: "#ACAEB1",
  haiboGray500: "#8D8F92",
  haiboGray600: "#616366",
  haiboGray700: "#4B4D50",

  // ─── Back-compat aliases ────────────────────────────────────────────
  // Older components were written against the previous token names.
  // Keep them alive as view-through aliases so the refactor doesn't
  // need a flag-day rewrite of every page; new code should use the
  // semantic names above.
  rose: "var(--primary)",
  roseDark: "#D42281",
  roseLight: "#EA4F52",
  roseSoft: "#F5E8EE",
  roseFaint: "rgba(231, 35, 105, 0.08)",
  roseAccent: "rgba(231, 35, 105, 0.15)",
  gradientStart: "#E72369",
  gradientEnd: "#D42281",
  bg: "var(--background)",
  surface: "var(--card)",
  surfaceAlt: "var(--muted)",
  surfaceElevated: "var(--card)",
  borderStrong: "var(--border)",
  sidebarFgDim: "rgba(255, 255, 255, 0.72)",
  sidebarFgFaint: "rgba(255, 255, 255, 0.42)",
  sidebarDivider: "var(--sidebar-border)",
  text: "var(--foreground)",
  textSecondary: "var(--muted-foreground)",
  textTertiary: "var(--muted-foreground)",
  textOnBrand: "#FFFFFF",

  // Status palette (mobile BrandColors.status parity)
  success: "#2F9F3D",
  successSoft: "rgba(47, 159, 61, 0.10)",
  warning: "#E49E22",
  warningSoft: "rgba(228, 158, 34, 0.10)",
  danger: "#C21725",
  dangerSoft: "rgba(194, 23, 37, 0.10)",
  info: "#0079B3",
  infoSoft: "rgba(0, 121, 179, 0.10)",

  // Grayscale (mobile BrandColors.gray) — keep the old names aliased
  // to the haibo-gray palette so existing components don't break.
  gray50: "#FAFAFA",
  gray100: "#F0F2F4",
  gray200: "#E7E8EA",
  gray300: "#D6D7D9",
  gray400: "#ACAEB1",
  gray500: "#8D8F92",
  gray600: "#616366",
  gray700: "#4B4D50",
  gray800: "#2A2E33",
  gray900: "#0C121A",
} as const;

/** CSS gradient strings — drop straight into `background`. */
export const gradients = {
  primary: `linear-gradient(135deg, ${colors.haiboPink} 0%, ${colors.haiboPinkDark} 100%)`,
  primaryReversed: `linear-gradient(135deg, ${colors.haiboPinkDark} 0%, ${colors.haiboPink} 100%)`,
  warm: `linear-gradient(135deg, ${colors.haiboPink} 0%, ${colors.haiboGold} 100%)`,
  subtle: `linear-gradient(180deg, var(--card) 0%, var(--muted) 100%)`,
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
 * Shadow tokens sourced from CSS variables so dark mode can soften them
 * without touching component code. Brand-tinted variants stay literal
 * because their color comes from the haibo-pink palette, not the theme.
 */
export const shadows = {
  none: "none",
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-lg)",
  brandSm: "0 4px 12px rgba(231, 35, 105, 0.25)",
  brandLg: "var(--shadow-brand)",
  successLg: "0 8px 20px rgba(47, 159, 61, 0.25)",
  dangerLg: "0 8px 20px rgba(194, 23, 37, 0.25)",
} as const;

/**
 * Transition tokens — keep hover/focus/state changes consistent across the
 * app. Fast for micro-interactions, medium for layout shifts, slow for
 * page-level morphs. All use an ease-out curve so elements "settle" into
 * their final state rather than bouncing.
 */
export const transitions = {
  fast: "all 0.12s cubic-bezier(0.2, 0.8, 0.4, 1)",
  medium: "all 0.22s cubic-bezier(0.2, 0.8, 0.4, 1)",
  slow: "all 0.35s cubic-bezier(0.2, 0.8, 0.4, 1)",
  transform: "transform 0.12s cubic-bezier(0.2, 0.8, 0.4, 1)",
  color: "color 0.15s, background 0.15s, border-color 0.15s",
} as const;

/**
 * Font family stacks — Nunito for body/UI, Space Grotesk for headings,
 * DM Sans as a friendly variant for marketing surfaces. Matches the
 * deployed app.haibo.africa reference.
 */
export const fonts = {
  sans: "'Nunito', 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  body: "'Nunito', 'DM Sans', system-ui, -apple-system, sans-serif",
  heading: "'Space Grotesk', 'Nunito', system-ui, -apple-system, sans-serif",
  accent: "'DM Sans', 'Nunito', system-ui, -apple-system, sans-serif",
  mono: "'SFMono-Regular', Menlo, Monaco, Consolas, monospace",
} as const;

/**
 * Typography tokens — drop-in style objects. Headings use Space Grotesk,
 * body uses Nunito. Sizes and weights mirror the mobile Typography
 * tokens but scaled up slightly for desktop reading.
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
    fontWeight: 700,
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
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
} as const;

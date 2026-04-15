import { Platform, Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const DeviceSizes = {
  isSmall: SCREEN_WIDTH < 360,
  isMedium: SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 414,
  isLarge: SCREEN_WIDTH >= 414,
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
};

export const ResponsiveSpacing = {
  horizontal: DeviceSizes.isSmall ? 10 : DeviceSizes.isMedium ? 14 : 18,
  vertical: DeviceSizes.isSmall ? 6 : DeviceSizes.isMedium ? 10 : 14,
  cardPadding: DeviceSizes.isSmall ? 10 : 14,
  listItemHeight: DeviceSizes.isSmall ? 52 : 60,
  buttonHeight: DeviceSizes.isSmall ? 42 : 50,
  inputHeight: DeviceSizes.isSmall ? 42 : 46,
  tabBarHeight: DeviceSizes.isSmall ? 58 : 68,
};

// ClarifyUX: Rose Red as primary tint.
// Darkened from the original #E72369 (4.34:1 on white) to #C81E5E (5.52:1)
// so white small-bold text on rose surfaces meets WCAG AA 4.5:1. The dark-
// mode tint stays #EA4F52 — on a #121212 surface it clocks 5.12:1, so dark
// mode doesn't need the shift.
const tintColorLight = "#C81E5E";
const tintColorDark = "#EA4F52";

export type Colors = {
  text: string;
  textSecondary: string;
  buttonText: string;
  tabIconDefault: string;
  tabIconSelected: string;
  link: string;
  backgroundRoot: string;
  backgroundDefault: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  backgroundElevated: string;
  border: string;
  surface: string;
};

export const Colors: { light: Colors; dark: Colors } = {
  light: {
    text: "#212121",
    textSecondary: "#757575",
    buttonText: "#FFFFFF",
    tabIconDefault: "#757575",
    tabIconSelected: tintColorLight,
    link: "#C81E5E",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F8F9FA",
    backgroundSecondary: "#F0F0F0",
    backgroundTertiary: "#E0E0E0",
    backgroundElevated: "#FFFFFF",
    border: "#E0E0E0",
    surface: "#FFFFFF",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: "#EA4F52",
    backgroundRoot: "#121212",
    backgroundDefault: "#121212",
    backgroundSecondary: "#1E1E1E",
    backgroundTertiary: "#2C2C2C",
    backgroundElevated: "#1E1E1E",
    border: "#333333",
    surface: "#1E1E1E",
  },
};

export const BrandColors = {
  primary: {
    // `red` / `redDark` stay WCAG-safe so small white text on rose surfaces
    // meets AA 4.5:1. `brandVivid` / `brandVividDark` mirror the deployed
    // reference (app.haibo.africa) for large decorative surfaces — logos,
    // hero glows, feature graphics — where the 4.34:1 original passes
    // "large text" / "graphical" WCAG thresholds.
    gradientStart: "#C81E5E",
    gradientEnd: "#D13A52",
    red: "#C81E5E",
    redDark: "#C62828",
    brandVivid: "#E72369",
    brandVividDark: "#D42281",
    blue: "#1976D2",
    blueDark: "#1565C0",
    green: "#388E3C",
    greenDark: "#2E7D32",
    orange: "#F57C00",
  },
  gradient: {
    // Small-text-safe gradient (use on CTAs with labels <18px)
    primary: ["#C81E5E", "#D13A52"] as string[],
    primaryReversed: ["#D13A52", "#C81E5E"] as string[],
    // Brand-vivid gradient (use on large hero surfaces, splash screens,
    // feature graphics — NOT on CTAs with small labels)
    brandVivid: ["#E72369", "#D42281"] as string[],
  },
  secondary: {
    orange: "#F57C00",
    orangeLight: "#FF9800",
    purple: "#7B1FA2",
    purpleLight: "#9C27B0",
    green: "#4CAF50",
    greenLight: "#66BB6A",
  },
  status: {
    emergency: "#C62828",
    warning: "#FFA000",
    success: "#28A745",
    info: "#0288D1",
  },
  gray: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#EEEEEE",
    300: "#E0E0E0",
    400: "#BDBDBD",
    500: "#9E9E9E",
    600: "#757575",
    700: "#616161",
    800: "#424242",
    900: "#212121",
  },
};

/**
 * Shadow tokens — tiered elevation system matching Material/iOS conventions.
 * Use these instead of inlining shadow props so the whole app can swap to a
 * different shadow language (e.g. borders-only on dark mode) in one place.
 *
 * Usage:
 *   style={[styles.card, BrandShadows.sm]}
 *
 * Each token is a complete shadow style block — offset, color, opacity,
 * radius, and Android elevation. Drop it into a StyleSheet spread.
 */
export const BrandShadows = {
  // Flat — no elevation, for cards on the same plane as the page
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  // sm — subtle card lift (list items, small cards)
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  // md — standard elevated card (content cards, stats)
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  // lg — floating panels (bottom sheets, modals, hero cards)
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  // xl — top-layer floating (FABs, dismissible overlays)
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  // brandSm — rose-tinted small shadow for interactive accents
  brandSm: {
    shadowColor: "#C81E5E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  // brandLg — rose-tinted strong glow for FABs + gradient CTAs
  brandLg: {
    shadowColor: "#C81E5E",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  // success / danger tinted shadows for state cards
  successLg: {
    shadowColor: "#28A745",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  dangerLg: {
    shadowColor: "#C62828",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  "2xl": 22,
  "3xl": 28,
  "4xl": 34,
  "5xl": 42,
  inputHeight: 46,
  buttonHeight: 50,
  sosButtonSize: 68,
  iconSize: 22,
  iconSizeSmall: 18,
  iconSizeLarge: 30,
  touchableMinSize: 44,
};

export const BorderRadius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 26,
  "2xl": 34,
  "3xl": 44,
  full: 9999,
};

// Android's default `includeFontPadding: true` combined with Space Grotesk's
// ascender-heavy metrics causes top-clipping on heading text — observed on
// Profile, City Explorer, Emergency, and Dashboard hero titles. Turning the
// font padding off and bumping line heights a few pixels gives headings
// enough headroom to render without the tops of capitals getting clipped.
const headingAndroidFix =
  Platform.OS === "android" ? { includeFontPadding: false } : {};

export const Typography = {
  h1: {
    fontSize: 30,
    lineHeight: 42,
    fontWeight: "700" as const,
    fontFamily: "SpaceGrotesk_700Bold",
    ...headingAndroidFix,
  },
  h2: {
    fontSize: 26,
    lineHeight: 38,
    fontWeight: "700" as const,
    fontFamily: "SpaceGrotesk_700Bold",
    ...headingAndroidFix,
  },
  h3: {
    fontSize: 22,
    lineHeight: 32,
    fontWeight: "600" as const,
    fontFamily: "SpaceGrotesk_600SemiBold",
    ...headingAndroidFix,
  },
  h4: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: "600" as const,
    fontFamily: "SpaceGrotesk_600SemiBold",
    ...headingAndroidFix,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
    fontFamily: "Inter_400Regular",
  },
  small: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    fontFamily: "Inter_400Regular",
  },
  link: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500" as const,
    fontFamily: "Inter_500Medium",
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
};

export const FontFamily = {
  heading: "SpaceGrotesk_700Bold",
  headingSemiBold: "SpaceGrotesk_600SemiBold",
  headingMedium: "SpaceGrotesk_500Medium",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export const Fonts = Platform.select({
  ios: {
    sans: "Inter_400Regular",
    heading: "SpaceGrotesk_700Bold",
    mono: "ui-monospace",
  },
  default: {
    sans: "Inter_400Regular",
    heading: "SpaceGrotesk_700Bold",
    mono: "monospace",
  },
  web: {
    sans: "'Inter', system-ui, -apple-system, sans-serif",
    heading: "'Space Grotesk', 'Inter', system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

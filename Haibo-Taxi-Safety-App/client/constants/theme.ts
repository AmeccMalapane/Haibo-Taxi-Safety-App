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

// ClarifyUX: Rose Red as primary tint
const tintColorLight = "#E72369";
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
    link: "#E72369",
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
    gradientStart: "#E72369",
    gradientEnd: "#EA4F52",
    red: "#E72369",
    redDark: "#C62828",
    blue: "#1976D2",
    blueDark: "#1565C0",
    green: "#388E3C",
    greenDark: "#2E7D32",
    orange: "#F57C00",
  },
  gradient: {
    primary: ["#E72369", "#EA4F52"] as string[],
    primaryReversed: ["#EA4F52", "#E72369"] as string[],
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

export const Typography = {
  h1: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "700" as const,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  h2: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700" as const,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  h3: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600" as const,
    fontFamily: "SpaceGrotesk_600SemiBold",
  },
  h4: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "600" as const,
    fontFamily: "SpaceGrotesk_600SemiBold",
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

import React from "react";
import { View, StyleSheet, Pressable, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "@/components/ThemedText";
import { BrandColors, Spacing, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// FloatingHeader — overlays the top of the Home screen with three pills:
//   • Left:   menu (services hub) — replaces the old MenuTab tab bar entry
//   • Center: Haibo! brand pill
//   • Right:  profile avatar (monogram for signed-in users, user icon
//             otherwise) — replaces the old ProfileTab tab bar entry
//
// Profile and Menu were lifted out of the bottom tab bar and live here so
// the bar can carry Home / Taxi fare / [SOS] / Community / Phusha. They
// remain registered as root-stack screens so deep links still work.

export interface FloatingHeaderProps {
  title?: string;
  showLogo?: boolean;
}

export function FloatingHeader({ title }: FloatingHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const monogram =
    user?.displayName?.trim()?.charAt(0)?.toUpperCase() || null;

  const pillBg = isDark ? "rgba(30, 30, 30, 0.85)" : "rgba(255, 255, 255, 0.92)";

  return (
    <View
      style={[styles.container, { paddingTop: insets.top + 4 }]}
      pointerEvents="box-none"
    >
      <View style={styles.row} pointerEvents="box-none">
        {/* Menu (left) */}
        <Pressable
          onPress={() => navigation.navigate("Menu")}
          style={[styles.iconPill, { backgroundColor: pillBg }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Feather name="menu" size={20} color={theme.text} />
        </Pressable>

        {/* Brand pill (center) */}
        <View style={[styles.logoPill, { backgroundColor: pillBg }]}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <ThemedText style={styles.logoTitle}>Haibo!</ThemedText>
          <ThemedText style={[styles.logoSubtitle, { color: theme.text }]}>
            {title || "Taxi"}
          </ThemedText>
        </View>

        {/* Profile avatar (right) */}
        <Pressable
          onPress={() => navigation.navigate("Profile")}
          style={[styles.avatarPill, { backgroundColor: pillBg }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          {monogram ? (
            <View style={styles.avatarMonogramWrap}>
              <ThemedText style={styles.avatarMonogramText}>
                {monogram}
              </ThemedText>
            </View>
          ) : (
            <Feather name="user" size={20} color={theme.text} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const PILL_HEIGHT = 42;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  iconPill: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarPill: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: "hidden",
  },
  avatarMonogramWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BrandColors.primary.gradientStart,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMonogramText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  logoPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    paddingHorizontal: Spacing.lg,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  logoIcon: {
    width: 24,
    height: 24,
  },
  logoTitle: {
    ...Typography.h4,
    fontSize: 16,
    color: BrandColors.primary.gradientStart,
  },
  logoSubtitle: {
    ...Typography.h4,
    fontSize: 16,
    fontWeight: "600",
  },
});

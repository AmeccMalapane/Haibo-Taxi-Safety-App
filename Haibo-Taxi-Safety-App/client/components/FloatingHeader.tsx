import React from "react";
import { View, StyleSheet, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { BrandColors, Spacing } from "@/constants/theme";

export interface FloatingHeaderProps {
  title?: string;
  showLogo?: boolean;
}

export function FloatingHeader({ title }: FloatingHeaderProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]} pointerEvents="box-none">
      <View style={styles.row} pointerEvents="box-none">
        <View
          style={[
            styles.logoPill,
            {
              backgroundColor: isDark
                ? "rgba(30, 30, 30, 0.85)"
                : "rgba(255, 255, 255, 0.9)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 6,
              elevation: 4,
            },
          ]}
        >
          <Image
            source={require("../assets/svg/HAIBOICON.svg")}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <ThemedText style={styles.logoTitle}>Haibo!</ThemedText>
          <ThemedText style={[styles.logoSubtitle, { color: theme.text }]}>
            {title || "Taxi"}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

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
    justifyContent: "center",
    gap: Spacing.sm,
  },
  logoPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: 21,
    paddingHorizontal: Spacing.xl,
    gap: 8,
  },
  logoIcon: {
    width: 28,
    height: 28,
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: BrandColors.primary.red,
  },
  logoSubtitle: {
    fontSize: 18,
    fontWeight: "600",
  },
});

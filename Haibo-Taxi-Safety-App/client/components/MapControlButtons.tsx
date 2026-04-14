/**
 * MapControlButtons — Floating action buttons on the map.
 * Reset view, toggle map style, toggle transit routes, locate user.
 */
import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

interface MapControlButtonsProps {
  onResetView: () => void;
  onToggleRoutes: () => void;
  onLocateUser: () => void;
  showTransitRoutes: boolean;
  hasSelection: boolean;
  topOffset?: number;
}

export function MapControlButtons({
  onResetView,
  onToggleRoutes,
  onLocateUser,
  showTransitRoutes,
  hasSelection,
  topOffset = 120,
}: MapControlButtonsProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { top: topOffset }]}>
      {/* Reset View (only visible when something is selected) */}
      {hasSelection && (
        <Pressable
          style={[styles.button, { backgroundColor: theme.surface }]}
          onPress={onResetView}
          accessibilityRole="button"
          accessibilityLabel="Reset map view"
        >
          <Feather name="maximize" size={20} color={BrandColors.primary.red} />
        </Pressable>
      )}

      {/* Toggle Transit Routes */}
      <Pressable
        style={[
          styles.button,
          {
            backgroundColor: showTransitRoutes ? BrandColors.primary.red : theme.surface,
          },
        ]}
        onPress={onToggleRoutes}
        accessibilityRole="button"
        accessibilityLabel={showTransitRoutes ? "Hide transit routes" : "Show transit routes"}
        accessibilityState={{ selected: showTransitRoutes }}
      >
        <Feather
          name="git-branch"
          size={20}
          color={showTransitRoutes ? "#FFFFFF" : theme.text}
        />
      </Pressable>

      {/* Locate User */}
      <Pressable
        style={[styles.button, { backgroundColor: theme.surface }]}
        onPress={onLocateUser}
        accessibilityRole="button"
        accessibilityLabel="Centre map on my location"
      >
        <Feather name="crosshair" size={20} color={BrandColors.primary.blue} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: Spacing.lg,
    gap: Spacing.sm,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

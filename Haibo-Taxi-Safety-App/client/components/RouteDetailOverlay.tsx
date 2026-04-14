/**
 * RouteDetailOverlay — Floating card showing route fare, distance, and duration.
 * Appears when a transit route line is tapped on the Mapbox map.
 */
import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import type { MapboxTaxiRoute } from "@/data/mapbox_transit_data";
import { RANKS } from "@/data/mapbox_transit_data";

interface RouteDetailOverlayProps {
  route: MapboxTaxiRoute;
  onClose: () => void;
}

export function RouteDetailOverlay({ route, onClose }: RouteDetailOverlayProps) {
  const { theme, isDark } = useTheme();

  // Use the human-readable names directly from the route data
  const fromName = route.fromName || route.from;
  const toName = route.toName || route.to;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Close button */}
      <Pressable
        onPress={onClose}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Feather name="x" size={18} color={theme.textSecondary} />
      </Pressable>

      {/* Route header */}
      <View style={styles.routeHeader}>
        <View style={[styles.routeColorBar, { backgroundColor: route.color }]} />
        <View style={styles.routeInfo}>
          <View style={styles.routeEndpoints}>
            <View style={styles.endpoint}>
              <View style={[styles.endpointDot, { backgroundColor: route.color }]} />
              <ThemedText style={styles.endpointName} numberOfLines={1}>
                {fromName}
              </ThemedText>
            </View>
            <View style={styles.routeArrow}>
              <Feather name="arrow-down" size={14} color={theme.textSecondary} />
              <View style={[styles.routeLine, { backgroundColor: route.color + "40" }]} />
            </View>
            <View style={styles.endpoint}>
              <View style={[styles.endpointDot, { backgroundColor: route.color, opacity: 0.6 }]} />
              <ThemedText style={styles.endpointName} numberOfLines={1}>
                {toName}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Fare Calculator */}
      <View style={styles.fareSection}>
        <View style={[styles.fareCard, { backgroundColor: `${route.color}10` }]}>
          <Feather name="dollar-sign" size={20} color={route.color} />
          <View>
            <ThemedText type="label" style={{ color: theme.textSecondary }}>
              FARE
            </ThemedText>
            <ThemedText style={[styles.fareAmount, { color: route.color }]}>
              {route.fare}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.fareCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#F8F9FA" }]}>
          <Feather name="map-pin" size={20} color={BrandColors.primary.blue} />
          <View>
            <ThemedText type="label" style={{ color: theme.textSecondary }}>
              DISTANCE
            </ThemedText>
            <ThemedText style={styles.fareValue}>
              {route.distance}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.fareCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#F8F9FA" }]}>
          <Feather name="clock" size={20} color={BrandColors.secondary.orange} />
          <View>
            <ThemedText type="label" style={{ color: theme.textSecondary }}>
              DURATION
            </ThemedText>
            <ThemedText style={styles.fareValue}>
              {route.duration}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  routeHeader: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  routeColorBar: {
    width: 4,
    borderRadius: 2,
  },
  routeInfo: {
    flex: 1,
  },
  routeEndpoints: {
    gap: 4,
  },
  endpoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  endpointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  endpointName: {
    fontSize: 15,
    fontWeight: "700",
  },
  routeArrow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 2,
    gap: 4,
  },
  routeLine: {
    flex: 1,
    height: 1,
  },
  fareSection: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  fareCard: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  fareValue: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});

/**
 * TransitRouteLegend — Horizontal scrollable route legend.
 * Shows colored chips for each transit route. Tapping highlights the route on the map.
 */
import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ROUTES, RANKS } from "@/data/mapbox_transit_data";
import type { MapboxTaxiRoute } from "@/data/mapbox_transit_data";

interface TransitRouteLegendProps {
  selectedRouteId: string | null;
  onRouteSelect: (route: MapboxTaxiRoute | null) => void;
}

export function TransitRouteLegend({ selectedRouteId, onRouteSelect }: TransitRouteLegendProps) {
  const { theme, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface + "E6" }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {ROUTES.slice(0, 20).map((route) => {
          const isSelected = selectedRouteId === route.id;
          // Extract short names from fromName/toName
          const shortFrom = (route.fromName || route.from).split(/[\s,]/)[0];
          const shortTo = (route.toName || route.to).split(/[\s,]/)[0];

          return (
            <Pressable
              key={route.id}
              onPress={() => onRouteSelect(isSelected ? null : route)}
              style={[
                styles.chip,
                {
                  backgroundColor: `${route.color}${isSelected ? "25" : "10"}`,
                  borderColor: isSelected ? route.color : "transparent",
                  borderWidth: isSelected ? 1.5 : 0,
                },
              ]}
            >
              <View style={[styles.colorDot, { backgroundColor: route.color }]} />
              <ThemedText
                style={[
                  styles.chipText,
                  { color: route.color, opacity: isSelected ? 1 : 0.7 },
                ]}
                numberOfLines={1}
              >
                {shortFrom} → {shortTo}
              </ThemedText>
              {isSelected && (
                <ThemedText style={[styles.fareText, { color: route.color }]}>
                  {route.fare}
                </ThemedText>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Spacing.sm,
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  fareText: {
    fontSize: 11,
    fontWeight: "800",
  },
});

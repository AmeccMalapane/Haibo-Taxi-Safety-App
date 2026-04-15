/**
 * LocationInfoBubble — Compact floating info card that pops up when a
 * user-contributed taxi rank / stop pin is tapped on the HomeScreen map.
 *
 * Kept deliberately smaller than RankDetailPanel: user locations are
 * lower-signal than the curated transit ranks (no wait times, capacity,
 * or connected-route data), so the bubble focuses on identification
 * (name, type, address) and a single "View details" CTA that deep
 * links into LocationDetails for the full record + photos.
 */
import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import type { TaxiLocation, LocationType } from "@/lib/types";

interface LocationInfoBubbleProps {
  location: TaxiLocation;
  onClose: () => void;
  onViewDetails: () => void;
}

const TYPE_CONFIG: Record<
  LocationType,
  { color: string; icon: keyof typeof Feather.glyphMap; label: string }
> = {
  rank: { color: BrandColors.primary.blue, icon: "home", label: "Taxi Rank" },
  formal_stop: {
    color: BrandColors.secondary.green,
    icon: "map-pin",
    label: "Formal Stop",
  },
  informal_stop: {
    color: BrandColors.secondary.orange,
    icon: "navigation",
    label: "Informal Stop",
  },
  landmark: { color: "#9B59B6", icon: "flag", label: "Landmark" },
  interchange: { color: "#E74C3C", icon: "repeat", label: "Interchange" },
};

export function LocationInfoBubble({
  location,
  onClose,
  onViewDetails,
}: LocationInfoBubbleProps) {
  const { theme } = useTheme();
  const config = TYPE_CONFIG[location.type] || TYPE_CONFIG.rank;

  return (
    <Animated.View
      entering={FadeInDown.duration(260).springify().damping(18)}
      exiting={FadeOutDown.duration(180)}
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Leading type chip — colored dot + icon mirrors the marker style
          so the user can associate this bubble with the pin they tapped. */}
      <View
        style={[
          styles.typeChip,
          { backgroundColor: `${config.color}18`, borderColor: `${config.color}40` },
        ]}
      >
        <Feather name={config.icon} size={16} color={config.color} />
      </View>

      <View style={styles.textWrap}>
        <ThemedText style={styles.name} numberOfLines={1}>
          {location.name}
        </ThemedText>
        <View style={styles.metaRow}>
          <ThemedText style={[styles.typeLabel, { color: config.color }]}>
            {config.label}
          </ThemedText>
          {location.address ? (
            <>
              <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
              <ThemedText
                style={[styles.address, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {location.address}
              </ThemedText>
            </>
          ) : null}
        </View>
      </View>

      <Pressable
        onPress={onViewDetails}
        style={[
          styles.detailsButton,
          { backgroundColor: BrandColors.primary.gradientStart },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${location.name}`}
      >
        <ThemedText style={styles.detailsButtonText}>Details</ThemedText>
        <Feather name="arrow-right" size={14} color="#FFFFFF" />
      </Pressable>

      <Pressable
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Feather name="x" size={16} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Anchored near the top of the map so the bubble reads as a "hover
  // label" for the pin, leaving the bottom sheet and nearby ranks list
  // untouched. Left/right 16px matches the search bar gutter so it
  // lines up with the rest of the home screen chrome.
  container: {
    position: "absolute",
    top: 110,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  typeChip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...Typography.body,
    fontWeight: "700",
    fontSize: 14,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  typeLabel: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  address: {
    ...Typography.label,
    fontSize: 11,
    flex: 1,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  detailsButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});

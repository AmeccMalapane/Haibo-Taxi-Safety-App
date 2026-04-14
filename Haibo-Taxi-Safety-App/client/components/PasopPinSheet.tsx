/**
 * PasopPinSheet — bottom-sheet preview for a Pasop report pin
 *
 * Slides up over the map when a user taps a hazard pin on HomeScreen. Keeps
 * the map visible underneath (dim backdrop) so users don't lose context.
 * Two actions:
 *   - "Still there?"  → records a petition (extends the report's life by 30m)
 *   - "See all reports" → navigates to the dedicated PasopFeed screen
 */

import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import {
  PasopReport,
  PASOP_CATEGORIES,
  getReportAgeLabel,
  haversineKm,
} from "@/data/pasopReports";

interface PasopPinSheetProps {
  report: PasopReport | null;
  userLocation: { latitude: number; longitude: number } | null;
  hasPetitioned: boolean;
  onClose: () => void;
  onPetition: (report: PasopReport) => void;
  onSeeAll: () => void;
}

export function PasopPinSheet({
  report,
  userLocation,
  hasPetitioned,
  onClose,
  onPetition,
  onSeeAll,
}: PasopPinSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);

  const visible = !!report;

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(400, { duration: 220 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const distance = useMemo(() => {
    if (!report || !userLocation) return null;
    return haversineKm(
      { latitude: report.latitude, longitude: report.longitude },
      userLocation
    );
  }, [report, userLocation]);

  if (!report) return null;

  const cat = PASOP_CATEGORIES[report.category];
  const ageLabel = getReportAgeLabel(report);
  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  const handleClose = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    onClose();
  };

  const handlePetition = () => {
    if (hasPetitioned) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onPetition(report);
  };

  const handleSeeAll = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSeeAll();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.backdrop, backdropStyle]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: cardSurface,
            paddingBottom: insets.bottom + Spacing.md,
            borderColor: `${cat.color}33`,
          },
          sheetStyle,
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <View
            style={[styles.iconWrap, { backgroundColor: `${cat.color}15` }]}
          >
            <Feather name={cat.icon} size={22} color={cat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.category, { color: cat.color }]}>
              {cat.label}
            </ThemedText>
            <View style={styles.metaRow}>
              <Feather name="clock" size={11} color={BrandColors.gray[500]} />
              <ThemedText style={styles.metaText}>{ageLabel}</ThemedText>
              {distance !== null ? (
                <>
                  <ThemedText style={styles.metaSep}>·</ThemedText>
                  <Feather
                    name="map-pin"
                    size={11}
                    color={BrandColors.gray[500]}
                  />
                  <ThemedText style={styles.metaText}>
                    {distance < 1
                      ? `${Math.round(distance * 1000)}m away`
                      : `${distance.toFixed(1)}km away`}
                  </ThemedText>
                </>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={18} color={BrandColors.gray[600]} />
          </Pressable>
        </View>

        {report.description ? (
          <View style={styles.descriptionWrap}>
            <ThemedText style={styles.description}>{report.description}</ThemedText>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Feather name="users" size={13} color={BrandColors.gray[600]} />
            <ThemedText style={styles.statText}>
              {report.petitionCount} confirm{report.petitionCount === 1 ? "" : "s"}
            </ThemedText>
          </View>
          <View style={styles.stat}>
            <View
              style={[
                styles.severityDot,
                { backgroundColor: cat.color },
              ]}
            />
            <ThemedText style={styles.statText}>
              Severity {cat.severity}/5
            </ThemedText>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            onPress={handlePetition}
            disabled={hasPetitioned}
            style={[
              styles.primaryAction,
              hasPetitioned && {
                backgroundColor: BrandColors.status.success + "15",
                borderColor: BrandColors.status.success,
              },
              !hasPetitioned && {
                backgroundColor: BrandColors.primary.gradientStart,
                borderColor: BrandColors.primary.gradientStart,
              },
            ]}
          >
            <Feather
              name={hasPetitioned ? "check-circle" : "thumbs-up"}
              size={14}
              color={hasPetitioned ? BrandColors.status.success : "#FFFFFF"}
            />
            <ThemedText
              style={[
                styles.primaryActionText,
                {
                  color: hasPetitioned
                    ? BrandColors.status.success
                    : "#FFFFFF",
                },
              ]}
            >
              {hasPetitioned ? "Confirmed" : "Still there?"}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={handleSeeAll}
            style={[
              styles.secondaryAction,
              { borderColor: BrandColors.gray[200] },
            ]}
          >
            <ThemedText style={styles.secondaryActionText}>See all</ThemedText>
            <Feather
              name="arrow-right"
              size={14}
              color={BrandColors.primary.gradientStart}
            />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 14,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: BrandColors.gray[300],
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  category: {
    ...Typography.body,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  metaSep: {
    ...Typography.label,
    color: BrandColors.gray[400],
    marginHorizontal: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.gray[100],
    alignItems: "center",
    justifyContent: "center",
  },
  descriptionWrap: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.gray[50],
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  description: {
    ...Typography.small,
    color: BrandColors.gray[700],
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statText: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.gray[700],
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryAction: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  primaryActionText: {
    ...Typography.small,
    fontWeight: "800",
  },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryActionText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
});

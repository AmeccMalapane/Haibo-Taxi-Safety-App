/**
 * SafeTripProgressBar (STPB) — Waze-style colour-coded route safety bar
 *
 * Renders a horizontal progress bar split into colour-coded segments based on
 * aggregated Pasop reports along a route polyline. Each segment's colour
 * reflects its computed safety score (see `data/pasopReports.ts`).
 *
 * Two layout modes:
 *   - "compact"  : single-line bar (40px) with rounded ends, no labels
 *   - "expanded" : full card with title, legend, segment count, and the bar
 *
 * Pure presentational component — accepts `polyline` + `reports` + optional
 * `progress` (0..1) for the current position dot. Caller decides where to
 * source the data from (the local Pasop store, a route under construction,
 * or a live trip).
 */

import React, { useMemo } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import {
  buildSTPBSegments,
  getSafetyLevel,
  PasopReport,
  SafetyCoord,
  SAFETY_LEVELS,
  STPBSegment,
} from "@/data/pasopReports";

interface SafeTripProgressBarProps {
  polyline: SafetyCoord[];
  reports: PasopReport[];
  segmentCount?: number;
  radiusKm?: number;
  /**
   * Position along the route as 0..1. Renders a white dot on the bar.
   */
  progress?: number;
  /**
   * "compact" hides labels and renders the bar only. "expanded" wraps it in
   * a card with title, legend, and overall score.
   */
  variant?: "compact" | "expanded";
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  /**
   * Override what the empty-state shows when `polyline` has fewer than 2
   * coordinates. Defaults to a hint about adding stops.
   */
  emptyText?: string;
  cardSurface?: string;
}

export function SafeTripProgressBar({
  polyline,
  reports,
  segmentCount = 8,
  radiusKm = 1,
  progress,
  variant = "expanded",
  title = "Safe-trip progress",
  subtitle,
  onPress,
  emptyText = "Pick a route to see live safety along the way.",
  cardSurface = "#FFFFFF",
}: SafeTripProgressBarProps) {
  const segments = useMemo<STPBSegment[]>(() => {
    if (polyline.length < 2) return [];
    return buildSTPBSegments(polyline, reports, { segmentCount, radiusKm });
  }, [polyline, reports, segmentCount, radiusKm]);

  const overallScore = useMemo(() => {
    if (segments.length === 0) return null;
    const sum = segments.reduce((acc, s) => acc + s.safetyScore, 0);
    return Math.round(sum / segments.length);
  }, [segments]);

  const overallLevel = overallScore !== null ? getSafetyLevel(overallScore) : null;
  const totalReports = useMemo(
    () => segments.reduce((acc, s) => acc + s.reportCount, 0),
    [segments]
  );

  if (variant === "compact") {
    return (
      <View style={styles.compactWrap}>
        <BarTrack segments={segments} progress={progress} emptyText={emptyText} />
      </View>
    );
  }

  const Wrapper: React.ComponentType<any> = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={[styles.card, { backgroundColor: cardSurface }]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.cardIconWrap}>
            <Feather
              name="shield"
              size={16}
              color={BrandColors.primary.gradientStart}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.cardTitle}>{title}</ThemedText>
            {subtitle ? (
              <ThemedText style={styles.cardSubtitle}>{subtitle}</ThemedText>
            ) : null}
          </View>
        </View>
        {overallLevel ? (
          <View
            style={[
              styles.scorePill,
              { backgroundColor: `${overallLevel.color}1A` },
            ]}
          >
            <View
              style={[styles.scoreDot, { backgroundColor: overallLevel.color }]}
            />
            <ThemedText style={[styles.scoreText, { color: overallLevel.color }]}>
              {overallScore} · {overallLevel.label}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <BarTrack segments={segments} progress={progress} emptyText={emptyText} />

      {segments.length > 0 ? (
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="map" size={11} color={BrandColors.gray[500]} />
            <ThemedText style={styles.metaText}>
              {segments.length} segments
            </ThemedText>
          </View>
          <View style={styles.metaItem}>
            <Feather name="alert-triangle" size={11} color={BrandColors.gray[500]} />
            <ThemedText style={styles.metaText}>
              {totalReports} report{totalReports === 1 ? "" : "s"}
            </ThemedText>
          </View>
          <View style={styles.metaItem}>
            <Feather name="radio" size={11} color={BrandColors.gray[500]} />
            <ThemedText style={styles.metaText}>{radiusKm}km radius</ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.legend}>
        {SAFETY_LEVELS.map((lvl) => (
          <View key={lvl.level} style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: lvl.color }]}
            />
            <ThemedText style={styles.legendText}>{lvl.label}</ThemedText>
          </View>
        ))}
      </View>
    </Wrapper>
  );
}

interface BarTrackProps {
  segments: STPBSegment[];
  progress?: number;
  emptyText: string;
}

function BarTrack({ segments, progress, emptyText }: BarTrackProps) {
  if (segments.length === 0) {
    return (
      <View style={styles.emptyTrack}>
        <View style={styles.emptyBar} />
        <ThemedText style={styles.emptyText}>{emptyText}</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.barTrack}>
      <View style={styles.barRow}>
        {segments.map((seg, i) => {
          const lvl = getSafetyLevel(seg.safetyScore);
          const isFirst = i === 0;
          const isLast = i === segments.length - 1;
          return (
            <View
              key={seg.id}
              style={[
                styles.barSegment,
                { backgroundColor: lvl.color },
                isFirst && styles.barSegmentFirst,
                isLast && styles.barSegmentLast,
              ]}
            />
          );
        })}
      </View>
      {progress !== undefined && progress >= 0 && progress <= 1 ? (
        <View
          style={[
            styles.positionDot,
            { left: `${Math.round(progress * 100)}%` },
          ]}
        />
      ) : null}
    </View>
  );
}

const SEGMENT_GAP = 2;
const BAR_HEIGHT = 14;

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    ...Typography.body,
    fontWeight: "800",
  },
  cardSubtitle: {
    ...Typography.label,
    color: BrandColors.gray[600],
    marginTop: 2,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  scoreDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoreText: {
    ...Typography.label,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  compactWrap: {
    paddingVertical: Spacing.sm,
  },
  barTrack: {
    position: "relative",
    height: BAR_HEIGHT,
    justifyContent: "center",
  },
  barRow: {
    flexDirection: "row",
    height: BAR_HEIGHT,
    gap: SEGMENT_GAP,
  },
  barSegment: {
    flex: 1,
    height: BAR_HEIGHT,
  },
  barSegmentFirst: {
    borderTopLeftRadius: BAR_HEIGHT / 2,
    borderBottomLeftRadius: BAR_HEIGHT / 2,
  },
  barSegmentLast: {
    borderTopRightRadius: BAR_HEIGHT / 2,
    borderBottomRightRadius: BAR_HEIGHT / 2,
  },
  positionDot: {
    position: "absolute",
    top: -3,
    width: 20,
    height: BAR_HEIGHT + 6,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 3,
    borderColor: BrandColors.primary.gradientStart,
    marginLeft: -10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BrandColors.gray[200],
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  emptyTrack: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyBar: {
    width: "100%",
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: BrandColors.gray[200],
  },
  emptyText: {
    ...Typography.label,
    color: BrandColors.gray[500],
    textAlign: "center",
  },
});

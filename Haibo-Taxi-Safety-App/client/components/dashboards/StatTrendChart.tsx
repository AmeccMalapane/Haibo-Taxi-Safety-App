import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions, Pressable } from "react-native";
import { LineChart } from "react-native-chart-kit";
import Animated, { FadeIn } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";

/**
 * StatTrendChart — a line chart fed by the /stats/timeseries endpoints.
 * Designed to be a drop-in "how are things trending" surface on role
 * dashboards. Uses react-native-chart-kit + react-native-svg so it
 * runs on-device without a WebView.
 *
 * Data shape matches the server: [{ day: '2026-04-17', total: 1240.50 }]
 * X-axis labels thin themselves automatically — every ~nth day depending
 * on window length — so 30 days doesn't turn into a wall of tick marks.
 */

export type ChartWindow = "7d" | "30d" | "90d";

export interface ChartPoint {
  day: string; // YYYY-MM-DD
  total: number;
}

interface StatTrendChartProps {
  title: string;
  subtitle?: string;
  points: ChartPoint[];
  window: ChartWindow;
  onWindowChange?: (w: ChartWindow) => void;
  /** Line + gradient tint. Defaults to brand rose. */
  accent?: string;
  /** Currency prefix on the summary total. */
  currency?: string;
  loading?: boolean;
}

const SCREEN_WIDTH = Dimensions.get("window").width;

export function StatTrendChart({
  title,
  subtitle,
  points,
  window,
  onWindowChange,
  accent,
  currency = "R",
  loading,
}: StatTrendChartProps) {
  const reducedMotion = useReducedMotion();
  const { theme, isDark } = useTheme();
  const lineColor = accent || BrandColors.primary.gradientStart;

  const chartData = useMemo(() => {
    const labels = points.map((p, i) => {
      // Thin labels on longer windows so they don't overlap. 7d shows
      // all days as "Mon"/"Tue"; 30d every 5 days; 90d every 15 days.
      const every = points.length >= 90 ? 15 : points.length >= 30 ? 5 : 1;
      if (i % every !== 0 && i !== points.length - 1) return "";
      const d = new Date(p.day + "T00:00:00Z");
      return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
    });
    const data = points.map((p) => Number(p.total || 0));
    return { labels, datasets: [{ data: data.length ? data : [0] }] };
  }, [points]);

  const total = useMemo(
    () => points.reduce((s, p) => s + Number(p.total || 0), 0),
    [points],
  );

  const chartConfig = {
    backgroundGradientFrom: theme.surface,
    backgroundGradientTo: theme.surface,
    decimalPlaces: 0,
    color: (opacity = 1) =>
      // Convert hex → rgba. Chart-kit's color() expects opacity pre-applied.
      hexToRgba(lineColor, opacity),
    labelColor: (opacity = 1) =>
      hexToRgba(theme.textSecondary, opacity),
    strokeWidth: 3,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: lineColor,
      fill: theme.surface,
    },
    propsForBackgroundLines: {
      stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
      strokeDasharray: "",
    },
    fillShadowGradientFrom: lineColor,
    fillShadowGradientFromOpacity: 0.25,
    fillShadowGradientTo: lineColor,
    fillShadowGradientToOpacity: 0,
  };

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(500).delay(100)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          {subtitle ? (
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {subtitle}
            </ThemedText>
          ) : null}
          <View style={styles.totalRow}>
            <ThemedText style={[styles.totalCurrency, { color: theme.textSecondary }]}>
              {currency}
            </ThemedText>
            <ThemedText style={[styles.totalAmount, { color: lineColor }]}>
              {total.toLocaleString("en-ZA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </ThemedText>
          </View>
        </View>

        {onWindowChange ? (
          <View style={styles.windowToggle}>
            {(["7d", "30d", "90d"] as ChartWindow[]).map((w) => {
              const active = window === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => onWindowChange(w)}
                  style={[
                    styles.windowBtn,
                    active && { backgroundColor: lineColor },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${w} window`}
                  accessibilityState={{ selected: active }}
                >
                  <ThemedText
                    style={[
                      styles.windowLabel,
                      {
                        color: active ? "#FFFFFF" : theme.textSecondary,
                      },
                    ]}
                  >
                    {w}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {loading ? (
        <View style={[styles.emptyWrap, { height: 180 }]}>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Loading…
          </ThemedText>
        </View>
      ) : total === 0 ? (
        <View style={[styles.emptyWrap, { height: 180 }]}>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No activity in this window yet
          </ThemedText>
        </View>
      ) : (
        <LineChart
          data={chartData}
          width={SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md * 2}
          height={180}
          chartConfig={chartConfig}
          bezier
          withVerticalLines={false}
          withHorizontalLabels
          withVerticalLabels
          withShadow={false}
          style={styles.chart}
        />
      )}
    </Animated.View>
  );
}

/** Turn #RRGGBB into rgba(r,g,b,opacity). */
function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  title: {
    ...Typography.h4,
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 6,
  },
  totalCurrency: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: "600",
  },
  totalAmount: {
    ...Typography.h2,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  windowToggle: {
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  windowBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  windowLabel: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  chart: {
    marginLeft: -Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...Typography.small,
    fontSize: 13,
  },
});

export default StatTrendChart;

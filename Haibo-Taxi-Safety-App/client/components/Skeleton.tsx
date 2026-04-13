/**
 * Skeleton loading components for content placeholders.
 * Mzansi Pulse: subtle shimmer animation with brand-consistent colors.
 */
import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Low-level skeleton primitive. Use this to build custom shapes when the
 * compound variants below don't fit (e.g. a location pill, a hero title).
 *
 * `tone="light"` renders a translucent white shimmer for use on top of the
 * brand gradient or any dark background — the default tone uses the theme's
 * neutral background which disappears on dark surfaces.
 */
export function SkeletonBlock({
  style,
  tone = "default",
}: {
  style?: any;
  tone?: "default" | "light";
}) {
  const { theme } = useTheme();
  const opacity = useSharedValue(tone === "light" ? 0.18 : 0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(tone === "light" ? 0.38 : 0.7, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [tone]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const bg = tone === "light" ? "#FFFFFF" : theme.backgroundSecondary;

  return (
    <Animated.View
      style={[{ backgroundColor: bg, borderRadius: BorderRadius.sm }, style, animatedStyle]}
    />
  );
}

// Back-compat alias for internal use.
const Shimmer = SkeletonBlock;

/** Full-width card skeleton */
export function CardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <Shimmer style={{ width: "100%", height: 160, borderRadius: BorderRadius.md }} />
      <View style={{ padding: Spacing.md, gap: 8 }}>
        <Shimmer style={{ width: "70%", height: 18 }} />
        <Shimmer style={{ width: "90%", height: 14 }} />
        <Shimmer style={{ width: "50%", height: 14 }} />
      </View>
    </View>
  );
}

/** Stat card skeleton (for dashboards) */
export function StatCardSkeleton() {
  return (
    <View style={skeletonStyles.statCard}>
      <Shimmer style={{ width: 40, height: 40, borderRadius: 20 }} />
      <View style={{ gap: 6, flex: 1 }}>
        <Shimmer style={{ width: "60%", height: 12 }} />
        <Shimmer style={{ width: "40%", height: 22 }} />
      </View>
    </View>
  );
}

/** List item skeleton */
export function ListItemSkeleton() {
  return (
    <View style={skeletonStyles.listItem}>
      <Shimmer style={{ width: 44, height: 44, borderRadius: 22 }} />
      <View style={{ gap: 6, flex: 1 }}>
        <Shimmer style={{ width: "65%", height: 16 }} />
        <Shimmer style={{ width: "85%", height: 12 }} />
      </View>
    </View>
  );
}

/** Map area skeleton */
export function MapSkeleton() {
  return (
    <View style={skeletonStyles.map}>
      <Shimmer style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

/** Feed post skeleton */
export function PostSkeleton() {
  return (
    <View style={skeletonStyles.post}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 12 }}>
        <Shimmer style={{ width: 36, height: 36, borderRadius: 18 }} />
        <View style={{ gap: 4, flex: 1 }}>
          <Shimmer style={{ width: "40%", height: 14 }} />
          <Shimmer style={{ width: "25%", height: 10 }} />
        </View>
      </View>
      <Shimmer style={{ width: "100%", height: 14, marginBottom: 6 }} />
      <Shimmer style={{ width: "80%", height: 14, marginBottom: 12 }} />
      <Shimmer style={{ width: "100%", height: 180, borderRadius: BorderRadius.md }} />
    </View>
  );
}

/** Generic skeleton rows */
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <View style={{ gap: 12, padding: Spacing.lg }}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: Spacing.md,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: Spacing.sm,
  },
  map: {
    width: "100%",
    height: 300,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  post: {
    padding: Spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
});

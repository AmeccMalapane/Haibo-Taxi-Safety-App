import React, { useRef, useState, useEffect, useCallback, memo } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import highlightsData from "@/data/community_highlights.json";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.md * 2;
const CARD_MARGIN = Spacing.sm;

interface Highlight {
  id: string;
  type: "event" | "job" | "live";
  title: string;
  subtitle: string;
  description: string;
  date: string;
  time?: string;
  location: string;
  icon: string;
  color: string;
  badge: string;
  cta: string;
}

const TYPE_CONFIG: Record<string, { gradient: [string, string]; iconBg: string }> = {
  event: {
    gradient: ["#E72369", "#EA4F52"],
    iconBg: "rgba(255,255,255,0.2)",
  },
  job: {
    gradient: ["#1976D2", "#42A5F5"],
    iconBg: "rgba(255,255,255,0.2)",
  },
  live: {
    gradient: ["#F57C00", "#FF9800"],
    iconBg: "rgba(255,255,255,0.2)",
  },
};

// ─── Pulsing Live Dot ────────────────────────────────────────────────────────

function PulseDot({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// ─── Single Highlight Card ───────────────────────────────────────────────────

const HighlightCard = memo(function HighlightCard({
  item,
  onPress,
}: {
  item: Highlight;
  onPress: () => void;
}) {
  const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.event;
  const iconName = (item.icon || "star") as keyof typeof Feather.glyphMap;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  return (
    <Pressable onPress={onPress} style={styles.cardWrapper}>
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Background decoration */}
        <View style={styles.cardBgDecor}>
          <Feather name={iconName} size={120} color="rgba(255,255,255,0.06)" />
        </View>

        {/* Badge */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            {item.type === "live" ? (
              <PulseDot color="#FFFFFF" />
            ) : (
              <Feather name={iconName} size={12} color="#FFFFFF" />
            )}
            <ThemedText style={styles.badgeText}>{item.badge}</ThemedText>
          </View>
          {item.time ? (
            <View style={styles.timeBadge}>
              <Feather name="clock" size={11} color="rgba(255,255,255,0.8)" />
              <ThemedText style={styles.timeText}>{item.time}</ThemedText>
            </View>
          ) : null}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <ThemedText style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </ThemedText>
          <ThemedText style={styles.cardSubtitle} numberOfLines={1}>
            {item.subtitle}
          </ThemedText>
          <ThemedText style={styles.cardDescription} numberOfLines={2}>
            {item.description}
          </ThemedText>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            <View style={styles.footerItem}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.7)" />
              <ThemedText style={styles.footerText} numberOfLines={1}>
                {item.location}
              </ThemedText>
            </View>
            {item.date ? (
              <View style={styles.footerItem}>
                <Feather name="calendar" size={12} color="rgba(255,255,255,0.7)" />
                <ThemedText style={styles.footerText}>{formatDate(item.date)}</ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.ctaButton}>
            <ThemedText style={styles.ctaText}>{item.cta}</ThemedText>
            <Feather name="arrow-right" size={14} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
});

// ─── Main Carousel Component ─────────────────────────────────────────────────

export default function HighlightsCarousel() {
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const highlights = highlightsData as Highlight[];
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll every 4 seconds
  useEffect(() => {
    autoScrollTimer.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % highlights.length;
        flatListRef.current?.scrollToIndex({
          index: next,
          animated: true,
        });
        return next;
      });
    }, 4000);

    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [highlights.length]);

  const handleScrollBeginDrag = () => {
    // Pause auto-scroll when user interacts
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
  };

  const handleScrollEndDrag = () => {
    // Resume auto-scroll after user stops
    autoScrollTimer.current = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % highlights.length;
        flatListRef.current?.scrollToIndex({
          index: next,
          animated: true,
        });
        return next;
      });
    }, 4000);
  };

  const handleMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_MARGIN * 2));
    setActiveIndex(index);
  };

  const handleCardPress = useCallback((item: Highlight) => {
    if (Platform.OS !== "web") {
      import("expo-haptics")
        .then((H) => H.impactAsync(H.ImpactFeedbackStyle.Light))
        .catch(() => {});
    }
    // Future: navigate to detail screen
  }, []);

  const getItemLayout = (_: any, index: number) => ({
    length: CARD_WIDTH + CARD_MARGIN * 2,
    offset: (CARD_WIDTH + CARD_MARGIN * 2) * index,
    index,
  });

  return (
    <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Feather name="zap" size={18} color={BrandColors.primary.red} />
          <ThemedText style={styles.sectionTitle}>Highlights</ThemedText>
        </View>
        <View style={styles.dots}>
          {highlights.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                idx === activeIndex ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={highlights}
        horizontal
        pagingEnabled={false}
        snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        getItemLayout={getItemLayout}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({ item }) => (
          <HighlightCard item={item} onPress={() => handleCardPress(item)} />
        )}
      />
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  dots: {
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrandColors.gray[300],
  },
  dotActive: {
    backgroundColor: BrandColors.primary.red,
    width: 16,
  },
  listContent: {
    paddingHorizontal: Spacing.md - CARD_MARGIN,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 190,
    overflow: "hidden",
    justifyContent: "space-between",
  },
  cardBgDecor: {
    position: "absolute",
    right: -20,
    bottom: -20,
    opacity: 1,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  timeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  cardSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.sm,
  },
  cardDescription: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  footerInfo: {
    flex: 1,
    gap: 3,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  footerText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

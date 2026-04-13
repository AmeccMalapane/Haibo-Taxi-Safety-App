import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { SkeletonBlock } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BorderRadius,
  BrandColors,
  Typography,
} from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getDeviceId } from "@/lib/deviceId";

// typeui-clean rework — Package history list:
//   1. Rose gradient hero with clock badge + back button
//   2. Floating white card with package count + sortable list
//   3. Package cards: rose-tinted tracking number, status pill in
//      semantic colour (success-green for delivered, rose for in-transit,
//      warning-amber for pending), simplified from→to route with rose
//      gradient line, success-green fare amount
//   4. Skeleton placeholders during fetch instead of plain spinner
//   5. Branded empty state with rose-tinted inbox icon

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Package {
  id: string;
  trackingNumber: string;
  status: string;
  senderName: string;
  receiverName: string;
  receiverAddress?: string;
  contents: string;
  createdAt: string;
  deliveredAt?: string;
  fare: number;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: keyof typeof Feather.glyphMap }
> = {
  pending: {
    label: "Pending",
    color: BrandColors.status.warning,
    icon: "clock",
  },
  in_transit: {
    label: "In transit",
    color: BrandColors.primary.gradientStart,
    icon: "truck",
  },
  delivered: {
    label: "Delivered",
    color: BrandColors.status.success,
    icon: "check-circle",
  },
  cancelled: {
    label: "Cancelled",
    color: BrandColors.gray[500],
    icon: "x-circle",
  },
};

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function PackageCard({ item, index }: { item: Package; index: number }) {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const config = statusConfig[item.status] || statusConfig.pending;

  return (
    <Animated.View
      entering={FadeInDown.duration(300).delay(Math.min(index * 30, 300))}
    >
      <Pressable
        onPress={() => navigation.navigate("TrackPackage")}
        style={({ pressed }) => [
          styles.packageCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Package ${item.trackingNumber}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.trackingInfo}>
            <ThemedText style={styles.trackingNumber} numberOfLines={1}>
              {item.trackingNumber}
            </ThemedText>
            <ThemedText style={[styles.date, { color: theme.textSecondary }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: config.color + "15" },
            ]}
          >
            <Feather name={config.icon} size={11} color={config.color} />
            <ThemedText style={[styles.statusText, { color: config.color }]}>
              {config.label.toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.cardBody}>
          <View style={styles.routeColumn}>
            <View style={styles.routePoint}>
              <View
                style={[
                  styles.routeDot,
                  { backgroundColor: BrandColors.primary.gradientStart },
                ]}
              />
              <View style={styles.routeText}>
                <ThemedText
                  style={[styles.routeLabel, { color: theme.textSecondary }]}
                >
                  FROM
                </ThemedText>
                <ThemedText style={styles.routeValue} numberOfLines={1}>
                  {item.senderName}
                </ThemedText>
              </View>
            </View>
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.routeLine}
            />
            <View style={styles.routePoint}>
              <View
                style={[
                  styles.routeDot,
                  { backgroundColor: BrandColors.primary.gradientEnd },
                ]}
              />
              <View style={styles.routeText}>
                <ThemedText
                  style={[styles.routeLabel, { color: theme.textSecondary }]}
                >
                  TO
                </ThemedText>
                <ThemedText style={styles.routeValue} numberOfLines={1}>
                  {item.receiverName}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.contentsRow}>
              <Feather
                name="package"
                size={12}
                color={theme.textSecondary}
              />
              <ThemedText
                style={[styles.contentsText, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {item.contents}
              </ThemedText>
            </View>
            <View
              style={[
                styles.farePill,
                { backgroundColor: BrandColors.status.success + "12" },
              ]}
            >
              <ThemedText style={styles.fareText}>
                R{(item.fare || 0).toFixed(0)}
              </ThemedText>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function PackageHistoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId).catch(() => {});
  }, []);

  const { data: packagesData, isLoading } = useQuery<Package[]>({
    queryKey: [`/api/hub/packages?deviceId=${deviceId}`],
    enabled: !!deviceId,
  });
  const packages = packagesData ?? [];

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={packages}
        renderItem={({ item, index }) => <PackageCard item={item} index={index} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        ListHeaderComponent={
          <>
            {/* Rose gradient hero */}
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
            >
              <Animated.View entering={FadeIn.duration(300)}>
                <Pressable
                  onPress={() => navigation.goBack()}
                  style={styles.backButton}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Feather name="arrow-left" size={22} color="#FFFFFF" />
                </Pressable>
              </Animated.View>

              <Animated.View
                entering={FadeIn.duration(400).delay(100)}
                style={styles.heroBadgeWrap}
              >
                <View style={styles.heroBadge}>
                  <Feather
                    name="clock"
                    size={32}
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.duration(500).delay(150)}
                style={styles.heroText}
              >
                <ThemedText style={styles.heroTitle}>
                  Package history
                </ThemedText>
                <ThemedText style={styles.heroSubtitle}>
                  Every shipment you've sent through the Hub.
                </ThemedText>
              </Animated.View>
            </LinearGradient>

            <Animated.View
              entering={FadeInUp.duration(500).delay(200)}
              style={[
                styles.contentCardTop,
                { backgroundColor: theme.backgroundRoot },
              ]}
            >
              <View style={styles.headerRow}>
                <ThemedText
                  style={[styles.sectionLabel, { color: theme.textSecondary }]}
                >
                  YOUR SHIPMENTS
                </ThemedText>
                {!isLoading && packages.length > 0 ? (
                  <View
                    style={[
                      styles.countPill,
                      {
                        backgroundColor:
                          BrandColors.primary.gradientStart + "12",
                      },
                    ]}
                  >
                    <ThemedText style={styles.countPillText}>
                      {packages.length}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {isLoading ? (
                <View style={styles.skeletonList}>
                  {[0, 1, 2].map((i) => (
                    <SkeletonBlock key={i} style={styles.skeletonCard} />
                  ))}
                </View>
              ) : null}
            </Animated.View>
          </>
        }
        ListEmptyComponent={
          !isLoading ? (
            <Animated.View
              entering={FadeIn.duration(400)}
              style={[
                styles.emptyState,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      BrandColors.primary.gradientStart + "12",
                  },
                ]}
              >
                <Feather
                  name="inbox"
                  size={26}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>
                No packages yet
              </ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Your package history will appear here once you send your first
                shipment.
              </ThemedText>
            </Animated.View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },

  // Hero
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: Spacing.lg,
  },
  heroBadgeWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroText: {
    alignItems: "center",
  },
  heroTitle: {
    ...Typography.h2,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 320,
  },

  // Content card top (header inside FlatList)
  contentCardTop: {
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
  },
  countPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  countPillText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "800",
    color: BrandColors.primary.gradientStart,
  },

  // Skeleton
  skeletonList: {
    gap: Spacing.sm,
  },
  skeletonCard: {
    height: 140,
    borderRadius: BorderRadius.lg,
  },

  // Package card
  packageCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  trackingInfo: {
    flex: 1,
    minWidth: 0,
  },
  trackingNumber: {
    ...Typography.body,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
  date: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  cardBody: {},
  routeColumn: {
    marginBottom: Spacing.md,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeText: {
    flex: 1,
    minWidth: 0,
  },
  routeLabel: {
    ...Typography.label,
    fontSize: 9,
    letterSpacing: 1,
  },
  routeValue: {
    ...Typography.body,
    fontWeight: "600",
    marginTop: 1,
  },
  routeLine: {
    width: 2,
    height: 16,
    marginLeft: 4,
    marginVertical: 2,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  contentsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  contentsText: {
    ...Typography.small,
    fontSize: 12,
    flex: 1,
  },
  farePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  fareText: {
    ...Typography.label,
    fontSize: 12,
    fontWeight: "800",
    color: BrandColors.status.success,
    fontVariant: ["tabular-nums"],
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

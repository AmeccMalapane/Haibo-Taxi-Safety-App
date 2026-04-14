/**
 * ContributorProfileScreen — User profile with contribution stats, badges, and history
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  ContributorProfile,
  CommunityRoute,
  getContributorProfile,
  getCommunityRoutes,
  BADGE_CONFIG,
  getBadge,
  POINTS,
} from "@/data/communityRoutes";

type Tab = "routes" | "starred";

export default function ContributorProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [profile, setProfile] = useState<ContributorProfile | null>(null);
  const [myRoutes, setMyRoutes] = useState<CommunityRoute[]>([]);
  const [starredRoutes, setStarredRoutes] = useState<CommunityRoute[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("routes");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const p = await getContributorProfile();
      setProfile(p);

      const allRoutes = await getCommunityRoutes();
      setMyRoutes(allRoutes.filter((r) => r.contributorId === p.id));

      // For starred, we'd need to check starredBy, but for now show routes user starred
      const { getMyStars } = require("@/data/communityRoutes");
      const stars = await getMyStars();
      setStarredRoutes(allRoutes.filter((r) => stars.includes(r.id)));
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.red} />
      </ThemedView>
    );
  }

  const badge = getBadge(profile.totalPoints);
  const badgeConfig = BADGE_CONFIG[badge];

  // Calculate next badge progress
  const badgeKeys = Object.keys(BADGE_CONFIG) as Array<keyof typeof BADGE_CONFIG>;
  const currentBadgeIndex = badgeKeys.indexOf(badge);
  const nextBadge = currentBadgeIndex < badgeKeys.length - 1 ? badgeKeys[currentBadgeIndex + 1] : null;
  const nextBadgeConfig = nextBadge ? BADGE_CONFIG[nextBadge] : null;
  const nextThreshold = nextBadgeConfig?.minPoints || profile.totalPoints;
  const currentThreshold = badgeConfig.minPoints;
  const progress = nextBadge
    ? (profile.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)
    : 1;

  const displayRoutes = activeTab === "routes" ? myRoutes : starredRoutes;

  const renderRouteItem = ({ item: route }: { item: CommunityRoute }) => {
    const stops = route.waypoints.filter((w) => w.isStop);
    const netVotes = route.upvotes - route.downvotes;

    return (
      <Pressable
        style={[styles.routeItem, { backgroundColor: theme.backgroundDefault }]}
        onPress={() =>
          navigation.navigate("CommunityRouteDetail" as any, { routeId: route.id })
        }
      >
        <View style={[styles.routeItemBar, { backgroundColor: route.color }]} />
        <View style={styles.routeItemContent}>
          <View style={styles.routeItemHeader}>
            <ThemedText style={styles.routeItemName} numberOfLines={1}>
              {route.name}
            </ThemedText>
            {route.status === "verified" && (
              <Feather name="check-circle" size={16} color={BrandColors.status.success} />
            )}
          </View>
          <View style={styles.routeItemMeta}>
            <Text style={[styles.routeItemMetaText, { color: theme.textSecondary }]}>
              {stops.length} stops
            </Text>
            <Text style={[styles.routeItemMetaText, { color: theme.textSecondary }]}>·</Text>
            <Text style={[styles.routeItemMetaText, { color: theme.textSecondary }]}>
              R{route.fare}
            </Text>
            <Text style={[styles.routeItemMetaText, { color: theme.textSecondary }]}>·</Text>
            <Text
              style={[
                styles.routeItemMetaText,
                {
                  color:
                    netVotes > 0
                      ? BrandColors.status.success
                      : netVotes < 0
                      ? BrandColors.status.emergency
                      : theme.textSecondary,
                },
              ]}
            >
              {netVotes > 0 ? "+" : ""}
              {netVotes} votes
            </Text>
          </View>
        </View>
        <Feather name="chevron-right" size={18} color={BrandColors.gray[600]} />
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={displayRoutes}
        renderItem={renderRouteItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <>
            {/* Profile header */}
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.profileHeader, { paddingTop: insets.top + 16 }]}
            >
              <Pressable
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Feather name="arrow-left" size={24} color="#FFFFFF" />
              </Pressable>

              <View style={styles.avatarContainer}>
                <View style={[styles.avatar, { borderColor: badgeConfig.color }]}>
                  <Text style={styles.avatarText}>
                    {profile.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={[styles.badgeIcon, { backgroundColor: badgeConfig.color }]}>
                  <Text style={styles.badgeIconText}>{badgeConfig.label.split(" ")[0]}</Text>
                </View>
              </View>

              <Text style={styles.profileName}>{profile.name}</Text>
              <View style={[styles.badgePill, { backgroundColor: `${badgeConfig.color}30` }]}>
                <Text style={[styles.badgePillText, { color: badgeConfig.color }]}>
                  {badgeConfig.label}
                </Text>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.totalPoints}</Text>
                  <Text style={styles.statLabel}>Points</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.routesContributed}</Text>
                  <Text style={styles.statLabel}>Routes</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.stopsAdded}</Text>
                  <Text style={styles.statLabel}>Stops</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{profile.verifications}</Text>
                  <Text style={styles.statLabel}>Verified</Text>
                </View>
              </View>

              {/* Progress to next badge */}
              {nextBadge && (
                <View style={styles.progressSection}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>
                      Next: {nextBadgeConfig?.label}
                    </Text>
                    <Text style={styles.progressValue}>
                      {profile.totalPoints}/{nextThreshold} pts
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(progress * 100, 100)}%`,
                          backgroundColor: nextBadgeConfig?.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </LinearGradient>

            {/* Points breakdown */}
            <View style={[styles.pointsBreakdown, { backgroundColor: theme.surface }]}>
              <ThemedText style={styles.sectionTitle}>How to Earn Points</ThemedText>
              <View style={styles.pointsGrid}>
                {[
                  { label: "Submit a route", points: POINTS.SUBMIT_ROUTE, icon: "map" as const },
                  { label: "First route bonus", points: POINTS.FIRST_ROUTE, icon: "award" as const },
                  { label: "Add a stop", points: POINTS.ADD_STOP, icon: "map-pin" as const },
                  { label: "Route verified", points: POINTS.ROUTE_VERIFIED, icon: "check-circle" as const },
                  { label: "Receive upvote", points: POINTS.UPVOTE_RECEIVED, icon: "arrow-up" as const },
                  { label: "Add comment", points: POINTS.COMMENT, icon: "message-circle" as const },
                ].map((item) => (
                  <View key={item.label} style={[styles.pointItem, { backgroundColor: theme.backgroundDefault }]}>
                    <Feather name={item.icon} size={16} color={BrandColors.primary.red} />
                    <Text style={[styles.pointItemLabel, { color: theme.text }]}>{item.label}</Text>
                    <Text style={[styles.pointItemValue, { color: BrandColors.secondary.orange }]}>
                      +{item.points}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabs, { backgroundColor: theme.surface }]}>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === "routes" && {
                    borderBottomColor: BrandColors.primary.red,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveTab("routes")}
              >
                <Feather
                  name="map"
                  size={16}
                  color={activeTab === "routes" ? BrandColors.primary.red : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: activeTab === "routes" ? BrandColors.primary.red : theme.textSecondary,
                    },
                  ]}
                >
                  My Routes ({myRoutes.length})
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.tab,
                  activeTab === "starred" && {
                    borderBottomColor: BrandColors.secondary.orange,
                    borderBottomWidth: 2,
                  },
                ]}
                onPress={() => setActiveTab("starred")}
              >
                <Feather
                  name="star"
                  size={16}
                  color={activeTab === "starred" ? BrandColors.secondary.orange : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: activeTab === "starred" ? BrandColors.secondary.orange : theme.textSecondary,
                    },
                  ]}
                >
                  Starred ({starredRoutes.length})
                </Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather
              name={activeTab === "routes" ? "map" : "star"}
              size={40}
              color={BrandColors.gray[600]}
            />
            <ThemedText style={styles.emptyTitle}>
              {activeTab === "routes" ? "No routes yet" : "No starred routes"}
            </ThemedText>
            <ThemedText style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              {activeTab === "routes"
                ? "Draw your first route to start earning points!"
                : "Star routes you want to save for later."}
            </ThemedText>
            {activeTab === "routes" && (
              <Pressable
                style={[styles.emptyButton, { backgroundColor: BrandColors.primary.red }]}
                onPress={() => navigation.navigate("RouteDrawing" as any)}
              >
                <Feather name="plus" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Draw a Route</Text>
              </Pressable>
            )}
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Profile header
  profileHeader: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    position: "absolute",
    top: 56,
    left: Spacing.lg,
    zIndex: 10,
  },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  avatarText: { color: "#FFFFFF", fontSize: 32, fontWeight: "800" },
  badgeIcon: {
    position: "absolute",
    bottom: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  badgeIconText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  profileName: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginBottom: 6 },
  badgePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 16 },
  badgePillText: { fontSize: 13, fontWeight: "600" },
  // Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: "100%",
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },
  // Progress
  progressSection: { width: "100%", marginTop: 14 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  progressValue: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  // Points breakdown
  pointsBreakdown: { padding: Spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  pointsGrid: { gap: 6 },
  pointItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    gap: 10,
  },
  pointItemLabel: { flex: 1, fontSize: 14 },
  pointItemValue: { fontSize: 14, fontWeight: "700" },
  // Tabs
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  // Route items
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginHorizontal: Spacing.lg,
  },
  routeItemBar: { width: 4, alignSelf: "stretch" },
  routeItemContent: { flex: 1, padding: 12 },
  routeItemHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeItemName: { fontSize: 15, fontWeight: "600", flex: 1 },
  routeItemMeta: { flexDirection: "row", gap: 4, marginTop: 4 },
  routeItemMetaText: { fontSize: 12 },
  // Empty state
  emptyState: { alignItems: "center", paddingTop: 40, paddingHorizontal: Spacing.xl, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center" },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    gap: 8,
    marginTop: 12,
  },
  emptyButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});

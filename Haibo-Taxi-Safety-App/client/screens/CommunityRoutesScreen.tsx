/**
 * CommunityRoutesScreen — MetroDreamin'-style explore feed
 * Browse community-contributed routes, vote, star, search, and filter.
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Share,
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
  CommunityRoute,
  getCommunityRoutes,
  saveCommunityRoute,
  getMyVotes,
  saveVote,
  getMyStars,
  toggleStar,
  BADGE_CONFIG,
  getBadge,
} from "@/data/communityRoutes";

type SortMode = "trending" | "newest" | "top" | "nearby";
type FilterStatus = "all" | "verified" | "pending";

export default function CommunityRoutesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [routes, setRoutes] = useState<CommunityRoute[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, "up" | "down">>({});
  const [myStars, setMyStars] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("trending");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterProvince, setFilterProvince] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [routeData, votes, stars] = await Promise.all([
        getCommunityRoutes(),
        getMyVotes(),
        getMyStars(),
      ]);
      setRoutes(routeData);
      setMyVotes(votes);
      setMyStars(stars);
    } catch (error) {
      console.error("Failed to load community routes:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleVote = useCallback(
    async (routeId: string, vote: "up" | "down") => {
      if (Platform.OS !== "web") {
        try {
          const Haptics = require("expo-haptics");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }

      const currentVote = myVotes[routeId];
      const route = routes.find((r) => r.id === routeId);
      if (!route) return;

      let updatedRoute = { ...route };

      if (currentVote === vote) {
        // Remove vote
        if (vote === "up") updatedRoute.upvotes = Math.max(0, updatedRoute.upvotes - 1);
        else updatedRoute.downvotes = Math.max(0, updatedRoute.downvotes - 1);
        const newVotes = { ...myVotes };
        delete newVotes[routeId];
        setMyVotes(newVotes);
        await saveVote(routeId, null);
      } else {
        // Switch or new vote
        if (currentVote === "up") updatedRoute.upvotes = Math.max(0, updatedRoute.upvotes - 1);
        if (currentVote === "down") updatedRoute.downvotes = Math.max(0, updatedRoute.downvotes - 1);
        if (vote === "up") updatedRoute.upvotes += 1;
        else updatedRoute.downvotes += 1;
        setMyVotes((prev) => ({ ...prev, [routeId]: vote }));
        await saveVote(routeId, vote);
      }

      updatedRoute.updatedAt = Date.now();
      setRoutes((prev) => prev.map((r) => (r.id === routeId ? updatedRoute : r)));
      await saveCommunityRoute(updatedRoute);
    },
    [myVotes, routes]
  );

  const handleStar = useCallback(
    async (routeId: string) => {
      if (Platform.OS !== "web") {
        try {
          const Haptics = require("expo-haptics");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
      }

      const isStarred = await toggleStar(routeId);
      setMyStars((prev) =>
        isStarred ? [...prev, routeId] : prev.filter((id) => id !== routeId)
      );

      const route = routes.find((r) => r.id === routeId);
      if (route) {
        const updatedRoute = {
          ...route,
          stars: isStarred ? route.stars + 1 : Math.max(0, route.stars - 1),
        };
        setRoutes((prev) => prev.map((r) => (r.id === routeId ? updatedRoute : r)));
        await saveCommunityRoute(updatedRoute);
      }
    },
    [routes]
  );

  // Filter and sort
  const filteredRoutes = useMemo(() => {
    let result = [...routes];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.province.toLowerCase().includes(q) ||
          r.contributorName.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      result = result.filter((r) => r.status === filterStatus);
    }

    // Province filter
    if (filterProvince) {
      result = result.filter((r) => r.province === filterProvince);
    }

    // Sort
    switch (sortMode) {
      case "trending":
        result.sort((a, b) => {
          const scoreA = a.upvotes - a.downvotes + a.stars * 2;
          const scoreB = b.upvotes - b.downvotes + b.stars * 2;
          return scoreB - scoreA;
        });
        break;
      case "newest":
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "top":
        result.sort((a, b) => b.upvotes - a.upvotes);
        break;
      case "nearby":
        // For now, same as trending (would need user location for proper sorting)
        result.sort((a, b) => b.upvotes - a.upvotes);
        break;
    }

    return result;
  }, [routes, searchQuery, sortMode, filterStatus, filterProvince]);

  const provinces = useMemo(() => {
    const set = new Set(routes.map((r) => r.province));
    return Array.from(set).sort();
  }, [routes]);

  const renderRouteCard = useCallback(
    ({ item: route }: { item: CommunityRoute }) => {
      const isStarred = myStars.includes(route.id);
      const myVote = myVotes[route.id];
      const netVotes = route.upvotes - route.downvotes;
      const badge = getBadge(route.points);
      const badgeConfig = BADGE_CONFIG[badge];
      const stops = route.waypoints.filter((w) => w.isStop);
      const timeAgo = getTimeAgo(route.createdAt);

      return (
        <Pressable
          style={[styles.routeCard, { backgroundColor: theme.surface }]}
          onPress={() =>
            navigation.navigate("CommunityRouteDetail" as any, { routeId: route.id })
          }
        >
          {/* Route color bar */}
          <View style={[styles.routeColorBar, { backgroundColor: route.color }]} />

          <View style={styles.routeCardContent}>
            {/* Header */}
            <View style={styles.routeCardHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.routeNameRow}>
                  <ThemedText style={styles.routeName} numberOfLines={1}>
                    {route.name}
                  </ThemedText>
                  {route.status === "verified" && (
                    <Feather name="check-circle" size={14} color={BrandColors.status.success} />
                  )}
                </View>
                <View style={styles.routeMeta}>
                  <Text style={[styles.routeMetaText, { color: theme.textSecondary }]}>
                    {route.province}
                  </Text>
                  <Text style={[styles.routeMetaDot, { color: theme.textSecondary }]}>·</Text>
                  <Text style={[styles.routeMetaText, { color: theme.textSecondary }]}>
                    R{route.fare}
                  </Text>
                  <Text style={[styles.routeMetaDot, { color: theme.textSecondary }]}>·</Text>
                  <Text style={[styles.routeMetaText, { color: theme.textSecondary }]}>
                    {stops.length} stops
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => handleStar(route.id)} hitSlop={8}>
                <Feather
                  name={isStarred ? "star" : "star"}
                  size={20}
                  color={isStarred ? BrandColors.secondary.orange : BrandColors.gray[400]}
                  style={isStarred ? { opacity: 1 } : { opacity: 0.5 }}
                />
              </Pressable>
            </View>

            {/* Stop preview */}
            <View style={styles.stopPreview}>
              {stops.slice(0, 4).map((stop, i) => (
                <View key={stop.id} style={styles.stopPreviewItem}>
                  <View style={[styles.stopPreviewDot, { backgroundColor: route.color }]} />
                  <Text
                    style={[styles.stopPreviewName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {stop.name}
                  </Text>
                  {i < Math.min(stops.length, 4) - 1 && (
                    <Feather name="chevron-right" size={10} color={BrandColors.gray[400]} />
                  )}
                </View>
              ))}
              {stops.length > 4 && (
                <Text style={[styles.moreStops, { color: theme.textSecondary }]}>
                  +{stops.length - 4} more
                </Text>
              )}
            </View>

            {/* Footer: votes, contributor, time */}
            <View style={styles.routeCardFooter}>
              {/* Vote buttons */}
              <View style={styles.voteRow}>
                <Pressable
                  style={[
                    styles.voteButton,
                    myVote === "up" && { backgroundColor: `${BrandColors.status.success}15` },
                  ]}
                  onPress={() => handleVote(route.id, "up")}
                >
                  <Feather
                    name="arrow-up"
                    size={16}
                    color={myVote === "up" ? BrandColors.status.success : BrandColors.gray[500]}
                  />
                </Pressable>
                <Text
                  style={[
                    styles.voteCount,
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
                  {netVotes > 0 ? `+${netVotes}` : netVotes}
                </Text>
                <Pressable
                  style={[
                    styles.voteButton,
                    myVote === "down" && { backgroundColor: `${BrandColors.status.emergency}15` },
                  ]}
                  onPress={() => handleVote(route.id, "down")}
                >
                  <Feather
                    name="arrow-down"
                    size={16}
                    color={myVote === "down" ? BrandColors.status.emergency : BrandColors.gray[500]}
                  />
                </Pressable>
              </View>

              {/* Contributor */}
              <View style={styles.contributorRow}>
                <View style={[styles.contributorBadge, { backgroundColor: badgeConfig.color }]}>
                  <Text style={styles.contributorInitial}>
                    {route.contributorName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.contributorName, { color: theme.textSecondary }]} numberOfLines={1}>
                  {route.contributorName}
                </Text>
              </View>

              {/* Share button */}
              <Pressable
                style={styles.shareBtn}
                hitSlop={8}
                onPress={async (e) => {
                  e.stopPropagation?.();
                  try {
                    const origin = stops[0]?.name || "Unknown";
                    const dest = stops[stops.length - 1]?.name || "Unknown";
                    await Share.share({
                      message: `🚐 ${route.name}\n📍 ${origin} → ${dest}\nR${route.fare}\n\nShared via Haibo App`,
                    });
                  } catch {}
                }}
              >
                <Feather name="share-2" size={14} color={BrandColors.gray[500]} />
              </Pressable>

              {/* Time & comments */}
              <View style={styles.timeRow}>
                <Feather name="message-circle" size={12} color={BrandColors.gray[500]} />
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  {route.commentCount}
                </Text>
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>· {timeAgo}</Text>
              </View>
            </View>
          </View>
        </Pressable>
      );
    },
    [myVotes, myStars, theme, isDark, navigation, handleVote, handleStar]
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BrandColors.primary.red} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.surface }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Community Routes</ThemedText>
          <Pressable
            onPress={() => navigation.navigate("ContributorProfile" as any)}
            hitSlop={8}
          >
            <Feather name="user" size={22} color={theme.text} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search routes, areas, contributors..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* Sort tabs */}
        <View style={styles.sortTabs}>
          {(["trending", "newest", "top"] as SortMode[]).map((mode) => (
            <Pressable
              key={mode}
              style={[
                styles.sortTab,
                sortMode === mode && { borderBottomColor: BrandColors.primary.red, borderBottomWidth: 2 },
              ]}
              onPress={() => setSortMode(mode)}
            >
              <Text
                style={[
                  styles.sortTabText,
                  { color: sortMode === mode ? BrandColors.primary.red : theme.textSecondary },
                ]}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
          {/* Status filter */}
          <Pressable
            style={[
              styles.filterChip,
              filterStatus !== "all" && { backgroundColor: `${BrandColors.primary.red}15` },
            ]}
            onPress={() => {
              const next: FilterStatus =
                filterStatus === "all" ? "verified" : filterStatus === "verified" ? "pending" : "all";
              setFilterStatus(next);
            }}
          >
            <Feather name="filter" size={14} color={filterStatus !== "all" ? BrandColors.primary.red : theme.textSecondary} />
            <Text
              style={[
                styles.filterChipText,
                { color: filterStatus !== "all" ? BrandColors.primary.red : theme.textSecondary },
              ]}
            >
              {filterStatus === "all" ? "All" : filterStatus === "verified" ? "Verified" : "Pending"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Route list */}
      <FlatList
        data={filteredRoutes}
        renderItem={renderRouteCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BrandColors.primary.red} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="map" size={48} color={BrandColors.gray[400]} />
            <ThemedText style={styles.emptyTitle}>No routes found</ThemedText>
            <ThemedText style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              Be the first to contribute a route in this area!
            </ThemedText>
          </View>
        }
      />

      {/* FAB — Create Route */}
      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => navigation.navigate("RouteDrawing" as any)}
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>Draw Route</Text>
        </LinearGradient>
      </Pressable>
    </ThemedView>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Header
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 0,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.md,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15 },
  // Sort tabs
  sortTabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sortTab: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  sortTabText: { fontSize: 14, fontWeight: "600" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 4,
    marginLeft: "auto",
  },
  filterChipText: { fontSize: 12, fontWeight: "500" },
  // Route card
  routeCard: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  routeColorBar: { height: 4 },
  routeCardContent: { padding: Spacing.md },
  routeCardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  routeNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeName: { fontSize: 16, fontWeight: "700", flex: 1 },
  routeMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  routeMetaText: { fontSize: 12 },
  routeMetaDot: { fontSize: 12 },
  // Stop preview
  stopPreview: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  stopPreviewItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  stopPreviewDot: { width: 8, height: 8, borderRadius: 4 },
  stopPreviewName: { fontSize: 12, fontWeight: "500", maxWidth: 80 },
  moreStops: { fontSize: 11, fontStyle: "italic" },
  // Footer
  routeCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  voteRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  voteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  voteCount: { fontSize: 14, fontWeight: "700", minWidth: 28, textAlign: "center" },
  contributorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  contributorBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  contributorInitial: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  contributorName: { fontSize: 12, maxWidth: 80 },
  shareBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { fontSize: 11 },
  // Empty state
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14, textAlign: "center" },
  // FAB
  fab: {
    position: "absolute",
    right: Spacing.lg,
    elevation: 6,
    shadowColor: BrandColors.primary.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    gap: 8,
  },
  fabText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});

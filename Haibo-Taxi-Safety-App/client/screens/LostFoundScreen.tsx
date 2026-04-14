import React, { useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { useLostFound } from "@/hooks/useApiData";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Lost & Found as a calm, branded reporting board:
//   1. Rose gradient hero with search-x badge + back button
//   2. Floating white content card with rose-focus search bar
//   3. Lost / Found / All filter pills with gradient-filled active state
//      (was BrandColors.primary.blue — wrong brand)
//   4. Item cards: emergency-red "LOST" / success-green "FOUND" type
//      badges (kept these because the semantic distinction is the
//      primary affordance), rose-tinted category icon, route pin,
//      reward chip in rose tint
//   5. Empty state with rose-tinted inbox icon
//   6. FAB uses the rose gradient (was solid blue), positioned above
//      safe area instead of hardcoded bottom: 100
//
// Latent bugs fixed:
//   • useHeaderHeight() — the route registered headerTitle but the
//     custom hero replaces it. Switched the route to headerShown:false
//     and dropped the useHeaderHeight() dependency entirely.
//   • FAB hardcoded bottom: 100 — assumed a tab bar that isn't visible
//     on root-stack pushed screens. Now uses insets.bottom + Spacing.lg.
//   • No back button on a screen reached from MenuScreen via push.

type LostFoundItem = {
  id: string;
  type: "lost" | "found";
  category: string;
  title: string;
  description: string;
  imageUrl?: string;
  routeOrigin?: string;
  routeDestination?: string;
  contactName: string;
  contactPhone: string;
  reward?: number;
  status: string;
  createdAt: string;
};

type FilterType = "all" | "lost" | "found";

const CATEGORIES: {
  value: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { value: "phone", label: "Phone", icon: "smartphone" },
  { value: "wallet", label: "Wallet", icon: "credit-card" },
  { value: "bag", label: "Bag", icon: "shopping-bag" },
  { value: "document", label: "Documents", icon: "file-text" },
  { value: "keys", label: "Keys", icon: "key" },
  { value: "other", label: "Other", icon: "package" },
];

function getCategoryIcon(category: string): keyof typeof Feather.glyphMap {
  const cat = CATEGORIES.find((c) => c.value === category);
  return cat?.icon || "package";
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

export default function LostFoundScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  // useLostFound unwraps the server's { data, pagination } envelope.
  // Calling useQuery<LostFoundItem[]> directly crashed here before because
  // `items` was the envelope object and `.filter` was undefined.
  const { data, isLoading, refetch } = useLostFound(
    filterType === "all" ? undefined : filterType
  );
  const items: LostFoundItem[] = (data as LostFoundItem[] | undefined) ?? [];

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query)
    );
  });

  const triggerHaptic = (type: "selection" | "medium" = "selection") => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = require("expo-haptics");
      if (type === "medium") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}
  };

  const handleFilterChange = (type: FilterType) => {
    triggerHaptic("selection");
    setFilterType(type);
  };

  const handleNewPost = () => {
    triggerHaptic("medium");
    navigation.navigate("PostLostFound");
  };

  const renderItem = ({ item, index }: { item: LostFoundItem; index: number }) => {
    const isLost = item.type === "lost";
    const typeColor = isLost
      ? BrandColors.status.emergency
      : BrandColors.status.success;

    return (
      <Animated.View
        entering={reducedMotion ? undefined : FadeInDown.duration(300).delay(Math.min(index * 30, 300))}
      >
        <Pressable
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            pressed && styles.pressed,
          ]}
          onPress={() => {
            triggerHaptic("selection");
            navigation.navigate("LostFoundDetails", { itemId: item.id });
          }}
          accessibilityRole="button"
          accessibilityLabel={`${item.type} item: ${item.title}`}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.typeBadge,
                { backgroundColor: typeColor + "15" },
              ]}
            >
              <Feather
                name={isLost ? "search" : "check-circle"}
                size={12}
                color={typeColor}
              />
              <ThemedText
                style={[styles.typeBadgeText, { color: typeColor }]}
              >
                {isLost ? "LOST" : "FOUND"}
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.dateText, { color: theme.textSecondary }]}
            >
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>

          <View style={styles.cardContent}>
            <View
              style={[
                styles.categoryIcon,
                {
                  backgroundColor: BrandColors.primary.gradientStart + "12",
                },
              ]}
            >
              <Feather
                name={getCategoryIcon(item.category)}
                size={20}
                color={BrandColors.primary.gradientStart}
              />
            </View>
            <View style={styles.cardText}>
              <ThemedText style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </ThemedText>
              <ThemedText
                style={[styles.cardDescription, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                {item.description}
              </ThemedText>
              {item.routeOrigin && item.routeDestination ? (
                <View style={styles.routeRow}>
                  <Feather
                    name="map-pin"
                    size={12}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.routeText,
                      { color: theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {item.routeOrigin} → {item.routeDestination}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          {item.reward ? (
            <View
              style={[
                styles.rewardBadge,
                {
                  backgroundColor: BrandColors.primary.gradientStart + "12",
                },
              ]}
            >
              <Feather
                name="gift"
                size={12}
                color={BrandColors.primary.gradientStart}
              />
              <ThemedText style={styles.rewardText}>
                R{item.reward} reward
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {/* Rose gradient hero */}
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)}>
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
          entering={reducedMotion ? undefined : FadeIn.duration(400).delay(100)}
          style={styles.heroBadgeWrap}
        >
          <View style={styles.heroBadge}>
            <Feather name="search" size={32} color={BrandColors.primary.gradientStart} />
          </View>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
          style={styles.heroText}
        >
          <ThemedText style={styles.heroTitle}>Lost & found</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Reunite with what you've lost. Help reunite others with theirs.
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      {/* Floating content card */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
        style={[
          styles.contentCard,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        {/* Search bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: searchFocused
                ? BrandColors.primary.gradientStart
                : theme.border,
            },
          ]}
        >
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search items, descriptions, routes"
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {searchQuery ? (
            <Pressable
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Feather name="x" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter pills */}
        <View style={styles.filterRow}>
          {(["all", "lost", "found"] as FilterType[]).map((type) => {
            const isActive = filterType === type;
            const label =
              type === "all" ? "All" : type === "lost" ? "Lost" : "Found";

            if (isActive) {
              return (
                <Pressable
                  key={type}
                  onPress={() => handleFilterChange(type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: true }}
                >
                  <LinearGradient
                    colors={BrandColors.gradient.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.filterButtonActive}
                  >
                    <ThemedText style={styles.filterButtonActiveText}>
                      {label}
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={type}
                onPress={() => handleFilterChange(type)}
                style={({ pressed }) => [
                  styles.filterButton,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                  },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
              >
                <ThemedText
                  style={[styles.filterButtonText, { color: theme.text }]}
                >
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={BrandColors.primary.gradientStart}
              colors={[BrandColors.primary.gradientStart]}
            />
          }
          ListEmptyComponent={
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(400)}
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: BrandColors.primary.gradientStart + "12" },
                ]}
              >
                <Feather
                  name="inbox"
                  size={26}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>
                {filterType === "lost"
                  ? "No lost items reported"
                  : filterType === "found"
                  ? "No found items reported"
                  : "Nothing reported yet"}
              </ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Tap the + button below to be the first to post.
              </ThemedText>
            </Animated.View>
          }
        />
      </Animated.View>

      {/* Floating + CTA */}
      <Pressable
        style={[
          styles.fab,
          { bottom: insets.bottom + Spacing.lg },
        ]}
        onPress={handleNewPost}
        accessibilityRole="button"
        accessibilityLabel="Post a lost or found item"
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Feather name="plus" size={26} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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

  // Content card
  contentCard: {
    flex: 1,
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
  },

  // Filters
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  filterButtonText: {
    ...Typography.small,
    fontWeight: "700",
  },
  filterButtonActive: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  filterButtonActiveText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // List + cards
  listContent: {},
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  typeBadgeText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  dateText: {
    ...Typography.label,
    fontSize: 11,
  },
  cardContent: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  cardDescription: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  routeText: {
    ...Typography.label,
    fontSize: 11,
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  rewardText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    fontVariant: ["tabular-nums"],
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
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
    textAlign: "center",
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },

  // FAB
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 50,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

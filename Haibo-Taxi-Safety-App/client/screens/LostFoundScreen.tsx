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
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useLostFound } from "@/hooks/useApiData";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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

const CATEGORIES = [
  { value: "phone", label: "Phone", icon: "smartphone" as const },
  { value: "wallet", label: "Wallet", icon: "credit-card" as const },
  { value: "bag", label: "Bag", icon: "shopping-bag" as const },
  { value: "document", label: "Documents", icon: "file-text" as const },
  { value: "keys", label: "Keys", icon: "key" as const },
  { value: "other", label: "Other", icon: "package" as const },
];

export default function LostFoundScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // useLostFound unwraps the server's { data, pagination } envelope.
  // Calling useQuery<LostFoundItem[]> directly crashed here before because
  // `items` was the envelope object and `.filter` was undefined.
  const { data, isLoading, refetch } = useLostFound(
    filterType === "all" ? undefined : filterType,
  );
  const items: LostFoundItem[] = (data as LostFoundItem[] | undefined) ?? [];

  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getCategoryIcon = (category: string) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat?.icon || "package";
  };

  const renderItem = ({ item }: { item: LostFoundItem }) => (
    <Pressable
      style={[styles.card, { backgroundColor: theme.backgroundDefault }]}
      onPress={() => {
        if (Platform.OS !== "web") {
          const Haptics = require("expo-haptics");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        navigation.navigate("LostFoundDetails", { itemId: item.id });
      }}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor:
                item.type === "lost"
                  ? BrandColors.primary.red + "15"
                  : BrandColors.primary.green + "15",
            },
          ]}
        >
          <Feather
            name={item.type === "lost" ? "search" : "check-circle"}
            size={12}
            color={item.type === "lost" ? BrandColors.primary.red : BrandColors.primary.green}
          />
          <ThemedText
            style={[
              styles.typeBadgeText,
              {
                color:
                  item.type === "lost" ? BrandColors.primary.red : BrandColors.primary.green,
              },
            ]}
          >
            {item.type.toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formatDate(item.createdAt)}
        </ThemedText>
      </View>

      <View style={styles.cardContent}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: BrandColors.primary.blue + "15" },
          ]}
        >
          <Feather
            name={getCategoryIcon(item.category)}
            size={24}
            color={BrandColors.primary.blue}
          />
        </View>
        <View style={styles.cardText}>
          <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary }}
            numberOfLines={2}
          >
            {item.description}
          </ThemedText>
          {item.routeOrigin && item.routeDestination ? (
            <View style={styles.routeRow}>
              <Feather name="map-pin" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {item.routeOrigin} - {item.routeDestination}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      {item.reward ? (
        <View style={[styles.rewardBadge, { backgroundColor: BrandColors.secondary.orange + "15" }]}>
          <ThemedText style={[styles.rewardText, { color: BrandColors.secondary.orange }]}>
            R{item.reward} Reward
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.searchContainer, { paddingTop: headerHeight + Spacing.sm }]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
        >
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search lost & found items..."
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

        <View style={styles.filterRow}>
          {(["all", "lost", "found"] as FilterType[]).map((type) => (
            <Pressable
              key={type}
              style={[
                styles.filterButton,
                {
                  backgroundColor:
                    filterType === type
                      ? BrandColors.primary.blue
                      : theme.backgroundDefault,
                  borderColor:
                    filterType === type ? BrandColors.primary.blue : theme.border,
                },
              ]}
              onPress={() => {
                if (Platform.OS !== "web") {
                  const Haptics = require("expo-haptics");
                  Haptics.selectionAsync();
                }
                setFilterType(type);
              }}
            >
              <ThemedText
                style={[
                  styles.filterButtonText,
                  { color: filterType === type ? "#FFFFFF" : theme.text },
                ]}
              >
                {type === "all" ? "All" : type === "lost" ? "Lost" : "Found"}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.text}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No items found
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
              {filterType === "lost"
                ? "No lost items reported yet"
                : filterType === "found"
                ? "No found items reported yet"
                : "Be the first to report a lost or found item"}
            </ThemedText>
          </View>
        }
      />

      <Pressable
        style={[styles.fab, { backgroundColor: BrandColors.primary.blue }]}
        onPress={() => {
          if (Platform.OS !== "web") {
            const Haptics = require("expo-haptics");
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          navigation.navigate("PostLostFound");
        }}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
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
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardContent: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  rewardBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 100,
    right: Spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

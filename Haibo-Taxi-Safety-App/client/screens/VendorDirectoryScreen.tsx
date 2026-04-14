import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useInfiniteQuery } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean VendorDirectory — commuter-facing browse surface for
// verified Haibo Vault vendors. Rose gradient hero, search input,
// vendor cards (business + location + sales + "Pay" CTA that deep-
// links into PayVendorScreen with the ref pre-filled).
//
// Data: /api/vendor-profile/directory is a single, auth-gated
// read-only endpoint that returns verified-only vendors with an
// optional ?q= text search. No infinite scroll yet — the limit
// caps at 100 on the server which is enough for the MVP.

type VendorType = "taxi_vendor" | "hawker" | "accessories";

interface DirectoryVendor {
  id: string;
  vendorType: VendorType;
  businessName: string;
  rankLocation: string | null;
  description: string | null;
  businessImageUrl: string | null;
  vendorRef: string;
  salesCount: number;
}

interface DirectoryResponse {
  data: DirectoryVendor[];
  hasMore: boolean;
  nextOffset: number | null;
}

const PAGE_SIZE = 50;

const TYPE_META: Record<
  VendorType,
  { label: string; icon: keyof typeof Feather.glyphMap; accent: string }
> = {
  taxi_vendor: {
    label: "Rank vendor",
    icon: "shopping-bag",
    accent: BrandColors.primary.gradientStart,
  },
  hawker: {
    label: "Hawker",
    icon: "package",
    accent: BrandColors.status.info,
  },
  accessories: {
    label: "Accessories",
    icon: "smartphone",
    accent: BrandColors.secondary.purple,
  },
};

export default function VendorDirectoryScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const directoryQ = useInfiniteQuery<DirectoryResponse>({
    queryKey: ["/api/vendor-profile/directory", search],
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) => {
      const q = search.trim();
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(pageParam));
      if (q) params.set("q", q);
      return apiRequest(`/api/vendor-profile/directory?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  // Flatten all loaded pages into a single vendor list for the FlatList.
  const vendors: DirectoryVendor[] =
    directoryQ.data?.pages.flatMap((p) => p.data) || [];

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
            <Feather
              name="shopping-bag"
              size={32}
              color={BrandColors.primary.gradientStart}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
          style={styles.heroText}
        >
          <ThemedText style={styles.heroTitle}>Haibo Vault</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Verified taxi rank vendors, hawkers, and accessory sellers.
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
        {/* Enter code manually — for users with a printed HBV-xxxx ref */}
        <Pressable
          onPress={() => navigation.navigate("PayVendor")}
          style={({ pressed }) => [
            styles.manualEntry,
            {
              backgroundColor: BrandColors.primary.gradientStart + "08",
              borderColor: BrandColors.primary.gradientStart + "40",
            },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Enter vendor code manually"
        >
          <View
            style={[
              styles.manualEntryIcon,
              { backgroundColor: BrandColors.primary.gradientStart + "14" },
            ]}
          >
            <Feather
              name="hash"
              size={18}
              color={BrandColors.primary.gradientStart}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.manualEntryTitle}>
              Have a code?
            </ThemedText>
            <ThemedText
              style={[styles.manualEntryHint, { color: theme.textSecondary }]}
            >
              Type a HBV-xxxx-xxxx code to pay directly
            </ThemedText>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={BrandColors.primary.gradientStart}
          />
        </Pressable>

        {/* Search input */}
        <View
          style={[
            styles.searchRow,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: searchFocused
                ? BrandColors.primary.gradientStart
                : theme.border,
            },
          ]}
        >
          <Feather name="search" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by business name"
            placeholderTextColor={theme.textSecondary}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {search ? (
            <Pressable
              onPress={() => setSearch("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Feather name="x-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {directoryQ.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="small"
              color={BrandColors.primary.gradientStart}
            />
          </View>
        ) : directoryQ.isError ? (
          <View style={styles.empty}>
            <Feather
              name="alert-triangle"
              size={32}
              color={BrandColors.status.warning}
            />
            <ThemedText style={styles.emptyTitle}>
              Couldn't load vendors
            </ThemedText>
            <ThemedText
              style={[styles.emptyHint, { color: theme.textSecondary }]}
            >
              Pull down to retry, or check your connection.
            </ThemedText>
          </View>
        ) : vendors.length === 0 ? (
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: BrandColors.primary.gradientStart + "12" },
              ]}
            >
              <Feather
                name="shopping-bag"
                size={26}
                color={BrandColors.primary.gradientStart}
              />
            </View>
            <ThemedText style={styles.emptyTitle}>
              {search ? "No vendors match" : "No verified vendors yet"}
            </ThemedText>
            <ThemedText
              style={[styles.emptyHint, { color: theme.textSecondary }]}
            >
              {search
                ? "Try a different search — or clear the filter to see all vendors."
                : "Be the first to register from your wallet's Become a vendor flow."}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={vendors}
            keyExtractor={(v) => v.id}
            contentContainerStyle={{
              paddingBottom: insets.bottom + Spacing["3xl"],
            }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
            onEndReached={() => {
              if (directoryQ.hasNextPage && !directoryQ.isFetchingNextPage) {
                directoryQ.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              directoryQ.isFetchingNextPage ? (
                <View style={styles.footerLoading}>
                  <ActivityIndicator
                    size="small"
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <VendorCard
                vendor={item}
                theme={theme}
                onPress={() =>
                  navigation.navigate("PayVendor", {
                    vendorRef: item.vendorRef,
                  })
                }
              />
            )}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function VendorCard({
  vendor,
  theme,
  onPress,
}: {
  vendor: DirectoryVendor;
  theme: any;
  onPress: () => void;
}) {
  const meta = TYPE_META[vendor.vendorType] || TYPE_META.taxi_vendor;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.vendorCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Pay ${vendor.businessName}`}
    >
      {vendor.businessImageUrl ? (
        <Image
          source={{ uri: vendor.businessImageUrl }}
          style={styles.vendorPhoto}
          resizeMode="cover"
          accessibilityLabel={`${vendor.businessName} photo`}
        />
      ) : (
        <View style={[styles.vendorIcon, { backgroundColor: meta.accent + "12" }]}>
          <Feather name={meta.icon} size={22} color={meta.accent} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <ThemedText style={styles.vendorName} numberOfLines={1}>
          {vendor.businessName}
        </ThemedText>
        <ThemedText
          style={[styles.vendorMeta, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {meta.label}
          {vendor.rankLocation ? ` · ${vendor.rankLocation}` : ""}
        </ThemedText>
        {vendor.salesCount > 0 ? (
          <ThemedText style={[styles.vendorSales, { color: theme.textSecondary }]}>
            {vendor.salesCount} {vendor.salesCount === 1 ? "sale" : "sales"}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.payButton,
          { backgroundColor: BrandColors.primary.gradientStart },
        ]}
      >
        <Feather name="arrow-right" size={16} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

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
  heroBadgeWrap: { alignItems: "center", marginBottom: Spacing.lg },
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
  heroText: { alignItems: "center" },
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Manual entry shortcut — rose-tinted pressable row
  manualEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  manualEntryIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  manualEntryTitle: {
    ...Typography.body,
    fontWeight: "700",
    fontSize: 14,
  },
  manualEntryHint: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 1,
  },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },

  // Vendor card
  vendorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  vendorIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  vendorPhoto: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  vendorName: {
    ...Typography.h4,
    marginBottom: 2,
  },
  vendorMeta: {
    ...Typography.small,
  },
  vendorSales: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 2,
  },
  payButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  // States
  loading: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  footerLoading: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  empty: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h4,
    textAlign: "center",
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },
});

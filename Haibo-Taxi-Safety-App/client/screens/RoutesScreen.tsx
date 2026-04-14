import React, { useState, useMemo, useCallback, memo } from "react";
import {
  View,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { HeroBanner } from "@/components/HeroBanner";
import { TaxiRoute } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getTaxiProvinces } from "@/lib/localData";
import { useRoutes } from "@/hooks/useApiData";

type RoutesStackParamList = {
  Routes: undefined;
  RouteDetail: { routeId: string };
};

const ROUTE_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  local: "navigation",
  regional: "map",
  intercity: "globe",
};

const ROUTE_CARD_HEIGHT = 150;
const SECTION_HEADER_HEIGHT = 50;

interface RouteCardProps {
  route: TaxiRoute;
  onPress: (route: TaxiRoute) => void;
  cardSurface: string;
  getSafetyColor: (score?: number) => string;
}

const RouteCard = memo(function RouteCard({
  route,
  onPress,
  cardSurface,
  getSafetyColor,
}: RouteCardProps) {
  const routeTypeIcon = ROUTE_TYPE_ICONS[route.routeType || "local"] || "navigation";
  const safetyColor = getSafetyColor(route.safetyScore);

  return (
    <Pressable
      style={[styles.routeCard, { backgroundColor: cardSurface }]}
      onPress={() => onPress(route)}
    >
      <View style={styles.routeHeader}>
        <View style={styles.routeInfo}>
          <ThemedText style={styles.routeOrigin} numberOfLines={1}>
            {route.origin}
          </ThemedText>
          <Feather
            name="arrow-right"
            size={16}
            color={BrandColors.primary.gradientStart}
            style={styles.routeArrow}
          />
          <ThemedText style={styles.routeDestination} numberOfLines={1}>
            {route.destination}
          </ThemedText>
        </View>
        <View style={styles.fareContainer}>
          <ThemedText style={styles.fareLabel}>Fare</ThemedText>
          <ThemedText style={styles.fareAmount}>
            {route.fare ? `R${route.fare}` : "—"}
          </ThemedText>
        </View>
      </View>

      <View style={styles.routeDetails}>
        <View style={styles.detailRow}>
          {route.estimatedTime ? (
            <View style={styles.detailItem}>
              <Feather name="clock" size={13} color={BrandColors.gray[600]} />
              <ThemedText style={styles.detailText}>{route.estimatedTime}</ThemedText>
            </View>
          ) : null}

          {route.distance ? (
            <View style={styles.detailItem}>
              <Feather name="map-pin" size={13} color={BrandColors.gray[600]} />
              <ThemedText style={styles.detailText}>
                {route.distance.toFixed(1)} km
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.tagsRow}>
          <View
            style={[
              styles.tag,
              { backgroundColor: BrandColors.primary.gradientStart + "12" },
            ]}
          >
            <Feather
              name={routeTypeIcon}
              size={12}
              color={BrandColors.primary.gradientStart}
            />
            <ThemedText
              style={[styles.tagText, { color: BrandColors.primary.gradientStart }]}
            >
              {(route.routeType || "local").charAt(0).toUpperCase() +
                (route.routeType || "local").slice(1)}
            </ThemedText>
          </View>

          {route.safetyScore ? (
            <View style={[styles.tag, { backgroundColor: `${safetyColor}1A` }]}>
              <Feather name="shield" size={12} color={safetyColor} />
              <ThemedText style={[styles.tagText, { color: safetyColor }]}>
                {route.safetyScore.toFixed(1)}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export default function RoutesScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RoutesStackParamList & RootStackParamList>>();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");

  const provinces = useMemo(() => getTaxiProvinces(), []);
  const { data: allRoutes = [] } = useRoutes();
  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  const routes = useMemo(() => {
    if (selectedRegion === "All Regions") return allRoutes;
    return allRoutes.filter((r: any) => r.province === selectedRegion);
  }, [allRoutes, selectedRegion]);

  const filteredRoutes = useMemo(() => {
    if (!searchQuery) return routes;
    const searchLower = searchQuery.toLowerCase();
    return routes.filter((route) => {
      return (
        route.origin.toLowerCase().includes(searchLower) ||
        route.destination.toLowerCase().includes(searchLower) ||
        (route.association || "").toLowerCase().includes(searchLower)
      );
    });
  }, [routes, searchQuery]);

  const groupedData = useMemo(() => {
    const result: { type: "header" | "route"; data: string | TaxiRoute }[] = [];
    const groups: Record<string, TaxiRoute[]> = {};

    filteredRoutes.forEach((route) => {
      const region = route.province || route.region || "Other";
      if (!groups[region]) groups[region] = [];
      groups[region].push(route);
    });

    Object.entries(groups).forEach(([region, regionRoutes]) => {
      result.push({ type: "header", data: region });
      regionRoutes.forEach((route) => {
        result.push({ type: "route", data: route });
      });
    });
    return result;
  }, [filteredRoutes]);

  const handleRoutePress = useCallback(
    (route: TaxiRoute) => {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      navigation.navigate("RouteDetail", { routeId: route.id });
    },
    [navigation]
  );

  const getSafetyColor = useCallback((score?: number) => {
    if (!score) return BrandColors.gray[400];
    if (score >= 4) return BrandColors.status.success;
    if (score >= 3) return BrandColors.secondary.orange;
    return BrandColors.status.emergency;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === "header") {
        return (
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>{item.data}</ThemedText>
            <View style={styles.sectionLine} />
          </View>
        );
      }
      return (
        <RouteCard
          route={item.data}
          onPress={handleRoutePress}
          cardSurface={cardSurface}
          getSafetyColor={getSafetyColor}
        />
      );
    },
    [handleRoutePress, cardSurface, getSafetyColor]
  );

  const handleContributePress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate("ContributeRoute");
  }, [navigation]);

  const handleSelectRegion = useCallback((region: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelectedRegion(region);
  }, []);

  const renderListHeader = useMemo(
    () => (
      <>
        <HeroBanner onContributePress={handleContributePress} />
        <View style={[styles.searchContainer, { backgroundColor: cardSurface }]}>
          <Feather name="search" size={18} color={BrandColors.gray[600]} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search routes, destinations..."
            placeholderTextColor={BrandColors.gray[500]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Feather name="x" size={18} color={BrandColors.gray[600]} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.filterContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={provinces}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => {
              const active = selectedRegion === item;
              return (
                <Pressable
                  style={[
                    styles.filterChip,
                    active ? styles.filterChipActive : { backgroundColor: cardSurface },
                  ]}
                  onPress={() => handleSelectRegion(item)}
                >
                  <ThemedText
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {item}
                  </ThemedText>
                </Pressable>
              );
            }}
          />
        </View>
      </>
    ),
    [
      handleContributePress,
      handleSelectRegion,
      cardSurface,
      theme.text,
      searchQuery,
      selectedRegion,
      provinces,
    ]
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <Feather name="search" size={28} color={BrandColors.primary.gradientStart} />
        </View>
        <ThemedText style={styles.emptyTitle}>No routes found</ThemedText>
        <ThemedText style={styles.emptySubtitle}>
          {searchQuery
            ? `Try a different search or clear filters.`
            : `No routes for ${selectedRegion} yet. Be the first to contribute one.`}
        </ThemedText>
        <Pressable onPress={handleContributePress} style={styles.emptyCta}>
          <Feather name="plus-circle" size={16} color={BrandColors.primary.gradientStart} />
          <ThemedText style={styles.emptyCtaText}>Contribute a route</ThemedText>
        </Pressable>
      </View>
    ),
    [searchQuery, selectedRegion, handleContributePress]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <FlatList
        data={groupedData}
        keyExtractor={(item, index) =>
          item.type === "header"
            ? `h-${item.data}`
            : `r-${(item.data as TaxiRoute).id}-${index}`
        }
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        getItemLayout={(data, index) => {
          const isHeader = data?.[index]?.type === "header";
          const length = isHeader ? SECTION_HEADER_HEIGHT : ROUTE_CARD_HEIGHT;
          return { length, offset: length * index, index };
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 50,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
  },
  filterContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  filterList: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  filterChipActive: {
    backgroundColor: BrandColors.primary.gradientStart,
    borderColor: BrandColors.primary.gradientStart,
  },
  filterChipText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.gray[700],
  },
  filterChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    height: 30,
  },
  sectionTitle: {
    ...Typography.label,
    fontWeight: "800",
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: BrandColors.gray[200],
    marginLeft: Spacing.md,
  },
  routeCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    height: ROUTE_CARD_HEIGHT - Spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  routeInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  routeOrigin: {
    ...Typography.body,
    fontWeight: "700",
    flexShrink: 1,
  },
  routeArrow: {
    marginHorizontal: 8,
  },
  routeDestination: {
    ...Typography.body,
    fontWeight: "700",
    flexShrink: 1,
  },
  fareContainer: {
    alignItems: "flex-end",
    marginLeft: Spacing.md,
  },
  fareLabel: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.gray[500],
    textTransform: "uppercase",
  },
  fareAmount: {
    ...Typography.h3,
    fontWeight: "800",
    color: BrandColors.primary.gradientStart,
  },
  routeDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  tagsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  tagText: {
    ...Typography.label,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    fontWeight: "800",
  },
  emptySubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  emptyCtaText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
});

import React, { useState, useMemo, useCallback, memo } from "react";
import {
  View,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { HeroBanner } from "@/components/HeroBanner";
import { TaxiRoute } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getTaxiRoutes, getTaxiProvinces } from "@/lib/localData";
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

// Memoized Route Card for smooth scrolling
const RouteCard = memo(({ 
  route, 
  onPress, 
  theme, 
  getSafetyColor 
}: { 
  route: TaxiRoute; 
  onPress: (route: TaxiRoute) => void; 
  theme: any;
  getSafetyColor: (score?: number) => string;
}) => {
  const routeTypeIcon = ROUTE_TYPE_ICONS[route.routeType || "local"] || "navigation";
  const safetyColor = getSafetyColor(route.safetyScore);
  
  return (
    <Pressable
      style={[styles.routeCard, { backgroundColor: theme.backgroundDefault }]}
      onPress={() => onPress(route)}
    >
      <View style={styles.routeHeader}>
        <View style={styles.routeInfo}>
          <ThemedText style={styles.routeOrigin}>{route.origin}</ThemedText>
          <View style={styles.arrowContainer}>
            <Feather name="arrow-right" size={16} color={BrandColors.primary.blue} />
          </View>
          <ThemedText style={styles.routeDestination}>{route.destination}</ThemedText>
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
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {route.estimatedTime}
              </ThemedText>
            </View>
          ) : null}
          
          {route.distance ? (
            <View style={styles.detailItem}>
              <Feather name="map-pin" size={14} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {route.distance.toFixed(1)} km
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.tagsRow}>
          <View style={[styles.routeTypeTag, { backgroundColor: `${BrandColors.primary.blue}20` }]}>
            <Feather name={routeTypeIcon} size={12} color={BrandColors.primary.blue} />
            <ThemedText style={[styles.tagText, { color: BrandColors.primary.blue }]}>
              {(route.routeType || "local").charAt(0).toUpperCase() + (route.routeType || "local").slice(1)}
            </ThemedText>
          </View>

          {route.safetyScore ? (
            <View style={[styles.safetyTag, { backgroundColor: `${safetyColor}20` }]}>
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
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RoutesStackParamList & RootStackParamList>>();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("All Regions");

  const provinces = useMemo(() => getTaxiProvinces(), []);
  const { data: allRoutes = [] } = useRoutes();

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

  const handleRoutePress = useCallback(async (route: TaxiRoute) => {
    try {
      const Haptics = await import("expo-haptics");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    navigation.navigate("RouteDetail", { routeId: route.id });
  }, [navigation]);

  const getSafetyColor = useCallback((score?: number) => {
    if (!score) return BrandColors.gray[400];
    if (score >= 4) return BrandColors.primary.green;
    if (score >= 3) return BrandColors.secondary.orange;
    return "#E74C3C";
  }, []);

  const renderItem = useCallback(({ item }: { item: any }) => {
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
        theme={theme} 
        getSafetyColor={getSafetyColor} 
      />
    );
  }, [handleRoutePress, theme, getSafetyColor]);

  const handleContributePress = useCallback(async () => {
    try {
      const Haptics = await import("expo-haptics");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    navigation.navigate("ContributeRoute");
  }, [navigation]);

  const renderListHeader = useMemo(() => (
    <>
      <HeroBanner onContributePress={handleContributePress} />
      <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search routes, destinations..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        )}
      </View>
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={provinces}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.filterChip,
                {
                  backgroundColor: selectedRegion === item ? BrandColors.primary.blue : theme.backgroundDefault,
                },
              ]}
              onPress={async () => {
                try {
                  const Haptics = await import("expo-haptics");
                  Haptics.selectionAsync();
                } catch {}
                setSelectedRegion(item);
              }}
            >
              <ThemedText style={[styles.filterChipText, { color: selectedRegion === item ? "#FFFFFF" : theme.text }]}>
                {item}
              </ThemedText>
            </Pressable>
          )}
        />
      </View>
    </>
  ), [handleContributePress, theme, searchQuery, selectedRegion, provinces]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={groupedData}
        keyExtractor={(item, index) => item.type === "header" ? `h-${item.data}` : `r-${(item.data as TaxiRoute).id}-${index}`}
        renderItem={renderItem}
        ListHeaderComponent={renderListHeader}
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        // Performance optimizations
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        getItemLayout={(data, index) => ({
          length: data?.[index]?.type === 'header' ? 50 : 160,
          offset: (data?.[index]?.type === 'header' ? 50 : 160) * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 50,
    borderRadius: BorderRadius.md,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: 16 },
  filterContainer: { marginBottom: Spacing.md },
  filterList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  filterChipText: { fontSize: 14, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    height: 30,
  },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: BrandColors.primary.blue, textTransform: "uppercase", letterSpacing: 1 },
  sectionLine: { flex: 1, height: 1, backgroundColor: BrandColors.primary.blue, opacity: 0.1, marginLeft: Spacing.md },
  routeCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    height: 145,
  },
  routeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.md },
  routeInfo: { flex: 1, flexDirection: "row", alignItems: "center" },
  routeOrigin: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  arrowContainer: { marginHorizontal: 8 },
  routeDestination: { fontSize: 16, fontWeight: "700", flexShrink: 1 },
  fareContainer: { alignItems: "flex-end", marginLeft: Spacing.md },
  fareLabel: { fontSize: 10, opacity: 0.5, fontWeight: "700", textTransform: "uppercase" },
  fareAmount: { fontSize: 18, fontWeight: "800", color: BrandColors.primary.green },
  routeDetails: { gap: Spacing.md },
  detailRow: { flexDirection: "row", gap: Spacing.lg },
  detailItem: { flexDirection: "row", alignItems: "center" },
  tagsRow: { flexDirection: "row", gap: Spacing.sm },
  routeTypeTag: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  safetyTag: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  tagText: { fontSize: 11, fontWeight: "700" },
});

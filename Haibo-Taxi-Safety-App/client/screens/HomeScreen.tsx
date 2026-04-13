import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import * as Location from "expo-location";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { MapViewComponent } from "@/components/MapViewComponent";
import { FloatingHeader } from "@/components/FloatingHeader";
import { RankDetailPanel } from "@/components/RankDetailPanel";
import { RouteDetailOverlay } from "@/components/RouteDetailOverlay";
import { TransitRouteLegend } from "@/components/TransitRouteLegend";
import { MapControlButtons } from "@/components/MapControlButtons";
import { useLocations } from "@/hooks/useApiData";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { TaxiLocation, LocationType } from "@/lib/types";
import type { MapboxTaxiRank, MapboxTaxiRoute } from "@/data/mapbox_transit_data";

// typeui-clean rework — map-first screen with the brand rose-red surfacing
// in the touchpoints (sheet handle, search focus, distance pill, chevrons).
// The map remains the dominant surface; the bottom sheet, pin banner, and
// rank list all use Typography tokens and the gradient brand language.

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Each location type still has a distinct accent — but we use it as a thin
// 4px left border on the rank row, not a giant tinted icon background. Keeps
// the list calm while preserving type differentiation.
const locationTypeConfig: Record<
  LocationType,
  { color: string; icon: keyof typeof Feather.glyphMap; label: string }
> = {
  rank: { color: BrandColors.primary.gradientStart, icon: "home", label: "Rank" },
  formal_stop: { color: BrandColors.primary.green, icon: "map-pin", label: "Stop" },
  informal_stop: { color: BrandColors.secondary.orange, icon: "navigation", label: "Informal" },
  landmark: { color: BrandColors.secondary.purple, icon: "flag", label: "Landmark" },
  interchange: { color: BrandColors.primary.blue, icon: "repeat", label: "Interchange" },
};

// Haversine — distance in km between two lat/lng points. Used for the rank
// row distance pill so commuters see "1.2km" instead of the old "Nearby".
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const mapRef = useRef<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<TaxiLocation | null>(null);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  const [selectedRank, setSelectedRank] = useState<MapboxTaxiRank | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<MapboxTaxiRoute | null>(null);
  const [showTransitRoutes, setShowTransitRoutes] = useState(true);

  const { data: locations = [] } = useLocations();
  const sheetHeight = useSharedValue(220);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc);
    })();
  }, []);

  const triggerHaptic = (style: "light" | "medium" = "light") => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = require("expo-haptics");
      Haptics.impactAsync(
        style === "medium"
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light
      );
    } catch {}
  };

  const handleLocationPress = useCallback((location: TaxiLocation) => {
    triggerHaptic("light");
    setSelectedLocation(location);
    setSelectedRank(null);
    setSelectedRoute(null);
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }, []);

  const handleLocationDetails = useCallback(
    (location: TaxiLocation) => {
      triggerHaptic("medium");
      navigation.navigate("LocationDetails", { locationId: location.id });
    },
    [navigation]
  );

  const handleRankSelect = useCallback(
    (rank: MapboxTaxiRank | null) => {
      triggerHaptic("medium");
      setSelectedRank(rank);
      setSelectedRoute(null);
      if (rank) {
        sheetHeight.value = withSpring(0, { damping: 20, stiffness: 150 });
        setIsSheetExpanded(false);
      }
    },
    [sheetHeight]
  );

  const handleRouteSelect = useCallback(
    (route: MapboxTaxiRoute | null) => {
      triggerHaptic("light");
      setSelectedRoute(route);
      setSelectedRank(null);
      if (route) {
        sheetHeight.value = withSpring(0, { damping: 20, stiffness: 150 });
        setIsSheetExpanded(false);
      }
    },
    [sheetHeight]
  );

  const handleResetView = useCallback(() => {
    setSelectedRank(null);
    setSelectedRoute(null);
    setSelectedLocation(null);
    mapRef.current?.resetView?.();
    sheetHeight.value = withSpring(220, { damping: 20, stiffness: 150 });
  }, [sheetHeight]);

  const handleToggleRoutes = useCallback(() => {
    setShowTransitRoutes((prev) => !prev);
  }, []);

  const handleLocateUser = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  }, [userLocation]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const toggleSheet = (forceExpand = false) => {
    if (selectedRank || selectedRoute) return;
    const shouldExpand = forceExpand || !isSheetExpanded;
    const newHeight = shouldExpand ? SCREEN_HEIGHT * 0.7 : 220;
    sheetHeight.value = withSpring(newHeight, { damping: 20, stiffness: 150 });
    setIsSheetExpanded(shouldExpand);
  };

  const handleSearchFocus = () => {
    setSearchFocused(true);
    toggleSheet(true);
  };

  const initialRegion = {
    latitude: -26.2041,
    longitude: 28.0473,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  const handleAddLocation = () => {
    navigation.navigate(
      "AddLocation",
      pinnedLocation
        ? { latitude: pinnedLocation.latitude, longitude: pinnedLocation.longitude }
        : undefined
    );
    setPinnedLocation(null);
  };

  const handleMapLongPress = (event: { coordinate: { latitude: number; longitude: number } }) => {
    triggerHaptic("medium");
    setPinnedLocation(event.coordinate);
  };

  const handleClearPin = () => {
    setPinnedLocation(null);
  };

  // Sort by Haversine distance when user location is available.
  const sortedLocations = React.useMemo(() => {
    if (!userLocation) return locations;
    const { latitude, longitude } = userLocation.coords;
    return [...locations]
      .map((loc) => ({
        ...loc,
        _dist: haversineKm(latitude, longitude, loc.latitude, loc.longitude),
      }))
      .sort((a, b) => a._dist - b._dist);
  }, [userLocation, locations]);

  const filteredLocations = sortedLocations.filter((location) =>
    searchQuery
      ? location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (location.address || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const hasSelection = !!(selectedRank || selectedRoute || selectedLocation);
  const rankCount = filteredLocations.length;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FloatingHeader showLogo />

      <View style={styles.mapContainer}>
        <MapViewComponent
          mapRef={mapRef}
          locations={locations}
          initialRegion={initialRegion}
          isDark={isDark}
          onLocationPress={handleLocationPress}
          onLongPress={handleMapLongPress}
          pinnedLocation={pinnedLocation}
          onPinnedMarkerPress={handleAddLocation}
          showTransitRoutes={showTransitRoutes}
          onRankSelect={handleRankSelect}
          onRouteSelect={handleRouteSelect}
          selectedRankId={selectedRank?.id || null}
          selectedRouteId={selectedRoute?.id || null}
        />

        {/* Pin banner — gradient-bordered card with rose CTA, replaces the
            old utilitarian green/grey button row */}
        {pinnedLocation ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={[
              styles.pinBanner,
              {
                top: insets.top + 64,
                backgroundColor: theme.surface,
                borderColor: BrandColors.primary.gradientStart + "33",
              },
            ]}
          >
            <View style={styles.pinBannerContent}>
              <View style={styles.pinIconWrap}>
                <Feather name="map-pin" size={16} color={BrandColors.primary.gradientStart} />
              </View>
              <ThemedText style={styles.pinBannerText}>
                Pin placed — add a stop here?
              </ThemedText>
            </View>
            <View style={styles.pinBannerButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.pinAddButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleAddLocation}
                accessibilityRole="button"
                accessibilityLabel="Add stop at pin"
              >
                <LinearGradient
                  colors={BrandColors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pinAddGradient}
                >
                  <Feather name="plus" size={14} color="#FFFFFF" />
                  <ThemedText style={styles.pinAddText}>Add</ThemedText>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={handleClearPin}
                hitSlop={8}
                style={styles.pinClearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear pin"
              >
                <Feather name="x" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        <MapControlButtons
          onResetView={handleResetView}
          onToggleRoutes={handleToggleRoutes}
          onLocateUser={handleLocateUser}
          showTransitRoutes={showTransitRoutes}
          hasSelection={hasSelection}
          topOffset={insets.top + 56}
        />

        {showTransitRoutes && !selectedRank && !selectedRoute && (
          <TransitRouteLegend
            selectedRouteId={selectedRoute?.id || null}
            onRouteSelect={handleRouteSelect}
          />
        )}
      </View>

      {selectedRank && (
        <RankDetailPanel
          rank={selectedRank}
          onClose={() => {
            setSelectedRank(null);
            sheetHeight.value = withSpring(220, { damping: 20, stiffness: 150 });
          }}
          onViewRoutes={() => {
            navigation.navigate("Main");
            setSelectedRank(null);
          }}
          onNavigate={() => {
            if (selectedRank) {
              mapRef.current?.flyTo?.([selectedRank.lng, selectedRank.lat], 15);
            }
          }}
        />
      )}

      {selectedRoute && !selectedRank && (
        <RouteDetailOverlay
          route={selectedRoute}
          onClose={() => {
            setSelectedRoute(null);
            sheetHeight.value = withSpring(220, { damping: 20, stiffness: 150 });
          }}
        />
      )}

      {/* Bottom sheet — typeui-clean: rose gradient handle, branded search,
          calm rank rows with thin accent borders + actual distance pills */}
      {!selectedRank && !selectedRoute && (
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: theme.surface,
              paddingBottom: tabBarHeight + Spacing.xl,
            },
            animatedSheetStyle,
          ]}
        >
          <Pressable onPress={() => toggleSheet()} style={styles.sheetHandleWrap}>
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sheetHandle}
            />
          </Pressable>

          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <ThemedText style={styles.sheetTitle}>Nearby ranks</ThemedText>
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: BrandColors.primary.gradientStart + "15" },
                ]}
              >
                <ThemedText style={styles.countBadgeText}>
                  {rankCount}
                </ThemedText>
              </View>
            </View>
            <Pressable
              onPress={() => toggleSheet()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={
                isSheetExpanded ? "Collapse rank list" : "Expand rank list"
              }
            >
              <Feather
                name={isSheetExpanded ? "chevron-down" : "chevron-up"}
                size={22}
                color={theme.textSecondary}
              />
            </Pressable>
          </View>

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
              placeholder="Search ranks, areas, or routes"
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={() => setSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Feather name="x" size={16} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.ranksList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Spacing["3xl"] }}
            keyboardShouldPersistTaps="handled"
          >
            {filteredLocations.length === 0 ? (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={styles.emptyState}
              >
                <View
                  style={[
                    styles.emptyIcon,
                    { backgroundColor: BrandColors.primary.gradientStart + "10" },
                  ]}
                >
                  <Feather
                    name="map-pin"
                    size={22}
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
                <ThemedText style={styles.emptyTitle}>
                  No ranks match
                </ThemedText>
                <ThemedText
                  style={[
                    styles.emptyHint,
                    { color: theme.textSecondary },
                  ]}
                >
                  Try a different search or long-press the map to drop a pin.
                </ThemedText>
              </Animated.View>
            ) : (
              filteredLocations.map((location, index) => {
                const config =
                  locationTypeConfig[location.type as LocationType] ||
                  locationTypeConfig.informal_stop;
                const distance =
                  userLocation && (location as any)._dist !== undefined
                    ? formatDistance((location as any)._dist as number)
                    : null;

                return (
                  <Animated.View
                    key={location.id}
                    entering={FadeInDown.duration(300).delay(
                      Math.min(index * 30, 300)
                    )}
                  >
                    <Pressable
                      onPress={() => handleLocationDetails(location)}
                      style={({ pressed }) => [
                        styles.rankItem,
                        {
                          backgroundColor: pressed
                            ? theme.backgroundSecondary
                            : "transparent",
                          borderLeftColor: config.color,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${location.name}`}
                    >
                      <View style={styles.rankIcon}>
                        <Feather name={config.icon} size={18} color={config.color} />
                      </View>

                      <View style={styles.rankInfo}>
                        <ThemedText style={styles.rankName} numberOfLines={1}>
                          {location.name}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.rankAddress,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {location.address || config.label}
                        </ThemedText>
                      </View>

                      <View style={styles.rankMeta}>
                        {distance ? (
                          <View
                            style={[
                              styles.distancePill,
                              {
                                backgroundColor:
                                  BrandColors.primary.gradientStart + "12",
                              },
                            ]}
                          >
                            <ThemedText style={styles.distanceText}>
                              {distance}
                            </ThemedText>
                          </View>
                        ) : (
                          <ThemedText
                            style={[
                              styles.distanceFallback,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {config.label}
                          </ThemedText>
                        )}
                        <Feather
                          name="chevron-right"
                          size={16}
                          color={theme.textSecondary}
                        />
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { flex: 1, position: "relative" },

  pinBanner: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  pinBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  pinIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  pinBannerText: {
    ...Typography.small,
    fontWeight: "600",
    flex: 1,
  },
  pinBannerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pinAddButton: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  pinAddGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pinAddText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pinClearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },
  sheetHandleWrap: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sheetTitle: {
    ...Typography.h3,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 28,
    alignItems: "center",
  },
  countBadgeText: {
    ...Typography.label,
    color: BrandColors.primary.gradientStart,
    fontWeight: "700",
    fontSize: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  searchInput: {
    ...Typography.body,
    flex: 1,
  },
  ranksList: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    borderLeftWidth: 3,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  rankIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  rankInfo: { flex: 1 },
  rankName: {
    ...Typography.body,
    fontWeight: "700",
  },
  rankAddress: {
    ...Typography.small,
    marginTop: 2,
  },
  rankMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  distancePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  distanceText: {
    ...Typography.label,
    color: BrandColors.primary.gradientStart,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    fontSize: 11,
  },
  distanceFallback: {
    ...Typography.label,
    fontSize: 11,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 260,
  },
});

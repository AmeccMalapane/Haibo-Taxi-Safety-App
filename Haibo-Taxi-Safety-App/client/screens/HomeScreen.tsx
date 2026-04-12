import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Location from "expo-location";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const locationTypeConfig: Record<LocationType, { color: string; icon: keyof typeof Feather.glyphMap; label: string }> = {
  rank: { color: BrandColors.primary.blue, icon: "home", label: "Taxi Rank" },
  formal_stop: { color: BrandColors.primary.green, icon: "map-pin", label: "Formal Stop" },
  informal_stop: { color: BrandColors.secondary.orange, icon: "navigation", label: "Informal Stop" },
  landmark: { color: "#9B59B6", icon: "flag", label: "Landmark" },
  interchange: { color: "#E74C3C", icon: "repeat", label: "Interchange" },
};

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
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);

  // Mapbox transit state
  const [selectedRank, setSelectedRank] = useState<MapboxTaxiRank | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<MapboxTaxiRoute | null>(null);
  const [showTransitRoutes, setShowTransitRoutes] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const { data: locations = [] } = useLocations();

  const sheetHeight = useSharedValue(200);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    })();
  }, []);

  const handleLocationPress = useCallback((location: TaxiLocation) => {
    if (Platform.OS !== "web") {
      const Haptics = require("expo-haptics");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedLocation(location);
    // Clear transit selections when a location marker is pressed
    setSelectedRank(null);
    setSelectedRoute(null);
    mapRef.current?.animateToRegion({
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }, []);

  const handleLocationDetails = useCallback((location: TaxiLocation) => {
    if (Platform.OS !== "web") {
      const Haptics = require("expo-haptics");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate("LocationDetails", { locationId: location.id });
  }, [navigation]);

  const handleShareLocation = () => {
    navigation.navigate("TripShare");
  };

  const handleReportPress = () => {
    navigation.navigate("Report");
  };

  // Mapbox transit handlers
  const handleRankSelect = useCallback((rank: MapboxTaxiRank | null) => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = require("expo-haptics");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    setSelectedRank(rank);
    setSelectedRoute(null);
    // Collapse the bottom sheet when a rank is selected
    if (rank) {
      sheetHeight.value = withSpring(0, { damping: 20, stiffness: 150 });
      setIsSheetExpanded(false);
    }
  }, [sheetHeight]);

  const handleRouteSelect = useCallback((route: MapboxTaxiRoute | null) => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = require("expo-haptics");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    setSelectedRoute(route);
    setSelectedRank(null);
    if (route) {
      sheetHeight.value = withSpring(0, { damping: 20, stiffness: 150 });
      setIsSheetExpanded(false);
    }
  }, [sheetHeight]);

  const handleResetView = useCallback(() => {
    setSelectedRank(null);
    setSelectedRoute(null);
    setSelectedLocation(null);
    mapRef.current?.resetView?.();
    sheetHeight.value = withSpring(200, { damping: 20, stiffness: 150 });
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
    // Don't expand sheet if a rank or route is selected
    if (selectedRank || selectedRoute) return;
    const shouldExpand = forceExpand || !isSheetExpanded;
    const newHeight = shouldExpand ? SCREEN_HEIGHT * 0.7 : 200;
    sheetHeight.value = withSpring(newHeight, { damping: 20, stiffness: 150 });
    setIsSheetExpanded(shouldExpand);
  };

  const handleSearchFocus = () => {
    toggleSheet(true);
  };

  const initialRegion = {
    latitude: -26.2041,
    longitude: 28.0473,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  const handleAddLocation = () => {
    navigation.navigate("AddLocation", pinnedLocation ? { latitude: pinnedLocation.latitude, longitude: pinnedLocation.longitude } : undefined);
    setPinnedLocation(null);
  };

  const handleMapLongPress = (event: { coordinate: { latitude: number; longitude: number } }) => {
    setPinnedLocation(event.coordinate);
  };

  const handleClearPin = () => {
    setPinnedLocation(null);
  };

  // Sort locations by distance if user location is available
  const sortedLocations = React.useMemo(() => {
    if (!userLocation) return locations;
    
    return [...locations].sort((a, b) => {
      const distA = Math.pow(a.latitude - userLocation.coords.latitude, 2) + Math.pow(a.longitude - userLocation.coords.longitude, 2);
      const distB = Math.pow(b.latitude - userLocation.coords.latitude, 2) + Math.pow(b.longitude - userLocation.coords.longitude, 2);
      return distA - distB;
    });
  }, [userLocation, locations]);

  const filteredLocations = sortedLocations.filter((location) =>
    searchQuery
      ? location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (location.address || "").toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const hasSelection = !!(selectedRank || selectedRoute || selectedLocation);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FloatingHeader showLogo />
      <View style={[styles.mapContainer]}>
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
        
        {/* Pin banner */}
        {pinnedLocation ? (
          <View style={[styles.pinBanner, { backgroundColor: theme.surface }]}>
            <View style={styles.pinBannerContent}>
              <Feather name="map-pin" size={18} color={BrandColors.primary.green} />
              <ThemedText style={styles.pinBannerText}>Pin placed! Tap to add stop here</ThemedText>
            </View>
            <View style={styles.pinBannerButtons}>
              <Pressable style={[styles.pinButton, { backgroundColor: BrandColors.primary.green }]} onPress={handleAddLocation}>
                <Feather name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.pinButtonText}>Add</Text>
              </Pressable>
              <Pressable style={[styles.pinButton, { backgroundColor: BrandColors.gray[400] }]} onPress={handleClearPin}>
                <Feather name="x" size={16} color="#FFFFFF" />
                <Text style={styles.pinButtonText}>Clear</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Map control buttons */}
        <MapControlButtons
          onResetView={handleResetView}
          onToggleRoutes={handleToggleRoutes}
          onLocateUser={handleLocateUser}
          showTransitRoutes={showTransitRoutes}
          hasSelection={hasSelection}
          topOffset={insets.top + 56}
        />

        {/* Transit Route Legend (visible when no rank/route is selected) */}
        {showTransitRoutes && !selectedRank && !selectedRoute && (
          <TransitRouteLegend
            selectedRouteId={selectedRoute?.id || null}
            onRouteSelect={handleRouteSelect}
          />
        )}
      </View>

      {/* Rank Detail Panel */}
      {selectedRank && (
        <RankDetailPanel
          rank={selectedRank}
          onClose={() => {
            setSelectedRank(null);
            sheetHeight.value = withSpring(200, { damping: 20, stiffness: 150 });
          }}
          onViewRoutes={() => {
            // Navigate to the Routes tab via MainTabs
            navigation.navigate("Main");
            setSelectedRank(null);
          }}
          onNavigate={() => {
            // Navigate to the rank location
            if (selectedRank) {
              mapRef.current?.flyTo?.([selectedRank.lng, selectedRank.lat], 15);
            }
          }}
        />
      )}

      {/* Route Detail Overlay */}
      {selectedRoute && !selectedRank && (
        <RouteDetailOverlay
          route={selectedRoute}
          onClose={() => {
            setSelectedRoute(null);
            sheetHeight.value = withSpring(200, { damping: 20, stiffness: 150 });
          }}
        />
      )}

      {/* Bottom Sheet (hidden when rank/route is selected) */}
      {!selectedRank && !selectedRoute && (
        <Animated.View
          style={[
            styles.bottomSheet,
            { backgroundColor: theme.surface, paddingBottom: tabBarHeight + Spacing.xl },
            animatedSheetStyle,
          ]}
        >
          <Pressable onPress={() => toggleSheet()} style={styles.sheetHandle}>
            <View style={[styles.handle, { backgroundColor: BrandColors.gray[400] }]} />
          </Pressable>

          <View style={styles.sheetHeader}>
            <ThemedText type="h4">Nearby Taxi Ranks</ThemedText>
            <Pressable onPress={() => toggleSheet()}>
              <Feather name={isSheetExpanded ? "chevron-down" : "chevron-up"} size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search ranks or areas..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather name="x" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            style={styles.ranksList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Spacing.xl }}
          >
            {filteredLocations.map((location) => {
              const config = locationTypeConfig[location.type as LocationType] || locationTypeConfig.informal_stop;
              return (
                <Pressable
                  key={location.id}
                  style={({ pressed }) => [
                    styles.rankItem,
                    { backgroundColor: pressed ? theme.backgroundSecondary : "transparent" },
                  ]}
                  onPress={() => handleLocationDetails(location)}
                >
                  <View style={[styles.rankIcon, { backgroundColor: `${config.color}20` }]}>
                    <Feather name={config.icon} size={20} color={config.color} />
                  </View>
                  <View style={styles.rankInfo}>
                    <ThemedText style={styles.rankName}>{location.name}</ThemedText>
                    <ThemedText style={styles.rankAddress} numberOfLines={1}>
                      {location.address || "Local taxi rank"}
                    </ThemedText>
                  </View>
                  <View style={styles.rankMeta}>
                    <ThemedText style={styles.rankDistance}>
                      {userLocation ? "Nearby" : "South Africa"}
                    </ThemedText>
                    <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                  </View>
                </Pressable>
              );
            })}
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
    top: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pinBannerContent: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  pinBannerText: { fontSize: 13, fontWeight: "600" },
  pinBannerButtons: { flexDirection: "row", gap: 8 },
  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  pinButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  sheetHandle: { height: 24, alignItems: "center", justifyContent: "center" },
  handle: { width: 40, height: 4, borderRadius: 2 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 16 },
  ranksList: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg },
  rankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  rankIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 16, fontWeight: "700" },
  rankAddress: { fontSize: 13, color: BrandColors.gray[500], marginTop: 2 },
  rankMeta: { alignItems: "flex-end", gap: 4 },
  rankDistance: { fontSize: 12, fontWeight: "600", color: BrandColors.primary.blue },
});

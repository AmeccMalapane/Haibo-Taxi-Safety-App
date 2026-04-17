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
import { useNavigation, useFocusEffect } from "@react-navigation/native";
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
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { MapViewComponent } from "@/components/MapViewComponent";
import { FloatingHeader } from "@/components/FloatingHeader";
import { RankDetailPanel } from "@/components/RankDetailPanel";
import { LocationInfoBubble } from "@/components/LocationInfoBubble";
import { RouteDetailOverlay } from "@/components/RouteDetailOverlay";
import { TransitRouteLegend } from "@/components/TransitRouteLegend";
import { MapControlButtons } from "@/components/MapControlButtons";
import { PasopPinSheet } from "@/components/PasopPinSheet";
import { useLocations } from "@/hooks/useApiData";
import { getDeviceId } from "@/lib/deviceId";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import type { TaxiLocation, LocationType } from "@/lib/types";
import type { MapboxTaxiRank, MapboxTaxiRoute } from "@/data/mapbox_transit_data";
import {
  PasopReport,
  getMyPetitions,
  getPasopReports,
  petitionPasopReport,
  recordMyPetition,
} from "@/data/pasopReports";

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

interface ModePillButtonProps {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  active: boolean;
  onPress: () => void;
  badgeCount?: number;
}

function ModePillButton({ label, icon, active, onPress, badgeCount }: ModePillButtonProps) {
  const content = (
    <>
      <Feather
        name={icon}
        size={13}
        color={active ? "#FFFFFF" : BrandColors.gray[700]}
      />
      <ThemedText
        style={[
          modePillStyles.text,
          { color: active ? "#FFFFFF" : BrandColors.gray[700] },
        ]}
      >
        {label}
      </ThemedText>
      {badgeCount !== undefined && badgeCount > 0 ? (
        <View
          style={[
            modePillStyles.badge,
            {
              backgroundColor: active
                ? "rgba(255,255,255,0.3)"
                : BrandColors.primary.gradientStart + "1F",
            },
          ]}
        >
          <ThemedText
            style={[
              modePillStyles.badgeText,
              {
                color: active ? "#FFFFFF" : BrandColors.primary.gradientStart,
              },
            ]}
          >
            {badgeCount}
          </ThemedText>
        </View>
      ) : null}
    </>
  );

  if (active) {
    return (
      <Pressable
        onPress={onPress}
        style={modePillStyles.buttonWrap}
        accessibilityRole="button"
        accessibilityLabel={`Show ${label} on map`}
        accessibilityState={{ selected: true }}
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={modePillStyles.buttonActive}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={modePillStyles.button}
      accessibilityRole="button"
      accessibilityLabel={`Show ${label} on map`}
      accessibilityState={{ selected: false }}
    >
      {content}
    </Pressable>
  );
}

const modePillStyles = StyleSheet.create({
  buttonWrap: {
    flex: 1,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  buttonActive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  text: {
    ...Typography.label,
    fontWeight: "800",
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    minWidth: 16,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const reducedMotion = useReducedMotion();

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

  // Pasop layer state — mode pill drives which layers render, tapped pin
  // opens the PasopPinSheet preview.
  const [mapMode, setMapMode] = useState<"routes" | "pasop" | "all">("routes");
  const [pasopReports, setPasopReports] = useState<PasopReport[]>([]);
  const [pasopPetitions, setPasopPetitions] = useState<string[]>([]);
  const [activePasop, setActivePasop] = useState<PasopReport | null>(null);
  const { user } = useAuth();

  const { data: locations = [] } = useLocations();
  const sheetHeight = useSharedValue(220);

  // Derive layer visibility from the current mode pill selection
  const pasopMode = mapMode === "pasop";
  const allMode = mapMode === "all";
  const routesMode = mapMode === "routes";
  const mapShowTransitRoutes = showTransitRoutes && (routesMode || allMode);
  const mapShowTransitRanks = true;
  const mapDimRanks = pasopMode;
  const mapShowPasopPins = pasopMode || allMode;
  const mapUserLatLng = userLocation
    ? {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
      }
    : null;

  // Tracks whether we've already played the initial zoom-in so the
  // animation only fires once per screen mount — otherwise any later
  // userLocation update (say, from a background GPS refresh) would
  // yank the camera back and interrupt the user.
  const hasZoomedToUserRef = useRef(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation(loc);
    })();
  }, []);

  // Initial zoom-in animation: once we have the user's coordinates AND
  // the map ref is ready, fly the camera from the default Gauteng view
  // down into their neighborhood. Small delay gives the map a chance to
  // mount its camera component before we call setCamera on it.
  useEffect(() => {
    if (hasZoomedToUserRef.current) return;
    if (!userLocation || !mapRef.current) return;

    const timeoutId = setTimeout(() => {
      mapRef.current?.animateToRegion?.({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      hasZoomedToUserRef.current = true;
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [userLocation]);

  // Refresh Pasop reports and the user's own petitions every time HomeScreen
  // is focused — covers coming back from PasopFeed/PasopReport so newly
  // filed hazards appear immediately.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [reports, petitions] = await Promise.all([
          getPasopReports(),
          getMyPetitions(),
        ]);
        setPasopReports(reports);
        setPasopPetitions(petitions);
      })();
    }, [])
  );

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

  const handleModeChange = useCallback(
    (mode: "routes" | "pasop" | "all") => {
      triggerHaptic("light");
      setMapMode(mode);
      // Clear any existing selection when flipping modes so the sheet and
      // panels don't fight with the new layer being shown.
      setSelectedRank(null);
      setSelectedRoute(null);
      setActivePasop(null);
    },
    []
  );

  const handlePasopPress = useCallback((report: PasopReport) => {
    triggerHaptic("medium");
    setActivePasop(report);
    setSelectedRank(null);
    setSelectedRoute(null);
  }, []);

  const handleClosePasopSheet = useCallback(() => {
    setActivePasop(null);
  }, []);

  const handlePasopPetition = useCallback(
    async (report: PasopReport) => {
      const petitionerId = user?.id || (await getDeviceId());
      const updated = await petitionPasopReport(report.id, petitionerId);
      if (updated) {
        setPasopReports((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
        await recordMyPetition(report.id);
        setPasopPetitions((prev) =>
          prev.includes(report.id) ? prev : [...prev, report.id]
        );
        setActivePasop(updated);
      }
    },
    [user]
  );

  const handleSeeAllPasop = useCallback(() => {
    setActivePasop(null);
    navigation.navigate("PasopFeed");
  }, [navigation]);

  const handleOpenPasopReport = useCallback(() => {
    triggerHaptic("medium");
    navigation.navigate("PasopReport");
  }, [navigation]);

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

  // Flies the map camera back to the user's current GPS fix. If we don't
  // have a location fix (permission denied, still acquiring), the button
  // is hidden entirely so it never becomes a dead tap.
  const handleRecenterMap = () => {
    if (!userLocation) return;
    triggerHaptic("light");
    mapRef.current?.flyTo?.(
      [userLocation.coords.longitude, userLocation.coords.latitude],
      15,
    );
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
      <FloatingHeader
        onSearchPress={() => {
          handleSearchFocus();
          toggleSheet(true);
        }}
      />

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
          showTransitRoutes={mapShowTransitRoutes}
          showTransitRanks={mapShowTransitRanks}
          dimTransitRanks={mapDimRanks}
          onRankSelect={handleRankSelect}
          onRouteSelect={handleRouteSelect}
          selectedRankId={selectedRank?.id || null}
          selectedRouteId={selectedRoute?.id || null}
          pasopReports={pasopReports}
          showPasopPins={mapShowPasopPins}
          onPasopPress={handlePasopPress}
        />

        {/* Pin banner — gradient-bordered card with rose CTA, replaces the
            old utilitarian green/grey button row */}
        {pinnedLocation ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
            style={[
              styles.pinBanner,
              {
                top: insets.top + 120,
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
                  <Feather name="plus" size={16} color="#FFFFFF" />
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
          topOffset={insets.top + 68}
        />

        {/* Map mode pill — flips between Routes / Pasop / All.
            Positioned below the FloatingHeader (ends at insets.top + 46)
            with a 26px breathing gap so the pill doesn't feel jammed
            against the search bar. */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(400)}
          style={[
            styles.modePill,
            {
              top: insets.top + 72,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <ModePillButton
            label="Routes"
            icon="map"
            active={routesMode}
            onPress={() => handleModeChange("routes")}
          />
          <ModePillButton
            label="Pasop"
            icon="alert-triangle"
            active={pasopMode}
            onPress={() => handleModeChange("pasop")}
            badgeCount={pasopReports.filter((r) => r.status === "active").length}
          />
          <ModePillButton
            label="All"
            icon="layers"
            active={allMode}
            onPress={() => handleModeChange("all")}
          />
        </Animated.View>

        {showTransitRoutes && !selectedRank && !selectedRoute && routesMode && (
          <TransitRouteLegend
            selectedRouteId={selectedRoute?.id || null}
            onRouteSelect={handleRouteSelect}
          />
        )}

        {/* Recenter-to-current-location floating button. Right-edge, sits
            above the collapsed nearby-ranks tray. Hidden while a rank or
            route detail overlay is up so it doesn't fight for attention,
            and hidden until we have a GPS fix so it can't be a dead tap. */}
        {userLocation && !selectedRank && !selectedRoute ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
            style={[
              styles.recenterFab,
              {
                bottom:
                  tabBarHeight +
                  220 +
                  Spacing.md +
                  (mapShowPasopPins ? 60 : 0),
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Pressable
              onPress={handleRecenterMap}
              accessibilityRole="button"
              accessibilityLabel="Recenter map on my location"
              style={styles.recenterFabInner}
              hitSlop={8}
            >
              <Feather
                name="navigation"
                size={20}
                color={BrandColors.primary.gradientStart}
              />
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Floating "+ Report" FAB — only visible when the Pasop layer is on */}
        {mapShowPasopPins ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
            style={[
              styles.pasopFab,
              { bottom: tabBarHeight + 220 + Spacing.md },
            ]}
          >
            <Pressable
              onPress={handleOpenPasopReport}
              accessibilityRole="button"
              accessibilityLabel="Report a hazard"
            >
              <LinearGradient
                colors={BrandColors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pasopFabInner}
              >
                <Feather name="plus" size={18} color="#FFFFFF" />
                <ThemedText style={styles.pasopFabText}>Report</ThemedText>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}
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

      {/* Floating info bubble for user-contributed taxi location pins.
          Shows beneath the top search bar so the tapped pin stays visible
          on the map, leaving the bottom sheet alone for the nearby-ranks
          list. Hidden whenever a transit rank or route is selected so
          only one selection chrome is on screen at a time. */}
      {selectedLocation && !selectedRank && !selectedRoute ? (
        <LocationInfoBubble
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onViewDetails={() => {
            const loc = selectedLocation;
            setSelectedLocation(null);
            handleLocationDetails(loc);
          }}
        />
      ) : null}

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
          <Pressable
            onPress={() => toggleSheet()}
            style={styles.sheetHandleWrap}
            accessibilityRole="button"
            accessibilityLabel={isSheetExpanded ? "Collapse rank list" : "Expand rank list"}
          >
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
            <View style={styles.sheetHeaderActions}>
              <Pressable
                onPress={handleAddLocation}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add a new taxi rank or stop"
                style={[
                  styles.sheetAddRankButton,
                  { backgroundColor: BrandColors.primary.gradientStart + "15" },
                ]}
              >
                <Feather
                  name="plus"
                  size={16}
                  color={BrandColors.primary.gradientStart}
                />
              </Pressable>
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

          <ScrollView
            style={styles.ranksList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: Spacing["3xl"] }}
            keyboardShouldPersistTaps="handled"
          >
            {filteredLocations.length === 0 ? (
              <Animated.View
                entering={reducedMotion ? undefined : FadeIn.duration(300)}
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
                    entering={
                      reducedMotion
                        ? undefined
                        : FadeInDown.duration(300).delay(Math.min(index * 30, 300))
                    }
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

      {/* Pasop pin preview — slides up over the map on pin tap */}
      <PasopPinSheet
        report={activePasop}
        userLocation={mapUserLatLng}
        hasPetitioned={
          activePasop ? pasopPetitions.includes(activePasop.id) : false
        }
        onClose={handleClosePasopSheet}
        onPetition={handlePasopPetition}
        onSeeAll={handleSeeAllPasop}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { flex: 1, position: "relative" },

  modePill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    padding: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
  },
  pasopFab: {
    position: "absolute",
    right: Spacing.lg,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 5,
  },
  recenterFab: {
    position: "absolute",
    right: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 5,
  },
  recenterFabInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sheetAddRankButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pasopFabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  pasopFabText: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "800",
  },

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

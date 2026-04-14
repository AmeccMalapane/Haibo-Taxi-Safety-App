import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ScrollView,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MAPBOX_STYLES } from "@/constants/mapbox";
import { RouteWaypoint, ROUTE_COLORS, generateId } from "@/data/communityRoutes";

type DrawingMode = "stop" | "waypoint";
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TOP_BAR_HEIGHT = 56;
const TOOLBAR_BUTTON_SIZE = 44;
const MODE_TOGGLE_HEIGHT = 50;
const COUNTER_BADGE_HEIGHT = 36;

export default function RouteDrawingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("stop");
  const [routeColor, setRouteColor] = useState(ROUTE_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingWaypointId, setEditingWaypointId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(
    null
  );

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {
        // location is best-effort; map falls back to default Joburg view
      }
    })();
  }, []);

  useEffect(() => {
    if (showInstructions) {
      const timer = setTimeout(() => setShowInstructions(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showInstructions]);

  const stops = waypoints.filter((w) => w.isStop);
  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  const handleMapPress = useCallback(
    (event: any) => {
      let lat: number;
      let lng: number;

      if (event?.geometry?.coordinates) {
        [lng, lat] = event.geometry.coordinates;
      } else if (event?.nativeEvent?.coordinate) {
        lat = event.nativeEvent.coordinate.latitude;
        lng = event.nativeEvent.coordinate.longitude;
      } else if (event?.lngLat) {
        lat = event.lngLat.lat;
        lng = event.lngLat.lng;
      } else {
        return;
      }

      if (Platform.OS !== "web") {
        Haptics.impactAsync(
          drawingMode === "stop"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light
        );
      }

      const newWaypoint: RouteWaypoint = {
        id: generateId(),
        latitude: lat,
        longitude: lng,
        name:
          drawingMode === "stop"
            ? `Stop ${waypoints.filter((w) => w.isStop).length + 1}`
            : "",
        isStop: drawingMode === "stop",
        order: waypoints.length,
      };

      setWaypoints((prev) => [...prev, newWaypoint]);

      if (drawingMode === "stop") {
        setEditingWaypointId(newWaypoint.id);
        setEditingName(newWaypoint.name);
      }
    },
    [drawingMode, waypoints]
  );

  const handleSaveWaypointName = useCallback(() => {
    if (!editingWaypointId) return;
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === editingWaypointId ? { ...w, name: editingName.trim() || w.name } : w
      )
    );
    setEditingWaypointId(null);
    setEditingName("");
  }, [editingWaypointId, editingName]);

  const handleRemoveWaypoint = useCallback((id: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setWaypoints((prev) => {
      const filtered = prev.filter((w) => w.id !== id);
      return filtered.map((w, i) => ({ ...w, order: i }));
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert("Clear route", "Remove all stops and waypoints?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          setWaypoints([]);
        },
      },
    ]);
  }, []);

  const handleSelectMode = useCallback((mode: DrawingMode) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setDrawingMode(mode);
  }, []);

  const handleSelectColor = useCallback((color: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setRouteColor(color);
    setShowColorPicker(false);
  }, []);

  const handleContinue = useCallback(() => {
    if (stops.length < 2) {
      Alert.alert(
        "Need more stops",
        "Add at least 2 stops (origin and destination) to define a route."
      );
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    navigation.navigate("RouteSubmission", {
      waypoints,
      color: routeColor,
    });
  }, [stops.length, waypoints, routeColor, navigation]);

  const routeCoordinates = waypoints.map((w) => [w.longitude, w.latitude]);

  const routeLineGeoJSON = {
    type: "FeatureCollection" as const,
    features:
      routeCoordinates.length >= 2
        ? [
            {
              type: "Feature" as const,
              properties: { color: routeColor },
              geometry: {
                type: "LineString" as const,
                coordinates: routeCoordinates,
              },
            },
          ]
        : [],
  };

  const waypointsGeoJSON = {
    type: "FeatureCollection" as const,
    features: waypoints.map((w) => ({
      type: "Feature" as const,
      id: w.id,
      properties: {
        id: w.id,
        name: w.name,
        isStop: w.isStop,
        order: w.order,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [w.longitude, w.latitude],
      },
    })),
  };

  const renderNativeMap = () => {
    try {
      const Mapbox = require("@rnmapbox/maps");
      const {
        MapView,
        Camera,
        ShapeSource,
        CircleLayer,
        SymbolLayer,
        LineLayer,
        LocationPuck,
      } = Mapbox;

      return (
        <MapView
          style={StyleSheet.absoluteFill}
          styleURL={isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light}
          onPress={handleMapPress}
          compassEnabled
          scaleBarEnabled={false}
        >
          <Camera
            defaultSettings={{
              centerCoordinate: userLocation
                ? [userLocation.lng, userLocation.lat]
                : [28.0473, -26.2041],
              zoomLevel: userLocation ? 12 : 9,
            }}
          />
          <LocationPuck
            pulsing={{ isEnabled: true, color: BrandColors.primary.gradientStart }}
          />

          {routeCoordinates.length >= 2 && (
            <ShapeSource id="route-line" shape={routeLineGeoJSON}>
              <LineLayer
                id="route-line-layer"
                style={{
                  lineColor: routeColor,
                  lineWidth: 4,
                  lineOpacity: 0.85,
                  lineCap: "round",
                  lineJoin: "round",
                  lineDasharray: [2, 1],
                }}
              />
            </ShapeSource>
          )}

          {waypoints.length > 0 && (
            <ShapeSource id="waypoints" shape={waypointsGeoJSON}>
              <CircleLayer
                id="stop-markers"
                filter={["==", ["get", "isStop"], true]}
                style={{
                  circleRadius: 10,
                  circleColor: routeColor,
                  circleStrokeColor: "#FFFFFF",
                  circleStrokeWidth: 3,
                }}
              />
              <CircleLayer
                id="waypoint-markers"
                filter={["==", ["get", "isStop"], false]}
                style={{
                  circleRadius: 5,
                  circleColor: routeColor,
                  circleStrokeColor: "#FFFFFF",
                  circleStrokeWidth: 2,
                  circleOpacity: 0.7,
                }}
              />
              <SymbolLayer
                id="stop-labels"
                filter={["==", ["get", "isStop"], true]}
                style={{
                  textField: ["get", "name"],
                  textSize: 12,
                  textColor: isDark ? "#FFFFFF" : "#212121",
                  textHaloColor: isDark ? "#000000" : "#FFFFFF",
                  textHaloWidth: 1.5,
                  textOffset: [0, 1.5],
                  textAnchor: "top",
                  textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
                }}
              />
            </ShapeSource>
          )}
        </MapView>
      );
    } catch {
      return renderWebMap();
    }
  };

  const renderWebMap = () => (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: isDark ? "#1a1a2e" : BrandColors.gray[100] },
      ]}
    >
      <View style={styles.webMapPlaceholder}>
        <Feather name="map" size={48} color={BrandColors.gray[600]} />
        <ThemedText style={styles.webMapText}>
          Map drawing is optimised for mobile.{"\n"}Use Expo Go for the full experience.
        </ThemedText>
      </View>
    </View>
  );

  const bottomBarHeight =
    (stops.length > 0 ? 56 : 0) + 64 + insets.bottom;
  const modeToggleBottom = bottomBarHeight + Spacing.md;
  const counterBadgeBottom = modeToggleBottom + MODE_TOGGLE_HEIGHT + Spacing.sm;
  const topBarBottom = insets.top + TOP_BAR_HEIGHT + Spacing.sm;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.mapContainer}>
        {Platform.OS === "web" ? renderWebMap() : renderNativeMap()}

        <LinearGradient
          colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0)"]}
          style={[styles.topBarGradient, { paddingTop: insets.top + Spacing.sm }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.glassButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.topBarBadge}>
            <Feather name="git-branch" size={16} color="#FFFFFF" />
            <ThemedText style={styles.topBarBadgeText}>Draw route</ThemedText>
          </View>
          <View style={styles.glassButton} />
        </LinearGradient>

        {showInstructions ? (
          <Pressable
            style={[styles.instructionsOverlay, { top: topBarBottom }]}
            onPress={() => setShowInstructions(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss instructions"
          >
            <View style={[styles.instructionsCard, { backgroundColor: cardSurface }]}>
              <View style={styles.instructionsIconWrap}>
                <Feather
                  name="info"
                  size={18}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.instructionsTitle}>
                  How to draw a route
                </ThemedText>
                <ThemedText style={styles.instructionsText}>
                  1. Tap the map to place stops{"\n"}
                  2. Switch to "Waypoint" mode for curve points{"\n"}
                  3. Name each stop when prompted{"\n"}
                  4. Tap "Continue" when done
                </ThemedText>
              </View>
              <Feather name="x" size={16} color={BrandColors.gray[600]} />
            </View>
          </Pressable>
        ) : null}

        <View style={[styles.topToolbar, { top: topBarBottom }]}>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: cardSurface }]}
            onPress={handleUndo}
            disabled={waypoints.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Undo last waypoint"
            accessibilityState={{ disabled: waypoints.length === 0 }}
          >
            <Feather
              name="corner-up-left"
              size={20}
              color={waypoints.length === 0 ? BrandColors.gray[600] : BrandColors.gray[700]}
            />
          </Pressable>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: cardSurface }]}
            onPress={handleClearAll}
            disabled={waypoints.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Clear all waypoints"
            accessibilityState={{ disabled: waypoints.length === 0 }}
          >
            <Feather
              name="trash-2"
              size={20}
              color={
                waypoints.length === 0
                  ? BrandColors.gray[600]
                  : BrandColors.status.emergency
              }
            />
          </Pressable>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: cardSurface }]}
            onPress={() => setShowColorPicker(!showColorPicker)}
            accessibilityRole="button"
            accessibilityLabel="Change route colour"
            accessibilityState={{ expanded: showColorPicker }}
          >
            <View style={[styles.colorDot, { backgroundColor: routeColor }]} />
          </Pressable>
        </View>

        {showColorPicker ? (
          <View
            style={[
              styles.colorPicker,
              {
                backgroundColor: cardSurface,
                top: topBarBottom + 3 * (TOOLBAR_BUTTON_SIZE + 8),
              },
            ]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ROUTE_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    routeColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => handleSelectColor(color)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Route colour ${color}`}
                  accessibilityState={{ selected: routeColor === color }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View
          style={[
            styles.modeToggle,
            { backgroundColor: cardSurface, bottom: modeToggleBottom },
          ]}
        >
          <Pressable
            style={[
              styles.modeButton,
              drawingMode === "stop" && { backgroundColor: routeColor },
            ]}
            onPress={() => handleSelectMode("stop")}
          >
            <Feather
              name="map-pin"
              size={16}
              color={drawingMode === "stop" ? "#FFFFFF" : BrandColors.gray[700]}
            />
            <ThemedText
              style={[
                styles.modeButtonText,
                drawingMode === "stop" && { color: "#FFFFFF" },
              ]}
            >
              Stop
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.modeButton,
              drawingMode === "waypoint" && { backgroundColor: routeColor },
            ]}
            onPress={() => handleSelectMode("waypoint")}
          >
            <Feather
              name="navigation"
              size={16}
              color={drawingMode === "waypoint" ? "#FFFFFF" : BrandColors.gray[700]}
            />
            <ThemedText
              style={[
                styles.modeButtonText,
                drawingMode === "waypoint" && { color: "#FFFFFF" },
              ]}
            >
              Waypoint
            </ThemedText>
          </Pressable>
        </View>

        <View
          style={[
            styles.counterBadge,
            { backgroundColor: cardSurface, bottom: counterBadgeBottom },
          ]}
        >
          <View style={[styles.counterDot, { backgroundColor: routeColor }]} />
          <ThemedText style={styles.counterText}>
            {stops.length} stop{stops.length !== 1 ? "s" : ""} ·{" "}
            {waypoints.length - stops.length} waypoint
            {waypoints.length - stops.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>
      </View>

      {editingWaypointId ? (
        <View
          style={[
            styles.nameEditor,
            { backgroundColor: cardSurface, borderTopColor: BrandColors.gray[100] },
          ]}
        >
          <ThemedText style={styles.nameEditorLabel}>Name this stop</ThemedText>
          <View style={styles.nameEditorRow}>
            <View
              style={[
                styles.nameInputWrap,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <Feather name="map-pin" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={[styles.nameInput, { color: theme.text }]}
                value={editingName}
                onChangeText={setEditingName}
                placeholder="e.g. Bree Taxi Rank"
                placeholderTextColor={BrandColors.gray[500]}
                autoFocus
                onSubmitEditing={handleSaveWaypointName}
              />
            </View>
            <Pressable
              style={[styles.nameButton, { backgroundColor: routeColor }]}
              onPress={handleSaveWaypointName}
              accessibilityRole="button"
              accessibilityLabel="Save stop name"
            >
              <Feather name="check" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: cardSurface,
            paddingBottom: insets.bottom + Spacing.sm,
            borderTopColor: BrandColors.gray[100],
          },
        ]}
      >
        {stops.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stopList}
            contentContainerStyle={styles.stopListContent}
          >
            {stops.map((stop, index) => (
              <View key={stop.id} style={styles.stopChipRow}>
                <View
                  style={[
                    styles.stopChip,
                    {
                      backgroundColor: `${routeColor}10`,
                      borderColor: routeColor,
                    },
                  ]}
                >
                  <View style={[styles.stopChipDot, { backgroundColor: routeColor }]}>
                    <ThemedText style={styles.stopChipNumber}>{index + 1}</ThemedText>
                  </View>
                  <ThemedText style={styles.stopChipText} numberOfLines={1}>
                    {stop.name}
                  </ThemedText>
                  <Pressable
                    onPress={() => handleRemoveWaypoint(stop.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove stop ${stop.name}`}
                  >
                    <Feather name="x" size={16} color={BrandColors.gray[600]} />
                  </Pressable>
                </View>
                {index < stops.length - 1 ? (
                  <Feather
                    name="arrow-right"
                    size={16}
                    color={BrandColors.gray[600]}
                  />
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.bottomActions}>
          <Pressable
            style={[
              styles.cancelBtn,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: BrandColors.gray[200],
              },
            ]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.continueBtn,
              {
                backgroundColor:
                  stops.length >= 2 ? routeColor : BrandColors.gray[300],
                opacity: pressed && stops.length >= 2 ? 0.92 : 1,
              },
            ]}
            onPress={handleContinue}
            disabled={stops.length < 2}
          >
            <ThemedText style={styles.continueBtnText}>Continue</ThemedText>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  webMapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  webMapText: {
    ...Typography.small,
    textAlign: "center",
    color: BrandColors.gray[600],
  },
  topBarGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  topBarBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  instructionsOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  instructionsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  instructionsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  instructionsTitle: {
    ...Typography.small,
    fontWeight: "800",
    marginBottom: 4,
  },
  instructionsText: {
    ...Typography.label,
    color: BrandColors.gray[600],
    lineHeight: 18,
  },
  topToolbar: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "column",
    gap: 8,
  },
  toolbarButton: {
    width: TOOLBAR_BUTTON_SIZE,
    height: TOOLBAR_BUTTON_SIZE,
    borderRadius: TOOLBAR_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  colorPicker: {
    position: "absolute",
    right: Spacing.lg,
    padding: 8,
    borderRadius: BorderRadius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    maxWidth: 250,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginHorizontal: 3,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.15 }],
  },
  modeToggle: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  modeButtonText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[700],
  },
  counterBadge: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    gap: 6,
    height: COUNTER_BADGE_HEIGHT,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  counterDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  counterText: {
    ...Typography.label,
    fontWeight: "700",
  },
  nameEditor: {
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  nameEditorLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  nameEditorRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  nameInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  nameInput: {
    ...Typography.body,
    flex: 1,
    height: 44,
  },
  nameButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  stopList: {
    maxHeight: 48,
    marginBottom: Spacing.sm,
  },
  stopListContent: {
    gap: 8,
    paddingHorizontal: Spacing.lg,
  },
  stopChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stopChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 8,
    paddingLeft: 4,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  stopChipDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stopChipNumber: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  stopChipText: {
    ...Typography.label,
    fontWeight: "700",
    maxWidth: 100,
  },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    paddingTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelBtnText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[700],
  },
  continueBtn: {
    flex: 2,
    height: 48,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  continueBtnText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "800",
  },
});

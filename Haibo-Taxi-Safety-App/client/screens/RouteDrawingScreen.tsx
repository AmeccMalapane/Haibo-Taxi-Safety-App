/**
 * RouteDrawingScreen — MetroDreamin'-style interactive route drawing
 * Users tap on the Mapbox map to place stops and waypoints,
 * building a taxi route visually before submitting metadata.
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLES } from "@/constants/mapbox";
import {
  RouteWaypoint,
  ROUTE_COLORS,
  generateId,
} from "@/data/communityRoutes";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type DrawingMode = "stop" | "waypoint";

export default function RouteDrawingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Route state
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("stop");
  const [routeColor, setRouteColor] = useState(ROUTE_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingWaypointId, setEditingWaypointId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {}
    })();
  }, []);

  // Dismiss instructions after 5 seconds
  useEffect(() => {
    if (showInstructions) {
      const timer = setTimeout(() => setShowInstructions(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showInstructions]);

  const handleMapPress = useCallback(
    (event: any) => {
      let lat: number, lng: number;

      // Handle different event formats (native vs web)
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
        try {
          const Haptics = require("expo-haptics");
          Haptics.impactAsync(
            drawingMode === "stop"
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light
          );
        } catch {}
      }

      const newWaypoint: RouteWaypoint = {
        id: generateId(),
        latitude: lat,
        longitude: lng,
        name: drawingMode === "stop" ? `Stop ${waypoints.filter((w) => w.isStop).length + 1}` : "",
        isStop: drawingMode === "stop",
        order: waypoints.length,
      };

      setWaypoints((prev) => [...prev, newWaypoint]);

      // If it's a stop, prompt for name
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
    setWaypoints((prev) => {
      const filtered = prev.filter((w) => w.id !== id);
      return filtered.map((w, i) => ({ ...w, order: i }));
    });
  }, []);

  const handleUndo = useCallback(() => {
    setWaypoints((prev) => prev.slice(0, -1));
    if (Platform.OS !== "web") {
      try {
        const Haptics = require("expo-haptics");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert("Clear Route", "Remove all stops and waypoints?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => setWaypoints([]),
      },
    ]);
  }, []);

  const handleContinue = useCallback(() => {
    const stops = waypoints.filter((w) => w.isStop);
    if (stops.length < 2) {
      Alert.alert("Need More Stops", "Please add at least 2 stops (origin and destination) to define a route.");
      return;
    }

    // Navigate to the metadata form with the drawn route data
    navigation.navigate("RouteSubmission" as any, {
      waypoints,
      color: routeColor,
    });
  }, [waypoints, routeColor, navigation]);

  const stops = waypoints.filter((w) => w.isStop);
  const routeCoordinates = waypoints.map((w) => [w.longitude, w.latitude]);

  // Build GeoJSON for the route line
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

  // Build GeoJSON for waypoints
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

  // Render the Mapbox map (native)
  const renderNativeMap = () => {
    try {
      const Mapbox = require("@rnmapbox/maps");
      const { MapView, Camera, ShapeSource, CircleLayer, SymbolLayer, LineLayer, LocationPuck } =
        Mapbox;

      return (
        <MapView
          ref={mapRef}
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
          <LocationPuck pulsing={{ isEnabled: true, color: BrandColors.primary.red }} />

          {/* Route line */}
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

          {/* Waypoints */}
          {waypoints.length > 0 && (
            <ShapeSource id="waypoints" shape={waypointsGeoJSON}>
              {/* Stop markers (larger) */}
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
              {/* Waypoint markers (smaller) */}
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
              {/* Stop labels */}
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

  // Render the Mapbox map (web fallback)
  const renderWebMap = () => {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#1a1a2e" : "#e8f4f8" }]}>
        <View style={styles.webMapPlaceholder}>
          <Feather name="map" size={48} color={BrandColors.gray[400]} />
          <ThemedText style={styles.webMapText}>
            Map drawing is optimized for mobile.{"\n"}Use Expo Go for the full experience.
          </ThemedText>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Map */}
      <View style={styles.mapContainer}>
        {Platform.OS === "web" ? renderWebMap() : renderNativeMap()}

        {/* Instructions overlay */}
        {showInstructions && (
          <Pressable
            style={styles.instructionsOverlay}
            onPress={() => setShowInstructions(false)}
          >
            <View style={[styles.instructionsCard, { backgroundColor: theme.surface }]}>
              <Feather name="info" size={20} color={BrandColors.primary.blue} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.instructionsTitle}>How to draw a route</ThemedText>
                <ThemedText style={[styles.instructionsText, { color: theme.textSecondary }]}>
                  1. Tap the map to place stops{"\n"}
                  2. Use "Waypoint" mode for curve points{"\n"}
                  3. Name each stop when prompted{"\n"}
                  4. Tap "Continue" when done
                </ThemedText>
              </View>
              <Feather name="x" size={16} color={theme.textSecondary} />
            </View>
          </Pressable>
        )}

        {/* Top toolbar */}
        <View style={[styles.topToolbar, { top: insets.top + 50 }]}>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: theme.surface }]}
            onPress={handleUndo}
            disabled={waypoints.length === 0}
          >
            <Feather
              name="corner-up-left"
              size={20}
              color={waypoints.length === 0 ? BrandColors.gray[400] : theme.text}
            />
          </Pressable>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: theme.surface }]}
            onPress={handleClearAll}
            disabled={waypoints.length === 0}
          >
            <Feather
              name="trash-2"
              size={20}
              color={waypoints.length === 0 ? BrandColors.gray[400] : BrandColors.status.emergency}
            />
          </Pressable>
          <Pressable
            style={[styles.toolbarButton, { backgroundColor: theme.surface }]}
            onPress={() => setShowColorPicker(!showColorPicker)}
          >
            <View style={[styles.colorDot, { backgroundColor: routeColor }]} />
          </Pressable>
        </View>

        {/* Color picker dropdown */}
        {showColorPicker && (
          <View style={[styles.colorPicker, { backgroundColor: theme.surface, top: insets.top + 105 }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {ROUTE_COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    routeColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => {
                    setRouteColor(color);
                    setShowColorPicker(false);
                  }}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Drawing mode toggle */}
        <View style={[styles.modeToggle, { backgroundColor: theme.surface, bottom: 180 }]}>
          <Pressable
            style={[
              styles.modeButton,
              drawingMode === "stop" && { backgroundColor: routeColor },
            ]}
            onPress={() => setDrawingMode("stop")}
          >
            <Feather
              name="map-pin"
              size={18}
              color={drawingMode === "stop" ? "#FFFFFF" : theme.text}
            />
            <Text
              style={[
                styles.modeButtonText,
                { color: drawingMode === "stop" ? "#FFFFFF" : theme.text },
              ]}
            >
              Stop
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.modeButton,
              drawingMode === "waypoint" && { backgroundColor: routeColor },
            ]}
            onPress={() => setDrawingMode("waypoint")}
          >
            <Feather
              name="navigation"
              size={18}
              color={drawingMode === "waypoint" ? "#FFFFFF" : theme.text}
            />
            <Text
              style={[
                styles.modeButtonText,
                { color: drawingMode === "waypoint" ? "#FFFFFF" : theme.text },
              ]}
            >
              Waypoint
            </Text>
          </Pressable>
        </View>

        {/* Stop counter badge */}
        <View style={[styles.counterBadge, { backgroundColor: theme.surface, bottom: 240 }]}>
          <View style={[styles.counterDot, { backgroundColor: routeColor }]} />
          <ThemedText style={styles.counterText}>
            {stops.length} stop{stops.length !== 1 ? "s" : ""} · {waypoints.length - stops.length} waypoint
            {waypoints.length - stops.length !== 1 ? "s" : ""}
          </ThemedText>
        </View>
      </View>

      {/* Waypoint name editor */}
      {editingWaypointId && (
        <View style={[styles.nameEditor, { backgroundColor: theme.surface }]}>
          <ThemedText style={styles.nameEditorLabel}>Name this stop:</ThemedText>
          <View style={styles.nameEditorRow}>
            <TextInput
              style={[
                styles.nameInput,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="e.g., Bree Taxi Rank"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              onSubmitEditing={handleSaveWaypointName}
            />
            <Pressable
              style={[styles.nameButton, { backgroundColor: routeColor }]}
              onPress={handleSaveWaypointName}
            >
              <Feather name="check" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Bottom bar — Stop list + Continue */}
      <View style={[styles.bottomBar, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 8 }]}>
        {stops.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stopList}
            contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.lg }}
          >
            {stops.map((stop, index) => (
              <View key={stop.id} style={styles.stopChipRow}>
                <View style={[styles.stopChip, { backgroundColor: `${routeColor}15`, borderColor: routeColor }]}>
                  <View style={[styles.stopChipDot, { backgroundColor: routeColor }]}>
                    <Text style={styles.stopChipNumber}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.stopChipText, { color: theme.text }]} numberOfLines={1}>
                    {stop.name}
                  </Text>
                  <Pressable onPress={() => handleRemoveWaypoint(stop.id)} hitSlop={8}>
                    <Feather name="x" size={14} color={BrandColors.gray[500]} />
                  </Pressable>
                </View>
                {index < stops.length - 1 && (
                  <Feather name="arrow-right" size={14} color={BrandColors.gray[400]} />
                )}
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.bottomActions}>
          <Pressable
            style={[styles.cancelBtn, { borderColor: theme.border }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={{ fontWeight: "600" }}>Cancel</ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.continueBtn,
              {
                backgroundColor: stops.length >= 2 ? routeColor : BrandColors.gray[400],
              },
            ]}
            onPress={handleContinue}
            disabled={stops.length < 2}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapContainer: { flex: 1, position: "relative" },
  webMapPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  webMapText: { textAlign: "center", color: "#757575", fontSize: 14 },
  // Instructions
  instructionsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-start",
    paddingTop: 110,
    paddingHorizontal: Spacing.lg,
  },
  instructionsCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  instructionsTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  instructionsText: { fontSize: 13, lineHeight: 20 },
  // Top toolbar
  topToolbar: {
    position: "absolute",
    right: Spacing.lg,
    flexDirection: "column",
    gap: 8,
  },
  toolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#FFFFFF" },
  // Color picker
  colorPicker: {
    position: "absolute",
    right: Spacing.lg,
    padding: 8,
    borderRadius: BorderRadius.md,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
  // Mode toggle
  modeToggle: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  modeButtonText: { fontSize: 13, fontWeight: "600" },
  // Counter badge
  counterBadge: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    gap: 6,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  counterDot: { width: 10, height: 10, borderRadius: 5 },
  counterText: { fontSize: 12, fontWeight: "600" },
  // Name editor
  nameEditor: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  nameEditorLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  nameEditorRow: { flexDirection: "row", gap: 8 },
  nameInput: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  nameButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  // Bottom bar
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
    paddingTop: 8,
  },
  stopList: { maxHeight: 48, marginBottom: 8 },
  stopChipRow: { flexDirection: "row", alignItems: "center", gap: 4 },
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
  stopChipNumber: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  stopChipText: { fontSize: 13, fontWeight: "500", maxWidth: 100 },
  bottomActions: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: 10,
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
  continueBtn: {
    flex: 2,
    height: 48,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

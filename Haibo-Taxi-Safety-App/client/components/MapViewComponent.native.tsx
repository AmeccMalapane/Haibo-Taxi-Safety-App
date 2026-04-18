import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Platform, Pressable } from "react-native";
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  LineLayer,
  LocationPuck,
  setAccessToken,
} from "@rnmapbox/maps";
import { Feather } from "@expo/vector-icons";
import { BrandColors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLES, DEFAULT_CAMERA, ZOOM_LEVELS } from "@/constants/mapbox";
import { RANKS, ROUTES, STATUS_CONFIG, GAUTENG_CENTER } from "@/data/mapbox_transit_data";
import type { TaxiLocation, LocationType, TrafficIncident, IncidentType } from "@/lib/types";
import type { MapboxTaxiRank, MapboxTaxiRoute } from "@/data/mapbox_transit_data";
import { PasopReport, PASOP_CATEGORIES, isReportActive } from "@/data/pasopReports";
import { snapRoutesInBatches } from "@/lib/snapRouteToRoads";

// Set access token before any map renders
setAccessToken(MAPBOX_ACCESS_TOKEN);

interface MapViewComponentProps {
  onLocationPress?: (location: TaxiLocation) => void;
  onLongPress?: (event: { coordinate: { latitude: number; longitude: number } }) => void;
  locations?: TaxiLocation[];
  ranks?: any[];
  stops?: any[];
  initialRegion?: any;
  isDark?: boolean;
  mapRef?: any;
  showUserLocation?: boolean;
  showsTraffic?: boolean;
  showsIncidents?: boolean;
  incidents?: TrafficIncident[];
  onIncidentPress?: (incident: TrafficIncident) => void;
  pinnedLocation?: { latitude: number; longitude: number } | null;
  onPinnedMarkerPress?: () => void;
  // New Mapbox-specific props
  showTransitRoutes?: boolean;
  showTransitRanks?: boolean;
  dimTransitRanks?: boolean;
  onRankSelect?: (rank: MapboxTaxiRank | null) => void;
  onRouteSelect?: (route: MapboxTaxiRoute | null) => void;
  selectedRankId?: string | null;
  selectedRouteId?: string | null;
  // Pasop hazard layer
  pasopReports?: PasopReport[];
  showPasopPins?: boolean;
  onPasopPress?: (report: PasopReport) => void;
}

// Convert locations to GeoJSON FeatureCollection
function locationsToGeoJSON(locations: TaxiLocation[]) {
  return {
    type: "FeatureCollection" as const,
    features: locations.map((loc) => ({
      type: "Feature" as const,
      id: loc.id,
      properties: {
        id: loc.id,
        name: loc.name,
        type: loc.type,
        address: loc.address || "",
        isVerified: loc.verificationStatus === "verified",
        isActive: loc.isActive,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [loc.longitude, loc.latitude],
      },
    })),
  };
}

// Convert transit ranks to GeoJSON
function ranksToGeoJSON(ranks: MapboxTaxiRank[]) {
  return {
    type: "FeatureCollection" as const,
    features: ranks.map((rank) => ({
      type: "Feature" as const,
      id: rank.id,
      properties: {
        id: rank.id,
        name: rank.name,
        status: rank.status,
        waitTime: rank.waitTime,
        capacity: rank.capacity,
        routes: rank.routes,
        description: rank.description,
        color: STATUS_CONFIG[rank.status].color,
        label: STATUS_CONFIG[rank.status].label,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [rank.lng, rank.lat],
      },
    })),
  };
}

// Convert transit routes to GeoJSON
function routesToGeoJSON(routes: MapboxTaxiRoute[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.map((route) => ({
      type: "Feature" as const,
      id: route.id,
      properties: {
        id: route.id,
        from: route.from,
        to: route.to,
        color: route.color,
        fare: route.fare,
        distance: route.distance,
        duration: route.duration,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: route.coordinates,
      },
    })),
  };
}

// Convert incidents to GeoJSON
function incidentsToGeoJSON(incidents: TrafficIncident[]) {
  const incidentColors: Record<IncidentType, string> = {
    accident: "#E74C3C",
    construction: BrandColors.secondary.orange,
    hazard: "#F1C40F",
    congestion: "#7F8C8D",
    police: BrandColors.primary.blue,
    other: "#95A5A6",
  };

  return {
    type: "FeatureCollection" as const,
    features: incidents.map((incident) => ({
      type: "Feature" as const,
      id: incident.id,
      properties: {
        id: incident.id,
        type: incident.type,
        description: incident.description,
        severity: incident.severity,
        color: incidentColors[incident.type] || "#95A5A6",
      },
      geometry: {
        type: "Point" as const,
        coordinates: [incident.longitude, incident.latitude],
      },
    })),
  };
}

// Convert Pasop reports to GeoJSON
// Each feature carries its category color, petition count, and an age-based
// opacity so fading pins tell the user the report is losing relevance.
function pasopToGeoJSON(reports: PasopReport[]) {
  const now = Date.now();
  return {
    type: "FeatureCollection" as const,
    features: reports.filter(isReportActive).map((r) => {
      const cat = PASOP_CATEGORIES[r.category];
      const ttlMs = cat.ttlHours * 60 * 60 * 1000;
      const age = now - r.createdAt;
      const ageRatio = Math.max(0, Math.min(1, age / ttlMs));
      // Opacity: 1.0 fresh → 0.4 near-expired
      const opacity = Math.max(0.4, 1 - ageRatio * 0.6);
      return {
        type: "Feature" as const,
        id: r.id,
        properties: {
          id: r.id,
          category: r.category,
          label: cat.label,
          color: cat.color,
          severity: cat.severity,
          petitionCount: r.petitionCount,
          opacity,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [r.longitude, r.latitude],
        },
      };
    }),
  };
}

// Pinned location GeoJSON
function pinnedToGeoJSON(pinnedLocation: { latitude: number; longitude: number }) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        id: "pinned",
        properties: { id: "pinned" },
        geometry: {
          type: "Point" as const,
          coordinates: [pinnedLocation.longitude, pinnedLocation.latitude],
        },
      },
    ],
  };
}

export function MapViewComponent({
  onLocationPress,
  onLongPress,
  locations = [],
  isDark = false,
  showUserLocation = true,
  showsTraffic = false,
  showsIncidents = false,
  incidents = [],
  onIncidentPress,
  pinnedLocation = null,
  onPinnedMarkerPress,
  showTransitRoutes = true,
  showTransitRanks,
  dimTransitRanks = false,
  onRankSelect,
  onRouteSelect,
  selectedRankId,
  selectedRouteId,
  pasopReports = [],
  showPasopPins = false,
  onPasopPress,
  mapRef,
}: MapViewComponentProps) {
  const ranksVisible = showTransitRanks ?? showTransitRoutes;
  const ranksOpacity = dimTransitRanks ? 0.4 : 1;
  const cameraRef = useRef<Camera>(null);
  const mapViewRef = useRef<MapView>(null);

  // Expose camera methods via mapRef for backward compatibility.
  //
  // The previous version guarded with `if (cameraRef.current)` and
  // depended only on `[mapRef]` — a stable ref identity that never
  // changes. If the effect ran before <Camera ref={cameraRef} /> had
  // attached (a race common on cold-start Android), the methods were
  // never installed and `mapRef.current?.animateToRegion?.()` silently
  // no-op'd for the lifetime of the screen. That's why the top-right
  // crosshair button read as "dead" while the bottom-right recenter
  // FAB worked — they shared the exact same mechanism but the crosshair
  // happened to lose the race. Install the methods unconditionally;
  // each one already reads cameraRef.current at call time so a still-
  // mounting camera just no-ops that single tap instead of every tap.
  useEffect(() => {
    if (!mapRef) return;
    mapRef.current = {
      animateToRegion: (region: any) => {
        cameraRef.current?.setCamera({
          centerCoordinate: [region.longitude, region.latitude],
          zoomLevel: ZOOM_LEVELS.rank,
          animationDuration: 1500,
        });
      },
      flyTo: (center: [number, number], zoom?: number) => {
        cameraRef.current?.setCamera({
          centerCoordinate: center,
          zoomLevel: zoom || ZOOM_LEVELS.rank,
          pitch: 45,
          heading: Math.random() * 40 - 20,
          animationDuration: 2000,
        });
      },
      resetView: () => {
        cameraRef.current?.setCamera({
          centerCoordinate: DEFAULT_CAMERA.centerCoordinate,
          zoomLevel: DEFAULT_CAMERA.zoomLevel,
          pitch: DEFAULT_CAMERA.pitch,
          heading: DEFAULT_CAMERA.heading,
          animationDuration: 1500,
        });
      },
    };
  }, [mapRef]);

  // GeoJSON data
  const locationsGeoJSON = React.useMemo(() => locationsToGeoJSON(locations), [locations]);
  const ranksGeoJSON = React.useMemo(() => ranksToGeoJSON(RANKS), []);

  // Road-snapped route overrides. ROUTES ships with a synthetic sine
  // curve between origin and destination — visually distinct but cuts
  // straight across buildings. snapRoutesInBatches replaces each with
  // a Mapbox Directions result that actually follows roads, streaming
  // results into this map as they resolve so the polylines redraw
  // progressively without blocking the first paint.
  const [snappedCoords, setSnappedCoords] = useState<Record<string, [number, number][]>>({});
  useEffect(() => {
    let cancelled = false;
    snapRoutesInBatches(ROUTES, (routeId, snapped) => {
      if (cancelled) return;
      setSnappedCoords((prev) =>
        prev[routeId] === snapped ? prev : { ...prev, [routeId]: snapped },
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const routesGeoJSON = React.useMemo(() => {
    const snappedRoutes = ROUTES.map((route) =>
      snappedCoords[route.id]
        ? { ...route, coordinates: snappedCoords[route.id] }
        : route,
    );
    return routesToGeoJSON(snappedRoutes);
  }, [snappedCoords]);
  const incidentsGeoJSON = React.useMemo(() => incidentsToGeoJSON(incidents), [incidents]);
  const pasopGeoJSON = React.useMemo(
    () => pasopToGeoJSON(pasopReports),
    [pasopReports]
  );
  const pinnedGeoJSON = React.useMemo(
    () => (pinnedLocation ? pinnedToGeoJSON(pinnedLocation) : null),
    [pinnedLocation]
  );

  // Handle location marker press
  const handleLocationPress = useCallback(
    (event: any) => {
      if (!onLocationPress || !event.features?.length) return;
      const feature = event.features[0];
      const props = feature.properties;
      const [longitude, latitude] = feature.geometry.coordinates;

      // Find the matching location from the locations array
      const location = locations.find((l) => l.id === props.id);
      if (location) {
        onLocationPress(location);
        // Fly to the selected location
        cameraRef.current?.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel: ZOOM_LEVELS.rank,
          pitch: 45,
          heading: Math.random() * 40 - 20,
          animationDuration: 2000,
        });
      }
    },
    [onLocationPress, locations]
  );

  // Handle transit rank press
  const handleRankPress = useCallback(
    (event: any) => {
      if (!event.features?.length) return;
      const feature = event.features[0];
      const props = feature.properties;
      const [lng, lat] = feature.geometry.coordinates;

      const rank = RANKS.find((r) => r.id === props.id);
      if (rank) {
        onRankSelect?.(rank);
        // Cinematic fly-to
        cameraRef.current?.setCamera({
          centerCoordinate: [lng, lat],
          zoomLevel: ZOOM_LEVELS.rank,
          pitch: 45,
          heading: Math.random() * 40 - 20,
          animationDuration: 2000,
        });
      }
    },
    [onRankSelect]
  );

  // Handle transit route press
  const handleRoutePress = useCallback(
    (event: any) => {
      if (!event.features?.length) return;
      const feature = event.features[0];
      const props = feature.properties;

      const route = ROUTES.find((r) => r.id === props.id);
      if (route) {
        onRouteSelect?.(route);
        // Fly to route midpoint
        const mid = Math.floor(route.coordinates.length / 2);
        cameraRef.current?.setCamera({
          centerCoordinate: route.coordinates[mid],
          zoomLevel: 11.5,
          pitch: 35,
          animationDuration: 1500,
        });
      }
    },
    [onRouteSelect]
  );

  // Handle long press for pinning
  const handleMapLongPress = useCallback(
    (event: any) => {
      if (!onLongPress) return;
      const { geometry } = event;
      if (geometry?.coordinates) {
        onLongPress({
          coordinate: {
            latitude: geometry.coordinates[1],
            longitude: geometry.coordinates[0],
          },
        });
      }
    },
    [onLongPress]
  );

  // Handle pinned marker press
  const handlePinnedPress = useCallback(() => {
    onPinnedMarkerPress?.();
  }, [onPinnedMarkerPress]);

  // Handle Pasop pin press — look up the full report from props and hand
  // it to the parent (HomeScreen opens a PasopPinSheet preview).
  const handlePasopPress = useCallback(
    (event: any) => {
      if (!onPasopPress || !event.features?.length) return;
      const props = event.features[0].properties;
      const report = pasopReports.find((r) => r.id === props.id);
      if (!report) return;
      const [lng, lat] = event.features[0].geometry.coordinates;
      cameraRef.current?.setCamera({
        centerCoordinate: [lng, lat],
        zoomLevel: ZOOM_LEVELS.rank,
        animationDuration: 1200,
      });
      onPasopPress(report);
    },
    [onPasopPress, pasopReports]
  );

  // Fly to selected rank when it changes
  useEffect(() => {
    if (selectedRankId) {
      const rank = RANKS.find((r) => r.id === selectedRankId);
      if (rank) {
        cameraRef.current?.setCamera({
          centerCoordinate: [rank.lng, rank.lat],
          zoomLevel: ZOOM_LEVELS.rank,
          pitch: 45,
          heading: Math.random() * 40 - 20,
          animationDuration: 2000,
        });
      }
    }
  }, [selectedRankId]);

  // Fly to selected route midpoint
  useEffect(() => {
    if (selectedRouteId) {
      const route = ROUTES.find((r) => r.id === selectedRouteId);
      if (route) {
        const mid = Math.floor(route.coordinates.length / 2);
        cameraRef.current?.setCamera({
          centerCoordinate: route.coordinates[mid],
          zoomLevel: 11.5,
          pitch: 35,
          animationDuration: 1500,
        });
      }
    }
  }, [selectedRouteId]);

  const mapStyle = isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light;

  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const handleRetry = useCallback(() => {
    setMapError(null);
    setRetryKey((k) => k + 1);
  }, []);

  if (mapError) {
    return (
      <View style={[styles.fallbackContainer, { backgroundColor: isDark ? "#1a1a1a" : "#f5f5f5" }]}>
        <Feather name="map-pin" size={48} color={BrandColors.primary.gradientStart} />
        <ThemedText style={styles.fallbackTitle}>Map unavailable</ThemedText>
        <ThemedText style={styles.fallbackBody}>
          Check your connection and try again.
        </ThemedText>
        <Pressable
          onPress={handleRetry}
          style={styles.fallbackButton}
          accessibilityRole="button"
          accessibilityLabel="Retry loading map"
        >
          <Feather name="refresh-cw" size={16} color="#FFFFFF" />
          <ThemedText style={styles.fallbackButtonText}>Retry</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <MapView
      key={retryKey}
      ref={mapViewRef}
      style={StyleSheet.absoluteFillObject}
      styleURL={mapStyle}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={true}
      compassPosition={{ top: 120, right: 16 }}
      scaleBarEnabled={false}
      onLongPress={handleMapLongPress}
      onMapLoadingError={() => {
        console.warn("[Map] Failed to load Mapbox style — showing fallback");
        setMapError("load_failed");
      }}
    >
      {/* Camera */}
      <Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: DEFAULT_CAMERA.centerCoordinate,
          zoomLevel: DEFAULT_CAMERA.zoomLevel,
          pitch: DEFAULT_CAMERA.pitch,
          heading: DEFAULT_CAMERA.heading,
        }}
        animationDuration={DEFAULT_CAMERA.animationDuration}
      />

      {/* User Location Puck */}
      {showUserLocation && (
        <LocationPuck
          puckBearingEnabled
          puckBearing="heading"
          pulsing={{
            isEnabled: true,
            color: BrandColors.primary.red,
            radius: 50,
          }}
        />
      )}

      {/* ─── Transit Route Lines ─── */}
      {showTransitRoutes && (
        <ShapeSource
          id="transit-routes"
          shape={routesGeoJSON}
          onPress={handleRoutePress}
        >
          {/* Route lines - base */}
          <LineLayer
            id="transit-routes-base"
            style={{
              lineColor: ["get", "color"],
              lineWidth: selectedRouteId
                ? [
                    "case",
                    ["==", ["get", "id"], selectedRouteId],
                    5,
                    2,
                  ]
                : 3,
              lineOpacity: selectedRouteId
                ? [
                    "case",
                    ["==", ["get", "id"], selectedRouteId],
                    1,
                    0.3,
                  ]
                : 0.6,
              lineCap: "round",
              lineJoin: "round",
              lineDasharray: [2, 2],
            }}
          />
        </ShapeSource>
      )}

      {/* ─── Transit Rank Markers ─── */}
      {ranksVisible && (
        <ShapeSource
          id="transit-ranks"
          shape={ranksGeoJSON}
          onPress={handleRankPress}
        >
          {/* Outer pulse ring */}
          <CircleLayer
            id="transit-ranks-pulse"
            style={{
              circleRadius: 20,
              circleColor: ["get", "color"],
              circleOpacity: 0.15 * ranksOpacity,
              circleStrokeWidth: 0,
            }}
          />
          {/* Inner circle */}
          <CircleLayer
            id="transit-ranks-inner"
            style={{
              circleRadius: 8,
              circleColor: ["get", "color"],
              circleOpacity: ranksOpacity,
              circleStrokeWidth: 2.5,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          {/* Rank name labels */}
          <SymbolLayer
            id="transit-ranks-labels"
            style={{
              textField: ["get", "name"],
              textSize: 11,
              textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
              textOffset: [0, -2.2],
              textAnchor: "bottom",
              textColor: isDark ? "#FFFFFF" : "#212121",
              textHaloColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)",
              textHaloWidth: 1.5,
              textAllowOverlap: false,
              textMaxWidth: 10,
              textOpacity: ranksOpacity,
            }}
          />
        </ShapeSource>
      )}

      {/* ─── Pasop Hazard Pins ─── */}
      {showPasopPins && pasopGeoJSON.features.length > 0 && (
        <ShapeSource
          id="pasop-reports"
          shape={pasopGeoJSON}
          onPress={handlePasopPress}
        >
          {/* Outer halo — scales with petition count */}
          <CircleLayer
            id="pasop-halo"
            style={{
              circleRadius: [
                "+",
                18,
                ["min", 8, ["*", 0.8, ["get", "petitionCount"]]],
              ],
              circleColor: ["get", "color"],
              circleOpacity: ["*", 0.18, ["get", "opacity"]],
              circleStrokeWidth: 0,
            }}
          />
          {/* Inner marker */}
          <CircleLayer
            id="pasop-inner"
            style={{
              circleRadius: [
                "+",
                10,
                ["min", 4, ["*", 0.35, ["get", "petitionCount"]]],
              ],
              circleColor: ["get", "color"],
              circleOpacity: ["get", "opacity"],
              circleStrokeWidth: 3,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          {/* Universal "!" glyph — color-coded circles carry the meaning,
              the glyph just confirms "this is a hazard pin". */}
          <SymbolLayer
            id="pasop-glyph"
            style={{
              textField: "!",
              textSize: 14,
              textColor: "#FFFFFF",
              textAllowOverlap: true,
              textIgnorePlacement: true,
              textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"],
            }}
          />
        </ShapeSource>
      )}

      {/* ─── Taxi Location Markers ─── */}
      {locations.length > 0 && (
        <ShapeSource
          id="taxi-locations"
          shape={locationsGeoJSON}
          onPress={handleLocationPress}
        >
          {/* Location circles */}
          <CircleLayer
            id="taxi-locations-circles"
            style={{
              circleRadius: [
                "match",
                ["get", "type"],
                "rank", 7,
                "interchange", 6,
                "formal_stop", 5,
                4,
              ],
              circleColor: [
                "match",
                ["get", "type"],
                "rank", BrandColors.primary.blue,
                "formal_stop", BrandColors.secondary.green,
                "informal_stop", BrandColors.secondary.orange,
                "landmark", "#9B59B6",
                "interchange", "#E74C3C",
                BrandColors.secondary.orange,
              ],
              circleStrokeWidth: 2,
              circleStrokeColor: "#FFFFFF",
              circleOpacity: 0.9,
            }}
          />
          {/* Location labels (visible at higher zoom) */}
          <SymbolLayer
            id="taxi-locations-labels"
            minZoomLevel={12}
            style={{
              textField: ["get", "name"],
              textSize: 10,
              textFont: ["DIN Pro Regular", "Arial Unicode MS Regular"],
              textOffset: [0, 1.5],
              textAnchor: "top",
              textColor: isDark ? "#ECEDEE" : "#333333",
              textHaloColor: isDark ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.8)",
              textHaloWidth: 1,
              textAllowOverlap: false,
              textMaxWidth: 8,
            }}
          />
        </ShapeSource>
      )}

      {/* ─── Traffic Incidents ─── */}
      {showsIncidents && incidents.length > 0 && (
        <ShapeSource
          id="traffic-incidents"
          shape={incidentsGeoJSON}
          onPress={(event: any) => {
            if (!event.features?.length || !onIncidentPress) return;
            const props = event.features[0].properties;
            const incident = incidents.find((i) => i.id === props.id);
            if (incident) onIncidentPress(incident);
          }}
        >
          <CircleLayer
            id="incidents-circles"
            style={{
              circleRadius: 10,
              circleColor: ["get", "color"],
              circleOpacity: 0.85,
              circleStrokeWidth: 2,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          <SymbolLayer
            id="incidents-labels"
            style={{
              textField: "⚠",
              textSize: 12,
              textAllowOverlap: true,
            }}
          />
        </ShapeSource>
      )}

      {/* ─── Pinned Location ─── */}
      {pinnedGeoJSON && (
        <ShapeSource
          id="pinned-location"
          shape={pinnedGeoJSON}
          onPress={handlePinnedPress}
        >
          <CircleLayer
            id="pinned-outer"
            style={{
              circleRadius: 18,
              circleColor: BrandColors.secondary.green,
              circleOpacity: 0.25,
            }}
          />
          <CircleLayer
            id="pinned-inner"
            style={{
              circleRadius: 10,
              circleColor: BrandColors.secondary.green,
              circleOpacity: 1,
              circleStrokeWidth: 3,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          <SymbolLayer
            id="pinned-icon"
            style={{
              textField: "+",
              textSize: 16,
              textColor: "#FFFFFF",
              textAllowOverlap: true,
            }}
          />
        </ShapeSource>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  fallbackTitle: {
    ...Typography.h3,
    marginTop: Spacing.sm,
  },
  fallbackBody: {
    ...Typography.body,
    textAlign: "center",
    opacity: 0.7,
  },
  fallbackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.primary.gradientStart,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  fallbackButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

/**
 * MapViewComponent — Web version using Mapbox GL JS
 * Full interactive map with taxi ranks, routes, and animations.
 */
import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLES, DEFAULT_CAMERA, ZOOM_LEVELS } from "@/constants/mapbox";
import { RANKS, ROUTES, STATUS_CONFIG, GAUTENG_CENTER } from "@/data/mapbox_transit_data";
import type { TaxiLocation, LocationType } from "@/lib/types";
import type { MapboxTaxiRank, MapboxTaxiRoute } from "@/data/mapbox_transit_data";
import type { PasopReport } from "@/data/pasopReports";

// Dynamically load mapbox-gl for web
let mapboxgl: any = null;
if (typeof window !== "undefined") {
  try {
    mapboxgl = require("mapbox-gl");
    // Inject CSS
    if (!document.getElementById("mapbox-gl-css")) {
      const link = document.createElement("link");
      link.id = "mapbox-gl-css";
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
      document.head.appendChild(link);
    }
  } catch (e) {
    console.warn("mapbox-gl not available on web:", e);
  }
}

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
  pinnedLocation?: { latitude: number; longitude: number } | null;
  onPinnedMarkerPress?: () => void;
  showTransitRoutes?: boolean;
  showTransitRanks?: boolean;
  dimTransitRanks?: boolean;
  onRankSelect?: (rank: MapboxTaxiRank | null) => void;
  onRouteSelect?: (route: MapboxTaxiRoute | null) => void;
  selectedRankId?: string | null;
  selectedRouteId?: string | null;
  pasopReports?: PasopReport[];
  showPasopPins?: boolean;
  onPasopPress?: (report: PasopReport) => void;
}

export function MapViewComponent({
  onLocationPress,
  onLongPress,
  locations = [],
  isDark = false,
  showUserLocation = true,
  pinnedLocation = null,
  onPinnedMarkerPress,
  showTransitRoutes = true,
  onRankSelect,
  onRouteSelect,
  selectedRankId,
  selectedRouteId,
  mapRef,
}: MapViewComponentProps) {
  const { theme } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize Mapbox GL JS map
  useEffect(() => {
    if (!mapboxgl || !mapContainer.current || map.current) return;

    try {
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light,
        center: [DEFAULT_CAMERA.centerCoordinate[0], DEFAULT_CAMERA.centerCoordinate[1]],
        zoom: DEFAULT_CAMERA.zoomLevel,
        pitch: DEFAULT_CAMERA.pitch,
        bearing: DEFAULT_CAMERA.heading,
        attributionControl: false,
        interactive: true,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: true }),
        "top-right"
      );

      map.current.on("load", () => {
        setMapLoaded(true);
        addRoutes();
        addRankMarkers();
        addLocationMarkers();
      });

      // Long press handler
      let longPressTimer: any = null;
      map.current.on("mousedown", (e: any) => {
        longPressTimer = setTimeout(() => {
          if (onLongPress) {
            onLongPress({
              coordinate: { latitude: e.lngLat.lat, longitude: e.lngLat.lng },
            });
          }
        }, 500);
      });
      map.current.on("mouseup", () => clearTimeout(longPressTimer));
      map.current.on("mousemove", () => clearTimeout(longPressTimer));

      // Expose map ref for backward compatibility
      if (mapRef) {
        mapRef.current = {
          animateToRegion: (region: any) => {
            map.current?.flyTo({
              center: [region.longitude, region.latitude],
              zoom: ZOOM_LEVELS.rank,
              duration: 1500,
            });
          },
          flyTo: (center: [number, number], zoom?: number) => {
            map.current?.flyTo({
              center,
              zoom: zoom || ZOOM_LEVELS.rank,
              pitch: 45,
              bearing: Math.random() * 40 - 20,
              duration: 2000,
            });
          },
          resetView: () => {
            map.current?.flyTo({
              center: DEFAULT_CAMERA.centerCoordinate,
              zoom: DEFAULT_CAMERA.zoomLevel,
              pitch: DEFAULT_CAMERA.pitch,
              bearing: DEFAULT_CAMERA.heading,
              duration: 1500,
            });
          },
        };
      }
    } catch (err: any) {
      setMapError(err.message || "Failed to initialize map");
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add route polylines
  const addRoutes = useCallback(() => {
    if (!map.current) return;

    ROUTES.forEach((route) => {
      const sourceId = `route-${route.id}`;
      const layerId = `route-layer-${route.id}`;

      map.current.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: route.coordinates,
          },
        },
      });

      map.current.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": route.color,
          "line-width": 3,
          "line-opacity": 0.6,
          "line-dasharray": [2, 2],
        },
      });

      // Animate dash
      let step = 0;
      function animateDash() {
        step += 0.5;
        const phase = step % 4;
        if (map.current?.getLayer(layerId)) {
          map.current.setPaintProperty(layerId, "line-dasharray", [
            Math.max(phase, 0.1),
            Math.max(4 - phase, 0.1),
          ]);
        }
        if (step < 100) requestAnimationFrame(animateDash);
      }
      animateDash();

      // Click handler
      map.current.on("click", layerId, () => {
        onRouteSelect?.(route);
        map.current?.flyTo({
          center: route.coordinates[Math.floor(route.coordinates.length / 2)],
          zoom: 11.5,
          pitch: 35,
          duration: 1500,
        });
      });

      map.current.on("mouseenter", layerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "pointer";
        map.current.setPaintProperty(layerId, "line-width", 5);
        map.current.setPaintProperty(layerId, "line-opacity", 1);
      });

      map.current.on("mouseleave", layerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "";
        map.current.setPaintProperty(layerId, "line-width", 3);
        map.current.setPaintProperty(layerId, "line-opacity", 0.6);
      });
    });
  }, [onRouteSelect]);

  // Add pulsing rank markers
  const addRankMarkers = useCallback(() => {
    if (!map.current || !mapboxgl) return;

    RANKS.forEach((rank) => {
      const config = STATUS_CONFIG[rank.status];

      const el = document.createElement("div");
      el.style.cssText = "width:28px;height:28px;cursor:pointer;position:relative;";

      // Pulse ring
      const pulse = document.createElement("div");
      pulse.style.cssText = `position:absolute;inset:-6px;border-radius:50%;background:${config.color}30;animation:rankPulse 2s ease-out infinite;`;
      el.appendChild(pulse);

      // Outer
      const outer = document.createElement("div");
      outer.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${config.color}40;`;
      el.appendChild(outer);

      // Inner
      const inner = document.createElement("div");
      inner.style.cssText = `position:absolute;inset:5px;border-radius:50%;background:${config.color};border:2px solid white;box-shadow:0 2px 8px ${config.color}60;`;
      el.appendChild(inner);

      // Label
      const label = document.createElement("div");
      label.style.cssText = `position:absolute;top:-24px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;font-weight:700;font-family:'Nunito',sans-serif;color:white;background:rgba(0,0,0,0.7);padding:2px 6px;border-radius:4px;pointer-events:none;`;
      // Show abbreviated name for readability at scale
      const shortName = rank.name.length > 20 ? rank.name.split(/[\s,]/)[0] : rank.name;
      label.textContent = shortName;
      el.appendChild(label);

      el.addEventListener("click", () => {
        onRankSelect?.(rank);
        map.current?.flyTo({
          center: [rank.lng, rank.lat],
          zoom: ZOOM_LEVELS.rank,
          pitch: 45,
          bearing: Math.random() * 40 - 20,
          duration: 2000,
          essential: true,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([rank.lng, rank.lat])
        .addTo(map.current);

      markersRef.current.push(marker);
    });

    // Inject pulse animation CSS
    if (!document.getElementById("mapbox-pulse-css")) {
      const style = document.createElement("style");
      style.id = "mapbox-pulse-css";
      style.textContent = `
        @keyframes rankPulse {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, [onRankSelect]);

  // Add location markers as a source layer
  const addLocationMarkers = useCallback(() => {
    if (!map.current || locations.length === 0) return;

    const geojson = {
      type: "FeatureCollection",
      features: locations.map((loc) => ({
        type: "Feature",
        properties: {
          id: loc.id,
          name: loc.name,
          type: loc.type,
        },
        geometry: {
          type: "Point",
          coordinates: [loc.longitude, loc.latitude],
        },
      })),
    };

    if (map.current.getSource("location-markers")) {
      (map.current.getSource("location-markers") as any).setData(geojson);
    } else {
      map.current.addSource("location-markers", { type: "geojson", data: geojson });

      map.current.addLayer({
        id: "location-markers-circle",
        type: "circle",
        source: "location-markers",
        paint: {
          "circle-radius": [
            "match", ["get", "type"],
            "rank", 6,
            "interchange", 5,
            "formal_stop", 4,
            3,
          ],
          "circle-color": [
            "match", ["get", "type"],
            "rank", BrandColors.primary.blue,
            "formal_stop", BrandColors.secondary.green,
            "informal_stop", BrandColors.secondary.orange,
            "landmark", "#9B59B6",
            "interchange", "#E74C3C",
            BrandColors.secondary.orange,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#FFFFFF",
        },
      });

      map.current.on("click", "location-markers-circle", (e: any) => {
        if (!e.features?.length || !onLocationPress) return;
        const props = e.features[0].properties;
        const loc = locations.find((l) => l.id === props.id);
        if (loc) onLocationPress(loc);
      });

      map.current.on("mouseenter", "location-markers-circle", () => {
        if (map.current) map.current.getCanvas().style.cursor = "pointer";
      });
      map.current.on("mouseleave", "location-markers-circle", () => {
        if (map.current) map.current.getCanvas().style.cursor = "";
      });
    }
  }, [locations, onLocationPress]);

  // If mapbox-gl is not available, show fallback
  if (!mapboxgl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.fallbackHeader}>
          <Feather name="map" size={32} color={theme.textSecondary} />
          <ThemedText style={styles.fallbackText}>
            Interactive map loading...
          </ThemedText>
        </View>
        {locations.length > 0 && (
          <ScrollView style={styles.locationList} contentContainerStyle={styles.locationListContent}>
            <ThemedText type="label" style={{ marginBottom: Spacing.md, color: theme.textSecondary }}>
              {locations.length} locations found
            </ThemedText>
            {locations.map((location) => (
              <Pressable
                key={location.id}
                style={[styles.locationCard, { backgroundColor: theme.backgroundElevated }]}
                onPress={() => onLocationPress?.(location)}
              >
                <View style={styles.locationInfo}>
                  <ThemedText style={styles.locationName}>{location.name}</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    {location.type}
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      {!mapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={BrandColors.primary.red} />
          <ThemedText style={{ marginTop: 8, color: theme.textSecondary }}>
            Loading Mapbox...
          </ThemedText>
        </View>
      )}
      {mapError && (
        <View style={styles.loadingOverlay}>
          <Feather name="alert-circle" size={32} color={BrandColors.status.emergency} />
          <ThemedText style={{ marginTop: 8, color: theme.textSecondary }}>
            {mapError}
          </ThemedText>
        </View>
      )}
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  fallbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  fallbackText: { fontSize: 16, fontWeight: "600" },
  locationList: { flex: 1, paddingHorizontal: Spacing.lg },
  locationListContent: { paddingBottom: Spacing.xl },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  locationInfo: { flex: 1 },
  locationName: { fontWeight: "600", marginBottom: 2 },
});

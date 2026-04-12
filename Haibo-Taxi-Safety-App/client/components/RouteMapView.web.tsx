/**
 * RouteMapView — Web version using Mapbox GL JS
 * Shows a static route map with origin, destination, and polyline.
 */
import React, { useRef, useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLES } from "@/constants/mapbox";
import { Coords } from "@/lib/types";

// Dynamically load mapbox-gl for web
let mapboxgl: any = null;
if (typeof window !== "undefined") {
  try {
    mapboxgl = require("mapbox-gl");
    if (!document.getElementById("mapbox-gl-css")) {
      const link = document.createElement("link");
      link.id = "mapbox-gl-css";
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
      document.head.appendChild(link);
    }
  } catch (e) {
    console.warn("mapbox-gl not available:", e);
  }
}

interface RouteMapViewProps {
  originCoords: Coords;
  destinationCoords: Coords;
  routeCoords?: Coords[];
  originTitle: string;
  destinationTitle: string;
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showsTraffic?: boolean;
}

export function RouteMapView({
  originCoords,
  destinationCoords,
  routeCoords,
  originTitle,
  destinationTitle,
  region,
}: RouteMapViewProps) {
  const { theme, isDark } = useTheme();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!mapboxgl || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const zoomLevel = Math.max(1, Math.min(20, Math.log2(360 / region.latitudeDelta) - 1));

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light,
      center: [region.longitude, region.latitude],
      zoom: zoomLevel,
      interactive: false,
      attributionControl: false,
    });

    map.current.on("load", () => {
      setLoaded(true);

      // Add route line
      if (routeCoords && routeCoords.length > 1) {
        map.current.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: routeCoords.map((c) => [c.longitude, c.latitude]),
            },
          },
        });

        map.current.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": BrandColors.primary.blue,
            "line-width": 4,
            "line-opacity": 0.8,
          },
        });
      }

      // Origin marker
      const originEl = createMarkerEl(BrandColors.primary.blue, "A");
      new mapboxgl.Marker({ element: originEl })
        .setLngLat([originCoords.longitude, originCoords.latitude])
        .addTo(map.current);

      // Destination marker
      const destEl = createMarkerEl(BrandColors.primary.green, "B");
      new mapboxgl.Marker({ element: destEl })
        .setLngLat([destinationCoords.longitude, destinationCoords.latitude])
        .addTo(map.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  if (!mapboxgl) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="map" size={40} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
          Route map loading...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!loaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={BrandColors.primary.red} />
        </View>
      )}
      <div
        ref={mapContainer}
        style={{ width: "100%", height: 200, borderRadius: 12, overflow: "hidden" }}
      />
    </View>
  );
}

function createMarkerEl(color: string, label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 24px; height: 24px; border-radius: 50%;
    background: ${color}; border: 2.5px solid white;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; color: white;
    font-family: 'Nunito', sans-serif;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  `;
  el.textContent = label;
  return el;
}

const styles = StyleSheet.create({
  container: { width: "100%", height: 200, borderRadius: BorderRadius.md, overflow: "hidden" },
  fallback: {
    height: 200,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});

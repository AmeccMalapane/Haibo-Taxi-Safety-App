import React, { memo, useRef } from "react";
import { StyleSheet } from "react-native";
import {
  MapView,
  Camera,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
  LineLayer,
} from "@rnmapbox/maps";
import { BrandColors } from "@/constants/theme";
import { MAPBOX_STYLES } from "@/constants/mapbox";
import { useTheme } from "@/hooks/useTheme";
import { Coords } from "@/lib/types";

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

// Convert route coords to GeoJSON LineString
function routeToGeoJSON(coords: Coords[]) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: coords.map((c) => [c.longitude, c.latitude]),
    },
  };
}

// Convert origin/destination to GeoJSON points
function markersToGeoJSON(
  origin: Coords,
  destination: Coords,
  originTitle: string,
  destinationTitle: string
) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        id: "origin",
        properties: {
          id: "origin",
          title: originTitle,
          color: BrandColors.primary.blue,
          label: "A",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [origin.longitude, origin.latitude],
        },
      },
      {
        type: "Feature" as const,
        id: "destination",
        properties: {
          id: "destination",
          title: destinationTitle,
          color: BrandColors.primary.green,
          label: "B",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [destination.longitude, destination.latitude],
        },
      },
    ],
  };
}

// Wrap with memo to prevent unnecessary re-renders when parent scrolls
export const RouteMapView = memo(
  ({
    originCoords,
    destinationCoords,
    routeCoords,
    originTitle,
    destinationTitle,
    region,
  }: RouteMapViewProps) => {
    const { isDark } = useTheme();
    const cameraRef = useRef<Camera>(null);

    const markersGeoJSON = React.useMemo(
      () => markersToGeoJSON(originCoords, destinationCoords, originTitle, destinationTitle),
      [originCoords, destinationCoords, originTitle, destinationTitle]
    );

    const routeGeoJSON = React.useMemo(
      () =>
        routeCoords && routeCoords.length > 1
          ? routeToGeoJSON(routeCoords)
          : null,
      [routeCoords]
    );

    // Calculate center and zoom from the region
    const centerCoordinate: [number, number] = [region.longitude, region.latitude];
    // Approximate zoom from latitudeDelta
    const zoomLevel = Math.max(
      1,
      Math.min(20, Math.log2(360 / region.latitudeDelta) - 1)
    );

    return (
      <MapView
        style={styles.map}
        styleURL={isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate,
            zoomLevel,
            pitch: 0,
            heading: 0,
          }}
          animationDuration={0}
        />

        {/* Route polyline */}
        {routeGeoJSON && (
          <ShapeSource id="route-line" shape={routeGeoJSON}>
            <LineLayer
              id="route-line-layer"
              style={{
                lineColor: BrandColors.primary.blue,
                lineWidth: 4,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: 0.8,
              }}
            />
          </ShapeSource>
        )}

        {/* Origin and Destination markers */}
        <ShapeSource id="route-markers" shape={markersGeoJSON}>
          <CircleLayer
            id="route-markers-outer"
            style={{
              circleRadius: 12,
              circleColor: ["get", "color"],
              circleOpacity: 0.2,
            }}
          />
          <CircleLayer
            id="route-markers-inner"
            style={{
              circleRadius: 7,
              circleColor: ["get", "color"],
              circleOpacity: 1,
              circleStrokeWidth: 2.5,
              circleStrokeColor: "#FFFFFF",
            }}
          />
          <SymbolLayer
            id="route-markers-labels"
            style={{
              textField: ["get", "label"],
              textSize: 10,
              textColor: "#FFFFFF",
              textAllowOverlap: true,
              textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"],
            }}
          />
        </ShapeSource>
      </MapView>
    );
  }
);

const styles = StyleSheet.create({
  map: {
    height: 200,
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
  },
});

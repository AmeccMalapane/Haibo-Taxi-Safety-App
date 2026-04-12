/**
 * Haibo Custom Map Styles — "Mzansi Pulse" theme
 * Dark and light Mapbox styles with brand-consistent colors.
 * Rose Red highlights, warm grays, South African-inspired palette.
 */

/** Mapbox style URLs — use Mapbox's built-in styles with custom overrides */
export const MapStyles = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

/** Custom color overrides applied as map layer paint properties */
export const MapTheme = {
  light: {
    background: "#FAF9F6",           // Warm off-white (Mzansi Pulse)
    water: "#B5D4F4",                // Soft blue
    land: "#F5F3EF",                 // Warm cream
    roads: "#FFFFFF",                // White roads
    roadOutline: "#E0DDD6",          // Warm gray outlines
    buildings: "#EAE7E0",            // Warm beige
    labels: "#424242",               // Dark gray text
    parks: "#D4E8C0",               // Soft green
    taxiRankMarker: "#E72369",       // Rose Red (brand primary)
    taxiRouteActive: "#E72369",      // Rose Red
    taxiRouteInactive: "#BDBDBD",    // Gray
    sosAlert: "#C62828",             // Emergency red
    driverMarker: "#1976D2",         // Blue
    userMarker: "#28A745",           // Green
  },
  dark: {
    background: "#1A1A1A",
    water: "#1B3A5C",
    land: "#242424",
    roads: "#333333",
    roadOutline: "#444444",
    buildings: "#2C2C2C",
    labels: "#CCCCCC",
    parks: "#1E3A1E",
    taxiRankMarker: "#EA4F52",       // Coral (dark mode brand)
    taxiRouteActive: "#EA4F52",
    taxiRouteInactive: "#555555",
    sosAlert: "#EF5350",
    driverMarker: "#42A5F5",
    userMarker: "#66BB6A",
  },
};

/** GeoJSON marker styling for taxi ranks */
export function getRankMarkerStyle(isDark: boolean) {
  const colors = isDark ? MapTheme.dark : MapTheme.light;
  return {
    circleColor: colors.taxiRankMarker,
    circleRadius: 8,
    circleStrokeWidth: 2,
    circleStrokeColor: "#FFFFFF",
    circleOpacity: 0.9,
  };
}

/** Route line styling */
export function getRouteLineStyle(isDark: boolean, isActive = true) {
  const colors = isDark ? MapTheme.dark : MapTheme.light;
  return {
    lineColor: isActive ? colors.taxiRouteActive : colors.taxiRouteInactive,
    lineWidth: isActive ? 4 : 2,
    lineOpacity: isActive ? 0.85 : 0.4,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  };
}

/** Driver marker styling */
export function getDriverMarkerStyle(isDark: boolean) {
  const colors = isDark ? MapTheme.dark : MapTheme.light;
  return {
    markerColor: colors.driverMarker,
    markerSize: 12,
    pulseColor: colors.driverMarker + "40",
    pulseRadius: 20,
  };
}

/** SOS alert radius styling */
export function getSOSRadiusStyle(isDark: boolean) {
  const colors = isDark ? MapTheme.dark : MapTheme.light;
  return {
    fillColor: colors.sosAlert + "20",
    strokeColor: colors.sosAlert,
    strokeWidth: 2,
    radius: 500, // meters
  };
}

/** Google Maps style array (for react-native-maps fallback) */
export const GoogleMapsDarkStyle = [
  { elementType: "geometry", stylers: [{ color: "#242424" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242424" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#999999" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1B3A5C" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#333333" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#444444" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1E3A1E" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2C2C2C" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
];

export const GoogleMapsLightStyle = [
  { elementType: "geometry", stylers: [{ color: "#F5F3EF" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#424242" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#B5D4F4" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#E0DDD6" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#D4E8C0" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
];

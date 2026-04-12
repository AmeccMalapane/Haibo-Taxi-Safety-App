/**
 * Mapbox Configuration
 * 
 * The access token is loaded from environment variables.
 * For Expo, use `expo-constants` or `app.json` extra field.
 * For development, you can set EXPO_PUBLIC_MAPBOX_TOKEN in .env
 * or hardcode a public token here temporarily.
 */

import Constants from "expo-constants";

// Mapbox public access token
// Priority: env var > Constants > fallback
export const MAPBOX_ACCESS_TOKEN: string =
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN ||
  (Constants.expoConfig?.extra?.mapboxAccessToken as string) ||
  "pk.eyJ1IjoiaGFpYm9hZnJpY2EiLCJhIjoiY200dHp5ZW5kMDBhaTJqczRwcWdnMHBhZyJ9.5P-V0ePBMDwmEhLJCSJbhA";

// Mapbox style URLs
export const MAPBOX_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  light: "mapbox://styles/mapbox/light-v11",
  streets: "mapbox://styles/mapbox/streets-v12",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  navigation_day: "mapbox://styles/mapbox/navigation-day-v1",
  navigation_night: "mapbox://styles/mapbox/navigation-night-v1",
} as const;

// Default camera settings (South Africa overview)
export const DEFAULT_CAMERA = {
  centerCoordinate: [25.5, -29.0] as [number, number], // South Africa center
  zoomLevel: 5.5,
  pitch: 15,
  heading: 0,
  animationDuration: 2000,
};

// Zoom levels for different interactions
export const ZOOM_LEVELS = {
  country: 5.5,
  province: 8,
  overview: 9.5,
  city: 11,
  rank: 13,
  detail: 15,
};

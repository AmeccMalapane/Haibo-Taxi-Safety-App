/**
 * Mapbox Configuration
 *
 * The access token MUST be provided via `EXPO_PUBLIC_MAPBOX_TOKEN` in .env
 * (or `expoConfig.extra.mapboxAccessToken` in app.json as a secondary fallback
 * for EAS builds that prefer extras over env vars). No committed literal —
 * the previous hardcoded fallback leaked the token to git history.
 */

import Constants from "expo-constants";

const envToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const extrasToken = Constants.expoConfig?.extra?.mapboxAccessToken as
  | string
  | undefined;
const resolved = envToken || extrasToken;

if (!resolved) {
  // Fail loudly at module load so a missing token surfaces the second the
  // app boots instead of at first map render. A committed fallback is what
  // leaked the old token — never add one back.
  throw new Error(
    "EXPO_PUBLIC_MAPBOX_TOKEN is not set. Add it to .env (local dev) or EAS " +
      "build secrets (production builds). See .env.example for the variable name.",
  );
}

if (!resolved.startsWith("pk.")) {
  // A secret token in a mobile bundle is a wallet-draining incident waiting
  // to happen. Reject it explicitly so the failure is impossible to miss.
  throw new Error(
    "EXPO_PUBLIC_MAPBOX_TOKEN must be a PUBLIC (pk.) token. Secret (sk.) " +
      "tokens must never be embedded in client builds.",
  );
}

export const MAPBOX_ACCESS_TOKEN: string = resolved;

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

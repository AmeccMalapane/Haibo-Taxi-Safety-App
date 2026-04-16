// Expo passes the resolved app.json expo key as `config` to this function.
// Using the function form (vs require("./app.json")) is what expo-doctor's
// "app config fields not synced" check looks for — the old `module.exports =
// { expo: { ...base.expo } }` pattern was flagged as a false positive and
// blocked EAS builds even though the runtime behaviour was identical.
module.exports = ({ config }) => {
  // Secrets are injected at build time via EAS env vars, falling back to
  // on-disk (gitignored) copies for local dev so `expo prebuild` still works.
  const androidGoogleServices =
    process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile || "./google-services.json";

  const iosGoogleServices =
    process.env.GOOGLE_SERVICE_INFO_PLIST || config.ios?.googleServicesFile || "./GoogleService-Info.plist";

  // Platform-specific Maps keys — each restricted in Google Cloud Console to
  // its own bundle. Fall back to the generic GOOGLE_MAPS_API_KEY (historically
  // the Android-restricted one) if a platform-specific var isn't set.
  const androidMapsKey =
    process.env.GOOGLE_MAPS_API_KEY_ANDROID || process.env.GOOGLE_MAPS_API_KEY || "";
  const iosMapsKey =
    process.env.GOOGLE_MAPS_API_KEY_IOS || process.env.GOOGLE_MAPS_API_KEY || "";

  return {
    ...config,
    ios: {
      ...config.ios,
      googleServicesFile: iosGoogleServices,
      config: {
        ...(config.ios?.config || {}),
        googleMapsApiKey: iosMapsKey,
      },
    },
    android: {
      ...config.android,
      googleServicesFile: androidGoogleServices,
      config: {
        ...(config.android?.config || {}),
        googleMaps: {
          apiKey: androidMapsKey,
        },
      },
    },
  };
};

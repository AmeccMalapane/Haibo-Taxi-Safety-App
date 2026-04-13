const base = require("./app.json");
const expo = base.expo;

// Secrets are injected at build time via EAS env vars, falling back to
// on-disk (gitignored) copies for local dev so `expo prebuild` still works.
const androidGoogleServices =
  process.env.GOOGLE_SERVICES_JSON || expo.android?.googleServicesFile || "./google-services.json";

const iosGoogleServices =
  process.env.GOOGLE_SERVICE_INFO_PLIST || expo.ios?.googleServicesFile || "./GoogleService-Info.plist";

// Platform-specific Maps keys — each restricted in Google Cloud Console to
// its own bundle. Fall back to the generic GOOGLE_MAPS_API_KEY (historically
// the Android-restricted one) if a platform-specific var isn't set.
const androidMapsKey =
  process.env.GOOGLE_MAPS_API_KEY_ANDROID || process.env.GOOGLE_MAPS_API_KEY || "";
const iosMapsKey =
  process.env.GOOGLE_MAPS_API_KEY_IOS || process.env.GOOGLE_MAPS_API_KEY || "";

module.exports = {
  expo: {
    ...expo,
    ios: {
      ...expo.ios,
      googleServicesFile: iosGoogleServices,
      config: {
        ...(expo.ios?.config || {}),
        googleMapsApiKey: iosMapsKey,
      },
    },
    android: {
      ...expo.android,
      googleServicesFile: androidGoogleServices,
      config: {
        ...(expo.android?.config || {}),
        googleMaps: {
          apiKey: androidMapsKey,
        },
      },
    },
  },
};

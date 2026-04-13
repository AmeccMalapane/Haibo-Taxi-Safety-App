import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { apiRequest, getApiUrl } from "./query-client";

const TRACKING_INTERVAL_MS = 60000; // 60 seconds
const TRACKING_KEY = "@haibo_tracking_active";
const USER_DATA_KEY = "@user_data";

let trackingInterval: NodeJS.Timeout | null = null;

/**
 * Start background location tracking for drivers.
 * Streams GPS coordinates to POST /api/driver/location-update every 60 seconds.
 */
export async function startDriverTracking(): Promise<boolean> {
  try {
    // Request permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== "granted") {
      console.warn("Foreground location permission denied");
      return false;
    }

    // Request background permission on native
    if (Platform.OS !== "web") {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== "granted") {
        console.warn("Background location permission denied - using foreground only");
      }
    }

    // Get user data
    const userData = await AsyncStorage.getItem(USER_DATA_KEY);
    if (!userData) {
      console.warn("No user data found - cannot start tracking");
      return false;
    }
    const user = JSON.parse(userData);
    const userId = user.id || user.userId;

    if (!userId) {
      console.warn("No userId found - cannot start tracking");
      return false;
    }

    // Mark tracking as active
    await AsyncStorage.setItem(TRACKING_KEY, "true");

    // Send initial location
    await sendLocationUpdate(userId);

    // Start interval
    trackingInterval = setInterval(() => {
      sendLocationUpdate(userId);
    }, TRACKING_INTERVAL_MS);

    console.log("Driver tracking started - updating every 60 seconds");
    return true;
  } catch (error) {
    console.error("Failed to start tracking:", error);
    return false;
  }
}

/**
 * Stop background location tracking.
 */
export async function stopDriverTracking(): Promise<void> {
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  await AsyncStorage.setItem(TRACKING_KEY, "false");
  console.log("Driver tracking stopped");
}

/**
 * Check if tracking is currently active.
 */
export async function isTrackingActive(): Promise<boolean> {
  const status = await AsyncStorage.getItem(TRACKING_KEY);
  return status === "true" && trackingInterval !== null;
}

/**
 * Send a single location update to the server.
 */
async function sendLocationUpdate(userId: string): Promise<void> {
  try {
    const baseUrl = getApiUrl();
    if (!baseUrl) {
      // Offline mode - store locally
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const stored = await AsyncStorage.getItem("@pending_locations");
      const pending = stored ? JSON.parse(stored) : [];
      pending.push({
        userId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        speed: location.coords.speed,
        heading: location.coords.heading,
        timestamp: new Date().toISOString(),
      });
      await AsyncStorage.setItem("@pending_locations", JSON.stringify(pending.slice(-100)));
      return;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    await apiRequest("POST", "/api/drivers/location-update", {
      userId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      speed: location.coords.speed,
      heading: location.coords.heading,
    });
  } catch (error) {
    console.error("Location update failed:", error);
  }
}

/**
 * Flush any pending location updates that were stored offline.
 */
export async function flushPendingLocations(): Promise<void> {
  try {
    const baseUrl = getApiUrl();
    if (!baseUrl) return;

    const stored = await AsyncStorage.getItem("@pending_locations");
    if (!stored) return;

    const pending = JSON.parse(stored);
    for (const loc of pending) {
      try {
        await apiRequest("POST", "/api/drivers/location-update", loc);
      } catch {
        // Skip failed uploads
      }
    }

    await AsyncStorage.removeItem("@pending_locations");
  } catch (error) {
    console.error("Failed to flush pending locations:", error);
  }
}

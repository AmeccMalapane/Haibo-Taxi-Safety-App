/**
 * Hook for driver GPS tracking.
 * Broadcasts the driver's location via Socket.IO every 60 seconds.
 * Only active when driver mode is enabled.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { sendLocationUpdate, getSocket } from "@/lib/socket";
import { useAuth } from "@/hooks/useAuth";

const GPS_INTERVAL_MS = 60_000; // 60 seconds

interface DriverTrackingState {
  isTracking: boolean;
  lastLocation: { latitude: number; longitude: number; speed?: number; heading?: number } | null;
  error: string | null;
}

export function useDriverTracking() {
  const { user } = useAuth();
  const [state, setState] = useState<DriverTrackingState>({
    isTracking: false,
    lastLocation: null,
    error: null,
  });
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setState((s) => ({ ...s, error: "Location permission denied" }));
        return;
      }

      setState((s) => ({ ...s, isTracking: true, error: null }));

      // Send initial position immediately
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const initial = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        speed: loc.coords.speed ?? undefined,
        heading: loc.coords.heading ?? undefined,
        accuracy: loc.coords.accuracy ?? undefined,
      };
      sendLocationUpdate(initial);
      setState((s) => ({ ...s, lastLocation: initial }));

      // Send updates every 60 seconds
      intervalRef.current = setInterval(async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const update = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed ?? undefined,
            heading: pos.coords.heading ?? undefined,
            accuracy: pos.coords.accuracy ?? undefined,
          };
          sendLocationUpdate(update);
          setState((s) => ({ ...s, lastLocation: update }));
        } catch (err) {
          console.log("[GPS] Update failed:", err);
        }
      }, GPS_INTERVAL_MS);

    } catch (error: any) {
      setState((s) => ({ ...s, error: error.message, isTracking: false }));
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setState({ isTracking: false, lastLocation: null, error: null });
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchRef.current) watchRef.current.remove();
    };
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
    isDriver: user?.role === "driver",
  };
}

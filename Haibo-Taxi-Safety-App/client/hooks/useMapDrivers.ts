/**
 * Hook for watching live driver positions on the map.
 * Connects via Socket.IO and receives real-time GPS updates.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { watchDriverLocations, type DriverLocation } from "@/lib/socket";

export function useMapDrivers() {
  const [drivers, setDrivers] = useState<Map<string, DriverLocation>>(new Map());
  const [isWatching, setIsWatching] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const startWatching = useCallback(() => {
    if (isWatching) return;
    setIsWatching(true);

    unsubRef.current = watchDriverLocations(
      // Snapshot: initial batch of all active drivers
      (snapshot: DriverLocation[]) => {
        const map = new Map<string, DriverLocation>();
        snapshot.forEach((d) => map.set(d.userId, d));
        setDrivers(map);
      },
      // Individual driver moved
      (location: DriverLocation) => {
        setDrivers((prev) => {
          const next = new Map(prev);
          next.set(location.userId, location);
          return next;
        });
      }
    );
  }, [isWatching]);

  const stopWatching = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    setIsWatching(false);
    setDrivers(new Map());
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  return {
    drivers: Array.from(drivers.values()),
    driversMap: drivers,
    driverCount: drivers.size,
    isWatching,
    startWatching,
    stopWatching,
  };
}

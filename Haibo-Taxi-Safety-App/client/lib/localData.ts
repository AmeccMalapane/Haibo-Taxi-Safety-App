/**
 * Local Data Provider
 * Loads bundled JSON data for offline-first experience.
 * Replaces API calls with local data until backend is available.
 */

import taxiLocationsData from "@/data/taxi_locations.json";
import taxiRoutesFaresData from "@/data/taxi_routes_fares.json";
import emergencyContactsData from "@/data/emergency_contacts.json";
import type { TaxiLocation, TaxiRoute, LocationType, VerificationStatus } from "@/lib/types";

// ─── Taxi Locations (for map markers) ────────────────────────────────────────

export function getTaxiLocations(): TaxiLocation[] {
  return (taxiLocationsData as any[]).map((loc, index) => ({
    id: String(loc.id ?? index + 1),
    name: loc.name,
    type: (loc.type || "rank") as LocationType,
    latitude: loc.latitude,
    longitude: loc.longitude,
    address: loc.address || loc.city || "",
    description: loc.description || `${loc.name} - ${loc.city || loc.province || "South Africa"}`,
    province: loc.province || "",
    city: loc.city || "",
    verificationStatus: (loc.verificationStatus || "verified") as VerificationStatus,
    confidenceScore: 0.8,
    upvotes: loc.upvotes || 0,
    downvotes: loc.downvotes || 0,
    isActive: true,
  }));
}

export function getTaxiLocationById(id: string): TaxiLocation | undefined {
  const locations = getTaxiLocations();
  return locations.find((l) => l.id === id);
}

// ─── Coordinate Lookup ───────────────────────────────────────────────────────

const locationCoords: Record<string, { latitude: number; longitude: number }> = {};

// Build coordinate lookup from taxi locations data
(taxiLocationsData as any[]).forEach((loc: any) => {
  if (loc.name && loc.latitude && loc.longitude) {
    locationCoords[loc.name.toLowerCase().trim()] = {
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
  }
});

function findCoords(name: string): { latitude: number; longitude: number } | undefined {
  const lower = name.toLowerCase().trim();
  if (locationCoords[lower]) return locationCoords[lower];
  for (const [key, coords] of Object.entries(locationCoords)) {
    if (key.includes(lower) || lower.includes(key)) return coords;
  }
  const words = lower.split(/[\s\-,]+/).filter((w) => w.length > 3);
  for (const [key, coords] of Object.entries(locationCoords)) {
    for (const word of words) {
      if (key.includes(word)) return coords;
    }
  }
  return undefined;
}

// ─── Taxi Routes & Fares ─────────────────────────────────────────────────────

export function getTaxiRoutes(): TaxiRoute[] {
  return (taxiRoutesFaresData as any[]).map((route: any) => {
    const origin = route.origin || route.routeName?.split(" - ")[0]?.trim() || "Unknown";
    const destination = route.destination || route.routeName?.split(" - ")[1]?.trim() || "Unknown";
    const originCoords = findCoords(origin);
    const destinationCoords = findCoords(destination);

    return {
      id: String(route.id),
      origin,
      destination,
      fare: route.fare,
      region: "Gauteng",
      estimatedTime: route.estimatedTime || "N/A",
      routeType: "local" as const,
      association: route.association || undefined,
      distance: route.distance ? parseFloat(route.distance) : null,
      province: "Gauteng",
      originCoords,
      destinationCoords,
      googleMapsLink:
        originCoords && destinationCoords
          ? `https://www.google.com/maps/dir/${originCoords.latitude},${originCoords.longitude}/${destinationCoords.latitude},${destinationCoords.longitude}`
          : undefined,
    };
  });
}

export function getTaxiRouteById(id: string): TaxiRoute | undefined {
  const routes = getTaxiRoutes();
  return routes.find((r) => r.id === id);
}

export function getTaxiProvinces(): string[] {
  const provinces = new Set<string>();
  provinces.add("All Regions");
  (taxiLocationsData as any[]).forEach((loc: any) => {
    if (loc.province) provinces.add(loc.province);
  });
  return Array.from(provinces);
}

// ─── Emergency Contacts ──────────────────────────────────────────────────────

export interface LocalEmergencyContact {
  id: number;
  name: string;
  phone: string;
  category: string;
  description: string;
}

export function getEmergencyContactsList(): LocalEmergencyContact[] {
  return emergencyContactsData as LocalEmergencyContact[];
}

export function getEmergencyCategories(): string[] {
  const categories = new Set<string>();
  categories.add("All");
  (emergencyContactsData as LocalEmergencyContact[]).forEach((c: any) => {
    if (c.category) categories.add(c.category);
  });
  return Array.from(categories);
}

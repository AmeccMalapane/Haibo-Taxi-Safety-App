/**
 * Mapbox Transit Data — All Known Ranks, Stops & Routes
 * Dynamically generated from taxi_locations.json and taxi_routes_fares.json
 * Covers all 9 provinces of South Africa.
 */

import taxiLocationsData from "@/data/taxi_locations.json";
import taxiRoutesFaresData from "@/data/taxi_routes_fares.json";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RankStatus = "busy" | "moderate" | "quiet";

export interface MapboxTaxiRank {
  id: string;
  name: string;
  lng: number;
  lat: number;
  status: RankStatus;
  waitTime: string;
  capacity: number;
  routes: number;
  description: string;
  province: string;
  type: string; // "rank" | "stop"
}

export interface MapboxTaxiRoute {
  id: string;
  from: string;
  to: string;
  fromName: string;
  toName: string;
  coordinates: [number, number][];
  color: string;
  fare: string;
  distance: string;
  duration: string;
  routeName: string;
}

// ─── Province Color Palette ─────────────────────────────────────────────────

const PROVINCE_COLORS: Record<string, string> = {
  "Gauteng": "#E72369",
  "Western Cape": "#1976D2",
  "KwaZulu-Natal": "#28A745",
  "Eastern Cape": "#FF5722",
  "Free State": "#FFA000",
  "Mpumalanga": "#9C27B0",
  "Limpopo": "#00BCD4",
  "North West": "#795548",
  "Northern Cape": "#607D8B",
};

// Route line color palette (cycled for visual variety)
const ROUTE_COLORS = [
  "#E72369", "#1976D2", "#28A745", "#FF5722", "#FFA000",
  "#9C27B0", "#00BCD4", "#795548", "#607D8B", "#E91E63",
  "#3F51B5", "#4CAF50", "#FF9800", "#F44336", "#009688",
  "#673AB7", "#2196F3", "#8BC34A", "#FF5252", "#00E676",
  "#448AFF", "#FF6D00", "#76FF03", "#D500F9", "#1DE9B6",
];

// ─── Build Coordinate Lookup ────────────────────────────────────────────────

interface LocEntry {
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  province?: string;
  city?: string;
  address?: string;
}

const allLocations = taxiLocationsData as LocEntry[];

// Build a lookup map: lowercase name → location
const locLookup = new Map<string, LocEntry>();
for (const loc of allLocations) {
  if (loc.name && loc.latitude && loc.longitude) {
    locLookup.set(loc.name.toLowerCase().trim(), loc);
  }
}

function findLocation(name: string): LocEntry | undefined {
  const lower = name.toLowerCase().trim();

  // 1. Exact match
  if (locLookup.has(lower)) return locLookup.get(lower);

  // 2. Partial match (contains or is contained)
  for (const [key, loc] of locLookup) {
    if (lower.includes(key) || key.includes(lower)) return loc;
  }

  // 3. Word-level match (match significant words)
  const words = lower.split(/[\s\-,()]+/).filter((w) => w.length > 3);
  for (const [key, loc] of locLookup) {
    let matchCount = 0;
    for (const word of words) {
      if (key.includes(word)) matchCount++;
    }
    // Require at least 2 matching words, or 1 if only 1 significant word
    if (matchCount >= Math.min(2, words.length) && matchCount > 0) return loc;
  }

  return undefined;
}

// ─── Generate RANKS from all locations ──────────────────────────────────────

// Count how many routes reference each location (for the "routes" field)
const routeCountByLocation = new Map<string, number>();
for (const route of taxiRoutesFaresData as any[]) {
  const parts = (route.routeName || "").split(" - ");
  if (parts.length === 2) {
    const originKey = parts[0].trim().toLowerCase();
    const destKey = parts[1].trim().toLowerCase();
    routeCountByLocation.set(originKey, (routeCountByLocation.get(originKey) || 0) + 1);
    routeCountByLocation.set(destKey, (routeCountByLocation.get(destKey) || 0) + 1);
  }
}

// Assign pseudo-random status based on route count
function getStatus(routeCount: number): RankStatus {
  if (routeCount >= 5) return "busy";
  if (routeCount >= 2) return "moderate";
  return "quiet";
}

function getWaitTime(status: RankStatus): string {
  switch (status) {
    case "busy": return `${3 + Math.floor(Math.random() * 8)} min`;
    case "moderate": return `${8 + Math.floor(Math.random() * 10)} min`;
    case "quiet": return `${2 + Math.floor(Math.random() * 5)} min`;
  }
}

function getCapacity(status: RankStatus): number {
  switch (status) {
    case "busy": return 65 + Math.floor(Math.random() * 30);
    case "moderate": return 35 + Math.floor(Math.random() * 30);
    case "quiet": return 10 + Math.floor(Math.random() * 30);
  }
}

// Seed random for deterministic results
let seed = 42;
function seededRandom(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

export const RANKS: MapboxTaxiRank[] = allLocations.map((loc, index) => {
  const nameKey = loc.name.toLowerCase().trim();
  const routeCount = routeCountByLocation.get(nameKey) || 0;
  // Also check partial matches for route count
  let totalRouteCount = routeCount;
  for (const [key, count] of routeCountByLocation) {
    if (key !== nameKey && (key.includes(nameKey) || nameKey.includes(key))) {
      totalRouteCount += count;
    }
  }

  const status = getStatus(totalRouteCount);
  seed = 42 + index; // Reset seed per location for determinism

  return {
    id: `loc-${index}`,
    name: loc.name,
    lng: loc.longitude,
    lat: loc.latitude,
    status,
    waitTime: getWaitTime(status),
    capacity: getCapacity(status),
    routes: totalRouteCount,
    description: loc.address || `${loc.name} - ${loc.province || "South Africa"}`,
    province: loc.province || "",
    type: loc.type || "rank",
  };
});

// ─── Generate ROUTES from taxi_routes_fares.json ────────────────────────────

interface RouteEntry {
  id: number;
  routeName: string;
  origin: string;
  destination: string;
  fare: number | null;
  fareDisplay: string;
  distance: string | null;
  estimatedTime: string | null;
  association: string | null;
}

const allRouteData = taxiRoutesFaresData as RouteEntry[];

// Build routes that have matchable coordinates
const matchedRoutes: MapboxTaxiRoute[] = [];
let colorIndex = 0;

for (const route of allRouteData) {
  const parts = (route.routeName || "").split(" - ");
  if (parts.length !== 2) continue;

  const originName = parts[0].trim();
  const destName = parts[1].trim();
  const originLoc = findLocation(originName);
  const destLoc = findLocation(destName);

  if (!originLoc || !destLoc) continue;

  // Skip routes where origin and destination are the same point
  if (
    Math.abs(originLoc.latitude - destLoc.latitude) < 0.001 &&
    Math.abs(originLoc.longitude - destLoc.longitude) < 0.001
  ) continue;

  // Generate intermediate waypoints for a smooth curve between origin and dest
  const numPoints = 6;
  const coordinates: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    // Add slight curve offset for visual clarity
    const curveOffset = Math.sin(t * Math.PI) * 0.015 * (colorIndex % 2 === 0 ? 1 : -1);
    const lng = originLoc.longitude + (destLoc.longitude - originLoc.longitude) * t + curveOffset;
    const lat = originLoc.latitude + (destLoc.latitude - originLoc.latitude) * t;
    coordinates.push([lng, lat]);
  }

  const fare = route.fare ? `R${route.fare}` : route.fareDisplay || "Price TBD";
  const distance = route.distance || "—";
  const duration = route.estimatedTime || "—";

  matchedRoutes.push({
    id: `route-${route.id}`,
    from: `loc-${allLocations.findIndex((l) => l.name === originLoc.name)}`,
    to: `loc-${allLocations.findIndex((l) => l.name === destLoc.name)}`,
    fromName: originLoc.name,
    toName: destLoc.name,
    coordinates,
    color: ROUTE_COLORS[colorIndex % ROUTE_COLORS.length],
    fare,
    distance,
    duration,
    routeName: route.routeName,
  });

  colorIndex++;
}

export const ROUTES: MapboxTaxiRoute[] = matchedRoutes;

// ─── Status Config ──────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<RankStatus, { color: string; label: string }> = {
  busy: { color: "#E72369", label: "Busy" },
  moderate: { color: "#FFA000", label: "Moderate" },
  quiet: { color: "#28A745", label: "Quiet" },
};

// ─── South Africa Center (for initial camera) ──────────────────────────────

export const GAUTENG_CENTER = {
  lng: 28.0473,
  lat: -26.1715,
  zoom: 9.5,
};

// Full SA view for when showing all provinces
export const SA_CENTER = {
  lng: 25.5,
  lat: -29.0,
  zoom: 5.5,
};

// Province centers for quick navigation
export const PROVINCE_CENTERS: Record<string, { lng: number; lat: number; zoom: number }> = {
  "Gauteng": { lng: 28.0473, lat: -26.1715, zoom: 9.5 },
  "Western Cape": { lng: 18.9, lat: -33.5, zoom: 8 },
  "KwaZulu-Natal": { lng: 30.0, lat: -29.5, zoom: 8 },
  "Eastern Cape": { lng: 27.5, lat: -32.0, zoom: 7.5 },
  "Free State": { lng: 26.5, lat: -29.0, zoom: 7.5 },
  "Mpumalanga": { lng: 30.0, lat: -25.5, zoom: 8 },
  "Limpopo": { lng: 29.5, lat: -23.5, zoom: 7.5 },
  "North West": { lng: 26.0, lat: -26.0, zoom: 8 },
  "Northern Cape": { lng: 21.0, lat: -29.0, zoom: 6.5 },
};

// ─── Exports Summary ────────────────────────────────────────────────────────

export const DATA_SUMMARY = {
  totalLocations: RANKS.length,
  totalRoutes: ROUTES.length,
  provinces: [...new Set(RANKS.map((r) => r.province).filter(Boolean))],
  ranksByProvince: RANKS.reduce((acc, r) => {
    if (r.province) {
      acc[r.province] = (acc[r.province] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>),
};

import AsyncStorage from "@react-native-async-storage/async-storage";
import { MAPBOX_ACCESS_TOKEN } from "@/constants/mapbox";

/**
 * Snap a route between two endpoints to the actual South African road
 * network via the Mapbox Directions API.
 *
 * The bundled ROUTES (client/data/mapbox_transit_data.ts) currently
 * synthesise a 6-point sine curve between origin and destination —
 * visually clear but drawn straight across buildings, rivers, and
 * highways. This helper replaces that curve with a polyline that
 * follows real driving roads, which is a non-negotiable for a minibus-
 * taxi routing app.
 *
 * Results are cached in AsyncStorage keyed by origin→destination so
 * subsequent boots render instantly and we don't burn Mapbox requests
 * on the same route pair twice. Failures fall back to the raw input
 * — the caller keeps drawing something rather than blanking the
 * polyline.
 */

type LngLat = [number, number];
const CACHE_PREFIX = "@haibo/snap-v1/";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REQUEST_TIMEOUT_MS = 8_000;

interface CachedSnap {
  coords: LngLat[];
  at: number;
}

function cacheKey(origin: LngLat, dest: LngLat) {
  // 4dp is ~11m at SA latitudes — plenty of precision for route snapping
  // while keeping the key stable against trivial input jitter.
  const r = (n: number) => n.toFixed(4);
  return `${CACHE_PREFIX}${r(origin[0])},${r(origin[1])};${r(dest[0])},${r(dest[1])}`;
}

async function readCache(key: string): Promise<LngLat[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: CachedSnap = JSON.parse(raw);
    if (!parsed?.coords || !Array.isArray(parsed.coords)) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.coords;
  } catch {
    return null;
  }
}

async function writeCache(key: string, coords: LngLat[]) {
  try {
    const entry: CachedSnap = { coords, at: Date.now() };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Cache write failures aren't fatal — we'll just re-fetch next boot.
  }
}

function isValidPair(p: unknown): p is LngLat {
  return (
    Array.isArray(p) &&
    p.length === 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1])
  );
}

/**
 * Snap a single origin → destination pair to the road network.
 * Returns snapped LngLat coordinates, or the original two endpoints
 * if Mapbox is unreachable / returns an empty route.
 */
export async function snapRouteToRoads(
  origin: LngLat,
  dest: LngLat,
): Promise<LngLat[]> {
  if (!isValidPair(origin) || !isValidPair(dest)) return [origin, dest];

  const key = cacheKey(origin, dest);
  const cached = await readCache(key);
  if (cached) return cached;

  // Mapbox Directions API: driving profile (minibus taxis share roads
  // with cars), geojson geometry so we can feed the result straight
  // back into our LineString, full overview so short urban routes
  // don't get simplified away.
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${origin[0]},${origin[1]};${dest[0]},${dest[1]}` +
    `?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [origin, dest];
    const data = await res.json();
    const raw = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(raw) || raw.length < 2) return [origin, dest];
    const coords: LngLat[] = raw.filter(isValidPair);
    if (coords.length < 2) return [origin, dest];
    await writeCache(key, coords);
    return coords;
  } catch {
    // Timeout, network error, token trouble — fall back to raw so the
    // user still sees a line, even if it's a straight one.
    return [origin, dest];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Snap many routes concurrently with a small parallelism cap. Calls
 * `onProgress` each time a route finishes so callers can stream
 * updates into state and have the polylines redraw as they resolve.
 */
export async function snapRoutesInBatches<R extends { id: string; coordinates: LngLat[] }>(
  routes: R[],
  onProgress: (routeId: string, snapped: LngLat[]) => void,
  concurrency = 3,
): Promise<void> {
  let cursor = 0;
  const run = async () => {
    while (cursor < routes.length) {
      const mine = routes[cursor++];
      if (!mine) break;
      const first = mine.coordinates[0];
      const last = mine.coordinates[mine.coordinates.length - 1];
      if (!isValidPair(first) || !isValidPair(last)) continue;
      const snapped = await snapRouteToRoads(first, last);
      onProgress(mine.id, snapped);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, run));
}

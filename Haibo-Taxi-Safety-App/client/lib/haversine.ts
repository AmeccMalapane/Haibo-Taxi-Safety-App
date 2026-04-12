const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_M = 6371000;

interface LatLng {
  latitude: number;
  longitude: number;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateDistance(
  point1: LatLng,
  point2: LatLng,
  unit: "km" | "m" = "km"
): number {
  const lat1Rad = toRadians(point1.latitude);
  const lat2Rad = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLng = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const radius = unit === "km" ? EARTH_RADIUS_KM : EARTH_RADIUS_M;
  return radius * c;
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)}km`;
  }
  return `${Math.round(distanceKm)}km`;
}

export function isWithinRadius(
  point1: LatLng,
  point2: LatLng,
  radiusKm: number
): boolean {
  return calculateDistance(point1, point2, "km") <= radiusKm;
}

export function findNearestPoint<T extends LatLng>(
  origin: LatLng,
  points: T[]
): T | null {
  if (points.length === 0) return null;

  let nearest = points[0];
  let minDistance = calculateDistance(origin, nearest, "km");

  for (let i = 1; i < points.length; i++) {
    const distance = calculateDistance(origin, points[i], "km");
    if (distance < minDistance) {
      minDistance = distance;
      nearest = points[i];
    }
  }

  return nearest;
}

export function sortByDistance<T extends LatLng>(
  origin: LatLng,
  points: T[]
): Array<T & { distance: number }> {
  return points
    .map((point) => ({
      ...point,
      distance: calculateDistance(origin, point, "km"),
    }))
    .sort((a, b) => a.distance - b.distance);
}

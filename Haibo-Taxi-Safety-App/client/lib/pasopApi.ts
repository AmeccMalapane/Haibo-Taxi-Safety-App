import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { PasopReport, PasopCategory } from "@/data/pasopReports";

/**
 * Server wrapper for the Pasop (community hazard reports) API.
 *
 * The mobile app was originally local-first — reports lived in AsyncStorage
 * and never left the device. Phase 5B added a real server table so the
 * Command Center can see and moderate them. This module is the thin
 * network layer; client/data/pasopReports.ts consults it first and falls
 * back to AsyncStorage when the server is unreachable so the feature
 * still works on patchy networks and in guest mode.
 *
 * The server expects createdAt/expiresAt as Date/ISO strings but returns
 * them as ms timestamps (see toClientShape in server/routes/pasop.ts)
 * so the existing PasopReport shape stays intact.
 */

export function isPasopServerAvailable(): boolean {
  return !!getApiUrl();
}

export async function fetchServerReports(bbox?: {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}): Promise<PasopReport[]> {
  let path = "/api/pasop/reports";
  if (bbox) {
    const q = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
    path += `?bbox=${encodeURIComponent(q)}`;
  }
  const res = await apiRequest(path, { method: "GET" });
  const rows: PasopReport[] = (res?.data || []).map((r: any) => ({
    id: r.id,
    category: r.category as PasopCategory,
    latitude: r.latitude,
    longitude: r.longitude,
    description: r.description,
    reporterId: r.reporterId || "",
    reporterName: r.reporterName,
    petitionCount: r.petitionCount || 0,
    petitioners: r.petitioners || [],
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  }));
  return rows;
}

export async function postServerReport(input: {
  category: PasopCategory;
  latitude: number;
  longitude: number;
  description?: string;
  reporterName?: string;
}): Promise<PasopReport> {
  const r = await apiRequest("/api/pasop/reports", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return {
    id: r.id,
    category: r.category,
    latitude: r.latitude,
    longitude: r.longitude,
    description: r.description,
    reporterId: r.reporterId || "",
    reporterName: r.reporterName,
    petitionCount: r.petitionCount || 0,
    petitioners: r.petitioners || [],
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  };
}

export async function postServerPetition(
  reportId: string,
  petitionerId: string
): Promise<PasopReport> {
  const r = await apiRequest(`/api/pasop/reports/${reportId}/petition`, {
    method: "POST",
    body: JSON.stringify({ petitionerId }),
  });
  return {
    id: r.id,
    category: r.category,
    latitude: r.latitude,
    longitude: r.longitude,
    description: r.description,
    reporterId: r.reporterId || "",
    reporterName: r.reporterName,
    petitionCount: r.petitionCount || 0,
    petitioners: r.petitioners || [],
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
  };
}

/**
 * Pasop — Community Hazard Reports & Safe-Trip Progress Bar (STPB) data layer
 *
 * Pasop ("watch out" in Afrikaans) is the Waze-style hazard-reporting layer
 * for the Haibo taxi safety app. Each report has a category, GPS, age-based
 * weight, and a community petition flow ("still there?").
 *
 * STPB scoring derives a 0-100 safety value per route segment by aggregating
 * Pasop reports along the segment with time-decay weighting:
 *   < 1h old  → 100% weight
 *   1-4h old  → 50% weight
 *   4-24h old → 10% weight
 *   > 24h     → excluded (effectively expired)
 *
 * Storage is local-first via AsyncStorage. Server endpoints documented in
 * the Vault at `Analyzing Waze Features.../IMPLEMENTATION-GUIDE-PART3.md`
 * can be wired later — the shapes here are designed to map directly to
 * `GET /api/pasop-reports`, `POST /api/pasop-reports`, and the WebSocket
 * stream `/api/pasop-reports/stream`.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Feather } from "@expo/vector-icons";
import { BrandColors } from "@/constants/theme";
import {
  isPasopServerAvailable,
  fetchServerReports,
  postServerReport,
  postServerPetition,
} from "@/lib/pasopApi";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PasopCategory =
  | "reckless_driving"
  | "unsafe_vehicle"
  | "accident"
  | "robbery_risk"
  | "roadblock"
  | "police_checkpoint"
  | "full_taxi"
  | "rank_congestion";

export type PasopStatus = "active" | "expired" | "resolved";

export interface PasopReport {
  id: string;
  category: PasopCategory;
  latitude: number;
  longitude: number;
  description?: string;
  reporterId: string;
  reporterName?: string;
  createdAt: number;
  expiresAt: number;
  petitionCount: number;
  petitioners: string[];
  status: PasopStatus;
}

export interface SafetyCoord {
  latitude: number;
  longitude: number;
}

export type SafetyLevel = "safe" | "good" | "caution" | "warning" | "danger";

export interface STPBSegment {
  id: string;
  index: number;
  start: SafetyCoord;
  end: SafetyCoord;
  midpoint: SafetyCoord;
  reportCount: number;
  safetyScore: number;
  level: SafetyLevel;
  reports: PasopReport[];
}

// ─── Categories ─────────────────────────────────────────────────────────────

export interface PasopCategoryConfig {
  id: PasopCategory;
  label: string;
  shortLabel: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  severity: 1 | 2 | 3 | 4 | 5;
  ttlHours: number;
  description: string;
}

export const PASOP_CATEGORIES: Record<PasopCategory, PasopCategoryConfig> = {
  reckless_driving: {
    id: "reckless_driving",
    label: "Reckless driving",
    shortLabel: "Reckless",
    icon: "alert-triangle",
    color: BrandColors.status.emergency,
    severity: 5,
    ttlHours: 4,
    description: "Speeding, dangerous overtaking, ignoring signals",
  },
  unsafe_vehicle: {
    id: "unsafe_vehicle",
    label: "Unsafe vehicle",
    shortLabel: "Unsafe",
    icon: "alert-octagon",
    color: BrandColors.status.emergency,
    severity: 5,
    ttlHours: 24,
    description: "Bald tyres, broken brakes, unfit taxi",
  },
  accident: {
    id: "accident",
    label: "Accident",
    shortLabel: "Crash",
    icon: "alert-circle",
    color: BrandColors.status.emergency,
    severity: 5,
    ttlHours: 6,
    description: "Crash or collision blocking the road",
  },
  robbery_risk: {
    id: "robbery_risk",
    label: "Robbery risk",
    shortLabel: "Robbery",
    icon: "shield-off",
    color: BrandColors.status.emergency,
    severity: 4,
    ttlHours: 12,
    description: "Hijacking or theft hotspot reported",
  },
  roadblock: {
    id: "roadblock",
    label: "Roadblock",
    shortLabel: "Block",
    icon: "x-octagon",
    color: BrandColors.status.warning,
    severity: 3,
    ttlHours: 6,
    description: "Construction, protest, or blocked road",
  },
  police_checkpoint: {
    id: "police_checkpoint",
    label: "Police checkpoint",
    shortLabel: "Police",
    icon: "flag",
    color: BrandColors.status.warning,
    severity: 2,
    ttlHours: 4,
    description: "Active checkpoint or roadside stop",
  },
  full_taxi: {
    id: "full_taxi",
    label: "Full taxis",
    shortLabel: "Full",
    icon: "users",
    color: BrandColors.status.info,
    severity: 1,
    ttlHours: 2,
    description: "All taxis full at this rank or stop",
  },
  rank_congestion: {
    id: "rank_congestion",
    label: "Rank congestion",
    shortLabel: "Queue",
    icon: "clock",
    color: BrandColors.status.info,
    severity: 1,
    ttlHours: 2,
    description: "Long queues, slow turnover",
  },
};

export const PASOP_CATEGORY_LIST: PasopCategoryConfig[] =
  Object.values(PASOP_CATEGORIES);

// ─── Safety colour scale (used by STPB) ────────────────────────────────────

export interface SafetyLevelConfig {
  level: SafetyLevel;
  label: string;
  color: string;
  minScore: number;
}

export const SAFETY_LEVELS: SafetyLevelConfig[] = [
  { level: "safe", label: "Safe", color: BrandColors.status.success, minScore: 90 },
  { level: "good", label: "Good", color: "#5BC97A", minScore: 70 },
  { level: "caution", label: "Caution", color: BrandColors.status.warning, minScore: 50 },
  { level: "warning", label: "Warning", color: "#F57C00", minScore: 30 },
  { level: "danger", label: "Danger", color: BrandColors.status.emergency, minScore: 0 },
];

export function getSafetyLevel(score: number): SafetyLevelConfig {
  for (const lvl of SAFETY_LEVELS) {
    if (score >= lvl.minScore) return lvl;
  }
  return SAFETY_LEVELS[SAFETY_LEVELS.length - 1];
}

// ─── Storage Keys ───────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  PASOP_REPORTS: "@haibo_pasop_reports",
  PASOP_PETITIONS: "@haibo_pasop_petitions",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function generatePasopId(): string {
  return `pasop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getReportAgeMinutes(report: PasopReport): number {
  return Math.floor((Date.now() - report.createdAt) / 60000);
}

export function getReportAgeLabel(report: PasopReport): string {
  const minutes = getReportAgeMinutes(report);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isReportActive(report: PasopReport): boolean {
  return report.status === "active" && Date.now() < report.expiresAt;
}

/**
 * Time-decay weight per the spec:
 *   < 1h  → 1.00
 *   1-4h  → 0.50
 *   4-24h → 0.10
 *   > 24h → 0.00 (excluded)
 */
export function computeReportWeight(report: PasopReport): number {
  const hours = (Date.now() - report.createdAt) / 3_600_000;
  if (hours < 1) return 1;
  if (hours < 4) return 0.5;
  if (hours < 24) return 0.1;
  return 0;
}

/**
 * Haversine distance in kilometres.
 */
export function haversineKm(a: SafetyCoord, b: SafetyCoord): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function getReportsNearby(
  reports: PasopReport[],
  origin: SafetyCoord,
  radiusKm: number
): PasopReport[] {
  return reports
    .filter(isReportActive)
    .filter((r) => haversineKm({ latitude: r.latitude, longitude: r.longitude }, origin) <= radiusKm);
}

/**
 * Compute a 0-100 safety score from a set of reports.
 * Higher is safer. The score starts at 100 and is reduced by each report's
 * severity weighted by recency. Capped at 0.
 */
export function computeSafetyScore(reports: PasopReport[]): number {
  if (reports.length === 0) return 100;
  let penalty = 0;
  for (const r of reports) {
    const cat = PASOP_CATEGORIES[r.category];
    if (!cat) continue;
    const weight = computeReportWeight(r);
    if (weight === 0) continue;
    // severity 1-5 maps to 4-20 penalty per report
    penalty += cat.severity * 4 * weight;
  }
  return Math.max(0, Math.round(100 - penalty));
}

// ─── STPB segment computation ───────────────────────────────────────────────

/**
 * Interpolate between two coordinates by ratio (0..1).
 */
function interpolateCoord(a: SafetyCoord, b: SafetyCoord, t: number): SafetyCoord {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

/**
 * Split a route polyline into N approximately-equal segments.
 * Falls back to a single segment if the polyline has fewer than 2 points.
 */
export function splitRouteIntoSegments(
  polyline: SafetyCoord[],
  segmentCount: number
): { start: SafetyCoord; end: SafetyCoord; midpoint: SafetyCoord }[] {
  if (polyline.length < 2 || segmentCount < 1) return [];

  // Compute cumulative distance along the polyline
  const cumulative: number[] = [0];
  for (let i = 1; i < polyline.length; i++) {
    cumulative.push(cumulative[i - 1] + haversineKm(polyline[i - 1], polyline[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return [];

  const segLen = total / segmentCount;
  const segments: {
    start: SafetyCoord;
    end: SafetyCoord;
    midpoint: SafetyCoord;
  }[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const startDist = i * segLen;
    const endDist = (i + 1) * segLen;
    const midDist = startDist + segLen / 2;

    const findCoord = (target: number): SafetyCoord => {
      for (let j = 1; j < cumulative.length; j++) {
        if (cumulative[j] >= target) {
          const t =
            (target - cumulative[j - 1]) /
            Math.max(0.0001, cumulative[j] - cumulative[j - 1]);
          return interpolateCoord(polyline[j - 1], polyline[j], t);
        }
      }
      return polyline[polyline.length - 1];
    };

    segments.push({
      start: findCoord(startDist),
      end: findCoord(endDist),
      midpoint: findCoord(midDist),
    });
  }
  return segments;
}

/**
 * Build STPB segments for a route, scoring each one against nearby Pasop reports.
 * Default: 8 segments, 1km report radius around each segment midpoint.
 */
export function buildSTPBSegments(
  polyline: SafetyCoord[],
  reports: PasopReport[],
  options?: { segmentCount?: number; radiusKm?: number }
): STPBSegment[] {
  const segmentCount = options?.segmentCount ?? 8;
  const radiusKm = options?.radiusKm ?? 1;

  const splits = splitRouteIntoSegments(polyline, segmentCount);
  return splits.map((s, i) => {
    const nearby = getReportsNearby(reports, s.midpoint, radiusKm);
    const score = computeSafetyScore(nearby);
    const lvl = getSafetyLevel(score);
    return {
      id: `seg_${i}`,
      index: i,
      start: s.start,
      end: s.end,
      midpoint: s.midpoint,
      reportCount: nearby.length,
      safetyScore: score,
      level: lvl.level,
      reports: nearby,
    };
  });
}

// ─── Storage Operations ─────────────────────────────────────────────────────
//
// Server-first with AsyncStorage as a cache + offline fallback. The
// previous version stored everything locally and never left the device;
// Phase 5B added a real /api/pasop route so reports can be moderated
// and viewed across users. We keep the AsyncStorage path because the
// feature still has to work in guest mode and on patchy South African
// networks where the commuter has the most reason to be reading hazards.

async function readLocalReports(): Promise<PasopReport[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PASOP_REPORTS);
    if (!data) return getSeedReports();
    const parsed: PasopReport[] = JSON.parse(data);
    return parsed.map((r) => ({
      ...r,
      status: Date.now() >= r.expiresAt ? "expired" : r.status,
    }));
  } catch {
    return getSeedReports();
  }
}

async function writeLocalReports(reports: PasopReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.PASOP_REPORTS,
      JSON.stringify(reports)
    );
  } catch {
    // best-effort — if AsyncStorage is full the server path still works
  }
}

export async function getPasopReports(): Promise<PasopReport[]> {
  if (isPasopServerAvailable()) {
    try {
      const serverReports = await fetchServerReports();
      // Refresh the local cache so the next offline read has real data
      // instead of stale seed rows.
      await writeLocalReports(serverReports);
      return serverReports.map((r) => ({
        ...r,
        status: Date.now() >= r.expiresAt ? "expired" : r.status,
      }));
    } catch {
      // Fall through to local cache on network failure
    }
  }
  return readLocalReports();
}

export async function savePasopReport(report: PasopReport): Promise<void> {
  // Try the server first when available so the row lands in the shared
  // store and the Command Center sees it immediately via the realtime
  // emit. If the post fails, we still cache locally so the reporter sees
  // their own report in the feed.
  if (isPasopServerAvailable()) {
    try {
      const serverReport = await postServerReport({
        category: report.category,
        latitude: report.latitude,
        longitude: report.longitude,
        description: report.description,
        reporterName: report.reporterName,
      });
      const cached = await readLocalReports();
      const next = [
        serverReport,
        ...cached.filter((r) => r.id !== serverReport.id && r.id !== report.id),
      ];
      await writeLocalReports(next);
      return;
    } catch {
      // fall through to local-only write
    }
  }

  const reports = await readLocalReports();
  const idx = reports.findIndex((r) => r.id === report.id);
  if (idx >= 0) {
    reports[idx] = report;
  } else {
    reports.unshift(report);
  }
  await writeLocalReports(reports);
}

export async function petitionPasopReport(
  reportId: string,
  petitionerId: string
): Promise<PasopReport | null> {
  if (isPasopServerAvailable()) {
    try {
      const updated = await postServerPetition(reportId, petitionerId);
      const cached = await readLocalReports();
      const idx = cached.findIndex((r) => r.id === reportId);
      if (idx >= 0) cached[idx] = updated;
      await writeLocalReports(cached);
      return updated;
    } catch {
      // fall through to local-only petition
    }
  }

  const reports = await readLocalReports();
  const idx = reports.findIndex((r) => r.id === reportId);
  if (idx < 0) return null;
  const report = reports[idx];
  if (report.petitioners.includes(petitionerId)) return report;
  const updated: PasopReport = {
    ...report,
    petitionCount: report.petitionCount + 1,
    petitioners: [...report.petitioners, petitionerId],
    expiresAt: report.expiresAt + 30 * 60 * 1000, // each petition extends life by 30 minutes
  };
  reports[idx] = updated;
  await writeLocalReports(reports);
  return updated;
}

export async function getMyPetitions(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PASOP_PETITIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function recordMyPetition(reportId: string): Promise<void> {
  const list = await getMyPetitions();
  if (!list.includes(reportId)) {
    list.push(reportId);
    await AsyncStorage.setItem(STORAGE_KEYS.PASOP_PETITIONS, JSON.stringify(list));
  }
}

/**
 * Convenience: create a new report with sensible defaults.
 */
export function createPasopReport(input: {
  category: PasopCategory;
  latitude: number;
  longitude: number;
  reporterId: string;
  reporterName?: string;
  description?: string;
}): PasopReport {
  const cat = PASOP_CATEGORIES[input.category];
  const now = Date.now();
  return {
    id: generatePasopId(),
    category: input.category,
    latitude: input.latitude,
    longitude: input.longitude,
    description: input.description,
    reporterId: input.reporterId,
    reporterName: input.reporterName,
    createdAt: now,
    expiresAt: now + cat.ttlHours * 60 * 60 * 1000,
    petitionCount: 0,
    petitioners: [],
    status: "active",
  };
}

// ─── Seed data (Joburg-centric, for first-run demo) ─────────────────────────

function getSeedReports(): PasopReport[] {
  const now = Date.now();
  const minute = 60 * 1000;
  const hour = 60 * minute;

  const seed: Array<Omit<PasopReport, "id">> = [
    {
      category: "reckless_driving",
      latitude: -26.2041,
      longitude: 28.0473,
      description: "Taxi cutting lanes on M1 — be careful.",
      reporterId: "seed_user_1",
      reporterName: "Anonymous",
      createdAt: now - 25 * minute,
      expiresAt: now + 4 * hour - 25 * minute,
      petitionCount: 3,
      petitioners: [],
      status: "active",
    },
    {
      category: "police_checkpoint",
      latitude: -26.1715,
      longitude: 28.0453,
      description: "Roadblock on Empire Road.",
      reporterId: "seed_user_2",
      reporterName: "Anonymous",
      createdAt: now - 90 * minute,
      expiresAt: now + 2 * hour + 30 * minute,
      petitionCount: 5,
      petitioners: [],
      status: "active",
    },
    {
      category: "full_taxi",
      latitude: -26.2386,
      longitude: 28.0024,
      description: "Bara rank queue is huge this morning.",
      reporterId: "seed_user_3",
      reporterName: "Anonymous",
      createdAt: now - 12 * minute,
      expiresAt: now + 90 * minute,
      petitionCount: 8,
      petitioners: [],
      status: "active",
    },
    {
      category: "robbery_risk",
      latitude: -26.1956,
      longitude: 28.0344,
      description: "Phone snatching reported near MTN Taxi Rank.",
      reporterId: "seed_user_4",
      reporterName: "Anonymous",
      createdAt: now - 3 * hour,
      expiresAt: now + 9 * hour,
      petitionCount: 11,
      petitioners: [],
      status: "active",
    },
    {
      category: "roadblock",
      latitude: -26.1488,
      longitude: 28.0436,
      description: "Construction near Wits — slow traffic.",
      reporterId: "seed_user_5",
      reporterName: "Anonymous",
      createdAt: now - 2 * hour,
      expiresAt: now + 4 * hour,
      petitionCount: 2,
      petitioners: [],
      status: "active",
    },
  ];

  return seed.map((r) => ({ ...r, id: generatePasopId() }));
}

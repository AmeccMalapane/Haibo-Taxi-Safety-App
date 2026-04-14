/**
 * Community Route Contribution System — Data Types & Local Store
 * Inspired by MetroDreamin's community-first approach, adapted for SA taxi routes.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type RouteStatus = "pending" | "verified" | "rejected";
export type RouteType = "local" | "regional" | "intercity";
export type VehicleType = "minibus" | "metered" | "e-hailing" | "bus";

export interface RouteWaypoint {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  isStop: boolean; // true = passenger stop, false = waypoint only
  order: number;
}

export interface CommunityRoute {
  id: string;
  // Route info
  name: string;
  description: string;
  routeType: RouteType;
  vehicleType: VehicleType;
  // Waypoints & path
  waypoints: RouteWaypoint[];
  color: string;
  // Taxi-specific metadata
  fare: number;
  currency: string;
  handSignal: string;
  handSignalDescription: string;
  association: string;
  operatingHours: string;
  frequency: string; // e.g., "Every 10 min"
  province: string;
  // Community
  contributorId: string;
  contributorName: string;
  status: RouteStatus;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  points: number;
  stars: number;
  starredBy: string[];
  // Timestamps
  createdAt: number;
  updatedAt: number;
  verifiedAt?: number;
}

export interface RouteComment {
  id: string;
  routeId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

export interface ContributorProfile {
  id: string;
  name: string;
  routesContributed: number;
  routesVerified: number;
  stopsAdded: number;
  verifications: number;
  totalPoints: number;
  totalStars: number;
  joinedAt: number;
  badge: "newcomer" | "contributor" | "expert" | "legend";
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const ASSOCIATIONS = [
  "SANTACO",
  "NTA",
  "CODETA",
  "UNCEDO",
  "CATA",
  "SATA",
  "LNTA",
  "Other",
];

export const HAND_SIGNALS = [
  { id: "point_up", label: "Point Up", emoji: "☝️" },
  { id: "point_down", label: "Point Down", emoji: "👇" },
  { id: "fist", label: "Fist", emoji: "✊" },
  { id: "flat_hand", label: "Flat Hand", emoji: "🖐️" },
  { id: "two_fingers", label: "Two Fingers", emoji: "✌️" },
  { id: "circle", label: "Circle", emoji: "👌" },
  { id: "wave", label: "Wave", emoji: "👋" },
  { id: "thumbs_up", label: "Thumbs Up", emoji: "👍" },
];

export const ROUTE_COLORS = [
  "#E72369", "#1976D2", "#28A745", "#FF5722", "#FFA000",
  "#9C27B0", "#00BCD4", "#795548", "#607D8B", "#E91E63",
  "#3F51B5", "#4CAF50", "#FF9800", "#F44336", "#009688",
  "#673AB7", "#2196F3", "#8BC34A", "#FF5252", "#00E676",
  "#448AFF",
];

export const PROVINCES = [
  "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape",
  "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape",
];

export const BADGE_CONFIG = {
  newcomer: { label: "Newcomer", color: "#9E9E9E", minPoints: 0 },
  contributor: { label: "Contributor", color: "#1976D2", minPoints: 50 },
  expert: { label: "Expert", color: "#FF9800", minPoints: 200 },
  legend: { label: "Legend", color: "#C81E5E", minPoints: 500 },
};

// ─── Points System ──────────────────────────────────────────────────────────

export const POINTS = {
  SUBMIT_ROUTE: 10,
  ROUTE_VERIFIED: 25,
  ROUTE_STARRED: 2,
  UPVOTE_RECEIVED: 1,
  COMMENT_ADDED: 3,
  COMMENT: 3,
  ADD_STOP: 5,
  FIRST_ROUTE: 20, // bonus
};

// ─── Local Storage Keys ─────────────────────────────────────────────────────

const STORAGE_KEYS = {
  COMMUNITY_ROUTES: "@haibo_community_routes",
  MY_CONTRIBUTIONS: "@haibo_my_contributions",
  MY_VOTES: "@haibo_my_votes",
  MY_STARS: "@haibo_my_stars",
  MY_PROFILE: "@haibo_contributor_profile",
  ROUTE_COMMENTS: "@haibo_route_comments",
};

// ─── Helper Functions ───────────────────────────────────────────────────────

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function calculatePoints(route: CommunityRoute): number {
  let pts = POINTS.SUBMIT_ROUTE;
  if (route.status === "verified") pts += POINTS.ROUTE_VERIFIED;
  pts += route.stars * POINTS.ROUTE_STARRED;
  pts += route.upvotes * POINTS.UPVOTE_RECEIVED;
  return pts;
}

export function getBadge(totalPoints: number): ContributorProfile["badge"] {
  if (totalPoints >= BADGE_CONFIG.legend.minPoints) return "legend";
  if (totalPoints >= BADGE_CONFIG.expert.minPoints) return "expert";
  if (totalPoints >= BADGE_CONFIG.contributor.minPoints) return "contributor";
  return "newcomer";
}

// ─── Storage Operations ─────────────────────────────────────────────────────

export async function getCommunityRoutes(): Promise<CommunityRoute[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.COMMUNITY_ROUTES);
    return data ? JSON.parse(data) : getSeedRoutes();
  } catch {
    return getSeedRoutes();
  }
}

export async function saveCommunityRoute(route: CommunityRoute): Promise<void> {
  const routes = await getCommunityRoutes();
  const idx = routes.findIndex((r) => r.id === route.id);
  if (idx >= 0) {
    routes[idx] = route;
  } else {
    routes.unshift(route);
  }
  await AsyncStorage.setItem(STORAGE_KEYS.COMMUNITY_ROUTES, JSON.stringify(routes));
}

export async function getMyVotes(): Promise<Record<string, "up" | "down">> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MY_VOTES);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

export async function saveVote(routeId: string, vote: "up" | "down" | null): Promise<void> {
  const votes = await getMyVotes();
  if (vote === null) {
    delete votes[routeId];
  } else {
    votes[routeId] = vote;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.MY_VOTES, JSON.stringify(votes));
}

export async function getMyStars(): Promise<string[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MY_STARS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function toggleStar(routeId: string): Promise<boolean> {
  const stars = await getMyStars();
  const idx = stars.indexOf(routeId);
  if (idx >= 0) {
    stars.splice(idx, 1);
    await AsyncStorage.setItem(STORAGE_KEYS.MY_STARS, JSON.stringify(stars));
    return false; // unstarred
  } else {
    stars.push(routeId);
    await AsyncStorage.setItem(STORAGE_KEYS.MY_STARS, JSON.stringify(stars));
    return true; // starred
  }
}

export async function getContributorProfile(): Promise<ContributorProfile> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MY_PROFILE);
    if (data) return JSON.parse(data);
  } catch {}
  // Default profile
  return {
    id: generateId(),
    name: "Anonymous Commuter",
    routesContributed: 0,
    routesVerified: 0,
    stopsAdded: 0,
    verifications: 0,
    totalPoints: 0,
    totalStars: 0,
    joinedAt: Date.now(),
    badge: "newcomer",
  };
}

export async function saveContributorProfile(profile: ContributorProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.MY_PROFILE, JSON.stringify(profile));
}

export async function getRouteComments(routeId: string): Promise<RouteComment[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTE_COMMENTS);
    const all: RouteComment[] = data ? JSON.parse(data) : [];
    return all.filter((c) => c.routeId === routeId);
  } catch {
    return [];
  }
}

export async function addRouteComment(comment: RouteComment): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ROUTE_COMMENTS);
    const all: RouteComment[] = data ? JSON.parse(data) : [];
    all.unshift(comment);
    await AsyncStorage.setItem(STORAGE_KEYS.ROUTE_COMMENTS, JSON.stringify(all));
  } catch {}
}

// ─── Seed Data (Sample Community Routes) ────────────────────────────────────

function getSeedRoutes(): CommunityRoute[] {
  return [
    {
      id: "seed_1",
      name: "Bree to Soweto (Baragwanath)",
      description: "Main route from Bree Taxi Rank in Joburg CBD to Baragwanath in Soweto. Very busy during peak hours.",
      routeType: "local",
      vehicleType: "minibus",
      waypoints: [
        { id: "w1", latitude: -26.2023, longitude: 28.0375, name: "Bree Taxi Rank", isStop: true, order: 0 },
        { id: "w2", latitude: -26.2150, longitude: 28.0250, name: "Westgate", isStop: false, order: 1 },
        { id: "w3", latitude: -26.2350, longitude: 28.0050, name: "Booysens", isStop: true, order: 2 },
        { id: "w4", latitude: -26.2550, longitude: 27.9800, name: "Nancefield", isStop: true, order: 3 },
        { id: "w5", latitude: -26.2631, longitude: 27.9443, name: "Baragwanath", isStop: true, order: 4 },
      ],
      color: "#E72369",
      fare: 18,
      currency: "ZAR",
      handSignal: "point_down",
      handSignalDescription: "Point down towards the ground — indicates Soweto direction",
      association: "SANTACO",
      operatingHours: "04:30 - 21:00",
      frequency: "Every 5-10 min",
      province: "Gauteng",
      contributorId: "seed_user_1",
      contributorName: "Thabo M.",
      status: "verified",
      upvotes: 142,
      downvotes: 3,
      commentCount: 28,
      points: 320,
      stars: 45,
      starredBy: [],
      createdAt: Date.now() - 86400000 * 30,
      updatedAt: Date.now() - 86400000 * 2,
      verifiedAt: Date.now() - 86400000 * 25,
    },
    {
      id: "seed_2",
      name: "Noord to Alexandra",
      description: "Popular route from Noord Taxi Rank to Alex township. Runs along Louis Botha Ave.",
      routeType: "local",
      vehicleType: "minibus",
      waypoints: [
        { id: "w6", latitude: -26.1975, longitude: 28.0492, name: "Noord Taxi Rank", isStop: true, order: 0 },
        { id: "w7", latitude: -26.1850, longitude: 28.0550, name: "Hillbrow", isStop: false, order: 1 },
        { id: "w8", latitude: -26.1650, longitude: 28.0700, name: "Orange Grove", isStop: true, order: 2 },
        { id: "w9", latitude: -26.1400, longitude: 28.0850, name: "Wynberg", isStop: true, order: 3 },
        { id: "w10", latitude: -26.1068, longitude: 28.0986, name: "Alexandra", isStop: true, order: 4 },
      ],
      color: "#1976D2",
      fare: 15,
      currency: "ZAR",
      handSignal: "two_fingers",
      handSignalDescription: "Show two fingers pointing up — the Alex signal",
      association: "SANTACO",
      operatingHours: "04:00 - 22:00",
      frequency: "Every 5 min",
      province: "Gauteng",
      contributorId: "seed_user_2",
      contributorName: "Sipho K.",
      status: "verified",
      upvotes: 98,
      downvotes: 5,
      commentCount: 15,
      points: 210,
      stars: 32,
      starredBy: [],
      createdAt: Date.now() - 86400000 * 45,
      updatedAt: Date.now() - 86400000 * 5,
      verifiedAt: Date.now() - 86400000 * 40,
    },
    {
      id: "seed_3",
      name: "Bellville to Cape Town CBD",
      description: "Major route connecting Bellville Station to Cape Town city centre via N1.",
      routeType: "regional",
      vehicleType: "minibus",
      waypoints: [
        { id: "w11", latitude: -33.8990, longitude: 18.6310, name: "Bellville Station", isStop: true, order: 0 },
        { id: "w12", latitude: -33.9100, longitude: 18.6000, name: "Parow", isStop: true, order: 1 },
        { id: "w13", latitude: -33.9200, longitude: 18.5500, name: "Goodwood", isStop: false, order: 2 },
        { id: "w14", latitude: -33.9250, longitude: 18.5100, name: "Maitland", isStop: true, order: 3 },
        { id: "w15", latitude: -33.9258, longitude: 18.4232, name: "Cape Town Station", isStop: true, order: 4 },
      ],
      color: "#28A745",
      fare: 22,
      currency: "ZAR",
      handSignal: "flat_hand",
      handSignalDescription: "Hold flat hand out — indicates CBD direction",
      association: "CODETA",
      operatingHours: "05:00 - 20:00",
      frequency: "Every 8-15 min",
      province: "Western Cape",
      contributorId: "seed_user_3",
      contributorName: "Nomsa D.",
      status: "verified",
      upvotes: 76,
      downvotes: 2,
      commentCount: 12,
      points: 180,
      stars: 22,
      starredBy: [],
      createdAt: Date.now() - 86400000 * 60,
      updatedAt: Date.now() - 86400000 * 10,
      verifiedAt: Date.now() - 86400000 * 55,
    },
    {
      id: "seed_4",
      name: "Warwick to Umlazi",
      description: "Busy route from Warwick Junction to Umlazi township in Durban.",
      routeType: "local",
      vehicleType: "minibus",
      waypoints: [
        { id: "w16", latitude: -29.8587, longitude: 31.0218, name: "Warwick Junction", isStop: true, order: 0 },
        { id: "w17", latitude: -29.8750, longitude: 31.0100, name: "Umbilo", isStop: true, order: 1 },
        { id: "w18", latitude: -29.9100, longitude: 30.9800, name: "Chatsworth", isStop: false, order: 2 },
        { id: "w19", latitude: -29.9600, longitude: 30.9100, name: "Umlazi", isStop: true, order: 3 },
      ],
      color: "#FF5722",
      fare: 14,
      currency: "ZAR",
      handSignal: "fist",
      handSignalDescription: "Show a fist — indicates Umlazi direction",
      association: "UNCEDO",
      operatingHours: "04:30 - 20:30",
      frequency: "Every 5-8 min",
      province: "KwaZulu-Natal",
      contributorId: "seed_user_4",
      contributorName: "Zanele N.",
      status: "verified",
      upvotes: 64,
      downvotes: 1,
      commentCount: 9,
      points: 150,
      stars: 18,
      starredBy: [],
      createdAt: Date.now() - 86400000 * 20,
      updatedAt: Date.now() - 86400000 * 3,
      verifiedAt: Date.now() - 86400000 * 15,
    },
    {
      id: "seed_5",
      name: "Pretoria Station to Mamelodi",
      description: "Route from Pretoria CBD to Mamelodi East. Passes through Silverton.",
      routeType: "local",
      vehicleType: "minibus",
      waypoints: [
        { id: "w20", latitude: -25.7479, longitude: 28.1881, name: "Pretoria Station", isStop: true, order: 0 },
        { id: "w21", latitude: -25.7400, longitude: 28.2200, name: "Sunnyside", isStop: true, order: 1 },
        { id: "w22", latitude: -25.7350, longitude: 28.2700, name: "Silverton", isStop: true, order: 2 },
        { id: "w23", latitude: -25.7200, longitude: 28.3500, name: "Mamelodi West", isStop: true, order: 3 },
        { id: "w24", latitude: -25.7100, longitude: 28.3900, name: "Mamelodi East", isStop: true, order: 4 },
      ],
      color: "#9C27B0",
      fare: 16,
      currency: "ZAR",
      handSignal: "point_up",
      handSignalDescription: "Point up — indicates Mamelodi direction",
      association: "NTA",
      operatingHours: "04:00 - 21:00",
      frequency: "Every 5-10 min",
      province: "Gauteng",
      contributorId: "seed_user_5",
      contributorName: "Mpho L.",
      status: "pending",
      upvotes: 23,
      downvotes: 2,
      commentCount: 4,
      points: 45,
      stars: 8,
      starredBy: [],
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 86400000 * 1,
    },
    {
      id: "seed_6",
      name: "Mthatha to Port St Johns",
      description: "Intercity route from Mthatha to the coast at Port St Johns. Scenic but winding road.",
      routeType: "intercity",
      vehicleType: "minibus",
      waypoints: [
        { id: "w25", latitude: -31.5889, longitude: 28.7844, name: "Mthatha Rank", isStop: true, order: 0 },
        { id: "w26", latitude: -31.5500, longitude: 29.0000, name: "Libode", isStop: true, order: 1 },
        { id: "w27", latitude: -31.6200, longitude: 29.3500, name: "Lusikisiki Junction", isStop: true, order: 2 },
        { id: "w28", latitude: -31.6253, longitude: 29.5344, name: "Port St Johns", isStop: true, order: 3 },
      ],
      color: "#00BCD4",
      fare: 80,
      currency: "ZAR",
      handSignal: "wave",
      handSignalDescription: "Wave hand — indicates long-distance route",
      association: "CATA",
      operatingHours: "06:00 - 16:00",
      frequency: "When full",
      province: "Eastern Cape",
      contributorId: "seed_user_6",
      contributorName: "Andile X.",
      status: "pending",
      upvotes: 12,
      downvotes: 0,
      commentCount: 2,
      points: 25,
      stars: 5,
      starredBy: [],
      createdAt: Date.now() - 86400000 * 7,
      updatedAt: Date.now() - 86400000 * 7,
    },
  ];
}

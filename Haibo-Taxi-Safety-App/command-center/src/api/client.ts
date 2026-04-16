/**
 * Haibo Command Center — API Client
 * Connects to the same Express backend as the mobile app.
 * Base URL configured via VITE_API_URL environment variable.
 */

const API_URL = import.meta.env.VITE_API_URL || "https://haibo-api-prod.azurewebsites.net";

let authToken: string | null = localStorage.getItem("haibo_cc_token");

function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem("haibo_cc_token", token);
  } else {
    localStorage.removeItem("haibo_cc_token");
    localStorage.removeItem("haibo_cc_user");
  }
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return headers;
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers as Record<string, string> || {}) },
  });

  if (res.status === 401) {
    setToken(null);
    window.location.href = "/login";
    throw new Error("Session expired");
  }

  // 403 "Account suspended" means the server-side authMiddleware rejected
  // us mid-session — an admin suspended this account, or (much worse) a
  // /api/user/delete flow hit our userId. Treat it like an expired
  // session: wipe the stored token, bounce to /login so the CC doesn't
  // keep making requests against an account that can't do anything.
  if (res.status === 403) {
    try {
      const body = await res.clone().text();
      if (/account suspended/i.test(body)) {
        setToken(null);
        window.location.href = "/login?reason=suspended";
        throw new Error("Account suspended");
      }
    } catch (err) {
      // Body read can fail in edge cases (aborted response). Fall
      // through to the generic error path below.
      if ((err as Error).message === "Account suspended") throw err;
    }
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }

  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const auth = {
  async login(email: string, password: string) {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    localStorage.setItem("haibo_cc_user", JSON.stringify(data.user));
    return data;
  },

  async loginWithPhone(phone: string, password: string) {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
    setToken(data.token);
    localStorage.setItem("haibo_cc_user", JSON.stringify(data.user));
    return data;
  },

  /**
   * Send a one-time code to a phone number. Server rate-limits per phone
   * and per IP so brute-forcing is bounded.
   */
  async sendOTP(phone: string) {
    return request("/api/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  /**
   * Verify the OTP and complete sign-in. Returns the same shape as login()
   * (token + user); the Command Center's LoginPage guards on role so
   * non-admin phone owners bounce straight back out.
   */
  async verifyOTP(phone: string, code: string) {
    const data = await request("/api/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, code }),
    });
    setToken(data.token);
    localStorage.setItem("haibo_cc_user", JSON.stringify(data.user));
    return data;
  },

  async getMe() {
    return request("/api/auth/me");
  },

  logout() {
    setToken(null);
    window.location.href = "/login";
  },

  getUser() {
    const stored = localStorage.getItem("haibo_cc_user");
    return stored ? JSON.parse(stored) : null;
  },

  isAuthenticated() {
    return !!authToken;
  },
};

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

export type BroadcastAudience =
  | { kind: "all" }
  | { kind: "role"; role: string }
  | { kind: "phones"; phones: string[] };

export const admin = {
  async getSystemMetrics() {
    return request("/api/admin/system-metrics");
  },

  async getEarningsAnalytics(period?: string) {
    const q = period ? `?period=${period}` : "";
    return request(`/api/admin/analytics/earnings${q}`);
  },

  async getComplianceMetrics() {
    return request("/api/admin/analytics/compliance-metrics");
  },

  async getUsers(role?: string) {
    const q = role ? `?role=${role}` : "";
    return request(`/api/admin/users${q}`);
  },

  async updateComplaint(id: string, data: { status?: string; resolution?: string; internalNotes?: string }) {
    return request(`/api/admin/complaints/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async verifyTaxi(id: string) {
    return request(`/api/admin/taxis/${id}/verify`, { method: "PUT" });
  },

  async getWithdrawals(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/api/admin/withdrawals${q}`);
  },

  async approveWithdrawal(id: string) {
    return request(`/api/admin/withdrawals/${id}/approve`, { method: "PUT" });
  },

  async rejectWithdrawal(id: string, reason: string) {
    return request(`/api/admin/withdrawals/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Moderation queues. `resource` is one of the whitelisted values on the
   * server (reels | lost-found | jobs). `status` filter is optional.
   */
  async getModerationQueue(resource: string, status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request(`/api/admin/moderation/${resource}${q}`);
  },

  async moderateContent(
    resource: string,
    id: string,
    patch: { status?: string; isVerified?: boolean; isFeatured?: boolean }
  ) {
    return request(`/api/admin/moderation/${resource}/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },

  /**
   * SOS alert queue. status filter: unresolved | resolved | all (default).
   * The response includes unresolvedCount so the dashboard can badge the
   * sidebar entry without a second request.
   */
  async getSOSAlerts(params: {
    status?: "unresolved" | "resolved" | "all";
    limit?: number;
    offset?: number;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/admin/sos-alerts${q}`);
  },

  async resolveSOSAlert(id: string) {
    return request(`/api/admin/sos-alerts/${id}/resolve`, { method: "PUT" });
  },

  /**
   * Fetch a single user's wallet for admin review. Returns the user
   * summary + recent transactions (last 50) + lifetime totals and
   * pending-outflow count. Safe to call often — it's read-only.
   */
  async getUserWallet(userId: string) {
    return request(`/api/admin/users/${userId}/wallet`);
  },

  /**
   * Credit or debit a user's wallet. `amount` is always positive; the
   * server writes a signed walletTransaction row. Reason is required
   * (min 4 chars) and lands in the admin audit log verbatim.
   */
  async adjustUserWallet(
    userId: string,
    input: { amount: number; direction: "credit" | "debit"; reason: string }
  ) {
    return request(`/api/admin/users/${userId}/wallet/adjust`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Driver KYC queue. `verified`: "true" | "false" | "all" (default all).
   * Response includes pendingCount for dashboard badging.
   */
  async getDrivers(params: { verified?: "true" | "false" | "all"; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.verified && params.verified !== "all") qs.set("verified", params.verified);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/admin/drivers${q}`);
  },

  async getDriverDetail(driverId: string) {
    return request(`/api/admin/drivers/${driverId}`);
  },

  async verifyDriver(driverId: string) {
    return request(`/api/admin/drivers/${driverId}/verify`, { method: "PUT" });
  },

  /** Remove a single driver rating (dispute resolution). Recomputes
   * the driver's aggregate safetyRating + totalRatings server-side. */
  async deleteDriverRating(ratingId: string) {
    return request(`/api/admin/ratings/${ratingId}`, { method: "DELETE" });
  },

  async unverifyDriver(driverId: string, reason?: string) {
    return request(`/api/admin/drivers/${driverId}/unverify`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
  },

  /**
   * Broadcast push notifications to a resolved audience.
   * Audience:
   *   - { kind: "all" } → every user
   *   - { kind: "role", role: "commuter"|"driver"|"owner"|"admin" }
   *   - { kind: "phones", phones: string[] } → match users by phone
   */
  async previewBroadcast(audience: BroadcastAudience) {
    return request("/api/admin/broadcast/preview", {
      method: "POST",
      body: JSON.stringify({ audience }),
    });
  },

  async sendBroadcast(input: {
    title: string;
    body: string;
    audience: BroadcastAudience;
  }) {
    return request("/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Suspend a user — blocks all authed API access until unsuspended.
   * Reason is required (min 4 chars) and lands in the audit log.
   * Admins and self-targets are rejected by the server.
   */
  async suspendUser(userId: string, reason: string) {
    return request(`/api/admin/users/${userId}/suspend`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    });
  },

  async unsuspendUser(userId: string) {
    return request(`/api/admin/users/${userId}/unsuspend`, { method: "PUT" });
  },

  /** Read-only list of group rides with optional status filter. */
  async getGroupRides(params: { status?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/admin/group-rides${q}`);
  },

  /** Referrals dashboard — stats + recent signups + top referrers. */
  async getReferrals() {
    return request("/api/admin/referrals");
  },

  /** Haibo Vault vendors — list with status filter, counts, totals. */
  async getVendors(params: { status?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/admin/vendors${q}`);
  },

  /** Full vendor record plus the 10 most recent completed sales. */
  async getVendorDetail(vendorId: string) {
    return request(`/api/admin/vendors/${vendorId}`);
  },

  /** Transition a vendor profile between pending/verified/suspended. */
  async setVendorStatus(vendorId: string, status: "pending" | "verified" | "suspended") {
    return request(`/api/admin/vendors/${vendorId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },

  /** Read-only list of P2P wallet transfers with optional status filter. */
  async getP2PTransfers(params: { status?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/admin/p2p-transfers${q}`);
  },

  /** Read-only list of deliveries with optional status filter. */
  async getDeliveries(params: { status?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/admin/deliveries${q}`);
  },

  /**
   * Audit log — append-only record of admin writes. Supports optional
   * action/resource filters and cursor-style limit/offset pagination.
   */
  /** Read the City Explorer crowdsourced contributions (fare surveys,
   * stop pins, photos) for admin audit. Admins can spot bogus fares
   * or off-grid stop pins before they contaminate taxi route data. */
  async getExplorerContributions(params: {
    kind: "fare" | "stop" | "photo";
    limit?: number;
    offset?: number;
  }) {
    const qs = new URLSearchParams();
    qs.set("kind", params.kind);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    return request(`/api/admin/explorer/contributions?${qs.toString()}`);
  },

  async getAuditLog(params: {
    action?: string;
    resource?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.action) qs.set("action", params.action);
    if (params.resource) qs.set("resource", params.resource);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/admin/audit-log${q}`);
  },
};

/**
 * Token accessor for the Socket.IO client — lives here so the WebSocket
 * handshake reads the same localStorage key as the HTTP client without
 * duplicating the storage convention.
 */
export function getStoredToken(): string | null {
  return localStorage.getItem("haibo_cc_token");
}

export function getApiUrl(): string {
  return API_URL;
}

// ─── Taxis ───────────────────────────────────────────────────────────────────

export const taxis = {
  async list(page = 1, limit = 25) {
    return request(`/api/taxis?page=${page}&limit=${limit}`);
  },

  async getById(id: string) {
    return request(`/api/taxis/${id}`);
  },

  async register(data: any) {
    return request("/api/taxis", { method: "POST", body: JSON.stringify(data) });
  },

  async update(id: string, data: any) {
    return request(`/api/taxis/${id}`, { method: "PUT", body: JSON.stringify(data) });
  },
};

// ─── Drivers ─────────────────────────────────────────────────────────────────

export const drivers = {
  async getById(id: string) {
    return request(`/api/drivers/${id}`);
  },

  async getPerformance(id: string) {
    return request(`/api/drivers/${id}/performance`);
  },
};

// ─── Locations ───────────────────────────────────────────────────────────────

export interface LocationPayload {
  name: string;
  type?: "rank" | "formal_stop" | "informal_stop" | "landmark" | "interchange";
  latitude: number;
  longitude: number;
  address?: string | null;
  description?: string | null;
  capacity?: number | null;
  opensAt?: string | null;
  closesAt?: string | null;
  operatingDays?: string[] | null;
  routes?: string[] | null;
}

export const locations = {
  async list(page = 1, limit = 50) {
    return request(`/api/locations?page=${page}&limit=${limit}`);
  },

  async getById(id: string) {
    return request(`/api/locations/${id}`);
  },

  async create(data: any) {
    return request("/api/locations", { method: "POST", body: JSON.stringify(data) });
  },

  // ─── Admin-only CRUD (bypasses mobile-contribution moderation queue) ───

  async adminCreate(data: LocationPayload) {
    return request("/api/admin/locations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async adminUpdate(id: string, data: LocationPayload) {
    return request(`/api/admin/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async adminDelete(id: string) {
    return request(`/api/admin/locations/${id}`, { method: "DELETE" });
  },

  async adminImport(rows: any[]) {
    return request("/api/admin/locations/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  },
};

// ─── Taxi fares ──────────────────────────────────────────────────────────────

export interface FarePayload {
  origin: string;
  destination: string;
  amount?: number | null;
  currency?: string | null;
  distanceKm?: number | null;
  estimatedTimeMinutes?: number | null;
  association?: string | null;
  originRankId?: string | null;
  destinationRankId?: string | null;
}

export const fares = {
  async list(params: { q?: string; limit?: number; offset?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.offset) qs.set("offset", String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return request(`/api/fares${query}`);
  },

  async adminCreate(data: FarePayload) {
    return request("/api/admin/fares", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async adminUpdate(id: string, data: FarePayload) {
    return request(`/api/admin/fares/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async adminDelete(id: string) {
    return request(`/api/admin/fares/${id}`, { method: "DELETE" });
  },

  async adminImport(rows: any[]) {
    return request("/api/admin/fares/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    });
  },
};

// ─── Community ───────────────────────────────────────────────────────────────

export const community = {
  async getPosts(category?: string, page = 1) {
    const q = category ? `?category=${category}&page=${page}` : `?page=${page}`;
    return request(`/api/community/posts${q}`);
  },

  async getPostById(id: string) {
    return request(`/api/community/posts/${id}`);
  },
};

// ─── Events ──────────────────────────────────────────────────────────────────

export const events = {
  async list(category?: string) {
    const q = category ? `?category=${category}` : "";
    return request(`/api/events${q}`);
  },

  async getById(id: string) {
    return request(`/api/events/${id}`);
  },
};

// ─── Jobs ────────────────────────────────────────────────────────────────────

export const jobs = {
  async list(category?: string) {
    const q = category ? `?category=${category}` : "";
    return request(`/api/jobs${q}`);
  },

  async getById(id: string) {
    return request(`/api/jobs/${id}`);
  },
};

// ─── Complaints ──────────────────────────────────────────────────────────────

export const complaints = {
  async list(page = 1) {
    return request(`/api/complaints?page=${page}`);
  },
};

// ─── Rides ───────────────────────────────────────────────────────────────────

export const rides = {
  async list() {
    return request("/api/rides");
  },

  async getById(id: string) {
    return request(`/api/rides/${id}`);
  },
};

// ─── Deliveries ──────────────────────────────────────────────────────────────

export const deliveries = {
  async list() {
    return request("/api/deliveries");
  },
};

// ─── Notifications ───────────────────────────────────────────────────────────

export const notifications = {
  async list() {
    return request("/api/notifications");
  },

  async markRead(id: string) {
    return request(`/api/notifications/${id}/read`, { method: "PUT" });
  },

  async markAllRead() {
    return request("/api/notifications/read-all", { method: "PUT" });
  },
};

// ─── Wallet / Payments ───────────────────────────────────────────────────────

export const wallet = {
  async getBalance() {
    return request("/api/wallet/balance");
  },

  async getTransactions(page = 1) {
    return request(`/api/wallet/transactions?page=${page}`);
  },
};

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return request("/api/health");
}

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

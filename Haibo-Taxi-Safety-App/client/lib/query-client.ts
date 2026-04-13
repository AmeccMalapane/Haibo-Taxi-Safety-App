import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  getCurrentToken,
  getCurrentRefreshToken,
  notifyAuthExpired,
  saveRefreshedTokens,
} from "@/contexts/AuthContext";

/**
 * Gets the base URL for the Express API server.
 * Returns null if EXPO_PUBLIC_DOMAIN is not configured (offline/demo mode).
 */
export function getApiUrl(): string | null {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    console.warn("EXPO_PUBLIC_DOMAIN is not set — API calls will be disabled");
    return null;
  }

  let url = new URL(`https://${host}`);
  return url.href;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Build auth headers — attaches Bearer token if available.
 */
function getAuthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };

  const token = getCurrentToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

// Shared in-flight refresh promise — collapses concurrent 401s into a single
// refresh call. Without this, 10 parallel authed requests hitting an expired
// token would each fire their own POST /api/auth/refresh.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getCurrentRefreshToken();
    const baseUrl = getApiUrl();
    if (!refreshToken || !baseUrl) return false;

    try {
      const res = await fetch(new URL("/api/auth/refresh", baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.token || !data?.refreshToken) return false;
      await saveRefreshedTokens(data.token, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function isRefreshEndpoint(url: URL): boolean {
  return url.pathname.endsWith("/api/auth/refresh");
}

/**
 * Make an API request with automatic auth.
 * Accepts either:
 *   apiRequest(route, options) — where options has { method, body?, headers? }
 *   apiRequest(method, route, data) — legacy positional form
 */
export async function apiRequest(
  routeOrMethod: string,
  optionsOrRoute?: string | RequestInit,
  data?: unknown,
): Promise<any> {
  const baseUrl = getApiUrl();

  if (!baseUrl) {
    throw new Error("API is not configured. Please set EXPO_PUBLIC_DOMAIN.");
  }

  let url: URL;
  let fetchInit: RequestInit;

  if (typeof optionsOrRoute === "object") {
    url = new URL(routeOrMethod, baseUrl);
    fetchInit = {
      ...optionsOrRoute,
      headers: getAuthHeaders(optionsOrRoute.headers as Record<string, string> || {}),
      credentials: "include",
    };
  } else if (typeof optionsOrRoute === "string") {
    url = new URL(optionsOrRoute, baseUrl);
    fetchInit = {
      method: routeOrMethod,
      headers: getAuthHeaders(data ? {} : undefined),
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    };
  } else {
    url = new URL(routeOrMethod, baseUrl);
    fetchInit = {
      method: "GET",
      headers: getAuthHeaders(),
      credentials: "include",
    };
  }

  let res = await fetch(url, fetchInit);

  // On 401, attempt one transparent refresh + retry. Skip if this IS the
  // refresh call itself, and skip if we have no refresh token (guest/logged-out).
  if (res.status === 401 && !isRefreshEndpoint(url) && getCurrentRefreshToken()) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      // Rebuild Authorization header with the now-fresh access token.
      const headers = (fetchInit.headers as Record<string, string>) || {};
      headers["Authorization"] = `Bearer ${getCurrentToken()}`;
      fetchInit.headers = headers;
      res = await fetch(url, fetchInit);
    } else {
      // Refresh token is invalid/expired — clear auth state so the app
      // routes the user back to login instead of spinning on 401s.
      notifyAuthExpired();
    }
  }

  await throwIfResNotOk(res);

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await res.json();
  }
  return await res.text();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  const { on401: unauthorizedBehavior } = options;
  return async ({ queryKey }) => {
    const baseUrl = getApiUrl();

    if (!baseUrl) {
      return undefined as unknown as T;
    }

    const url = new URL(queryKey.join("/") as string, baseUrl);

    let res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    // Same refresh-on-401 dance as apiRequest. If refresh succeeds, retry
    // once with the fresh token before handing the response to React Query.
    if (res.status === 401 && !isRefreshEndpoint(url) && getCurrentRefreshToken()) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        res = await fetch(url, {
          headers: getAuthHeaders(),
          credentials: "include",
        });
      } else {
        notifyAuthExpired();
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

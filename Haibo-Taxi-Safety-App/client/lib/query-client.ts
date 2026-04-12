import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCurrentToken } from "@/contexts/AuthContext";

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

  const res = await fetch(url, fetchInit);
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

    const res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

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

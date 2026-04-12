/**
 * React Query hooks for fetching data from the Haibo API.
 * Each hook falls back to local data when offline or API unavailable.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getTaxiLocations as getLocalLocations, getTaxiRoutes as getLocalRoutes } from "@/lib/localData";
import type { TaxiLocation } from "@/lib/types";

// ─── Taxi Locations (Map markers) ────────────────────────────────────────────

export function useLocations() {
  const localData = getLocalLocations();

  return useQuery({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      if (!getApiUrl()) return localData;

      try {
        const res = await apiRequest("/api/locations?limit=200");
        if (res?.data?.length > 0) {
          return res.data.map((loc: any) => ({
            id: loc.id,
            name: loc.name,
            type: loc.type || "informal_stop",
            latitude: loc.latitude,
            longitude: loc.longitude,
            address: loc.address || "",
            description: loc.description || "",
            verificationStatus: loc.verificationStatus || "pending",
            confidenceScore: loc.confidenceScore || 50,
            upvotes: loc.upvotes || 0,
            downvotes: loc.downvotes || 0,
            isActive: loc.isActive !== false,
          })) as TaxiLocation[];
        }
        return localData;
      } catch {
        return localData;
      }
    },
    staleTime: 5 * 60 * 1000,
    initialData: localData,
  });
}

export function useNearbyLocations(lat?: number, lng?: number, radius = 5) {
  return useQuery({
    queryKey: ["/api/locations/nearby", lat, lng, radius],
    queryFn: async () => {
      if (!getApiUrl() || !lat || !lng) return [];
      const res = await apiRequest(`/api/locations/nearby?latitude=${lat}&longitude=${lng}&radius=${radius}`);
      return res?.data || [];
    },
    enabled: !!lat && !!lng && !!getApiUrl(),
    staleTime: 2 * 60 * 1000,
  });
}

export function useLocationDetails(locationId: string) {
  return useQuery({
    queryKey: ["/api/locations", locationId],
    queryFn: async () => {
      if (!getApiUrl()) return null;
      return await apiRequest(`/api/locations/${locationId}`);
    },
    enabled: !!locationId && !!getApiUrl(),
  });
}

// ─── Community Posts ─────────────────────────────────────────────────────────

export function useCommunityPosts(category?: string) {
  return useQuery({
    queryKey: ["/api/community/posts", category],
    queryFn: async () => {
      if (!getApiUrl()) return [];
      const url = category
        ? `/api/community/posts?category=${category}&limit=50`
        : "/api/community/posts?limit=50";
      const res = await apiRequest(url);
      return res?.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: {
      contentType?: string;
      mediaUrl?: string;
      caption?: string;
      hashtags?: string[];
      locationName?: string;
      category?: string;
    }) => {
      return await apiRequest("/api/community/posts", {
        method: "POST",
        body: JSON.stringify(post),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });
}

export function useLikePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      return await apiRequest(`/api/community/posts/${postId}/like`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });
}

export function useCommentOnPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, content, parentId }: { postId: string; content: string; parentId?: string }) => {
      return await apiRequest(`/api/community/posts/${postId}/comment`, {
        method: "POST",
        body: JSON.stringify({ content, parentId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community/posts"] });
    },
  });
}

// ─── Events ──────────────────────────────────────────────────────────────────

export function useEvents(category?: string) {
  return useQuery({
    queryKey: ["/api/events", category],
    queryFn: async () => {
      if (!getApiUrl()) return [];
      const url = category
        ? `/api/events?category=${category}&limit=50`
        : "/api/events?limit=50";
      const res = await apiRequest(url);
      return res?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export function useJobs(category?: string) {
  return useQuery({
    queryKey: ["/api/jobs", category],
    queryFn: async () => {
      if (!getApiUrl()) return [];
      const url = category
        ? `/api/jobs?category=${category}&limit=50`
        : "/api/jobs?limit=50";
      const res = await apiRequest(url);
      return res?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Group Rides ─────────────────────────────────────────────────────────────

export function useGroupRides() {
  return useQuery({
    queryKey: ["/api/rides"],
    queryFn: async () => {
      if (!getApiUrl()) return [];
      const res = await apiRequest("/api/rides?limit=50");
      return res?.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Lost & Found ────────────────────────────────────────────────────────────

export function useLostFound(type?: string) {
  return useQuery({
    queryKey: ["/api/lost-found", type],
    queryFn: async () => {
      if (!getApiUrl()) return [];
      const url = type
        ? `/api/lost-found?type=${type}&limit=50`
        : "/api/lost-found?limit=50";
      const res = await apiRequest(url);
      return res?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Routes / Contributions ──────────────────────────────────────────────────

export function useRoutes() {
  const localRoutes = getLocalRoutes();

  return useQuery({
    queryKey: ["/api/routes"],
    queryFn: async () => {
      // Routes come from local data + API contributions
      return localRoutes;
    },
    initialData: localRoutes,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

export function useWalletBalance() {
  return useQuery({
    queryKey: ["/api/wallet/balance"],
    queryFn: async () => {
      if (!getApiUrl()) return { balance: 0 };
      return await apiRequest("/api/wallet/balance");
    },
    staleTime: 30 * 1000, // 30 seconds — balance changes often
  });
}

export function useWalletTransactions() {
  return useQuery({
    queryKey: ["/api/wallet/transactions"],
    queryFn: async () => {
      if (!getApiUrl()) return { data: [], pagination: {} };
      return await apiRequest("/api/wallet/transactions");
    },
    staleTime: 60 * 1000,
  });
}

import { QueryClient } from "@tanstack/react-query";

/**
 * Single QueryClient for the whole Command Center. 30-second stale time
 * matches the mobile app's wallet query — admin data is live-ish but not
 * latency-critical, so background refetch on focus is plenty.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

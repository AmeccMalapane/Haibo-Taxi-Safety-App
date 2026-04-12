import { useCallback, useRef, useMemo, useState, useEffect } from "react";
import { InteractionManager, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Performance optimization hooks for Haibo! App
 * Implements lazy loading, debouncing, and caching strategies
 */

/**
 * Debounce hook - prevents rapid-fire function calls (e.g., search input)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook - limits function calls to once per interval
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 1000
): T {
  const lastRun = useRef(Date.now());

  return useCallback(
    (...args: Parameters<T>) => {
      if (Date.now() - lastRun.current >= delay) {
        lastRun.current = Date.now();
        return callback(...args);
      }
    },
    [callback, delay]
  ) as T;
}

/**
 * Deferred rendering - delays non-critical UI until after navigation completes
 */
export function useAfterInteractions() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });

    return () => task.cancel();
  }, []);

  return isReady;
}

/**
 * Optimized FlatList configuration for large lists
 */
export function useOptimizedListConfig(itemHeight: number = 80) {
  return useMemo(
    () => ({
      removeClippedSubviews: Platform.OS !== "web",
      maxToRenderPerBatch: 10,
      updateCellsBatchingPeriod: 50,
      windowSize: 5,
      initialNumToRender: 8,
      getItemLayout: (_data: any, index: number) => ({
        length: itemHeight,
        offset: itemHeight * index,
        index,
      }),
    }),
    [itemHeight]
  );
}

/**
 * Local cache hook with TTL (time-to-live)
 */
export function useLocalCache<T>(key: string, ttlMinutes: number = 30) {
  const get = useCallback(async (): Promise<T | null> => {
    try {
      const stored = await AsyncStorage.getItem(`@cache_${key}`);
      if (!stored) return null;

      const { data, timestamp } = JSON.parse(stored);
      const age = (Date.now() - timestamp) / 1000 / 60; // minutes

      if (age > ttlMinutes) {
        await AsyncStorage.removeItem(`@cache_${key}`);
        return null;
      }

      return data as T;
    } catch {
      return null;
    }
  }, [key, ttlMinutes]);

  const set = useCallback(
    async (data: T): Promise<void> => {
      try {
        await AsyncStorage.setItem(
          `@cache_${key}`,
          JSON.stringify({ data, timestamp: Date.now() })
        );
      } catch {
        // Silently fail
      }
    },
    [key]
  );

  const clear = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(`@cache_${key}`);
    } catch {
      // Silently fail
    }
  }, [key]);

  return { get, set, clear };
}

/**
 * Pagination hook for infinite scroll lists
 */
export function usePagination<T>(
  fetchFn: (page: number, limit: number) => Promise<T[]>,
  limit: number = 20
) {
  const [data, setData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const newItems = await fetchFn(page, limit);
      if (newItems.length < limit) {
        setHasMore(false);
      }
      setData((prev) => [...prev, ...newItems]);
      setPage((p) => p + 1);
    } catch (error) {
      console.error("Pagination error:", error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, fetchFn, limit]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    try {
      const newItems = await fetchFn(1, limit);
      setData(newItems);
      if (newItems.length < limit) {
        setHasMore(false);
      }
      setPage(2);
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFn, limit]);

  return { data, loading, hasMore, refreshing, loadMore, refresh };
}

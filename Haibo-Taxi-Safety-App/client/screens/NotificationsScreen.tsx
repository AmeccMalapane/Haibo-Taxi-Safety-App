import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { resolveNotificationRoute } from "@/lib/notificationRouting";

// typeui-clean NotificationsScreen — in-app inbox for the DB-persisted
// notifications table. Rose gradient hero, floating white card, grouped
// list of read/unread items.
//
// Why it matters: push notifications (FCM) can silently fail — the user
// might not have granted permission, the token might be stale, the
// device might be offline. The server always persists the notification
// row, so this screen is the canonical source of truth for "what
// happened on my account" regardless of push delivery.
//
// Chunk 29 added vendor sale receipts as the first real consumer of
// this table — before this screen existed, vendors had no way to see
// their sales if push delivery failed. Now they do.

type NotificationType =
  | "sos"
  | "delivery"
  | "ride"
  | "payment"
  | "system"
  | "complaint_update";

interface NotificationRow {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any> | null;
  isRead: boolean | null;
  readAt: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
}

interface NotificationsResponse {
  data: NotificationRow[];
  unreadCount: number;
}

const TYPE_META: Record<
  NotificationType,
  { icon: keyof typeof Feather.glyphMap; tint: string }
> = {
  sos: { icon: "alert-octagon", tint: BrandColors.status.emergency },
  delivery: { icon: "package", tint: BrandColors.status.info },
  ride: { icon: "navigation", tint: BrandColors.secondary.purple },
  payment: { icon: "credit-card", tint: BrandColors.status.success },
  system: { icon: "bell", tint: BrandColors.primary.gradientStart },
  complaint_update: { icon: "message-circle", tint: BrandColors.secondary.orange },
};

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
  });
}

export default function NotificationsScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  const notificationsQ = useQuery<NotificationsResponse>({
    queryKey: ["/api/notifications"],
    queryFn: () => apiRequest("/api/notifications"),
    // Keep the feed fresh while the user is actively looking at it.
    refetchInterval: 30_000,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllReadMut = useMutation({
    mutationFn: () =>
      apiRequest("/api/notifications/read-all", { method: "PUT" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const rows = notificationsQ.data?.data || [];
  const unreadCount = notificationsQ.data?.unreadCount || 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {/* Rose gradient hero */}
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(400).delay(100)}
          style={styles.heroBadgeWrap}
        >
          <View style={styles.heroBadge}>
            <Feather
              name="bell"
              size={32}
              color={BrandColors.primary.gradientStart}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
          style={styles.heroText}
        >
          <ThemedText style={styles.heroTitle}>Notifications</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread · tap to mark read`
              : "You're all caught up"}
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      {/* Floating content card */}
      <Animated.View
        entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
        style={[
          styles.contentCard,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        {/* Mark-all-read control — visible only when there's something to mark */}
        {unreadCount > 0 ? (
          <Pressable
            onPress={() => markAllReadMut.mutate()}
            disabled={markAllReadMut.isPending}
            style={({ pressed }) => [
              styles.markAllRow,
              {
                backgroundColor: BrandColors.primary.gradientStart + "08",
                borderColor: BrandColors.primary.gradientStart + "40",
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
          >
            <Feather
              name="check-square"
              size={16}
              color={BrandColors.primary.gradientStart}
            />
            <ThemedText
              style={[
                styles.markAllText,
                { color: BrandColors.primary.gradientStart },
              ]}
            >
              {markAllReadMut.isPending ? "Marking…" : "Mark all as read"}
            </ThemedText>
          </Pressable>
        ) : null}

        {notificationsQ.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="small"
              color={BrandColors.primary.gradientStart}
            />
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: BrandColors.primary.gradientStart + "12" },
              ]}
            >
              <Feather
                name="bell-off"
                size={26}
                color={BrandColors.primary.gradientStart}
              />
            </View>
            <ThemedText style={styles.emptyTitle}>No notifications</ThemedText>
            <ThemedText
              style={[styles.emptyHint, { color: theme.textSecondary }]}
            >
              Payment receipts, SOS alerts, and system updates will appear
              here.
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(n) => n.id}
            contentContainerStyle={{
              paddingBottom: insets.bottom + Spacing["3xl"],
            }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            refreshControl={
              <RefreshControl
                refreshing={notificationsQ.isRefetching && !notificationsQ.isLoading}
                onRefresh={() => notificationsQ.refetch()}
                tintColor={BrandColors.primary.gradientStart}
              />
            }
            renderItem={({ item }) => (
              <NotificationCard
                item={item}
                theme={theme}
                onPress={() => {
                  if (!item.isRead) markReadMut.mutate(item.id);
                  const route = resolveNotificationRoute(item);
                  if (route) {
                    // `as any` because navigate's overload resolution
                    // gets confused by the union param type — the
                    // resolver already type-checks the screen+params
                    // tuple against RootStackParamList.
                    navigation.navigate(route.screen as any, route.params as any);
                  }
                }}
              />
            )}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NotificationCard({
  item,
  theme,
  onPress,
}: {
  item: NotificationRow;
  theme: any;
  onPress: () => void;
}) {
  const meta = TYPE_META[item.type] || TYPE_META.system;
  const unread = !item.isRead;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notifCard,
        {
          backgroundColor: unread
            ? BrandColors.primary.gradientStart + "08"
            : theme.surface,
          borderColor: unread
            ? BrandColors.primary.gradientStart + "40"
            : theme.border,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}. ${
        unread ? "Unread." : "Read."
      }`}
    >
      <View style={[styles.notifIcon, { backgroundColor: meta.tint + "14" }]}>
        <Feather name={meta.icon} size={18} color={meta.tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.notifTitleRow}>
          <ThemedText
            style={[
              styles.notifTitle,
              unread && { fontWeight: "700" },
            ]}
            numberOfLines={1}
          >
            {item.title}
          </ThemedText>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        <ThemedText
          style={[styles.notifBody, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {item.body}
        </ThemedText>
        <ThemedText
          style={[styles.notifWhen, { color: theme.textSecondary }]}
        >
          {formatWhen(item.createdAt)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Hero
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: Spacing.lg,
  },
  heroBadgeWrap: { alignItems: "center", marginBottom: Spacing.lg },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroText: { alignItems: "center" },
  heroTitle: {
    ...Typography.h2,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 320,
  },

  // Content card
  contentCard: {
    flex: 1,
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Mark-all-read row
  markAllRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  markAllText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: "700",
  },

  // Notification card
  notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  notifTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  notifTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.primary.gradientStart,
  },
  notifBody: {
    ...Typography.small,
    fontSize: 13,
    marginTop: 2,
  },
  notifWhen: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  // States
  loading: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  empty: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h4,
    textAlign: "center",
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },
});

import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SkeletonBlock } from "@/components/Skeleton";
import { BalanceCard } from "@/components/dashboards/BalanceCard";
import { StatTrendChart, ChartWindow } from "@/components/dashboards/StatTrendChart";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

/**
 * OwnerDashboardScreen — the first thing a taxi owner sees when they
 * open Haibo. Structured to answer three questions fast:
 *
 *   1. How much is available to withdraw right now? → BalanceCard
 *   2. How is the fleet trending over 7/30/90 days? → StatTrendChart
 *   3. Which drivers owe me money, and how much? → Drivers list
 *
 * Teal accent matches the role tile on ProfileSetup. Pull-to-refresh
 * pulls both queries because earnings accrue continuously.
 */

interface OwnerDashboard {
  owner: {
    displayName: string;
    walletBalance: number;
  };
  fleet: {
    driverCount: number;
    totalPendingFare: number;
  };
  earnings: { today: number; week: number };
  drivers: {
    userId: string;
    displayName: string;
    fareBalance: number;
  }[];
}

interface Timeseries {
  windowDays: number;
  points: { day: string; total: number }[];
}

const ACCENT = BrandColors.accent.teal;
const ACCENT_LIGHT = BrandColors.accent.tealLight;

export default function OwnerDashboardScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [window, setWindow] = useState<ChartWindow>("7d");
  const windowDays = window === "90d" ? 90 : window === "30d" ? 30 : 7;

  const dashboardQ = useQuery<OwnerDashboard>({
    queryKey: ["/api/owner/dashboard"],
    queryFn: () => apiRequest("/api/owner/dashboard") as Promise<OwnerDashboard>,
  });

  const timeseriesQ = useQuery<Timeseries>({
    queryKey: ["/api/owner/stats/timeseries", windowDays],
    queryFn: () =>
      apiRequest(`/api/owner/stats/timeseries?window=${windowDays}`) as Promise<Timeseries>,
  });

  const refreshing = dashboardQ.isFetching || timeseriesQ.isFetching;
  const d = dashboardQ.data;

  const handleWithdraw = () => {
    // Future: open a withdraw sheet with bank autofill from owner_profiles.
    // For MVP, just route to Wallet where the existing withdraw flow lives.
    navigation.navigate("Wallet");
  };

  const handleInvite = () => {
    navigation.navigate("OwnerInvitations");
  };

  const handleEditProfile = () => {
    navigation.navigate("OwnerOnboarding");
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              dashboardQ.refetch();
              timeseriesQ.refetch();
            }}
            tintColor={ACCENT}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header strip */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(400)}
          style={styles.header}
        >
          <View>
            <ThemedText style={[styles.eyebrow, { color: theme.textSecondary }]}>
              OWNER DASHBOARD
            </ThemedText>
            <ThemedText style={styles.heading}>
              {d?.owner.displayName || user?.displayName || "Owner"}
            </ThemedText>
          </View>
          <Pressable
            onPress={handleEditProfile}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Edit owner profile"
          >
            <Feather name="settings" size={18} color={theme.text} />
          </Pressable>
        </Animated.View>

        {/* Balance card — withdraw from here */}
        {dashboardQ.isLoading ? (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <SkeletonBlock style={{ height: 190, borderRadius: BorderRadius.xl }} />
          </View>
        ) : (
          <BalanceCard
            eyebrow="AVAILABLE BALANCE"
            label="Withdraw to your bank"
            amount={d?.owner.walletBalance ?? 0}
            subtitle={
              d && d.fleet.totalPendingFare > 0
                ? `+R${d.fleet.totalPendingFare.toFixed(2)} pending across ${d.fleet.driverCount} driver${d.fleet.driverCount === 1 ? "" : "s"}`
                : undefined
            }
            gradient={[ACCENT, ACCENT_LIGHT]}
            actions={[
              { label: "Withdraw", icon: "arrow-up-right", onPress: handleWithdraw, variant: "primary" },
              { label: "Invite driver", icon: "user-plus", onPress: handleInvite, variant: "secondary" },
            ]}
            delay={100}
          />
        )}

        {/* Quick stats strip — today / week */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(200)}
          style={styles.statsRow}
        >
          <StatBox
            label="Today"
            value={d?.earnings.today ?? 0}
            theme={theme}
          />
          <StatBox
            label="Last 7 days"
            value={d?.earnings.week ?? 0}
            theme={theme}
          />
          <StatBox
            label="Drivers"
            value={d?.fleet.driverCount ?? 0}
            theme={theme}
            formatAsInt
          />
        </Animated.View>

        {/* Trend chart */}
        <View style={{ marginTop: Spacing.lg }}>
          <StatTrendChart
            title="Fleet earnings"
            subtitle="Fares + Hub deliveries across all linked drivers"
            points={timeseriesQ.data?.points ?? []}
            window={window}
            onWindowChange={setWindow}
            accent={ACCENT}
            loading={timeseriesQ.isLoading}
          />
        </View>

        {/* Linked drivers list */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}
          style={styles.section}
        >
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            LINKED DRIVERS
          </ThemedText>

          {dashboardQ.isLoading ? (
            <>
              <SkeletonBlock style={styles.driverRowSkeleton} />
              <SkeletonBlock style={styles.driverRowSkeleton} />
            </>
          ) : !d || d.drivers.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Feather name="users" size={32} color={theme.textSecondary} />
              <ThemedText style={styles.emptyTitle}>No drivers yet</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Generate an invitation code and share it with your first driver.
              </ThemedText>
              <Pressable
                onPress={handleInvite}
                style={({ pressed }) => [
                  styles.emptyCta,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="user-plus" size={14} color="#FFFFFF" />
                <ThemedText style={styles.emptyCtaText}>Invite driver</ThemedText>
              </Pressable>
            </View>
          ) : (
            d.drivers.map((driver, idx) => (
              <View
                key={driver.userId}
                style={[
                  styles.driverRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.driverAvatar,
                    { backgroundColor: ACCENT + "20" },
                  ]}
                >
                  <ThemedText style={[styles.driverInitial, { color: ACCENT }]}>
                    {(driver.displayName[0] || "?").toUpperCase()}
                  </ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.driverName} numberOfLines={1}>
                    {driver.displayName}
                  </ThemedText>
                  <ThemedText
                    style={[styles.driverMeta, { color: theme.textSecondary }]}
                  >
                    Pending settlement
                  </ThemedText>
                </View>
                <ThemedText style={[styles.driverAmount, { color: ACCENT }]}>
                  R{driver.fareBalance.toFixed(2)}
                </ThemedText>
              </View>
            ))
          )}
        </Animated.View>

        {/* Footer tip */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(450)}
          style={[
            styles.tipCard,
            {
              backgroundColor: ACCENT + "0D",
              borderColor: ACCENT + "33",
            },
          ]}
        >
          <Feather name="info" size={16} color={ACCENT} />
          <ThemedText style={[styles.tipText, { color: theme.text }]}>
            Drivers settle their fare balance to your bank directly. Keep your payout
            bank details up to date in your profile.
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatBox({
  label,
  value,
  theme,
  formatAsInt,
}: {
  label: string;
  value: number;
  theme: any;
  formatAsInt?: boolean;
}) {
  return (
    <View
      style={[
        styles.statBox,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>
        {formatAsInt
          ? value.toString()
          : `R${value.toLocaleString("en-ZA", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingBottom: Spacing["3xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    ...Typography.label,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "800",
    marginBottom: 4,
  },
  heading: {
    ...Typography.h1,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  statBox: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  statLabel: {
    ...Typography.label,
    fontSize: 10,
    letterSpacing: 0.8,
    fontWeight: "800",
    marginBottom: 4,
  },
  statValue: {
    ...Typography.h3,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "800",
    marginBottom: Spacing.sm,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  driverRowSkeleton: {
    height: 62,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInitial: {
    fontSize: 16,
    fontWeight: "800",
  },
  driverName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "700",
  },
  driverMeta: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 1,
  },
  driverAmount: {
    ...Typography.h4,
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h4,
    fontSize: 15,
    marginTop: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    fontSize: 12,
    textAlign: "center",
    maxWidth: 260,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: ACCENT,
    marginTop: Spacing.sm,
  },
  emptyCtaText: {
    ...Typography.small,
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  tipText: {
    flex: 1,
    ...Typography.small,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

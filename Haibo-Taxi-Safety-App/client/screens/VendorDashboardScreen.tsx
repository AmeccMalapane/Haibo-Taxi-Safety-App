import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
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
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

/**
 * VendorDashboardScreen — the first thing a merchant sees. Structured
 * around three actions:
 *
 *   1. See today's revenue + withdraw → BalanceCard
 *   2. Show the payment QR to a customer → QR card
 *   3. Track recent sales → activity list
 *
 * Fuchsia accent to match the ProfileSetup role tile. KYC banner
 * shows when the vendor's status is still 'pending' — withdrawals
 * block until admin verifies.
 */

interface VendorDashboard {
  vendor: {
    vendorRef: string;
    businessName: string;
    vendorType: string;
    status: string;
    totalSales: number;
    salesCount: number;
    kycVerified: boolean;
    hasPayoutBank: boolean;
  };
  wallet: {
    balance: number;
    displayName: string;
  };
  earnings: {
    today: { total: number; count: number };
    week: { total: number; count: number };
  };
  recent: {
    id: string;
    amount: number;
    description: string | null;
    createdAt: string | null;
    buyerName: string | null;
  }[];
}

interface Timeseries {
  windowDays: number;
  points: { day: string; total: number }[];
}

const ACCENT = BrandColors.accent.fuchsia;
const ACCENT_LIGHT = BrandColors.accent.fuchsiaLight;

export default function VendorDashboardScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [window, setWindow] = useState<ChartWindow>("7d");
  const windowDays = window === "90d" ? 90 : window === "30d" ? 30 : 7;

  const dashboardQ = useQuery<VendorDashboard>({
    queryKey: ["/api/vendor-profile/dashboard"],
    queryFn: () => apiRequest("/api/vendor-profile/dashboard") as Promise<VendorDashboard>,
  });

  const timeseriesQ = useQuery<Timeseries>({
    queryKey: ["/api/vendor-profile/stats/timeseries", windowDays],
    queryFn: () =>
      apiRequest(`/api/vendor-profile/stats/timeseries?window=${windowDays}`) as Promise<Timeseries>,
  });

  const d = dashboardQ.data;
  const refreshing = dashboardQ.isFetching || timeseriesQ.isFetching;

  const handleWithdraw = () => {
    if (!d?.vendor.hasPayoutBank) {
      Alert.alert(
        "Add your bank first",
        "Finish your vendor profile with bank details before withdrawing.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Edit profile",
            onPress: () => navigation.navigate("VendorOnboarding"),
          },
        ],
      );
      return;
    }
    navigation.navigate("Wallet");
  };

  const handleEditProfile = () => {
    navigation.navigate("VendorOnboarding");
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
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
        {/* Header */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(400)}
          style={styles.header}
        >
          <View style={{ flex: 1 }}>
            <ThemedText style={[styles.eyebrow, { color: theme.textSecondary }]}>
              VENDOR DASHBOARD
            </ThemedText>
            <ThemedText style={styles.heading} numberOfLines={1}>
              {d?.vendor.businessName || "Vendor"}
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
            accessibilityLabel="Edit vendor profile"
          >
            <Feather name="settings" size={18} color={theme.text} />
          </Pressable>
        </Animated.View>

        {/* KYC banner — only when pending/suspended */}
        {d && !d.vendor.kycVerified ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(50)}
            style={[
              styles.kycBanner,
              {
                backgroundColor: BrandColors.status.warning + "16",
                borderColor: BrandColors.status.warning + "55",
              },
            ]}
          >
            <Feather
              name="alert-triangle"
              size={16}
              color={BrandColors.status.warning}
            />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.kycTitle}>
                Verification pending
              </ThemedText>
              <ThemedText style={[styles.kycBody, { color: theme.textSecondary }]}>
                Your vendor profile is under review. You can accept payments,
                but withdrawals unlock once we verify your details.
              </ThemedText>
            </View>
          </Animated.View>
        ) : null}

        {/* Balance card */}
        {dashboardQ.isLoading ? (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <SkeletonBlock style={{ height: 190, borderRadius: BorderRadius.xl }} />
          </View>
        ) : (
          <BalanceCard
            eyebrow="AVAILABLE BALANCE"
            label="Ready to withdraw"
            amount={d?.wallet.balance ?? 0}
            subtitle={
              d
                ? `${d.vendor.salesCount} lifetime sale${d.vendor.salesCount === 1 ? "" : "s"} · R${d.vendor.totalSales.toFixed(2)} total`
                : undefined
            }
            gradient={[ACCENT, ACCENT_LIGHT]}
            actions={[
              {
                label: "Withdraw",
                icon: "arrow-up-right",
                onPress: handleWithdraw,
                variant: "primary",
              },
            ]}
            delay={100}
          />
        )}

        {/* QR card — the thing customers scan */}
        {d?.vendor.vendorRef ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(200)}
            style={[
              styles.qrCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.qrHeader}>
              <ThemedText style={styles.qrTitle}>Payment QR</ThemedText>
              <ThemedText
                style={[styles.qrHint, { color: theme.textSecondary }]}
              >
                Let customers scan to pay via Haibo Pay
              </ThemedText>
            </View>
            <View style={styles.qrWrap}>
              {/* Server-rendered QR at /api/vendor-profile/:ref/qr.png.
                  Falls back to the plain vendorRef text below if the
                  image fails to load. */}
              <Image
                source={{
                  uri: `${getApiUrl()}/api/vendor-profile/${d.vendor.vendorRef}/qr.png`,
                }}
                style={styles.qrImage}
                resizeMode="contain"
                accessibilityLabel={`Payment QR for ${d.vendor.businessName}`}
              />
            </View>
            <View style={styles.qrRefRow}>
              <ThemedText style={[styles.qrRefLabel, { color: theme.textSecondary }]}>
                Vendor ref
              </ThemedText>
              <ThemedText style={styles.qrRef}>{d.vendor.vendorRef}</ThemedText>
            </View>
          </Animated.View>
        ) : null}

        {/* Quick stats strip */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}
          style={styles.statsRow}
        >
          <StatBox
            label="Today"
            value={`R${(d?.earnings.today.total ?? 0).toLocaleString("en-ZA", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`}
            sublabel={`${d?.earnings.today.count ?? 0} sale${d?.earnings.today.count === 1 ? "" : "s"}`}
            theme={theme}
          />
          <StatBox
            label="Last 7 days"
            value={`R${(d?.earnings.week.total ?? 0).toLocaleString("en-ZA", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`}
            sublabel={`${d?.earnings.week.count ?? 0} sales`}
            theme={theme}
          />
        </Animated.View>

        {/* Trend chart */}
        <View style={{ marginTop: Spacing.lg }}>
          <StatTrendChart
            title="Revenue"
            subtitle="Net after platform fee"
            points={timeseriesQ.data?.points ?? []}
            window={window}
            onWindowChange={setWindow}
            accent={ACCENT}
            loading={timeseriesQ.isLoading}
          />
        </View>

        {/* Recent sales */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(400)}
          style={styles.section}
        >
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            RECENT SALES
          </ThemedText>

          {dashboardQ.isLoading ? (
            <>
              <SkeletonBlock style={styles.activityRowSkeleton} />
              <SkeletonBlock style={styles.activityRowSkeleton} />
            </>
          ) : !d || d.recent.length === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Feather name="shopping-bag" size={32} color={theme.textSecondary} />
              <ThemedText style={styles.emptyTitle}>No sales yet</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Show a customer your QR above — your first sale lands here.
              </ThemedText>
            </View>
          ) : (
            d.recent.map((tx) => (
              <View
                key={tx.id}
                style={[
                  styles.activityRow,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.activityIcon,
                    { backgroundColor: ACCENT + "20" },
                  ]}
                >
                  <Feather
                    name="arrow-down-left"
                    size={16}
                    color={ACCENT}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.activityTitle} numberOfLines={1}>
                    {tx.buyerName || "Customer"}
                  </ThemedText>
                  <ThemedText
                    style={[styles.activityMeta, { color: theme.textSecondary }]}
                    numberOfLines={1}
                  >
                    {formatRelative(tx.createdAt)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.activityAmount, { color: ACCENT }]}>
                  +R{tx.amount.toFixed(2)}
                </ThemedText>
              </View>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function StatBox({
  label,
  value,
  sublabel,
  theme,
}: {
  label: string;
  value: string;
  sublabel: string;
  theme: any;
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
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statSublabel, { color: theme.textSecondary }]}>
        {sublabel}
      </ThemedText>
    </View>
  );
}

function formatRelative(iso: string | null): string {
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: Spacing["3xl"] },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
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
  kycBanner: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  kycTitle: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  kycBody: {
    ...Typography.small,
    fontSize: 12,
    lineHeight: 17,
  },
  qrCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  qrHeader: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  qrTitle: {
    ...Typography.h4,
    fontSize: 14,
    fontWeight: "700",
  },
  qrHint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  qrWrap: {
    padding: Spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
  },
  qrImage: {
    width: 140,
    height: 140,
  },
  qrRefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  qrRefLabel: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  qrRef: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
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
  statSublabel: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 2,
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
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  activityRowSkeleton: {
    height: 62,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "700",
  },
  activityMeta: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 1,
  },
  activityAmount: {
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
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

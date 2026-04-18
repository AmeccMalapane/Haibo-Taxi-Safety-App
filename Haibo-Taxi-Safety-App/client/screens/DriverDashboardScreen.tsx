import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Platform,
  Image,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { HaiboPayQR } from "@/components/HaiboPayQR";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { startDriverTracking, stopDriverTracking, isTrackingActive } from "@/lib/tracking";
import { useDriverTracking } from "@/hooks/useDriverTracking";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { createPayDriverLink } from "@/lib/deepLinks";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { BalanceCard } from "@/components/dashboards/BalanceCard";
import { RoleChip } from "@/components/RoleChip";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface QuickAction {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}

interface DriverProfileRow {
  id: string;
  userId: string;
  taxiPlateNumber: string;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleColor: string | null;
  payReferenceCode: string | null;
  isVerified: boolean | null;
  safetyRating: number | null;
  totalRatings: number | null;
  totalRides: number | null;
  // Phase A+B additions — the driver ↔ owner linkage state.
  ownerId?: string | null;
  linkStatus?: "pending" | "active" | "suspended" | null;
}

interface EarningsBucket {
  total: number;
  txns: number;
}

interface EarningsRecentFare {
  id: string;
  amount: number;
  message: string | null;
  createdAt: string | null;
  payerName: string | null;
  payerPhone: string | null;
}

interface EarningsResponse {
  today: EarningsBucket;
  week: EarningsBucket;
  month: EarningsBucket;
  recent: EarningsRecentFare[];
}

function formatEarningsAmount(value: number): string {
  return `R${Number(value).toLocaleString("en-ZA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function formatFareTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
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

export default function DriverDashboardScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const { startTracking: startSocketTracking, stopTracking: stopSocketTracking } =
    useDriverTracking();

  const [trackingEnabled, setTrackingEnabled] = useState(false);

  // Driver profile lives in the DB now — read it via React Query instead
  // of the old AsyncStorage plate flow. When no profile exists (e.g. user
  // landed here by accident), we show a "Become a driver" CTA that deep
  // links to the onboarding screen rather than a local plate input.
  const profileQ = useQuery<{ data: DriverProfileRow | null }>({
    queryKey: ["/api/drivers/me"],
    queryFn: () => apiRequest("/api/drivers/me"),
  });

  const profile = profileQ.data?.data ?? null;
  const plateNumber = profile?.taxiPlateNumber ?? null;

  // Earnings feed — only fetch once the driver actually has a profile,
  // otherwise we'd fire a query that always comes back empty (rideFares
  // recipient filter would match nothing) and waste a round-trip.
  const earningsQ = useQuery<EarningsResponse>({
    queryKey: ["/api/drivers/me/earnings"],
    queryFn: () => apiRequest("/api/drivers/me/earnings"),
    enabled: !!profile,
    // Refresh on a gentle interval — a driver leaving the screen open
    // between fares should see new entries appear without needing to
    // manually pull-to-refresh.
    refetchInterval: 60_000,
  });
  const earnings = earningsQ.data;
  // Prefer the server-issued ref code, fall back to a plate-derived one
  // for legacy rows that were created before generatePayReferenceCode.
  const payRef =
    profile?.payReferenceCode ||
    (plateNumber ? `HB-${plateNumber.replace(/\s/g, "").toUpperCase()}` : null);

  useEffect(() => {
    checkTracking();
  }, []);

  const checkTracking = async () => {
    const active = await isTrackingActive();
    setTrackingEnabled(active);
  };

  const toggleTracking = async (value: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    // Don't let a user toggle tracking on before they have a registered
    // driver_profiles row — the server location-update route will
    // reject location pings without one anyway.
    if (value && !profile) {
      Alert.alert(
        "Register first",
        "Complete driver registration before going online.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Register",
            onPress: () => navigation.navigate("DriverOnboarding"),
          },
        ],
      );
      return;
    }
    if (value) {
      const started = await startDriverTracking();
      if (started) {
        setTrackingEnabled(true);
        startSocketTracking();
        Alert.alert(
          "You're online",
          "Your location is being shared every 60 seconds. Stay safe out there."
        );
      } else {
        Alert.alert(
          "Permission required",
          "Enable location access in your device settings to go online."
        );
      }
    } else {
      await stopDriverTracking();
      stopSocketTracking();
      setTrackingEnabled(false);
    }
  };

  const handleQuickAction = (target: keyof RootStackParamList) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    navigation.navigate(target as any);
  };

  const driverName = user?.displayName || "Driver";
  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  const quickActions: QuickAction[] = [
    {
      icon: "credit-card",
      label: "Wallet",
      hint: "View earnings & payouts",
      onPress: () => handleQuickAction("Wallet"),
    },
    {
      icon: "alert-triangle",
      label: "Report issue",
      hint: "Safety or incident",
      onPress: () => handleQuickAction("Report"),
    },
    {
      icon: "user",
      label: "Profile",
      hint: "Edit your details",
      onPress: () => handleQuickAction("Profile"),
    },
    {
      icon: "settings",
      label: "Settings",
      hint: "App preferences",
      onPress: () => handleQuickAction("Settings"),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing["3xl"] }}
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
        >
          <View style={styles.heroTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.glassButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: trackingEnabled
                    ? "rgba(255,255,255,0.28)"
                    : "rgba(255,255,255,0.14)",
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: trackingEnabled
                      ? BrandColors.status.success
                      : "rgba(255,255,255,0.6)",
                  },
                ]}
              />
              <ThemedText style={styles.statusText}>
                {trackingEnabled ? "Online" : "Offline"}
              </ThemedText>
            </View>
            {/* Role switcher for drivers who are also owners/vendors.
                RoleChip renders null for single-role users, so the
                heroSpacer fallback keeps the row layout balanced. */}
            <View style={styles.heroRight}>
              <RoleChip compact />
            </View>
          </View>

          <ThemedText style={styles.heroGreeting}>Mzansi greets you,</ThemedText>
          <View style={styles.heroNameRow}>
            <ThemedText style={styles.heroTitle}>{driverName}</ThemedText>
            {profile?.isVerified ? (
              <View style={styles.verifiedBadge}>
                <Feather name="check" size={12} color={BrandColors.primary.gradientStart} />
              </View>
            ) : null}
          </View>
          <View style={styles.heroPlateRow}>
            <Feather name="truck" size={16} color="rgba(255,255,255,0.85)" />
            <ThemedText style={styles.heroPlate}>
              {plateNumber || "Plate not set"}
            </ThemedText>
            {/* Rating pill — only visible once the driver has at least
                one rating so we're not flashing a meaningless "5.0"
                score on a brand-new profile. */}
            {profile && (profile.totalRatings ?? 0) > 0 ? (
              <View style={styles.ratingPill}>
                <Feather name="star" size={11} color="#FFFFFF" />
                <ThemedText style={styles.ratingPillText}>
                  {Number(profile.safetyRating ?? 0).toFixed(1)}
                </ThemedText>
              </View>
            ) : null}
          </View>
          {/* KYC status ribbon — one-liner beneath the plate row so the
              driver always knows where their verification stands. */}
          {profile ? (
            <ThemedText style={styles.kycStatus}>
              {profile.isVerified
                ? "KYC verified"
                : "KYC review pending — payments still work"}
            </ThemedText>
          ) : null}
        </LinearGradient>

        {/* Fare balance card — the driver's big number. Money earned but
            not yet settled to the owner. Tapping "Settle to owner" routes
            to the wallet withdrawal flow with balanceType='fare' so the
            server routes the payout to the linked owner's bank. Hidden
            entirely when the driver isn't linked to an owner yet — in
            that case the old earnings cards below are the primary
            surface. */}
        {profile?.linkStatus === "active" && profile.ownerId ? (
          <View style={{ marginTop: Spacing.md, marginBottom: Spacing.sm }}>
            <BalanceCard
              eyebrow="FARE BALANCE"
              label={
                profile.ownerId === user?.id
                  ? "Ready to withdraw"
                  : "Pending settlement to owner"
              }
              amount={Number(user?.fareBalance ?? 0)}
              subtitle={
                profile.ownerId === user?.id
                  ? "Solo operator — goes to your own bank"
                  : "Haibo routes this to your owner's bank when you settle"
              }
              gradient={[BrandColors.accent.teal, BrandColors.accent.tealLight]}
              actions={[
                {
                  label:
                    profile.ownerId === user?.id ? "Withdraw" : "Settle to owner",
                  icon: "arrow-up-right",
                  onPress: () => navigation.navigate("Wallet"),
                  variant: "primary",
                },
              ]}
              delay={40}
            />
          </View>
        ) : null}

        <View style={styles.content}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(400)}
            style={[styles.trackingCard, { backgroundColor: cardSurface }]}
          >
            <View style={styles.trackingInfo}>
              <View
                style={[
                  styles.trackingIcon,
                  {
                    backgroundColor: trackingEnabled
                      ? `${BrandColors.status.success}1A`
                      : BrandColors.primary.gradientStart + "15",
                  },
                ]}
              >
                <Feather
                  name={trackingEnabled ? "navigation" : "navigation-2"}
                  size={22}
                  color={
                    trackingEnabled
                      ? BrandColors.status.success
                      : BrandColors.primary.gradientStart
                  }
                />
              </View>
              <View style={styles.trackingText}>
                <ThemedText style={styles.trackingTitle}>Route tracking</ThemedText>
                <ThemedText style={styles.trackingDesc}>
                  {trackingEnabled
                    ? "GPS active — broadcasting every 60s"
                    : "Go online to share your route"}
                </ThemedText>
              </View>
            </View>
            <Switch
              value={trackingEnabled}
              onValueChange={toggleTracking}
              trackColor={{
                false: BrandColors.gray[300],
                true: `${BrandColors.primary.gradientStart}80`,
              }}
              thumbColor={
                trackingEnabled ? BrandColors.primary.gradientStart : BrandColors.gray[100]
              }
              ios_backgroundColor={BrandColors.gray[300]}
            />
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Haibo Pay</ThemedText>
            {plateNumber ? (
              <DriverPayQRCard
                driverName={driverName}
                plateNumber={plateNumber}
                cardSurface={cardSurface}
                theme={theme}
              />
            ) : (
              <View style={[styles.setupCard, { backgroundColor: cardSurface }]}>
                <View style={styles.setupIconWrap}>
                  <Feather
                    name="credit-card"
                    size={22}
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
                <ThemedText style={styles.setupTitle}>
                  {profileQ.isLoading ? "Loading driver profile…" : "Become a driver"}
                </ThemedText>
                <ThemedText style={styles.setupDesc}>
                  {profileQ.isLoading
                    ? "Fetching your plate and Haibo Pay reference…"
                    : "Register your taxi to accept Haibo Pay, share your live location, and build your safety rating."}
                </ThemedText>
                {!profileQ.isLoading ? (
                  <View style={{ marginTop: Spacing.md }}>
                    <GradientButton
                      onPress={() => navigation.navigate("DriverOnboarding")}
                      icon="arrow-right"
                      iconPosition="right"
                    >
                      Start registration
                    </GradientButton>
                  </View>
                ) : null}
              </View>
            )}
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(140).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Quick actions</ThemedText>
            <View style={styles.actionsGrid}>
              {quickActions.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={action.onPress}
                  style={[styles.actionCard, { backgroundColor: cardSurface }]}
                >
                  <View style={styles.actionIconWrap}>
                    <Feather
                      name={action.icon}
                      size={20}
                      color={BrandColors.primary.gradientStart}
                    />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <ThemedText style={styles.actionLabel}>{action.label}</ThemedText>
                    <ThemedText style={styles.actionHint}>{action.hint}</ThemedText>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={16}
                    color={BrandColors.gray[600]}
                  />
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {profile ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(400)}
              style={styles.section}
            >
              <ThemedText style={styles.sectionLabel}>Earnings</ThemedText>
              <View style={[styles.earningsCard, { backgroundColor: cardSurface }]}>
                <View style={styles.earningsStatsRow}>
                  <EarningsStat
                    label="Today"
                    amount={earnings?.today.total ?? 0}
                    txns={earnings?.today.txns ?? 0}
                    loading={earningsQ.isLoading}
                  />
                  <View style={styles.earningsDivider} />
                  <EarningsStat
                    label="7 days"
                    amount={earnings?.week.total ?? 0}
                    txns={earnings?.week.txns ?? 0}
                    loading={earningsQ.isLoading}
                  />
                  <View style={styles.earningsDivider} />
                  <EarningsStat
                    label="30 days"
                    amount={earnings?.month.total ?? 0}
                    txns={earnings?.month.txns ?? 0}
                    loading={earningsQ.isLoading}
                  />
                </View>

                <View style={styles.recentFaresLabelRow}>
                  <ThemedText style={styles.recentFaresLabel}>
                    Recent fares
                  </ThemedText>
                  {earningsQ.isRefetching ? (
                    <ThemedText style={styles.recentFaresRefreshing}>
                      refreshing…
                    </ThemedText>
                  ) : null}
                </View>

                {earningsQ.isLoading ? (
                  <ThemedText style={styles.recentFaresEmpty}>
                    Loading…
                  </ThemedText>
                ) : !earnings?.recent?.length ? (
                  <ThemedText style={styles.recentFaresEmpty}>
                    No Haibo Pay fares yet. Once commuters scan your QR,
                    receipts land here.
                  </ThemedText>
                ) : (
                  <View style={styles.faresList}>
                    {earnings.recent.map((fare) => (
                      <View key={fare.id} style={styles.fareRow}>
                        <View style={styles.fareIcon}>
                          <Feather
                            name="user"
                            size={14}
                            color={BrandColors.primary.gradientStart}
                          />
                        </View>
                        <View style={styles.fareText}>
                          <ThemedText
                            style={styles.fareName}
                            numberOfLines={1}
                          >
                            {fare.payerName || fare.payerPhone || "Commuter"}
                          </ThemedText>
                          <ThemedText
                            style={styles.fareMeta}
                            numberOfLines={1}
                          >
                            {formatFareTime(fare.createdAt)}
                            {fare.message ? ` · ${fare.message}` : ""}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.fareAmount}>
                          +{formatEarningsAmount(fare.amount)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function EarningsStat({
  label,
  amount,
  txns,
  loading,
}: {
  label: string;
  amount: number;
  txns: number;
  loading: boolean;
}) {
  return (
    <View style={styles.earningsStatCol}>
      <ThemedText style={styles.earningsStatLabel}>{label}</ThemedText>
      <ThemedText style={styles.earningsStatAmount}>
        {loading ? "—" : formatEarningsAmount(amount)}
      </ThemedText>
      <ThemedText style={styles.earningsStatTxns}>
        {loading ? "" : `${txns} ${txns === 1 ? "fare" : "fares"}`}
      </ThemedText>
    </View>
  );
}

// DriverPayQRCard — renders the driver's Haibo Pay QR (loaded from the
// public /api/drivers/plate/:plate/qr.png endpoint) plus a share CTA
// that posts the deep link to WhatsApp/SMS. Replaces the older
// HaiboPayQR "reference code" card, which had no actual QR image.
function DriverPayQRCard({
  driverName,
  plateNumber,
  cardSurface,
  theme,
}: {
  driverName: string;
  plateNumber: string;
  cardSurface: string;
  theme: any;
}) {
  const apiBase = getApiUrl();
  // Normalise the plate for both the endpoint and the share link so the
  // scanned QR always resolves regardless of how the driver capitalised
  // or spaced their plate on the onboarding screen.
  const normalised = plateNumber.replace(/[\s-]/g, "").toUpperCase();
  const qrSrc = apiBase
    ? `${apiBase.replace(/\/$/, "")}/api/drivers/plate/${encodeURIComponent(normalised)}/qr.png`
    : null;
  const shareLink = createPayDriverLink(normalised);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay your taxi fare with Haibo Pay.\n\nDriver: ${driverName}\nPlate: ${plateNumber}\n${shareLink}`,
        title: "Haibo Pay",
      });
    } catch {
      // User cancelled — silent.
    }
  };

  return (
    <View
      style={[
        qrCardStyles.card,
        { backgroundColor: cardSurface, borderColor: theme.border },
      ]}
    >
      <View style={qrCardStyles.header}>
        <Feather
          name="credit-card"
          size={18}
          color={BrandColors.primary.gradientStart}
        />
        <ThemedText style={qrCardStyles.headerText}>Haibo Pay</ThemedText>
      </View>
      <ThemedText style={[qrCardStyles.driverName, { color: theme.text }]}>
        {driverName}
      </ThemedText>
      <ThemedText
        style={[qrCardStyles.plate, { color: theme.textSecondary }]}
      >
        {plateNumber}
      </ThemedText>

      {qrSrc ? (
        <Image
          source={{ uri: qrSrc }}
          style={qrCardStyles.qrImage}
          accessibilityLabel={`Scannable QR code for taxi plate ${plateNumber}`}
        />
      ) : (
        <View style={[qrCardStyles.qrImage, qrCardStyles.qrFallback]}>
          <ThemedText
            style={[qrCardStyles.qrFallbackText, { color: theme.textSecondary }]}
          >
            API unavailable
          </ThemedText>
        </View>
      )}

      <ThemedText
        style={[qrCardStyles.hint, { color: theme.textSecondary }]}
      >
        Commuters scan to pay your fare directly into your wallet.
      </ThemedText>

      <Pressable
        onPress={handleShare}
        style={({ pressed }) => [
          qrCardStyles.shareButton,
          pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Share your Haibo Pay link"
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={qrCardStyles.shareGradient}
        >
          <Feather name="share-2" size={16} color="#FFFFFF" />
          <ThemedText style={qrCardStyles.shareText}>Share link</ThemedText>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const qrCardStyles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    borderWidth: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: BrandColors.primary.gradientStart,
  },
  driverName: {
    ...Typography.h4,
    fontWeight: "700",
    textAlign: "center",
  },
  plate: {
    ...Typography.small,
    letterSpacing: 1,
    fontFamily: "Nunito_600SemiBold",
    marginTop: 2,
    marginBottom: Spacing.lg,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
  },
  qrFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrFallbackText: {
    ...Typography.small,
    fontSize: 11,
  },
  hint: {
    ...Typography.small,
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    maxWidth: 260,
  },
  shareButton: {
    alignSelf: "stretch",
  },
  shareGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  shareText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    borderBottomLeftRadius: BorderRadius["2xl"],
    borderBottomRightRadius: BorderRadius["2xl"],
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroSpacer: {
    width: 40,
  },
  // Right-side slot in the hero top row — sized to match the back
  // button (40 min) so the row stays balanced when RoleChip renders
  // null (single-role users).
  heroRight: {
    minWidth: 40,
    alignItems: "flex-end",
  },
  heroGreeting: {
    ...Typography.small,
    color: "rgba(255, 255, 255, 0.85)",
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  heroPlateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },
  heroPlate: {
    ...Typography.small,
    color: "rgba(255, 255, 255, 0.9)",
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.22)",
    marginLeft: Spacing.sm,
  },
  ratingPillText: {
    ...Typography.small,
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  kycStatus: {
    ...Typography.small,
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
  content: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing["2xl"],
  },
  trackingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  trackingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  trackingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  trackingText: {
    flex: 1,
  },
  trackingTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  trackingDesc: {
    ...Typography.label,
    color: BrandColors.gray[600],
    marginTop: 2,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    fontWeight: "700",
  },
  setupCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  setupIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  setupTitle: {
    ...Typography.h4,
    fontWeight: "800",
  },
  setupDesc: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    lineHeight: 20,
  },
  actionsGrid: {
    gap: Spacing.sm,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  actionTextWrap: {
    flex: 1,
  },
  actionLabel: {
    ...Typography.body,
    fontWeight: "700",
  },
  actionHint: {
    ...Typography.label,
    color: BrandColors.gray[600],
    marginTop: 1,
  },
  earningsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  earningsStatsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  earningsStatCol: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  earningsStatLabel: {
    ...Typography.label,
    color: BrandColors.gray[600],
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 10,
    fontWeight: "700",
  },
  earningsStatAmount: {
    ...Typography.h3,
    color: BrandColors.primary.gradientStart,
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  earningsStatTxns: {
    ...Typography.label,
    color: BrandColors.gray[600],
    marginTop: 2,
    fontSize: 11,
  },
  earningsDivider: {
    width: 1,
    backgroundColor: BrandColors.gray[200],
    marginVertical: Spacing.xs,
  },
  recentFaresLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  recentFaresLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 11,
    fontWeight: "700",
  },
  recentFaresRefreshing: {
    ...Typography.label,
    color: BrandColors.gray[600],
    fontStyle: "italic",
    fontSize: 10,
  },
  recentFaresEmpty: {
    ...Typography.small,
    color: BrandColors.gray[600],
    lineHeight: 18,
  },
  faresList: {
    gap: Spacing.sm,
  },
  fareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  fareIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.primary.gradientStart + "14",
  },
  fareText: {
    flex: 1,
    minWidth: 0,
  },
  fareName: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "600",
  },
  fareMeta: {
    ...Typography.label,
    color: BrandColors.gray[600],
    fontSize: 11,
    marginTop: 2,
  },
  fareAmount: {
    ...Typography.body,
    color: BrandColors.status.success,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    fontSize: 14,
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
  Platform,
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
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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
            <View style={styles.heroSpacer} />
          </View>

          <ThemedText style={styles.heroGreeting}>Mzansi greets you,</ThemedText>
          <ThemedText style={styles.heroTitle}>{driverName}</ThemedText>
          <View style={styles.heroPlateRow}>
            <Feather name="truck" size={16} color="rgba(255,255,255,0.85)" />
            <ThemedText style={styles.heroPlate}>
              {plateNumber || "Plate not set"}
            </ThemedText>
          </View>
        </LinearGradient>

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
            {plateNumber && payRef ? (
              <HaiboPayQR
                driverName={driverName}
                plateNumber={plateNumber}
                payReferenceCode={payRef}
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

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(400)}
            style={[styles.infoCard, { backgroundColor: cardSurface }]}
          >
            <Feather
              name="info"
              size={16}
              color={BrandColors.primary.gradientStart}
            />
            <ThemedText style={styles.infoText}>
              Trip stats and earnings tracking are coming soon. For now, your
              wallet shows the totals from completed Haibo Pay transactions.
            </ThemedText>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}

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
  heroGreeting: {
    ...Typography.small,
    color: "rgba(255, 255, 255, 0.85)",
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
    marginTop: 2,
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
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "25",
  },
  infoText: {
    ...Typography.small,
    flex: 1,
    color: BrandColors.gray[700],
    lineHeight: 20,
  },
});

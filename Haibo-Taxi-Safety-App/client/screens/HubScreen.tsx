import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BorderRadius,
  BrandColors,
  Typography,
} from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getDeviceId } from "@/lib/deviceId";

// typeui-clean rework — Haibo! Hub package shipping landing screen.
//
//   1. Rose gradient hero with package badge + back button (was a flat
//      blue banner inside the scroll content with hardcoded shadow that
//      didn't match any other hero pattern)
//   2. Floating white card with stats strip, quick-action rows,
//      "How it works" 3-step list, and nearby hubs
//   3. Single rose-tinted icon palette across quick actions (was a
//      green/blue/purple rainbow). The "How it works" steps still use
//      semantic colours since they convey order
//
// Latent bug: useHeaderHeight() was called against a route registered
// with headerTitle: "Haibo! Hub". The custom hero now replaces the
// default header and the route is set to headerShown: false. Dropped
// useHeaderHeight() entirely.

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface HubStats {
  activePackages: number;
  deliveredPackages: number;
  totalHubs: number;
}

interface QuickActionProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  index: number;
  theme: any;
}

function QuickAction({
  icon,
  label,
  description,
  onPress,
  index,
  theme,
}: QuickActionProps) {
  const reducedMotion = useReducedMotion();
  const handlePress = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    onPress();
  };

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(300 + index * 60)}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.quickAction,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <View
          style={[
            styles.quickActionIcon,
            { backgroundColor: BrandColors.primary.gradientStart + "12" },
          ]}
        >
          <Feather
            name={icon}
            size={20}
            color={BrandColors.primary.gradientStart}
          />
        </View>
        <View style={styles.quickActionText}>
          <ThemedText style={styles.quickActionLabel}>{label}</ThemedText>
          <ThemedText
            style={[
              styles.quickActionDescription,
              { color: theme.textSecondary },
            ]}
          >
            {description}
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

function StatsCell({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.statsCell}>
      <ThemedText style={styles.statsValue}>{value}</ThemedText>
      <ThemedText style={[styles.statsLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

export default function HubScreen() {
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId).catch(() => {});
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<HubStats>({
    queryKey: [
      deviceId
        ? `/api/hub/stats?deviceId=${deviceId}`
        : "/api/hub/stats",
    ],
  });

  const handleSendPackage = () => navigation.navigate("SendPackage");
  const handleTrackPackage = () => navigation.navigate("TrackPackage");
  const handlePackageHistory = () => navigation.navigate("PackageHistory");

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
                name="package"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Haibo! Hub</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Send packages across SA via the taxi network.
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
          {/* Stats strip */}
          <View
            style={[
              styles.statsCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <StatsCell
              label="Active"
              value={statsLoading ? "—" : String(stats?.activePackages ?? 0)}
              theme={theme}
            />
            <View
              style={[styles.statsDivider, { backgroundColor: theme.border }]}
            />
            <StatsCell
              label="Delivered"
              value={statsLoading ? "—" : String(stats?.deliveredPackages ?? 0)}
              theme={theme}
            />
            <View
              style={[styles.statsDivider, { backgroundColor: theme.border }]}
            />
            <StatsCell
              label="Hubs"
              value={statsLoading ? "—" : String(stats?.totalHubs ?? 0)}
              theme={theme}
            />
          </View>

          {/* Quick actions */}
          <ThemedText
            style={[styles.sectionLabel, { color: theme.textSecondary }]}
          >
            QUICK ACTIONS
          </ThemedText>
          <QuickAction
            icon="send"
            label="Send a package"
            description="Create a new shipment"
            onPress={handleSendPackage}
            index={0}
            theme={theme}
          />
          <QuickAction
            icon="map"
            label="Track a package"
            description="Follow your delivery in real time"
            onPress={handleTrackPackage}
            index={1}
            theme={theme}
          />
          <QuickAction
            icon="clock"
            label="Package history"
            description="View previous shipments"
            onPress={handlePackageHistory}
            index={2}
            theme={theme}
          />

          {/* How it works */}
          <ThemedText
            style={[
              styles.sectionLabel,
              { color: theme.textSecondary, marginTop: Spacing.xl },
            ]}
          >
            HOW IT WORKS
          </ThemedText>
          <View
            style={[
              styles.howItWorksCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Step
              number="1"
              title="Create shipment"
              description="Enter sender, receiver and package details"
              theme={theme}
            />
            <View
              style={[styles.stepConnector, { backgroundColor: theme.border }]}
            />
            <Step
              number="2"
              title="Drop at hub"
              description="Take your package to the nearest taxi rank hub"
              theme={theme}
            />
            <View
              style={[styles.stepConnector, { backgroundColor: theme.border }]}
            />
            <Step
              number="3"
              title="Track & receive"
              description="Monitor delivery and get notified on arrival"
              theme={theme}
            />
          </View>

          {/* Nearby hubs */}
          <ThemedText
            style={[
              styles.sectionLabel,
              { color: theme.textSecondary, marginTop: Spacing.xl },
            ]}
          >
            NEARBY HUBS
          </ThemedText>
          <NearbyHub
            name="MTN Taxi Rank Hub"
            address="Soweto, Johannesburg"
            distance="2.3 km"
            theme={theme}
          />
          <NearbyHub
            name="Sandton City Hub"
            address="Sandton, Johannesburg"
            distance="5.1 km"
            theme={theme}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Step({
  number,
  title,
  description,
  theme,
}: {
  number: string;
  title: string;
  description: string;
  theme: any;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNumber}>
        <ThemedText style={styles.stepNumberText}>{number}</ThemedText>
      </View>
      <View style={styles.stepContent}>
        <ThemedText style={styles.stepTitle}>{title}</ThemedText>
        <ThemedText
          style={[styles.stepDescription, { color: theme.textSecondary }]}
        >
          {description}
        </ThemedText>
      </View>
    </View>
  );
}

function NearbyHub({
  name,
  address,
  distance,
  theme,
}: {
  name: string;
  address: string;
  distance: string;
  theme: any;
}) {
  return (
    <View
      style={[
        styles.hubCard,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View
        style={[
          styles.hubIcon,
          { backgroundColor: BrandColors.primary.gradientStart + "12" },
        ]}
      >
        <Feather
          name="home"
          size={18}
          color={BrandColors.primary.gradientStart}
        />
      </View>
      <View style={styles.hubDetails}>
        <ThemedText style={styles.hubName} numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText
          style={[styles.hubAddress, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {address}
        </ThemedText>
      </View>
      <View
        style={[
          styles.hubDistancePill,
          { backgroundColor: BrandColors.primary.gradientStart + "12" },
        ]}
      >
        <ThemedText style={styles.hubDistanceText}>{distance}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

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
  heroBadgeWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
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
  heroText: {
    alignItems: "center",
  },
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

  // Stats
  statsCard: {
    flexDirection: "row",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  statsCell: {
    flex: 1,
    alignItems: "center",
  },
  statsValue: {
    ...Typography.h2,
    fontVariant: ["tabular-nums"],
  },
  statsLabel: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    marginVertical: Spacing.xs,
  },

  // Section
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },

  // Quick action
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    flex: 1,
  },
  quickActionLabel: {
    ...Typography.body,
    fontWeight: "700",
  },
  quickActionDescription: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },

  // How it works
  howItWorksCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.primary.gradientStart,
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  stepDescription: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  stepConnector: {
    width: 2,
    height: 16,
    marginLeft: 15,
    marginVertical: Spacing.xs,
  },

  // Nearby hubs
  hubCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  hubIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  hubDetails: {
    flex: 1,
    minWidth: 0,
  },
  hubName: {
    ...Typography.body,
    fontWeight: "700",
  },
  hubAddress: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  hubDistancePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  hubDistanceText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    fontVariant: ["tabular-nums"],
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

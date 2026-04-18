import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BorderRadius,
  BrandColors,
  Typography,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Track package screen.
//
// Latent bug fixed: apiRequest("GET", url) followed by .json() was a
// runtime crash — apiRequest already returns the parsed body, calling
// .json() throws "json is not a function". Tracking would have always
// failed with the screen showing a generic error. Switched to the
// new options-object form: apiRequest(url) defaults to GET.

interface StatusStep {
  status: string;
  location: string;
  time: string;
  completed: boolean;
  current: boolean;
}

interface PackageData {
  id: string;
  trackingNumber: string;
  status: string;
  senderName: string;
  receiverName: string;
  contents: string;
  createdAt: string;
  deliveredAt?: string;
  statusHistory: Array<{
    status: string;
    location: string;
    createdAt: string;
  }>;
}

const statusOrder = [
  "registered",
  "pending",
  "picked_up",
  "in_transit",
  "at_hub",
  "out_for_delivery",
  "delivered",
];

const statusLabels: Record<string, string> = {
  registered: "Package registered",
  pending: "Pending pickup",
  picked_up: "Picked up by driver",
  in_transit: "In transit",
  at_hub: "Arrived at hub",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

function StatusTimeline({ steps }: { steps: StatusStep[] }) {
  const { theme } = useTheme();
  return (
    <View style={styles.timeline}>
      {steps.map((step, index) => (
        <View key={index} style={styles.timelineStep}>
          <View style={styles.timelineIndicator}>
            <View
              style={[
                styles.timelineDot,
                {
                  backgroundColor: step.completed
                    ? BrandColors.status.success
                    : step.current
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
            >
              {step.completed ? (
                <Feather name="check" size={12} color="#FFFFFF" />
              ) : step.current ? (
                <View style={styles.currentDotInner} />
              ) : null}
            </View>
            {index < steps.length - 1 ? (
              <View
                style={[
                  styles.timelineLine,
                  {
                    backgroundColor: step.completed
                      ? BrandColors.status.success
                      : theme.border,
                  },
                ]}
              />
            ) : null}
          </View>
          <View style={styles.timelineContent}>
            <ThemedText
              style={[
                styles.stepStatus,
                {
                  opacity: step.completed || step.current ? 1 : 0.5,
                  fontWeight: step.current ? "700" : "600",
                },
              ]}
            >
              {step.status}
            </ThemedText>
            {step.location ? (
              <ThemedText
                style={[
                  styles.stepLocation,
                  {
                    color: theme.textSecondary,
                    opacity: step.completed || step.current ? 1 : 0.5,
                  },
                ]}
              >
                {step.location}
              </ThemedText>
            ) : null}
            <ThemedText
              style={[
                styles.stepTime,
                {
                  color: theme.textSecondary,
                  opacity: step.completed || step.current ? 1 : 0.5,
                },
              ]}
            >
              {step.time}
            </ThemedText>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function TrackPackageScreen() {
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingFocused, setTrackingFocused] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerHaptic = async (
    type: "selection" | "medium" | "error" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = await import("expo-haptics");
      if (type === "error") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (type === "medium") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.selectionAsync();
      }
    } catch {}
  };

  const buildTimelineSteps = (pkg: PackageData): StatusStep[] => {
    const currentStatusIndex = statusOrder.indexOf(pkg.status);

    return statusOrder.map((status, index) => {
      const historyEntry = pkg.statusHistory?.find((h) => h.status === status);
      const isCompleted =
        index < currentStatusIndex || pkg.status === "delivered";
      const isCurrent = status === pkg.status && pkg.status !== "delivered";

      let time = "Pending";
      const sourceDate =
        historyEntry?.createdAt ||
        (status === "registered" ? pkg.createdAt : null);

      if (sourceDate) {
        try {
          const date = new Date(sourceDate);
          time = date.toLocaleString("en-ZA", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        } catch {
          time = sourceDate;
        }
      }

      return {
        status: statusLabels[status] || status,
        location:
          historyEntry?.location || (status === "registered" ? "Haibo!" : ""),
        time,
        completed: isCompleted,
        current: isCurrent,
      };
    });
  };

  const handleTrack = async () => {
    if (!trackingNumber.trim()) return;
    triggerHaptic("medium");

    setIsTracking(true);
    setError(null);

    try {
      const data = await apiRequest(
        `/api/hub/track/${trackingNumber.toUpperCase()}`
      );
      setPackageData(data);
    } catch (err) {
      triggerHaptic("error");
      setError("Package not found. Please check the tracking number.");
      setPackageData(null);
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
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
                name="map"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Track package</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Enter your tracking number to see live delivery status.
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
          {/* Search */}
          <ThemedText
            style={[styles.fieldLabel, { color: theme.textSecondary }]}
          >
            TRACKING NUMBER
          </ThemedText>
          <View style={styles.searchInputRow}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: trackingFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="HAIBO-XXXXXX"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              onFocus={() => setTrackingFocused(true)}
              onBlur={() => setTrackingFocused(false)}
              returnKeyType="search"
              onSubmitEditing={handleTrack}
            />
          </View>

          <View style={styles.searchCta}>
            <GradientButton
              onPress={handleTrack}
              disabled={!trackingNumber.trim() || isTracking}
              size="large"
              icon={isTracking ? undefined : "search"}
              iconPosition="left"
            >
              {isTracking ? "Tracking..." : "Track package"}
            </GradientButton>
          </View>

          {error ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(300)}
              style={[
                styles.errorCard,
                {
                  backgroundColor: BrandColors.status.warning + "12",
                  borderColor: BrandColors.status.warning + "40",
                },
              ]}
            >
              <Feather
                name="alert-circle"
                size={18}
                color={BrandColors.status.warning}
              />
              <ThemedText
                style={[styles.errorText, { color: theme.text }]}
              >
                {error}
              </ThemedText>
            </Animated.View>
          ) : null}

          {packageData ? (
            <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)}>
              <View
                style={[
                  styles.packageCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.packageHeader}>
                  <View style={styles.packageHeaderLeft}>
                    <ThemedText
                      style={[styles.trackingLabel, { color: theme.textSecondary }]}
                    >
                      TRACKING NUMBER
                    </ThemedText>
                    <ThemedText
                      style={styles.trackingValue}
                      numberOfLines={1}
                    >
                      {packageData.trackingNumber}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          packageData.status === "delivered"
                            ? BrandColors.status.success
                            : BrandColors.primary.gradientStart,
                      },
                    ]}
                  >
                    <ThemedText style={styles.statusBadgeText}>
                      {(statusLabels[packageData.status] || packageData.status).toUpperCase()}
                    </ThemedText>
                  </View>
                </View>

                <View
                  style={[styles.divider, { backgroundColor: theme.border }]}
                />

                <View style={styles.packageDetails}>
                  <DetailRow
                    icon="user"
                    label="From"
                    value={packageData.senderName}
                    theme={theme}
                  />
                  <DetailRow
                    icon="users"
                    label="To"
                    value={packageData.receiverName}
                    theme={theme}
                  />
                  <DetailRow
                    icon="package"
                    label="Contents"
                    value={packageData.contents}
                    theme={theme}
                  />
                  <DetailRow
                    icon="calendar"
                    label="Created"
                    value={new Date(packageData.createdAt).toLocaleDateString(
                      "en-ZA",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                    theme={theme}
                  />
                </View>
              </View>

              {/* Timeline */}
              <ThemedText
                style={[
                  styles.fieldLabel,
                  { color: theme.textSecondary, marginTop: Spacing.xl },
                ]}
              >
                DELIVERY PROGRESS
              </ThemedText>
              <View
                style={[
                  styles.timelineCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <StatusTimeline steps={buildTimelineSteps(packageData)} />
              </View>
            </Animated.View>
          ) : !error ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(400).delay(300)}
              style={styles.emptyState}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      BrandColors.primary.gradientStart + "12",
                  },
                ]}
              >
                <Feather
                  name="package"
                  size={28}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>
                Track your package
              </ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Enter your tracking number above to see the live delivery status
                and location.
              </ThemedText>
            </Animated.View>
          ) : null}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={styles.detailRow}>
      <View
        style={[
          styles.detailIcon,
          { backgroundColor: BrandColors.primary.gradientStart + "12" },
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={BrandColors.primary.gradientStart}
        />
      </View>
      <View style={styles.detailContent}>
        <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
          {label.toUpperCase()}
        </ThemedText>
        <ThemedText style={styles.detailValue} numberOfLines={1}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
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

  // Search
  fieldLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.sm,
  },
  searchInputRow: {
    marginBottom: Spacing.md,
  },
  searchInput: {
    height: 56,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 1.5,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    textAlign: "center",
  },
  searchCta: {
    marginBottom: Spacing.lg,
  },

  // Error
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.small,
    flex: 1,
  },

  // Package card
  packageCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  packageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  packageHeaderLeft: {
    flex: 1,
    minWidth: 0,
  },
  trackingLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: 2,
  },
  trackingValue: {
    ...Typography.h4,
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  packageDetails: {
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    ...Typography.label,
    fontSize: 10,
    letterSpacing: 1,
  },
  detailValue: {
    ...Typography.body,
    fontWeight: "600",
    marginTop: 1,
  },

  // Timeline
  timelineCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  timeline: {},
  timelineStep: {
    flexDirection: "row",
  },
  timelineIndicator: {
    alignItems: "center",
    width: 24,
    marginRight: Spacing.md,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  currentDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 36,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.lg,
  },
  stepStatus: {
    ...Typography.body,
    fontWeight: "600",
  },
  stepLocation: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  stepTime: {
    ...Typography.label,
    fontSize: 11,
    marginTop: 2,
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },
});

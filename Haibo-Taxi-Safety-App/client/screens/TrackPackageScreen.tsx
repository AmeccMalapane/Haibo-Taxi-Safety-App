import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

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

const statusOrder = ["registered", "pending", "picked_up", "in_transit", "at_hub", "out_for_delivery", "delivered"];

const statusLabels: Record<string, string> = {
  registered: "Package Registered",
  pending: "Pending Pickup",
  picked_up: "Picked Up by Driver",
  in_transit: "In Transit",
  at_hub: "Arrived at Hub",
  out_for_delivery: "Out for Delivery",
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
                    ? BrandColors.primary.green
                    : step.current
                    ? BrandColors.primary.blue
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
                      ? BrandColors.primary.green
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
            <ThemedText
              style={[
                styles.stepLocation,
                { opacity: step.completed || step.current ? 0.8 : 0.4 },
              ]}
            >
              {step.location}
            </ThemedText>
            <ThemedText
              style={[
                styles.stepTime,
                { opacity: step.completed || step.current ? 0.6 : 0.3 },
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
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [packageData, setPackageData] = useState<PackageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildTimelineSteps = (pkg: PackageData): StatusStep[] => {
    const currentStatusIndex = statusOrder.indexOf(pkg.status);
    
    return statusOrder.map((status, index) => {
      const historyEntry = pkg.statusHistory.find(h => h.status === status);
      const isCompleted = index < currentStatusIndex || pkg.status === "delivered";
      const isCurrent = status === pkg.status && pkg.status !== "delivered";
      
      let time = "Pending";
      if (historyEntry) {
        try {
          const date = new Date(historyEntry.createdAt);
          time = date.toLocaleString("en-ZA", { 
            month: "short", 
            day: "numeric", 
            hour: "2-digit", 
            minute: "2-digit" 
          });
        } catch {
          time = historyEntry.createdAt;
        }
      } else if (status === "registered" && pkg.createdAt) {
        try {
          const date = new Date(pkg.createdAt);
          time = date.toLocaleString("en-ZA", { 
            month: "short", 
            day: "numeric", 
            hour: "2-digit", 
            minute: "2-digit" 
          });
        } catch {
          time = pkg.createdAt;
        }
      }

      return {
        status: statusLabels[status] || status,
        location: historyEntry?.location || (status === "registered" ? "App" : ""),
        time,
        completed: isCompleted,
        current: isCurrent,
      };
    });
  };

  const handleTrack = async () => {
    if (!trackingNumber.trim()) return;

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }

    setIsTracking(true);
    setError(null);
    
    try {
      const response = await apiRequest("GET", `/api/hub/track/${trackingNumber.toUpperCase()}`);
      const data = await response.json();
      setPackageData(data);
    } catch (err) {
      setError("Package not found. Please check the tracking number.");
      setPackageData(null);
    } finally {
      setIsTracking(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <Feather name="search" size={20} color={theme.textSecondary} />
            <ThemedText style={styles.searchTitle}>Enter Tracking Number</ThemedText>
          </View>
          <View style={styles.searchInputRow}>
            <TextInput
              style={[
                styles.searchInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="HAIBO-XXXXXX"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={handleTrack}
              disabled={isTracking}
              style={({ pressed }) => [
                styles.searchButton,
                {
                  backgroundColor: BrandColors.primary.blue,
                  opacity: pressed || isTracking ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name={isTracking ? "loader" : "arrow-right"}
                size={20}
                color="#FFFFFF"
              />
            </Pressable>
          </View>
        </Card>

        {error ? (
          <Card style={styles.errorCard}>
            <Feather name="alert-circle" size={24} color={BrandColors.secondary.orange} />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </Card>
        ) : null}

        {packageData ? (
          <>
            <Card style={styles.packageCard}>
              <View style={styles.packageHeader}>
                <View>
                  <ThemedText style={styles.trackingLabel}>Tracking Number</ThemedText>
                  <ThemedText style={styles.trackingValue}>
                    {packageData.trackingNumber}
                  </ThemedText>
                </View>
                <View style={[styles.statusBadge, { 
                  backgroundColor: packageData.status === "delivered" 
                    ? BrandColors.primary.green 
                    : BrandColors.primary.blue 
                }]}>
                  <ThemedText style={styles.statusBadgeText}>
                    {statusLabels[packageData.status] || packageData.status}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <View style={styles.packageDetails}>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Feather name="user" size={16} color={theme.textSecondary} />
                    <View>
                      <ThemedText style={styles.detailLabel}>From</ThemedText>
                      <ThemedText style={styles.detailValue}>{packageData.senderName}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <Feather name="users" size={16} color={theme.textSecondary} />
                    <View>
                      <ThemedText style={styles.detailLabel}>To</ThemedText>
                      <ThemedText style={styles.detailValue}>{packageData.receiverName}</ThemedText>
                    </View>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Feather name="package" size={16} color={theme.textSecondary} />
                    <View>
                      <ThemedText style={styles.detailLabel}>Contents</ThemedText>
                      <ThemedText style={styles.detailValue}>{packageData.contents}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.detailItem}>
                    <Feather name="calendar" size={16} color={theme.textSecondary} />
                    <View>
                      <ThemedText style={styles.detailLabel}>Created</ThemedText>
                      <ThemedText style={styles.detailValue}>
                        {new Date(packageData.createdAt).toLocaleDateString("en-ZA")}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              </View>
            </Card>

            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Delivery Progress</ThemedText>
              <Card style={styles.timelineCard}>
                <StatusTimeline steps={buildTimelineSteps(packageData)} />
              </Card>
            </View>
          </>
        ) : !error ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="package" size={48} color={theme.textSecondary} />
            </View>
            <ThemedText style={styles.emptyTitle}>Track Your Package</ThemedText>
            <ThemedText style={styles.emptyDescription}>
              Enter your tracking number above to see the delivery status and location of your package.
            </ThemedText>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  searchCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  searchInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    fontWeight: "600",
    letterSpacing: 1,
  },
  searchButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  packageCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  packageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  trackingLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
  trackingValue: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
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
    gap: Spacing.lg,
  },
  detailItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  detailLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  timelineCard: {
    padding: Spacing.lg,
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
    width: 24,
    height: 24,
    borderRadius: 12,
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
    minHeight: 40,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.lg,
  },
  stepStatus: {
    fontSize: 15,
  },
  stepLocation: {
    fontSize: 13,
    marginTop: 2,
  },
  stepTime: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  emptyDescription: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: BrandColors.secondary.orange,
  },
});

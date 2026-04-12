import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { HaiboPayQR } from "@/components/HaiboPayQR";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { startDriverTracking, stopDriverTracking, isTrackingActive } from "@/lib/tracking";
import { useDriverTracking } from "@/hooks/useDriverTracking";

export default function DriverDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [driverData, setDriverData] = useState<any>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayTrips, setTodayTrips] = useState(0);
  const { startTracking: startSocketTracking, stopTracking: stopSocketTracking, isTracking: socketTracking, lastLocation } = useDriverTracking();

  useEffect(() => {
    loadDriverData();
    checkTracking();
  }, []);

  const loadDriverData = async () => {
    try {
      const data = await AsyncStorage.getItem("@user_data");
      if (data) {
        setDriverData(JSON.parse(data));
      }
    } catch (error) {
      console.error("Error loading driver data:", error);
    }
  };

  const checkTracking = async () => {
    const active = await isTrackingActive();
    setTrackingEnabled(active);
  };

  const toggleTracking = async (value: boolean) => {
    if (value) {
      const started = await startDriverTracking();
      if (started) {
        setTrackingEnabled(true);
        // Also start Socket.IO GPS broadcasting (60s intervals)
        startSocketTracking();
        Alert.alert("Tracking Active", "Your location is being shared every 60 seconds.");
      } else {
        Alert.alert("Permission Required", "Please enable location permissions to start tracking.");
      }
    } else {
      await stopDriverTracking();
      stopSocketTracking();
      setTrackingEnabled(false);
    }
  };

  if (!driverData) {
    return (
      <ThemedView style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Feather name="truck" size={48} color={theme.textSecondary} />
        <ThemedText style={[styles.noDataText, { color: theme.textSecondary }]}>
          No driver profile found
        </ThemedText>
      </ThemedView>
    );
  }

  const payRef = driverData.payReferenceCode || `HB-${(driverData.plateNumber || "").replace(/\s/g, "").toUpperCase()}`;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="h2">Driver Dashboard</ThemedText>
          <View style={[styles.statusBadge, { backgroundColor: trackingEnabled ? "#4CAF5020" : theme.backgroundSecondary }]}>
            <View style={[styles.statusDot, { backgroundColor: trackingEnabled ? "#4CAF50" : theme.textSecondary }]} />
            <ThemedText style={[styles.statusText, { color: trackingEnabled ? "#4CAF50" : theme.textSecondary }]}>
              {trackingEnabled ? "Online" : "Offline"}
            </ThemedText>
          </View>
        </View>

        {/* Tracking Toggle */}
        <View style={[styles.trackingCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF" }]}>
          <View style={styles.trackingInfo}>
            <View style={[styles.trackingIcon, { backgroundColor: trackingEnabled ? "#4CAF5020" : "#F5720020" }]}>
              <Feather
                name={trackingEnabled ? "navigation" : "navigation-2"}
                size={24}
                color={trackingEnabled ? "#4CAF50" : "#F57200"}
              />
            </View>
            <View style={styles.trackingText}>
              <ThemedText style={[styles.trackingTitle, { color: theme.text }]}>
                Route Tracking
              </ThemedText>
              <ThemedText style={[styles.trackingDesc, { color: theme.textSecondary }]}>
                {trackingEnabled
                  ? "GPS active — updating every 60s"
                  : "Enable to map your routes"}
              </ThemedText>
            </View>
          </View>
          <Switch
            value={trackingEnabled}
            onValueChange={toggleTracking}
            trackColor={{ false: "#E0E0E0", true: "#4CAF5060" }}
            thumbColor={trackingEnabled ? "#4CAF50" : "#BDBDBD"}
          />
        </View>

        {/* Today's Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF" }]}>
            <Feather name="dollar-sign" size={20} color={BrandColors.primary.green} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>R{todayEarnings.toFixed(0)}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Today's Earnings</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF" }]}>
            <Feather name="map" size={20} color={BrandColors.primary.blue} />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>{todayTrips}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Trips Today</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF" }]}>
            <Feather name="star" size={20} color="#FFC107" />
            <ThemedText style={[styles.statValue, { color: theme.text }]}>4.8</ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Rating</ThemedText>
          </View>
        </View>

        {/* Haibo Pay QR Card */}
        <HaiboPayQR
          driverName={driverData.name || "Driver"}
          plateNumber={driverData.plateNumber || "N/A"}
          payReferenceCode={payRef}
        />

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>Quick Actions</ThemedText>
          <View style={styles.actionsGrid}>
            {[
              { icon: "credit-card" as const, label: "View Earnings", color: BrandColors.primary.green },
              { icon: "users" as const, label: "Passengers", color: BrandColors.primary.blue },
              { icon: "alert-triangle" as const, label: "Report Issue", color: BrandColors.secondary.orange },
              { icon: "settings" as const, label: "Settings", color: BrandColors.gray[600] },
            ].map((action) => (
              <Pressable
                key={action.label}
                style={[styles.actionCard, { backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF" }]}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: action.color + "15" }]}>
                  <Feather name={action.icon} size={22} color={action.color} />
                </View>
                <ThemedText style={[styles.actionLabel, { color: theme.text }]}>{action.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: "600" },
  trackingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  trackingInfo: { flexDirection: "row", alignItems: "center", gap: Spacing.md, flex: 1 },
  trackingIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  trackingText: { flex: 1 },
  trackingTitle: { fontSize: 15, fontWeight: "600" },
  trackingDesc: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: Spacing.sm },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, textAlign: "center" },
  actionsSection: {},
  sectionTitle: { marginBottom: Spacing.md },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  actionCard: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  actionLabel: { fontSize: 13, fontWeight: "600", flex: 1 },
  noDataText: { fontSize: 16, marginTop: Spacing.md },
});

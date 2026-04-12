import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getDeviceId } from "@/lib/deviceId";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface QuickActionProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description: string;
  color: string;
  onPress: () => void;
}

function QuickAction({ icon, label, description, color, onPress }: QuickActionProps) {
  const { theme } = useTheme();

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
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.quickAction,
        { 
          backgroundColor: theme.backgroundSecondary,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
        <Feather name={icon} size={28} color="#FFFFFF" />
      </View>
      <View style={styles.quickActionText}>
        <ThemedText style={styles.quickActionLabel}>{label}</ThemedText>
        <ThemedText style={styles.quickActionDescription}>{description}</ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

function StatsCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Feather.glyphMap }) {
  const { theme } = useTheme();

  return (
    <View style={[styles.statsCard, { backgroundColor: theme.backgroundSecondary }]}>
      <Feather name={icon} size={20} color={theme.textSecondary} />
      <ThemedText style={styles.statsValue}>{value}</ThemedText>
      <ThemedText style={styles.statsLabel}>{label}</ThemedText>
    </View>
  );
}

interface HubStats {
  activePackages: number;
  deliveredPackages: number;
  totalHubs: number;
}

export default function HubScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [deviceId, setDeviceId] = React.useState<string | null>(null);

  React.useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery<HubStats>({
    queryKey: [deviceId ? `/api/hub/stats?deviceId=${deviceId}` : "/api/hub/stats"],
    enabled: true,
  });

  const handleSendPackage = () => {
    navigation.navigate("SendPackage");
  };

  const handleTrackPackage = () => {
    navigation.navigate("TrackPackage");
  };

  const handlePackageHistory = () => {
    navigation.navigate("PackageHistory");
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { 
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={[styles.heroBanner, { backgroundColor: BrandColors.primary.blue }]}>
            <View style={styles.heroContent}>
              <ThemedText style={styles.heroTitle}>Haibo! Hub</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Send packages via the taxi network
              </ThemedText>
            </View>
            <View style={styles.heroIcon}>
              <Feather name="package" size={64} color="rgba(255,255,255,0.3)" />
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatsCard 
            label="Active" 
            value={statsLoading ? "-" : String(stats?.activePackages ?? 0)} 
            icon="box" 
          />
          <StatsCard 
            label="Delivered" 
            value={statsLoading ? "-" : String(stats?.deliveredPackages ?? 0)} 
            icon="check-circle" 
          />
          <StatsCard 
            label="Hubs" 
            value={statsLoading ? "-" : String(stats?.totalHubs ?? 0)} 
            icon="map-pin" 
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          
          <QuickAction
            icon="send"
            label="Send Package"
            description="Create a new shipment"
            color={BrandColors.primary.green}
            onPress={handleSendPackage}
          />
          
          <QuickAction
            icon="map"
            label="Track Package"
            description="Follow your delivery in real-time"
            color={BrandColors.primary.blue}
            onPress={handleTrackPackage}
          />
          
          <QuickAction
            icon="clock"
            label="Package History"
            description="View previous shipments"
            color={BrandColors.secondary.purple}
            onPress={handlePackageHistory}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>How It Works</ThemedText>
          <Card style={styles.howItWorksCard}>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: BrandColors.primary.blue }]}>
                <ThemedText style={styles.stepNumberText}>1</ThemedText>
              </View>
              <View style={styles.stepContent}>
                <ThemedText style={styles.stepTitle}>Create Shipment</ThemedText>
                <ThemedText style={styles.stepDescription}>
                  Enter sender and receiver details, package info
                </ThemedText>
              </View>
            </View>
            
            <View style={[styles.stepConnector, { backgroundColor: theme.border }]} />
            
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: BrandColors.secondary.orange }]}>
                <ThemedText style={styles.stepNumberText}>2</ThemedText>
              </View>
              <View style={styles.stepContent}>
                <ThemedText style={styles.stepTitle}>Drop at Hub</ThemedText>
                <ThemedText style={styles.stepDescription}>
                  Take your package to the nearest taxi rank hub
                </ThemedText>
              </View>
            </View>
            
            <View style={[styles.stepConnector, { backgroundColor: theme.border }]} />
            
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: BrandColors.primary.green }]}>
                <ThemedText style={styles.stepNumberText}>3</ThemedText>
              </View>
              <View style={styles.stepContent}>
                <ThemedText style={styles.stepTitle}>Track & Receive</ThemedText>
                <ThemedText style={styles.stepDescription}>
                  Monitor delivery and get notified on arrival
                </ThemedText>
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Nearby Hubs</ThemedText>
          <Card style={styles.hubCard}>
            <View style={styles.hubInfo}>
              <View style={[styles.hubIcon, { backgroundColor: BrandColors.primary.blue }]}>
                <Feather name="home" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.hubDetails}>
                <ThemedText style={styles.hubName}>MTN Taxi Rank Hub</ThemedText>
                <ThemedText style={styles.hubAddress}>Soweto, Johannesburg</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.hubDistance}>2.3 km</ThemedText>
          </Card>
          
          <Card style={styles.hubCard}>
            <View style={styles.hubInfo}>
              <View style={[styles.hubIcon, { backgroundColor: BrandColors.primary.blue }]}>
                <Feather name="home" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.hubDetails}>
                <ThemedText style={styles.hubName}>Sandton City Hub</ThemedText>
                <ThemedText style={styles.hubAddress}>Sandton, Johannesburg</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.hubDistance}>5.1 km</ThemedText>
          </Card>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  heroSection: {
    marginBottom: Spacing.xl,
  },
  heroBanner: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
  },
  heroIcon: {
    position: "absolute",
    right: -10,
    bottom: -10,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statsCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  statsValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statsLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionText: {
    flex: 1,
  },
  quickActionLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  quickActionDescription: {
    fontSize: 14,
    opacity: 0.6,
  },
  howItWorksCard: {
    padding: Spacing.lg,
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
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  stepDescription: {
    fontSize: 13,
    opacity: 0.6,
  },
  stepConnector: {
    width: 2,
    height: 24,
    marginLeft: 15,
    marginVertical: Spacing.xs,
  },
  hubCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  hubInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  hubIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  hubDetails: {},
  hubName: {
    fontSize: 15,
    fontWeight: "600",
  },
  hubAddress: {
    fontSize: 13,
    opacity: 0.6,
  },
  hubDistance: {
    fontSize: 14,
    fontWeight: "500",
    opacity: 0.6,
  },
});

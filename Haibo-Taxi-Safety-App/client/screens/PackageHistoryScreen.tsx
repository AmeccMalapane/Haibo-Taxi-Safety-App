import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getDeviceId } from "@/lib/deviceId";
import { getApiUrl } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Package {
  id: string;
  trackingNumber: string;
  status: string;
  senderName: string;
  receiverName: string;
  receiverAddress: string;
  contents: string;
  createdAt: string;
  deliveredAt?: string;
  fare: number;
}

const statusConfig = {
  pending: {
    label: "Pending",
    color: BrandColors.secondary.orange,
    icon: "clock" as const,
  },
  in_transit: {
    label: "In Transit",
    color: BrandColors.primary.blue,
    icon: "truck" as const,
  },
  delivered: {
    label: "Delivered",
    color: BrandColors.primary.green,
    icon: "check-circle" as const,
  },
  cancelled: {
    label: "Cancelled",
    color: BrandColors.gray[500],
    icon: "x-circle" as const,
  },
};

function PackageCard({ item }: { item: Package }) {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const statusKey = item.status as keyof typeof statusConfig;
  const config = statusConfig[statusKey] || statusConfig.pending;

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-ZA", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const handlePress = () => {
    navigation.navigate("TrackPackage");
  };

  return (
    <Pressable onPress={handlePress}>
      <Card style={styles.packageCard}>
        <View style={styles.cardHeader}>
          <View style={styles.trackingInfo}>
            <ThemedText style={styles.trackingNumber}>{item.trackingNumber}</ThemedText>
            <ThemedText style={styles.date}>{formatDate(item.createdAt)}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
            <Feather name={config.icon} size={12} color="#FFFFFF" />
            <ThemedText style={styles.statusText}>{config.label}</ThemedText>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <View style={styles.cardBody}>
          <View style={styles.routeInfo}>
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: BrandColors.primary.blue }]} />
              <View>
                <ThemedText style={styles.routeLabel}>From</ThemedText>
                <ThemedText style={styles.routeValue}>{item.senderName}</ThemedText>
              </View>
            </View>
            <View style={[styles.routeLine, { backgroundColor: theme.border }]} />
            <View style={styles.routePoint}>
              <View style={[styles.routeDot, { backgroundColor: BrandColors.primary.green }]} />
              <View>
                <ThemedText style={styles.routeLabel}>To</ThemedText>
                <ThemedText style={styles.routeValue}>
                  {item.receiverName}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.packageInfo}>
            <View style={styles.infoItem}>
              <Feather name="package" size={14} color={theme.textSecondary} />
              <ThemedText style={styles.infoText}>{item.contents}</ThemedText>
            </View>
            <ThemedText style={styles.fareText}>R {(item.fare || 0).toFixed(2)}</ThemedText>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function PackageHistoryScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const { data: packagesData, isLoading, error } = useQuery<Package[]>({
    queryKey: [`/api/hub/packages?deviceId=${deviceId}`],
    enabled: !!deviceId,
  });
  const packages = packagesData ?? [];

  const renderItem = ({ item }: { item: Package }) => <PackageCard item={item} />;

  const ListEmptyComponent = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="inbox" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No Packages Yet</ThemedText>
      <ThemedText style={styles.emptyDescription}>
        Your package history will appear here once you send your first shipment.
      </ThemedText>
    </View>
  );

  const ListHeaderComponent = () => (
    <View style={styles.header}>
      <ThemedText style={styles.headerTitle}>Your Shipments</ThemedText>
      <ThemedText style={styles.headerSubtitle}>
        {packages.length} total packages
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={styles.loadingText}>Loading packages...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={packages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListEmptyComponent={ListEmptyComponent}
        ListHeaderComponent={ListHeaderComponent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.6,
  },
  packageCard: {
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  trackingInfo: {},
  trackingNumber: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  date: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  cardBody: {},
  routeInfo: {
    marginBottom: Spacing.md,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeLine: {
    width: 2,
    height: 20,
    marginLeft: 4,
  },
  routeLabel: {
    fontSize: 11,
    opacity: 0.5,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  packageInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  infoText: {
    fontSize: 13,
    opacity: 0.7,
  },
  fareText: {
    fontSize: 16,
    fontWeight: "700",
    color: BrandColors.primary.green,
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
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    opacity: 0.6,
  },
});

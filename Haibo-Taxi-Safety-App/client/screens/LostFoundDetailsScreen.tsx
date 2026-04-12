import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type LostFoundDetailsRouteProp = RouteProp<RootStackParamList, "LostFoundDetails">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LostFoundItem {
  id: string;
  type: "lost" | "found";
  category: string;
  title: string;
  description: string;
  location?: string;
  route?: string;
  contactInfo: string;
  reward?: string;
  imageUrl?: string;
  status: "active" | "claimed" | "expired";
  createdAt: string;
  deviceId: string;
}

const CATEGORIES = [
  { value: "phone", label: "Phone", icon: "smartphone" },
  { value: "wallet", label: "Wallet/Purse", icon: "credit-card" },
  { value: "bag", label: "Bag/Backpack", icon: "shopping-bag" },
  { value: "document", label: "Documents", icon: "file-text" },
  { value: "keys", label: "Keys", icon: "key" },
  { value: "other", label: "Other", icon: "package" },
];

export default function LostFoundDetailsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LostFoundDetailsRouteProp>();
  const queryClient = useQueryClient();
  const { itemId } = route.params;

  const { data: item, isLoading, error } = useQuery<LostFoundItem>({
    queryKey: ["/api/lost-found", itemId],
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const deviceId = await getDeviceId();
      return apiRequest("PUT", `/api/lost-found/${itemId}/claim`, { deviceId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lost-found"] });
      Alert.alert("Success", "Item marked as claimed!");
      navigation.goBack();
    },
    onError: () => {
      Alert.alert("Error", "Failed to claim item. Please try again.");
    },
  });

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find((c) => c.value === category) || CATEGORIES[5];
  };

  const handleContact = () => {
    if (!item?.contactInfo) return;
    
    if (item.contactInfo.includes("@")) {
      Linking.openURL(`mailto:${item.contactInfo}`);
    } else {
      Linking.openURL(`tel:${item.contactInfo}`);
    }
  };

  const handleClaim = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
    
    Alert.alert(
      "Mark as Claimed",
      "Are you sure you want to mark this item as claimed/resolved?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Claim", onPress: () => claimMutation.mutate() },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: Spacing.xl }]}>
        <View style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (error || !item) {
    return (
      <ThemedView style={[styles.container, { paddingTop: Spacing.xl }]}>
        <View style={styles.loadingContainer}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Item not found
          </ThemedText>
          <Pressable
            style={[styles.backButton, { backgroundColor: BrandColors.primary.blue }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={{ color: "#FFFFFF" }}>Go Back</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const categoryInfo = getCategoryInfo(item.category);
  const isLost = item.type === "lost";
  const statusColor = isLost ? BrandColors.primary.red : BrandColors.primary.green;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.typeHeader, { backgroundColor: statusColor + "15" }]}>
          <Feather
            name={isLost ? "search" : "check-circle"}
            size={24}
            color={statusColor}
          />
          <ThemedText type="h4" style={{ color: statusColor, marginLeft: Spacing.sm }}>
            {isLost ? "LOST ITEM" : "FOUND ITEM"}
          </ThemedText>
          {item.status === "claimed" ? (
            <View style={[styles.claimedBadge, { backgroundColor: BrandColors.gray[600] }]}>
              <ThemedText style={styles.claimedText}>CLAIMED</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.categoryIcon,
                { backgroundColor: BrandColors.primary.blue + "15" },
              ]}
            >
              <Feather
                name={categoryInfo.icon as keyof typeof Feather.glyphMap}
                size={24}
                color={BrandColors.primary.blue}
              />
            </View>
            <View style={styles.cardHeaderInfo}>
              <ThemedText type="h4">{item.title}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {categoryInfo.label}
              </ThemedText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.section}>
            <ThemedText type="small" style={styles.sectionLabel}>
              Description
            </ThemedText>
            <ThemedText style={{ lineHeight: 22 }}>{item.description}</ThemedText>
          </View>

          {item.location ? (
            <View style={styles.section}>
              <ThemedText type="small" style={styles.sectionLabel}>
                Location
              </ThemedText>
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={16} color={theme.textSecondary} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>{item.location}</ThemedText>
              </View>
            </View>
          ) : null}

          {item.route ? (
            <View style={styles.section}>
              <ThemedText type="small" style={styles.sectionLabel}>
                Taxi Route
              </ThemedText>
              <View style={styles.infoRow}>
                <Feather name="navigation" size={16} color={theme.textSecondary} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>{item.route}</ThemedText>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <ThemedText type="small" style={styles.sectionLabel}>
              Posted
            </ThemedText>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={16} color={theme.textSecondary} />
              <ThemedText style={{ marginLeft: Spacing.sm }}>
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
          </View>

          {item.reward ? (
            <View style={[styles.rewardBanner, { backgroundColor: BrandColors.secondary.orange + "15" }]}>
              <Feather name="gift" size={20} color={BrandColors.secondary.orange} />
              <ThemedText style={[styles.rewardText, { color: BrandColors.secondary.orange }]}>
                Reward: {item.reward}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {item.status !== "claimed" ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: theme.surface }]}>
          <Pressable
            style={[styles.contactButton, { backgroundColor: BrandColors.primary.blue }]}
            onPress={handleContact}
          >
            <Feather name="phone" size={18} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Contact</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.claimButton, { backgroundColor: BrandColors.primary.green }]}
            onPress={handleClaim}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>
              {claimMutation.isPending ? "Claiming..." : "Mark Claimed"}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
  backButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  typeHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  claimedBadge: {
    marginLeft: "auto",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  claimedText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    color: "#666",
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rewardBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  rewardText: {
    marginLeft: Spacing.sm,
    fontWeight: "600",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  claimButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

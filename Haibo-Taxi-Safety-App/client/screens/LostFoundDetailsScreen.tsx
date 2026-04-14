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
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { SkeletonBlock } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BorderRadius,
  BrandColors,
  Typography,
} from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Lost & Found item detail page.
//
// Latent bugs fixed:
//   1. **Type interface mismatch** — the old LostFoundItem shape used
//      `location`, `route`, `contactInfo`, `reward: string` while the
//      backend GET /api/lost-found/:id returns the schema fields
//      `routeOrigin`, `routeDestination`, `contactName`, `contactPhone`,
//      `reward: number` plus a `contactInfo` alias for backwards compat.
//      The screen rendered three sections (`item.location`, `item.route`,
//      `item.reward` as string) that silently displayed nothing because
//      the field names were wrong. Fixed to read from the real fields.
//   2. **Loading state was just plain "Loading..." text** — replaced with
//      skeleton placeholders matching the layout, so the page doesn't
//      feel frozen on slow connections.
//   3. **No back button on the success path** — only the error state
//      had one. Added a hero-anchored back button.
//   4. **Contact button + Claim button hardcoded to blue/green** — wrong
//      brand. Now uses the rose gradient for primary contact CTA.

type LostFoundDetailsRouteProp = RouteProp<RootStackParamList, "LostFoundDetails">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LostFoundItem {
  id: string;
  type: "lost" | "found";
  category: string;
  title: string;
  description: string;
  routeOrigin?: string | null;
  routeDestination?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  // Backend alias for backwards compat — same value as contactPhone
  contactInfo?: string | null;
  reward?: number | null;
  imageUrl?: string | null;
  status: "active" | "claimed" | "expired";
  createdAt: string;
  deviceId?: string | null;
}

const CATEGORIES: Record<
  string,
  { label: string; icon: keyof typeof Feather.glyphMap }
> = {
  phone: { label: "Phone", icon: "smartphone" },
  wallet: { label: "Wallet / Purse", icon: "credit-card" },
  bag: { label: "Bag / Backpack", icon: "shopping-bag" },
  document: { label: "Documents", icon: "file-text" },
  keys: { label: "Keys", icon: "key" },
  other: { label: "Other", icon: "package" },
};

function getCategory(category: string) {
  return CATEGORIES[category] || CATEGORIES.other;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LostFoundDetailsScreen() {
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<LostFoundDetailsRouteProp>();
  const queryClient = useQueryClient();
  const { itemId } = route.params;

  const { data: item, isLoading, error } = useQuery<LostFoundItem>({
    queryKey: [`/api/lost-found/${itemId}`],
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const deviceId = await getDeviceId();
      return apiRequest(`/api/lost-found/${itemId}/claim`, {
        method: "PUT",
        body: JSON.stringify({ deviceId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lost-found"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/lost-found/${itemId}`],
      });
      Alert.alert("Marked as claimed", "Thanks for closing the loop!");
      navigation.goBack();
    },
    onError: () => {
      Alert.alert("Couldn't claim", "Please try again in a moment.");
    },
  });

  const triggerHaptic = async (
    style: "selection" | "medium" | "success" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = await import("expo-haptics");
      if (style === "success") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (style === "medium") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.selectionAsync();
      }
    } catch {}
  };

  const handleContact = () => {
    const phone = item?.contactPhone || item?.contactInfo;
    if (!phone) return;
    triggerHaptic("medium");
    Linking.openURL(`tel:${phone.replace(/\s/g, "")}`).catch(() => {});
  };

  const handleClaim = () => {
    Alert.alert(
      "Mark as claimed",
      "This tells the community the item has been returned. You can't undo this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, claim",
          onPress: async () => {
            await triggerHaptic("success");
            claimMutation.mutate();
          },
        },
      ]
    );
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroBadgeWrap}>
            <View style={styles.heroBadge}>
              <Feather
                name="package"
                size={28}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </View>
        </LinearGradient>

        <View
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <SkeletonBlock style={styles.skeletonBadge} />
          <SkeletonBlock style={styles.skeletonTitle} />
          <SkeletonBlock style={styles.skeletonLine} />
          <SkeletonBlock style={styles.skeletonLine} />
          <SkeletonBlock style={styles.skeletonLineShort} />
        </View>
      </View>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────
  if (error || !item) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        <View
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <View style={styles.errorState}>
            <View
              style={[
                styles.errorIcon,
                { backgroundColor: BrandColors.status.warning + "12" },
              ]}
            >
              <Feather
                name="alert-circle"
                size={32}
                color={BrandColors.status.warning}
              />
            </View>
            <ThemedText style={styles.errorTitle}>Item not found</ThemedText>
            <ThemedText
              style={[styles.errorHint, { color: theme.textSecondary }]}
            >
              This post may have been removed or claimed already.
            </ThemedText>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.errorButton}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={BrandColors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.errorButtonGradient}
              >
                <ThemedText style={styles.errorButtonText}>Go back</ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ─── Loaded ────────────────────────────────────────────────────────────────
  const isLost = item.type === "lost";
  const isClaimed = item.status === "claimed";
  const typeColor = isLost
    ? BrandColors.status.emergency
    : BrandColors.status.success;
  const cat = getCategory(item.category);
  const phone = item.contactPhone || item.contactInfo || null;
  const route_ =
    item.routeOrigin && item.routeDestination
      ? `${item.routeOrigin} → ${item.routeDestination}`
      : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: isClaimed
              ? insets.bottom + Spacing["3xl"]
              : insets.bottom + 80 + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
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
                name={cat.icon}
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle} numberOfLines={2}>
              {item.title}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>{cat.label}</ThemedText>
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
          {/* Status row */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(250)}
            style={styles.statusRow}
          >
            <View style={[styles.typeBadge, { backgroundColor: typeColor + "12" }]}>
              <Feather
                name={isLost ? "search" : "check-circle"}
                size={12}
                color={typeColor}
              />
              <ThemedText style={[styles.typeBadgeText, { color: typeColor }]}>
                {isLost ? "LOST" : "FOUND"}
              </ThemedText>
            </View>

            {isClaimed ? (
              <View
                style={[
                  styles.claimedBadge,
                  { backgroundColor: BrandColors.gray[600] },
                ]}
              >
                <Feather name="check" size={11} color="#FFFFFF" />
                <ThemedText style={styles.claimedText}>RESOLVED</ThemedText>
              </View>
            ) : null}
          </Animated.View>

          {/* Description */}
          <Section label="DESCRIPTION" theme={theme}>
            <ThemedText style={styles.descriptionText}>
              {item.description}
            </ThemedText>
          </Section>

          {/* Route */}
          {route_ ? (
            <Section label="TAXI ROUTE" theme={theme}>
              <View style={styles.infoRow}>
                <View
                  style={[
                    styles.infoIcon,
                    {
                      backgroundColor:
                        BrandColors.primary.gradientStart + "12",
                    },
                  ]}
                >
                  <Feather
                    name="navigation"
                    size={14}
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
                <ThemedText style={styles.infoText} numberOfLines={2}>
                  {route_}
                </ThemedText>
              </View>
            </Section>
          ) : null}

          {/* Posted */}
          <Section label="POSTED" theme={theme}>
            <View style={styles.infoRow}>
              <View
                style={[
                  styles.infoIcon,
                  { backgroundColor: BrandColors.primary.gradientStart + "12" },
                ]}
              >
                <Feather
                  name="calendar"
                  size={14}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.infoText}>
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
          </Section>

          {/* Contact */}
          {item.contactName || phone ? (
            <Section label="CONTACT" theme={theme}>
              <View
                style={[
                  styles.contactCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.contactAvatar}>
                  <ThemedText style={styles.contactMonogram}>
                    {item.contactName?.trim()?.charAt(0)?.toUpperCase() || "?"}
                  </ThemedText>
                </View>
                <View style={styles.contactInfo}>
                  {item.contactName ? (
                    <ThemedText
                      style={styles.contactName}
                      numberOfLines={1}
                    >
                      {item.contactName}
                    </ThemedText>
                  ) : null}
                  {phone ? (
                    <ThemedText
                      style={[styles.contactPhone, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {phone}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            </Section>
          ) : null}

          {/* Reward */}
          {item.reward && item.reward > 0 ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(400)}
              style={[
                styles.rewardBanner,
                {
                  backgroundColor: BrandColors.primary.gradientStart + "08",
                  borderColor: BrandColors.primary.gradientStart + "33",
                },
              ]}
            >
              <View
                style={[
                  styles.rewardIconWrap,
                  { backgroundColor: BrandColors.primary.gradientStart + "15" },
                ]}
              >
                <Feather
                  name="gift"
                  size={20}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <View style={styles.rewardTextWrap}>
                <ThemedText
                  style={[styles.rewardLabel, { color: theme.textSecondary }]}
                >
                  REWARD
                </ThemedText>
                <ThemedText style={styles.rewardAmount}>
                  R{item.reward.toFixed(0)}
                </ThemedText>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Footer CTA — hidden when claimed */}
      {!isClaimed ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + Spacing.md,
              backgroundColor: theme.surface,
              borderTopColor: theme.border,
            },
          ]}
        >
          {phone ? (
            <Pressable
              onPress={handleContact}
              style={({ pressed }) => [
                styles.contactButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Call ${phone}`}
            >
              <LinearGradient
                colors={BrandColors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.contactButtonGradient}
              >
                <Feather name="phone" size={18} color="#FFFFFF" />
                <ThemedText style={styles.footerButtonText}>Call</ThemedText>
              </LinearGradient>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleClaim}
            disabled={claimMutation.isPending}
            style={({ pressed }) => [
              styles.claimButton,
              {
                backgroundColor: theme.surface,
                borderColor: BrandColors.status.success,
              },
              pressed && styles.pressed,
              claimMutation.isPending && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Mark as claimed"
          >
            <Feather
              name="check"
              size={18}
              color={BrandColors.status.success}
            />
            <ThemedText
              style={[
                styles.claimButtonText,
                { color: BrandColors.status.success },
              ]}
            >
              {claimMutation.isPending ? "Claiming..." : "Mark claimed"}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({
  label,
  children,
  theme,
}: {
  label: string;
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <View style={styles.section}>
      <ThemedText
        style={[styles.sectionLabel, { color: theme.textSecondary }]}
      >
        {label}
      </ThemedText>
      {children}
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

  // Status row
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  typeBadgeText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  claimedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  claimedText: {
    color: "#FFFFFF",
    ...Typography.label,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: Spacing.sm,
  },
  descriptionText: {
    ...Typography.body,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },

  // Contact
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.primary.gradientStart,
    alignItems: "center",
    justifyContent: "center",
  },
  contactMonogram: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    ...Typography.body,
    fontWeight: "700",
  },
  contactPhone: {
    ...Typography.small,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },

  // Reward
  rewardBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginTop: Spacing.sm,
  },
  rewardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardTextWrap: {
    flex: 1,
  },
  rewardLabel: {
    ...Typography.label,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  rewardAmount: {
    ...Typography.h3,
    fontVariant: ["tabular-nums"],
    color: BrandColors.primary.gradientStart,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  contactButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  contactButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  footerButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  claimButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  claimButtonText: {
    ...Typography.body,
    fontWeight: "700",
  },

  // Skeleton
  skeletonBadge: {
    width: 80,
    height: 22,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  skeletonTitle: {
    width: "70%",
    height: 24,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  skeletonLine: {
    width: "100%",
    height: 14,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  skeletonLineShort: {
    width: "60%",
    height: 14,
    borderRadius: BorderRadius.xs,
  },

  // Error state
  errorState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  errorHint: {
    ...Typography.body,
    textAlign: "center",
    maxWidth: 280,
    marginBottom: Spacing.xl,
  },
  errorButton: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  errorButtonGradient: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
  },
  errorButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

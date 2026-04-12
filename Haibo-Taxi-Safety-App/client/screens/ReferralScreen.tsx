import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  Share,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { getApiUrl } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";

interface RewardTier {
  signups: number;
  type: string;
  description: string;
  unlocked: boolean;
}

interface ReferralStats {
  totalSignups: number;
  completedRides: number;
  nextTier: {
    signups: number;
    description: string;
    progress: number;
    remaining: number;
  } | null;
  allTiers: RewardTier[];
}

interface ReferralSignup {
  id: string;
  referredDeviceId: string;
  status: string;
  hasCompletedRide: boolean;
  createdAt: string;
}

const triggerHaptic = async (type: "light" | "medium" | "success") => {
  if (Platform.OS !== "web") {
    try {
      const Haptics = await import("expo-haptics");
      if (type === "light") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (type === "medium") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}
  }
};

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const [referralCode, setReferralCode] = useState<string>("");
  const [shareLink, setShareLink] = useState<string>("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [signups, setSignups] = useState<ReferralSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  const loadData = useCallback(async () => {
    if (!deviceId) return;

    setIsLoading(true);
    try {
      const codeUrl = new URL(`/api/referral/code/${deviceId}`, getApiUrl());
      const codeRes = await fetch(codeUrl.toString());
      const codeData = await codeRes.json();
      setReferralCode(codeData.referralCode);
      setShareLink(codeData.shareLink);

      const statsUrl = new URL(`/api/referral/stats/${deviceId}`, getApiUrl());
      const statsRes = await fetch(statsUrl.toString());
      const statsData = await statsRes.json();
      setStats(statsData);

      const signupsUrl = new URL(`/api/referral/signups/${deviceId}`, getApiUrl());
      const signupsRes = await fetch(signupsUrl.toString());
      const signupsData = await signupsRes.json();
      setSignups(signupsData);
    } catch (error) {
      console.error("Error loading referral data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [deviceId]);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) {
        loadData();
      }
    }, [deviceId, loadData])
  );

  const handleCopyCode = async () => {
    triggerHaptic("light");
    if (Platform.OS !== "web") {
      try {
        const Clipboard = await import("expo-clipboard");
        await Clipboard.setStringAsync(referralCode);
        Alert.alert("Copied!", "Referral code copied to clipboard");
      } catch {}
    }
  };

  const handleShare = async () => {
    triggerHaptic("medium");
    try {
      await Share.share({
        message: `Join Haibo Taxi with my referral code: ${referralCode}\n\nDownload now: ${shareLink}\n\nVia Haibo App`,
        title: "Invite friends to Haibo Taxi",
      });
      triggerHaptic("success");
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleClaimReward = async (tier: number) => {
    if (!deviceId) return;
    triggerHaptic("medium");

    try {
      const url = new URL("/api/referral/claim-reward", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, tier }),
      });
      const data = await response.json();

      if (data.id) {
        triggerHaptic("success");
        Alert.alert("Reward Claimed!", "Your reward has been processed.");
        loadData();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to claim reward");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case "wallet_credit":
        return "credit-card";
      case "tshirt":
        return "gift";
      case "accessory_pack":
        return "package";
      default:
        return "star";
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={BrandColors.primary.blue} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={[styles.codeCard, { backgroundColor: BrandColors.primary.blue }]}>
        <View style={styles.codeHeader}>
          <Feather name="gift" size={24} color="#FFFFFF" />
          <ThemedText style={styles.codeTitle}>Your Referral Code</ThemedText>
        </View>

        <View style={styles.codeDisplay}>
          <ThemedText style={styles.codeText}>{referralCode || "Loading..."}</ThemedText>
          <Pressable onPress={handleCopyCode} style={styles.copyButton}>
            <Feather name="copy" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <ThemedText style={styles.codeSubtitle}>
          Share this code with friends and earn rewards!
        </ThemedText>

        <Pressable onPress={handleShare} style={styles.shareButton}>
          <ThemedText style={styles.shareButtonText}>Share Invite Link</ThemedText>
        </Pressable>
      </View>

      <View style={[styles.statsCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={styles.sectionTitle}>Your Progress</ThemedText>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statNumber, { color: BrandColors.primary.green }]}>
              {stats?.totalSignups || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Sign-ups
            </ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statNumber, { color: BrandColors.primary.blue }]}>
              {stats?.completedRides || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Completed Rides
            </ThemedText>
          </View>
        </View>

        {stats?.nextTier ? (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Next reward: {stats.nextTier.description}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {stats.nextTier.remaining} more needed
              </ThemedText>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: BrandColors.primary.green,
                    width: `${stats.nextTier.progress}%`,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.rewardsCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={styles.sectionTitle}>Rewards</ThemedText>

        {stats?.allTiers.map((tier, index) => (
          <View
            key={tier.signups}
            style={[
              styles.rewardItem,
              { borderBottomColor: theme.border },
              index === stats.allTiers.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View
              style={[
                styles.rewardIcon,
                {
                  backgroundColor: tier.unlocked
                    ? BrandColors.primary.green + "20"
                    : theme.backgroundSecondary,
                },
              ]}
            >
              <Feather
                name={getRewardIcon(tier.type) as any}
                size={20}
                color={tier.unlocked ? BrandColors.primary.green : theme.textSecondary}
              />
            </View>

            <View style={styles.rewardInfo}>
              <ThemedText style={styles.rewardTitle}>{tier.description}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {tier.signups}+ referrals
              </ThemedText>
            </View>

            {tier.unlocked ? (
              <View style={[styles.unlockedBadge, { backgroundColor: BrandColors.primary.green }]}>
                <Feather name="check" size={14} color="#FFFFFF" />
              </View>
            ) : (
              <View style={[styles.lockedBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="lock" size={14} color={theme.textSecondary} />
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={[styles.signupsCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={styles.sectionTitle}>Recent Referrals</ThemedText>

        {signups.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={32} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
              No referrals yet. Share your code to get started!
            </ThemedText>
          </View>
        ) : (
          signups.slice(0, 5).map((signup) => (
            <View
              key={signup.id}
              style={[styles.signupItem, { borderBottomColor: theme.border }]}
            >
              <View
                style={[
                  styles.signupAvatar,
                  {
                    backgroundColor: signup.hasCompletedRide
                      ? BrandColors.primary.green + "20"
                      : BrandColors.primary.blue + "20",
                  },
                ]}
              >
                <Feather
                  name="user"
                  size={16}
                  color={signup.hasCompletedRide ? BrandColors.primary.green : BrandColors.primary.blue}
                />
              </View>

              <View style={styles.signupInfo}>
                <ThemedText style={styles.signupId}>
                  Friend #{signup.referredDeviceId.substring(0, 6)}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Joined {formatDate(signup.createdAt)}
                </ThemedText>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: signup.hasCompletedRide
                      ? BrandColors.primary.green + "20"
                      : BrandColors.secondary.orange + "20",
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.statusText,
                    {
                      color: signup.hasCompletedRide
                        ? BrandColors.primary.green
                        : BrandColors.secondary.orange,
                    },
                  ]}
                >
                  {signup.hasCompletedRide ? "Completed" : "Signed Up"}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={[styles.tipsCard, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={styles.sectionTitle}>Tips to Earn More</ThemedText>
        <View style={styles.tipItem}>
          <Feather name="share-2" size={16} color={BrandColors.primary.blue} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
            Share your code on social media to reach more friends
          </ThemedText>
        </View>
        <View style={styles.tipItem}>
          <Feather name="message-circle" size={16} color={BrandColors.primary.green} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
            Send personal invites via WhatsApp for better conversion
          </ThemedText>
        </View>
        <View style={styles.tipItem}>
          <Feather name="star" size={16} color={BrandColors.secondary.orange} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
            Top monthly referrer gets special recognition!
          </ThemedText>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  codeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  codeTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  codeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  codeText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 2,
  },
  copyButton: {
    padding: Spacing.sm,
  },
  codeSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  shareButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  shareButtonText: {
    color: BrandColors.primary.blue,
    fontSize: 16,
    fontWeight: "600",
  },
  statsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E0E0E0",
  },
  progressSection: {},
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  rewardsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  unlockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  signupsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  signupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  signupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  signupInfo: {
    flex: 1,
  },
  signupId: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tipsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
});

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  Share,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { SkeletonBlock } from "@/components/Skeleton";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Refer & Earn as a fintech-style growth dashboard:
//   1. Rose gradient hero with gift badge + back button
//   2. Floating white code card (gradient surface with monospaced code +
//      copy + share GradientButton) — replaces the old generic blue card
//   3. Stats strip: sign-ups + completed rides in a single rounded card
//   4. Progress bar in rose
//   5. Reward tiers list with rose-tinted unlocked icons (was green/grey)
//   6. Recent referrals list with rose monogram avatars
//   7. Skeleton loaders for the code + stats while the API call resolves
//      (the old screen showed a single ActivityIndicator over a blank
//      screen — felt like a freeze)
//
// Latent bugs fixed:
//   • Direct fetch() calls bypassed apiRequest's auth headers, base URL
//     resolution, and error handling. Now uses apiRequest() throughout.
//   • new URL(path, getApiUrl()) would throw if getApiUrl() returned null
//     (offline mode). apiRequest() handles this by throwing a typed error
//     we now catch + display an offline-friendly empty state.
//   • isLoading defaulted to true and never reset if deviceId resolution
//     failed — the spinner would hang forever.
//   • No back button on a screen reached from MenuScreen via root stack.

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
  if (Platform.OS === "web") return;
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
};

function getRewardIcon(type: string): keyof typeof Feather.glyphMap {
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
}

export default function ReferralScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [referralCode, setReferralCode] = useState<string>("");
  const [shareLink, setShareLink] = useState<string>("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [signups, setSignups] = useState<ReferralSignup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    getDeviceId()
      .then(setDeviceId)
      .catch(() => {
        setIsLoading(false);
        setOffline(true);
      });
  }, []);

  const loadData = useCallback(async () => {
    if (!deviceId) return;
    if (!getApiUrl()) {
      setIsLoading(false);
      setOffline(true);
      return;
    }

    setIsLoading(true);
    setOffline(false);
    try {
      const codeData = await apiRequest(`/api/referral/code/${deviceId}`);
      setReferralCode(codeData.referralCode || "");
      setShareLink(codeData.shareLink || "");

      const statsData = await apiRequest(`/api/referral/stats/${deviceId}`);
      setStats(statsData);

      const signupsData = await apiRequest(`/api/referral/signups/${deviceId}`);
      setSignups(Array.isArray(signupsData) ? signupsData : []);
    } catch (error) {
      console.error("Error loading referral data:", error);
      setOffline(true);
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
    if (!referralCode) return;
    triggerHaptic("light");
    if (Platform.OS !== "web") {
      try {
        const Clipboard = await import("expo-clipboard");
        await Clipboard.setStringAsync(referralCode);
        Alert.alert("Copied!", "Your referral code is on your clipboard.");
      } catch {}
    }
  };

  const handleShare = async () => {
    if (!referralCode) return;
    triggerHaptic("medium");
    try {
      await Share.share({
        message: `Join Haibo! with my referral code: ${referralCode}\n\nDownload now: ${shareLink}\n\nSafer minibus taxi rides for South Africa.`,
        title: "Invite friends to Haibo!",
      });
      triggerHaptic("success");
    } catch (error) {
      console.error("Share error:", error);
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
              <Feather name="gift" size={32} color={BrandColors.primary.gradientStart} />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Refer & earn</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Invite your crew, unlock rewards, and ride safer together.
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
          {/* Code card — rose surface (raised over the hero) */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(250)}
            style={styles.codeCardWrap}
          >
            <View
              style={[
                styles.codeCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: BrandColors.primary.gradientStart + "33",
                },
              ]}
            >
              <ThemedText
                style={[styles.codeLabel, { color: theme.textSecondary }]}
              >
                YOUR REFERRAL CODE
              </ThemedText>

              {isLoading ? (
                <View style={styles.codeSkeletonWrap}>
                  <SkeletonBlock style={styles.codeSkeleton} />
                </View>
              ) : referralCode ? (
                <Pressable
                  onPress={handleCopyCode}
                  style={({ pressed }) => [
                    styles.codeRow,
                    {
                      backgroundColor:
                        BrandColors.primary.gradientStart + "10",
                      borderColor:
                        BrandColors.primary.gradientStart + "33",
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Copy referral code"
                >
                  <ThemedText style={styles.codeText}>{referralCode}</ThemedText>
                  <View style={styles.copyIconWrap}>
                    <Feather
                      name="copy"
                      size={18}
                      color={BrandColors.primary.gradientStart}
                    />
                  </View>
                </Pressable>
              ) : (
                <View
                  style={[
                    styles.codeRow,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    style={[styles.codeFallback, { color: theme.textSecondary }]}
                  >
                    Code unavailable offline
                  </ThemedText>
                </View>
              )}

              {referralCode && deviceId && getApiUrl() ? (
                <View style={styles.qrWrap}>
                  <Image
                    source={{
                      uri: `${getApiUrl()!.replace(/\/$/, "")}/api/referral/code/${encodeURIComponent(deviceId)}/qr.png`,
                    }}
                    style={styles.qrImage}
                    accessibilityLabel="Scannable QR code for your referral link"
                  />
                  <ThemedText
                    style={[styles.qrHint, { color: theme.textSecondary }]}
                  >
                    Friends scan with their phone camera to sign up
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.shareCta}>
                <GradientButton
                  onPress={handleShare}
                  disabled={!referralCode}
                  size="large"
                  icon="send"
                  iconPosition="right"
                >
                  Share invite link
                </GradientButton>
              </View>
            </View>
          </Animated.View>

          {/* Stats strip */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(300)}
            style={[
              styles.statsCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <StatCell
              value={isLoading ? "—" : String(stats?.totalSignups || 0)}
              label="Sign-ups"
              theme={theme}
            />
            <View
              style={[styles.statDivider, { backgroundColor: theme.border }]}
            />
            <StatCell
              value={isLoading ? "—" : String(stats?.completedRides || 0)}
              label="Completed rides"
              theme={theme}
            />
          </Animated.View>

          {/* Next-tier progress */}
          {stats?.nextTier ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(350)}
              style={[
                styles.progressCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.progressHeader}>
                <ThemedText style={styles.progressTitle}>
                  Next reward
                </ThemedText>
                <ThemedText
                  style={[styles.progressRemaining, { color: theme.textSecondary }]}
                >
                  {stats.nextTier.remaining} more
                </ThemedText>
              </View>
              <ThemedText
                style={[styles.progressDescription, { color: theme.textSecondary }]}
              >
                {stats.nextTier.description}
              </ThemedText>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <LinearGradient
                  colors={BrandColors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(stats.nextTier.progress, 100)}%` },
                  ]}
                />
              </View>
            </Animated.View>
          ) : null}

          {/* Reward tiers */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(400)}
            style={styles.section}
          >
            <ThemedText
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              REWARD TIERS
            </ThemedText>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              {(stats?.allTiers && stats.allTiers.length > 0) ? (
                stats.allTiers.map((tier, index) => {
                  // Progression colors for tier badges — each tier gets a
                  // hotter hue to signal rarity/prestige. Teal → sky →
                  // fuchsia → rose (brand moment for the top tier).
                  const tierAccents = [
                    BrandColors.accent.teal,
                    BrandColors.accent.sky,
                    BrandColors.accent.fuchsia,
                    BrandColors.primary.gradientStart,
                  ];
                  const tierTint = tierAccents[Math.min(index, tierAccents.length - 1)];
                  return (
                  <View
                    key={`${tier.signups}-${tier.type}`}
                    style={[
                      styles.rewardItem,
                      index < stats.allTiers.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: theme.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.rewardIcon,
                        {
                          backgroundColor: tier.unlocked
                            ? tierTint + "18"
                            : theme.backgroundDefault,
                        },
                      ]}
                    >
                      <Feather
                        name={getRewardIcon(tier.type)}
                        size={18}
                        color={
                          tier.unlocked
                            ? tierTint
                            : theme.textSecondary
                        }
                      />
                    </View>

                    <View style={styles.rewardInfo}>
                      <ThemedText style={styles.rewardTitle}>
                        {tier.description}
                      </ThemedText>
                      <ThemedText
                        style={[styles.rewardMeta, { color: theme.textSecondary }]}
                      >
                        {tier.signups}+ referrals
                      </ThemedText>
                    </View>

                    {tier.unlocked ? (
                      <View
                        style={[
                          styles.unlockedBadge,
                          { backgroundColor: tierTint },
                        ]}
                      >
                        <Feather name="check" size={12} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.lockedBadge,
                          { backgroundColor: theme.backgroundDefault },
                        ]}
                      >
                        <Feather
                          name="lock"
                          size={12}
                          color={theme.textSecondary}
                        />
                      </View>
                    )}
                  </View>
                  );
                })
              ) : (
                <View style={styles.tiersSkeleton}>
                  <SkeletonBlock style={styles.tierSkeletonRow} />
                  <SkeletonBlock style={styles.tierSkeletonRow} />
                  <SkeletonBlock style={styles.tierSkeletonRow} />
                </View>
              )}
            </View>
          </Animated.View>

          {/* Recent referrals */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(450)}
            style={styles.section}
          >
            <ThemedText
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              RECENT REFERRALS
            </ThemedText>

            {signups.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
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
                    name="users"
                    size={22}
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
                <ThemedText style={styles.emptyTitle}>
                  No referrals yet
                </ThemedText>
                <ThemedText
                  style={[styles.emptyHint, { color: theme.textSecondary }]}
                >
                  Share your code above to start earning rewards.
                </ThemedText>
              </View>
            ) : (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                {signups.slice(0, 5).map((signup, index) => {
                  const isCompleted = signup.hasCompletedRide;
                  const monogram =
                    signup.referredDeviceId
                      ?.replace(/[^a-z0-9]/gi, "")
                      ?.charAt(0)
                      ?.toUpperCase() || "?";
                  return (
                    <View
                      key={signup.id}
                      style={[
                        styles.signupItem,
                        index < Math.min(signups.length, 5) - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.signupAvatar}>
                        <ThemedText style={styles.signupMonogram}>
                          {monogram}
                        </ThemedText>
                      </View>

                      <View style={styles.signupInfo}>
                        <ThemedText style={styles.signupId} numberOfLines={1}>
                          Friend #{signup.referredDeviceId.substring(0, 6)}
                        </ThemedText>
                        <ThemedText
                          style={[styles.signupDate, { color: theme.textSecondary }]}
                        >
                          Joined {formatDate(signup.createdAt)}
                        </ThemedText>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isCompleted
                              ? BrandColors.status.success + "18"
                              : BrandColors.primary.gradientStart + "12",
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.statusText,
                            {
                              color: isCompleted
                                ? BrandColors.status.success
                                : BrandColors.primary.gradientStart,
                            },
                          ]}
                        >
                          {isCompleted ? "COMPLETED" : "SIGNED UP"}
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>

          {/* Tips */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(550)}
            style={styles.section}
          >
            <ThemedText
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              EARN MORE
            </ThemedText>
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <TipRow
                icon="share-2"
                text="Share on socials to reach a wider crew"
                theme={theme}
              />
              <Divider theme={theme} />
              <TipRow
                icon="message-circle"
                text="Send personal invites on WhatsApp for higher conversion"
                theme={theme}
              />
              <Divider theme={theme} />
              <TipRow
                icon="star"
                text="Top monthly referrers get featured on Phusha"
                theme={theme}
              />
            </View>
          </Animated.View>

          {offline ? (
            <View
              style={[
                styles.offlineBanner,
                {
                  backgroundColor: BrandColors.status.warning + "15",
                  borderColor: BrandColors.status.warning + "40",
                },
              ]}
            >
              <Feather
                name="wifi-off"
                size={16}
                color={BrandColors.status.warning}
              />
              <ThemedText
                style={[styles.offlineText, { color: theme.text }]}
              >
                Offline — referral data will sync when you reconnect.
              </ThemedText>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCell({
  value,
  label,
  theme,
}: {
  value: string;
  label: string;
  theme: any;
}) {
  return (
    <View style={styles.statCell}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function TipRow({
  icon,
  text,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  theme: any;
}) {
  return (
    <View style={styles.tipRow}>
      <View
        style={[
          styles.tipIcon,
          { backgroundColor: BrandColors.primary.gradientStart + "12" },
        ]}
      >
        <Feather
          name={icon}
          size={16}
          color={BrandColors.primary.gradientStart}
        />
      </View>
      <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
        {text}
      </ThemedText>
    </View>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
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

  // Code card
  codeCardWrap: {
    marginBottom: Spacing.lg,
  },
  codeCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  codeLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
  },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginBottom: Spacing.lg,
  },
  codeText: {
    color: BrandColors.primary.gradientStart,
    fontSize: 26,
    fontWeight: "800",
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  codeFallback: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  copyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  codeSkeletonWrap: {
    marginBottom: Spacing.lg,
  },
  codeSkeleton: {
    height: 56,
    borderRadius: BorderRadius.sm,
  },
  shareCta: {
    marginTop: 0,
  },
  qrWrap: {
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  qrImage: {
    width: 180,
    height: 180,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
  },
  qrHint: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },

  // Stats
  statsCard: {
    flexDirection: "row",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    ...Typography.h2,
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    marginVertical: Spacing.xs,
  },

  // Progress
  progressCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  progressTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  progressRemaining: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "700",
  },
  progressDescription: {
    ...Typography.small,
    marginBottom: Spacing.md,
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

  // Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    marginLeft: Spacing.lg + 36 + Spacing.md,
  },

  // Reward tiers
  rewardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  rewardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  rewardInfo: {
    flex: 1,
  },
  rewardTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  rewardMeta: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  unlockedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tiersSkeleton: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  tierSkeletonRow: {
    height: 40,
    borderRadius: BorderRadius.sm,
  },

  // Signups
  signupItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  signupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.primary.gradientStart,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  signupMonogram: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "Nunito_800ExtraBold",
  },
  signupInfo: {
    flex: 1,
    minWidth: 0,
  },
  signupId: {
    ...Typography.body,
    fontWeight: "700",
  },
  signupDate: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    ...Typography.label,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 260,
  },

  // Tips
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    ...Typography.small,
    flex: 1,
  },

  // Offline banner
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  offlineText: {
    ...Typography.small,
    fontSize: 12,
    flex: 1,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

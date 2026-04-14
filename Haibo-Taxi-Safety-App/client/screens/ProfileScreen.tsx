import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { EmergencyContact } from "@/lib/types";
import { getEmergencyContacts } from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { uploadFromUri } from "@/lib/uploads";

// typeui-clean rework — Profile as a fintech-style account hub:
//   1. Reads the live user from useAuth() instead of local AsyncStorage —
//      the old screen had its own UserProfile shape that never synced with
//      the server, so it always showed "Guest User" even when signed in
//   2. Rose gradient hero with a white-on-rose monogram avatar (first
//      letter of displayName), role badge, verification check
//   3. Stats strip: single rounded card with 3 dividers (Trips · Reports
//      · Contacts) instead of three flat tiles
//   4. Single rose-tinted icon palette across all menu rows (drops the
//      red/green/blue/purple rainbow)
//   5. Edit profile routes to ProfileSetup screen on both platforms (was
//      iOS-only Alert.prompt that just showed "Name editing is available
//      on iOS" on Android — broken UX)
//   6. Sign-out CTA at the bottom, wired to useAuth().logout
//   7. Friendly "Sign in" empty-hero state when not authenticated

const USER_ROLE_LABELS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  commuter: { label: "Commuter", icon: "user" },
  driver: { label: "Driver", icon: "truck" },
  operator: { label: "Operator", icon: "briefcase" },
};

export default function ProfileScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user, isAuthenticated, logout, updateProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const loadContacts = useCallback(async () => {
    const contacts = await getEmergencyContacts();
    setEmergencyContacts(contacts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts();
    }, [loadContacts])
  );

  const triggerHaptic = async (
    style: "light" | "medium" | "success" = "light"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = await import("expo-haptics");
      if (style === "success") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (style === "medium") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
  };

  const handleEditProfile = () => {
    triggerHaptic("light");
    navigation.navigate("ProfileSetup");
  };

  // Tap the avatar → pick from library → upload → PUT /api/auth/profile
  // with the returned URL. Optimistic local state update via updateProfile
  // keeps the new photo visible immediately.
  const handleChangeAvatar = async () => {
    if (!isAuthenticated || avatarUploading) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Grant photo library access to change your avatar.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      await triggerHaptic("light");
      setAvatarUploading(true);
      const uploaded = await uploadFromUri(result.assets[0].uri, {
        folder: "profiles",
        name: result.assets[0].fileName || undefined,
      });
      const update = await updateProfile({ avatarUrl: uploaded.url });
      if (!update.success) {
        throw new Error(update.error || "Failed to save avatar");
      }
      await triggerHaptic("success");
    } catch (error: any) {
      Alert.alert("Upload failed", error.message || "Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleEmergencyContacts = () => {
    triggerHaptic("light");
    navigation.navigate("EmergencyContacts");
  };

  const handlePayment = () => {
    triggerHaptic("light");
    navigation.navigate("Wallet");
  };

  const handleSettings = () => {
    triggerHaptic("light");
    navigation.navigate("Settings");
  };

  const handleSignIn = () => {
    triggerHaptic("light");
    navigation.navigate("Auth");
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out",
      "You'll need to sign back in to access your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await triggerHaptic("medium");
            await logout();
          },
        },
      ]
    );
  };

  const displayName = user?.displayName?.trim() || "Welcome to Haibo!";
  const phoneText = user?.phone || "Sign in to add your number";
  const monogram = user?.displayName?.trim()?.charAt(0)?.toUpperCase() || "H";
  const roleKey = user?.role || "commuter";
  const role = USER_ROLE_LABELS[roleKey] || USER_ROLE_LABELS.commuter;
  const isVerified = !!user?.isVerified;

  const menuItems: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    hint: string;
    onPress: () => void;
  }[] = [
    {
      icon: "users",
      label: "Emergency contacts",
      hint:
        emergencyContacts.length > 0
          ? `${emergencyContacts.length} contact${
              emergencyContacts.length === 1 ? "" : "s"
            } saved`
          : "Add the people you trust",
      onPress: handleEmergencyContacts,
    },
    {
      icon: "credit-card",
      label: "Haibo Pay",
      hint: "Wallet, top-ups and EFT withdrawals",
      onPress: handlePayment,
    },
    {
      icon: "clock",
      label: "Trip history",
      hint: "View your past taxi trips",
      onPress: () => triggerHaptic("light"),
    },
    {
      icon: "settings",
      label: "Settings",
      hint: "Notifications, privacy, language",
      onPress: handleSettings,
    },
    {
      icon: "help-circle",
      label: "Support",
      hint: "Get help from the Haibo team",
      onPress: () => triggerHaptic("light"),
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Rose gradient hero — anchored, name + avatar + role */}
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.xl }]}
        >
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(400)}
            style={styles.heroAvatarWrap}
          >
            <Pressable
              onPress={handleChangeAvatar}
              disabled={!isAuthenticated || avatarUploading}
              accessibilityRole="button"
              accessibilityLabel={
                isAuthenticated ? "Change profile photo" : "Profile photo"
              }
              style={styles.avatarRing}
            >
              <View style={styles.avatar}>
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <ThemedText style={styles.avatarMonogram}>{monogram}</ThemedText>
                )}
              </View>
              {isAuthenticated ? (
                <View style={styles.avatarEditBadge}>
                  <Feather
                    name={avatarUploading ? "loader" : "camera"}
                    size={12}
                    color="#FFFFFF"
                  />
                </View>
              ) : null}
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(100)}
            style={styles.heroTextWrap}
          >
            <View style={styles.nameRow}>
              <ThemedText style={styles.heroName} numberOfLines={1}>
                {displayName}
              </ThemedText>
              {isVerified ? (
                <View style={styles.verifiedDot}>
                  <Feather name="check" size={12} color={BrandColors.primary.gradientStart} />
                </View>
              ) : null}
            </View>
            <ThemedText style={styles.heroPhone}>{phoneText}</ThemedText>

            <View style={styles.heroBadgeRow}>
              <View style={styles.roleBadge}>
                <Feather name={role.icon} size={12} color="#FFFFFF" />
                <ThemedText style={styles.roleBadgeText}>
                  {role.label.toUpperCase()}
                </ThemedText>
              </View>

              {isAuthenticated ? (
                <Pressable
                  onPress={handleEditProfile}
                  hitSlop={8}
                  style={styles.editButton}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                >
                  <Feather name="edit-2" size={12} color="#FFFFFF" />
                  <ThemedText style={styles.editButtonText}>EDIT</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Stats strip — single rounded card with vertical dividers */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
          style={[
            styles.statsCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <StatCell value="0" label="Trips" theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatCell value="0" label="Reports" theme={theme} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatCell
            value={String(emergencyContacts.length)}
            label="Contacts"
            theme={theme}
          />
        </Animated.View>

        {/* Sign-in CTA when not authenticated */}
        {!isAuthenticated ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}
            style={styles.signInPrompt}
          >
            <Pressable
              onPress={handleSignIn}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Sign in to Haibo"
            >
              <LinearGradient
                colors={BrandColors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signInCard}
              >
                <View style={styles.signInIconWrap}>
                  <Feather name="log-in" size={20} color="#FFFFFF" />
                </View>
                <View style={styles.signInTextWrap}>
                  <ThemedText style={styles.signInTitle}>Sign in to Haibo!</ThemedText>
                  <ThemedText style={styles.signInHint}>
                    Save your contacts and unlock Haibo Pay
                  </ThemedText>
                </View>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* Menu */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(300)}
          style={styles.menuSection}
        >
          <ThemedText
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            ACCOUNT
          </ThemedText>
          <View
            style={[
              styles.menuCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            {menuItems.map((item, index) => (
              <React.Fragment key={item.label}>
                <Pressable
                  onPress={item.onPress}
                  style={({ pressed }) => [
                    styles.menuItem,
                    {
                      backgroundColor: pressed
                        ? theme.backgroundSecondary
                        : "transparent",
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View
                    style={[
                      styles.menuIcon,
                      {
                        backgroundColor: BrandColors.primary.gradientStart + "12",
                      },
                    ]}
                  >
                    <Feather
                      name={item.icon}
                      size={18}
                      color={BrandColors.primary.gradientStart}
                    />
                  </View>
                  <View style={styles.menuContent}>
                    <ThemedText style={styles.menuLabel}>{item.label}</ThemedText>
                    <ThemedText
                      style={[styles.menuHint, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.hint}
                    </ThemedText>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
                {index < menuItems.length - 1 ? (
                  <View
                    style={[styles.divider, { backgroundColor: theme.border }]}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </Animated.View>

        {/* Sign-out — only when authenticated */}
        {isAuthenticated ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(400)}
            style={styles.signOutWrap}
          >
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: BrandColors.status.emergency + "40",
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Feather
                name="log-out"
                size={16}
                color={BrandColors.status.emergency}
              />
              <ThemedText
                style={[styles.signOutText, { color: BrandColors.status.emergency }]}
              >
                Sign out
              </ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}

        <ThemedText
          style={[styles.versionText, { color: theme.textSecondary }]}
        >
          Haibo! v1.0.0 — built for Mzansi
        </ThemedText>
      </ScrollView>
    </View>
  );
}

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

const HERO_HEIGHT_BOTTOM_PAD = Spacing["3xl"];

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing["3xl"],
  },

  // Hero
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: HERO_HEIGHT_BOTTOM_PAD,
    alignItems: "center",
  },
  heroAvatarWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarMonogram: {
    fontSize: 36,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
    color: BrandColors.primary.gradientStart,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  heroTextWrap: {
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  heroName: {
    ...Typography.h2,
    color: "#FFFFFF",
    textAlign: "center",
  },
  verifiedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  heroPhone: {
    ...Typography.body,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  roleBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  editButtonText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: "700",
  },

  // Stats strip
  statsCard: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing["2xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: Spacing.xl,
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

  // Sign-in card (unauthenticated)
  signInPrompt: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  signInCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  signInIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  signInTextWrap: {
    flex: 1,
  },
  signInTitle: {
    ...Typography.h4,
    color: "#FFFFFF",
  },
  signInHint: {
    ...Typography.small,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },

  // Menu
  menuSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  menuCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  menuHint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.lg + 36 + Spacing.md,
  },

  // Sign-out
  signOutWrap: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  signOutText: {
    ...Typography.body,
    fontWeight: "700",
  },

  versionText: {
    ...Typography.small,
    fontSize: 11,
    textAlign: "center",
    marginTop: Spacing.md,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

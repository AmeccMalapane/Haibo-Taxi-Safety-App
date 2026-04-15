import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Settings as a calm preferences hub:
//   1. Rose gradient hero with back button + sliders badge
//   2. Floating white card with grouped setting rows
//   3. Toggles persist to AsyncStorage (the old screen used React state
//      that reset every time you visited the screen — silent bug)
//   4. Privacy / Terms / Contact / Help links actually open via Linking
//      (the old rows had no onPress handler — dead links)
//   5. App version reads from expo-constants instead of being a hardcoded
//      "App Version" placeholder row
//   6. Sign-out CTA wired to useAuth().logout (the old logout button had
//      no onPress at all — pressed nothing happened)
//
// Single rose-tinted icon palette across every row, drops the
// inline 14/700/uppercase soup in favour of Typography.label tokens.

const NOTIFICATIONS_KEY = "@haibo_settings_notifications";
const LOCATION_KEY = "@haibo_settings_location_sharing";

const PRIVACY_URL = "https://app.haibo.africa/privacy";
const TERMS_URL = "https://app.haibo.africa/terms";
const HELP_URL = "https://app.haibo.africa/help";
const SUPPORT_EMAIL = "support@haibo.africa";

export default function SettingsScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isAuthenticated, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [notifications, setNotifications] = useState(true);
  const [locationSharing, setLocationSharing] = useState(true);

  // Hydrate persisted toggles
  useEffect(() => {
    (async () => {
      try {
        const [n, l] = await Promise.all([
          AsyncStorage.getItem(NOTIFICATIONS_KEY),
          AsyncStorage.getItem(LOCATION_KEY),
        ]);
        if (n !== null) setNotifications(n === "true");
        if (l !== null) setLocationSharing(l === "true");
      } catch {}
    })();
  }, []);

  const triggerHaptic = async (
    type: "selection" | "medium" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = await import("expo-haptics");
      if (type === "medium") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.selectionAsync();
      }
    } catch {}
  };

  const handleNotificationsToggle = useCallback(async (value: boolean) => {
    setNotifications(value);
    triggerHaptic("selection");
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(value));
    } catch {}
  }, []);

  const handleLocationToggle = useCallback(async (value: boolean) => {
    setLocationSharing(value);
    triggerHaptic("selection");
    try {
      await AsyncStorage.setItem(LOCATION_KEY, String(value));
    } catch {}
  }, []);

  const openExternalUrl = async (url: string, label: string) => {
    triggerHaptic("selection");
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        Alert.alert(label, "Couldn't open the link. Please try again later.");
      }
    } catch {
      Alert.alert(label, "Couldn't open the link. Please try again later.");
    }
  };

  const handleContactSupport = () => {
    openExternalUrl(`mailto:${SUPPORT_EMAIL}`, "Contact support");
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

  const appVersion =
    (Constants.expoConfig?.version as string | undefined) || "1.0.0";
  const buildNumber =
    Platform.select({
      ios: Constants.expoConfig?.ios?.buildNumber,
      android: Constants.expoConfig?.android?.versionCode?.toString(),
    }) || null;

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
              <Feather name="sliders" size={32} color={BrandColors.primary.gradientStart} />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Settings</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Manage notifications, privacy, and account preferences.
            </ThemedText>
          </Animated.View>
        </LinearGradient>

        {/* Floating white content card */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          {/* Privacy & Security */}
          <SectionHeader theme={theme} label="PRIVACY & SECURITY" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <SettingRow
              icon="bell"
              label="Push notifications"
              hint="Alerts for SOS, payments, and updates"
              type="toggle"
              value={notifications}
              onValueChange={handleNotificationsToggle}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="map-pin"
              label="Location sharing"
              hint="Share live location with emergency contacts"
              type="toggle"
              value={locationSharing}
              onValueChange={handleLocationToggle}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="shield"
              label="Privacy policy"
              hint="How we handle your data"
              onPress={() => openExternalUrl(PRIVACY_URL, "Privacy policy")}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="file-text"
              label="Terms of service"
              hint="Your agreement with Haibo!"
              onPress={() => openExternalUrl(TERMS_URL, "Terms of service")}
              theme={theme}
            />
          </View>

          {/* Support */}
          <SectionHeader theme={theme} label="SUPPORT" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <SettingRow
              icon="help-circle"
              label="Help centre"
              hint="Guides and FAQs"
              onPress={() => openExternalUrl(HELP_URL, "Help centre")}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="mail"
              label="Contact support"
              hint={SUPPORT_EMAIL}
              onPress={handleContactSupport}
              theme={theme}
            />
          </View>

          {/* About */}
          <SectionHeader theme={theme} label="ABOUT" />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.aboutRow}>
              <View
                style={[
                  styles.settingIconContainer,
                  {
                    backgroundColor: BrandColors.primary.gradientStart + "12",
                  },
                ]}
              >
                <Feather
                  name="info"
                  size={18}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <View style={styles.settingLabelWrap}>
                <ThemedText style={styles.settingLabel}>App version</ThemedText>
                <ThemedText
                  style={[styles.settingHint, { color: theme.textSecondary }]}
                >
                  Built for Mzansi
                </ThemedText>
              </View>
              <View style={styles.versionPill}>
                <ThemedText style={styles.versionText}>
                  v{appVersion}
                  {buildNumber ? ` (${buildNumber})` : ""}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* Sign out — only when authenticated */}
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
                  style={[
                    styles.signOutText,
                    { color: BrandColors.status.emergency },
                  ]}
                >
                  Sign out
                </ThemedText>
              </Pressable>
            </Animated.View>
          ) : null}

          <ThemedText
            style={[styles.footerText, { color: theme.textSecondary }]}
          >
            Haibo! · Rise, Create, Thrive
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({
  theme,
  label,
}: {
  theme: any;
  label: string;
}) {
  return (
    <ThemedText
      style={[styles.sectionTitle, { color: theme.textSecondary }]}
    >
      {label}
    </ThemedText>
  );
}

function Divider({ theme }: { theme: any }) {
  return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

interface SettingRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  hint?: string;
  type?: "toggle" | "link";
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  theme: any;
}

function SettingRow({
  icon,
  label,
  hint,
  type = "link",
  value,
  onValueChange,
  onPress,
  theme,
}: SettingRowProps) {
  return (
    <Pressable
      onPress={type === "link" ? onPress : undefined}
      style={({ pressed }) => [
        styles.settingItem,
        {
          backgroundColor:
            pressed && type === "link" ? theme.backgroundSecondary : "transparent",
        },
      ]}
      accessibilityRole={type === "link" ? "button" : "switch"}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.settingIconContainer,
          { backgroundColor: BrandColors.primary.gradientStart + "12" },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={BrandColors.primary.gradientStart}
        />
      </View>
      <View style={styles.settingLabelWrap}>
        <ThemedText style={styles.settingLabel}>{label}</ThemedText>
        {hint ? (
          <ThemedText
            style={[styles.settingHint, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {type === "toggle" ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{
            false: theme.border,
            true: BrandColors.primary.gradientStart,
          }}
          thumbColor={Platform.OS === "ios" ? undefined : "#FFFFFF"}
          ios_backgroundColor={theme.border}
        />
      ) : (
        <Feather name="chevron-right" size={18} color={theme.textSecondary} />
      )}
    </Pressable>
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

  // Section
  sectionTitle: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
    marginTop: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Setting row
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingLabelWrap: {
    flex: 1,
  },
  settingLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  settingHint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: Spacing.lg + 36 + Spacing.md,
  },

  // About row (no link/toggle)
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  versionPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
  },
  versionText: {
    ...Typography.label,
    fontSize: 11,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
    fontVariant: ["tabular-nums"],
  },

  // Sign out
  signOutWrap: {
    marginTop: Spacing.xl,
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

  footerText: {
    ...Typography.small,
    fontSize: 11,
    textAlign: "center",
    marginTop: Spacing.xl,
    fontStyle: "italic",
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

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
import { useLanguage } from "@/hooks/useLanguage";
import { ThemedText } from "@/components/ThemedText";
import { apiRequest } from "@/lib/query-client";
import { registerForPushNotifications } from "@/lib/notifications";
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

const PRIVACY_URL = "https://app.haibo.africa/privacy";
const TERMS_URL = "https://app.haibo.africa/terms";
const HELP_URL = "https://app.haibo.africa/help";
const SUPPORT_EMAIL = "support@haibo.africa";

export default function SettingsScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isAuthenticated, logout } = useAuth();
  const { currentLang, setLanguage, languages, t } = useLanguage();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [notifications, setNotifications] = useState(true);
  const [showLangPicker, setShowLangPicker] = useState(false);

  // Hydrate persisted toggles
  useEffect(() => {
    (async () => {
      try {
        const n = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
        if (n !== null) setNotifications(n === "true");
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
    // Optimistic UI — the toggle flips immediately and we persist the
    // preference locally before the network hop so the screen stays
    // responsive. Server-side FCM token registration/clear happens in
    // the background; if it fails we revert the toggle and surface an
    // alert so the user knows their choice didn't actually take effect.
    setNotifications(value);
    triggerHaptic("selection");
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(value));
    } catch {}

    try {
      if (value) {
        // Re-register the push token with the server so future pushes
        // start flowing again. registerForPushNotifications() handles
        // the permission request + token fetch + POST /api/notifications
        // /register-token internally.
        await registerForPushNotifications();
      } else {
        // Clear the server-side FCM token so pushes stop immediately.
        // The in-app notifications inbox still receives new rows (that
        // backend path writes to the DB regardless of push delivery),
        // so the user's notification history is unaffected.
        await apiRequest("/api/notifications/register-token", {
          method: "DELETE",
        });
      }
    } catch (err: any) {
      // Server sync failed — roll back the local toggle so the UI
      // doesn't lie about the current state. A toast-level error is
      // fine here since the user can just retry.
      setNotifications(!value);
      try {
        await AsyncStorage.setItem(NOTIFICATIONS_KEY, String(!value));
      } catch {}
      Alert.alert(
        "Couldn't update preference",
        err?.message ||
          "Your notification preference couldn't be synced. Please try again.",
      );
    }
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

  // POPIA §23 — self-service data export. Calls the server endpoint and
  // shows the inventory summary in a native dialog. Full row-level exports
  // go through privacy@haibo.africa per the privacy policy.
  const [isExporting, setIsExporting] = useState(false);
  const handleExportData = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = await apiRequest("/api/user/export", { method: "POST" });
      const counts = data?.relatedRecordCounts ?? {};
      const summary = Object.entries(counts)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join("\n");
      Alert.alert(
        "Your data",
        `Profile fields returned.\n\nRecord counts:\n${summary}\n\nFor raw row-level exports email ${SUPPORT_EMAIL.replace("support", "privacy")}.`,
      );
    } catch (err: any) {
      Alert.alert(
        "Couldn't load your data",
        err?.message || "Please try again or email privacy@haibo.africa.",
      );
    } finally {
      setIsExporting(false);
    }
  };

  // POPIA §24 — self-service erasure. Two-step confirmation so a rage-tap
  // can't nuke an account. Soft-suspends + anonymizes PII server-side,
  // then forces a client-side logout.
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "This will permanently lock your account, anonymize your profile, and schedule remaining data for purge within 30 days. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Tap Delete below to permanently close your Haibo! account.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await apiRequest("/api/user/delete", { method: "POST" });
                      Alert.alert(
                        "Account closed",
                        "Your account has been locked and your data scheduled for purge. Signing you out now.",
                        [
                          {
                            text: "OK",
                            onPress: async () => {
                              await logout();
                            },
                          },
                        ],
                      );
                    } catch (err: any) {
                      Alert.alert(
                        "Couldn't delete account",
                        err?.message ||
                          "Please try again or email privacy@haibo.africa.",
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
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
            <ThemedText style={styles.heroTitle}>{t("settings.title")}</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {t("settings.subtitle")}
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
          {/* Language */}
          <SectionHeader theme={theme} label={t("settings.languageSection")} />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <SettingRow
              icon="globe"
              label={t("settings.appLanguage")}
              hint={languages.find((l) => l.code === currentLang)?.nativeLabel || "English"}
              onPress={() => setShowLangPicker(!showLangPicker)}
              theme={theme}
            />
            {showLangPicker && (
              <View style={styles.langPicker}>
                {languages.map((lang) => {
                  const isActive = currentLang === lang.code;
                  return (
                    <Pressable
                      key={lang.code}
                      onPress={() => {
                        setLanguage(lang.code);
                        setShowLangPicker(false);
                      }}
                      style={[
                        styles.langOption,
                        {
                          backgroundColor: isActive
                            ? BrandColors.primary.gradientStart + "12"
                            : "transparent",
                          borderColor: isActive
                            ? BrandColors.primary.gradientStart
                            : theme.border,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <ThemedText style={[styles.langLabel, isActive && { color: BrandColors.primary.gradientStart }]}>
                          {lang.nativeLabel}
                        </ThemedText>
                        <ThemedText style={[styles.langSublabel, { color: theme.textSecondary }]}>
                          {lang.label}
                        </ThemedText>
                      </View>
                      {isActive && (
                        <Feather name="check" size={18} color={BrandColors.primary.gradientStart} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Privacy & Security */}
          <SectionHeader theme={theme} label={t("settings.privacySecurity")} />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <SettingRow
              icon="bell"
              label={t("settings.pushNotifications")}
              hint={t("settings.pushHint")}
              type="toggle"
              value={notifications}
              onValueChange={handleNotificationsToggle}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="map-pin"
              label={t("settings.locationPermission")}
              hint={t("settings.locationHint")}
              onPress={() => Linking.openSettings()}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="shield"
              label={t("settings.privacyPolicy")}
              hint={t("settings.privacyHint")}
              onPress={() => openExternalUrl(PRIVACY_URL, "Privacy policy")}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="file-text"
              label={t("settings.termsOfService")}
              hint={t("settings.termsHint")}
              onPress={() => openExternalUrl(TERMS_URL, "Terms of service")}
              theme={theme}
            />
          </View>

          {/* Your data — POPIA self-service. Only visible when authed
              because both endpoints require a bearer token. */}
          {isAuthenticated ? (
            <>
              <SectionHeader theme={theme} label={t("settings.yourData")} />
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <SettingRow
                  icon="download"
                  label={isExporting ? t("common.loading") : t("settings.exportData")}
                  hint={t("settings.exportHint")}
                  onPress={handleExportData}
                  theme={theme}
                />
                <Divider theme={theme} />
                <SettingRow
                  icon="trash-2"
                  label={t("settings.deleteAccount")}
                  hint={t("settings.deleteAccountHint")}
                  onPress={handleDeleteAccount}
                  theme={theme}
                  destructive
                />
              </View>
            </>
          ) : null}

          {/* Support */}
          <SectionHeader theme={theme} label={t("settings.support")} />
          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <SettingRow
              icon="help-circle"
              label={t("settings.helpCentre")}
              hint={t("settings.helpHint")}
              onPress={() => openExternalUrl(HELP_URL, "Help centre")}
              theme={theme}
            />
            <Divider theme={theme} />
            <SettingRow
              icon="mail"
              label={t("settings.contactSupport")}
              hint={SUPPORT_EMAIL}
              onPress={handleContactSupport}
              theme={theme}
            />
          </View>

          {/* About */}
          <SectionHeader theme={theme} label={t("settings.about")} />
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
                <ThemedText style={styles.settingLabel}>{t("settings.appVersion")}</ThemedText>
                <ThemedText
                  style={[styles.settingHint, { color: theme.textSecondary }]}
                >
                  {t("settings.builtForMzansi")}
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
                  {t("settings.signOut")}
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
  destructive?: boolean;
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
  destructive = false,
}: SettingRowProps) {
  const accentColor = destructive
    ? BrandColors.status.emergency
    : BrandColors.primary.gradientStart;
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
          { backgroundColor: accentColor + "12" },
        ]}
      >
        <Feather name={icon} size={18} color={accentColor} />
      </View>
      <View style={styles.settingLabelWrap}>
        <ThemedText
          style={[
            styles.settingLabel,
            destructive && { color: accentColor },
          ]}
        >
          {label}
        </ThemedText>
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
  langPicker: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  langOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  langLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  langSublabel: {
    fontSize: 12,
    marginTop: 2,
  },
});

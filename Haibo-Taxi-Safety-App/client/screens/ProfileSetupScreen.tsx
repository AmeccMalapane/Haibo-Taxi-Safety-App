import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLanguage } from "@/hooks/useLanguage";
import { AuthUser } from "@/contexts/AuthContext";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { uploadFromUri } from "@/lib/uploads";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";

// typeui-clean rework of the profile-setup hero.
//
// Design language:
// - Rose gradient hero band with the real app icon (assets/images/icon.png)
//   as the floating brand mark. No Feather placeholder — the splash-screen
//   logo IS the brand identity, so this screen finally uses it.
// - Form card floats from the gradient with rounded top corners, same
//   pattern as AuthScreen and OTPVerificationScreen so the auth flow
//   feels like one continuous surface.
// - Avatar role picker keeps three distinct accent colors (blue / green /
//   purple) because the rose brand gradient is already doing work in the
//   hero band and CTA — adding more red here would collapse contrast.
// - Emergency contact block uses a soft red tint to signal "safety" without
//   screaming.
// - Single primary CTA via GradientButton, same as the rest of auth flow.
// - Staggered FadeIn / FadeInDown / FadeInUp entrance.
//
// Latent bugs fixed (this screen has never worked end-to-end):
// 1. loadUser was reading from @haibo_user AsyncStorage key; AuthContext
//    uses @haibo_auth_user, so userId was always empty and the update
//    mutation sent userId="" to the server. Dropped entirely — profile
//    updates now go through useAuth().updateProfile() which pulls the
//    user id from the auth context automatically.
// 2. updateProfileMutation was using legacy apiRequest("PUT", url, data)
//    + .json() — double-broken since the query-client refactor. Routed
//    through useAuth().updateProfile() which uses the new apiRequest form
//    with the bearer token from context.
// 3. applyReferralMutation was hitting /api/auth/apply-referral which
//    doesn't exist on the server. The real referral system lives at
//    /api/referral/* and is deviceId-based with tier rewards, not
//    user-code claim on signup. Removed the mutation; the input still
//    captures the code for a future server-side implementation.

// Role set matches server enum: commuter | driver | owner | vendor.
// "operator" has been retired in favour of the more explicit "owner"
// (taxi fleet owner) + "vendor" (merchant) split. "admin" is not
// self-selectable — admins are promoted by existing admins out-of-band.
type AvatarType = "commuter" | "driver" | "owner" | "vendor";

const AVATAR_OPTIONS: {
  type: AvatarType;
  icon: keyof typeof Feather.glyphMap;
  labelKey: string;
  /** Accent color for the role tile — same palette as CommunityScreen so
   *  the app feels cohesive the first time a user picks their role. */
  accent: string;
}[] = [
  { type: "commuter", icon: "user", labelKey: "profile.commuter", accent: BrandColors.primary.gradientStart },
  { type: "driver", icon: "truck", labelKey: "profile.driver", accent: BrandColors.primary.blue },
  { type: "owner", icon: "briefcase", labelKey: "profile.owner", accent: BrandColors.accent.teal },
  { type: "vendor", icon: "shopping-bag", labelKey: "profile.vendor", accent: BrandColors.accent.fuchsia },
];

export default function ProfileSetupScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { updateProfile } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [handleError, setHandleError] = useState("");
  const [avatarType, setAvatarType] = useState<AvatarType>("commuter");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  // Owner invitation code — only used when avatarType === 'driver'. Empty
  // string = skipped (driver can redeem later from the Driver Dashboard).
  const [ownerInviteCode, setOwnerInviteCode] = useState("");
  // Driver's plate — required when redeeming an invitation code, since
  // the server creates a minimal driver_profiles row on first redemption
  // and the plate column is UNIQUE NOT NULL.
  const [taxiPlate, setTaxiPlate] = useState("");
  const [nameFocused, setNameFocused] = useState(false);
  const [handleFocused, setHandleFocused] = useState(false);
  const [emergencyNameFocused, setEmergencyNameFocused] = useState(false);
  const [emergencyPhoneFocused, setEmergencyPhoneFocused] = useState(false);
  const [referralFocused, setReferralFocused] = useState(false);
  const [inviteFocused, setInviteFocused] = useState(false);
  const [plateFocused, setPlateFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
  const normalizeHandle = (raw: string) =>
    raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);

  const onHandleChange = (raw: string) => {
    const clean = normalizeHandle(raw);
    setHandle(clean);
    if (!clean) { setHandleError(""); return; }
    if (clean.length < 3) { setHandleError(t("profile.handleMin")); return; }
    if (!HANDLE_RE.test(clean)) { setHandleError(t("profile.handleLettersOnly")); return; }
    setHandleError("");
    // Check availability (debounced inline — fire and forget, last write wins)
    apiRequest("GET", `/api/auth/handle/available?h=${encodeURIComponent(clean)}`)
      .then((res: any) => {
        if (res?.available === false && clean === handle) {
          setHandleError(t("profile.handleTaken"));
        }
      })
      .catch(() => {});
  };

  // Same pick flow as ProfileScreen — library only, 1:1 crop, 0.85
  // quality. Uploads immediately so the preview shows the server URL
  // and the final save just passes it through.
  const handlePickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("profile.permissionNeeded"),
          t("profile.permissionNeededDesc"),
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

      setAvatarUploading(true);
      const uploaded = await uploadFromUri(result.assets[0].uri, {
        folder: "profiles",
        name: result.assets[0].fileName || undefined,
      });
      setAvatarUrl(uploaded.url);
    } catch (error: any) {
      Alert.alert(t("profile.uploadFailed"), error.message || t("common.retry"));
    } finally {
      setAvatarUploading(false);
    }
  };

  // Post-save routing depends on the chosen role:
  //   commuter → MainTabs (current commuter UX)
  //   driver   → MainTabs (phase E will swap in driver tabs; the server
  //              already set role='driver' via accept-invitation)
  //   owner    → OwnerOnboarding (collects bank + company details)
  //   vendor   → VendorOnboarding (existing flow, collects business info)
  // Role-specific onboarding screens handle their own "continue to
  // dashboard" navigation, so this router only sets the first destination.
  const finishSetup = (dest: "MainTabs" | "OwnerOnboarding" | "VendorOnboarding" = "MainTabs") => {
    if (Platform.OS !== "web") {
      const Haptics = require("expo-haptics");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: dest as any }],
    });
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert(t("profile.nameRequired"), t("profile.nameRequiredDesc"));
      return;
    }
    if (isSaving) return;
    setIsSaving(true);

    // Set the handle first (separate endpoint) — if the user typed one.
    // Failures here are non-blocking: the profile still saves, the user
    // just gets prompted to set a handle later from Profile → Settings.
    if (handle && HANDLE_RE.test(handle)) {
      try {
        await apiRequest("/api/auth/handle", {
          method: "POST",
          body: JSON.stringify({ handle }),
        });
      } catch (err: any) {
        if (err?.message?.includes("409") || err?.message?.includes("taken")) {
          setHandleError(t("profile.handleTaken"));
          setIsSaving(false);
          return;
        }
        console.warn("Handle save failed (non-blocking):", err?.message);
      }
    }

    const payload: Partial<AuthUser> & {
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    } = {
      displayName: displayName.trim(),
      avatarType,
      avatarUrl: avatarUrl || undefined,
      emergencyContactName: emergencyName.trim() || undefined,
      emergencyContactPhone: emergencyPhone.trim() || undefined,
    };

    const result = await updateProfile(payload);

    if (result.success) {
      if (referralCode.trim()) {
        // Fire-and-forget: apply the referral code so the referrer gets
        // credit. Failures are non-blocking — the user still reaches the
        // main app. The endpoint is idempotent (re-submits succeed silently).
        getDeviceId().then((deviceId) =>
          apiRequest("/api/referral/apply", {
            method: "POST",
            body: JSON.stringify({
              referralCode: referralCode.trim(),
              referredDeviceId: deviceId,
            }),
          }).catch((err: any) =>
            console.warn("[ProfileSetup] referral apply failed (non-blocking):", err?.message),
          ),
        );
      }

      // Driver + invitation code — redeem it now so the driver lands in
      // 'active' link state. Failures here ARE blocking (unlike referral)
      // because without a linked owner the driver can't withdraw later.
      if (avatarType === "driver" && ownerInviteCode.trim()) {
        if (!taxiPlate.trim()) {
          setIsSaving(false);
          Alert.alert(
            t("profile.plateRequiredTitle"),
            t("profile.plateRequiredDesc"),
          );
          return;
        }
        try {
          await apiRequest("/api/drivers/accept-invitation", {
            method: "POST",
            body: JSON.stringify({
              code: ownerInviteCode.trim().toUpperCase(),
              taxiPlateNumber: taxiPlate.trim(),
            }),
          });
        } catch (err: any) {
          setIsSaving(false);
          Alert.alert(
            t("profile.inviteFailedTitle"),
            err?.message || t("profile.inviteFailedDesc"),
          );
          return;
        }
      }

      // Route to the appropriate next screen based on role.
      if (avatarType === "owner") {
        finishSetup("OwnerOnboarding");
      } else if (avatarType === "vendor") {
        finishSetup("VendorOnboarding");
      } else {
        finishSetup("MainTabs");
      }
    } else {
      setIsSaving(false);
      Alert.alert(t("profile.couldntSave"), result.error || t("common.retry"));
    }
  };

  const canSubmit = displayName.trim().length > 0 && !isSaving && !avatarUploading;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBand, { paddingTop: insets.top + Spacing["2xl"] }]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={styles.logoWrap}>
          <View style={styles.logoShadow}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.logo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)} style={styles.heroText}>
          <ThemedText style={styles.title}>{t("profile.setupTitle")}</ThemedText>
          <ThemedText style={styles.subtitle}>
            {t("profile.setupSubtitle")}
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.formContainer,
          { paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
      >
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(300)}
          style={[styles.formCard, { backgroundColor: theme.backgroundRoot }]}
        >
          {/* Profile photo picker — optional but visually prominent */}
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            {t("profile.profilePhoto")}
          </ThemedText>
          <View style={styles.photoPickRow}>
            <Pressable
              onPress={handlePickAvatar}
              disabled={avatarUploading}
              style={({ pressed }) => [
                styles.photoPickCircle,
                {
                  borderColor: avatarUrl
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                  backgroundColor: theme.backgroundDefault,
                },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={avatarUrl ? "Change profile photo" : "Add profile photo"}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.photoPickImage}
                  resizeMode="cover"
                />
              ) : (
                <Feather
                  name={avatarUploading ? "loader" : "camera"}
                  size={24}
                  color={BrandColors.primary.gradientStart}
                />
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.photoPickTitle, { color: theme.text }]}>
                {avatarUrl
                  ? t("profile.lookingGood")
                  : avatarUploading
                    ? t("profile.uploading")
                    : t("profile.tapToAdd")}
              </ThemedText>
              <ThemedText
                style={[styles.photoPickHint, { color: theme.textSecondary }]}
              >
                {avatarUrl
                  ? t("profile.tapToChange")
                  : t("profile.photoRecognize")}
              </ThemedText>
            </View>
          </View>

          {/* Role picker */}
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            {t("profile.whoAreYou")}
          </ThemedText>
          <View style={styles.avatarRow}>
            {AVATAR_OPTIONS.map((option) => {
              const selected = avatarType === option.type;
              return (
                <Pressable
                  key={option.type}
                  style={[
                    styles.avatarOption,
                    {
                      backgroundColor: selected
                        ? BrandColors.primary.gradientStart + "12"
                        : theme.backgroundDefault,
                      borderColor: selected
                        ? BrandColors.primary.gradientStart
                        : theme.border,
                    },
                  ]}
                  onPress={() => {
                    if (Platform.OS !== "web") {
                      const Haptics = require("expo-haptics");
                      Haptics.selectionAsync();
                    }
                    setAvatarType(option.type);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(option.labelKey)}
                >
                  <View
                    style={[
                      styles.avatarIcon,
                      {
                        backgroundColor: selected
                          ? BrandColors.primary.gradientStart
                          : BrandColors.primary.gradientStart + "15",
                      },
                    ]}
                  >
                    <Feather
                      name={option.icon}
                      size={22}
                      color={selected ? "#FFFFFF" : BrandColors.primary.gradientStart}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.avatarLabel,
                      {
                        color: selected
                          ? BrandColors.primary.gradientStart
                          : theme.text,
                      },
                    ]}
                  >
                    {t(option.labelKey)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Driver-only: taxi plate + owner invitation code. Shown inline
              so a new driver can link to their owner and finish setup in
              a single screen. Both fields are optional at this step —
              drivers can skip and redeem a code later from the Driver
              Dashboard if their owner hasn't generated one yet. */}
          {avatarType === "driver" ? (
            <View style={styles.driverFieldsCard}>
              <View style={styles.emergencyHeader}>
                <Feather
                  name="truck"
                  size={16}
                  color={BrandColors.primary.blue}
                />
                <ThemedText style={[styles.emergencyTitle, { color: BrandColors.primary.blue }]}>
                  {t("profile.driverDetails")}
                </ThemedText>
              </View>
              <ThemedText style={[styles.emergencyHelp, { color: theme.textSecondary }]}>
                {t("profile.driverDetailsHint")}
              </ThemedText>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: plateFocused
                      ? BrandColors.primary.blue
                      : theme.border,
                    marginTop: Spacing.md,
                  },
                ]}
                placeholder={t("profile.platePlaceholder")}
                placeholderTextColor={theme.textSecondary}
                value={taxiPlate}
                onChangeText={(text) => setTaxiPlate(text.toUpperCase())}
                onFocus={() => setPlateFocused(true)}
                onBlur={() => setPlateFocused(false)}
                autoCapitalize="characters"
                maxLength={20}
                accessibilityLabel={t("profile.plateLabel")}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: inviteFocused
                      ? BrandColors.primary.blue
                      : theme.border,
                    marginTop: Spacing.sm,
                    fontFamily: Platform.select({
                      ios: "Menlo",
                      android: "monospace",
                      default: "monospace",
                    }),
                  },
                ]}
                placeholder="HBO-XXXXXX"
                placeholderTextColor={theme.textSecondary}
                value={ownerInviteCode}
                onChangeText={(text) => setOwnerInviteCode(text.toUpperCase())}
                onFocus={() => setInviteFocused(true)}
                onBlur={() => setInviteFocused(false)}
                autoCapitalize="characters"
                maxLength={10}
                accessibilityLabel={t("profile.inviteCodeLabel")}
              />
              <ThemedText
                style={[styles.driverSkipHint, { color: theme.textSecondary }]}
              >
                {t("profile.inviteCodeHint")}
              </ThemedText>
            </View>
          ) : null}

          {/* Display name */}
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              {t("profile.displayNameStar")}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: nameFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder={t("profile.displayNamePlaceholder")}
              placeholderTextColor={theme.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              maxLength={30}
              accessibilityLabel="Display name"
            />
          </View>

          {/* Handle / username */}
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              {t("profile.handleLabel")}
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <ThemedText style={[styles.handlePrefix, { color: theme.textSecondary }]}>
                @
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: handleError
                      ? BrandColors.secondary.orange
                      : handleFocused
                        ? BrandColors.primary.gradientStart
                        : theme.border,
                  },
                ]}
                placeholder={t("profile.handlePlaceholder")}
                placeholderTextColor={theme.textSecondary}
                value={handle}
                onChangeText={onHandleChange}
                onFocus={() => setHandleFocused(true)}
                onBlur={() => setHandleFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                accessibilityLabel="Handle"
              />
            </View>
            {handleError ? (
              <ThemedText style={styles.handleErrorText}>{handleError}</ThemedText>
            ) : handle.length >= 3 ? (
              <ThemedText style={styles.handleOkText}>{t("profile.handleOk")}</ThemedText>
            ) : (
              <ThemedText style={[styles.handleHint, { color: theme.textSecondary }]}>
                {t("profile.handleHint")}
              </ThemedText>
            )}
          </View>

          {/* Emergency contact */}
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyHeader}>
              <Feather
                name="alert-circle"
                size={16}
                color={BrandColors.primary.gradientStart}
              />
              <ThemedText style={styles.emergencyTitle}>
                {t("emergency.contactTitle")}
              </ThemedText>
            </View>
            <ThemedText style={[styles.emergencyHelp, { color: theme.textSecondary }]}>
              {t("emergency.contactHint")}
            </ThemedText>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: "#FFFFFF",
                  color: theme.text,
                  borderColor: emergencyNameFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                  marginTop: Spacing.md,
                },
              ]}
              placeholder="Contact name"
              placeholderTextColor={theme.textSecondary}
              value={emergencyName}
              onChangeText={setEmergencyName}
              onFocus={() => setEmergencyNameFocused(true)}
              onBlur={() => setEmergencyNameFocused(false)}
              maxLength={50}
              accessibilityLabel="Emergency contact name"
            />
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: "#FFFFFF",
                  color: theme.text,
                  borderColor: emergencyPhoneFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                  marginTop: Spacing.sm,
                },
              ]}
              placeholder="Contact phone"
              placeholderTextColor={theme.textSecondary}
              value={emergencyPhone}
              onChangeText={(text) => setEmergencyPhone(text.replace(/\D/g, ""))}
              onFocus={() => setEmergencyPhoneFocused(true)}
              onBlur={() => setEmergencyPhoneFocused(false)}
              keyboardType="phone-pad"
              maxLength={15}
              accessibilityLabel="Emergency contact phone"
            />
          </View>

          {/* Referral code */}
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              {t("profile.referralCode")} <ThemedText style={styles.optionalTag}>({t("common.optional")})</ThemedText>
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: referralFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                  fontFamily: Platform.select({
                    ios: "Menlo",
                    android: "monospace",
                    default: "monospace",
                  }),
                },
              ]}
              placeholder="HAIBOABC123"
              placeholderTextColor={theme.textSecondary}
              value={referralCode}
              onChangeText={(text) => setReferralCode(text.toUpperCase())}
              onFocus={() => setReferralFocused(true)}
              onBlur={() => setReferralFocused(false)}
              autoCapitalize="characters"
              maxLength={15}
              accessibilityLabel="Referral code"
            />
          </View>

          {/* Primary CTA */}
          <View style={styles.ctaWrap}>
            <GradientButton
              onPress={handleSave}
              disabled={!canSubmit}
              size="large"
              icon={isSaving ? undefined : "arrow-right"}
              iconPosition="right"
            >
              {isSaving ? t("profile.saving") : t("profile.completeSetup")}
            </GradientButton>
          </View>

          <Pressable
            onPress={() => finishSetup()}
            disabled={isSaving}
            style={styles.skipWrap}
            accessibilityRole="button"
            accessibilityLabel="Skip profile setup for now"
          >
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
              {t("profile.skipForNow")}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const HERO_HEIGHT = 300;
const LOGO_SIZE = 96;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradientBand: {
    height: HERO_HEIGHT,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  logoWrap: {
    marginBottom: Spacing.lg,
  },
  logoShadow: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
    overflow: "hidden",
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  heroText: {
    alignItems: "center",
  },
  title: {
    ...Typography.h1,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: "#FFFFFF",
    textAlign: "center",
    opacity: 0.92,
    maxWidth: 320,
  },
  scroll: {
    flex: 1,
    marginTop: -Spacing["2xl"],
  },
  formContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  formCard: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    paddingTop: Spacing["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  label: {
    ...Typography.label,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  optionalTag: {
    ...Typography.label,
    letterSpacing: 0.6,
    fontWeight: "500",
    textTransform: "none",
  },

  // Profile photo picker
  photoPickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  photoPickCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoPickImage: {
    width: "100%",
    height: "100%",
  },
  photoPickTitle: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "700",
  },
  photoPickHint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },

  avatarRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  avatarOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: "center",
  },
  avatarIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  avatarLabel: {
    ...Typography.small,
    fontWeight: "700",
    fontSize: 12,
  },
  fieldGroup: {
    marginBottom: Spacing.xl,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1,
  },
  driverFieldsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.primary.blue + "25",
    backgroundColor: BrandColors.primary.blue + "08",
    marginBottom: Spacing.xl,
  },
  driverSkipHint: {
    fontSize: 12,
    marginTop: Spacing.sm,
    lineHeight: 17,
  },
  emergencyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "25",
    backgroundColor: BrandColors.primary.gradientStart + "08",
    marginBottom: Spacing.xl,
  },
  emergencyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  emergencyTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  emergencyHelp: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  ctaWrap: {
    marginTop: Spacing.sm,
  },
  skipWrap: {
    marginTop: Spacing.lg,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skipText: {
    ...Typography.small,
    fontWeight: "600",
  },
  handlePrefix: {
    fontSize: 18,
    fontWeight: "700",
    marginRight: 4,
    marginBottom: 2,
  },
  handleErrorText: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.secondary.orange,
    marginTop: 4,
    marginLeft: 4,
  },
  handleOkText: {
    fontSize: 12,
    fontWeight: "600",
    color: BrandColors.primary.green,
    marginTop: 4,
    marginLeft: 4,
  },
  handleHint: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});

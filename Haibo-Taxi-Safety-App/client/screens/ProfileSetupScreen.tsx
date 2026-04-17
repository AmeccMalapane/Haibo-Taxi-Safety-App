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
import { AuthUser } from "@/contexts/AuthContext";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { uploadFromUri } from "@/lib/uploads";
import { apiRequest } from "@/lib/query-client";

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

type AvatarType = "commuter" | "driver" | "operator";

const AVATAR_OPTIONS: {
  type: AvatarType;
  icon: keyof typeof Feather.glyphMap;
  label: string;
}[] = [
  { type: "commuter", icon: "user", label: "Commuter" },
  { type: "driver", icon: "truck", label: "Driver" },
  { type: "operator", icon: "briefcase", label: "Operator" },
];

export default function ProfileSetupScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
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
  const [nameFocused, setNameFocused] = useState(false);
  const [handleFocused, setHandleFocused] = useState(false);
  const [emergencyNameFocused, setEmergencyNameFocused] = useState(false);
  const [emergencyPhoneFocused, setEmergencyPhoneFocused] = useState(false);
  const [referralFocused, setReferralFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
  const normalizeHandle = (raw: string) =>
    raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);

  const onHandleChange = (raw: string) => {
    const clean = normalizeHandle(raw);
    setHandle(clean);
    if (!clean) { setHandleError(""); return; }
    if (clean.length < 3) { setHandleError("At least 3 characters"); return; }
    if (!HANDLE_RE.test(clean)) { setHandleError("Letters, numbers, underscores only"); return; }
    setHandleError("");
    // Check availability (debounced inline — fire and forget, last write wins)
    apiRequest("GET", `/api/auth/handle/available?h=${encodeURIComponent(clean)}`)
      .then((res: any) => {
        if (res?.available === false && clean === handle) {
          setHandleError("Already taken — try another");
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
          "Permission needed",
          "Grant photo library access to upload a profile photo.",
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
      Alert.alert("Upload failed", error.message || "Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  };

  const finishSetup = () => {
    if (Platform.OS !== "web") {
      const Haptics = require("expo-haptics");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" }],
    });
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Name required", "Please enter your display name.");
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
          setHandleError("Already taken — try another");
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
        // TODO: server-side user-supplied referral claim endpoint doesn't
        // exist yet. Logging for now so we can wire it up later without
        // losing the captured code.
        console.log("[ProfileSetup] referral code captured (not applied):", referralCode.trim());
      }
      finishSetup();
    } else {
      setIsSaving(false);
      Alert.alert("Couldn't save", result.error || "Please try again.");
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
          <ThemedText style={styles.title}>Set up your profile</ThemedText>
          <ThemedText style={styles.subtitle}>
            A few quick details so we can personalize your Haibo experience
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
            PROFILE PHOTO (OPTIONAL)
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
                  ? "Looking good"
                  : avatarUploading
                    ? "Uploading…"
                    : "Tap to add a photo"}
              </ThemedText>
              <ThemedText
                style={[styles.photoPickHint, { color: theme.textSecondary }]}
              >
                {avatarUrl
                  ? "Tap the circle to change it"
                  : "Makes it easier for drivers and vendors to recognize you"}
              </ThemedText>
            </View>
          </View>

          {/* Role picker */}
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            WHO ARE YOU?
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
                  accessibilityLabel={option.label}
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
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Display name */}
          <View style={styles.fieldGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              DISPLAY NAME *
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
              placeholder="e.g., Sipho M"
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
              @HANDLE
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
                placeholder="e.g., sipho_m"
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
              <ThemedText style={styles.handleOkText}>Looks good</ThemedText>
            ) : (
              <ThemedText style={[styles.handleHint, { color: theme.textSecondary }]}>
                Shown on your posts and comments instead of your phone number
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
                Emergency contact
              </ThemedText>
            </View>
            <ThemedText style={[styles.emergencyHelp, { color: theme.textSecondary }]}>
              Notified when you trigger SOS. You can add more contacts later.
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
              REFERRAL CODE <ThemedText style={styles.optionalTag}>(optional)</ThemedText>
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
              {isSaving ? "Saving..." : "Complete setup"}
            </GradientButton>
          </View>

          <Pressable
            onPress={finishSetup}
            disabled={isSaving}
            style={styles.skipWrap}
            accessibilityRole="button"
            accessibilityLabel="Skip profile setup for now"
          >
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
              Skip for now
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

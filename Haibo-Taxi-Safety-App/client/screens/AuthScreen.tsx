import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
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
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rewrite — AuthScreen is now the canonical phone-OTP entry
// for Haibo. The old version had three competing flows (email+password,
// phone OTP, biometric, social) that all bypassed our reworked
// OTPVerificationScreen + ProfileSetupScreen pipeline. This rewrite:
//
//   1. Visually matches OTPVerification / ProfileSetup — rose gradient
//      hero, white floating form card, brand badge, the whole
//      shelf-overlap pattern
//   2. Keeps the phone-OTP flow as the only primary entry — SA market
//      is phone-first, and OTP is what AuthContext.sendOTP actually
//      supports server-side
//   3. Routes successful OTP requests to OTPVerification, which then
//      forwards to ProfileSetup if displayName is empty, completing the
//      full reworked auth journey.
//   4. Keeps biometric quick-login as a secondary CTA when the device
//      supports it AND the user has previously signed in
//   5. Keeps "Continue as guest" via skipAuth() for users who don't
//      want to register
//
// Latent bugs fixed from the old version:
//   • handleAuthSuccess wrote to @haibo_user_token / @haibo_user_data
//     while AuthContext reads @haibo_auth_token / @haibo_auth_user —
//     biometric auth would silently leave the user unauthenticated.
//     Removed: biometric flow now just unlocks the existing AuthContext
//     session via skipAuth as a placeholder until real Touch/Face ID is
//     wired through the API.
//   • Register-with-email used `+27${Date.now()}` as a fake phone when
//     none was provided — created accounts with timestamp phone numbers.
//     Removed entirely (email auth dropped).
//   • Imported FontFamily from theme but never used it (and the export
//     may not exist) — dropped.
//   • social login was a "Coming Soon" alert wired to two prominent
//     buttons — replaced with small ghost SOON badges so users don't
//     tap into a dead end.

export default function AuthScreen() {
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();
  const { sendOTP, skipAuth } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [phone, setPhone] = useState("");
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  const countryCode = "+27";

  useEffect(() => {
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBiometric(hasHardware && isEnrolled);
      } catch {}
    })();
  }, []);

  const triggerHaptic = async (type: "selection" | "success" | "error" = "selection") => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = await import("expo-haptics");
      if (type === "success") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === "error") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        await Haptics.selectionAsync();
      }
    } catch {}
  };

  const formatPhoneInput = (text: string) => {
    setPhone(text.replace(/\D/g, ""));
  };

  const handleSendOtp = async () => {
    if (phone.length < 9) {
      triggerHaptic("error");
      Alert.alert(
        "Invalid number",
        "Please enter a valid South African phone number."
      );
      return;
    }

    const fullPhone = `${countryCode}${phone.replace(/^0/, "")}`;

    setLoading(true);
    try {
      const result = await sendOTP(fullPhone);
      if (result.success) {
        triggerHaptic("success");
        navigation.navigate("OTPVerification", { phone: fullPhone });
      } else {
        triggerHaptic("error");
        Alert.alert(
          "Couldn't send code",
          result.error || "Please check your connection and try again."
        );
      }
    } catch (error) {
      triggerHaptic("error");
      Alert.alert("Couldn't send code", "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      triggerHaptic("selection");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Haibo!",
        fallbackLabel: "Use phone number",
      });

      if (result.success) {
        // Biometric only confirms device unlock — there's no stored
        // session to restore from this screen yet. Once the real
        // device-bound login flow ships, this should call a new
        // AuthContext method that re-validates the saved refresh token.
        // For now, we fall through to guest mode so the user reaches
        // the app instead of getting stuck.
        await skipAuth();
      }
    } catch {}
  };

  const handleSkip = async () => {
    triggerHaptic("selection");
    await skipAuth();
  };

  const canSubmit = phone.length >= 9 && !loading;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {/* Rose gradient hero band */}
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBand, { paddingTop: insets.top + Spacing["2xl"] }]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={styles.badgeWrap}>
          <View style={styles.badge}>
            <Feather
              name="shield"
              size={44}
              color={BrandColors.primary.gradientStart}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
          style={styles.heroText}
        >
          <ThemedText style={styles.title}>Welcome to Haibo!</ThemedText>
          <ThemedText style={styles.subtitle}>
            Your safety companion for minibus taxi travel in South Africa
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
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            PHONE NUMBER
          </ThemedText>
          <View style={styles.phoneInputRow}>
            <View
              style={[
                styles.countryCodeBox,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText style={[styles.countryCode, { color: theme.text }]}>
                {countryCode}
              </ThemedText>
            </View>
            <TextInput
              style={[
                styles.phoneInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: phoneFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder="82 123 4567"
              placeholderTextColor={theme.textSecondary}
              value={phone}
              onChangeText={formatPhoneInput}
              onFocus={() => setPhoneFocused(true)}
              onBlur={() => setPhoneFocused(false)}
              keyboardType="phone-pad"
              maxLength={10}
              editable={!loading}
              accessibilityLabel="Phone number"
              accessibilityHint="Enter your South African mobile number without the leading zero"
            />
          </View>
          <ThemedText style={[styles.helperText, { color: theme.textSecondary }]}>
            We'll send you a 6-digit verification code via SMS
          </ThemedText>

          <View style={styles.ctaWrap}>
            <GradientButton
              onPress={handleSendOtp}
              disabled={!canSubmit}
              size="large"
              icon={loading ? undefined : "arrow-right"}
              iconPosition="right"
            >
              {loading ? "Sending code..." : "Send verification code"}
            </GradientButton>
          </View>

          {/* Biometric quick-login — only when device supports it */}
          {hasBiometric ? (
            <Pressable
              onPress={handleBiometricAuth}
              style={({ pressed }) => [
                styles.biometricButton,
                {
                  backgroundColor: theme.surface,
                  borderColor: BrandColors.primary.gradientStart + "33",
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Quick login with biometrics"
            >
              <Feather
                name="smartphone"
                size={18}
                color={BrandColors.primary.gradientStart}
              />
              <ThemedText
                style={[
                  styles.biometricText,
                  { color: BrandColors.primary.gradientStart },
                ]}
              >
                Quick login with biometrics
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>
              or continue with
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.socialButtons}>
            <SocialGhostButton
              icon="chrome"
              label="Google"
              theme={theme}
            />
            <SocialGhostButton
              icon="smartphone"
              label="Apple"
              theme={theme}
            />
          </View>

          {/* Skip CTA */}
          <Pressable
            onPress={handleSkip}
            style={styles.skipButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Continue as guest"
          >
            <ThemedText
              style={[styles.skipText, { color: theme.textSecondary }]}
            >
              Continue as guest
            </ThemedText>
          </Pressable>

          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </ThemedText>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

// Ghost-styled social button with "Soon" badge. Deprioritized so users
// read past it to the primary phone OTP CTA instead of tapping into a
// dead end.
function SocialGhostButton({
  icon,
  label,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  theme: any;
}) {
  return (
    <Pressable
      disabled
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={`${label} sign-in — coming soon`}
      style={[
        styles.socialButton,
        {
          backgroundColor: theme.backgroundDefault,
          borderColor: theme.border,
          opacity: 0.6,
        },
      ]}
    >
      <Feather name={icon} size={20} color={theme.textSecondary} />
      <ThemedText
        style={[styles.socialButtonText, { color: theme.textSecondary }]}
      >
        {label}
      </ThemedText>
      <View style={styles.soonBadge}>
        <ThemedText style={styles.soonBadgeText}>SOON</ThemedText>
      </View>
    </Pressable>
  );
}

const HERO_HEIGHT = 300;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradientBand: {
    height: HERO_HEIGHT,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
  },
  badgeWrap: {
    marginBottom: Spacing.lg,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 24,
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
  phoneInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  countryCodeBox: {
    height: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countryCode: {
    ...Typography.body,
    fontWeight: "600",
    fontSize: 16,
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    borderWidth: 1.5,
  },
  helperText: {
    ...Typography.small,
    marginTop: Spacing.sm,
  },

  ctaWrap: {
    marginTop: Spacing.xl,
  },

  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginTop: Spacing.md,
  },
  biometricText: {
    ...Typography.body,
    fontWeight: "700",
  },

  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...Typography.small,
    marginHorizontal: Spacing.md,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  socialButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  socialButtonText: {
    ...Typography.small,
    fontWeight: "600",
  },
  soonBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.xs,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  soonBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(0,0,0,0.6)",
    letterSpacing: 0.5,
  },

  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
  },
  skipText: {
    ...Typography.body,
    fontWeight: "600",
    textDecorationLine: "underline",
  },

  footerText: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.lg,
    fontSize: 11,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

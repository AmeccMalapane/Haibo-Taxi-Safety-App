import React, { useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation } from "@tanstack/react-query";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean applied to the phone-entry hero:
// - rose gradient hero band over the top third, form card floats beneath
// - Typography tokens throughout, no inline sizing
// - single primary CTA (GradientButton) keeps visual language consistent
//   with the rest of the app
// - staggered FadeIn / FadeInDown / FadeInUp entry
// - fixed latent bug: was calling /api/auth/request-otp (404), now sends
//   to /api/auth/send-otp and reads the parsed body from apiRequest

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [phone, setPhone] = useState("");
  const [phoneFocused, setPhoneFocused] = useState(false);
  const countryCode = "+27";

  const requestOtpMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      return apiRequest("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: phoneNumber }),
      });
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      navigation.navigate("OTPVerification", { phone: `${countryCode}${phone.replace(/^0/, "")}` });
    },
    onError: (error: Error) => {
      Alert.alert("Couldn't send code", error.message || "Please check your connection and try again.");
    },
  });

  const handleRequestOtp = () => {
    if (phone.length < 9) {
      Alert.alert("Invalid number", "Please enter a valid South African phone number.");
      return;
    }

    const fullPhone = `${countryCode}${phone.replace(/^0/, "")}`;
    requestOtpMutation.mutate(fullPhone);
  };

  const formatPhoneInput = (text: string) => {
    setPhone(text.replace(/\D/g, ""));
  };

  const canSubmit = phone.length >= 9 && !requestOtpMutation.isPending;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {/* Rose gradient hero band — iconic brand identity */}
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBand, { paddingTop: insets.top + Spacing["2xl"] }]}
      >
        <Animated.View entering={FadeIn.duration(400)} style={styles.badgeWrap}>
          <View style={styles.badge}>
            <Feather name="shield" size={44} color={BrandColors.primary.gradientStart} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.heroText}>
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
          {
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
      >
        <Animated.View
          entering={FadeInUp.duration(500).delay(300)}
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
              editable={!requestOtpMutation.isPending}
              accessibilityLabel="Phone number"
              accessibilityHint="Enter your South African mobile number without the leading zero"
            />
          </View>
          <ThemedText style={[styles.helperText, { color: theme.textSecondary }]}>
            We'll send you a 6-digit verification code via SMS
          </ThemedText>

          <View style={styles.ctaWrap}>
            <GradientButton
              onPress={handleRequestOtp}
              disabled={!canSubmit}
              size="large"
              icon={requestOtpMutation.isPending ? undefined : "arrow-right"}
              iconPosition="right"
            >
              {requestOtpMutation.isPending ? "Sending code..." : "Send verification code"}
            </GradientButton>
          </View>

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
              iconColor={theme.textSecondary}
              label="Google"
              theme={theme}
            />
            <SocialGhostButton
              icon="smartphone"
              iconColor={theme.textSecondary}
              label="Apple"
              theme={theme}
            />
          </View>

          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </ThemedText>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

// Ghost-styled social button with "Soon" badge. Deprioritized visually so
// users read past it to the primary CTA instead of tapping into a dead end.
function SocialGhostButton({
  icon,
  iconColor,
  label,
  theme,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
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
      <Feather name={icon} size={20} color={iconColor} />
      <ThemedText style={[styles.socialButtonText, { color: theme.textSecondary }]}>
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
    borderWidth: 1,
  },
  helperText: {
    ...Typography.small,
    marginTop: Spacing.sm,
  },
  ctaWrap: {
    marginTop: Spacing.xl,
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
  footerText: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.xl,
    fontSize: 11,
  },
});

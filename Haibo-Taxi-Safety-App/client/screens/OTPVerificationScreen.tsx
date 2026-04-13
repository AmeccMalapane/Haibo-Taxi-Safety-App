import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean: matches the LoginScreen hero pattern — rose gradient band
// + floating form card — so the auth flow feels like a single surface.
//
// Also fixes three latent bugs:
//   1. Was using legacy apiRequest("POST", url, data) + .json() — broken
//      since the query-client refactor (apiRequest returns parsed body).
//   2. Resend was pointing at /api/auth/request-otp which doesn't exist;
//      server endpoint is /api/auth/send-otp.
//   3. On verify success, was writing to @haibo_user / @haibo_logged_in
//      AsyncStorage keys that AuthContext doesn't read, AND never persisted
//      the JWT token. Successful OTP verify silently failed to actually log
//      the user in through the context. Now routed through useAuth() so
//      state, storage keys, and token are all handled consistently.

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OTPVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { verifyOTP, sendOTP, user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "OTPVerification">>();

  const phone = route.params?.phone || "";

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const runVerify = async (code: string) => {
    if (isVerifying) return;
    setIsVerifying(true);

    const result = await verifyOTP(phone, code);

    if (result.success) {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // The AuthContext owns the new user object after verifyOTP resolves.
      // Fall through to ProfileSetup only if displayName is still empty —
      // the server doesn't send an isNewUser flag, so we use the profile
      // completeness as the proxy.
      const freshUser = user;
      const needsProfile = !freshUser?.displayName;

      navigation.reset({
        index: 0,
        routes: [{ name: needsProfile ? "ProfileSetup" : "MainTabs" }],
      });
    } else {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Verification failed", result.error || "Invalid or expired code. Please try again.");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      setIsVerifying(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    const digit = text.replace(/\D/g, "").slice(-1);
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d !== "") && newOtp.join("").length === OTP_LENGTH) {
      runVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      Alert.alert("Incomplete code", "Please enter the complete 6-digit code.");
      return;
    }
    runVerify(code);
  };

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;
    setIsResending(true);

    const result = await sendOTP(phone);

    if (result.success) {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setResendTimer(RESEND_COOLDOWN);
      Alert.alert("Code sent", "A new verification code is on its way.");
    } else {
      Alert.alert("Couldn't send", result.error || "Failed to resend code. Please try again.");
    }

    setIsResending(false);
  };

  const maskedPhone = phone.replace(/(\+27)(\d{2})(\d{3})(\d+)/, "$1 $2 *** $4");
  const code = otp.join("");
  const canSubmit = code.length === OTP_LENGTH && !isVerifying;

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      {/* Rose gradient hero band with back button — mirrors LoginScreen */}
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBand, { paddingTop: insets.top + Spacing.lg }]}
      >
        <Animated.View entering={FadeIn.duration(300)}>
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

        <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.badgeWrap}>
          <View style={styles.badge}>
            <Feather name="message-circle" size={40} color={BrandColors.primary.gradientStart} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(150)} style={styles.heroText}>
          <ThemedText style={styles.title}>Verify your number</ThemedText>
          <ThemedText style={styles.subtitle}>
            Enter the 6-digit code we sent to
          </ThemedText>
          <ThemedText style={styles.phoneText}>{maskedPhone}</ThemedText>
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
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => {
              const hasDigit = Boolean(digit);
              return (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    if (ref) inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.otpInput,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: hasDigit
                        ? BrandColors.primary.gradientStart
                        : theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!isVerifying}
                  accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
                />
              );
            })}
          </View>

          <View style={styles.ctaWrap}>
            <GradientButton
              onPress={handleVerify}
              disabled={!canSubmit}
              size="large"
              icon={isVerifying ? undefined : "arrow-right"}
              iconPosition="right"
            >
              {isVerifying ? "Verifying..." : "Verify & continue"}
            </GradientButton>
          </View>

          <View style={styles.resendRow}>
            <ThemedText style={[styles.resendPrompt, { color: theme.textSecondary }]}>
              Didn't receive the code?
            </ThemedText>
            <Pressable
              onPress={handleResend}
              disabled={resendTimer > 0 || isResending}
              accessibilityRole="button"
              accessibilityLabel={
                resendTimer > 0
                  ? `Resend available in ${resendTimer} seconds`
                  : "Resend code"
              }
              accessibilityState={{ disabled: resendTimer > 0 || isResending }}
            >
              <ThemedText
                style={[
                  styles.resendLink,
                  {
                    color:
                      resendTimer > 0 || isResending
                        ? theme.textSecondary
                        : BrandColors.primary.gradientStart,
                  },
                ]}
              >
                {isResending
                  ? "Sending..."
                  : resendTimer > 0
                  ? `Resend in ${resendTimer}s`
                  : "Resend code"}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const HERO_HEIGHT = 320;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradientBand: {
    height: HERO_HEIGHT,
    paddingHorizontal: Spacing.xl,
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
  badgeWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  badge: {
    width: 80,
    height: 80,
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
  },
  phoneText: {
    ...Typography.body,
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "700",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
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
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  ctaWrap: {
    marginBottom: Spacing.xl,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
  },
  resendPrompt: {
    ...Typography.small,
  },
  resendLink: {
    ...Typography.small,
    fontWeight: "700",
    marginLeft: Spacing.xs,
  },
});

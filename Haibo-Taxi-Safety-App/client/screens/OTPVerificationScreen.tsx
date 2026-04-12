import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OTPVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "OTPVerification">>();

  const phone = route.params?.phone || "";

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<TextInput[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const verifyOtpMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/auth/verify-otp", { phone, code });
      return response.json();
    },
    onSuccess: async (data) => {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      await AsyncStorage.setItem("@haibo_user", JSON.stringify(data.user));
      await AsyncStorage.setItem("@haibo_logged_in", "true");

      if (data.isNewUser) {
        navigation.reset({
          index: 0,
          routes: [{ name: "ProfileSetup" }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: "MainTabs" }],
        });
      }
    },
    onError: (error: Error) => {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Error", error.message || "Invalid or expired code. Please try again.");
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/request-otp", { phone });
      return response.json();
    },
    onSuccess: () => {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setResendTimer(RESEND_COOLDOWN);
      Alert.alert("Code Sent", "A new verification code has been sent to your phone.");
    },
    onError: () => {
      Alert.alert("Error", "Failed to resend code. Please try again.");
    },
  });

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    const digit = text.replace(/\D/g, "").slice(-1);
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((d) => d !== "") && newOtp.join("").length === OTP_LENGTH) {
      verifyOtpMutation.mutate(newOtp.join(""));
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
      Alert.alert("Incomplete Code", "Please enter the complete 6-digit code.");
      return;
    }
    verifyOtpMutation.mutate(code);
  };

  const handleResend = () => {
    if (resendTimer > 0) return;
    resendOtpMutation.mutate();
  };

  const maskedPhone = phone.replace(/(\+27)(\d{2})(\d{3})(\d+)/, "$1 $2 *** $4");

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: BrandColors.primary.green + "15" }]}>
          <Feather name="message-circle" size={40} color={BrandColors.primary.green} />
        </View>
        <ThemedText type="h1" style={styles.title}>
          Verify Your Number
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Enter the 6-digit code sent to{"\n"}
          <ThemedText style={{ fontWeight: "600" }}>{maskedPhone}</ThemedText>
        </ThemedText>
      </View>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              if (ref) inputRefs.current[index] = ref;
            }}
            style={[
              styles.otpInput,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: digit ? BrandColors.primary.green : theme.border,
                color: theme.text,
              },
            ]}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={!verifyOtpMutation.isPending}
          />
        ))}
      </View>

      <Button
        onPress={handleVerify}
        disabled={otp.join("").length !== OTP_LENGTH || verifyOtpMutation.isPending}
        style={styles.button}
      >
        {verifyOtpMutation.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Verifying...</ThemedText>
          </View>
        ) : (
          "Verify & Continue"
        )}
      </Button>

      <View style={styles.resendRow}>
        <ThemedText style={{ color: theme.textSecondary }}>Didn't receive the code?</ThemedText>
        <Pressable onPress={handleResend} disabled={resendTimer > 0 || resendOtpMutation.isPending}>
          {resendOtpMutation.isPending ? (
            <ActivityIndicator size="small" color={BrandColors.primary.blue} />
          ) : (
            <ThemedText
              style={{
                color: resendTimer > 0 ? theme.textSecondary : BrandColors.primary.blue,
                fontWeight: "600",
                marginLeft: Spacing.xs,
              }}
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    marginBottom: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
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
  },
  button: {
    marginBottom: Spacing.lg,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});

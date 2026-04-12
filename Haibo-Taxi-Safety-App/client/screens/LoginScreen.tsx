import React, { useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [phone, setPhone] = useState("");
  const [countryCode] = useState("+27");

  const requestOtpMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest("POST", "/api/auth/request-otp", { phone: phoneNumber });
      return response.json();
    },
    onSuccess: (data) => {
      if (Platform.OS !== "web") {
        const Haptics = require("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      navigation.navigate("OTPVerification", { phone: `${countryCode}${phone.replace(/^0/, "")}` });
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to send OTP. Please try again.");
    },
  });

  const handleRequestOtp = () => {
    if (phone.length < 9) {
      Alert.alert("Invalid Number", "Please enter a valid South African phone number.");
      return;
    }
    
    const fullPhone = `${countryCode}${phone.replace(/^0/, "")}`;
    requestOtpMutation.mutate(fullPhone);
  };

  const formatPhoneInput = (text: string) => {
    const cleaned = text.replace(/\D/g, "");
    setPhone(cleaned);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: insets.top + Spacing["2xl"],
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.header}>
        <View style={[styles.logoContainer, { backgroundColor: BrandColors.primary.red }]}>
          <Feather name="shield" size={48} color="#FFFFFF" />
        </View>
        <ThemedText type="h1" style={styles.title}>
          Welcome to Haibo!
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          Your safety companion for minibus taxi travel in South Africa
        </ThemedText>
      </View>

      <View style={styles.form}>
        <ThemedText style={styles.label}>Phone Number</ThemedText>
        <View style={styles.phoneInputRow}>
          <View style={[styles.countryCodeBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText style={styles.countryCode}>+27</ThemedText>
          </View>
          <TextInput
            style={[
              styles.phoneInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="82 123 4567"
            placeholderTextColor={theme.textSecondary}
            value={phone}
            onChangeText={formatPhoneInput}
            keyboardType="phone-pad"
            maxLength={10}
            editable={!requestOtpMutation.isPending}
          />
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          We'll send you a verification code via SMS
        </ThemedText>
      </View>

      <Button
        onPress={handleRequestOtp}
        disabled={phone.length < 9 || requestOtpMutation.isPending}
        style={styles.button}
      >
        {requestOtpMutation.isPending ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Sending code...</ThemedText>
          </View>
        ) : (
          "Send Verification Code"
        )}
      </Button>

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>or continue with</ThemedText>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      <View style={styles.socialButtons}>
        <Pressable
          style={[styles.socialButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          onPress={() => Alert.alert("Coming Soon", "Google Sign-In will be available soon.")}
        >
          <Feather name="chrome" size={24} color={BrandColors.primary.blue} />
          <ThemedText style={styles.socialButtonText}>Google</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.socialButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          onPress={() => Alert.alert("Coming Soon", "Apple Sign-In will be available soon.")}
        >
          <Feather name="smartphone" size={24} color={theme.text} />
          <ThemedText style={styles.socialButtonText}>Apple</ThemedText>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={[styles.footerText, { color: theme.textSecondary }]}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </ThemedText>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
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
    paddingHorizontal: Spacing.lg,
  },
  form: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  phoneInputRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  countryCodeBox: {
    height: 52,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countryCode: {
    fontSize: 16,
    fontWeight: "600",
  },
  phoneInput: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    marginBottom: Spacing.xl,
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
    fontSize: 12,
  },
  socialButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  socialButtonText: {
    fontWeight: "600",
  },
  footer: {
    marginTop: "auto",
  },
  footerText: {
    textAlign: "center",
  },
});

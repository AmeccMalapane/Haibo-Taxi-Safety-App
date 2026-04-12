import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

type VerifyOTPParams = {
  phoneNumber: string;
  purpose: "login" | "register";
};

export default function VerifyOTPScreen() {
  const { theme } = useTheme();
  const { verifyOTP, sendOTP } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: VerifyOTPParams }, "params">>();
  
  const { phoneNumber, purpose } = route.params || { phoneNumber: "", purpose: "login" };
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      value = value[value.length - 1];
    }
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(digit => digit !== "") && newOtp.join("").length === 6) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode: string) => {
    setLoading(true);
    try {
      const result = await verifyOTP(phoneNumber, otpCode);

      if (result.success) {
        Alert.alert(
          "Success",
          purpose === "register" ? "Account created successfully!" : "Login successful!",
          [
            {
              text: "Continue",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "MainTabs" }],
                });
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", result.error || "Verification failed");
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      Alert.alert("Error", "Verification failed. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    
    setLoading(true);
    try {
      const result = await sendOTP(phoneNumber);
      if (result.success) {
        setResendTimer(30);
        setOtp(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        Alert.alert("OTP Sent", "A new verification code has been sent to your phone.");
      } else {
        Alert.alert("Error", result.error || "Failed to resend OTP");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: BrandColors.primary.blue + "20" }]}>
            <Feather name="smartphone" size={48} color={BrandColors.primary.blue} />
          </View>
          <ThemedText style={styles.title}>Verify Your Phone</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Enter the 6-digit code sent to{"\n"}
            <ThemedText style={styles.phoneNumber}>+27 {phoneNumber}</ThemedText>
          </ThemedText>
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref: TextInput | null) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: digit ? BrandColors.primary.blue : theme.border,
                  color: theme.text,
                },
              ]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!loading}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.verifyButton,
            { backgroundColor: otp.every(d => d) ? BrandColors.primary.blue : BrandColors.gray[400] },
          ]}
          onPress={() => handleVerify(otp.join(""))}
          disabled={loading || !otp.every(d => d)}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.verifyButtonText}>Verify</ThemedText>
          )}
        </TouchableOpacity>

        <View style={styles.resendContainer}>
          <ThemedText style={[styles.resendText, { color: theme.textSecondary }]}>
            Didn't receive the code?{" "}
          </ThemedText>
          <TouchableOpacity onPress={handleResend} disabled={resendTimer > 0 || loading}>
            <ThemedText
              style={[
                styles.resendLink,
                { color: resendTimer > 0 ? theme.textSecondary : BrandColors.primary.blue },
              ]}
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  backButton: {
    marginBottom: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  phoneNumber: {
    fontWeight: "600",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing["3xl"],
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
  },
  verifyButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  verifyButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});

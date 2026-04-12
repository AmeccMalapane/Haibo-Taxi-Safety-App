import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import type { NativeStackNavigationProp as NativeStackNav } from "@react-navigation/native-stack";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius, FontFamily } from "@/constants/theme";
const { width } = Dimensions.get("window");

export default function AuthScreen() {
  const { theme, isDark } = useTheme();
  const { login, loginWithEmail, register, sendOTP, skipAuth } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setHasBiometric(hasHardware && isEnrolled);
    } catch (error) {
      console.error("Biometric check error:", error);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to login",
        fallbackLabel: "Use password",
      });
      
      if (result.success) {
        const savedUser = await AsyncStorage.getItem("@haibo_user_data");
        if (savedUser) {
          handleAuthSuccess(JSON.parse(savedUser));
        } else {
          Alert.alert("No saved credentials", "Please login with email or phone first.");
        }
      }
    } catch (error) {
      console.error("Biometric auth error:", error);
    }
  };

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        Alert.alert("Not Available", "Social login is only available in the mobile app.");
        return;
      }
      Alert.alert(
        "Coming Soon",
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} login will be available soon.`
      );
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    const fullPhone = phone.startsWith("+27") ? phone : `+27${phone.replace(/^0/, "")}`;

    setLoading(true);
    try {
      const result = await sendOTP(fullPhone);
      if (result.success) {
        navigation.navigate("VerifyOTP", { phoneNumber: fullPhone, purpose: activeTab });
      } else {
        Alert.alert("Error", result.error || "Failed to send OTP");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (activeTab === "register" && password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (activeTab === "register" && password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      let result;
      if (activeTab === "register") {
        // Register with phone as required field + email/password
        const regPhone = phone ? (phone.startsWith("+27") ? phone : `+27${phone.replace(/^0/, "")}`) : `+27${Date.now()}`;
        result = await register({ phone: regPhone, email, password, displayName: email.split("@")[0] });
      } else {
        result = await loginWithEmail(email, password);
      }

      if (result.success) {
        navigation.reset({ index: 0, routes: [{ name: "MainTabs" as never }] });
      } else {
        Alert.alert("Error", result.error || "Authentication failed");
      }
    } catch (error) {
      Alert.alert("Error", "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = async (userData: any) => {
    try {
      await AsyncStorage.setItem("@haibo_user_token", userData.token);
      await AsyncStorage.setItem("@haibo_user_data", JSON.stringify(userData));
      
      if (hasBiometric) {
        Alert.alert(
          "Enable Quick Login?",
          "Would you like to enable biometric login for faster access?",
          [
            { text: "No thanks", style: "cancel" },
            {
              text: "Enable",
              onPress: async () => {
                await AsyncStorage.setItem("@haibo_biometric_enabled", "true");
              },
            },
          ]
        );
      }
      
      navigation.reset({
        index: 0,
        routes: [{ name: "MainTabs" as never }],
      });
    } catch (error) {
      console.error("Auth success error:", error);
    }
  };

  const handleSkip = async () => {
    await skipAuth();
    navigation.reset({
      index: 0,
      routes: [{ name: "MainTabs" as never }],
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoCircle}
            >
              <Feather name="truck" size={48} color="#FFFFFF" />
            </LinearGradient>
            <ThemedText style={styles.appName}>Haibo! Taxi</ThemedText>
            <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
              Safety in Motion
            </ThemedText>
          </View>

          <View style={[styles.tabContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "login" && [styles.activeTab, { backgroundColor: theme.backgroundDefault }],
              ]}
              onPress={() => setActiveTab("login")}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === "login" && styles.activeTabText,
                  { color: activeTab === "login" ? BrandColors.primary.gradientStart : theme.textSecondary },
                ]}
              >
                Login
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "register" && [styles.activeTab, { backgroundColor: theme.backgroundDefault }],
              ]}
              onPress={() => setActiveTab("register")}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === "register" && styles.activeTabText,
                  { color: activeTab === "register" ? BrandColors.primary.gradientStart : theme.textSecondary },
                ]}
              >
                Register
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.socialContainer}>
            <ThemedText style={[styles.socialText, { color: theme.textSecondary }]}>
              Continue with
            </ThemedText>
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={[styles.socialButton, { borderColor: theme.border }]}
                onPress={() => handleSocialLogin("google")}
                disabled={loading}
              >
                <Feather name="chrome" size={20} color="#DB4437" />
                <ThemedText style={styles.socialButtonText}>Google</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, { borderColor: theme.border }]}
                onPress={() => handleSocialLogin("facebook")}
                disabled={loading}
              >
                <Feather name="facebook" size={20} color="#4267B2" />
                <ThemedText style={styles.socialButtonText}>Facebook</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>OR</ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.phoneContainer}>
            <ThemedText style={[styles.phoneText, { color: theme.textSecondary }]}>
              Quick login with phone
            </ThemedText>
            <View style={styles.phoneInputContainer}>
              <View style={[styles.countryCode, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <ThemedText style={styles.countryCodeText}>+27</ThemedText>
              </View>
              <TextInput
                style={[
                  styles.phoneInput,
                  { backgroundColor: theme.backgroundDefault, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Phone number"
                placeholderTextColor={theme.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!loading}
              />
              <Pressable onPress={handlePhoneLogin} disabled={loading}>
                <LinearGradient
                  colors={BrandColors.gradient.primary}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.phoneButton, loading && { opacity: 0.7 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <ThemedText style={styles.phoneButtonText}>Send OTP</ThemedText>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
              placeholder="Email address"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                placeholder="Password"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {activeTab === "register" ? (
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
                placeholder="Confirm password"
                placeholderTextColor={theme.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            ) : null}

            {activeTab === "login" ? (
              <TouchableOpacity style={styles.forgotPassword}>
                <ThemedText style={[styles.forgotPasswordText, { color: BrandColors.primary.gradientStart }]}>
                  Forgot password?
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            <Pressable onPress={handleEmailAuth} disabled={loading}>
              <LinearGradient
                colors={BrandColors.gradient.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.submitButtonText}>
                    {activeTab === "login" ? "Login" : "Create Account"}
                  </ThemedText>
                )}
              </LinearGradient>
            </Pressable>

            {hasBiometric && activeTab === "login" ? (
              <TouchableOpacity style={styles.biometricButton} onPress={handleBiometricAuth}>
                <Feather name="smartphone" size={24} color={BrandColors.primary.gradientStart} />
                <ThemedText style={[styles.biometricText, { color: BrandColors.primary.gradientStart }]}>
                  Login with Biometrics
                </ThemedText>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <ThemedText style={[styles.skipText, { color: theme.textSecondary }]}>
              Skip for now
            </ThemedText>
          </TouchableOpacity>

          <ThemedText style={[styles.termsText, { color: theme.textSecondary }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </ThemedText>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
  },
  tagline: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  activeTab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 16,
  },
  activeTabText: {
    fontWeight: "600",
  },
  socialContainer: {
    marginBottom: Spacing.xl,
  },
  socialText: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  socialButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: 130,
    gap: Spacing.sm,
  },
  socialButtonText: {
    fontWeight: "500",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.md,
  },
  phoneContainer: {
    marginBottom: Spacing.xl,
  },
  phoneText: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  countryCode: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopLeftRadius: BorderRadius.md,
    borderBottomLeftRadius: BorderRadius.md,
    borderWidth: 1,
    borderRightWidth: 0,
  },
  countryCodeText: {
    fontWeight: "500",
  },
  phoneInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    fontSize: 16,
  },
  phoneButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  phoneButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  formContainer: {
    marginBottom: Spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    fontSize: 16,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeButton: {
    position: "absolute",
    right: Spacing.md,
    top: Spacing.md,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: Spacing.lg,
  },
  forgotPasswordText: {
    fontSize: 14,
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    shadowColor: "#E72369",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: "500",
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  skipText: {
    fontSize: 16,
  },
  termsText: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 18,
  },
});

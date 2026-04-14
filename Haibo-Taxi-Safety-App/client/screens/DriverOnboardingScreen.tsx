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
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean DriverOnboarding — self-service driver registration on
// mobile, mirroring VendorOnboardingScreen. Plate + vehicle is Step 1
// so a user can finish in 30 seconds with just the mandatory fields;
// license/insurance is Step 2 and fully optional (can be left blank
// and added later through the admin KYC review).
//
// Posts to POST /api/drivers/register which already exists — this is
// pure frontend work filling in an ingress gap. Before this screen,
// the only way into driver_profiles was via the admin Command Center
// manually creating rows, which made the KYC queue empty in practice.

type Step = "vehicle" | "documents";

// ISO date helper — accepts YYYY-MM-DD or leaves undefined
function parseIsoDate(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  return trimmed;
}

export default function DriverOnboardingScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [step, setStep] = useState<Step>("vehicle");

  // Step 1 — vehicle
  const [plateNumber, setPlateNumber] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [plateFocused, setPlateFocused] = useState(false);
  const [modelFocused, setModelFocused] = useState(false);
  const [yearFocused, setYearFocused] = useState(false);
  const [colorFocused, setColorFocused] = useState(false);

  // Step 2 — documents (all optional)
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [licenseFocused, setLicenseFocused] = useState(false);
  const [licenseExpFocused, setLicenseExpFocused] = useState(false);
  const [insuranceFocused, setInsuranceFocused] = useState(false);
  const [insuranceExpFocused, setInsuranceExpFocused] = useState(false);

  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const triggerHaptic = (
    style: "selection" | "success" | "error" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = require("expo-haptics");
      if (style === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (style === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}
  };

  const registerMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/drivers/register", {
        method: "POST",
        body: JSON.stringify({
          taxiPlateNumber: plateNumber.trim().toUpperCase(),
          vehicleModel: vehicleModel.trim() || undefined,
          vehicleYear: vehicleYear ? parseInt(vehicleYear, 10) : undefined,
          vehicleColor: vehicleColor.trim() || undefined,
          licenseNumber: licenseNumber.trim() || undefined,
          licenseExpiry: parseIsoDate(licenseExpiry),
          insuranceNumber: insuranceNumber.trim() || undefined,
          insuranceExpiry: parseIsoDate(insuranceExpiry),
        }),
      });
    },
    onSuccess: (data: any) => {
      triggerHaptic("success");
      Alert.alert(
        "You're registered",
        `Your Haibo Pay reference is ${data?.payReferenceCode || "HB-…"}. Head to the driver dashboard to go online.`,
        [
          {
            text: "Driver dashboard",
            onPress: () => navigation.replace("DriverDashboard"),
          },
        ]
      );
    },
    onError: (error: Error) => {
      triggerHaptic("error");
      // 409 = already registered — swap to "welcome back" state so the
      // user isn't stuck in a failure loop.
      if (error.message?.includes("409") || /already exists/i.test(error.message || "")) {
        setAlreadyRegistered(true);
        return;
      }
      Alert.alert("Couldn't register", error.message || "Please try again.");
    },
  });

  const step1Valid = plateNumber.trim().length >= 4;

  const handleContinueFromVehicle = () => {
    if (!step1Valid) {
      triggerHaptic("error");
      return;
    }
    triggerHaptic("selection");
    setStep("documents");
  };

  const handleSubmit = () => {
    if (!step1Valid) {
      triggerHaptic("error");
      return;
    }
    registerMutation.mutate();
  };

  const handleSkipDocs = () => {
    if (!step1Valid) {
      triggerHaptic("error");
      return;
    }
    registerMutation.mutate();
  };

  // ────────────────────────────────────────────────────────────────────
  // Already-registered fallback
  // ────────────────────────────────────────────────────────────────────
  if (alreadyRegistered) {
    return (
      <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroBadgeWrap}>
            <View style={styles.heroBadge}>
              <Feather
                name="check"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </View>
          <View style={styles.heroText}>
            <ThemedText style={styles.heroTitle}>You're already in</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              You've already registered as a driver. Head to your dashboard.
            </ThemedText>
          </View>
        </LinearGradient>

        <View
          style={[
            styles.contentCard,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing["3xl"],
            },
          ]}
        >
          <View style={styles.cta}>
            <GradientButton
              onPress={() => navigation.replace("DriverDashboard")}
              size="large"
              icon="arrow-right"
              iconPosition="right"
            >
              Driver dashboard
            </GradientButton>
          </View>
        </View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Onboarding form
  // ────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
              onPress={() => {
                if (step === "documents") {
                  setStep("vehicle");
                  return;
                }
                navigation.goBack();
              }}
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
              <Feather
                name="truck"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>
              {step === "vehicle" ? "Become a driver" : "Documents"}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {step === "vehicle"
                ? "Accept Haibo Pay, share your live location, and build your rating."
                : "Add your license and insurance so commuters know you're certified."}
            </ThemedText>
          </Animated.View>

          {/* Step indicator */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(500).delay(200)}
            style={styles.stepIndicator}
          >
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View
              style={[styles.stepLine, step === "documents" && styles.stepLineActive]}
            />
            <View
              style={[styles.stepDot, step === "documents" && styles.stepDotActive]}
            />
          </Animated.View>
        </LinearGradient>

        {/* Floating content card */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
          style={[
            styles.contentCard,
            {
              backgroundColor: theme.backgroundRoot,
              paddingBottom: insets.bottom + Spacing["3xl"],
            },
          ]}
        >
          {step === "vehicle" ? (
            <>
              <BrandLabel theme={theme}>Plate number *</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  styles.plateInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: plateFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="E.g. CA 123 456"
                placeholderTextColor={theme.textSecondary}
                value={plateNumber}
                onChangeText={(v) => setPlateNumber(v.toUpperCase())}
                onFocus={() => setPlateFocused(true)}
                onBlur={() => setPlateFocused(false)}
                autoCapitalize="characters"
                maxLength={12}
              />

              <BrandLabel theme={theme}>Vehicle model</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: modelFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="E.g. Toyota Quantum"
                placeholderTextColor={theme.textSecondary}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                onFocus={() => setModelFocused(true)}
                onBlur={() => setModelFocused(false)}
                maxLength={60}
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <BrandLabel theme={theme}>Year</BrandLabel>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.backgroundDefault,
                        color: theme.text,
                        borderColor: yearFocused
                          ? BrandColors.primary.gradientStart
                          : theme.border,
                      },
                    ]}
                    placeholder="2022"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={vehicleYear}
                    onChangeText={setVehicleYear}
                    onFocus={() => setYearFocused(true)}
                    onBlur={() => setYearFocused(false)}
                    maxLength={4}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <BrandLabel theme={theme}>Color</BrandLabel>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.backgroundDefault,
                        color: theme.text,
                        borderColor: colorFocused
                          ? BrandColors.primary.gradientStart
                          : theme.border,
                      },
                    ]}
                    placeholder="White"
                    placeholderTextColor={theme.textSecondary}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    onFocus={() => setColorFocused(true)}
                    onBlur={() => setColorFocused(false)}
                    maxLength={30}
                  />
                </View>
              </View>

              <View style={styles.cta}>
                <GradientButton
                  onPress={handleContinueFromVehicle}
                  disabled={!step1Valid}
                  size="large"
                  icon="arrow-right"
                  iconPosition="right"
                >
                  Continue
                </GradientButton>
              </View>
            </>
          ) : (
            <>
              <View
                style={[
                  styles.infoBox,
                  {
                    backgroundColor: BrandColors.status.info + "12",
                    borderColor: BrandColors.status.info + "40",
                  },
                ]}
              >
                <Feather name="info" size={16} color={BrandColors.status.info} />
                <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
                  Documents are optional — you can finish registering without
                  them and add them later for KYC verification.
                </ThemedText>
              </View>

              <BrandLabel theme={theme}>License number</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: licenseFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="Professional driving permit number"
                placeholderTextColor={theme.textSecondary}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                onFocus={() => setLicenseFocused(true)}
                onBlur={() => setLicenseFocused(false)}
                maxLength={40}
              />

              <BrandLabel theme={theme}>License expiry (YYYY-MM-DD)</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: licenseExpFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="2028-06-30"
                placeholderTextColor={theme.textSecondary}
                value={licenseExpiry}
                onChangeText={setLicenseExpiry}
                onFocus={() => setLicenseExpFocused(true)}
                onBlur={() => setLicenseExpFocused(false)}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <BrandLabel theme={theme}>Insurance number</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: insuranceFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="Insurance policy number"
                placeholderTextColor={theme.textSecondary}
                value={insuranceNumber}
                onChangeText={setInsuranceNumber}
                onFocus={() => setInsuranceFocused(true)}
                onBlur={() => setInsuranceFocused(false)}
                maxLength={40}
              />

              <BrandLabel theme={theme}>Insurance expiry (YYYY-MM-DD)</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: insuranceExpFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="2028-06-30"
                placeholderTextColor={theme.textSecondary}
                value={insuranceExpiry}
                onChangeText={setInsuranceExpiry}
                onFocus={() => setInsuranceExpFocused(true)}
                onBlur={() => setInsuranceExpFocused(false)}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <View style={styles.cta}>
                <GradientButton
                  onPress={handleSubmit}
                  disabled={registerMutation.isPending}
                  size="large"
                  icon={registerMutation.isPending ? undefined : "check"}
                  iconPosition="right"
                >
                  {registerMutation.isPending
                    ? "Registering…"
                    : "Complete registration"}
                </GradientButton>
              </View>

              <Pressable
                onPress={handleSkipDocs}
                disabled={registerMutation.isPending}
                style={({ pressed }) => [
                  styles.skipLink,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Skip for now and register"
              >
                <ThemedText
                  style={[
                    styles.skipText,
                    { color: BrandColors.primary.gradientStart },
                  ]}
                >
                  Skip docs — register without
                </ThemedText>
              </Pressable>
            </>
          )}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BrandLabel({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: any;
}) {
  return (
    <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
      {String(children).toUpperCase()}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

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
  heroBadgeWrap: { alignItems: "center", marginBottom: Spacing.lg },
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
  heroText: { alignItems: "center" },
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

  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.lg,
    gap: 0,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  stepDotActive: { backgroundColor: "#FFFFFF" },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  stepLineActive: { backgroundColor: "#FFFFFF" },

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

  label: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1.5,
  },
  plateInput: {
    letterSpacing: 2,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  twoCol: {
    flexDirection: "row",
    gap: Spacing.md,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  infoText: {
    ...Typography.small,
    flex: 1,
  },

  cta: {
    marginTop: Spacing["2xl"],
  },

  skipLink: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  skipText: {
    ...Typography.link,
    fontWeight: "600",
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});

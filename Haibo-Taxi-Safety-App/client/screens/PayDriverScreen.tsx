import React, { useEffect, useState } from "react";
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
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

// PayDriver — passenger pays a taxi fare via Haibo Pay. Two-phase UI:
//   1. Plate entry + lookup → resolves the plate to the driver card
//      (name, vehicle, verified status) so the passenger sees who
//      they're paying before entering an amount.
//   2. Confirmation with driver card + amount → pay.
//
// Money lands in the driver's fareBalance via POST /api/wallet/pay-driver,
// which runs the 85/15 fare split through processPayment().
//
// Deep-link entry: /pay-driver/:plate seeds the plate input and auto-
// runs the lookup so a QR scan drops the passenger straight into the
// confirmation step.

interface DriverLookup {
  userId: string;
  taxiPlateNumber: string;
  vehicleColor: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  totalRides: number | null;
  safetyRating: number | null;
  totalRatings: number | null;
  isVerified: boolean | null;
  linkStatus: "pending" | "active" | "suspended" | null;
  displayName: string | null;
  handle: string | null;
}

const QUICK_AMOUNTS = [10, 20, 50, 100];

function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/[\s-]/g, "");
}

export default function PayDriverScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "PayDriver">>();
  const queryClient = useQueryClient();

  // Deep-link entry: /pay-driver/ABC123GP passes the plate as a route
  // param. Seed the text input so the passenger sees what they're
  // about to resolve (and so the two-phase flow shows the right hero
  // copy even during the brief auto-lookup).
  const initialPlate = route.params?.plate
    ? normalizePlate(route.params.plate)
    : "";
  const [plate, setPlate] = useState(initialPlate);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [plateFocused, setPlateFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);

  const [driver, setDriver] = useState<DriverLookup | null>(null);

  const triggerHaptic = (
    style: "selection" | "success" | "error" = "selection",
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

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const normalized = normalizePlate(plate);
      const res = await apiRequest(
        `/api/drivers/lookup/${encodeURIComponent(normalized)}`,
      );
      return res.data as DriverLookup;
    },
    onSuccess: (data) => {
      triggerHaptic("success");
      setDriver(data);
    },
    onError: () => {
      triggerHaptic("error");
      Alert.alert(
        "Driver not found",
        "Double-check the plate. Common mistake: zero vs. letter O.",
      );
    },
  });

  // Auto-lookup on deep-link entry so the passenger drops straight
  // into the confirmation step instead of having to tap "Find driver"
  // on a plate they didn't type. Minimum 4 chars so a malformed link
  // doesn't spam the endpoint.
  useEffect(() => {
    if (initialPlate && initialPlate.length >= 4) {
      lookupMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/wallet/pay-driver", {
        method: "POST",
        body: JSON.stringify({
          taxiPlateNumber: driver?.taxiPlateNumber,
          amount: parseFloat(amount),
          message: message.trim() || undefined,
        }),
      });
    },
    onSuccess: () => {
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/transactions"] });
      Alert.alert(
        "Fare paid",
        `R${parseFloat(amount).toFixed(2)} sent to ${driver?.displayName || driver?.taxiPlateNumber}. Safe travels.`,
        [{ text: "Done", onPress: () => navigation.goBack() }],
      );
    },
    onError: (error: Error) => {
      triggerHaptic("error");
      Alert.alert("Payment failed", error.message || "Please try again.");
    },
  });

  const canLookup = normalizePlate(plate).length >= 4;
  const canPay =
    !!driver &&
    amount.trim().length > 0 &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0;

  const vehicleSummary = driver
    ? [driver.vehicleColor, driver.vehicleModel, driver.vehicleYear]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)}>
            <Pressable
              onPress={() => {
                if (driver) {
                  setDriver(null);
                  setAmount("");
                  setMessage("");
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
                name={driver ? "credit-card" : "truck"}
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
              {driver ? "Confirm fare" : "Pay your driver"}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {driver
                ? "Review the details, then pay."
                : "Type the plate on the back of the seat, or scan the taxi's QR."}
            </ThemedText>
          </Animated.View>
        </LinearGradient>

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
          {!driver ? (
            <>
              <BrandLabel theme={theme}>Taxi plate</BrandLabel>
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
                placeholder="CA 123-456"
                placeholderTextColor={theme.textSecondary}
                value={plate}
                onChangeText={(v) => setPlate(v.toUpperCase())}
                onFocus={() => setPlateFocused(true)}
                onBlur={() => setPlateFocused(false)}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
              />
              <ThemedText style={[styles.helper, { color: theme.textSecondary }]}>
                Spaces and dashes are ignored. The plate is also printed on the
                fare card stuck on the back of the seat in front of you.
              </ThemedText>

              <View style={styles.cta}>
                <GradientButton
                  onPress={() => lookupMutation.mutate()}
                  disabled={!canLookup || lookupMutation.isPending}
                  size="large"
                  icon={lookupMutation.isPending ? undefined : "search"}
                  iconPosition="right"
                >
                  {lookupMutation.isPending ? "Looking up…" : "Find driver"}
                </GradientButton>
              </View>
            </>
          ) : (
            <>
              {/* Driver preview card */}
              <View
                style={[
                  styles.driverCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: BrandColors.primary.gradientStart + "40",
                  },
                ]}
              >
                <View
                  style={[
                    styles.driverIcon,
                    {
                      backgroundColor:
                        BrandColors.primary.gradientStart + "12",
                    },
                  ]}
                >
                  <Feather
                    name="truck"
                    size={26}
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.driverName}>
                    {driver.displayName || driver.taxiPlateNumber}
                  </ThemedText>
                  <ThemedText
                    style={[styles.driverMeta, { color: theme.textSecondary }]}
                  >
                    {driver.taxiPlateNumber}
                    {vehicleSummary ? ` · ${vehicleSummary}` : ""}
                  </ThemedText>
                  <View style={styles.badgeRow}>
                    {driver.isVerified ? (
                      <View style={styles.verifiedRow}>
                        <Feather
                          name="check-circle"
                          size={12}
                          color={BrandColors.status.success}
                        />
                        <ThemedText
                          style={[
                            styles.verifiedText,
                            { color: BrandColors.status.success },
                          ]}
                        >
                          Verified
                        </ThemedText>
                      </View>
                    ) : null}
                    {driver.totalRatings && driver.totalRatings > 0 && driver.safetyRating ? (
                      <View style={styles.ratingRow}>
                        <Feather
                          name="star"
                          size={12}
                          color={BrandColors.accent.yellow}
                        />
                        <ThemedText style={styles.ratingText}>
                          {driver.safetyRating.toFixed(1)} · {driver.totalRatings}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <BrandLabel theme={theme}>Fare amount (R) *</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: amountFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
              />
              <View style={styles.quickAmounts}>
                {QUICK_AMOUNTS.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => {
                      triggerHaptic("selection");
                      setAmount(String(q));
                    }}
                    style={({ pressed }) => [
                      styles.quickAmountChip,
                      {
                        backgroundColor: theme.backgroundDefault,
                        borderColor: theme.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText style={styles.quickAmountText}>R{q}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <BrandLabel theme={theme}>Note (optional)</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: messageFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="e.g. From Bree to Bara"
                placeholderTextColor={theme.textSecondary}
                value={message}
                onChangeText={setMessage}
                onFocus={() => setMessageFocused(true)}
                onBlur={() => setMessageFocused(false)}
                maxLength={140}
              />

              <View style={styles.cta}>
                <GradientButton
                  onPress={() => payMutation.mutate()}
                  disabled={!canPay || payMutation.isPending}
                  size="large"
                  icon={payMutation.isPending ? undefined : "check"}
                  iconPosition="right"
                >
                  {payMutation.isPending ? "Paying…" : `Pay R${amount || "0"}`}
                </GradientButton>
              </View>
            </>
          )}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

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
    fontFamily: "Nunito_400Regular",
    borderWidth: 1.5,
  },
  plateInput: {
    letterSpacing: 2,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 18,
    textAlign: "center",
  },
  helper: {
    ...Typography.small,
    fontSize: 12,
    marginTop: Spacing.xs,
  },

  driverCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  driverIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: {
    ...Typography.h4,
    marginBottom: 2,
  },
  driverMeta: {
    ...Typography.small,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    ...Typography.small,
    fontSize: 11,
    fontWeight: "700",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    ...Typography.small,
    fontSize: 11,
    fontWeight: "600",
  },

  quickAmounts: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  quickAmountChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  quickAmountText: {
    ...Typography.small,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  cta: {
    marginTop: Spacing["2xl"],
  },
});

import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Image,
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

// typeui-clean PayVendor — matches Post / Wallet form patterns: rose
// gradient hero with storefront badge, floating white card with ref
// lookup → amount → pay. QR scanning is a future enhancement; for now
// the buyer types the printed HBV-xxxx-xxxx ref on the vendor's stall.
//
// Two-phase UI:
//   1. Ref entry + lookup → resolves the ref to a vendor card so the
//      buyer sees who they're about to pay before entering an amount.
//   2. Confirmation with vendor card + amount → pay.
//
// Payment goes through POST /api/wallet/pay-vendor which reuses the
// existing P2P rail, tags the transfer with vendorRef, and increments
// the vendor's sales counters.

interface VendorLookup {
  id: string;
  vendorType: "taxi_vendor" | "hawker" | "accessories";
  businessName: string;
  rankLocation: string | null;
  description: string | null;
  businessImageUrl: string | null;
  vendorRef: string;
  status: "pending" | "verified" | "suspended";
}

const QUICK_AMOUNTS = [10, 20, 50, 100];

export default function PayVendorScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "PayVendor">>();
  const queryClient = useQueryClient();

  // Deep-link entry: if we got here via haibo://pay/HBV-xxxx or a shared
  // payment link, the vendorRef is passed as a route param. Seed the
  // text input with it so the user sees what they're about to resolve.
  const initialRef = route.params?.vendorRef || "";
  const [vendorRef, setVendorRef] = useState(initialRef);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [refFocused, setRefFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [messageFocused, setMessageFocused] = useState(false);

  const [vendor, setVendor] = useState<VendorLookup | null>(null);

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

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const normalized = vendorRef.trim().toUpperCase();
      const res = await apiRequest(`/api/vendor-profile/lookup/${encodeURIComponent(normalized)}`);
      return res.data as VendorLookup;
    },
    onSuccess: (data) => {
      triggerHaptic("success");
      setVendor(data);
    },
    onError: () => {
      triggerHaptic("error");
      Alert.alert(
        "Vendor not found",
        "Double-check the code. It should look like HBV-1234-AB5C.",
      );
    },
  });

  // Auto-lookup on deep-link entry so the user drops straight into the
  // confirmation step instead of having to tap "Find vendor" on a ref
  // they didn't type. Guarded on initialRef so manual-entry users keep
  // the two-step flow.
  useEffect(() => {
    if (initialRef && initialRef.length >= 8) {
      lookupMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/wallet/pay-vendor", {
        method: "POST",
        body: JSON.stringify({
          vendorRef: vendor?.vendorRef,
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
        "Paid",
        `R${parseFloat(amount).toFixed(2)} sent to ${vendor?.businessName}.`,
        [{ text: "Done", onPress: () => navigation.goBack() }],
      );
    },
    onError: (error: Error) => {
      triggerHaptic("error");
      Alert.alert("Payment failed", error.message || "Please try again.");
    },
  });

  const canLookup = vendorRef.trim().length >= 8; // HBV-xxxx minimum
  const canPay =
    !!vendor &&
    amount.trim().length > 0 &&
    !isNaN(parseFloat(amount)) &&
    parseFloat(amount) > 0;

  const typeLabel =
    vendor?.vendorType === "taxi_vendor"
      ? "Taxi rank vendor"
      : vendor?.vendorType === "hawker"
        ? "Hawker"
        : vendor?.vendorType === "accessories"
          ? "Accessories & goods"
          : "";

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
                if (vendor) {
                  setVendor(null);
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
                name={vendor ? "credit-card" : "shopping-bag"}
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
              {vendor ? "Confirm payment" : "Pay a vendor"}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {vendor
                ? "Review the details, then pay."
                : "Type the HBV code printed on the stall or menu."}
            </ThemedText>
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
          {!vendor ? (
            <>
              <BrandLabel theme={theme}>Vendor reference code</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  styles.refInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: refFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="HBV-1234-AB5C"
                placeholderTextColor={theme.textSecondary}
                value={vendorRef}
                onChangeText={(v) => setVendorRef(v.toUpperCase())}
                onFocus={() => setRefFocused(true)}
                onBlur={() => setRefFocused(false)}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />
              <ThemedText style={[styles.helper, { color: theme.textSecondary }]}>
                Look for the printed code at the stall, or ask the vendor to
                show it in their Haibo wallet.
              </ThemedText>

              <View style={styles.cta}>
                <GradientButton
                  onPress={() => lookupMutation.mutate()}
                  disabled={!canLookup || lookupMutation.isPending}
                  size="large"
                  icon={lookupMutation.isPending ? undefined : "search"}
                  iconPosition="right"
                >
                  {lookupMutation.isPending ? "Looking up…" : "Find vendor"}
                </GradientButton>
              </View>
            </>
          ) : (
            <>
              {/* Vendor preview card */}
              <View
                style={[
                  styles.vendorCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: BrandColors.primary.gradientStart + "40",
                  },
                ]}
              >
                {vendor.businessImageUrl ? (
                  <Image
                    source={{ uri: vendor.businessImageUrl }}
                    style={styles.vendorPhoto}
                    resizeMode="cover"
                    accessibilityLabel={`${vendor.businessName} photo`}
                  />
                ) : (
                  <View
                    style={[
                      styles.vendorIcon,
                      {
                        backgroundColor:
                          BrandColors.primary.gradientStart + "12",
                      },
                    ]}
                  >
                    <Feather
                      name="shopping-bag"
                      size={26}
                      color={BrandColors.primary.gradientStart}
                    />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.vendorName}>
                    {vendor.businessName}
                  </ThemedText>
                  <ThemedText
                    style={[styles.vendorMeta, { color: theme.textSecondary }]}
                  >
                    {typeLabel}
                    {vendor.rankLocation ? ` · ${vendor.rankLocation}` : ""}
                  </ThemedText>
                  {vendor.status === "verified" ? (
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
                </View>
              </View>

              <BrandLabel theme={theme}>Amount (R) *</BrandLabel>
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
                placeholder="e.g. 2 chips and a cold drink"
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
                  {payMutation.isPending
                    ? "Paying…"
                    : `Pay R${amount || "0"}`}
                </GradientButton>
              </View>
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
  refInput: {
    letterSpacing: 2,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    textAlign: "center",
  },
  helper: {
    ...Typography.small,
    fontSize: 12,
    marginTop: Spacing.xs,
  },

  // Vendor preview card
  vendorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  vendorIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  vendorPhoto: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  vendorName: {
    ...Typography.h4,
    marginBottom: 2,
  },
  vendorMeta: {
    ...Typography.small,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    ...Typography.small,
    fontSize: 11,
    fontWeight: "700",
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

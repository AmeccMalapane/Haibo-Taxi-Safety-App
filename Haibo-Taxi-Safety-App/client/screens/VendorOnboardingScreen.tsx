import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Share,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { createVendorPayLink } from "@/lib/deepLinks";
import { uploadFromUri } from "@/lib/uploads";
import * as ImagePicker from "expo-image-picker";

// typeui-clean VendorOnboardingScreen — rose gradient hero with storefront
// badge, floating white card with the onboarding form. Matches PostLostFound
// / WalletScreen patterns: BrandLabel caps, 1.5px rose focus borders, gradient
// CTA.
//
// Unlike the Vault prototype (AsyncStorage + separate vendors table), this
// screen posts to /api/vendor-profile and relies on the user's existing
// wallet + withdrawal pipeline. The vendor is just a flag on their account.
//
// Flow:
//   - If the user already has a profile → show the "welcome back" state
//     with their existing vendorRef and a shortcut to edit.
//   - Otherwise → 2-step form (type → details). Banking is deliberately
//     absent because the user's wallet already has withdrawal wired up.

type VendorType = "taxi_vendor" | "hawker" | "accessories";

const VENDOR_TYPES: {
  value: VendorType;
  title: string;
  blurb: string;
  icon: keyof typeof Feather.glyphMap;
  accent: string;
}[] = [
  {
    value: "taxi_vendor",
    title: "Taxi rank vendor",
    blurb: "Food, drinks, or snacks sold at a taxi rank",
    icon: "shopping-bag",
    accent: BrandColors.primary.gradientStart,
  },
  {
    value: "hawker",
    title: "Hawker / street vendor",
    blurb: "Goods sold on the street or at intersections",
    icon: "package",
    accent: BrandColors.status.info,
  },
  {
    value: "accessories",
    title: "Accessories & goods",
    blurb: "Phone accessories, chargers, or other items",
    icon: "smartphone",
    accent: BrandColors.secondary.purple,
  },
];

type Step = "type" | "details";

interface VendorProfileRow {
  id: string;
  vendorType: VendorType;
  businessName: string;
  rankLocation: string | null;
  description: string | null;
  businessImageUrl: string | null;
  vendorRef: string;
  status: "pending" | "verified" | "suspended";
  salesCount: number;
  totalSales: number;
}

export default function VendorOnboardingScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("type");
  const [vendorType, setVendorType] = useState<VendorType | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [rankLocation, setRankLocation] = useState("");
  const [description, setDescription] = useState("");
  const [businessImageUrl, setBusinessImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [rankFocused, setRankFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  // Load existing profile if any — shows the "welcome back" state instead
  // of the form when the user is already registered.
  const existingQ = useQuery<{ data: VendorProfileRow | null }>({
    queryKey: ["/api/vendor-profile/me"],
    queryFn: () => apiRequest("/api/vendor-profile/me"),
  });

  const existing = existingQ.data?.data ?? null;

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/vendor-profile", {
        method: "POST",
        body: JSON.stringify({
          vendorType,
          businessName: businessName.trim(),
          rankLocation: rankLocation.trim() || undefined,
          description: description.trim() || undefined,
          businessImageUrl: businessImageUrl || undefined,
        }),
      });
    },
    onSuccess: () => {
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-profile/me"] });
    },
    onError: (error: Error) => {
      triggerHaptic("error");
      Alert.alert("Couldn't register", error.message || "Please try again.");
    },
  });

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

  // Pick an image from the library, upload it to /api/uploads/image,
  // and store the returned public URL. We upload on pick (not on form
  // submit) so the user sees the image immediately and we don't have
  // to carry a local file URI through the mutation.
  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Grant photo library access in your device settings to upload a business photo.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      triggerHaptic("selection");
      setImageUploading(true);
      const uploaded = await uploadFromUri(result.assets[0].uri, {
        folder: "vendor-photos",
        name: result.assets[0].fileName || undefined,
      });
      setBusinessImageUrl(uploaded.url);
      triggerHaptic("success");
    } catch (error: any) {
      triggerHaptic("error");
      Alert.alert("Upload failed", error.message || "Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleClearImage = () => {
    triggerHaptic("selection");
    setBusinessImageUrl("");
  };

  const detailsValid =
    !!vendorType && businessName.trim().length >= 3;

  const handleContinueFromType = () => {
    if (!vendorType) {
      triggerHaptic("error");
      return;
    }
    triggerHaptic("selection");
    setStep("details");
  };

  const handleSubmit = () => {
    if (!detailsValid) {
      triggerHaptic("error");
      return;
    }
    createMutation.mutate();
  };

  // ────────────────────────────────────────────────────────────────────
  // Existing vendor state — the "welcome back" card with ref + status.
  // ────────────────────────────────────────────────────────────────────
  if (existing) {
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
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>

            <Animated.View
              entering={reducedMotion ? undefined : FadeIn.duration(400).delay(100)}
              style={styles.heroBadgeWrap}
            >
              <View style={styles.heroBadge}>
                <Feather
                  name="shopping-bag"
                  size={32}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
            </Animated.View>

            <Animated.View
              entering={
                reducedMotion ? undefined : FadeInDown.duration(500).delay(150)
              }
              style={styles.heroText}
            >
              <ThemedText style={styles.heroTitle}>
                {existing.businessName}
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Your Haibo Vault vendor profile
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
            {/* Business image preview — only if vendor provided a URL */}
            {existing.businessImageUrl ? (
              <View style={styles.existingImageWrap}>
                <Image
                  source={{ uri: existing.businessImageUrl }}
                  style={styles.existingImage}
                  resizeMode="cover"
                  accessibilityLabel={`${existing.businessName} photo`}
                />
              </View>
            ) : null}

            {/* Vendor ref card — QR + code, the thing they show customers */}
            <View
              style={[
                styles.refCard,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText
                style={[styles.refLabel, { color: theme.textSecondary }]}
              >
                YOUR HAIBO PAY VENDOR CODE
              </ThemedText>

              {/* Server-rendered QR — commuters scan with any native
                  camera to land in PayVendor with this ref pre-filled. */}
              {(() => {
                const apiBase = getApiUrl();
                if (!apiBase) return null;
                const qrUrl = `${apiBase}api/vendor-profile/${encodeURIComponent(existing.vendorRef)}/qr.png`;
                return (
                  <Image
                    source={{ uri: qrUrl }}
                    style={styles.qrImage}
                    resizeMode="contain"
                    accessibilityLabel="Payment QR code"
                  />
                );
              })()}

              <ThemedText style={styles.refValue}>{existing.vendorRef}</ThemedText>
              <ThemedText
                style={[styles.refHint, { color: theme.textSecondary }]}
              >
                Customers scan the QR or type the code to pay you on Haibo.
              </ThemedText>
            </View>

            {/* Status row */}
            <View style={styles.statusRow}>
              <StatusPill status={existing.status} />
              {existing.status === "pending" ? (
                <ThemedText
                  style={[styles.statusHint, { color: theme.textSecondary }]}
                >
                  We'll review your profile shortly. You can still receive
                  payments while pending.
                </ThemedText>
              ) : existing.status === "verified" ? (
                <ThemedText
                  style={[styles.statusHint, { color: theme.textSecondary }]}
                >
                  You're listed in the verified vendor directory.
                </ThemedText>
              ) : (
                <ThemedText
                  style={[styles.statusHint, { color: BrandColors.status.emergency }]}
                >
                  Your profile was suspended. Contact support for details.
                </ThemedText>
              )}
            </View>

            {/* Sales summary */}
            <View style={styles.statGrid}>
              <StatTile
                label="Sales"
                value={existing.salesCount.toString()}
                theme={theme}
              />
              <StatTile
                label="Lifetime"
                value={`R${Number(existing.totalSales).toFixed(0)}`}
                theme={theme}
              />
              <StatTile
                label="Type"
                value={
                  existing.vendorType === "taxi_vendor"
                    ? "Rank"
                    : existing.vendorType === "hawker"
                      ? "Hawker"
                      : "Goods"
                }
                theme={theme}
              />
            </View>

            <View style={styles.cta}>
              <GradientButton
                onPress={async () => {
                  try {
                    const url = createVendorPayLink(existing.vendorRef);
                    await Share.share({
                      message: `Pay ${existing.businessName} on Haibo:\n${url}\n\nOr type the code: ${existing.vendorRef}`,
                      title: `Pay ${existing.businessName}`,
                    });
                  } catch (e) {
                    // user cancelled — no-op
                  }
                }}
                size="large"
                icon="share-2"
                iconPosition="right"
              >
                Share payment link
              </GradientButton>
            </View>

            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [
                styles.backLink,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Back to wallet"
            >
              <ThemedText
                style={[
                  styles.backLinkText,
                  { color: BrandColors.primary.gradientStart },
                ]}
              >
                Back to wallet
              </ThemedText>
            </Pressable>
          </Animated.View>
        </KeyboardAwareScrollViewCompat>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Onboarding form.
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
                if (step === "details") {
                  setStep("type");
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
                name="shopping-bag"
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
              {step === "type" ? "Become a vendor" : "Tell us about you"}
            </ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {step === "type"
                ? "Accept Haibo Pay from commuters, drivers, and anyone in Mzansi."
                : "We'll use this so customers can find you."}
            </ThemedText>
          </Animated.View>

          {/* Step indicator */}
          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(500).delay(200)}
            style={styles.stepIndicator}
          >
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={[styles.stepLine, step === "details" && styles.stepLineActive]} />
            <View style={[styles.stepDot, step === "details" && styles.stepDotActive]} />
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
          {step === "type" ? (
            <>
              <BrandLabel theme={theme}>I am a</BrandLabel>
              <View style={styles.typeList}>
                {VENDOR_TYPES.map((t) => {
                  const active = vendorType === t.value;
                  return (
                    <Pressable
                      key={t.value}
                      onPress={() => {
                        triggerHaptic("selection");
                        setVendorType(t.value);
                      }}
                      style={({ pressed }) => [
                        styles.typeCard,
                        {
                          backgroundColor: active
                            ? t.accent + "12"
                            : theme.surface,
                          borderColor: active ? t.accent : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <View
                        style={[
                          styles.typeIconWrap,
                          {
                            backgroundColor: active ? t.accent : t.accent + "12",
                          },
                        ]}
                      >
                        <Feather
                          name={t.icon}
                          size={22}
                          color={active ? "#FFFFFF" : t.accent}
                        />
                      </View>
                      <View style={styles.typeTextWrap}>
                        <ThemedText
                          style={[
                            styles.typeTitle,
                            { color: active ? t.accent : theme.text },
                          ]}
                        >
                          {t.title}
                        </ThemedText>
                        <ThemedText
                          style={[
                            styles.typeBlurb,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {t.blurb}
                        </ThemedText>
                      </View>
                      {active ? (
                        <View
                          style={[
                            styles.typeCheck,
                            { backgroundColor: t.accent },
                          ]}
                        >
                          <Feather name="check" size={14} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.cta}>
                <GradientButton
                  onPress={handleContinueFromType}
                  disabled={!vendorType}
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
              <BrandLabel theme={theme}>Business name *</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: nameFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="e.g. Mama's Snacks"
                placeholderTextColor={theme.textSecondary}
                value={businessName}
                onChangeText={setBusinessName}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                maxLength={80}
              />

              <BrandLabel theme={theme}>Taxi rank / location</BrandLabel>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: rankFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="e.g. Bara Rank or corner of Commissioner St"
                placeholderTextColor={theme.textSecondary}
                value={rankLocation}
                onChangeText={setRankLocation}
                onFocus={() => setRankFocused(true)}
                onBlur={() => setRankFocused(false)}
                maxLength={120}
              />

              <BrandLabel theme={theme}>What do you sell?</BrandLabel>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: descFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="Chips, sweets, cold drinks, phone chargers…"
                placeholderTextColor={theme.textSecondary}
                value={description}
                onChangeText={setDescription}
                onFocus={() => setDescFocused(true)}
                onBlur={() => setDescFocused(false)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={280}
              />

              <BrandLabel theme={theme}>Business photo (optional)</BrandLabel>
              {businessImageUrl ? (
                <View style={styles.uploadedWrap}>
                  <Image
                    source={{ uri: businessImageUrl }}
                    style={styles.uploadedImage}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={handleClearImage}
                    style={({ pressed }) => [
                      styles.clearImageBtn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove business photo"
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickImage}
                  disabled={imageUploading}
                  style={({ pressed }) => [
                    styles.uploadButton,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Upload business photo"
                >
                  <View
                    style={[
                      styles.uploadIconWrap,
                      {
                        backgroundColor:
                          BrandColors.primary.gradientStart + "12",
                      },
                    ]}
                  >
                    <Feather
                      name={imageUploading ? "loader" : "camera"}
                      size={18}
                      color={BrandColors.primary.gradientStart}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.uploadButtonText,
                      { color: theme.text },
                    ]}
                  >
                    {imageUploading ? "Uploading…" : "Add a photo of your stall"}
                  </ThemedText>
                </Pressable>
              )}

              <View
                style={[
                  styles.infoBox,
                  {
                    backgroundColor: BrandColors.status.success + "12",
                    borderColor: BrandColors.status.success + "40",
                  },
                ]}
              >
                <Feather
                  name="shield"
                  size={16}
                  color={BrandColors.status.success}
                />
                <ThemedText
                  style={[
                    styles.infoText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Payments go to your existing Haibo wallet. Withdraw to your
                  linked bank any time.
                </ThemedText>
              </View>

              <View style={styles.cta}>
                <GradientButton
                  onPress={handleSubmit}
                  disabled={!detailsValid || createMutation.isPending}
                  size="large"
                  icon={createMutation.isPending ? undefined : "check"}
                  iconPosition="right"
                >
                  {createMutation.isPending
                    ? "Registering…"
                    : "Complete registration"}
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

function StatusPill({ status }: { status: "pending" | "verified" | "suspended" }) {
  const { accent, label } =
    status === "verified"
      ? { accent: BrandColors.status.success, label: "Verified" }
      : status === "suspended"
        ? { accent: BrandColors.status.emergency, label: "Suspended" }
        : { accent: BrandColors.status.warning, label: "Pending review" };
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: accent + "18", borderColor: accent + "55" },
      ]}
    >
      <Feather
        name={
          status === "verified"
            ? "check-circle"
            : status === "suspended"
              ? "x-circle"
              : "clock"
        }
        size={12}
        color={accent}
      />
      <ThemedText style={[styles.statusPillText, { color: accent }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function StatTile({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
      ]}
    >
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
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

  // Step indicator — rose dots + line
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

  // Labels + inputs
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
  textArea: {
    minHeight: 100,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1.5,
  },

  // Vendor type cards
  typeList: {
    gap: Spacing.md,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: Spacing.md,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  typeTextWrap: { flex: 1 },
  typeTitle: {
    ...Typography.h4,
    marginBottom: 2,
  },
  typeBlurb: {
    ...Typography.small,
  },
  typeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },

  // Info box (success tinted)
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  infoText: {
    ...Typography.small,
    flex: 1,
  },

  // CTA bottom button
  cta: {
    marginTop: Spacing["2xl"],
  },

  backLink: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  backLinkText: {
    ...Typography.link,
    fontWeight: "600",
  },

  // Existing vendor image preview on welcome-back
  existingImageWrap: {
    alignItems: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  existingImage: {
    width: 120,
    height: 120,
    borderRadius: BorderRadius.lg,
  },

  // Upload button (empty state)
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  uploadIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadButtonText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  // Uploaded image preview with remove button
  uploadedWrap: {
    alignItems: "center",
    marginTop: Spacing.xs,
    position: "relative",
  },
  uploadedImage: {
    width: 140,
    height: 140,
    borderRadius: BorderRadius.md,
  },
  clearImageBtn: {
    position: "absolute",
    top: -6,
    right: "35%",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Welcome-back: QR image (server-rendered PNG)
  qrImage: {
    width: 220,
    height: 220,
    marginVertical: Spacing.md,
  },

  // Welcome-back: vendor ref card
  refCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  refLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  refValue: {
    ...Typography.h1,
    color: BrandColors.primary.gradientStart,
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  refHint: {
    ...Typography.small,
    textAlign: "center",
  },

  // Status row + pill
  statusRow: {
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    ...Typography.small,
    fontSize: 12,
    fontWeight: "700",
  },
  statusHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 300,
  },

  // Stat grid
  statGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  statTile: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  statLabel: {
    ...Typography.label,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    ...Typography.h3,
    fontVariant: ["tabular-nums"],
  },
});

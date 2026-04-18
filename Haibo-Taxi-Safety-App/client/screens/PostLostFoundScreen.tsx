import React, { useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  Platform,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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
import { uploadFromUri } from "@/lib/uploads";
import { getDeviceId } from "@/lib/deviceId";

// typeui-clean rework — Post Lost & Found item form. Matches the rest of
// the auth/form pattern: rose gradient hero with back button, floating
// white form card with rose focus borders, GradientButton CTA.
//
// Latent bugs fixed:
//   1. `apiRequest("POST", url, data).json()` was a runtime crash —
//      apiRequest already returns parsed body, calling `.json()` on it
//      throws "response.json is not a function". Posting a lost/found
//      item would have always failed. Switched to the new options-object
//      form: apiRequest(url, { method, body }).
//   2. Description char counter said "Minimum 10 characters" but the
//      isValid check was `> 10` (off-by-one — required 11+). Fixed to
//      `>= 10` so the helper text is honest.
//   3. No back button on a screen reached from LostFoundScreen via push.

type ItemType = "lost" | "found";
type CategoryType =
  | "phone"
  | "wallet"
  | "bag"
  | "document"
  | "keys"
  | "other";

const CATEGORIES: {
  value: CategoryType;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { value: "phone", label: "Phone", icon: "smartphone" },
  { value: "wallet", label: "Wallet", icon: "credit-card" },
  { value: "bag", label: "Bag", icon: "shopping-bag" },
  { value: "document", label: "Documents", icon: "file-text" },
  { value: "keys", label: "Keys", icon: "key" },
  { value: "other", label: "Other", icon: "package" },
];

export default function PostLostFoundScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [type, setType] = useState<ItemType>("lost");
  const [category, setCategory] = useState<CategoryType>("phone");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [routeOrigin, setRouteOrigin] = useState("");
  const [routeDestination, setRouteDestination] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [reward, setReward] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);

  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [originFocused, setOriginFocused] = useState(false);
  const [destFocused, setDestFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [rewardFocused, setRewardFocused] = useState(false);

  const isValid =
    title.trim().length > 0 &&
    description.trim().length >= 10 &&
    contactName.trim().length > 0 &&
    contactPhone.trim().length >= 10;

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

  // Pick + upload a photo of the item — essential for "found" posts
  // (so the owner can recognize it) and very helpful for "lost" posts
  // (so finders know exactly what to look for).
  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Grant photo library access to attach an image.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      triggerHaptic("selection");
      setImageUploading(true);
      const uploaded = await uploadFromUri(result.assets[0].uri, {
        folder: "lost-found",
        name: result.assets[0].fileName || undefined,
      });
      setImageUrl(uploaded.url);
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
    setImageUrl("");
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      const deviceId = await getDeviceId();
      return apiRequest("/api/lost-found", {
        method: "POST",
        body: JSON.stringify({
          type,
          category,
          title: title.trim(),
          description: description.trim(),
          imageUrl: imageUrl || undefined,
          routeOrigin: routeOrigin.trim() || undefined,
          routeDestination: routeDestination.trim() || undefined,
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          reward: reward ? parseFloat(reward) : undefined,
          deviceId,
        }),
      });
    },
    onSuccess: () => {
      triggerHaptic("success");
      queryClient.invalidateQueries({ queryKey: ["/api/lost-found"] });
      Alert.alert(
        "Posted!",
        `Your ${type} item is live. The Haibo community can see it now.`,
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: Error) => {
      triggerHaptic("error");
      Alert.alert("Couldn't post", error.message || "Please try again.");
    },
  });

  const handleSubmit = () => {
    if (!isValid) {
      triggerHaptic("error");
      return;
    }
    postMutation.mutate();
  };

  const charCount = description.trim().length;

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
              onPress={() => navigation.goBack()}
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
                name="edit-3"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Report an item</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Help reunite people with what they've lost.
            </ThemedText>
          </Animated.View>
        </LinearGradient>

        {/* Floating content card */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing["3xl"] },
          ]}
        >
          {/* Type selector — Lost vs Found */}
          <BrandLabel theme={theme}>I am reporting</BrandLabel>
          <View style={styles.typeRow}>
            <TypeButton
              active={type === "lost"}
              accent={BrandColors.status.emergency}
              icon="search"
              label="I lost something"
              onPress={() => {
                triggerHaptic("selection");
                setType("lost");
              }}
              theme={theme}
            />
            <TypeButton
              active={type === "found"}
              accent={BrandColors.status.success}
              icon="check-circle"
              label="I found something"
              onPress={() => {
                triggerHaptic("selection");
                setType("found");
              }}
              theme={theme}
            />
          </View>

          {/* Category grid */}
          <BrandLabel theme={theme}>Category</BrandLabel>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  onPress={() => {
                    triggerHaptic("selection");
                    setCategory(cat.value);
                  }}
                  style={({ pressed }) => [
                    styles.categoryButton,
                    {
                      backgroundColor: active
                        ? BrandColors.primary.gradientStart + "12"
                        : theme.backgroundDefault,
                      borderColor: active
                        ? BrandColors.primary.gradientStart
                        : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Feather
                    name={cat.icon}
                    size={16}
                    color={
                      active
                        ? BrandColors.primary.gradientStart
                        : theme.textSecondary
                    }
                  />
                  <ThemedText
                    style={[
                      styles.categoryText,
                      {
                        color: active
                          ? BrandColors.primary.gradientStart
                          : theme.text,
                        fontWeight: active ? "700" : "500",
                      },
                    ]}
                  >
                    {cat.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {/* Title */}
          <BrandLabel theme={theme}>Title *</BrandLabel>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: titleFocused
                  ? BrandColors.primary.gradientStart
                  : theme.border,
              },
            ]}
            placeholder={
              type === "lost"
                ? "e.g. Black Samsung Galaxy S24"
                : "e.g. Found wallet at Bara Rank"
            }
            placeholderTextColor={theme.textSecondary}
            value={title}
            onChangeText={setTitle}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            maxLength={100}
          />

          {/* Description */}
          <BrandLabel theme={theme}>Description *</BrandLabel>
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
            placeholder="Color, size, distinguishing features, where you lost or found it..."
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <ThemedText
            style={[
              styles.helper,
              {
                color:
                  charCount >= 10
                    ? BrandColors.status.success
                    : theme.textSecondary,
              },
            ]}
          >
            {charCount >= 10
              ? `${charCount} characters · looks good`
              : `${charCount}/10 characters minimum`}
          </ThemedText>

          {/* Photo (optional but strongly encouraged) */}
          <BrandLabel theme={theme}>Photo (optional)</BrandLabel>
          {imageUrl ? (
            <View style={styles.lfImagePreviewWrap}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.lfImagePreview}
                resizeMode="cover"
              />
              <Pressable
                onPress={handleClearImage}
                style={({ pressed }) => [
                  styles.lfImageClearBtn,
                  pressed && { opacity: 0.8 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Feather name="x" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={handlePickImage}
              disabled={imageUploading}
              style={({ pressed }) => [
                styles.lfUploadButton,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Upload a photo"
            >
              <View
                style={[
                  styles.lfUploadIcon,
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
                  styles.lfUploadText,
                  { color: theme.text },
                ]}
              >
                {imageUploading
                  ? "Uploading…"
                  : type === "found"
                    ? "Add a photo of the item"
                    : "Add a photo if you have one"}
              </ThemedText>
            </Pressable>
          )}

          {/* Route (optional) */}
          <BrandLabel theme={theme}>Route (optional)</BrandLabel>
          <View style={styles.routeRow}>
            <TextInput
              style={[
                styles.input,
                styles.routeInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: originFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder="From"
              placeholderTextColor={theme.textSecondary}
              value={routeOrigin}
              onChangeText={setRouteOrigin}
              onFocus={() => setOriginFocused(true)}
              onBlur={() => setOriginFocused(false)}
            />
            <Feather name="arrow-right" size={18} color={theme.textSecondary} />
            <TextInput
              style={[
                styles.input,
                styles.routeInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: destFocused
                    ? BrandColors.primary.gradientStart
                    : theme.border,
                },
              ]}
              placeholder="To"
              placeholderTextColor={theme.textSecondary}
              value={routeDestination}
              onChangeText={setRouteDestination}
              onFocus={() => setDestFocused(true)}
              onBlur={() => setDestFocused(false)}
            />
          </View>

          {/* Contact */}
          <BrandLabel theme={theme}>Your contact details *</BrandLabel>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: nameFocused
                  ? BrandColors.primary.gradientStart
                  : theme.border,
                marginBottom: Spacing.sm,
              },
            ]}
            placeholder="Your name"
            placeholderTextColor={theme.textSecondary}
            value={contactName}
            onChangeText={setContactName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: phoneFocused
                  ? BrandColors.primary.gradientStart
                  : theme.border,
              },
            ]}
            placeholder="071 234 5678"
            placeholderTextColor={theme.textSecondary}
            value={contactPhone}
            onChangeText={(text) => setContactPhone(text.replace(/\D/g, ""))}
            onFocus={() => setPhoneFocused(true)}
            onBlur={() => setPhoneFocused(false)}
            keyboardType="phone-pad"
            maxLength={15}
          />

          {/* Reward (only for lost items) */}
          {type === "lost" ? (
            <>
              <BrandLabel theme={theme}>Reward (optional)</BrandLabel>
              <View
                style={[
                  styles.rewardInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: rewardFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
              >
                <ThemedText style={styles.rewardCurrency}>R</ThemedText>
                <TextInput
                  style={[styles.rewardField, { color: theme.text }]}
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  value={reward}
                  onChangeText={(text) => setReward(text.replace(/[^0-9]/g, ""))}
                  onFocus={() => setRewardFocused(true)}
                  onBlur={() => setRewardFocused(false)}
                  keyboardType="numeric"
                />
              </View>
              <ThemedText style={[styles.helper, { color: theme.textSecondary }]}>
                Offering a reward increases the chance of getting your item back
              </ThemedText>
            </>
          ) : null}

          {/* Submit */}
          <View style={styles.cta}>
            <GradientButton
              onPress={handleSubmit}
              disabled={!isValid || postMutation.isPending || imageUploading}
              size="large"
              icon={postMutation.isPending ? undefined : "arrow-right"}
              iconPosition="right"
            >
              {postMutation.isPending
                ? "Posting..."
                : `Post ${type === "lost" ? "lost" : "found"} item`}
            </GradientButton>
          </View>
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

function TypeButton({
  active,
  accent,
  icon,
  label,
  onPress,
  theme,
}: {
  active: boolean;
  accent: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  theme: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.typeButton,
        {
          backgroundColor: active ? accent + "12" : theme.surface,
          borderColor: active ? accent : theme.border,
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
            backgroundColor: active ? accent : accent + "12",
          },
        ]}
      >
        <Feather
          name={icon}
          size={18}
          color={active ? "#FFFFFF" : accent}
        />
      </View>
      <ThemedText
        style={[
          styles.typeText,
          { color: active ? accent : theme.text },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

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
  heroBadgeWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
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
  heroText: {
    alignItems: "center",
  },
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
    fontFamily: "Nunito_400Regular",
    borderWidth: 1.5,
  },
  textArea: {
    minHeight: 120,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    fontSize: 16,
    fontFamily: "Nunito_400Regular",
    borderWidth: 1.5,
  },
  helper: {
    ...Typography.small,
    fontSize: 12,
    marginTop: Spacing.xs,
  },

  // Lost & found image upload
  lfUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  lfUploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  lfUploadText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  lfImagePreviewWrap: {
    width: "100%",
    height: 180,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  lfImagePreview: {
    width: "100%",
    height: "100%",
  },
  lfImageClearBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Type buttons
  typeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typeButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: "center",
    gap: Spacing.sm,
  },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  typeText: {
    ...Typography.small,
    fontWeight: "700",
    textAlign: "center",
  },

  // Categories
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  categoryText: {
    ...Typography.small,
  },

  // Route
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  routeInput: {
    flex: 1,
  },

  // Reward
  rewardInput: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  rewardCurrency: {
    ...Typography.h4,
    color: BrandColors.primary.gradientStart,
    fontWeight: "800",
    fontSize: 18,
  },
  rewardField: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Nunito_800ExtraBold",
    fontVariant: ["tabular-nums"],
  },

  // CTA
  cta: {
    marginTop: Spacing.xl,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

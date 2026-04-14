import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { GradientButton } from "@/components/GradientButton";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = [
  { id: "safety_tips", name: "Safety tips", icon: "shield" as const },
  { id: "taxi_hacks", name: "Taxi hacks", icon: "zap" as const },
  { id: "driver_stories", name: "Drivers", icon: "truck" as const },
  { id: "route_reviews", name: "Routes", icon: "map" as const },
  { id: "general", name: "General", icon: "hash" as const },
];

const SUGGESTED_HASHTAGS = [
  "#HaiboSafety",
  "#TaxiTalkZA",
  "#MinibusMoments",
  "#ShoTLeft",
  "#GautengTaxis",
];

const CAPTION_MAX = 500;

export default function CreateReelScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [isUploading, setIsUploading] = useState(false);

  const requestMediaPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status === "granted") return true;
    Alert.alert(
      "Permission required",
      "Allow media library access to upload photos and videos.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open settings",
          onPress: () => {
            if (Platform.OS !== "web") Linking.openSettings().catch(() => {});
          },
        },
      ]
    );
    return false;
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status === "granted") return true;
    Alert.alert(
      "Permission required",
      "Allow camera access to capture reels.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open settings",
          onPress: () => {
            if (Platform.OS !== "web") Linking.openSettings().catch(() => {});
          },
        },
      ]
    );
    return false;
  };

  const pickImage = async () => {
    if (!(await requestMediaPermission())) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
        setMediaType("image");
      }
    } catch {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const pickVideo = async () => {
    if (!(await requestMediaPermission())) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
        setMediaType("video");
      }
    } catch {
      Alert.alert("Error", "Failed to pick video. Please try again.");
    }
  };

  const takePhoto = async () => {
    if (!(await requestCameraPermission())) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setMediaUri(result.assets[0].uri);
        setMediaType("image");
      }
    } catch {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const handlePost = async () => {
    if (!mediaUri) {
      Alert.alert("Missing media", "Please select a photo or video to upload.");
      return;
    }
    if (!caption.trim()) {
      Alert.alert("Missing caption", "Please add a caption to your reel.");
      return;
    }

    setIsUploading(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => {
      setIsUploading(false);
      Alert.alert(
        "Saved locally",
        "Reel uploads are coming soon. Your content has been saved on this device.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    }, 600);
  };

  const toggleHashtag = (tag: string) => {
    Haptics.selectionAsync();
    if (caption.includes(tag)) {
      setCaption((prev) => prev.replace(tag, "").replace(/\s+/g, " ").trim());
    } else {
      setCaption((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  const canPost = Boolean(mediaUri) && caption.trim().length > 0 && !isUploading;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <LinearGradient
        colors={BrandColors.gradient.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
      >
        <View style={styles.heroTopRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.heroCloseButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroBadge}>
            <Feather name="film" size={16} color="#FFFFFF" />
            <ThemedText style={styles.heroBadgeText}>Create reel</ThemedText>
          </View>
          <View style={styles.heroSpacer} />
        </View>
        <ThemedText style={styles.heroTitle}>Tell Mzansi a story.</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Safety tips, taxi hacks, hand signals — inspire your commuters.
        </ThemedText>
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
        ]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)} style={styles.mediaCard}>
          {mediaUri ? (
            <View style={styles.mediaPreview}>
              <Image source={{ uri: mediaUri }} style={styles.mediaImage} contentFit="cover" />
              <View style={styles.mediaTypePill}>
                <Feather
                  name={mediaType === "video" ? "video" : "image"}
                  size={12}
                  color="#FFFFFF"
                />
                <ThemedText style={styles.mediaTypePillText}>
                  {mediaType === "video" ? "Video" : "Photo"}
                </ThemedText>
              </View>
              <Pressable
                style={styles.removeMediaButton}
                onPress={() => setMediaUri(null)}
                accessibilityRole="button"
                accessibilityLabel="Remove media"
              >
                <Feather name="x" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.mediaPickerRow}>
              <Pressable style={styles.mediaPickerButton} onPress={takePhoto}>
                <View style={styles.mediaIconWrap}>
                  <Feather name="camera" size={22} color={BrandColors.primary.gradientStart} />
                </View>
                <ThemedText style={styles.mediaPickerText}>Camera</ThemedText>
                <ThemedText style={styles.mediaPickerHint}>Capture live</ThemedText>
              </Pressable>
              <Pressable style={styles.mediaPickerButton} onPress={pickImage}>
                <View style={styles.mediaIconWrap}>
                  <Feather name="image" size={22} color={BrandColors.primary.gradientStart} />
                </View>
                <ThemedText style={styles.mediaPickerText}>Photo</ThemedText>
                <ThemedText style={styles.mediaPickerHint}>From gallery</ThemedText>
              </Pressable>
              <Pressable style={styles.mediaPickerButton} onPress={pickVideo}>
                <View style={styles.mediaIconWrap}>
                  <Feather name="video" size={22} color={BrandColors.primary.gradientStart} />
                </View>
                <ThemedText style={styles.mediaPickerText}>Video</ThemedText>
                <ThemedText style={styles.mediaPickerHint}>Up to 60s</ThemedText>
              </Pressable>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(400)} style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <ThemedText style={styles.sectionLabel}>Caption</ThemedText>
            <ThemedText
              style={[
                styles.charCount,
                caption.length > 0 && { color: BrandColors.primary.gradientStart },
              ]}
            >
              {caption.length}/{CAPTION_MAX}
            </ThemedText>
          </View>
          <TextInput
            style={styles.captionInput}
            placeholder="Share your taxi experience..."
            placeholderTextColor={BrandColors.gray[500]}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={CAPTION_MAX}
            textAlignVertical="top"
          />
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(140).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Suggested hashtags</ThemedText>
          <View style={styles.chipRow}>
            {SUGGESTED_HASHTAGS.map((tag) => {
              const active = caption.includes(tag);
              return (
                <Pressable
                  key={tag}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleHashtag(tag)}
                >
                  <ThemedText style={[styles.chipText, active && styles.chipTextActive]}>
                    {tag}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Category</ThemedText>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategory(cat.id);
                  }}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Feather
                    name={cat.icon}
                    size={16}
                    color={active ? "#FFFFFF" : BrandColors.primary.gradientStart}
                  />
                  <ThemedText
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.md,
            backgroundColor: theme.backgroundDefault,
          },
        ]}
      >
        <GradientButton
          onPress={handlePost}
          disabled={!canPost}
          icon={isUploading ? undefined : "send"}
        >
          {isUploading ? "Saving..." : "Post reel"}
        </GradientButton>
        <ThemedText style={styles.footerNote}>
          Demo mode — reels are saved locally. Cloud upload coming soon.
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    borderBottomLeftRadius: BorderRadius["2xl"],
    borderBottomRightRadius: BorderRadius["2xl"],
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  heroCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  heroBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroSpacer: {
    width: 40,
  },
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing["2xl"],
  },
  mediaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  mediaPickerRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  mediaPickerButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: BrandColors.primary.gradientStart + "4D",
    backgroundColor: BrandColors.primary.gradientStart + "08",
  },
  mediaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  mediaPickerText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  mediaPickerHint: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  mediaPreview: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 420,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaTypePill: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(231, 35, 105, 0.85)",
  },
  mediaTypePillText: {
    ...Typography.label,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  removeMediaButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  charCount: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[500],
    fontVariant: ["tabular-nums"],
    marginBottom: Spacing.sm,
  },
  captionInput: {
    ...Typography.body,
    minHeight: 110,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    backgroundColor: "#FFFFFF",
    color: BrandColors.gray[900],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  chipActive: {
    backgroundColor: BrandColors.primary.gradientStart,
    borderColor: BrandColors.primary.gradientStart,
  },
  chipText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.primary.gradientStart,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  categoryChipActive: {
    backgroundColor: BrandColors.primary.gradientStart,
    borderColor: BrandColors.primary.gradientStart,
  },
  categoryChipText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.primary.gradientStart,
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.gray[100],
  },
  footerNote: {
    ...Typography.small,
    color: BrandColors.gray[500],
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});

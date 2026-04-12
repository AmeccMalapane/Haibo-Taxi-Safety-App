import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const categories = [
  { id: "safety_tips", name: "Safety Tips" },
  { id: "taxi_hacks", name: "Taxi Hacks" },
  { id: "driver_stories", name: "Drivers" },
  { id: "route_reviews", name: "Routes" },
  { id: "general", name: "General" },
];

const suggestedHashtags = [
  "#HaiboSafety",
  "#TaxiTalkZA",
  "#MinibusMoments",
  "#ShoTLeft",
  "#GautengTaxis",
];

export default function CreateReelScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("general");
  const [isUploading, setIsUploading] = useState(false);

  const checkPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your media library to upload photos and videos.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Open Settings", 
            onPress: () => {
              if (Platform.OS !== "web") {
                Linking.openSettings().catch(() => {});
              }
            }
          },
        ]
      );
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await checkPermissions();
    if (!hasPermission) return;

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

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
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const pickVideo = async () => {
    const hasPermission = await checkPermissions();
    if (!hasPermission) return;

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

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
    } catch (error) {
      Alert.alert("Error", "Failed to pick video. Please try again.");
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow camera access to take photos.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Open Settings", 
            onPress: () => {
              if (Platform.OS !== "web") {
                Linking.openSettings().catch(() => {});
              }
            }
          },
        ]
      );
      return;
    }

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

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
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const handlePost = async () => {
    if (!mediaUri) {
      Alert.alert("Missing Media", "Please select a photo or video to upload.");
      return;
    }

    if (!caption.trim()) {
      Alert.alert("Missing Caption", "Please add a caption to your post.");
      return;
    }

    setIsUploading(true);

    try {
      if (Platform.OS !== "web") {
        const Haptics = await import("expo-haptics");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Coming Soon!",
        "Reel uploads will be available in a future update. Your content has been saved locally.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to upload. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const addHashtag = (tag: string) => {
    if (!caption.includes(tag)) {
      setCaption((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mediaSection}>
          {mediaUri ? (
            <View style={styles.mediaPreview}>
              <Image
                source={{ uri: mediaUri }}
                style={styles.mediaImage}
                contentFit="cover"
              />
              <Pressable
                style={styles.removeMediaButton}
                onPress={() => setMediaUri(null)}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </Pressable>
              <View style={styles.mediaTypeIndicator}>
                <Feather
                  name={mediaType === "video" ? "video" : "image"}
                  size={16}
                  color="#FFFFFF"
                />
              </View>
            </View>
          ) : (
            <View style={styles.mediaPicker}>
              <Pressable
                style={[styles.mediaPickerButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={pickImage}
              >
                <Feather name="image" size={32} color={BrandColors.primary.blue} />
                <ThemedText style={styles.mediaPickerText}>Photo</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.mediaPickerButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={pickVideo}
              >
                <Feather name="video" size={32} color={BrandColors.secondary.purple} />
                <ThemedText style={styles.mediaPickerText}>Video</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.mediaPickerButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={takePhoto}
              >
                <Feather name="camera" size={32} color={BrandColors.secondary.orange} />
                <ThemedText style={styles.mediaPickerText}>Camera</ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.captionSection}>
          <ThemedText style={styles.sectionTitle}>Caption</ThemedText>
          <TextInput
            style={[
              styles.captionInput,
              { backgroundColor: theme.backgroundSecondary, color: theme.text },
            ]}
            placeholder="Share your taxi experience..."
            placeholderTextColor={theme.textSecondary}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={500}
          />
          <ThemedText type="small" style={[styles.charCount, { color: theme.textSecondary }]}>
            {caption.length}/500
          </ThemedText>
        </View>

        <View style={styles.hashtagSection}>
          <ThemedText style={styles.sectionTitle}>Suggested Hashtags</ThemedText>
          <View style={styles.hashtagList}>
            {suggestedHashtags.map((tag) => (
              <Pressable
                key={tag}
                style={[
                  styles.hashtagChip,
                  {
                    backgroundColor: caption.includes(tag)
                      ? BrandColors.primary.blue
                      : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => addHashtag(tag)}
              >
                <ThemedText
                  style={[
                    styles.hashtagText,
                    { color: caption.includes(tag) ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {tag}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.categorySection}>
          <ThemedText style={styles.sectionTitle}>Category</ThemedText>
          <View style={styles.categoryList}>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor:
                      selectedCategory === cat.id
                        ? BrandColors.primary.blue
                        : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <ThemedText
                  style={[
                    styles.categoryChipText,
                    { color: selectedCategory === cat.id ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {cat.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={[
            styles.postButton,
            {
              backgroundColor: mediaUri && caption.trim() 
                ? BrandColors.primary.blue 
                : theme.backgroundTertiary,
            },
          ]}
          onPress={handlePost}
          disabled={isUploading || !mediaUri || !caption.trim()}
        >
          {isUploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="send" size={20} color="#FFFFFF" />
              <ThemedText style={styles.postButtonText}>Post Reel</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  mediaSection: {
    marginBottom: Spacing.xl,
  },
  mediaPicker: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "center",
  },
  mediaPickerButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 100,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  mediaPickerText: {
    fontSize: 12,
    fontWeight: "500",
  },
  mediaPreview: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 400,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  removeMediaButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaTypeIndicator: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  captionSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  captionInput: {
    minHeight: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    marginTop: Spacing.xs,
  },
  hashtagSection: {
    marginBottom: Spacing.xl,
  },
  hashtagList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  hashtagChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  hashtagText: {
    fontSize: 13,
    fontWeight: "500",
  },
  categorySection: {
    marginBottom: Spacing.xl,
  },
  categoryList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

import React, { useState, useCallback } from "react";
import {
  View,
  Modal,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

interface MediaOption {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
}

const MEDIA_OPTIONS: MediaOption[] = [
  { id: "photo", icon: "image", label: "Photo", color: BrandColors.primary.green },
  { id: "video", icon: "video", label: "Video", color: BrandColors.primary.blue },
  { id: "gif", icon: "zap", label: "GIF", color: BrandColors.secondary.orange },
  { id: "camera", icon: "camera", label: "Camera", color: BrandColors.primary.red },
];

interface NewPostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (content: string, mediaType?: string) => void;
}

export default function NewPostModal({ visible, onClose, onSubmit }: NewPostModalProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [content, setContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setContent("");
    setSelectedMedia(null);
    onClose();
  }, [onClose]);

  const handleMediaSelect = async (mediaId: string) => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }

    switch (mediaId) {
      case "photo":
        Alert.alert(
          "Photo Upload",
          "Photo gallery integration coming soon. This will allow you to select photos from your device.",
          [{ text: "OK" }]
        );
        setSelectedMedia("photo");
        break;
      case "video":
        Alert.alert(
          "Video Upload",
          "Video upload integration coming soon. This will allow you to share video clips.",
          [{ text: "OK" }]
        );
        setSelectedMedia("video");
        break;
      case "gif":
        Alert.alert(
          "GIF Selector",
          "GIF integration via Giphy API coming soon. Search and share animated GIFs!",
          [{ text: "OK" }]
        );
        setSelectedMedia("gif");
        break;
      case "camera":
        Alert.alert(
          "Camera",
          "Camera integration coming soon. Capture photos directly in the app.",
          [{ text: "OK" }]
        );
        setSelectedMedia("camera");
        break;
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !selectedMedia) {
      Alert.alert("Empty Post", "Please add some text or media to your post.");
      return;
    }

    setIsSubmitting(true);
    
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    
    onSubmit?.(content, selectedMedia || undefined);
    
    Alert.alert(
      "Post Created!",
      "Your post has been shared with the community.",
      [{ text: "OK", onPress: handleClose }]
    );
    
    setIsSubmitting(false);
  };

  const characterCount = content.length;
  const maxCharacters = 500;
  const isOverLimit = characterCount > maxCharacters;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" }]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <ThemedText style={[styles.cancelText, { color: theme.textSecondary }]}>
              Cancel
            </ThemedText>
          </Pressable>
          
          <ThemedText style={styles.headerTitle}>New Post</ThemedText>
          
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting || isOverLimit || (!content.trim() && !selectedMedia)}
            style={[
              styles.headerButton,
              {
                opacity: isSubmitting || isOverLimit || (!content.trim() && !selectedMedia) ? 0.5 : 1,
              },
            ]}
          >
            <LinearGradient
              colors={BrandColors.gradient.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.postButton}
            >
              <ThemedText style={styles.postButtonText}>
                {isSubmitting ? "Posting..." : "Post"}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputSection}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: BrandColors.primary.gradientStart + "20" }]}>
              <Feather name="user" size={24} color={BrandColors.primary.gradientStart} />
            </View>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: theme.text,
                  borderColor: isOverLimit ? BrandColors.primary.red : theme.border,
                },
              ]}
              placeholder="What's happening in the taxi world?"
              placeholderTextColor={theme.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={600}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.characterCount}>
            <ThemedText
              style={[
                styles.characterCountText,
                { color: isOverLimit ? BrandColors.primary.red : theme.textSecondary },
              ]}
            >
              {characterCount}/{maxCharacters}
            </ThemedText>
          </View>

          {selectedMedia ? (
            <View style={[styles.mediaPreview, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={styles.mediaPreviewContent}>
                <Feather
                  name={MEDIA_OPTIONS.find((m) => m.id === selectedMedia)?.icon || "file"}
                  size={24}
                  color={MEDIA_OPTIONS.find((m) => m.id === selectedMedia)?.color}
                />
                <ThemedText style={styles.mediaPreviewText}>
                  {MEDIA_OPTIONS.find((m) => m.id === selectedMedia)?.label} attached
                </ThemedText>
              </View>
              <Pressable onPress={() => setSelectedMedia(null)} style={styles.removeMediaButton}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.mediaSection}>
            <ThemedText style={[styles.mediaSectionTitle, { color: theme.textSecondary }]}>
              Add to your post
            </ThemedText>
            <View style={styles.mediaOptions}>
              {MEDIA_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  style={[
                    styles.mediaOption,
                    {
                      backgroundColor: isDark
                        ? theme.backgroundSecondary
                        : option.color + "15",
                      borderColor: selectedMedia === option.id ? option.color : "transparent",
                      borderWidth: selectedMedia === option.id ? 2 : 0,
                    },
                  ]}
                  onPress={() => handleMediaSelect(option.id)}
                >
                  <View style={[styles.mediaIconContainer, { backgroundColor: option.color + "25" }]}>
                    <Feather name={option.icon} size={22} color={option.color} />
                  </View>
                  <ThemedText style={styles.mediaLabel}>{option.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.tipCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={18} color={BrandColors.primary.blue} />
            <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
              Share route updates, safety alerts, or connect with fellow commuters. Be respectful and helpful!
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: {
    minWidth: 70,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cancelText: {
    fontSize: 16,
  },
  postButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  inputSection: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  characterCount: {
    alignItems: "flex-end",
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  characterCountText: {
    fontSize: 12,
  },
  mediaPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  mediaPreviewContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  mediaPreviewText: {
    fontSize: 14,
    fontWeight: "500",
  },
  removeMediaButton: {
    padding: Spacing.xs,
  },
  mediaSection: {
    marginBottom: Spacing.xl,
  },
  mediaSectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.md,
  },
  mediaOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  mediaOption: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  mediaIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  tipCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

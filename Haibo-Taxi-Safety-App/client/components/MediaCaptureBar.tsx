import React from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";

export interface MediaCaptureBarProps {
  onCapturePhoto: () => void;
  onRecordVideo: () => void;
  onRecordAudio: () => void;
  onPickFromGallery: () => void;
  isRecordingAudio?: boolean;
  isRecordingVideo?: boolean;
  audioDuration?: number;
  disabled?: boolean;
}

interface CaptureButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  disabled?: boolean;
  activeColor?: string;
}

function CaptureButton({
  icon,
  label,
  onPress,
  isActive = false,
  disabled = false,
  activeColor = BrandColors.secondary.orange,
}: CaptureButtonProps) {
  const { theme } = useTheme();

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      style={[
        styles.captureButton,
        {
          backgroundColor: isActive
            ? activeColor
            : theme.backgroundDefault,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={handlePress}
      disabled={disabled}
    >
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isActive
              ? "rgba(255,255,255,0.2)"
              : BrandColors.primary.blue + "15",
          },
        ]}
      >
        <Feather
          name={icon}
          size={20}
          color={isActive ? "#FFFFFF" : BrandColors.primary.blue}
        />
      </View>
      <ThemedText
        type="small"
        style={[
          styles.captureLabel,
          { color: isActive ? "#FFFFFF" : theme.textSecondary },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function MediaCaptureBar({
  onCapturePhoto,
  onRecordVideo,
  onRecordAudio,
  onPickFromGallery,
  isRecordingAudio = false,
  isRecordingVideo = false,
  disabled = false,
}: MediaCaptureBarProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText style={styles.sectionTitle}>Add Evidence</ThemedText>
      <View
        style={[
          styles.captureBar,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <CaptureButton
          icon="camera"
          label="Photo"
          onPress={onCapturePhoto}
          disabled={disabled || isRecordingAudio || isRecordingVideo}
        />
        <CaptureButton
          icon="video"
          label="Video"
          onPress={onRecordVideo}
          isActive={isRecordingVideo}
          disabled={disabled || isRecordingAudio}
          activeColor={BrandColors.secondary.orange}
        />
        <CaptureButton
          icon="mic"
          label="Audio"
          onPress={onRecordAudio}
          isActive={isRecordingAudio}
          disabled={disabled || isRecordingVideo}
          activeColor="#F44336"
        />
        <CaptureButton
          icon="image"
          label="Gallery"
          onPress={onPickFromGallery}
          disabled={disabled || isRecordingAudio || isRecordingVideo}
        />
      </View>
      {Platform.OS === "web" ? (
        <ThemedText
          type="small"
          style={[styles.webNote, { color: theme.textSecondary }]}
        >
          For full media capture, use Expo Go on your device
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  captureBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  captureButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginHorizontal: 2,
    borderRadius: BorderRadius.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  captureLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  webNote: {
    fontSize: 11,
    textAlign: "center",
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
});

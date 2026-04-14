import React from "react";
import { View, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { MediaEvidence } from "@/lib/types";

interface MediaPreviewGridProps {
  evidence: MediaEvidence[];
  onRemove: (id: string) => void;
  onView?: (evidence: MediaEvidence) => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function MediaThumbnail({
  item,
  onRemove,
  onView,
}: {
  item: MediaEvidence;
  onRemove: () => void;
  onView?: () => void;
}) {
  const { theme } = useTheme();

  const handleRemove = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onRemove();
  };

  const getTypeIcon = (): keyof typeof Feather.glyphMap => {
    switch (item.type) {
      case "photo":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "mic";
      default:
        return "file";
    }
  };

  const getTypeColor = (): string => {
    switch (item.type) {
      case "photo":
        return BrandColors.primary.blue;
      case "video":
        return BrandColors.secondary.orange;
      case "audio":
        return "#F44336";
      default:
        return theme.textSecondary;
    }
  };

  return (
    <Pressable
      style={[
        styles.thumbnail,
        { backgroundColor: theme.backgroundDefault },
      ]}
      onPress={onView}
      accessibilityRole="button"
      accessibilityLabel={`Preview ${item.type} evidence`}
    >
      {item.type === "photo" && item.uri ? (
        <Image
          source={{ uri: item.uri }}
          style={styles.thumbnailImage}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.placeholderThumbnail,
            { backgroundColor: getTypeColor() + "20" },
          ]}
        >
          <Feather name={getTypeIcon()} size={24} color={getTypeColor()} />
        </View>
      )}
      {item.type === "video" && item.duration ? (
        <View style={styles.durationBadge}>
          <ThemedText style={styles.durationText}>
            {formatDuration(item.duration)}
          </ThemedText>
        </View>
      ) : null}
      {item.type === "audio" && item.duration ? (
        <View style={styles.audioDuration}>
          <Feather name="mic" size={12} color="#FFFFFF" />
          <ThemedText style={styles.durationText}>
            {formatDuration(item.duration)}
          </ThemedText>
        </View>
      ) : null}
      <Pressable
        style={styles.removeButton}
        onPress={handleRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove evidence"
      >
        <Feather name="x" size={14} color="#FFFFFF" />
      </Pressable>
      {item.location ? (
        <View style={styles.locationBadge}>
          <Feather name="map-pin" size={10} color="#FFFFFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

export function MediaPreviewGrid({
  evidence,
  onRemove,
  onView,
}: MediaPreviewGridProps) {
  const { theme } = useTheme();

  if (evidence.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.sectionTitle}>
          Evidence ({evidence.length})
        </ThemedText>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary }}
        >
          Tap to preview
        </ThemedText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {evidence.map((item) => (
          <MediaThumbnail
            key={item.id}
            item={item}
            onRemove={() => onRemove(item.id)}
            onView={onView ? () => onView(item) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContent: {
    paddingRight: Spacing.md,
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  placeholderThumbnail: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  durationBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  audioDuration: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "#F44336",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BrandColors.primary.blue,
    alignItems: "center",
    justifyContent: "center",
  },
});

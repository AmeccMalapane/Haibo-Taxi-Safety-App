import React, { useState, memo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Share,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence,
  withTiming
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";

export interface ContentPost {
  id: string;
  type: string;
  title: string;
  content: string;
  author: string;
  authorAvatar?: string;
  image?: string; // Local upload
  imageUrl?: string; // Remote URL
  createdAt: string;
  likes: number;
  comments: number;
  isVerified?: boolean;
  isLive?: boolean;
  eventDate?: string;
  location?: string;
}

interface ContentCardProps {
  post: ContentPost;
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
}

export const ContentCard = memo(({
  post,
  onPress,
  onLike,
  onComment,
  onShare,
}: ContentCardProps) => {
  const { theme, isDark } = useTheme();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  
  const likeScale = useSharedValue(1);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getCategoryColor = () => {
    switch (post.type) {
      case "live":
        return BrandColors.status.emergency;
      case "lost_found":
        return BrandColors.secondary.orange;
      case "directions":
        return BrandColors.primary.green;
      case "group_rides":
        return BrandColors.secondary.purple;
      case "haibo_fam":
      default:
        return BrandColors.primary.blue;
    }
  };

  const getCategoryLabel = () => {
    return (post.type || "community").replace("_", " ").toUpperCase();
  };

  const handleLike = async () => {
    if (Platform.OS !== 'web') {
      try {
        const Haptics = await import("expo-haptics");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    
    // Animation
    likeScale.value = withSequence(
      withSpring(1.4, { damping: 10, stiffness: 100 }),
      withSpring(1, { damping: 10, stiffness: 100 })
    );

    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    onLike?.();
  };

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `${post.title}\n\n${post.content}\n\nShared via Haibo!`,
        title: post.title,
      });
      if (result.action === Share.sharedAction) {
        onShare?.();
      }
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const animatedLikeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  return (
    <Pressable
      style={[
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.header}>
        <View style={styles.authorSection}>
          <View style={[styles.avatar, { backgroundColor: BrandColors.primary.red + "20" }]}>
            <ThemedText style={[styles.avatarText, { color: BrandColors.primary.red }]}>
              {post.author.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <View style={styles.authorInfo}>
            <View style={styles.authorRow}>
              <ThemedText style={styles.authorName}>{post.author}</ThemedText>
              {post.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Feather name="check" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>
            <ThemedText style={[styles.timestamp, { color: theme.textSecondary }]}>
              {formatTime(post.createdAt)}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor() + "15" }]}>
          <ThemedText style={[styles.categoryText, { color: getCategoryColor() }]}>
            {getCategoryLabel()}
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.title}>{post.title}</ThemedText>
      <ThemedText style={[styles.content, { color: theme.textSecondary }]} numberOfLines={4}>
        {post.content}
      </ThemedText>

      {(post.imageUrl || post.image) && (
        <Image
          source={{ uri: post.imageUrl || post.image }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <Pressable style={styles.actionButton} onPress={handleLike}>
          <Animated.View style={animatedLikeStyle}>
            <Feather 
              name={isLiked ? "heart" : "heart"} 
              size={18} 
              color={isLiked ? BrandColors.primary.red : theme.textSecondary} 
              fill={isLiked ? BrandColors.primary.red : "transparent"}
            />
          </Animated.View>
          <ThemedText style={[styles.actionText, { color: isLiked ? BrandColors.primary.red : theme.textSecondary }]}>
            {likesCount}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={onComment}>
          <Feather name="message-circle" size={18} color={theme.textSecondary} />
          <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
            {post.comments}
          </ThemedText>
        </Pressable>

        <Pressable style={styles.actionButton} onPress={handleShare}>
          <Feather name="share-2" size={18} color={theme.textSecondary} />
          <ThemedText style={[styles.actionText, { color: theme.textSecondary }]}>
            Share
          </ThemedText>
        </Pressable>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: { borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: "hidden", elevation: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: Spacing.md, paddingBottom: Spacing.sm },
  authorSection: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  avatarText: { fontWeight: "700", fontSize: 14 },
  authorInfo: { flex: 1 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorName: { fontWeight: "700", fontSize: 14 },
  verifiedBadge: { width: 14, height: 14, borderRadius: 7, backgroundColor: BrandColors.primary.blue, alignItems: "center", justifyContent: "center" },
  timestamp: { fontSize: 11, marginTop: 1 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  categoryText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: "700", paddingHorizontal: Spacing.md, marginBottom: 4 },
  content: { fontSize: 14, lineHeight: 20, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  image: { width: "100%", height: 200, marginTop: Spacing.xs },
  actions: { flexDirection: "row", justifyContent: "space-around", paddingVertical: Spacing.sm, marginTop: Spacing.xs, borderTopWidth: 1 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  actionText: { fontSize: 13, fontWeight: "600" },
});

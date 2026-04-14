import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
  Platform,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { SkeletonBlock } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { CommunityPost } from "@/lib/types";
import { MOCK_COMMUNITY_POSTS } from "@/lib/mockData";
import { useCommunityPosts } from "@/hooks/useApiData";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  getCommunityPosts,
  saveCommunityPosts,
  addCommunityPost,
  toggleLikePost,
  getLikedPosts,
  generateId,
  getUserProfile,
} from "@/lib/storage";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { createDeepLink, getAppStoreLink } from "@/lib/deepLinks";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
}

function getUserTypeLabel(userType: CommunityPost["userType"]): string {
  if (userType === "driver") return "Driver";
  if (userType === "operator") return "Operator";
  return "Commuter";
}

function getUserTypeIcon(userType: CommunityPost["userType"]): keyof typeof Feather.glyphMap {
  if (userType === "driver") return "truck";
  if (userType === "operator") return "briefcase";
  return "user";
}

const POST_MAX = 500;

export default function HaiboFamScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { data: apiPosts = [], isLoading: isApiLoading } = useCommunityPosts();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  const loadData = useCallback(async () => {
    const liked = await getLikedPosts();
    setLikedPosts(liked);

    if (apiPosts.length > 0) {
      const mapped: CommunityPost[] = apiPosts.map((p: any) => ({
        id: String(p.id),
        userId: p.userId || "api",
        userName: p.userName || p.authorName || "Community Member",
        userType: p.userType || "commuter",
        avatarType: p.avatarType ?? 0,
        content: p.content || p.caption || "",
        imageUrl: p.mediaUrl || p.imageUrl,
        createdAt: p.createdAt || new Date().toISOString(),
        likes: p.likeCount ?? p.likes ?? 0,
        comments: p.commentCount ?? p.comments ?? 0,
        isLiked: false,
      }));
      setPosts(mapped);
    } else {
      const saved = await getCommunityPosts();
      if (saved.length === 0) {
        await saveCommunityPosts(MOCK_COMMUNITY_POSTS);
        setPosts(MOCK_COMMUNITY_POSTS);
      } else {
        setPosts(saved);
      }
    }
    setIsLoading(false);
  }, [apiPosts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleLike = async (postId: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const isNowLiked = await toggleLikePost(postId);
    setLikedPosts((prev) =>
      isNowLiked ? [...prev, postId] : prev.filter((id) => id !== postId)
    );
    setPosts((prev) => {
      const updated = prev.map((post) =>
        post.id === postId
          ? { ...post, likes: post.likes + (isNowLiked ? 1 : -1) }
          : post
      );
      saveCommunityPosts(updated);
      return updated;
    });
  };

  const handlePost = async () => {
    const trimmed = newPostContent.trim();
    if (trimmed.length === 0) return;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const profile = await getUserProfile();
    const newPost: CommunityPost = {
      id: generateId(),
      userId: profile?.id || "guest",
      userName: profile?.name || "You",
      userType: profile?.userType || "commuter",
      avatarType: profile?.avatarType ?? 0,
      content: trimmed,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      isLiked: false,
    };

    await addCommunityPost(newPost);
    setPosts((prev) => [newPost, ...prev]);
    setNewPostContent("");
    setIsComposing(false);
  };

  const handleShare = async (post: CommunityPost) => {
    try {
      const communityLink = createDeepLink("/community");
      await Share.share({
        message: `${post.content}\n\n— shared from Haibo Fam!\n\nJoin the conversation: ${communityLink}\nGet the app: ${getAppStoreLink()}`,
        title: "Haibo Fam post",
      });
    } catch {
      // silent — share cancelled
    }
  };

  const renderPost = ({ item: post, index }: { item: CommunityPost; index: number }) => {
    const isLiked = likedPosts.includes(post.id);
    return (
      <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(index * 40).duration(400)}>
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarInitials}>
                {getInitials(post.userName)}
              </ThemedText>
            </View>
            <View style={styles.postUserInfo}>
              <View style={styles.userNameRow}>
                <ThemedText style={styles.userName}>{post.userName}</ThemedText>
                {post.userType !== "commuter" ? (
                  <View style={styles.userBadge}>
                    <Feather
                      name={getUserTypeIcon(post.userType)}
                      size={10}
                      color={BrandColors.primary.gradientStart}
                    />
                    <ThemedText style={styles.userBadgeText}>
                      {getUserTypeLabel(post.userType)}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText style={styles.postTime}>{formatTime(post.createdAt)}</ThemedText>
            </View>
          </View>

          <ThemedText style={styles.postContent}>{post.content}</ThemedText>

          <View style={styles.postActions}>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleLike(post.id)}
              accessibilityRole="button"
              accessibilityLabel={isLiked ? "Unlike post" : "Like post"}
              accessibilityState={{ selected: isLiked }}
            >
              <Feather
                name="heart"
                size={18}
                color={isLiked ? BrandColors.primary.gradientStart : BrandColors.gray[600]}
              />
              <ThemedText
                style={[
                  styles.actionCount,
                  isLiked && { color: BrandColors.primary.gradientStart, fontWeight: "700" },
                ]}
              >
                {post.likes}
              </ThemedText>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel="View comments"
            >
              <Feather name="message-circle" size={18} color={BrandColors.gray[600]} />
              <ThemedText style={styles.actionCount}>{post.comments}</ThemedText>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => handleShare(post)}
              accessibilityRole="button"
              accessibilityLabel="Share post"
            >
              <Feather name="share-2" size={18} color={BrandColors.gray[600]} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderSkeleton = () => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <SkeletonBlock style={{ width: 44, height: 44, borderRadius: 22 }} />
        <View style={{ flex: 1, marginLeft: Spacing.md, gap: 6 }}>
          <SkeletonBlock style={{ width: "40%", height: 14, borderRadius: 4 }} />
          <SkeletonBlock style={{ width: "25%", height: 10, borderRadius: 4 }} />
        </View>
      </View>
      <SkeletonBlock style={{ width: "100%", height: 14, borderRadius: 4, marginBottom: 6 }} />
      <SkeletonBlock style={{ width: "85%", height: 14, borderRadius: 4, marginBottom: Spacing.md }} />
      <View style={{ flexDirection: "row", gap: Spacing.xl }}>
        <SkeletonBlock style={{ width: 40, height: 18, borderRadius: 4 }} />
        <SkeletonBlock style={{ width: 40, height: 18, borderRadius: 4 }} />
      </View>
    </View>
  );

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
            style={styles.heroButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroBadge}>
            <Feather name="users" size={16} color="#FFFFFF" />
            <ThemedText style={styles.heroBadgeText}>Haibo Fam</ThemedText>
          </View>
          <Pressable
            onPress={() => setIsComposing(true)}
            style={styles.heroButton}
            accessibilityRole="button"
            accessibilityLabel="Create new post"
          >
            <Feather name="edit-3" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <ThemedText style={styles.heroTitle}>Share. Like. Uplift.</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Stories, warnings and wins from commuters across Mzansi.
        </ThemedText>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>
              {isLoading ? "—" : posts.length}
            </ThemedText>
            <ThemedText style={styles.heroStatLabel}>Posts</ThemedText>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>
              {isLoading ? "—" : likedPosts.length}
            </ThemedText>
            <ThemedText style={styles.heroStatLabel}>Liked</ThemedText>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>24/7</ThemedText>
            <ThemedText style={styles.heroStatLabel}>Open</ThemedText>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {isComposing ? (
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(300)}
            style={styles.composeCard}
          >
            <View style={styles.composeHeader}>
              <View style={styles.composeAvatar}>
                <Feather name="edit-3" size={16} color={BrandColors.primary.gradientStart} />
              </View>
              <ThemedText style={styles.composeTitle}>Share with Haibo Fam</ThemedText>
            </View>
            <TextInput
              style={styles.composeInput}
              placeholder="What's happening in your commute today?"
              placeholderTextColor={BrandColors.gray[500]}
              value={newPostContent}
              onChangeText={setNewPostContent}
              multiline
              autoFocus
              maxLength={POST_MAX}
            />
            <View style={styles.composeFooter}>
              <ThemedText style={styles.composeCounter}>
                {newPostContent.length}/{POST_MAX}
              </ThemedText>
              <View style={styles.composeActions}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsComposing(false);
                    setNewPostContent("");
                  }}
                >
                  <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.postButton,
                    newPostContent.trim().length === 0 && styles.postButtonDisabled,
                  ]}
                  onPress={handlePost}
                  disabled={newPostContent.trim().length === 0}
                >
                  <Feather name="send" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.postButtonText}>Post</ThemedText>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Pressable
            style={styles.composePrompt}
            onPress={() => setIsComposing(true)}
          >
            <View style={styles.composePromptIcon}>
              <Feather name="edit-3" size={16} color={BrandColors.primary.gradientStart} />
            </View>
            <ThemedText style={styles.composePromptText}>
              Share your experience...
            </ThemedText>
            <Feather name="plus-circle" size={18} color={BrandColors.primary.gradientStart} />
          </Pressable>
        )}

        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {renderSkeleton()}
            {renderSkeleton()}
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            contentContainerStyle={{
              paddingHorizontal: Spacing.lg,
              paddingTop: Spacing.md,
              paddingBottom: insets.bottom + Spacing["3xl"],
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={BrandColors.primary.gradientStart}
              />
            }
            ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconWrap}>
                  <Feather name="users" size={28} color={BrandColors.primary.gradientStart} />
                </View>
                <ThemedText style={styles.emptyTitle}>No posts yet</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Be the first to share a story with the Haibo Fam.
                </ThemedText>
              </View>
            }
          />
        )}
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
  heroButton: {
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
  heroTitle: {
    ...Typography.h1,
    color: "#FFFFFF",
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: Spacing.xs,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: BorderRadius.md,
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
  },
  heroStatValue: {
    ...Typography.h3,
    color: "#FFFFFF",
  },
  heroStatLabel: {
    ...Typography.label,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  body: {
    flex: 1,
    marginTop: -Spacing["2xl"],
  },
  composePrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  composePromptIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  composePromptText: {
    ...Typography.body,
    flex: 1,
    color: BrandColors.gray[600],
  },
  composeCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  composeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  composeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  composeTitle: {
    ...Typography.h4,
    color: BrandColors.gray[900],
  },
  composeInput: {
    ...Typography.body,
    minHeight: 90,
    textAlignVertical: "top",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    backgroundColor: BrandColors.gray[50],
    color: BrandColors.gray[900],
  },
  composeFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  composeCounter: {
    ...Typography.small,
    color: BrandColors.gray[500],
    fontVariant: ["tabular-nums"],
  },
  composeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[600],
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart,
  },
  postButtonDisabled: {
    backgroundColor: BrandColors.gray[300],
  },
  postButtonText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  skeletonWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  postCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  postUserInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  userName: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.gray[900],
  },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
  },
  userBadgeText: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  postTime: {
    ...Typography.small,
    color: BrandColors.gray[500],
    marginTop: 2,
  },
  postContent: {
    ...Typography.body,
    color: BrandColors.gray[800],
    marginBottom: Spacing.md,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: BrandColors.gray[100],
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionCount: {
    ...Typography.small,
    color: BrandColors.gray[500],
    fontVariant: ["tabular-nums"],
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.sm,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.h4,
    color: BrandColors.gray[900],
  },
  emptySubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
  },
});

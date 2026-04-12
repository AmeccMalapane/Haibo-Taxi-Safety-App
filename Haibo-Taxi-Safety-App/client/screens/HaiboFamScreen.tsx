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
import { Feather } from "@expo/vector-icons";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { CommunityPost } from "@/lib/types";
import { MOCK_COMMUNITY_POSTS } from "@/lib/mockData";
import { useCommunityPosts, useCreatePost, useLikePost } from "@/hooks/useApiData";
import {
  getCommunityPosts,
  saveCommunityPosts,
  addCommunityPost,
  toggleLikePost,
  getLikedPosts,
  generateId,
  getUserProfile,
} from "@/lib/storage";

const AVATAR_COLORS = [
  BrandColors.secondary.orange,
  BrandColors.primary.blue,
  BrandColors.secondary.purple,
];

export default function HaiboFamScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuth();
  const { data: apiPosts = [] } = useCommunityPosts();
  const createPostMutation = useCreatePost();
  const likePostMutation = useLikePost();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  const loadData = useCallback(async () => {
    const liked = await getLikedPosts();
    setLikedPosts(liked);

    // Use API posts if available, fall back to local/mock
    if (apiPosts.length > 0) {
      setPosts(apiPosts.map((p: any) => ({
        id: p.id,
        authorName: p.userName || "Community Member",
        authorAvatar: p.userAvatar || undefined,
        content: p.caption || "",
        timestamp: p.createdAt || new Date().toISOString(),
        likes: p.likeCount || 0,
        comments: p.commentCount || 0,
        isVerified: false,
        category: p.category || "community",
      })));
    } else {
      const savedPosts = await getCommunityPosts();
      if (savedPosts.length === 0) {
        await saveCommunityPosts(MOCK_COMMUNITY_POSTS);
        setPosts(MOCK_COMMUNITY_POSTS);
      } else {
        setPosts(savedPosts);
      }
    }
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
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    const isNowLiked = await toggleLikePost(postId);
    setLikedPosts((prev) =>
      isNowLiked ? [...prev, postId] : prev.filter((id) => id !== postId)
    );
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? { ...post, likes: post.likes + (isNowLiked ? 1 : -1) }
          : post
      )
    );
    const updatedPosts = posts.map((post) =>
      post.id === postId
        ? { ...post, likes: post.likes + (isNowLiked ? 1 : -1) }
        : post
    );
    await saveCommunityPosts(updatedPosts);
  };

  const handlePost = async () => {
    if (newPostContent.trim().length === 0) return;

    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }

    const profile = await getUserProfile();
    const newPost: CommunityPost = {
      id: generateId(),
      userId: profile?.id || "guest",
      userName: profile?.name || "Anonymous User",
      userType: profile?.userType || "commuter",
      avatarType: profile?.avatarType || 0,
      content: newPostContent.trim(),
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

  const getUserTypeLabel = (userType: string) => {
    switch (userType) {
      case "driver":
        return "Driver";
      case "operator":
        return "Operator";
      default:
        return "Commuter";
    }
  };

  const renderPost = ({ item: post }: { item: CommunityPost }) => {
    const isLiked = likedPosts.includes(post.id);
    const avatarColor = AVATAR_COLORS[post.avatarType % AVATAR_COLORS.length];

    return (
      <View style={[styles.postCard, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.postHeader}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Feather
              name={post.userType === "driver" ? "truck" : post.userType === "operator" ? "briefcase" : "user"}
              size={18}
              color="#FFFFFF"
            />
          </View>
          <View style={styles.postUserInfo}>
            <View style={styles.userNameRow}>
              <ThemedText style={styles.userName}>{post.userName}</ThemedText>
              {post.userType !== "commuter" ? (
                <View style={[styles.userBadge, { backgroundColor: avatarColor + "20" }]}>
                  <ThemedText style={[styles.userBadgeText, { color: avatarColor }]}>
                    {getUserTypeLabel(post.userType)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatTime(post.createdAt)}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.postContent}>{post.content}</ThemedText>

        <View style={styles.postActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleLike(post.id)}
          >
            <Feather
              name="heart"
              size={20}
              color={isLiked ? BrandColors.primary.red : theme.textSecondary}
            />
            <ThemedText
              style={[
                styles.actionCount,
                { color: isLiked ? BrandColors.primary.red : theme.textSecondary },
              ]}
            >
              {post.likes}
            </ThemedText>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Feather name="message-circle" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.actionCount, { color: theme.textSecondary }]}>
              {post.comments}
            </ThemedText>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={async () => {
              try {
                await Share.share({
                  message: `${post.content}\n\nShared via Haibo App`,
                });
              } catch {}
            }}
          >
            <Feather name="share" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {isComposing ? (
        <View style={[styles.composeCard, { backgroundColor: theme.backgroundDefault }]}>
          <TextInput
            style={[styles.composeInput, { color: theme.text }]}
            placeholder="Share your experience..."
            placeholderTextColor={theme.textSecondary}
            value={newPostContent}
            onChangeText={setNewPostContent}
            multiline
            autoFocus
          />
          <View style={styles.composeActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setIsComposing(false);
                setNewPostContent("");
              }}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.postButton,
                {
                  backgroundColor:
                    newPostContent.trim().length > 0
                      ? BrandColors.primary.blue
                      : BrandColors.gray[400],
                },
              ]}
              onPress={handlePost}
              disabled={newPostContent.trim().length === 0}
            >
              <ThemedText style={{ color: "#FFFFFF", fontWeight: "600" }}>Post</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.composePrompt, { backgroundColor: theme.backgroundDefault }]}
          onPress={() => setIsComposing(true)}
        >
          <View style={[styles.promptAvatar, { backgroundColor: BrandColors.gray[400] }]}>
            <Feather name="user" size={16} color="#FFFFFF" />
          </View>
          <ThemedText style={{ color: theme.textSecondary }}>
            Share your experience...
          </ThemedText>
        </Pressable>
      )}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl + 80,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No posts yet. Be the first to share!
            </ThemedText>
          </View>
        }
      />

      {!isComposing ? (
        <Pressable
          style={[styles.fab, { bottom: insets.bottom + 100 }]}
          onPress={() => setIsComposing(true)}
        >
          <Feather name="plus" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  composeCard: {
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  composeInput: {
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  composeActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  postButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  composePrompt: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  promptAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  postCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  postUserInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  userName: {
    fontWeight: "600",
  },
  userBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  userBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  postActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  actionCount: {
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary.blue,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

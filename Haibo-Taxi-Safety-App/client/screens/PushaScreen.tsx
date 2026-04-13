import React, { useState, useCallback, useRef, memo, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  Platform,
  ViewToken,
  Share,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import phushaContentData from "@/data/phusha_content.json";

// typeui-clean polish on top of the existing reels feed:
//  - Bookmark active state switched from blue tint to rose tint (was
//    using BrandColors.primary.blue — wrong brand)
//  - Default reel gradient fallback switched from ["#1976D2","#42A5F5"]
//    (random blue) to BrandColors.gradient.primary (rose)
//  - Category tab active state uses a rose tinted background instead
//    of the generic rgba(255,255,255,0.2)
//  - Typography tokens used for category text + counts where reasonable
//
// The core reel UX (full-screen vertical scroll, double-tap heart,
// pulse animations, FAB) is kept intact — it was already brand-aligned.

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface PhushaPost {
  id: string;
  userId: string;
  userName: string;
  contentType: string;
  caption: string;
  hashtags: string[];
  locationName?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  isLiked: boolean;
  createdAt: string;
  category: string;
  localImage: string;
  gradient: string[];
}

const categories = [
  { id: "for_you", name: "For You", icon: "star" as const },
  { id: "safety_tips", name: "Safety", icon: "shield" as const },
  { id: "taxi_hacks", name: "Hacks", icon: "zap" as const },
  { id: "driver_stories", name: "Drivers", icon: "user" as const },
  { id: "route_reviews", name: "Routes", icon: "map-pin" as const },
];

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  safety_tips: "shield",
  taxi_hacks: "zap",
  driver_stories: "user",
  route_reviews: "map-pin",
  for_you: "star",
};

const formatCount = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
};

const formatTimeAgo = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays > 7) return `${Math.floor(diffDays / 7)}w`;
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  return "now";
};

// ─── Animated Reel Card ──────────────────────────────────────────────────────

const PhushaCard = memo(function PhushaCard({
  post,
  isActive,
  onLike,
  onComment,
  onShare,
  onBookmark,
}: {
  post: PhushaPost;
  isActive: boolean;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
  onShare: (id: string) => void;
  onBookmark: (id: string) => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const likeScale = useSharedValue(1);
  const heartOpacity = useSharedValue(0);
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [bookmarked, setBookmarked] = useState(false);

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      setLikeCount((c) => c + 1);
    }
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 500 }),
      withTiming(0, { duration: 300 })
    );
    likeScale.value = withSequence(
      withSpring(1.4, { damping: 4 }),
      withSpring(1, { damping: 8 })
    );
    onLike(post.id);
  };

  const handleLikePress = () => {
    setLiked((prev) => !prev);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    likeScale.value = withSequence(
      withSpring(1.3, { damping: 5 }),
      withSpring(1, { damping: 10 })
    );
    onLike(post.id);
  };

  const handleBookmark = () => {
    setBookmarked((prev) => !prev);
    onBookmark(post.id);
  };

  const animatedLikeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const animatedHeartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartOpacity.value * 1.5 + 0.5 }],
  }));

  const gradientColors = (post.gradient ||
    BrandColors.gradient.primary) as [string, string, ...string[]];
  const categoryIcon = CATEGORY_ICONS[post.category] || "star";

  return (
    <View style={[styles.reelContainer, { height: SCREEN_HEIGHT }]}>
      <Pressable style={styles.mediaContainer} onPress={handleDoubleTap}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Large Category Icon Background */}
        <View style={styles.bgIconContainer}>
          <Feather name={categoryIcon} size={200} color="rgba(255,255,255,0.06)" />
        </View>

        {/* Category Badge */}
        <View style={[styles.categoryBadge, { top: insets.top + 70 }]}>
          <View style={styles.categoryBadgeInner}>
            <Feather name={categoryIcon} size={14} color="#FFFFFF" />
            <ThemedText style={styles.categoryBadgeText}>
              {post.category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            </ThemedText>
          </View>
        </View>

        {/* Main Content Card */}
        <View style={styles.contentCard}>
          <View style={styles.contentCardInner}>
            <ThemedText style={styles.captionLarge} numberOfLines={8}>
              {post.caption}
            </ThemedText>
          </View>
        </View>

        {/* Double-tap heart */}
        <Animated.View style={[styles.doubleTapHeart, animatedHeartStyle]}>
          <Feather name="heart" size={100} color="#FFFFFF" />
        </Animated.View>
      </Pressable>

      {/* Bottom Overlay */}
      <View style={[styles.overlay, { paddingBottom: insets.bottom + 110 }]}>
        {/* User Info & Hashtags */}
        <View style={styles.contentInfo}>
          <View style={styles.userInfo}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
              <Feather name="user" size={18} color="#FFFFFF" />
            </View>
            <View>
              <ThemedText style={styles.userName}>@{post.userName}</ThemedText>
              <ThemedText style={styles.timeAgo}>{formatTimeAgo(post.createdAt)}</ThemedText>
            </View>
          </View>

          {post.hashtags.length > 0 ? (
            <View style={styles.hashtagsContainer}>
              {post.hashtags.slice(0, 3).map((tag, idx) => (
                <ThemedText key={idx} style={styles.hashtag}>
                  {tag}
                </ThemedText>
              ))}
            </View>
          ) : null}

          {post.locationName ? (
            <View style={styles.locationTag}>
              <Feather name="map-pin" size={12} color="rgba(255,255,255,0.8)" />
              <ThemedText style={styles.locationText}>{post.locationName}</ThemedText>
            </View>
          ) : null}

          {/* View count */}
          <View style={styles.viewCount}>
            <Feather name="eye" size={12} color="rgba(255,255,255,0.6)" />
            <ThemedText style={styles.viewCountText}>{formatCount(post.viewCount)} views</ThemedText>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Animated.View style={animatedLikeStyle}>
            <Pressable style={styles.actionButton} onPress={handleLikePress}>
              <View
                style={[
                  styles.actionIconBg,
                  liked
                    ? { backgroundColor: BrandColors.primary.gradientStart + "4D" }
                    : null,
                ]}
              >
                <Feather
                  name="heart"
                  size={24}
                  color={liked ? BrandColors.primary.gradientStart : "#FFFFFF"}
                />
              </View>
              <ThemedText style={styles.actionCount}>{formatCount(likeCount)}</ThemedText>
            </Pressable>
          </Animated.View>

          <Pressable style={styles.actionButton} onPress={() => onComment(post.id)}>
            <View style={styles.actionIconBg}>
              <Feather name="message-circle" size={24} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.actionCount}>{formatCount(post.commentCount)}</ThemedText>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={() => onShare(post.id)}>
            <View style={styles.actionIconBg}>
              <Feather name="send" size={22} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.actionCount}>{formatCount(post.shareCount)}</ThemedText>
          </Pressable>

          <Pressable style={styles.actionButton} onPress={handleBookmark}>
            <View
              style={[
                styles.actionIconBg,
                bookmarked
                  ? { backgroundColor: BrandColors.primary.gradientStart + "4D" }
                  : null,
              ]}
            >
              <Feather
                name="bookmark"
                size={22}
                color={bookmarked ? BrandColors.primary.gradientStart : "#FFFFFF"}
              />
            </View>
          </Pressable>

          <Pressable style={styles.actionButton}>
            <View style={styles.actionIconBg}>
              <Feather name="more-horizontal" size={22} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PushaScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [activeCategory, setActiveCategory] = useState("for_you");
  const [activeIndex, setActiveIndex] = useState(0);

  const allPosts: PhushaPost[] = phushaContentData as PhushaPost[];

  const filteredPosts =
    activeCategory === "for_you"
      ? allPosts
      : allPosts.filter((p) => p.category === activeCategory);

  const handleLike = (id: string) => {
    if (Platform.OS !== "web") {
      import("expo-haptics")
        .then((Haptics) => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
        .catch(() => {});
    }
  };

  const handleComment = (id: string) => {
    if (Platform.OS !== "web") {
      import("expo-haptics")
        .then((Haptics) => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))
        .catch(() => {});
    }
    Alert.alert("Comments", "Comments feature coming soon! Stay tuned.");
  };

  const handleShare = async (id: string) => {
    if (Platform.OS !== "web") {
      import("expo-haptics")
        .then((Haptics) => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
        .catch(() => {});
    }
    const post = allPosts.find((p) => p.id === id);
    if (!post) return;
    try {
      await Share.share({
        message: `${post.caption}\n\n${post.hashtags.join(" ")}\n\nShared via Haibo App`,
      });
    } catch {}
  };

  const handleBookmark = (id: string) => {
    if (Platform.OS !== "web") {
      import("expo-haptics")
        .then((Haptics) => Haptics.selectionAsync())
        .catch(() => {});
    }
  };

  const handleCreateReel = () => {
    if (Platform.OS !== "web") {
      import("expo-haptics")
        .then((Haptics) => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium))
        .catch(() => {});
    }
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("CreateReel" as never);
    } else {
      navigation.navigate("CreateReel" as never);
    }
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = { itemVisiblePercentThreshold: 80 };

  const renderItem = useCallback(
    ({ item, index }: { item: PhushaPost; index: number }) => (
      <PhushaCard
        post={item}
        isActive={index === activeIndex}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onBookmark={handleBookmark}
      />
    ),
    [activeIndex]
  );

  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      {/* Category Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.categoryTabs}>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.categoryTab, activeCategory === cat.id ? styles.categoryTabActive : null]}
              onPress={() => {
                setActiveCategory(cat.id);
                if (Platform.OS !== "web") {
                  import("expo-haptics")
                    .then((H) => H.selectionAsync())
                    .catch(() => {});
                }
              }}
            >
              <Feather
                name={cat.icon}
                size={14}
                color={activeCategory === cat.id ? "#FFFFFF" : "rgba(255,255,255,0.5)"}
                style={{ marginRight: 4 }}
              />
              <ThemedText
                style={[styles.categoryText, activeCategory === cat.id ? styles.categoryTextActive : null]}
              >
                {cat.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content Feed */}
      <FlatList
        data={filteredPosts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={3}
        initialNumToRender={2}
      />

      {/* Progress Dots */}
      <View style={[styles.progressDots, { bottom: insets.bottom + 100 }]}>
        {filteredPosts.slice(0, 5).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.dot,
              idx === activeIndex % 5 ? styles.dotActive : null,
            ]}
          />
        ))}
      </View>

      {/* Create FAB */}
      <Pressable style={[styles.fab, { bottom: insets.bottom + 100 }]} onPress={handleCreateReel}>
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fabGradient}
        >
          <Feather name="plus" size={26} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    zIndex: 100,
  },
  categoryTabs: {
    flexDirection: "row",
    gap: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
  },
  categoryTabActive: {
    backgroundColor: BrandColors.primary.gradientStart,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  categoryText: {
    ...Typography.label,
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  categoryTextActive: {
    color: "#FFFFFF",
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    position: "relative",
  },
  mediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bgIconContainer: {
    position: "absolute",
    top: "25%",
    alignSelf: "center",
    opacity: 1,
  },
  categoryBadge: {
    position: "absolute",
    left: Spacing.lg,
  },
  categoryBadgeInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  categoryBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  contentCard: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl + 60,
    top: "30%",
  },
  contentCardInner: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  captionLarge: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 28,
    letterSpacing: 0.3,
  },
  doubleTapHeart: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -50,
    marginTop: -50,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
  },
  contentInfo: {
    flex: 1,
    paddingRight: Spacing.lg,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  userName: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  timeAgo: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    marginTop: 1,
  },
  hashtagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  hashtag: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  locationTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  locationText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
  },
  viewCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  viewCountText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  actions: {
    alignItems: "center",
    gap: Spacing.md,
  },
  actionButton: {
    alignItems: "center",
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCount: {
    color: "#FFFFFF",
    fontSize: 11,
    marginTop: 3,
    fontWeight: "500",
  },
  progressDots: {
    position: "absolute",
    left: Spacing.lg,
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
    width: 18,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});

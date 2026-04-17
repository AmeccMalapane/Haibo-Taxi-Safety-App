import React from "react";
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/hooks/useLanguage";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteParams = RouteProp<RootStackParamList, "HashtagFeed">;

interface ReelPost {
  id: string;
  userName: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  category: string;
}

export default function HashtagFeedScreen() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const tag = route.params.tag.replace(/^#/, "").toLowerCase();

  const feedQ = useQuery({
    queryKey: ["/api/community/hashtags", tag],
    queryFn: () => apiRequest("GET", `/api/community/hashtags/${encodeURIComponent(tag)}/posts?limit=50`),
  });

  const posts: ReelPost[] = feedQ.data?.data ?? [];

  const formatTime = (d: string) => {
    const ms = Date.now() - new Date(d).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(ms / 3600000);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(ms / 86400000)}d`;
  };

  const renderPost = ({ item }: { item: ReelPost }) => (
    <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
      {item.thumbnailUrl || item.mediaUrl ? (
        <Image
          source={{ uri: item.thumbnailUrl || item.mediaUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <ThemedText style={styles.userName}>@{item.userName}</ThemedText>
          <ThemedText style={[styles.timeAgo, { color: theme.textSecondary }]}>
            {formatTime(item.createdAt)}
          </ThemedText>
        </View>
        {item.caption ? (
          <ThemedText style={styles.caption} numberOfLines={3}>
            {item.caption}
          </ThemedText>
        ) : null}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Feather name="heart" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
              {item.likeCount}
            </ThemedText>
          </View>
          <View style={styles.stat}>
            <Feather name="message-circle" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
              {item.commentCount}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <ThemedText style={styles.tagTitle}>#{tag}</ThemedText>
          <ThemedText style={[styles.postCount, { color: theme.textSecondary }]}>
            {String(t("hashtag.posts", { count: feedQ.data?.total ?? "..." }))}
          </ThemedText>
        </View>
      </View>

      {feedQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BrandColors.primary.red} />
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.xl }]}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="hash" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                {String(t("hashtag.empty", { tag }))}
              </ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  backButton: { padding: Spacing.xs, marginRight: Spacing.md },
  headerTitle: { flex: 1 },
  tagTitle: { fontSize: 22, fontWeight: "700" },
  postCount: { fontSize: 13, marginTop: 2 },
  list: { padding: Spacing.md },
  card: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  thumbnail: { width: "100%", height: 180 },
  cardBody: { padding: Spacing.md },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  userName: { fontSize: 13, fontWeight: "700" },
  timeAgo: { fontSize: 12 },
  caption: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
  stats: { flexDirection: "row", gap: Spacing.lg },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: { fontSize: 14, marginTop: Spacing.md },
});

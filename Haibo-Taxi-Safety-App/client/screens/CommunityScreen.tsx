import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import CommunityTray from "@/components/CommunityTray";
import NewPostModal from "@/components/NewPostModal";
import HighlightsCarousel from "@/components/HighlightsCarousel";

type TileConfig = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  screen: keyof RootStackParamList;
};

const communityTiles: TileConfig[] = [
  {
    id: "community_routes",
    title: "Community Routes",
    subtitle: "Draw, share & vote on routes",
    icon: "map",
    color: BrandColors.primary.red,
    screen: "CommunityRoutes",
  },
  {
    id: "lost_found",
    title: "Lost & Found",
    subtitle: "Report or find lost items",
    icon: "search",
    color: BrandColors.secondary.orange,
    screen: "LostFound",
  },
  {
    id: "haibo_fam",
    title: "Haibo Fam",
    subtitle: "Connect with commuters",
    icon: "users",
    color: BrandColors.primary.blue,
    screen: "HaiboFam",
  },
  {
    id: "directions",
    title: "Directions",
    subtitle: "Ask about routes & fares",
    icon: "message-circle",
    color: BrandColors.primary.green,
    screen: "QAForum",
  },
  {
    id: "group_rides",
    title: "Group Rides",
    subtitle: "Organize shared transport",
    icon: "truck",
    color: BrandColors.primary.blueDark,
    screen: "GroupRides",
  },
];

function CommunityTile({ tile, onPress }: { tile: TileConfig; onPress: () => void }) {
  const { theme, isDark } = useTheme();

  const handlePress = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onPress();
  };

  return (
    <Pressable
      style={[
        styles.tile,
        {
          backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF",
          borderColor: theme.border,
        },
      ]}
      onPress={handlePress}
    >
      <View style={[styles.iconContainer, { backgroundColor: tile.color + "20" }]}>
        <Feather name={tile.icon} size={28} color={tile.color} />
      </View>
      <ThemedText style={styles.tileTitle}>{tile.title}</ThemedText>
      <ThemedText type="small" style={[styles.tileSubtitle, { color: theme.textSecondary }]}>
        {tile.subtitle}
      </ThemedText>
    </Pressable>
  );
}

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [isCommunityTrayVisible, setIsCommunityTrayVisible] = useState(false);
  const [isNewPostModalVisible, setIsNewPostModalVisible] = useState(false);

  const handleTilePress = (screen: keyof RootStackParamList) => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate(screen as never);
    } else {
      navigation.navigate(screen as never);
    }
  };

  const handleOpenTray = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    setIsCommunityTrayVisible(true);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="h1" style={styles.headerTitle}>
            Community
          </ThemedText>
          <ThemedText type="body" style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Connect, share, and help each other
          </ThemedText>
        </View>

        {/* ─── Floating Highlights Slideshow ─────────────────────────────── */}
        <HighlightsCarousel />

        {/* ─── Community Tiles Grid ──────────────────────────────────────── */}
        <View style={styles.tilesGrid}>
          {communityTiles.map((tile) => (
            <CommunityTile
              key={tile.id}
              tile={tile}
              onPress={() => handleTilePress(tile.screen)}
            />
          ))}
        </View>

        {/* Community Feed Card */}
        <Pressable
          style={[
            styles.feedCard,
            {
              backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF",
              borderColor: theme.border,
            },
          ]}
          onPress={handleOpenTray}
        >
          <View style={[styles.feedIconContainer, { backgroundColor: BrandColors.primary.blue + "20" }]}>
            <Feather name="message-square" size={24} color={BrandColors.primary.blue} />
          </View>
          <View style={styles.feedCardContent}>
            <ThemedText style={styles.feedCardTitle}>Community Feed</ThemedText>
            <ThemedText type="small" style={[styles.feedCardSubtitle, { color: theme.textSecondary }]}>
              View live updates, events & discussions
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        {/* Safety Directory Quick Link */}
        <Pressable
          style={[
            styles.feedCard,
            {
              backgroundColor: isDark ? theme.backgroundSecondary : "#FFFFFF",
              borderColor: theme.border,
            },
          ]}
          onPress={() => handleTilePress("SafetyDirectory")}
        >
          <View style={[styles.feedIconContainer, { backgroundColor: BrandColors.primary.red + "20" }]}>
            <Feather name="phone-call" size={24} color={BrandColors.primary.red} />
          </View>
          <View style={styles.feedCardContent}>
            <ThemedText style={styles.feedCardTitle}>Safety Directory</ThemedText>
            <ThemedText type="small" style={[styles.feedCardSubtitle, { color: theme.textSecondary }]}>
              Emergency contacts & helplines
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={[styles.infoCardInner, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={20} color={BrandColors.primary.blue} />
            <View style={styles.infoCardContent}>
              <ThemedText style={styles.infoCardTitle}>Stay Safe, Stay Connected</ThemedText>
              <ThemedText type="small" style={[styles.infoCardText, { color: theme.textSecondary }]}>
                Our community is moderated to ensure a safe space for all taxi commuters.
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Post Button */}
      <Pressable
        style={[styles.postButton, { bottom: tabBarHeight + Spacing.xl }]}
        onPress={() => setIsNewPostModalVisible(true)}
        accessibilityLabel="Create new post"
        accessibilityRole="button"
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.postButtonGradient}
        >
          <Feather name="plus" size={28} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {/* Community Tray Modal */}
      <CommunityTray
        visible={isCommunityTrayVisible}
        onClose={() => setIsCommunityTrayVisible(false)}
      />

      {/* New Post Modal */}
      <NewPostModal
        visible={isNewPostModalVisible}
        onClose={() => setIsNewPostModalVisible(false)}
        onSubmit={(content, mediaType) => {
          console.log("New post:", content, mediaType);
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 0,
  },
  header: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: Spacing.xs,
  },
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  tile: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    minHeight: 140,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  tileSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  infoCard: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  infoCardInner: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  infoCardText: {
    fontSize: 12,
    lineHeight: 18,
  },
  feedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  feedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  feedCardContent: {
    flex: 1,
  },
  feedCardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  feedCardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  postButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    shadowColor: BrandColors.primary.gradientEnd,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 50,
  },
  postButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

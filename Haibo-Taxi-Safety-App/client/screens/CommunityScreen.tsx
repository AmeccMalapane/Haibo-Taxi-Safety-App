import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import CommunityTray from "@/components/CommunityTray";
import NewPostModal from "@/components/NewPostModal";
import HighlightsCarousel from "@/components/HighlightsCarousel";

// typeui-clean rework — Community as a calm hub of social tiles + a
// floating-CTA post button. Was orphaned in the root nav until commit
// 5b03fd4; now reachable as the 4th tab.
//
// Drops the old useHeaderHeight() call (the screen was assuming a
// header that doesn't exist in the new tab-direct setup) and the
// 5-color tile rainbow that read as visual chaos. Single rose tint
// across all tiles + Typography tokens throughout.

type TileConfig = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  screen: keyof RootStackParamList;
  /** Gradient pair used for the tile icon backplate + hover glow. Each
   *  category gets its own hue so the grid reads as playful, not monotone. */
  gradient: [string, string];
  /** Icon fill color. Defaults to white for dark gradients (rose, teal,
   *  fuchsia, sky). Switch to dark (#0C121A) on yellow/lime tiles — those
   *  backgrounds are too luminous for white icons (fail WCAG 1.4.11 3:1
   *  contrast). Warning-sign convention: dark glyphs on bright chips. */
  iconColor?: string;
};

const communityTiles: TileConfig[] = [
  {
    id: "pasop",
    title: "Pasop",
    subtitle: "Live hazard reports near you",
    icon: "alert-triangle",
    screen: "PasopFeed",
    gradient: [BrandColors.status.emergency, BrandColors.primary.orange],
  },
  {
    id: "community_routes",
    title: "Community routes",
    subtitle: "Draw, share & vote on routes",
    icon: "map",
    screen: "CommunityRoutes",
    gradient: [BrandColors.accent.sky, BrandColors.accent.skyLight],
  },
  {
    id: "lost_found",
    title: "Lost & found",
    subtitle: "Report or claim items",
    icon: "search",
    screen: "LostFound",
    gradient: [BrandColors.accent.yellow, BrandColors.accent.yellowLight],
    iconColor: "#0C121A",
  },
  {
    id: "haibo_fam",
    title: "Haibo Fam",
    subtitle: "Connect with commuters",
    icon: "users",
    screen: "HaiboFam",
    gradient: BrandColors.gradient.primary as [string, string],
  },
  {
    id: "directions",
    title: "Get directions",
    subtitle: "Ask the crew how to get there",
    icon: "message-circle",
    screen: "QAForum",
    gradient: [BrandColors.secondary.purple, BrandColors.accent.fuchsiaLight],
  },
  {
    id: "group_rides",
    title: "Group rides",
    subtitle: "Organise shared trips",
    icon: "truck",
    screen: "GroupRides",
    gradient: [BrandColors.accent.teal, BrandColors.accent.tealLight],
  },
  {
    id: "events",
    title: "Events",
    subtitle: "Industry meetups & launches",
    icon: "calendar",
    screen: "Events",
    gradient: [BrandColors.accent.lime, BrandColors.accent.limeLight],
    iconColor: "#0C121A",
  },
];

function CommunityTile({
  tile,
  onPress,
  index,
}: {
  tile: TileConfig;
  onPress: () => void;
  index: number;
}) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();

  const handlePress = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onPress();
  };

  const [gradStart] = tile.gradient;

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(150 + index * 60)}
      style={styles.tileWrap}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: theme.surface,
            borderColor: gradStart + "33",
            shadowColor: gradStart,
          },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={tile.title}
      >
        <LinearGradient
          colors={tile.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tileIcon}
        >
          <Feather name={tile.icon} size={22} color={tile.iconColor || "#FFFFFF"} />
        </LinearGradient>
        <ThemedText style={styles.tileTitle} numberOfLines={1}>
          {tile.title}
        </ThemedText>
        <ThemedText
          style={[styles.tileSubtitle, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {tile.subtitle}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

export default function CommunityScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
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

  const handleNewPost = async () => {
    if (Platform.OS !== "web") {
      try {
        const Haptics = await import("expo-haptics");
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }
    setIsNewPostModalVisible(true);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing["3xl"] + 80,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(400)} style={styles.header}>
          <ThemedText
            style={[styles.eyebrow, { color: theme.textSecondary }]}
          >
            HAIBO COMMUNITY
          </ThemedText>
          <ThemedText style={styles.headerTitle}>The Mzansi crew</ThemedText>
          <ThemedText
            style={[styles.headerSubtitle, { color: theme.textSecondary }]}
          >
            Connect, share, and look out for each other on the road.
          </ThemedText>
        </Animated.View>

        {/* Highlights carousel */}
        <Animated.View entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(100)}>
          <HighlightsCarousel />
        </Animated.View>

        {/* Tile grid */}
        <View style={styles.tilesGrid}>
          {communityTiles.map((tile, index) => (
            <CommunityTile
              key={tile.id}
              tile={tile}
              index={index}
              onPress={() => handleTilePress(tile.screen)}
            />
          ))}
        </View>

        {/* Community Feed quick link */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(450)}
          style={styles.feedSection}
        >
          <ThemedText
            style={[styles.sectionLabel, { color: theme.textSecondary }]}
          >
            JUMP IN
          </ThemedText>

          <Pressable
            onPress={handleOpenTray}
            style={({ pressed }) => [
              styles.feedCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open community feed"
          >
            <LinearGradient
              colors={[BrandColors.accent.fuchsia, BrandColors.accent.fuchsiaLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.feedIcon}
            >
              <Feather name="message-square" size={18} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.feedContent}>
              <ThemedText style={styles.feedTitle}>Live feed</ThemedText>
              <ThemedText
                style={[styles.feedSubtitle, { color: theme.textSecondary }]}
              >
                Updates, events and discussions in real time
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>

          <Pressable
            onPress={() => handleTilePress("SafetyDirectory")}
            style={({ pressed }) => [
              styles.feedCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open safety directory"
          >
            <LinearGradient
              colors={[BrandColors.status.emergency, BrandColors.primary.orange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.feedIcon}
            >
              <Feather name="phone-call" size={18} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.feedContent}>
              <ThemedText style={styles.feedTitle}>Safety directory</ThemedText>
              <ThemedText
                style={[styles.feedSubtitle, { color: theme.textSecondary }]}
              >
                Hotlines, helplines and emergency contacts
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>

        {/* Info card — subtle teal accent for a calm, trust-signal tone */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(550)}
          style={[
            styles.infoCard,
            {
              backgroundColor: BrandColors.accent.teal + "0D",
              borderColor: BrandColors.accent.teal + "33",
            },
          ]}
        >
          <View style={styles.infoCardIcon}>
            <Feather name="shield" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.infoCardContent}>
            <ThemedText style={styles.infoCardTitle}>
              Stay safe, stay connected
            </ThemedText>
            <ThemedText
              style={[styles.infoCardText, { color: theme.textSecondary }]}
            >
              The community is moderated to keep Haibo a safe space for every
              South African commuter.
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Floating "+" post button */}
      <Pressable
        style={[styles.postButton, { bottom: tabBarHeight + Spacing.xl + 8 }]}
        onPress={handleNewPost}
        accessibilityLabel="Create new post"
        accessibilityRole="button"
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.postButtonGradient}
        >
          <Feather name="plus" size={26} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {/* Modals */}
      <CommunityTray
        visible={isCommunityTrayVisible}
        onClose={() => setIsCommunityTrayVisible(false)}
      />
      <NewPostModal
        visible={isNewPostModalVisible}
        onClose={() => setIsNewPostModalVisible(false)}
        onSubmit={(content, mediaType) => {
          console.log("New post:", content, mediaType);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },

  // Header
  header: {
    marginBottom: Spacing.xl,
  },
  eyebrow: {
    ...Typography.label,
    letterSpacing: 1.6,
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h1,
    marginBottom: 2,
  },
  headerSubtitle: {
    ...Typography.body,
  },

  // Tiles
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
  },
  tileWrap: {
    width: "48%",
    marginBottom: Spacing.md,
  },
  tile: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    minHeight: 130,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  tileTitle: {
    ...Typography.body,
    fontWeight: "700",
    marginBottom: 2,
  },
  tileSubtitle: {
    ...Typography.small,
    fontSize: 12,
  },

  // Feed section — `xl` separator keeps a clear rhythm between the tile
  // grid, the jump-in cards, and the info card below.
  feedSection: {
    marginTop: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  feedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  feedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 3,
  },
  feedContent: {
    flex: 1,
  },
  feedTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  feedSubtitle: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },

  // Info card
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  infoCardIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: BrandColors.accent.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCardContent: {
    flex: 1,
  },
  infoCardTitle: {
    ...Typography.body,
    fontWeight: "700",
    marginBottom: 2,
  },
  infoCardText: {
    ...Typography.small,
    fontSize: 12,
  },

  // Floating CTA
  postButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 50,
  },
  postButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

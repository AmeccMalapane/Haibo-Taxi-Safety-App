import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Share,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MAPBOX_STYLES } from "@/constants/mapbox";
import { createRouteLink, getAppStoreLink } from "@/lib/deepLinks";
import {
  CommunityRoute,
  RouteComment,
  getCommunityRoutes,
  saveCommunityRoute,
  getMyVotes,
  saveVote,
  getMyStars,
  toggleStar,
  getRouteComments,
  addRouteComment,
  getContributorProfile,
  HAND_SIGNALS,
  BADGE_CONFIG,
  getBadge,
  generateId,
} from "@/data/communityRoutes";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAP_HEIGHT = 300;

export default function CommunityRouteDetailScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const routeParams = useRoute<any>();
  const routeId = routeParams.params?.routeId;

  const [route, setRoute] = useState<CommunityRoute | null>(null);
  const [comments, setComments] = useState<RouteComment[]>([]);
  const [myVote, setMyVote] = useState<"up" | "down" | null>(null);
  const [isStarred, setIsStarred] = useState(false);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    loadRoute();
  }, [routeId]);

  const loadRoute = async () => {
    const routes = await getCommunityRoutes();
    const found = routes.find((r) => r.id === routeId);
    if (found) setRoute(found);

    const votes = await getMyVotes();
    setMyVote(votes[routeId] || null);

    const stars = await getMyStars();
    setIsStarred(stars.includes(routeId));

    const cmts = await getRouteComments(routeId);
    setComments(cmts);
  };

  const handleVote = useCallback(
    async (vote: "up" | "down") => {
      if (!route) return;
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const updated = { ...route };
      if (myVote === vote) {
        if (vote === "up") updated.upvotes = Math.max(0, updated.upvotes - 1);
        else updated.downvotes = Math.max(0, updated.downvotes - 1);
        setMyVote(null);
        await saveVote(routeId, null);
      } else {
        if (myVote === "up") updated.upvotes = Math.max(0, updated.upvotes - 1);
        if (myVote === "down") updated.downvotes = Math.max(0, updated.downvotes - 1);
        if (vote === "up") updated.upvotes += 1;
        else updated.downvotes += 1;
        setMyVote(vote);
        await saveVote(routeId, vote);
      }
      updated.updatedAt = Date.now();
      setRoute(updated);
      await saveCommunityRoute(updated);
    },
    [route, myVote, routeId]
  );

  const handleStar = useCallback(async () => {
    if (!route) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const starred = await toggleStar(routeId);
    setIsStarred(starred);
    const updated = {
      ...route,
      stars: starred ? route.stars + 1 : Math.max(0, route.stars - 1),
    };
    setRoute(updated);
    await saveCommunityRoute(updated);
  }, [route, routeId]);

  const handleAddComment = useCallback(async () => {
    if (!newComment.trim() || !route) return;
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    const profile = await getContributorProfile();
    const comment: RouteComment = {
      id: generateId(),
      routeId: route.id,
      userId: profile.id,
      userName: profile.name,
      text: newComment.trim(),
      createdAt: Date.now(),
    };
    await addRouteComment(comment);
    setComments((prev) => [comment, ...prev]);
    setNewComment("");

    const updated = { ...route, commentCount: route.commentCount + 1 };
    setRoute(updated);
    await saveCommunityRoute(updated);
  }, [newComment, route]);

  const handleShare = useCallback(async () => {
    if (!route) return;
    try {
      const stops = route.waypoints.filter((w) => w.isStop);
      const origin = stops[0]?.name || "Unknown";
      const dest = stops[stops.length - 1]?.name || "Unknown";
      const openLink = createRouteLink(route.id);
      await Share.share({
        message: `Check out this taxi route on Haibo!\n\n${route.name}\n${origin} → ${dest}\nR${route.fare} · ${route.upvotes} upvotes\n\nOpen in Haibo: ${openLink}\nGet the app: ${getAppStoreLink()}`,
        title: `${route.name} · Haibo route`,
      });
    } catch {}
  }, [route]);

  const handleReport = useCallback(() => {
    Alert.alert("Report route", "Why are you reporting this route?", [
      {
        text: "Inaccurate info",
        onPress: () => Alert.alert("Reported", "Thank you. We'll review this route."),
      },
      {
        text: "Spam or fake",
        onPress: () => Alert.alert("Reported", "Thank you. We'll review this route."),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, []);

  if (!route) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText style={styles.loadingText}>Loading route...</ThemedText>
      </ThemedView>
    );
  }

  const stops = route.waypoints.filter((w) => w.isStop);
  const netVotes = route.upvotes - route.downvotes;
  const handSignal = HAND_SIGNALS.find((hs) => hs.id === route.handSignal);
  const badge = getBadge(route.points);
  const badgeConfig = BADGE_CONFIG[badge];

  const routeLineGeoJSON = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: route.waypoints.map((w) => [w.longitude, w.latitude]),
        },
      },
    ],
  };

  const stopsGeoJSON = {
    type: "FeatureCollection" as const,
    features: stops.map((s) => ({
      type: "Feature" as const,
      properties: { name: s.name, order: s.order },
      geometry: {
        type: "Point" as const,
        coordinates: [s.longitude, s.latitude],
      },
    })),
  };

  const lngs = route.waypoints.map((w) => w.longitude);
  const lats = route.waypoints.map((w) => w.latitude);
  const bounds = {
    ne: [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01] as [number, number],
    sw: [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01] as [number, number],
  };

  const renderNativeMap = () => {
    try {
      const Mapbox = require("@rnmapbox/maps");
      const { MapView, Camera, ShapeSource, CircleLayer, SymbolLayer, LineLayer } = Mapbox;

      return (
        <MapView
          style={{ width: SCREEN_WIDTH, height: MAP_HEIGHT }}
          styleURL={isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light}
          scrollEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          scaleBarEnabled={false}
        >
          <Camera
            defaultSettings={{
              bounds,
              padding: { paddingTop: 60, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 },
            }}
          />
          <ShapeSource id="route-line" shape={routeLineGeoJSON}>
            <LineLayer
              id="route-line-layer"
              style={{
                lineColor: route.color,
                lineWidth: 5,
                lineOpacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </ShapeSource>
          <ShapeSource id="stops" shape={stopsGeoJSON}>
            <CircleLayer
              id="stop-circles"
              style={{
                circleRadius: 8,
                circleColor: route.color,
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 3,
              }}
            />
            <SymbolLayer
              id="stop-labels"
              style={{
                textField: ["get", "name"],
                textSize: 11,
                textColor: isDark ? "#FFFFFF" : "#212121",
                textHaloColor: isDark ? "#000000" : "#FFFFFF",
                textHaloWidth: 1.5,
                textOffset: [0, 1.5],
                textAnchor: "top",
                textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
              }}
            />
          </ShapeSource>
        </MapView>
      );
    } catch {
      return (
        <View
          style={[
            styles.mapPlaceholder,
            { backgroundColor: isDark ? "#1a1a2e" : BrandColors.gray[100] },
          ]}
        >
          <Feather name="map" size={32} color={BrandColors.gray[600]} />
          <ThemedText style={styles.mapPlaceholderText}>Map preview</ThemedText>
        </View>
      );
    }
  };

  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapContainer}>
          {Platform.OS === "web" ? (
            <View
              style={[
                styles.mapPlaceholder,
                { backgroundColor: isDark ? "#1a1a2e" : BrandColors.gray[100] },
              ]}
            >
              <Feather name="map" size={32} color={BrandColors.gray[600]} />
            </View>
          ) : (
            renderNativeMap()
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
            style={[styles.topBarGradient, { paddingTop: insets.top + Spacing.sm }]}
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.glassButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    route.status === "verified"
                      ? BrandColors.status.success
                      : route.status === "pending"
                      ? BrandColors.status.warning
                      : BrandColors.status.emergency,
                },
              ]}
            >
              <Feather
                name={route.status === "verified" ? "check-circle" : "clock"}
                size={12}
                color="#FFFFFF"
              />
              <ThemedText style={styles.statusText}>
                {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
              </ThemedText>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.routeTitle}>{route.name}</ThemedText>
                <ThemedText style={styles.routeSubtitle}>
                  {route.province} · {route.routeType} · {route.vehicleType}
                </ThemedText>
              </View>
              <View style={[styles.voteColumn, { backgroundColor: cardSurface }]}>
                <Pressable
                  style={[
                    styles.voteBtn,
                    myVote === "up" && {
                      backgroundColor: `${BrandColors.status.success}1A`,
                    },
                  ]}
                  onPress={() => handleVote("up")}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel="Upvote route"
                >
                  <Feather
                    name="arrow-up"
                    size={18}
                    color={
                      myVote === "up" ? BrandColors.status.success : BrandColors.gray[600]
                    }
                  />
                </Pressable>
                <ThemedText
                  style={[
                    styles.voteNumber,
                    {
                      color:
                        netVotes > 0
                          ? BrandColors.status.success
                          : netVotes < 0
                          ? BrandColors.status.emergency
                          : BrandColors.gray[500],
                    },
                  ]}
                >
                  {netVotes}
                </ThemedText>
                <Pressable
                  style={[
                    styles.voteBtn,
                    myVote === "down" && {
                      backgroundColor: `${BrandColors.status.emergency}1A`,
                    },
                  ]}
                  onPress={() => handleVote("down")}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel="Downvote route"
                >
                  <Feather
                    name="arrow-down"
                    size={18}
                    color={
                      myVote === "down"
                        ? BrandColors.status.emergency
                        : BrandColors.gray[600]
                    }
                  />
                </Pressable>
              </View>
            </View>

            {route.description ? (
              <ThemedText style={styles.description}>{route.description}</ThemedText>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(400)}
            style={styles.statsRow}
          >
            <View style={[styles.statCard, { backgroundColor: cardSurface }]}>
              <ThemedText style={[styles.statValue, { color: route.color }]}>
                R{route.fare}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Fare</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardSurface }]}>
              <ThemedText style={[styles.statValue, { color: route.color }]}>
                {stops.length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Stops</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardSurface }]}>
              <ThemedText style={[styles.statValue, { color: route.color }]}>
                {route.stars}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Stars</ThemedText>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardSurface }]}>
              <ThemedText style={[styles.statValue, { color: route.color }]}>
                {route.upvotes}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Votes</ThemedText>
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(120).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Stops</ThemedText>
            <View style={[styles.stopsCard, { backgroundColor: cardSurface }]}>
              {stops.map((stop, i) => (
                <View key={stop.id} style={styles.stopItem}>
                  <View style={styles.stopTimeline}>
                    <View style={[styles.stopDot, { backgroundColor: route.color }]}>
                      <ThemedText style={styles.stopNumber}>{i + 1}</ThemedText>
                    </View>
                    {i < stops.length - 1 && (
                      <View
                        style={[styles.stopLine, { backgroundColor: route.color }]}
                      />
                    )}
                  </View>
                  <View style={styles.stopInfo}>
                    <ThemedText style={styles.stopName}>{stop.name}</ThemedText>
                    <ThemedText style={styles.stopCoords}>
                      {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(180).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Taxi details</ThemedText>
            <View style={styles.detailGrid}>
              <View style={[styles.detailCard, { backgroundColor: cardSurface }]}>
                <ThemedText style={styles.detailEmoji}>{handSignal?.emoji || "✋"}</ThemedText>
                <ThemedText style={styles.detailLabel}>Hand signal</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {handSignal?.label || route.handSignal}
                </ThemedText>
              </View>
              <View style={[styles.detailCard, { backgroundColor: cardSurface }]}>
                <View style={[styles.detailIconWrap, { backgroundColor: `${route.color}15` }]}>
                  <Feather name="clock" size={18} color={route.color} />
                </View>
                <ThemedText style={styles.detailLabel}>Hours</ThemedText>
                <ThemedText style={styles.detailValue}>{route.operatingHours}</ThemedText>
              </View>
              <View style={[styles.detailCard, { backgroundColor: cardSurface }]}>
                <View style={[styles.detailIconWrap, { backgroundColor: `${route.color}15` }]}>
                  <Feather name="repeat" size={18} color={route.color} />
                </View>
                <ThemedText style={styles.detailLabel}>Frequency</ThemedText>
                <ThemedText style={styles.detailValue}>{route.frequency}</ThemedText>
              </View>
              <View style={[styles.detailCard, { backgroundColor: cardSurface }]}>
                <View style={[styles.detailIconWrap, { backgroundColor: `${route.color}15` }]}>
                  <Feather name="shield" size={18} color={route.color} />
                </View>
                <ThemedText style={styles.detailLabel}>Association</ThemedText>
                <ThemedText style={styles.detailValue}>{route.association}</ThemedText>
              </View>
            </View>
            {route.handSignalDescription ? (
              <View style={[styles.signalDesc, { backgroundColor: `${route.color}10` }]}>
                <Feather name="info" size={16} color={route.color} />
                <ThemedText style={styles.signalDescText}>
                  {route.handSignalDescription}
                </ThemedText>
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(240).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Contributor</ThemedText>
            <View style={[styles.contributorCard, { backgroundColor: cardSurface }]}>
              <View
                style={[styles.contributorAvatar, { backgroundColor: badgeConfig.color }]}
              >
                <ThemedText style={styles.contributorAvatarText}>
                  {route.contributorName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.contributorCardName}>
                  {route.contributorName}
                </ThemedText>
                <View style={styles.contributorBadgeRow}>
                  <View
                    style={[
                      styles.badgePill,
                      { backgroundColor: `${badgeConfig.color}20` },
                    ]}
                  >
                    <ThemedText
                      style={[styles.badgePillText, { color: badgeConfig.color }]}
                    >
                      {badgeConfig.label}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.contributorPoints}>
                    {route.points} pts
                  </ThemedText>
                </View>
              </View>
              <Pressable
                onPress={handleStar}
                hitSlop={8}
                style={styles.starButton}
                accessibilityRole="button"
                accessibilityLabel={isStarred ? "Unstar route" : "Star route"}
              >
                <Feather
                  name="star"
                  size={22}
                  color={isStarred ? BrandColors.secondary.orange : BrandColors.gray[600]}
                />
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(300).duration(400)}
            style={styles.actionRow}
          >
            <Pressable
              style={[styles.actionBtn, { backgroundColor: cardSurface }]}
              onPress={handleShare}
            >
              <Feather name="share-2" size={18} color={BrandColors.primary.gradientStart} />
              <ThemedText style={styles.actionBtnText}>Share</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: cardSurface }]}
              onPress={handleReport}
            >
              <Feather name="flag" size={18} color={BrandColors.status.emergency} />
              <ThemedText style={styles.actionBtnText}>Report</ThemedText>
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(360).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>
              Comments ({comments.length})
            </ThemedText>
            {comments.map((comment) => (
              <View
                key={comment.id}
                style={[styles.commentCard, { backgroundColor: cardSurface }]}
              >
                <View style={styles.commentHeader}>
                  <ThemedText style={styles.commentAuthor}>{comment.userName}</ThemedText>
                  <ThemedText style={styles.commentTime}>
                    {getTimeAgo(comment.createdAt)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
              </View>
            ))}
            {comments.length === 0 && (
              <View style={[styles.noCommentsCard, { backgroundColor: cardSurface }]}>
                <Feather
                  name="message-circle"
                  size={20}
                  color={BrandColors.gray[600]}
                />
                <ThemedText style={styles.noComments}>
                  No comments yet. Be the first to share your experience.
                </ThemedText>
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.commentBar,
          {
            backgroundColor: theme.backgroundDefault,
            paddingBottom: insets.bottom + Spacing.sm,
            borderTopColor: BrandColors.gray[100],
          },
        ]}
      >
        <TextInput
          style={[
            styles.commentInput,
            {
              backgroundColor: cardSurface,
              color: theme.text,
              borderColor: BrandColors.gray[200],
            },
          ]}
          placeholder="Add a comment..."
          placeholderTextColor={BrandColors.gray[500]}
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={300}
        />
        <Pressable
          onPress={handleAddComment}
          disabled={!newComment.trim()}
          style={({ pressed }) => [
            styles.commentSendBtn,
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
        >
          <LinearGradient
            colors={
              newComment.trim()
                ? BrandColors.gradient.primary
                : [BrandColors.gray[300], BrandColors.gray[400]]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.commentSendBtnInner}
          >
            <Feather name="send" size={16} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...Typography.body,
    color: BrandColors.gray[600],
  },
  mapContainer: {
    position: "relative",
  },
  mapPlaceholder: {
    width: SCREEN_WIDTH,
    height: MAP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  mapPlaceholderText: {
    ...Typography.small,
    color: BrandColors.gray[600],
  },
  topBarGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  content: {
    padding: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  routeTitle: {
    ...Typography.h2,
    fontWeight: "800",
  },
  routeSubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
    marginTop: 4,
    textTransform: "capitalize",
  },
  voteColumn: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.full,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  voteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  voteNumber: {
    ...Typography.small,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginVertical: 2,
  },
  description: {
    ...Typography.body,
    color: BrandColors.gray[700],
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  statValue: {
    ...Typography.h3,
    fontWeight: "800",
  },
  statLabel: {
    ...Typography.label,
    color: BrandColors.gray[600],
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    fontWeight: "700",
  },
  stopsCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  stopItem: {
    flexDirection: "row",
    minHeight: 56,
  },
  stopTimeline: {
    width: 36,
    alignItems: "center",
  },
  stopDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  stopNumber: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  stopLine: {
    width: 3,
    flex: 1,
    marginTop: -2,
    marginBottom: -2,
  },
  stopInfo: {
    flex: 1,
    paddingLeft: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  stopName: {
    ...Typography.body,
    fontWeight: "600",
  },
  stopCoords: {
    ...Typography.label,
    color: BrandColors.gray[500],
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  detailCard: {
    flexBasis: "48%",
    flexGrow: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  detailEmoji: {
    fontSize: 24,
  },
  detailIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  detailValue: {
    ...Typography.small,
    fontWeight: "700",
    textAlign: "center",
  },
  signalDesc: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  signalDescText: {
    ...Typography.small,
    flex: 1,
    color: BrandColors.gray[700],
    lineHeight: 20,
  },
  contributorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  contributorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  contributorAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  contributorCardName: {
    ...Typography.body,
    fontWeight: "700",
  },
  contributorBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
  },
  badgePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgePillText: {
    ...Typography.label,
    fontWeight: "700",
  },
  contributorPoints: {
    ...Typography.label,
    color: BrandColors.gray[600],
  },
  starButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  actionBtnText: {
    ...Typography.small,
    fontWeight: "700",
  },
  commentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentAuthor: {
    ...Typography.small,
    fontWeight: "700",
  },
  commentTime: {
    ...Typography.label,
    color: BrandColors.gray[500],
  },
  commentText: {
    ...Typography.body,
    color: BrandColors.gray[700],
    lineHeight: 20,
  },
  noCommentsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  noComments: {
    ...Typography.small,
    color: BrandColors.gray[600],
    flex: 1,
  },
  commentBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  commentInput: {
    ...Typography.body,
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
  },
  commentSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  commentSendBtnInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

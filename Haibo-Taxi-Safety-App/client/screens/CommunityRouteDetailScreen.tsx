/**
 * CommunityRouteDetailScreen — Full route viewer with map, stops, metadata, comments, and voting
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
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

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MAPBOX_ACCESS_TOKEN, MAPBOX_STYLES } from "@/constants/mapbox";
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
const MAP_HEIGHT = 280;

export default function CommunityRouteDetailScreen() {
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
  const mapRef = useRef<any>(null);

  useEffect(() => {
    loadRoute();
  }, [routeId]);

  const loadRoute = async () => {
    const routes = await getCommunityRoutes();
    const found = routes.find((r) => r.id === routeId);
    if (found) setRoute(found);

    const votes = await getMyVotes();
    if (votes[routeId]) setMyVote(votes[routeId]);

    const stars = await getMyStars();
    setIsStarred(stars.includes(routeId));

    const cmts = await getRouteComments(routeId);
    setComments(cmts);
  };

  const handleVote = useCallback(
    async (vote: "up" | "down") => {
      if (!route) return;
      if (Platform.OS !== "web") {
        try {
          const Haptics = require("expo-haptics");
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      }

      let updated = { ...route };
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
      try {
        const Haptics = require("expo-haptics");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
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

    // Update comment count
    const updated = { ...route, commentCount: route.commentCount + 1 };
    setRoute(updated);
    await saveCommunityRoute(updated);
  }, [newComment, route]);

  if (!route) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Loading route...</ThemedText>
      </ThemedView>
    );
  }

  const stops = route.waypoints.filter((w) => w.isStop);
  const netVotes = route.upvotes - route.downvotes;
  const handSignal = HAND_SIGNALS.find((hs) => hs.id === route.handSignal);
  const badge = getBadge(route.points);
  const badgeConfig = BADGE_CONFIG[badge];

  // Build GeoJSON for the map
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

  // Calculate bounds for the camera
  const lngs = route.waypoints.map((w) => w.longitude);
  const lats = route.waypoints.map((w) => w.latitude);
  const bounds = {
    ne: [Math.max(...lngs) + 0.01, Math.max(...lats) + 0.01],
    sw: [Math.min(...lngs) - 0.01, Math.min(...lats) - 0.01],
  };

  const renderNativeMap = () => {
    try {
      const Mapbox = require("@rnmapbox/maps");
      const { MapView, Camera, ShapeSource, CircleLayer, SymbolLayer, LineLayer } = Mapbox;

      return (
        <MapView
          ref={mapRef}
          style={{ width: SCREEN_WIDTH, height: MAP_HEIGHT }}
          styleURL={isDark ? MAPBOX_STYLES.dark : MAPBOX_STYLES.light}
          scrollEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          scaleBarEnabled={false}
        >
          <Camera
            defaultSettings={{
              bounds: { ne: bounds.ne as [number, number], sw: bounds.sw as [number, number] },
              padding: { paddingTop: 40, paddingBottom: 40, paddingLeft: 40, paddingRight: 40 },
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
        <View style={[styles.mapPlaceholder, { backgroundColor: isDark ? "#1a1a2e" : "#e8f4f8" }]}>
          <Feather name="map" size={32} color={BrandColors.gray[400]} />
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Map preview</Text>
        </View>
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {/* Map */}
        <View style={styles.mapContainer}>
          {Platform.OS === "web" ? (
            <View style={[styles.mapPlaceholder, { backgroundColor: isDark ? "#1a1a2e" : "#e8f4f8" }]}>
              <Feather name="map" size={32} color={BrandColors.gray[400]} />
            </View>
          ) : (
            renderNativeMap()
          )}
          {/* Status badge */}
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
            <Text style={styles.statusText}>
              {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Route info */}
        <View style={styles.content}>
          {/* Title + vote */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.routeTitle}>{route.name}</ThemedText>
              <Text style={[styles.routeSubtitle, { color: theme.textSecondary }]}>
                {route.province} · {route.routeType} · {route.vehicleType}
              </Text>
            </View>
            <View style={styles.voteColumn}>
              <Pressable
                style={[
                  styles.voteBtn,
                  myVote === "up" && { backgroundColor: `${BrandColors.status.success}15` },
                ]}
                onPress={() => handleVote("up")}
              >
                <Feather
                  name="arrow-up"
                  size={20}
                  color={myVote === "up" ? BrandColors.status.success : BrandColors.gray[500]}
                />
              </Pressable>
              <Text
                style={[
                  styles.voteNumber,
                  {
                    color:
                      netVotes > 0
                        ? BrandColors.status.success
                        : netVotes < 0
                        ? BrandColors.status.emergency
                        : theme.textSecondary,
                  },
                ]}
              >
                {netVotes}
              </Text>
              <Pressable
                style={[
                  styles.voteBtn,
                  myVote === "down" && { backgroundColor: `${BrandColors.status.emergency}15` },
                ]}
                onPress={() => handleVote("down")}
              >
                <Feather
                  name="arrow-down"
                  size={20}
                  color={myVote === "down" ? BrandColors.status.emergency : BrandColors.gray[500]}
                />
              </Pressable>
            </View>
          </View>

          {/* Description */}
          {route.description ? (
            <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
              {route.description}
            </ThemedText>
          ) : null}

          {/* Quick stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
              <Text style={[styles.statValue, { color: route.color }]}>R{route.fare}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Fare</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
              <Text style={[styles.statValue, { color: route.color }]}>{stops.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Stops</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
              <Text style={[styles.statValue, { color: route.color }]}>{route.stars}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Stars</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
              <Text style={[styles.statValue, { color: route.color }]}>{route.upvotes}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Votes</Text>
            </View>
          </View>

          {/* Stops list */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Stops</ThemedText>
            {stops.map((stop, i) => (
              <View key={stop.id} style={styles.stopItem}>
                <View style={styles.stopTimeline}>
                  <View style={[styles.stopDot, { backgroundColor: route.color }]}>
                    <Text style={styles.stopNumber}>{i + 1}</Text>
                  </View>
                  {i < stops.length - 1 && (
                    <View style={[styles.stopLine, { backgroundColor: route.color }]} />
                  )}
                </View>
                <View style={styles.stopInfo}>
                  <ThemedText style={styles.stopName}>{stop.name}</ThemedText>
                  <Text style={[styles.stopCoords, { color: theme.textSecondary }]}>
                    {stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Taxi details */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Taxi Details</ThemedText>
            <View style={styles.detailGrid}>
              <View style={[styles.detailCard, { backgroundColor: theme.backgroundDefault }]}>
                <Text style={styles.detailEmoji}>{handSignal?.emoji || "🤚"}</Text>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Hand Signal</Text>
                <ThemedText style={styles.detailValue}>{handSignal?.label || route.handSignal}</ThemedText>
              </View>
              <View style={[styles.detailCard, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="clock" size={20} color={route.color} />
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Hours</Text>
                <ThemedText style={styles.detailValue}>{route.operatingHours}</ThemedText>
              </View>
              <View style={[styles.detailCard, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="repeat" size={20} color={route.color} />
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Frequency</Text>
                <ThemedText style={styles.detailValue}>{route.frequency}</ThemedText>
              </View>
              <View style={[styles.detailCard, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="shield" size={20} color={route.color} />
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Association</Text>
                <ThemedText style={styles.detailValue}>{route.association}</ThemedText>
              </View>
            </View>
            {route.handSignalDescription ? (
              <View style={[styles.signalDesc, { backgroundColor: `${route.color}10` }]}>
                <Feather name="info" size={14} color={route.color} />
                <Text style={[styles.signalDescText, { color: theme.text }]}>
                  {route.handSignalDescription}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Contributor */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Contributor</ThemedText>
            <View style={[styles.contributorCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={[styles.contributorAvatar, { backgroundColor: badgeConfig.color }]}>
                <Text style={styles.contributorAvatarText}>
                  {route.contributorName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.contributorCardName}>{route.contributorName}</ThemedText>
                <View style={styles.contributorBadgeRow}>
                  <View style={[styles.badgePill, { backgroundColor: `${badgeConfig.color}20` }]}>
                    <Text style={[styles.badgePillText, { color: badgeConfig.color }]}>
                      {badgeConfig.label}
                    </Text>
                  </View>
                  <Text style={[styles.contributorPoints, { color: theme.textSecondary }]}>
                    {route.points} pts
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleStar} hitSlop={8}>
                <Feather
                  name="star"
                  size={24}
                  color={isStarred ? BrandColors.secondary.orange : BrandColors.gray[400]}
                />
              </Pressable>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: theme.backgroundDefault }]}
              onPress={async () => {
                try {
                  const stops = route.waypoints.filter((w) => w.isStop);
                  const origin = stops[0]?.name || "Unknown";
                  const dest = stops[stops.length - 1]?.name || "Unknown";
                  await Share.share({
                    message: `Check out this taxi route on Haibo!\n\n🚐 ${route.name}\n📍 ${origin} → ${dest}\n💰 R${route.fare}\n⭐ ${route.upvotes} upvotes\n\nShared via Haibo App`,
                  });
                } catch {}
              }}
            >
              <Feather name="share-2" size={18} color={theme.text} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => {
                Alert.alert(
                  "Report Route",
                  "Why are you reporting this route?",
                  [
                    { text: "Inaccurate info", onPress: () => Alert.alert("Reported", "Thank you for your feedback. We'll review this route.") },
                    { text: "Spam/Fake", onPress: () => Alert.alert("Reported", "Thank you for your feedback. We'll review this route.") },
                    { text: "Cancel", style: "cancel" },
                  ]
                );
              }}
            >
              <Feather name="flag" size={18} color={BrandColors.status.emergency} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Report</Text>
            </Pressable>
          </View>

          {/* Comments */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              Comments ({comments.length})
            </ThemedText>
            {comments.map((comment) => (
              <View key={comment.id} style={[styles.commentCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.commentHeader}>
                  <ThemedText style={styles.commentAuthor}>{comment.userName}</ThemedText>
                  <Text style={[styles.commentTime, { color: theme.textSecondary }]}>
                    {getTimeAgo(comment.createdAt)}
                  </Text>
                </View>
                <ThemedText style={[styles.commentText, { color: theme.textSecondary }]}>
                  {comment.text}
                </ThemedText>
              </View>
            ))}
            {comments.length === 0 && (
              <Text style={[styles.noComments, { color: theme.textSecondary }]}>
                No comments yet. Be the first to share your experience!
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Comment input bar */}
      <View style={[styles.commentBar, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.commentInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
          placeholder="Add a comment..."
          placeholderTextColor={theme.textSecondary}
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={300}
        />
        <Pressable
          style={[
            styles.commentSendBtn,
            { backgroundColor: newComment.trim() ? route.color : BrandColors.gray[400] },
          ]}
          onPress={handleAddComment}
          disabled={!newComment.trim()}
        >
          <Feather name="send" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </ThemedView>
  );
}

function getTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  // Map
  mapContainer: { position: "relative" },
  mapPlaceholder: {
    width: SCREEN_WIDTH,
    height: MAP_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  statusText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
  // Content
  content: { padding: Spacing.lg },
  titleRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  routeTitle: { fontSize: 22, fontWeight: "800" },
  routeSubtitle: { fontSize: 13, marginTop: 4 },
  voteColumn: { alignItems: "center", marginLeft: 12 },
  voteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  voteNumber: { fontSize: 16, fontWeight: "800" },
  description: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  // Action buttons
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  actionBtnText: { fontSize: 14, fontWeight: "600" },
  // Stats
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: BorderRadius.sm,
  },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },
  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  // Stops
  stopItem: { flexDirection: "row", minHeight: 56 },
  stopTimeline: { width: 36, alignItems: "center" },
  stopDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  stopNumber: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  stopLine: { width: 3, flex: 1, marginTop: -2, marginBottom: -2 },
  stopInfo: { flex: 1, paddingLeft: 8, paddingBottom: 16 },
  stopName: { fontSize: 15, fontWeight: "600" },
  stopCoords: { fontSize: 11, marginTop: 2 },
  // Detail grid
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  detailCard: {
    width: "47%",
    alignItems: "center",
    padding: 12,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  detailEmoji: { fontSize: 24 },
  detailLabel: { fontSize: 11 },
  detailValue: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  signalDesc: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
    borderRadius: BorderRadius.sm,
    gap: 8,
    marginTop: 8,
  },
  signalDescText: { flex: 1, fontSize: 13, lineHeight: 20 },
  // Contributor
  contributorCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 12,
  },
  contributorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  contributorAvatarText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  contributorCardName: { fontSize: 15, fontWeight: "600" },
  contributorBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  badgePillText: { fontSize: 11, fontWeight: "600" },
  contributorPoints: { fontSize: 12 },
  // Comments
  commentCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: 8,
  },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  commentAuthor: { fontSize: 13, fontWeight: "600" },
  commentTime: { fontSize: 11 },
  commentText: { fontSize: 14, lineHeight: 20 },
  noComments: { fontSize: 13, fontStyle: "italic", textAlign: "center", paddingVertical: 16 },
  // Comment bar
  commentBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: Spacing.md,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  commentInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 80,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    fontSize: 15,
  },
  commentSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

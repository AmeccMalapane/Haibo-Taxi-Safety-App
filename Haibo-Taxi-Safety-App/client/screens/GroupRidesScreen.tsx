import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { SkeletonBlock } from "@/components/Skeleton";
import { useTheme } from "@/hooks/useTheme";
import { useGroupRides } from "@/hooks/useApiData";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface GroupRidePost {
  id: string;
  driverName: string;
  driverRating: number;
  isVerified: boolean;
  origin: string;
  destination: string;
  departureTime: string;
  fare: number;
  seatsAvailable: number;
  description: string;
  mapPreviewUrl?: string;
  likes: number;
  comments: number;
}

const MOCK_RIDES: GroupRidePost[] = [
  {
    id: "1",
    driverName: "Thabo Mokoena",
    driverRating: 4.8,
    isVerified: true,
    origin: "Johannesburg CBD",
    destination: "Soweto",
    departureTime: "Today, 17:30",
    fare: 35,
    seatsAvailable: 4,
    description:
      "Heading to Soweto after work. Clean taxi, strictly no smoking. Safe drop-offs along the main road.",
    mapPreviewUrl:
      "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000",
    likes: 24,
    comments: 5,
  },
  {
    id: "2",
    driverName: "Nomvula Dlamini",
    driverRating: 4.9,
    isVerified: true,
    origin: "Sandton",
    destination: "Alexandra",
    departureTime: "Tomorrow, 07:15",
    fare: 22,
    seatsAvailable: 3,
    description:
      "Daily morning ride to Alex. Pickup at the Sandton Gautrain. WhatsApp first so I know you're coming.",
    mapPreviewUrl:
      "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1000",
    likes: 18,
    comments: 3,
  },
];

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function GroupRidesScreen() {
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { data: apiRides = [], isLoading } = useGroupRides();
  const queryClient = useQueryClient();

  const [isPosting, setIsPosting] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [fare, setFare] = useState("");
  const [description, setDescription] = useState("");

  // Real group-ride create mutation (Chunk 44 — was a demo Alert before).
  // The screen's form only captures origin/destination/fare/description,
  // so we derive the remaining required fields (title, scheduledDate,
  // maxPassengers, rideType) with sane defaults: title mirrors the
  // route, scheduledDate is 30 min from now (informal "heading out
  // soon" semantics), 4 passengers matches a standard taxi seat count,
  // and rideType='scheduled' is the generic bucket in the schema
  // comment. A later version of this screen can add UI for these.
  const createRideMut = useMutation({
    mutationFn: async () => {
      const fareValue = Number(fare);
      const payload = {
        title: `${origin.trim()} → ${destination.trim()}`,
        description: description.trim() || undefined,
        pickupLocation: origin.trim(),
        dropoffLocation: destination.trim(),
        scheduledDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        maxPassengers: 4,
        costPerPerson: Number.isFinite(fareValue) ? fareValue : 0,
        rideType: "scheduled",
        paymentMethod: "individual",
      };
      return apiRequest("/api/rides/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Trip posted",
        "Your trip is live for commuters nearby.",
        [
          {
            text: "OK",
            onPress: () => {
              setIsPosting(false);
              setOrigin("");
              setDestination("");
              setFare("");
              setDescription("");
            },
          },
        ],
      );
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Couldn't post trip",
        error?.message || "Please try again in a moment.",
      );
    },
  });

  const rides: GroupRidePost[] =
    apiRides.length > 0
      ? apiRides.map((r: any) => ({
          id: String(r.id),
          driverName: r.organizerName || r.organizerId || "Community Driver",
          driverRating: Number(r.driverSafetyRating ?? 4.5),
          isVerified: Boolean(r.isVerifiedDriver),
          origin: r.pickupLocation || "—",
          destination: r.dropoffLocation || "—",
          departureTime: r.scheduledDate
            ? new Date(r.scheduledDate).toLocaleString("en-ZA", {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "TBA",
          fare: Number(r.costPerPerson ?? 0),
          seatsAvailable: Number(r.maxPassengers ?? 4),
          description: r.notes || r.description || "",
          mapPreviewUrl: r.mapPreviewUrl,
          likes: Number(r.likes ?? 0),
          comments: Number(r.comments ?? 0),
        }))
      : MOCK_RIDES;

  // Booking a seat on Haibo is Haibo Pay itself — the commuter pays the
  // driver directly via the PayVendor flow instead of a separate
  // reservation ledger. This keeps the single-wallet ecosystem honest
  // and avoids a parallel "participant" table that doesn't enforce
  // capacity anywhere. Copy nudges the user toward the right rail.
  const handleBookRide = (post: GroupRidePost) => {
    Haptics.selectionAsync();
    Alert.alert(
      `Ride with ${post.driverName}`,
      `Fare is R${post.fare}. Pay the driver directly with Haibo Pay — scan their QR code on the taxi or ask for their pay reference.`,
      [
        { text: "Close", style: "cancel" },
        {
          text: "Open Haibo Pay",
          onPress: () => navigation.navigate("PayVendor"),
        },
      ],
    );
  };

  const handlePostTrip = () => {
    if (!origin || !destination || !fare) {
      Alert.alert("Missing info", "Enter origin, destination and fare to post a trip.");
      return;
    }
    createRideMut.mutate();
  };

  const renderSkeletonCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonBlock style={{ width: 44, height: 44, borderRadius: 22 }} />
        <View style={{ flex: 1, marginLeft: Spacing.md, gap: 6 }}>
          <SkeletonBlock style={{ width: "50%", height: 14, borderRadius: 4 }} />
          <SkeletonBlock style={{ width: "30%", height: 10, borderRadius: 4 }} />
        </View>
        <SkeletonBlock style={{ width: 60, height: 28, borderRadius: 14 }} />
      </View>
      <SkeletonBlock style={{ width: "100%", height: 160 }} />
      <View style={{ padding: Spacing.md, gap: 6 }}>
        <SkeletonBlock style={{ width: "100%", height: 14, borderRadius: 4 }} />
        <SkeletonBlock style={{ width: "70%", height: 14, borderRadius: 4 }} />
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
            <Feather name="truck" size={16} color="#FFFFFF" />
            <ThemedText style={styles.heroBadgeText}>Group rides</ThemedText>
          </View>
          <Pressable
            onPress={() => setIsPosting((p) => !p)}
            style={styles.heroButton}
            accessibilityRole="button"
            accessibilityLabel={isPosting ? "Cancel new ride" : "Post a ride"}
          >
            <Feather name={isPosting ? "x" : "plus"} size={20} color="#FFFFFF" />
          </Pressable>
        </View>
        <ThemedText style={styles.heroTitle}>Ride together.</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Verified drivers, safer commutes, shared fares across Mzansi.
        </ThemedText>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>
              {isLoading ? "—" : rides.length}
            </ThemedText>
            <ThemedText style={styles.heroStatLabel}>Open rides</ThemedText>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>
              {isLoading
                ? "—"
                : rides.reduce((sum, r) => sum + r.seatsAvailable, 0)}
            </ThemedText>
            <ThemedText style={styles.heroStatLabel}>Seats</ThemedText>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>
              R
              {rides.length
                ? Math.round(
                    rides.reduce((sum, r) => sum + r.fare, 0) / rides.length
                  )
                : 0}
            </ThemedText>
            <ThemedText style={styles.heroStatLabel}>Avg fare</ThemedText>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        {isPosting ? (
          <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(300)} style={styles.postForm}>
            <View style={styles.formHeader}>
              <View style={styles.formIconWrap}>
                <Feather name="map" size={18} color={BrandColors.primary.gradientStart} />
              </View>
              <ThemedText style={styles.formTitle}>Post a verified trip</ThemedText>
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>From</ThemedText>
              <View style={styles.inputWrap}>
                <Feather name="map-pin" size={16} color={BrandColors.gray[600]} />
                <TextInput
                  style={styles.input}
                  placeholder="Where are you starting?"
                  placeholderTextColor={BrandColors.gray[500]}
                  value={origin}
                  onChangeText={setOrigin}
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>To</ThemedText>
              <View style={styles.inputWrap}>
                <Feather name="navigation" size={16} color={BrandColors.gray[600]} />
                <TextInput
                  style={styles.input}
                  placeholder="Where are you going?"
                  placeholderTextColor={BrandColors.gray[500]}
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Fare per seat</ThemedText>
              <View style={styles.inputWrap}>
                <ThemedText style={styles.currencyPrefix}>R</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 35"
                  keyboardType="numeric"
                  placeholderTextColor={BrandColors.gray[500]}
                  value={fare}
                  onChangeText={setFare}
                />
              </View>
            </View>
            <View style={styles.inputGroup}>
              <ThemedText style={styles.label}>Notes (optional)</ThemedText>
              <TextInput
                style={styles.textArea}
                placeholder="Pickup details, rules, meeting point..."
                placeholderTextColor={BrandColors.gray[500]}
                multiline
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </View>
            <GradientButton
              onPress={handlePostTrip}
              icon="send"
              disabled={createRideMut.isPending}
            >
              {createRideMut.isPending ? "Posting…" : "Post trip"}
            </GradientButton>
          </Animated.View>
        ) : null}

        {isLoading ? (
          <View style={{ gap: Spacing.md }}>
            {renderSkeletonCard()}
            {renderSkeletonCard()}
          </View>
        ) : rides.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Feather name="truck" size={28} color={BrandColors.primary.gradientStart} />
            </View>
            <ThemedText style={styles.emptyTitle}>No rides posted yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Post your trip and be the first to share the road.
            </ThemedText>
          </View>
        ) : (
          rides.map((post, index) => (
            <Animated.View
              key={post.id}
              entering={reducedMotion ? undefined : FadeInDown.delay(index * 60).duration(400)}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarInitials}>
                    {getInitials(post.driverName)}
                  </ThemedText>
                </View>
                <View style={styles.driverInfo}>
                  <View style={styles.nameRow}>
                    <ThemedText style={styles.driverName}>{post.driverName}</ThemedText>
                    {post.isVerified ? (
                      <Feather
                        name="check-circle"
                        size={16}
                        color={BrandColors.primary.gradientStart}
                      />
                    ) : null}
                  </View>
                  <View style={styles.ratingRow}>
                    <Feather name="star" size={12} color="#FFB400" />
                    <ThemedText style={styles.ratingText}>
                      {post.driverRating.toFixed(1)} driver rating
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.fareTag}>
                  <ThemedText style={styles.fareText}>R{post.fare}</ThemedText>
                </View>
              </View>

              {post.mapPreviewUrl ? (
                <View style={styles.mapContainer}>
                  <Image
                    source={{ uri: post.mapPreviewUrl }}
                    style={styles.mapImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.65)"]}
                    style={styles.mapOverlay}
                  >
                    <View style={styles.routeOverlay}>
                      <Feather name="navigation" size={16} color="#FFFFFF" />
                      <ThemedText style={styles.routeOverlayText}>
                        {post.origin}  →  {post.destination}
                      </ThemedText>
                    </View>
                  </LinearGradient>
                  <View style={styles.watermark}>
                    <ThemedText style={styles.watermarkText}>Haibo!</ThemedText>
                  </View>
                </View>
              ) : (
                <View style={styles.routeStripe}>
                  <Feather
                    name="navigation"
                    size={16}
                    color={BrandColors.primary.gradientStart}
                  />
                  <ThemedText style={styles.routeStripeText}>
                    {post.origin}  →  {post.destination}
                  </ThemedText>
                </View>
              )}

              <View style={styles.cardContent}>
                {post.description ? (
                  <ThemedText style={styles.description}>{post.description}</ThemedText>
                ) : null}
                <View style={styles.rideDetails}>
                  <View style={styles.detailChip}>
                    <Feather name="clock" size={12} color={BrandColors.primary.gradientStart} />
                    <ThemedText style={styles.detailText}>{post.departureTime}</ThemedText>
                  </View>
                  <View style={styles.detailChip}>
                    <Feather name="users" size={12} color={BrandColors.primary.gradientStart} />
                    <ThemedText style={styles.detailText}>
                      {post.seatsAvailable} seats left
                    </ThemedText>
                  </View>
                </View>
              </View>

              <View style={styles.interactionBar}>
                <View style={styles.socialActions}>
                  <Pressable style={styles.actionButton}>
                    <Feather name="heart" size={16} color={BrandColors.gray[600]} />
                    <ThemedText style={styles.actionText}>{post.likes}</ThemedText>
                  </Pressable>
                  <Pressable style={styles.actionButton}>
                    <Feather name="message-circle" size={16} color={BrandColors.gray[600]} />
                    <ThemedText style={styles.actionText}>{post.comments}</ThemedText>
                  </Pressable>
                </View>
                <Pressable
                  style={styles.bookButtonWrap}
                  onPress={() => handleBookRide(post)}
                >
                  <LinearGradient
                    colors={BrandColors.gradient.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bookButton}
                  >
                    <Feather name="credit-card" size={16} color="#FFFFFF" />
                    <ThemedText style={styles.bookButtonText}>
                      Book with Haibo Pay
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    marginTop: -Spacing["2xl"],
    gap: Spacing.md,
  },
  postForm: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  formIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  formTitle: {
    ...Typography.h4,
    color: BrandColors.gray[900],
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.label,
    color: BrandColors.gray[600],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    backgroundColor: BrandColors.gray[50],
  },
  input: {
    ...Typography.body,
    flex: 1,
    height: 46,
    color: BrandColors.gray[900],
  },
  currencyPrefix: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  textArea: {
    ...Typography.body,
    minHeight: 80,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    backgroundColor: BrandColors.gray[50],
    color: BrandColors.gray[900],
  },
  card: {
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
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
  driverInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  driverName: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.gray[900],
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    ...Typography.small,
    color: BrandColors.gray[600],
  },
  fareTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.status.success + "15",
  },
  fareText: {
    ...Typography.body,
    fontWeight: "800",
    color: BrandColors.status.success,
  },
  mapContainer: {
    width: "100%",
    height: 160,
    position: "relative",
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: Spacing.md,
  },
  routeOverlay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeOverlayText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  watermark: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(231, 35, 105, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  watermarkText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  routeStripe: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: BrandColors.primary.gradientStart + "08",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "20",
  },
  routeStripeText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  cardContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  description: {
    ...Typography.body,
    color: BrandColors.gray[800],
  },
  rideDetails: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
  },
  detailText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.primary.gradientStart,
  },
  interactionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: BrandColors.gray[100],
  },
  socialActions: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    ...Typography.small,
    color: BrandColors.gray[500],
    fontVariant: ["tabular-nums"],
  },
  bookButtonWrap: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
  },
  bookButtonText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
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

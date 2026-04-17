import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Image,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import {
  Spacing,
  BrandColors,
  BorderRadius,
  Typography,
} from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useEvents } from "@/hooks/useApiData";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { apiRequest } from "@/lib/query-client";
import { uploadFromUri } from "@/lib/uploads";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

// typeui-clean rework — Events as a calm community board:
//   1. Rose gradient hero with calendar badge + back button + Promote
//      pill (was a tap-to-toggle in the header that didn't fit any other
//      screen's pattern)
//   2. Floating white content card with inline expanding "Promote" form
//      (R50 / 7-day demo flow)
//   3. Event cards: hero image with rose price tag, organizer + verified
//      check, calendar/pin meta, social action row, rose gradient
//      "Get tickets" CTA (was solid red — now matches the brand gradient)
//   4. Empty state with rose-tinted calendar icon when no events load
//
// No latent bugs in this screen — the demo "promote" + "buy ticket"
// flows just show Alerts. They're flagged as "demo" in the form copy
// so users know it's not yet wired to Paystack.

interface EventPost {
  id: string;
  title: string;
  organizer: string;
  date: string;
  location: string;
  price: number;
  description: string;
  imageUrl: string;
  likes: number;
  comments: number;
  isVerified: boolean;
  expiryDate: string;
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1000";

const mockEvents: EventPost[] = [
  {
    id: "1",
    title: "Soweto Street Food Festival",
    organizer: "Gauteng Events Hub",
    date: "March 15, 2026",
    location: "Soweto Theatre",
    price: 150,
    description:
      "Experience the best of local flavors, music, and culture. A day for the whole family.",
    imageUrl: FALLBACK_IMAGE,
    likes: 156,
    comments: 24,
    isVerified: true,
    expiryDate: "2026-03-01",
  },
];

export default function EventsScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { data: apiEvents = [], refetch: refetchEvents } = useEvents();
  const queryClient = useQueryClient();

  const [isPosting, setIsPosting] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [eventImageUrl, setEventImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [dateFocused, setDateFocused] = useState(false);
  const [locFocused, setLocFocused] = useState(false);
  const [priceFocused, setPriceFocused] = useState(false);

  const events: EventPost[] =
    Array.isArray(apiEvents) && apiEvents.length > 0
      ? apiEvents.map((e: any) => ({
          id: e.id,
          title: e.title,
          organizer: e.organizer || "Community",
          date: new Date(e.eventDate).toLocaleDateString("en-ZA", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          location: e.location,
          price: e.ticketPrice || 0,
          description: e.description,
          imageUrl: e.imageUrl || FALLBACK_IMAGE,
          likes: 0,
          comments: 0,
          isVerified: e.isVerified || false,
          expiryDate: e.eventEndDate || e.eventDate,
        }))
      : mockEvents;

  const triggerHaptic = (
    type: "selection" | "medium" | "success" | "error" = "selection"
  ) => {
    if (Platform.OS === "web") return;
    try {
      const Haptics = require("expo-haptics");
      if (type === "success") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === "error") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (type === "medium") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}
  };

  const handleTogglePost = () => {
    triggerHaptic("selection");
    setIsPosting((prev) => !prev);
  };

  // Parse the user's free-form date string into an ISO date. We accept
  // whatever Date can parse (e.g. "March 15, 2026 2:00 PM") and fall
  // back to null — the caller validates before calling.
  const parseEventDate = (raw: string): Date | null => {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      const parsedDate = parseEventDate(eventDate);
      if (!parsedDate) {
        throw new Error("Could not parse the event date. Try a format like '15 March 2026 14:00'.");
      }
      return apiRequest("/api/events/create", {
        method: "POST",
        body: JSON.stringify({
          title: eventTitle.trim(),
          description: eventDescription.trim(),
          category: "community",
          eventDate: parsedDate.toISOString(),
          location: eventLocation.trim(),
          organizer: user?.displayName || user?.phone || "Community",
          organizerPhone: user?.phone || undefined,
          ticketPrice: ticketPrice ? parseFloat(ticketPrice) : 0,
          imageUrl: eventImageUrl || undefined,
        }),
      });
    },
    onSuccess: () => {
      triggerHaptic("success");
      // Refresh both the local useEvents hook and the shared cache.
      refetchEvents();
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      Alert.alert(
        "Event posted",
        "Your event is now live on Haibo. Share it with your community!",
      );
      setIsPosting(false);
      setEventTitle("");
      setEventDescription("");
      setEventDate("");
      setEventLocation("");
      setTicketPrice("");
      setEventImageUrl("");
    },
    onError: (error: Error) => {
      triggerHaptic("error");
      Alert.alert("Couldn't post event", error.message || "Please try again.");
    },
  });

  const handlePostEvent = () => {
    triggerHaptic("medium");
    if (
      !eventTitle.trim() ||
      !eventDescription.trim() ||
      !eventDate.trim() ||
      !eventLocation.trim()
    ) {
      triggerHaptic("error");
      return;
    }
    postMutation.mutate();
  };

  // Pick + upload an event hero image. Uploaded on pick so the
  // submit button doesn't carry a local URI through the mutation.
  const handlePickEventImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          "Grant photo library access to upload an event image.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // 16:9 hero crop matches how event cards render on the feed.
        aspect: [16, 9],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      triggerHaptic("selection");
      setImageUploading(true);
      const uploaded = await uploadFromUri(result.assets[0].uri, {
        folder: "events",
        name: result.assets[0].fileName || undefined,
      });
      setEventImageUrl(uploaded.url);
      triggerHaptic("success");
    } catch (error: any) {
      triggerHaptic("error");
      Alert.alert("Upload failed", error.message || "Please try again.");
    } finally {
      setImageUploading(false);
    }
  };

  const handleClearEventImage = () => {
    triggerHaptic("selection");
    setEventImageUrl("");
  };

  const handleBuyTicket = (event: EventPost) => {
    triggerHaptic("medium");
    Alert.alert(
      "Buy ticket",
      `Purchase ticket for "${event.title}" at R${event.price}? (Demo mode — Paystack checkout coming soon.)`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            triggerHaptic("success");
            Alert.alert(
              "Ticket secured",
              "Your ticket has been added to your profile. See you there!"
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        {/* Rose gradient hero */}
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.lg }]}
        >
          <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(300)}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={22} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeIn.duration(400).delay(100)}
            style={styles.heroBadgeWrap}
          >
            <View style={styles.heroBadge}>
              <Feather
                name="calendar"
                size={32}
                color={BrandColors.primary.gradientStart}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(500).delay(150)}
            style={styles.heroText}
          >
            <ThemedText style={styles.heroTitle}>Events & meetups</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Discover what's on across Mzansi — and promote your own.
            </ThemedText>
          </Animated.View>
        </LinearGradient>

        {/* Floating content card */}
        <Animated.View
          entering={reducedMotion ? undefined : FadeInUp.duration(500).delay(200)}
          style={[
            styles.contentCard,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          {/* Promote toggle / form */}
          <Pressable
            onPress={handleTogglePost}
            style={({ pressed }) => [
              styles.promoteToggle,
              {
                backgroundColor: isPosting
                  ? theme.backgroundDefault
                  : BrandColors.primary.gradientStart + "08",
                borderColor: BrandColors.primary.gradientStart + "33",
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isPosting ? "Cancel event promotion" : "Promote your event"
            }
          >
            <View
              style={[
                styles.promoteIcon,
                {
                  backgroundColor: BrandColors.primary.gradientStart + "12",
                },
              ]}
            >
              <Feather
                name={isPosting ? "x" : "volume-2"}
                size={18}
                color={BrandColors.primary.gradientStart}
              />
            </View>
            <View style={styles.promoteTextWrap}>
              <ThemedText style={styles.promoteTitle}>
                {isPosting ? "Cancel" : "Promote your event"}
              </ThemedText>
              <ThemedText
                style={[styles.promoteHint, { color: theme.textSecondary }]}
              >
                {isPosting
                  ? "Discard the form below"
                  : "Share a Mzansi meetup, festival, or launch"}
              </ThemedText>
            </View>
            <Feather
              name={isPosting ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>

          {isPosting ? (
            <Animated.View
              entering={reducedMotion ? undefined : FadeInDown.duration(300)}
              style={[
                styles.formCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                EVENT TITLE
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: titleFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="What's happening?"
                placeholderTextColor={theme.textSecondary}
                value={eventTitle}
                onChangeText={setEventTitle}
                onFocus={() => setTitleFocused(true)}
                onBlur={() => setTitleFocused(false)}
              />

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                HERO IMAGE (OPTIONAL)
              </ThemedText>
              {eventImageUrl ? (
                <View style={styles.eventImagePreviewWrap}>
                  <Image
                    source={{ uri: eventImageUrl }}
                    style={styles.eventImagePreview}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={handleClearEventImage}
                    style={({ pressed }) => [
                      styles.eventImageClearBtn,
                      pressed && { opacity: 0.8 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove event image"
                  >
                    <Feather name="x" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handlePickEventImage}
                  disabled={imageUploading}
                  style={({ pressed }) => [
                    styles.eventUploadButton,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Upload event image"
                >
                  <View
                    style={[
                      styles.eventUploadIcon,
                      {
                        backgroundColor:
                          BrandColors.primary.gradientStart + "12",
                      },
                    ]}
                  >
                    <Feather
                      name={imageUploading ? "loader" : "image"}
                      size={18}
                      color={BrandColors.primary.gradientStart}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.eventUploadText,
                      { color: theme.text },
                    ]}
                  >
                    {imageUploading ? "Uploading…" : "Add a hero image"}
                  </ThemedText>
                </Pressable>
              )}

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                DESCRIPTION
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: descFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="What's the vibe? Who's performing? What should people bring?"
                placeholderTextColor={theme.textSecondary}
                value={eventDescription}
                onChangeText={setEventDescription}
                onFocus={() => setDescFocused(true)}
                onBlur={() => setDescFocused(false)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                DATE & TIME
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: dateFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="e.g. 15 March 2026 14:00"
                placeholderTextColor={theme.textSecondary}
                value={eventDate}
                onChangeText={setEventDate}
                onFocus={() => setDateFocused(true)}
                onBlur={() => setDateFocused(false)}
              />

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                LOCATION
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: locFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="Where is it?"
                placeholderTextColor={theme.textSecondary}
                value={eventLocation}
                onChangeText={setEventLocation}
                onFocus={() => setLocFocused(true)}
                onBlur={() => setLocFocused(false)}
              />

              <ThemedText
                style={[styles.fieldLabel, { color: theme.textSecondary }]}
              >
                TICKET PRICE (R)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: priceFocused
                      ? BrandColors.primary.gradientStart
                      : theme.border,
                  },
                ]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                value={ticketPrice}
                onChangeText={setTicketPrice}
                onFocus={() => setPriceFocused(true)}
                onBlur={() => setPriceFocused(false)}
              />

              <View style={styles.formCta}>
                <GradientButton
                  onPress={handlePostEvent}
                  disabled={
                    !eventTitle.trim() ||
                    !eventDescription.trim() ||
                    !eventDate.trim() ||
                    !eventLocation.trim() ||
                    postMutation.isPending ||
                    imageUploading
                  }
                  size="large"
                  icon={postMutation.isPending ? undefined : "arrow-right"}
                  iconPosition="right"
                >
                  {postMutation.isPending ? "Posting…" : "Post event"}
                </GradientButton>
              </View>
            </Animated.View>
          ) : null}

          {/* Events list */}
          <ThemedText
            style={[styles.sectionLabel, { color: theme.textSecondary }]}
          >
            UPCOMING IN MZANSI · {events.length}
          </ThemedText>

          {events.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      BrandColors.primary.gradientStart + "12",
                  },
                ]}
              >
                <Feather
                  name="calendar"
                  size={26}
                  color={BrandColors.primary.gradientStart}
                />
              </View>
              <ThemedText style={styles.emptyTitle}>No events yet</ThemedText>
              <ThemedText
                style={[styles.emptyHint, { color: theme.textSecondary }]}
              >
                Be the first to promote a Mzansi meetup, festival or launch.
              </ThemedText>
            </View>
          ) : (
            events.map((event, index) => (
              <Animated.View
                key={event.id}
                entering={reducedMotion ? undefined : FadeInDown.duration(400).delay(
                  Math.min(index * 60, 400)
                )}
              >
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  {/* Image with overlay */}
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: event.imageUrl }}
                      style={styles.eventImage}
                    />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.75)"]}
                      style={styles.imageOverlay}
                    />

                    {/* Price tag — green for FREE (encouraging signal),
                        rose brand gradient for paid events */}
                    <View style={styles.priceTagWrap}>
                      <LinearGradient
                        colors={
                          event.price > 0
                            ? (BrandColors.gradient.primary as [string, string])
                            : [BrandColors.status.success, BrandColors.primary.green]
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.priceTag}
                      >
                        <ThemedText style={styles.priceText}>
                          {event.price > 0 ? `R${event.price}` : "FREE"}
                        </ThemedText>
                      </LinearGradient>
                    </View>

                    <View style={styles.titleOverlay}>
                      <ThemedText style={styles.cardTitle} numberOfLines={2}>
                        {event.title}
                      </ThemedText>
                    </View>
                  </View>

                  {/* Card body */}
                  <View style={styles.cardContent}>
                    <View style={styles.organizerRow}>
                      <Feather
                        name="user"
                        size={12}
                        color={theme.textSecondary}
                      />
                      <ThemedText
                        style={[
                          styles.organizerText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {event.organizer}
                      </ThemedText>
                      {event.isVerified ? (
                        <Feather
                          name="check-circle"
                          size={12}
                          color={BrandColors.primary.gradientStart}
                        />
                      ) : null}
                    </View>

                    <View style={styles.detailRow}>
                      <View style={styles.detailItem}>
                        <Feather
                          name="calendar"
                          size={12}
                          color={theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.detailText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {event.date}
                        </ThemedText>
                      </View>
                      <View style={styles.detailItem}>
                        <Feather
                          name="map-pin"
                          size={12}
                          color={theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.detailText,
                            { color: theme.textSecondary },
                          ]}
                          numberOfLines={1}
                        >
                          {event.location}
                        </ThemedText>
                      </View>
                    </View>

                    <ThemedText
                      style={[
                        styles.description,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={2}
                    >
                      {event.description}
                    </ThemedText>
                  </View>

                  {/* Action bar */}
                  <View
                    style={[
                      styles.actionBar,
                      { borderTopColor: theme.border },
                    ]}
                  >
                    <View style={styles.socialActions}>
                      <Pressable
                        style={styles.socialBtn}
                        accessibilityRole="button"
                      >
                        <Feather
                          name="heart"
                          size={16}
                          color={theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.socialText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {event.likes}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.socialBtn}
                        accessibilityRole="button"
                      >
                        <Feather
                          name="message-circle"
                          size={16}
                          color={theme.textSecondary}
                        />
                        <ThemedText
                          style={[
                            styles.socialText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {event.comments}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.socialBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Share event"
                      >
                        <Feather
                          name="share-2"
                          size={16}
                          color={theme.textSecondary}
                        />
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={() => handleBuyTicket(event)}
                      style={({ pressed }) => [
                        styles.buyBtnWrap,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Get tickets for ${event.title}`}
                    >
                      <LinearGradient
                        colors={BrandColors.gradient.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buyBtn}
                      >
                        <ThemedText style={styles.buyBtnText}>
                          Get tickets
                        </ThemedText>
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Hero
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: Spacing.lg,
  },
  heroBadgeWrap: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  heroText: {
    alignItems: "center",
  },
  heroTitle: {
    ...Typography.h2,
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.92)",
    textAlign: "center",
    maxWidth: 320,
  },

  // Content card
  contentCard: {
    flex: 1,
    marginTop: -Spacing["2xl"],
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing["2xl"],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Promote toggle
  promoteToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
  },
  promoteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  promoteTextWrap: {
    flex: 1,
  },
  promoteTitle: {
    ...Typography.body,
    fontWeight: "700",
  },
  promoteHint: {
    ...Typography.small,
    fontSize: 12,
    marginTop: 2,
  },

  // Form
  formCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.label,
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1.5,
  },
  textArea: {
    height: undefined,
    minHeight: 90,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },

  // Event image upload
  eventUploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  eventUploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  eventUploadText: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  eventImagePreviewWrap: {
    width: "100%",
    height: 150,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  eventImagePreview: {
    width: "100%",
    height: "100%",
  },
  eventImageClearBtn: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  formCta: {
    marginTop: Spacing.xl,
  },

  // Section label
  sectionLabel: {
    ...Typography.label,
    letterSpacing: 1.4,
    fontSize: 11,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },

  // Card
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    height: 200,
    position: "relative",
  },
  eventImage: {
    width: "100%",
    height: "100%",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: Spacing.md,
  },
  priceTagWrap: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    shadowColor: BrandColors.primary.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  priceTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  priceText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  titleOverlay: {
    position: "absolute",
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "SpaceGrotesk_700Bold",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  cardContent: {
    padding: Spacing.md,
  },
  organizerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  organizerText: {
    ...Typography.label,
    fontSize: 12,
    fontWeight: "700",
  },
  detailRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
    flexWrap: "wrap",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    ...Typography.small,
    fontSize: 12,
  },
  description: {
    ...Typography.small,
    lineHeight: 18,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  socialActions: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  socialText: {
    ...Typography.small,
    fontSize: 12,
    fontWeight: "600",
  },
  buyBtnWrap: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  buyBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  buyBtnText: {
    color: "#FFFFFF",
    ...Typography.small,
    fontSize: 13,
    fontWeight: "800",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyHint: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },

  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

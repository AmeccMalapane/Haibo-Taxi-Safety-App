import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
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
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  RouteWaypoint,
  CommunityRoute,
  ASSOCIATIONS,
  HAND_SIGNALS,
  PROVINCES,
  generateId,
  saveCommunityRoute,
  getContributorProfile,
  saveContributorProfile,
  POINTS,
} from "@/data/communityRoutes";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ROUTE_TYPES: {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  desc: string;
}[] = [
  { id: "local", label: "Local", icon: "navigation", desc: "Within a city" },
  { id: "regional", label: "Regional", icon: "map", desc: "Between towns" },
  { id: "intercity", label: "Intercity", icon: "globe", desc: "Long distance" },
];

const VEHICLE_TYPES: {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: "minibus", label: "Minibus taxi", icon: "truck" },
  { id: "metered", label: "Metered taxi", icon: "navigation" },
  { id: "e-hailing", label: "E-hailing", icon: "smartphone" },
  { id: "bus", label: "Bus", icon: "square" },
];

const FREQUENCIES = [
  "Every 5 min",
  "Every 10 min",
  "Every 15 min",
  "Every 20 min",
  "Every 30 min",
  "Every hour",
  "When full",
];

export default function RouteSubmissionScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<any>();

  const waypoints: RouteWaypoint[] = route.params?.waypoints || [];
  const routeColor: string = route.params?.color || BrandColors.primary.gradientStart;

  const [routeName, setRouteName] = useState("");
  const [description, setDescription] = useState("");
  const [routeType, setRouteType] = useState("local");
  const [vehicleType, setVehicleType] = useState("minibus");
  const [fare, setFare] = useState("");
  const [handSignal, setHandSignal] = useState("");
  const [handSignalDesc, setHandSignalDesc] = useState("");
  const [association, setAssociation] = useState("");
  const [province, setProvince] = useState("");
  const [operatingHours, setOperatingHours] = useState("");
  const [frequency, setFrequency] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stops = waypoints.filter((w) => w.isStop);
  const originName = stops[0]?.name || "Unknown";
  const destName = stops[stops.length - 1]?.name || "Unknown";
  const autoName = `${originName} to ${destName}`;
  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  const isValid =
    fare.trim().length > 0 &&
    parseFloat(fare) > 0 &&
    province.length > 0 &&
    handSignal.length > 0 &&
    waypoints.length > 0;

  const handleSelect = useCallback((setter: (v: string) => void, value: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setter(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      Alert.alert(
        "Missing info",
        "Please fill in fare, province, and hand signal before submitting."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const profile = await getContributorProfile();

      const newRoute: CommunityRoute = {
        id: generateId(),
        name: routeName.trim() || autoName,
        description: description.trim(),
        routeType: routeType as any,
        vehicleType: vehicleType as any,
        waypoints,
        color: routeColor,
        fare: parseFloat(fare),
        currency: "ZAR",
        handSignal,
        handSignalDescription: handSignalDesc.trim(),
        association: association || "Other",
        operatingHours: operatingHours.trim() || "Varies",
        frequency: frequency || "Varies",
        province,
        contributorId: profile.id,
        contributorName: contributorName.trim() || profile.name,
        status: "pending",
        upvotes: 0,
        downvotes: 0,
        commentCount: 0,
        points: POINTS.SUBMIT_ROUTE,
        stars: 0,
        starredBy: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveCommunityRoute(newRoute);

      const isFirstRoute = profile.routesContributed === 0;
      profile.routesContributed += 1;
      profile.totalPoints +=
        POINTS.SUBMIT_ROUTE + (isFirstRoute ? POINTS.FIRST_ROUTE : 0);
      if (contributorName.trim()) profile.name = contributorName.trim();
      await saveContributorProfile(profile);

      Alert.alert(
        "Route submitted",
        `You earned ${POINTS.SUBMIT_ROUTE}${
          isFirstRoute ? ` + ${POINTS.FIRST_ROUTE} bonus` : ""
        } points. Your route "${newRoute.name}" is now visible to the community for voting.`,
        [
          {
            text: "View my route",
            onPress: () => {
              navigation.popToTop();
              navigation.navigate("CommunityRoutes" as any);
            },
          },
          { text: "Done", onPress: () => navigation.popToTop() },
        ]
      );
    } catch {
      Alert.alert("Error", "Failed to submit route. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValid,
    routeName,
    autoName,
    description,
    routeType,
    vehicleType,
    waypoints,
    routeColor,
    fare,
    handSignal,
    handSignalDesc,
    association,
    operatingHours,
    frequency,
    province,
    contributorName,
    navigation,
  ]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        <LinearGradient
          colors={BrandColors.gradient.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.md }]}
        >
          <View style={styles.heroTopRow}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.glassButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Feather name="arrow-left" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.heroBadge}>
              <Feather name="git-branch" size={16} color="#FFFFFF" />
              <ThemedText style={styles.heroBadgeText}>Submit route</ThemedText>
            </View>
            <View style={styles.heroSpacer} />
          </View>
          <ThemedText style={styles.heroTitle}>Almost there.</ThemedText>
          <ThemedText style={styles.heroSubtitle} numberOfLines={1}>
            {autoName}
          </ThemedText>
        </LinearGradient>

        <View style={styles.content}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(400)}
            style={[styles.previewCard, { backgroundColor: cardSurface }]}
          >
            <View style={[styles.previewAccent, { backgroundColor: routeColor }]} />
            <View style={styles.previewBody}>
              <View style={styles.previewHeader}>
                <View style={[styles.previewDot, { backgroundColor: routeColor }]} />
                <ThemedText style={styles.previewTitle}>
                  {stops.length} stops · {waypoints.length - stops.length} waypoints
                </ThemedText>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.previewStops}
              >
                {stops.map((stop, i) => (
                  <View key={stop.id} style={styles.previewStopItem}>
                    <View style={[styles.previewStopDot, { backgroundColor: routeColor }]}>
                      <ThemedText style={styles.previewStopNum}>{i + 1}</ThemedText>
                    </View>
                    <ThemedText style={styles.previewStopName} numberOfLines={1}>
                      {stop.name}
                    </ThemedText>
                    {i < stops.length - 1 ? (
                      <Feather
                        name="chevron-right"
                        size={12}
                        color={BrandColors.gray[600]}
                        style={{ marginHorizontal: 2 }}
                      />
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Route name</ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: cardSurface }]}>
              <Feather name="edit-3" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={autoName}
                placeholderTextColor={BrandColors.gray[500]}
                value={routeName}
                onChangeText={setRouteName}
              />
            </View>
            <ThemedText style={styles.helperText}>
              Leave blank to auto-generate from stops
            </ThemedText>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(100).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Description</ThemedText>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: cardSurface, color: theme.text },
              ]}
              placeholder="Landmarks, tips for commuters, things to know..."
              placeholderTextColor={BrandColors.gray[500]}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(140).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Route type</ThemedText>
            <View style={styles.typeRow}>
              {ROUTE_TYPES.map((rt) => {
                const selected = routeType === rt.id;
                return (
                  <Pressable
                    key={rt.id}
                    style={[
                      styles.typeCard,
                      { backgroundColor: cardSurface, borderColor: BrandColors.gray[200] },
                      selected && {
                        backgroundColor: `${routeColor}10`,
                        borderColor: routeColor,
                      },
                    ]}
                    onPress={() => handleSelect(setRouteType, rt.id)}
                  >
                    <View
                      style={[
                        styles.typeIconWrap,
                        { backgroundColor: `${routeColor}15` },
                        selected && { backgroundColor: routeColor },
                      ]}
                    >
                      <Feather
                        name={rt.icon}
                        size={18}
                        color={selected ? "#FFFFFF" : routeColor}
                      />
                    </View>
                    <ThemedText
                      style={[
                        styles.typeLabel,
                        selected && { color: routeColor },
                      ]}
                    >
                      {rt.label}
                    </ThemedText>
                    <ThemedText style={styles.typeDesc}>{rt.desc}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(180).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Vehicle type</ThemedText>
            <View style={styles.chipWrap}>
              {VEHICLE_TYPES.map((vt) => {
                const selected = vehicleType === vt.id;
                return (
                  <Pressable
                    key={vt.id}
                    style={[
                      styles.iconChip,
                      { backgroundColor: cardSurface, borderColor: BrandColors.gray[200] },
                      selected && {
                        backgroundColor: routeColor,
                        borderColor: routeColor,
                      },
                    ]}
                    onPress={() => handleSelect(setVehicleType, vt.id)}
                  >
                    <Feather
                      name={vt.icon}
                      size={16}
                      color={selected ? "#FFFFFF" : BrandColors.gray[700]}
                    />
                    <ThemedText
                      style={[
                        styles.iconChipText,
                        selected && { color: "#FFFFFF" },
                      ]}
                    >
                      {vt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(220).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Fare *</ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: cardSurface }]}>
              <ThemedText style={[styles.farePrefix, { color: routeColor }]}>R</ThemedText>
              <TextInput
                style={[styles.fareInput, { color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={BrandColors.gray[500]}
                value={fare}
                onChangeText={setFare}
                keyboardType="decimal-pad"
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(260).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Province *</ThemedText>
            <View style={styles.chipWrap}>
              {PROVINCES.map((p) => {
                const selected = province === p;
                return (
                  <Pressable
                    key={p}
                    style={[
                      styles.chip,
                      { backgroundColor: cardSurface, borderColor: BrandColors.gray[200] },
                      selected && {
                        backgroundColor: routeColor,
                        borderColor: routeColor,
                      },
                    ]}
                    onPress={() => handleSelect(setProvince, p)}
                  >
                    <ThemedText
                      style={[
                        styles.chipText,
                        selected && { color: "#FFFFFF" },
                      ]}
                    >
                      {p}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(300).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Hand signal *</ThemedText>
            <View style={styles.signalGrid}>
              {HAND_SIGNALS.map((hs) => {
                const selected = handSignal === hs.id;
                return (
                  <Pressable
                    key={hs.id}
                    style={[
                      styles.signalCard,
                      { backgroundColor: cardSurface, borderColor: BrandColors.gray[200] },
                      selected && {
                        backgroundColor: `${routeColor}10`,
                        borderColor: routeColor,
                      },
                    ]}
                    onPress={() => handleSelect(setHandSignal, hs.id)}
                  >
                    <ThemedText style={styles.signalEmoji}>{hs.emoji}</ThemedText>
                    <ThemedText
                      style={[
                        styles.signalLabel,
                        selected && { color: routeColor, fontWeight: "700" },
                      ]}
                    >
                      {hs.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {handSignal ? (
              <View
                style={[
                  styles.inputWrap,
                  { backgroundColor: cardSurface, marginTop: Spacing.sm },
                ]}
              >
                <Feather name="info" size={16} color={BrandColors.gray[600]} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Describe how this signal is used (optional)"
                  placeholderTextColor={BrandColors.gray[500]}
                  value={handSignalDesc}
                  onChangeText={setHandSignalDesc}
                />
              </View>
            ) : null}
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(340).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Taxi association</ThemedText>
            <View style={styles.chipWrap}>
              {ASSOCIATIONS.map((a) => {
                const selected = association === a;
                return (
                  <Pressable
                    key={a}
                    style={[
                      styles.chip,
                      { backgroundColor: cardSurface, borderColor: BrandColors.gray[200] },
                      selected && {
                        backgroundColor: routeColor,
                        borderColor: routeColor,
                      },
                    ]}
                    onPress={() => handleSelect(setAssociation, a)}
                  >
                    <ThemedText
                      style={[
                        styles.chipText,
                        selected && { color: "#FFFFFF" },
                      ]}
                    >
                      {a}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(380).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Operating hours</ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: cardSurface }]}>
              <Feather name="clock" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="e.g. 04:30 - 21:00"
                placeholderTextColor={BrandColors.gray[500]}
                value={operatingHours}
                onChangeText={setOperatingHours}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(420).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Frequency</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => {
                  const selected = frequency === f;
                  return (
                    <Pressable
                      key={f}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: cardSurface,
                          borderColor: BrandColors.gray[200],
                        },
                        selected && {
                          backgroundColor: routeColor,
                          borderColor: routeColor,
                        },
                      ]}
                      onPress={() => handleSelect(setFrequency, f)}
                    >
                      <ThemedText
                        style={[
                          styles.chipText,
                          selected && { color: "#FFFFFF" },
                        ]}
                      >
                        {f}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(460).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Your name (optional)</ThemedText>
            <View style={[styles.inputWrap, { backgroundColor: cardSurface }]}>
              <Feather name="user" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Display name for your contribution"
                placeholderTextColor={BrandColors.gray[500]}
                value={contributorName}
                onChangeText={setContributorName}
              />
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(500).duration(400)}
            style={[styles.pointsCard, { backgroundColor: cardSurface }]}
          >
            <View style={styles.pointsIconWrap}>
              <Feather name="award" size={20} color={BrandColors.secondary.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.pointsTitle}>
                Earn {POINTS.SUBMIT_ROUTE} points for this submission
              </ThemedText>
              <ThemedText style={styles.pointsDesc}>
                +{POINTS.ROUTE_VERIFIED} bonus when verified by the community
              </ThemedText>
            </View>
          </Animated.View>
        </View>
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.submitBar,
          {
            backgroundColor: theme.backgroundDefault,
            paddingBottom: insets.bottom + Spacing.sm,
            borderTopColor: BrandColors.gray[100],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: isValid ? routeColor : BrandColors.gray[300],
              opacity: pressed && isValid ? 0.92 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="send" size={18} color="#FFFFFF" />
              <ThemedText style={styles.submitButtonText}>
                Submit for community review
              </ThemedText>
            </>
          )}
        </Pressable>
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
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
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
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  heroBadgeText: {
    ...Typography.label,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  heroSpacer: {
    width: 40,
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
  content: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing["2xl"],
  },
  previewCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  previewAccent: {
    width: 4,
  },
  previewBody: {
    flex: 1,
    padding: Spacing.md,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewTitle: {
    ...Typography.small,
    fontWeight: "700",
  },
  previewStops: {
    flexDirection: "row",
  },
  previewStopItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewStopDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  previewStopNum: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  previewStopName: {
    ...Typography.label,
    fontWeight: "600",
    maxWidth: 80,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    fontWeight: "700",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  input: {
    ...Typography.body,
    flex: 1,
    height: 48,
  },
  textArea: {
    ...Typography.body,
    minHeight: 90,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  helperText: {
    ...Typography.label,
    color: BrandColors.gray[500],
    marginTop: 6,
    marginLeft: 4,
  },
  typeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  typeCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  typeLabel: {
    ...Typography.small,
    fontWeight: "700",
  },
  typeDesc: {
    ...Typography.label,
    color: BrandColors.gray[500],
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  iconChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  iconChipText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.gray[700],
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.gray[700],
  },
  farePrefix: {
    ...Typography.h3,
    fontWeight: "800",
  },
  fareInput: {
    ...Typography.h3,
    flex: 1,
    height: 56,
    fontWeight: "700",
  },
  signalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  signalCard: {
    flexBasis: "22%",
    flexGrow: 1,
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  signalEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  signalLabel: {
    ...Typography.label,
    fontWeight: "600",
    textAlign: "center",
  },
  freqRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  pointsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderColor: BrandColors.secondary.orange + "33",
  },
  pointsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.secondary.orange + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  pointsTitle: {
    ...Typography.small,
    fontWeight: "700",
  },
  pointsDesc: {
    ...Typography.label,
    color: BrandColors.gray[600],
    marginTop: 2,
  },
  submitBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "800",
  },
});

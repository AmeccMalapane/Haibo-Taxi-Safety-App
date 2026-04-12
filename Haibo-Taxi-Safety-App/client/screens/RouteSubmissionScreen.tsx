/**
 * RouteSubmissionScreen — Taxi-specific metadata form
 * Receives waypoints + color from RouteDrawingScreen,
 * collects fare, hand signal, association, operating hours, etc.
 */
import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
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

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
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

const ROUTE_TYPES = [
  { id: "local", label: "Local", icon: "navigation" as const, desc: "Within a city" },
  { id: "regional", label: "Regional", icon: "map" as const, desc: "Between towns" },
  { id: "intercity", label: "Intercity", icon: "globe" as const, desc: "Long distance" },
];

const VEHICLE_TYPES = [
  { id: "minibus", label: "Minibus Taxi", icon: "truck" as const },
  { id: "metered", label: "Metered Taxi", icon: "navigation" as const },
  { id: "e-hailing", label: "E-Hailing", icon: "smartphone" as const },
  { id: "bus", label: "Bus", icon: "square" as const },
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
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();

  const waypoints: RouteWaypoint[] = route.params?.waypoints || [];
  const routeColor: string = route.params?.color || "#E72369";

  // Form state
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

  // Auto-generate route name
  const autoName = `${originName} to ${destName}`;

  const isValid =
    (routeName.trim() || autoName) &&
    fare.trim() &&
    parseFloat(fare) > 0 &&
    province &&
    handSignal;

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      Alert.alert("Missing Info", "Please fill in fare, province, and hand signal.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (Platform.OS !== "web") {
        try {
          const Haptics = require("expo-haptics");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
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

      // Update contributor profile
      const isFirstRoute = profile.routesContributed === 0;
      profile.routesContributed += 1;
      profile.totalPoints += POINTS.SUBMIT_ROUTE + (isFirstRoute ? POINTS.FIRST_ROUTE : 0);
      if (contributorName.trim()) profile.name = contributorName.trim();
      await saveContributorProfile(profile);

      Alert.alert(
        "Route Submitted! 🎉",
        `You earned ${POINTS.SUBMIT_ROUTE}${isFirstRoute ? ` + ${POINTS.FIRST_ROUTE} bonus` : ""} points!\n\nYour route "${newRoute.name}" is now visible to the community for voting.`,
        [
          {
            text: "View My Route",
            onPress: () => {
              // Navigate back to community explore
              navigation.popToTop();
              navigation.navigate("CommunityRoutes" as any);
            },
          },
          {
            text: "Done",
            onPress: () => navigation.popToTop(),
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to submit route. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isValid, routeName, autoName, description, routeType, vehicleType,
    waypoints, routeColor, fare, handSignal, handSignalDesc, association,
    operatingHours, frequency, province, contributorName, navigation,
  ]);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* Route preview card */}
        <View style={[styles.previewCard, { backgroundColor: `${routeColor}10`, borderColor: routeColor }]}>
          <View style={styles.previewHeader}>
            <View style={[styles.previewDot, { backgroundColor: routeColor }]} />
            <ThemedText style={styles.previewTitle}>
              {stops.length} stops · {waypoints.length - stops.length} waypoints
            </ThemedText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewStops}>
            {stops.map((stop, i) => (
              <View key={stop.id} style={styles.previewStopItem}>
                <View style={[styles.previewStopDot, { backgroundColor: routeColor }]}>
                  <Text style={styles.previewStopNum}>{i + 1}</Text>
                </View>
                <Text style={[styles.previewStopName, { color: theme.text }]} numberOfLines={1}>
                  {stop.name}
                </Text>
                {i < stops.length - 1 && (
                  <Feather name="chevron-right" size={12} color={BrandColors.gray[400]} style={{ marginHorizontal: 2 }} />
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Route Name */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Route Name</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            placeholder={autoName}
            placeholderTextColor={theme.textSecondary}
            value={routeName}
            onChangeText={setRouteName}
          />
          <ThemedText style={[styles.helperText, { color: theme.textSecondary }]}>
            Leave blank to auto-generate from stops
          </ThemedText>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Description</ThemedText>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            placeholder="Describe this route — landmarks, tips for commuters..."
            placeholderTextColor={theme.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            maxLength={500}
            textAlignVertical="top"
          />
        </View>

        {/* Route Type */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Route Type</ThemedText>
          <View style={styles.chipRow}>
            {ROUTE_TYPES.map((rt) => (
              <Pressable
                key={rt.id}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: routeType === rt.id ? `${routeColor}15` : theme.backgroundDefault,
                    borderColor: routeType === rt.id ? routeColor : "transparent",
                  },
                ]}
                onPress={() => setRouteType(rt.id)}
              >
                <Feather
                  name={rt.icon}
                  size={20}
                  color={routeType === rt.id ? routeColor : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.typeLabel,
                    { color: routeType === rt.id ? routeColor : theme.text },
                  ]}
                >
                  {rt.label}
                </Text>
                <Text style={[styles.typeDesc, { color: theme.textSecondary }]}>{rt.desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Vehicle Type */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Vehicle Type</ThemedText>
          <View style={styles.chipRow}>
            {VEHICLE_TYPES.map((vt) => (
              <Pressable
                key={vt.id}
                style={[
                  styles.vehicleChip,
                  {
                    backgroundColor: vehicleType === vt.id ? routeColor : theme.backgroundDefault,
                  },
                ]}
                onPress={() => setVehicleType(vt.id)}
              >
                <Feather
                  name={vt.icon}
                  size={16}
                  color={vehicleType === vt.id ? "#FFFFFF" : theme.text}
                />
                <Text
                  style={[
                    styles.vehicleChipText,
                    { color: vehicleType === vt.id ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {vt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Fare */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Fare (ZAR) *</ThemedText>
          <View style={styles.fareRow}>
            <Text style={[styles.farePrefix, { color: theme.textSecondary }]}>R</Text>
            <TextInput
              style={[styles.fareInput, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              value={fare}
              onChangeText={setFare}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Province */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Province *</ThemedText>
          <View style={styles.chipWrap}>
            {PROVINCES.map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.provinceChip,
                  {
                    backgroundColor: province === p ? routeColor : theme.backgroundDefault,
                  },
                ]}
                onPress={() => setProvince(p)}
              >
                <Text
                  style={[
                    styles.provinceChipText,
                    { color: province === p ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Hand Signal */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Hand Signal *</ThemedText>
          <View style={styles.signalGrid}>
            {HAND_SIGNALS.map((hs) => (
              <Pressable
                key={hs.id}
                style={[
                  styles.signalCard,
                  {
                    backgroundColor: handSignal === hs.id ? `${routeColor}15` : theme.backgroundDefault,
                    borderColor: handSignal === hs.id ? routeColor : "transparent",
                  },
                ]}
                onPress={() => setHandSignal(hs.id)}
              >
                <Text style={styles.signalEmoji}>{hs.emoji}</Text>
                <Text
                  style={[
                    styles.signalLabel,
                    { color: handSignal === hs.id ? routeColor : theme.text },
                  ]}
                >
                  {hs.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {handSignal && (
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text, marginTop: 8 }]}
              placeholder="Describe how this signal is used..."
              placeholderTextColor={theme.textSecondary}
              value={handSignalDesc}
              onChangeText={setHandSignalDesc}
            />
          )}
        </View>

        {/* Association */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Taxi Association</ThemedText>
          <View style={styles.chipWrap}>
            {ASSOCIATIONS.map((a) => (
              <Pressable
                key={a}
                style={[
                  styles.provinceChip,
                  {
                    backgroundColor: association === a ? routeColor : theme.backgroundDefault,
                  },
                ]}
                onPress={() => setAssociation(a)}
              >
                <Text
                  style={[
                    styles.provinceChipText,
                    { color: association === a ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {a}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Operating Hours */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Operating Hours</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            placeholder="e.g., 04:30 - 21:00"
            placeholderTextColor={theme.textSecondary}
            value={operatingHours}
            onChangeText={setOperatingHours}
          />
        </View>

        {/* Frequency */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Frequency</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.freqRow}>
              {FREQUENCIES.map((f) => (
                <Pressable
                  key={f}
                  style={[
                    styles.freqChip,
                    {
                      backgroundColor: frequency === f ? routeColor : theme.backgroundDefault,
                    },
                  ]}
                  onPress={() => setFrequency(f)}
                >
                  <Text
                    style={[
                      styles.freqChipText,
                      { color: frequency === f ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Contributor Name */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Your Name (optional)</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.backgroundDefault, color: theme.text }]}
            placeholder="Display name for your contribution"
            placeholderTextColor={theme.textSecondary}
            value={contributorName}
            onChangeText={setContributorName}
          />
        </View>

        {/* Points info */}
        <View style={[styles.pointsCard, { backgroundColor: `${BrandColors.secondary.orange}10` }]}>
          <Feather name="award" size={20} color={BrandColors.secondary.orange} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.pointsTitle}>
              You'll earn {POINTS.SUBMIT_ROUTE} points for this submission
            </ThemedText>
            <ThemedText style={[styles.pointsDesc, { color: theme.textSecondary }]}>
              +{POINTS.ROUTE_VERIFIED} bonus when verified by the community
            </ThemedText>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>

      {/* Submit bar */}
      <View style={[styles.submitBar, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 8 }]}>
        <Pressable
          style={[
            styles.submitButton,
            {
              backgroundColor: isValid ? routeColor : BrandColors.gray[400],
              opacity: isSubmitting ? 0.7 : 1,
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
              <Text style={styles.submitButtonText}>Submit for Community Review</Text>
            </>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.lg },
  // Preview card
  previewCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  previewDot: { width: 12, height: 12, borderRadius: 6 },
  previewTitle: { fontSize: 14, fontWeight: "600" },
  previewStops: { flexDirection: "row" },
  previewStopItem: { flexDirection: "row", alignItems: "center" },
  previewStopDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  previewStopNum: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  previewStopName: { fontSize: 12, fontWeight: "500", maxWidth: 80 },
  // Sections
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: {
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  helperText: { fontSize: 12, marginTop: 4, marginLeft: 4 },
  // Route type
  chipRow: { flexDirection: "row", gap: 8 },
  typeCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: 4,
  },
  typeLabel: { fontSize: 13, fontWeight: "600" },
  typeDesc: { fontSize: 11 },
  // Vehicle type
  vehicleChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  vehicleChipText: { fontSize: 13, fontWeight: "500" },
  // Fare
  fareRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  farePrefix: { fontSize: 20, fontWeight: "700" },
  fareInput: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 20,
    fontWeight: "600",
  },
  // Province / Association chips
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  provinceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  provinceChipText: { fontSize: 13, fontWeight: "500" },
  // Hand signal
  signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  signalCard: {
    width: "22%",
    alignItems: "center",
    padding: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
  },
  signalEmoji: { fontSize: 24, marginBottom: 4 },
  signalLabel: { fontSize: 11, textAlign: "center", fontWeight: "500" },
  // Frequency
  freqRow: { flexDirection: "row", gap: 8 },
  freqChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  freqChipText: { fontSize: 13, fontWeight: "500" },
  // Points card
  pointsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 10,
    marginTop: Spacing.md,
  },
  pointsTitle: { fontSize: 14, fontWeight: "600" },
  pointsDesc: { fontSize: 12, marginTop: 2 },
  // Submit bar
  submitBar: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});

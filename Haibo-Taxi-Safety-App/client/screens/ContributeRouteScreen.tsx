import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { GradientButton } from "@/components/GradientButton";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { getDeviceId } from "@/lib/deviceId";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PROVINCES = [
  "Gauteng",
  "Western Cape",
  "KwaZulu-Natal",
  "Eastern Cape",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
];

const ROUTE_TYPES: {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  hint: string;
}[] = [
  { id: "local", label: "Local", icon: "navigation", hint: "Short hops" },
  { id: "regional", label: "Regional", icon: "map", hint: "Between towns" },
  { id: "intercity", label: "Intercity", icon: "globe", hint: "Cross-province" },
];

const HAND_SIGNALS: { id: string; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "point_up", label: "Point up", icon: "arrow-up" },
  { id: "point_down", label: "Point down", icon: "arrow-down" },
  { id: "fist", label: "Fist", icon: "square" },
  { id: "flat_hand", label: "Flat hand", icon: "minus" },
  { id: "two_fingers", label: "Two fingers", icon: "chevrons-up" },
  { id: "circle", label: "Circle", icon: "circle" },
];

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export default function ContributeRouteScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [origin, setOrigin] = useState("");
  const [originLocation, setOriginLocation] = useState<LocationData | null>(null);
  const [destination, setDestination] = useState("");
  const [destinationLocation, setDestinationLocation] = useState<LocationData | null>(null);
  const [taxiRankName, setTaxiRankName] = useState("");
  const [fare, setFare] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [distance, setDistance] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedRouteType, setSelectedRouteType] = useState("local");
  const [selectedHandSignal, setSelectedHandSignal] = useState("");
  const [handSignalDescription, setHandSignalDescription] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [loadingLocation, setLoadingLocation] = useState<"origin" | "destination" | null>(null);
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    getDeviceId().then(setDeviceId).catch(() => setDeviceId(""));
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/contributions", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contributions"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Route submitted",
        "Thank you for contributing! Your route will be reviewed by the community before being added.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      Alert.alert("Error", error?.message || "Failed to submit contribution. Please try again.");
    },
  });

  const isFormValid = Boolean(
    origin.trim() &&
      destination.trim() &&
      fare.trim() &&
      parseFloat(fare) > 0 &&
      selectedProvince &&
      selectedHandSignal
  );

  const handleUseLocation = async (type: "origin" | "destination") => {
    setLoadingLocation(type);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location permission is required. Please enable it in your device settings."
        );
        setLoadingLocation(null);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;

      let address = "";
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode) {
          const parts = [geocode.name, geocode.street, geocode.city, geocode.region].filter(Boolean);
          address = parts.join(", ");
        }
      } catch {
        address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }

      const data: LocationData = { latitude, longitude, address };
      if (type === "origin") {
        setOrigin(address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setOriginLocation(data);
      } else {
        setDestination(address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setDestinationLocation(data);
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("Error", "Failed to get your location. Please try again or enter manually.");
    } finally {
      setLoadingLocation(null);
    }
  };

  const handleSubmit = () => {
    if (!isFormValid) {
      Alert.alert("Missing info", "Please fill in all required fields.");
      return;
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    submitMutation.mutate({
      origin: origin.trim(),
      originLatitude: originLocation?.latitude,
      originLongitude: originLocation?.longitude,
      destination: destination.trim(),
      destinationLatitude: destinationLocation?.latitude,
      destinationLongitude: destinationLocation?.longitude,
      taxiRankName: taxiRankName.trim() || null,
      fare: parseFloat(fare),
      currency: "ZAR",
      estimatedTime: estimatedTime.trim() || null,
      distance: distance.trim() ? parseFloat(distance) : null,
      province: selectedProvince,
      routeType: selectedRouteType,
      handSignal: selectedHandSignal,
      handSignalDescription: handSignalDescription.trim() || null,
      additionalNotes: additionalNotes.trim() || null,
      contributorName: contributorName.trim() || null,
      deviceId,
    });
  };

  const handleSelect = (setter: (v: string) => void, value: string) => {
    Haptics.selectionAsync();
    setter(value);
  };

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
            style={styles.heroCloseButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroBadge}>
            <Feather name="git-branch" size={16} color="#FFFFFF" />
            <ThemedText style={styles.heroBadgeText}>Contribute</ThemedText>
          </View>
          <View style={styles.heroSpacer} />
        </View>
        <ThemedText style={styles.heroTitle}>Share a route.</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Add a taxi route so every commuter in Mzansi can find their way.
        </ThemedText>
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)} style={styles.infoCard}>
          <Feather name="info" size={16} color={BrandColors.primary.gradientStart} />
          <ThemedText style={styles.infoText}>
            Submitted routes are reviewed and voted on by the community before being added.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Route details</ThemedText>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <ThemedText style={styles.fieldLabel}>From *</ThemedText>
              <Pressable
                style={styles.locationButton}
                onPress={() => handleUseLocation("origin")}
                disabled={loadingLocation === "origin"}
              >
                {loadingLocation === "origin" ? (
                  <ActivityIndicator size="small" color={BrandColors.primary.gradientStart} />
                ) : (
                  <>
                    <Feather name="map-pin" size={12} color={BrandColors.primary.gradientStart} />
                    <ThemedText style={styles.locationButtonText}>Use my location</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
            <View style={styles.inputWrap}>
              <Feather name="navigation" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Soweto (Baragwanath)"
                placeholderTextColor={BrandColors.gray[500]}
                value={origin}
                onChangeText={(text) => {
                  setOrigin(text);
                  if (originLocation) setOriginLocation(null);
                }}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <ThemedText style={styles.fieldLabel}>To *</ThemedText>
              <Pressable
                style={styles.locationButton}
                onPress={() => handleUseLocation("destination")}
                disabled={loadingLocation === "destination"}
              >
                {loadingLocation === "destination" ? (
                  <ActivityIndicator size="small" color={BrandColors.primary.gradientStart} />
                ) : (
                  <>
                    <Feather name="map-pin" size={12} color={BrandColors.primary.gradientStart} />
                    <ThemedText style={styles.locationButtonText}>Use my location</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
            <View style={styles.inputWrap}>
              <Feather name="flag" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Johannesburg CBD (Noord)"
                placeholderTextColor={BrandColors.gray[500]}
                value={destination}
                onChangeText={(text) => {
                  setDestination(text);
                  if (destinationLocation) setDestinationLocation(null);
                }}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.fieldLabel}>Taxi rank name</ThemedText>
            <View style={styles.inputWrap}>
              <Feather name="home" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Baragwanath Taxi Rank"
                placeholderTextColor={BrandColors.gray[500]}
                value={taxiRankName}
                onChangeText={setTaxiRankName}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <ThemedText style={styles.fieldLabel}>Fare *</ThemedText>
              <View style={styles.inputWrap}>
                <ThemedText style={styles.currencyPrefix}>R</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="25"
                  placeholderTextColor={BrandColors.gray[500]}
                  value={fare}
                  onChangeText={setFare}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.sm }]}>
              <ThemedText style={styles.fieldLabel}>Est. time</ThemedText>
              <View style={styles.inputWrap}>
                <Feather name="clock" size={16} color={BrandColors.gray[600]} />
                <TextInput
                  style={styles.input}
                  placeholder="45 min"
                  placeholderTextColor={BrandColors.gray[500]}
                  value={estimatedTime}
                  onChangeText={setEstimatedTime}
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.fieldLabel}>Distance (km)</ThemedText>
            <View style={styles.inputWrap}>
              <Feather name="trending-up" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={styles.input}
                placeholder="15"
                placeholderTextColor={BrandColors.gray[500]}
                value={distance}
                onChangeText={setDistance}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(120).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Route type</ThemedText>
          <View style={styles.routeTypeRow}>
            {ROUTE_TYPES.map((t) => {
              const selected = selectedRouteType === t.id;
              return (
                <Pressable
                  key={t.id}
                  style={[styles.routeTypeCard, selected && styles.routeTypeCardActive]}
                  onPress={() => handleSelect(setSelectedRouteType, t.id)}
                >
                  <View
                    style={[
                      styles.routeTypeIconWrap,
                      selected && styles.routeTypeIconWrapActive,
                    ]}
                  >
                    <Feather
                      name={t.icon}
                      size={18}
                      color={selected ? "#FFFFFF" : BrandColors.primary.gradientStart}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.routeTypeLabel,
                      selected && styles.routeTypeLabelActive,
                    ]}
                  >
                    {t.label}
                  </ThemedText>
                  <ThemedText style={styles.routeTypeHint}>{t.hint}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(180).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Province *</ThemedText>
          <View style={styles.chipRow}>
            {PROVINCES.map((province) => {
              const selected = selectedProvince === province;
              return (
                <Pressable
                  key={province}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => handleSelect(setSelectedProvince, province)}
                >
                  <ThemedText
                    style={[styles.chipText, selected && styles.chipTextActive]}
                  >
                    {province}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(240).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Hand signal *</ThemedText>
          <View style={styles.signalGrid}>
            {HAND_SIGNALS.map((signal) => {
              const selected = selectedHandSignal === signal.id;
              return (
                <Pressable
                  key={signal.id}
                  style={[styles.signalCard, selected && styles.signalCardActive]}
                  onPress={() => handleSelect(setSelectedHandSignal, signal.id)}
                >
                  <View
                    style={[
                      styles.signalIconWrap,
                      selected && styles.signalIconWrapActive,
                    ]}
                  >
                    <Feather
                      name={signal.icon}
                      size={18}
                      color={selected ? "#FFFFFF" : BrandColors.primary.gradientStart}
                    />
                  </View>
                  <ThemedText
                    style={[
                      styles.signalLabel,
                      selected && styles.signalLabelActive,
                    ]}
                  >
                    {signal.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.inputGroup, { marginTop: Spacing.md }]}>
            <ThemedText style={styles.fieldLabel}>Signal description (optional)</ThemedText>
            <TextInput
              style={styles.textArea}
              placeholder="Describe how commuters use this signal"
              placeholderTextColor={BrandColors.gray[500]}
              value={handSignalDescription}
              onChangeText={setHandSignalDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(300).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Additional info</ThemedText>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <ThemedText style={styles.fieldLabel}>Notes</ThemedText>
              <ThemedText style={styles.charCount}>
                {additionalNotes.length}/500
              </ThemedText>
            </View>
            <TextInput
              style={styles.textArea}
              placeholder="Any additional information about this route..."
              placeholderTextColor={BrandColors.gray[500]}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.fieldLabel}>Your name (optional)</ThemedText>
            <View style={styles.inputWrap}>
              <Feather name="user" size={16} color={BrandColors.gray[600]} />
              <TextInput
                style={styles.input}
                placeholder="Display name for your contribution"
                placeholderTextColor={BrandColors.gray[500]}
                value={contributorName}
                onChangeText={setContributorName}
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(360).duration(400)} style={styles.processCard}>
          <ThemedText style={styles.processTitle}>What happens next?</ThemedText>
          <View style={styles.processItem}>
            <View style={styles.processDot} />
            <ThemedText style={styles.processText}>
              Community reviews your submission
            </ThemedText>
          </View>
          <View style={styles.processItem}>
            <View style={styles.processDot} />
            <ThemedText style={styles.processText}>
              Other users vote to verify the information
            </ThemedText>
          </View>
          <View style={styles.processItem}>
            <View style={styles.processDot} />
            <ThemedText style={styles.processText}>
              Approved routes appear in the official route list
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(420).duration(400)}>
          <GradientButton
            onPress={handleSubmit}
            disabled={!isFormValid || submitMutation.isPending}
            icon={submitMutation.isPending ? undefined : "send"}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit for review"}
          </GradientButton>
          <ThemedText style={styles.footerNote}>
            Please ensure information is accurate. False submissions may be removed.
          </ThemedText>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
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
  heroCloseButton: {
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing["2xl"],
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.primary.gradientStart + "0A",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "25",
  },
  infoText: {
    ...Typography.small,
    flex: 1,
    color: BrandColors.gray[700],
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
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  fieldLabel: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[700],
  },
  charCount: {
    ...Typography.label,
    color: BrandColors.gray[500],
    fontVariant: ["tabular-nums"],
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
  },
  locationButtonText: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    backgroundColor: "#FFFFFF",
  },
  input: {
    ...Typography.body,
    flex: 1,
    height: 48,
    color: BrandColors.gray[900],
  },
  currencyPrefix: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  textArea: {
    ...Typography.body,
    minHeight: 90,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    backgroundColor: "#FFFFFF",
    color: BrandColors.gray[900],
  },
  row: {
    flexDirection: "row",
  },
  routeTypeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  routeTypeCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    gap: 4,
  },
  routeTypeCardActive: {
    backgroundColor: BrandColors.primary.gradientStart + "0A",
    borderColor: BrandColors.primary.gradientStart,
  },
  routeTypeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  routeTypeIconWrapActive: {
    backgroundColor: BrandColors.primary.gradientStart,
  },
  routeTypeLabel: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[800],
  },
  routeTypeLabelActive: {
    color: BrandColors.primary.gradientStart,
  },
  routeTypeHint: {
    ...Typography.label,
    color: BrandColors.gray[500],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  chipActive: {
    backgroundColor: BrandColors.primary.gradientStart,
    borderColor: BrandColors.primary.gradientStart,
  },
  chipText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.primary.gradientStart,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  signalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  signalCard: {
    flexBasis: "31%",
    flexGrow: 1,
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    gap: 4,
  },
  signalCardActive: {
    backgroundColor: BrandColors.primary.gradientStart + "0A",
    borderColor: BrandColors.primary.gradientStart,
  },
  signalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  signalIconWrapActive: {
    backgroundColor: BrandColors.primary.gradientStart,
  },
  signalLabel: {
    ...Typography.label,
    fontWeight: "600",
    color: BrandColors.gray[700],
    textAlign: "center",
  },
  signalLabelActive: {
    color: BrandColors.primary.gradientStart,
    fontWeight: "700",
  },
  processCard: {
    marginTop: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: BrandColors.primary.gradientStart + "08",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "25",
    gap: Spacing.sm,
  },
  processTitle: {
    ...Typography.h4,
    color: BrandColors.primary.gradientStart,
    marginBottom: Spacing.xs,
  },
  processItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  processDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.primary.gradientStart,
  },
  processText: {
    ...Typography.small,
    color: BrandColors.gray[700],
    flex: 1,
  },
  footerNote: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    marginTop: Spacing.md,
    fontStyle: "italic",
  },
});

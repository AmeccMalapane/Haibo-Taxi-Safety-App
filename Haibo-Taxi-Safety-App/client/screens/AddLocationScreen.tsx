import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { GradientButton } from "@/components/GradientButton";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { LocationType, NewLocationData } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type AddLocationRouteProp = RouteProp<RootStackParamList, "AddLocation">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LOCATION_TYPES: {
  type: LocationType;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { type: "rank", label: "Taxi Rank", icon: "home" },
  { type: "formal_stop", label: "Formal Stop", icon: "map-pin" },
  { type: "informal_stop", label: "Informal Stop", icon: "navigation" },
  { type: "landmark", label: "Landmark", icon: "flag" },
  { type: "interchange", label: "Interchange", icon: "repeat" },
];

export default function AddLocationScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<AddLocationRouteProp>();
  const queryClient = useQueryClient();

  const passedCoords = route.params;
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("informal_stop");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(passedCoords?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(passedCoords?.longitude ?? null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const hasPinnedLocation = Boolean(passedCoords?.latitude);

  const mutation = useMutation({
    mutationFn: async (data: NewLocationData) => {
      return apiRequest("/api/map/locations", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/map/locations"] });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Location added",
        "Your stop has been submitted. It will appear on the map after community review.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    },
    onError: () => {
      Alert.alert("Error", "Failed to add location. Please try again.");
    },
  });

  useEffect(() => {
    if (!hasPinnedLocation) {
      getCurrentLocation();
    }
  }, []);

  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Location permission is needed to add a stop at your current position."
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);

      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (geocode) {
        const parts = [geocode.street, geocode.city, geocode.region].filter(Boolean);
        setAddress(parts.join(", "));
      }
    } catch {
      // silent — location is optional until submit
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter a name for this location.");
      return;
    }
    if (latitude == null || longitude == null) {
      Alert.alert("Missing coordinates", "Please capture your GPS location first.");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      type,
      latitude,
      longitude,
      address: address.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  const isFormValid = name.trim().length > 0 && latitude !== null && longitude !== null;

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
            <Feather name="map-pin" size={16} color="#FFFFFF" />
            <ThemedText style={styles.heroBadgeText}>Add stop</ThemedText>
          </View>
          <View style={styles.heroSpacer} />
        </View>
        <ThemedText style={styles.heroTitle}>Pin a taxi stop.</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Help commuters find safe pickup points across Mzansi.
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
            Verified stops help other commuters find safe pickup points. Your
            submission is reviewed by the community before it goes live.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(60).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Location type</ThemedText>
          <View style={styles.typeGrid}>
            {LOCATION_TYPES.map((item) => {
              const selected = type === item.type;
              return (
                <Pressable
                  key={item.type}
                  style={[styles.typeButton, selected && styles.typeButtonActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setType(item.type);
                  }}
                >
                  <View
                    style={[
                      styles.typeIconWrap,
                      selected && styles.typeIconWrapActive,
                    ]}
                  >
                    <Feather
                      name={item.icon}
                      size={18}
                      color={selected ? "#FFFFFF" : BrandColors.primary.gradientStart}
                    />
                  </View>
                  <ThemedText
                    style={[styles.typeLabel, selected && styles.typeLabelActive]}
                  >
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(120).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Location details</ThemedText>

          <View style={styles.inputWrap}>
            <Feather name="map-pin" size={16} color={BrandColors.gray[600]} />
            <TextInput
              style={styles.input}
              placeholder="Stop name (e.g. Corner Bree & Sauer)"
              placeholderTextColor={BrandColors.gray[500]}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputWrap}>
            <Feather name="home" size={16} color={BrandColors.gray[600]} />
            <TextInput
              style={styles.input}
              placeholder="Address"
              placeholderTextColor={BrandColors.gray[500]}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          <View style={[styles.inputWrap, styles.textAreaWrap]}>
            <Feather
              name="file-text"
              size={16}
              color={BrandColors.gray[600]}
              style={{ marginTop: 14 }}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (landmarks, queue location...)"
              placeholderTextColor={BrandColors.gray[500]}
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
            />
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(180).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>GPS coordinates</ThemedText>
          <View style={styles.gpsCard}>
            {isLoadingLocation ? (
              <View style={styles.gpsRow}>
                <ActivityIndicator size="small" color={BrandColors.primary.gradientStart} />
                <ThemedText style={styles.gpsMutedText}>Getting location...</ThemedText>
              </View>
            ) : latitude !== null && longitude !== null ? (
              <>
                <View style={styles.gpsRow}>
                  <View style={styles.gpsIconWrap}>
                    <Feather
                      name="crosshair"
                      size={16}
                      color={BrandColors.status.success}
                    />
                  </View>
                  <ThemedText style={styles.gpsValue}>
                    {latitude.toFixed(6)}, {longitude.toFixed(6)}
                  </ThemedText>
                </View>
                <Pressable
                  style={styles.refreshButton}
                  onPress={getCurrentLocation}
                >
                  <Feather name="refresh-cw" size={16} color={BrandColors.primary.gradientStart} />
                  <ThemedText style={styles.refreshButtonText}>Update location</ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.gpsRow} onPress={getCurrentLocation}>
                <View style={styles.gpsIconWrap}>
                  <Feather
                    name="navigation"
                    size={16}
                    color={BrandColors.primary.gradientStart}
                  />
                </View>
                <ThemedText style={styles.getGpsText}>Get current location</ThemedText>
              </Pressable>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(240).duration(400)}>
          <GradientButton
            onPress={handleSubmit}
            disabled={!isFormValid || mutation.isPending}
            icon={mutation.isPending ? undefined : "check"}
          >
            {mutation.isPending ? "Submitting..." : "Submit stop"}
          </GradientButton>
          <ThemedText style={styles.footerNote}>
            Your contribution will be reviewed by the community before appearing on the map.
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
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeButton: {
    flexBasis: "31%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  typeButtonActive: {
    backgroundColor: BrandColors.primary.gradientStart + "0A",
    borderColor: BrandColors.primary.gradientStart,
  },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BrandColors.primary.gradientStart + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  typeIconWrapActive: {
    backgroundColor: BrandColors.primary.gradientStart,
  },
  typeLabel: {
    ...Typography.label,
    fontWeight: "600",
    color: BrandColors.gray[700],
    textAlign: "center",
  },
  typeLabelActive: {
    color: BrandColors.primary.gradientStart,
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
    backgroundColor: "#FFFFFF",
    marginBottom: Spacing.sm,
  },
  textAreaWrap: {
    alignItems: "flex-start",
    minHeight: 90,
  },
  input: {
    ...Typography.body,
    flex: 1,
    height: 48,
    color: BrandColors.gray[900],
  },
  textArea: {
    minHeight: 84,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    height: undefined,
  },
  gpsCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    gap: Spacing.md,
  },
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  gpsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  gpsValue: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.gray[900],
    fontVariant: ["tabular-nums"],
    flex: 1,
  },
  gpsMutedText: {
    ...Typography.body,
    color: BrandColors.gray[600],
  },
  getGpsText: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
  },
  refreshButtonText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  footerNote: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    marginTop: Spacing.md,
  },
});

import React, { useState, useEffect, useCallback } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ThemedText } from "@/components/ThemedText";
import { GradientButton } from "@/components/GradientButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { getDeviceId } from "@/lib/deviceId";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  PASOP_CATEGORY_LIST,
  PasopCategory,
  createPasopReport,
  savePasopReport,
} from "@/data/pasopReports";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PasopReportScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<PasopCategory | null>(null);
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  const [locationLabel, setLocationLabel] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cardSurface = isDark ? theme.surface : "#FFFFFF";

  useEffect(() => {
    captureLocation();
  }, []);

  const captureLocation = useCallback(async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location needed",
          "Pasop reports need a GPS pin so other commuters know where the hazard is. Enable location in your settings to continue."
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      try {
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (geo) {
          const parts = [geo.street, geo.district || geo.city, geo.region].filter(
            Boolean
          );
          setLocationLabel(parts.join(", "));
        }
      } catch {
        // reverse geocoding optional
      }
    } catch {
      Alert.alert("Could not get GPS", "Please try again in a moment.");
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  const handleSelectCategory = useCallback((id: PasopCategory) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    setSelectedCategory(id);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedCategory) {
      Alert.alert("Pick a category", "Tell us what kind of hazard you're reporting.");
      return;
    }
    if (!coords) {
      Alert.alert(
        "GPS needed",
        "We need your current location to pin this report on the map."
      );
      return;
    }

    setSubmitting(true);
    try {
      const reporterId = user?.id || (await getDeviceId());
      const report = createPasopReport({
        category: selectedCategory,
        latitude: coords.latitude,
        longitude: coords.longitude,
        reporterId,
        reporterName: user?.displayName || undefined,
        description: description.trim() || undefined,
      });
      await savePasopReport(report);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "Pasop sent",
        "Thanks for keeping Mzansi safe. Your report is now visible to other commuters nearby.",
        [{ text: "Done", onPress: () => navigation.goBack() }]
      );
    } catch {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert("Could not save", "Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedCategory, coords, description, user, navigation]);

  const isValid = !!selectedCategory && !!coords;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing["3xl"] }}
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
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.heroBadge}>
              <Feather name="alert-triangle" size={16} color="#FFFFFF" />
              <ThemedText style={styles.heroBadgeText}>Report hazard</ThemedText>
            </View>
            <View style={styles.heroSpacer} />
          </View>
          <ThemedText style={styles.heroTitle}>Pasop!</ThemedText>
          <ThemedText style={styles.heroSubtitle}>
            Warn fellow commuters about hazards in real time.
          </ThemedText>
        </LinearGradient>

        <View style={styles.content}>
          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>What's happening?</ThemedText>
            <View style={styles.categoryGrid}>
              {PASOP_CATEGORY_LIST.map((cat) => {
                const selected = selectedCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      {
                        backgroundColor: cardSurface,
                        borderColor: selected ? cat.color : BrandColors.gray[200],
                      },
                      selected && {
                        backgroundColor: `${cat.color}10`,
                      },
                    ]}
                    onPress={() => handleSelectCategory(cat.id)}
                  >
                    <View
                      style={[
                        styles.categoryIconWrap,
                        { backgroundColor: `${cat.color}15` },
                        selected && { backgroundColor: cat.color },
                      ]}
                    >
                      <Feather
                        name={cat.icon}
                        size={20}
                        color={selected ? "#FFFFFF" : cat.color}
                      />
                    </View>
                    <ThemedText
                      style={[
                        styles.categoryLabel,
                        selected && { color: cat.color, fontWeight: "800" },
                      ]}
                    >
                      {cat.label}
                    </ThemedText>
                    <ThemedText style={styles.categoryDesc} numberOfLines={2}>
                      {cat.description}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(400)}
            style={styles.section}
          >
            <ThemedText style={styles.sectionLabel}>Location</ThemedText>
            <View style={[styles.locationCard, { backgroundColor: cardSurface }]}>
              {loadingLocation ? (
                <View style={styles.locationRow}>
                  <ActivityIndicator
                    size="small"
                    color={BrandColors.primary.gradientStart}
                  />
                  <ThemedText style={styles.locationMutedText}>
                    Getting your GPS pin...
                  </ThemedText>
                </View>
              ) : coords ? (
                <>
                  <View style={styles.locationRow}>
                    <View style={styles.locationIconWrap}>
                      <Feather
                        name="crosshair"
                        size={16}
                        color={BrandColors.status.success}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      {locationLabel ? (
                        <ThemedText
                          style={styles.locationAddress}
                          numberOfLines={1}
                        >
                          {locationLabel}
                        </ThemedText>
                      ) : null}
                      <ThemedText style={styles.locationCoords}>
                        {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    style={styles.refreshButton}
                    onPress={captureLocation}
                  >
                    <Feather
                      name="refresh-cw"
                      size={12}
                      color={BrandColors.primary.gradientStart}
                    />
                    <ThemedText style={styles.refreshText}>Update GPS</ThemedText>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.locationRow} onPress={captureLocation}>
                  <View style={styles.locationIconWrap}>
                    <Feather
                      name="navigation"
                      size={16}
                      color={BrandColors.primary.gradientStart}
                    />
                  </View>
                  <ThemedText style={styles.getGpsText}>Tap to get GPS</ThemedText>
                </Pressable>
              )}
            </View>
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(140).duration(400)}
            style={styles.section}
          >
            <View style={styles.descriptionLabelRow}>
              <ThemedText style={styles.sectionLabel}>Details (optional)</ThemedText>
              <ThemedText style={styles.charCount}>{description.length}/280</ThemedText>
            </View>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: cardSurface, color: theme.text },
              ]}
              placeholder="Describe what you're seeing..."
              placeholderTextColor={BrandColors.gray[500]}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={280}
              textAlignVertical="top"
            />
          </Animated.View>

          <Animated.View
            entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(400)}
            style={[styles.privacyCard, { backgroundColor: cardSurface }]}
          >
            <Feather
              name="shield"
              size={16}
              color={BrandColors.primary.gradientStart}
            />
            <ThemedText style={styles.privacyText}>
              Your name is hidden from the public feed. Reports expire automatically
              after a few hours unless other commuters confirm them.
            </ThemedText>
          </Animated.View>

          <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(260).duration(400)}>
            <GradientButton
              onPress={handleSubmit}
              disabled={!isValid || submitting}
              icon={submitting ? undefined : "send"}
            >
              {submitting ? "Sending..." : "Send Pasop"}
            </GradientButton>
          </Animated.View>
        </View>
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
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryCard: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  categoryLabel: {
    ...Typography.small,
    fontWeight: "700",
  },
  categoryDesc: {
    ...Typography.label,
    color: BrandColors.gray[600],
    lineHeight: 16,
  },
  locationCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    gap: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  locationIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  locationAddress: {
    ...Typography.body,
    fontWeight: "700",
  },
  locationCoords: {
    ...Typography.label,
    color: BrandColors.gray[600],
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  locationMutedText: {
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
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
  },
  refreshText: {
    ...Typography.label,
    fontWeight: "700",
    color: BrandColors.primary.gradientStart,
  },
  descriptionLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  charCount: {
    ...Typography.label,
    color: BrandColors.gray[500],
    fontVariant: ["tabular-nums"],
  },
  textArea: {
    ...Typography.body,
    minHeight: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "25",
  },
  privacyText: {
    ...Typography.label,
    flex: 1,
    color: BrandColors.gray[700],
    lineHeight: 16,
  },
});

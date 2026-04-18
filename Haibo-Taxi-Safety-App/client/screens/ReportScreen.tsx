import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Audio } from "expo-av";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { MediaCaptureBar } from "@/components/MediaCaptureBar";
import { MediaPreviewGrid } from "@/components/MediaPreviewGrid";
import { GradientButton } from "@/components/GradientButton";
import { useTheme } from "@/hooks/useTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Spacing, BrandColors, BorderRadius, Typography } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { ISSUE_TYPES, SEVERITY_LEVELS } from "@/lib/mockData";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { saveReport, generateId, generateReportId } from "@/lib/storage";
import { Report, MediaEvidence, ReportLocation } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ISSUE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  reckless_driving: "alert-triangle",
  overcrowding: "users",
  rude_driver: "user-x",
  vehicle_condition: "tool",
  overcharging: "tag",
  harassment: "shield-off",
  accident: "alert-octagon",
  theft: "slash",
  other: "more-horizontal",
};

const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 500;

export default function ReportScreen() {
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [issueType, setIssueType] = useState<string>("");
  const [severity, setSeverity] = useState<string>("medium");
  const [vehicleReg, setVehicleReg] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [evidence, setEvidence] = useState<MediaEvidence[]>([]);
  const [currentLocation, setCurrentLocation] = useState<ReportLocation | null>(null);
  const [audioRecording, setAudioRecording] = useState<Audio.Recording | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const trimmedLength = description.trim().length;
  const isFormValid = issueType.length > 0 && trimmedLength >= DESCRIPTION_MIN;

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? undefined,
          timestamp: new Date().toISOString(),
          speed: loc.coords.speed ?? undefined,
        });
      } catch {
        // silent — location is optional
      }
    })();
  }, []);

  const handleCapturePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Camera access is needed to capture photos as evidence.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        exif: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setEvidence((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "photo",
            uri: asset.uri,
            timestamp: new Date().toISOString(),
            location: currentLocation
              ? {
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  accuracy: currentLocation.accuracy,
                }
              : undefined,
            size: asset.fileSize,
          },
        ]);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    }
  };

  const handleRecordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Camera access is needed to record video.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 60,
        quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setEvidence((prev) => [
          ...prev,
          {
            id: generateId(),
            type: "video",
            uri: asset.uri,
            duration: asset.duration ? asset.duration / 1000 : undefined,
            timestamp: new Date().toISOString(),
            location: currentLocation
              ? {
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  accuracy: currentLocation.accuracy,
                }
              : undefined,
            size: asset.fileSize,
          },
        ]);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to record video. Please try again.");
    }
  };

  const handleRecordAudio = async () => {
    if (isRecordingAudio && audioRecording) {
      try {
        const finalDuration = recordingDuration;
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        await audioRecording.stopAndUnloadAsync();
        const uri = audioRecording.getURI();
        setAudioRecording(null);
        setIsRecordingAudio(false);
        setRecordingDuration(0);

        if (uri) {
          setEvidence((prev) => [
            ...prev,
            {
              id: generateId(),
              type: "audio",
              uri,
              duration: finalDuration,
              timestamp: new Date().toISOString(),
              location: currentLocation
                ? {
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                    accuracy: currentLocation.accuracy,
                  }
                : undefined,
            },
          ]);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      } catch {
        Alert.alert("Error", "Failed to save audio recording.");
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "Microphone access is needed to record audio.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setAudioRecording(recording);
      setIsRecordingAudio(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      Alert.alert("Error", "Failed to start audio recording. Please try again.");
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Media library access is needed to select evidence.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets.length > 0) {
        const added: MediaEvidence[] = result.assets.map((asset) => ({
          id: generateId(),
          type: asset.type === "video" ? "video" : "photo",
          uri: asset.uri,
          duration: asset.duration ? asset.duration / 1000 : undefined,
          timestamp: new Date().toISOString(),
          location: currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                accuracy: currentLocation.accuracy,
              }
            : undefined,
          size: asset.fileSize,
        }));
        setEvidence((prev) => [...prev, ...added]);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch {
      Alert.alert("Error", "Failed to access gallery. Please try again.");
    }
  };

  const handleRemoveEvidence = useCallback((id: string) => {
    setEvidence((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    try {
      const report: Report = {
        id: generateReportId(),
        issueType: issueType as any,
        severity: severity as any,
        vehicleRegistration: vehicleReg || undefined,
        description,
        evidence,
        location: currentLocation ?? undefined,
        createdAt: new Date().toISOString(),
        status: "pending",
      };

      await saveReport(report);

      if (getApiUrl()) {
        try {
          await apiRequest("/api/complaints", {
            method: "POST",
            body: JSON.stringify({
              category: issueType,
              severity,
              description,
              taxiPlateNumber: vehicleReg || undefined,
              incidentLocation: currentLocation
                ? `${currentLocation.latitude},${currentLocation.longitude}`
                : undefined,
              incidentLatitude: currentLocation?.latitude,
              incidentLongitude: currentLocation?.longitude,
              incidentDate: new Date().toISOString(),
            }),
          });
        } catch (apiErr) {
          console.log("Complaint submission saved locally only:", apiErr);
        }
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert(
        "Report submitted",
        "Thank you for speaking up. We will investigate this and keep the community informed.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch {
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
            <Feather name="alert-triangle" size={16} color="#FFFFFF" />
            <ThemedText style={styles.heroBadgeText}>Report</ThemedText>
          </View>
          <View style={styles.heroSpacer} />
        </View>
        <ThemedText style={styles.heroTitle}>Speak up, Mzansi.</ThemedText>
        <ThemedText style={styles.heroSubtitle}>
          Your report helps keep every commuter safer.
        </ThemedText>
      </LinearGradient>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
      >
        <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(400)} style={styles.card}>
          <Pressable
            style={styles.ratingBanner}
            onPress={() => navigation.navigate("Rating")}
          >
            <View style={styles.ratingBannerIcon}>
              <Feather name="star" size={18} color={BrandColors.primary.gradientStart} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.ratingBannerTitle}>Want to rate a driver?</ThemedText>
              <ThemedText style={styles.ratingBannerSubtitle}>
                Rate service & safety instead of filing a report
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={18} color={BrandColors.primary.gradientStart} />
          </Pressable>

          {currentLocation ? (
            <View style={styles.locationPill}>
              <Feather name="map-pin" size={16} color={BrandColors.status.success} />
              <ThemedText style={styles.locationPillText}>
                Location attached · {currentLocation.latitude.toFixed(3)}, {currentLocation.longitude.toFixed(3)}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.locationPillMuted}>
              <Feather name="map-pin" size={16} color={BrandColors.gray[600]} />
              <ThemedText style={styles.locationPillMutedText}>
                Location not shared — report saves without coordinates
              </ThemedText>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(80).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>What happened?</ThemedText>
          <View style={styles.issueGrid}>
            {ISSUE_TYPES.map((type) => {
              const selected = issueType === type.value;
              const iconName = ISSUE_ICONS[type.value] ?? "alert-circle";
              return (
                <Pressable
                  key={type.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setIssueType(type.value);
                  }}
                  style={[
                    styles.issueChip,
                    selected && styles.issueChipActive,
                  ]}
                >
                  <Feather
                    name={iconName}
                    size={16}
                    color={selected ? "#FFFFFF" : BrandColors.primary.gradientStart}
                  />
                  <ThemedText
                    style={[
                      styles.issueChipText,
                      selected && styles.issueChipTextActive,
                    ]}
                  >
                    {type.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(120).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>How severe?</ThemedText>
          <View style={styles.severityRow}>
            {SEVERITY_LEVELS.map((level) => {
              const selected = severity === level.value;
              return (
                <Pressable
                  key={level.value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSeverity(level.value);
                  }}
                  style={[
                    styles.severityButton,
                    selected && { backgroundColor: level.color, borderColor: level.color },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.severityText,
                      selected && { color: "#FFFFFF" },
                    ]}
                  >
                    {level.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(160).duration(400)} style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <ThemedText style={styles.sectionLabel}>Describe it</ThemedText>
            <ThemedText
              style={[
                styles.charCounter,
                trimmedLength < DESCRIPTION_MIN && { color: BrandColors.status.warning },
                trimmedLength >= DESCRIPTION_MIN && { color: BrandColors.status.success },
              ]}
            >
              {trimmedLength}/{DESCRIPTION_MAX}
            </ThemedText>
          </View>
          <TextInput
            style={styles.textArea}
            placeholder="Tell us what happened — who, where, when..."
            placeholderTextColor={BrandColors.gray[500]}
            multiline
            maxLength={DESCRIPTION_MAX}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
          {trimmedLength < DESCRIPTION_MIN && trimmedLength > 0 ? (
            <ThemedText style={styles.hint}>
              At least {DESCRIPTION_MIN} characters so investigators have context.
            </ThemedText>
          ) : null}
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(200).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Evidence (optional)</ThemedText>
          <MediaPreviewGrid evidence={evidence} onRemove={handleRemoveEvidence} />
          <MediaCaptureBar
            onCapturePhoto={handleCapturePhoto}
            onRecordVideo={handleRecordVideo}
            onRecordAudio={handleRecordAudio}
            onPickFromGallery={handlePickFromGallery}
            isRecordingAudio={isRecordingAudio}
            audioDuration={recordingDuration}
          />
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(240).duration(400)} style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Vehicle details (optional)</ThemedText>
          <View style={styles.inputWrap}>
            <Feather name="hash" size={16} color={BrandColors.gray[600]} />
            <TextInput
              style={styles.input}
              placeholder="e.g. GP 123 456"
              placeholderTextColor={BrandColors.gray[500]}
              value={vehicleReg}
              onChangeText={setVehicleReg}
              autoCapitalize="characters"
            />
          </View>
        </Animated.View>

        <Animated.View entering={reducedMotion ? undefined : FadeInDown.delay(280).duration(400)}>
          <GradientButton
            onPress={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            icon={isSubmitting ? undefined : "send"}
          >
            {isSubmitting ? "Submitting..." : "Submit report"}
          </GradientButton>
          <ThemedText style={styles.footerNote}>
            Reports are saved locally and synced to the Haibo! community dashboard.
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: Spacing.sm,
  },
  ratingBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
    backgroundColor: BrandColors.primary.gradientStart + "12",
    gap: Spacing.md,
  },
  ratingBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBannerTitle: {
    ...Typography.body,
    fontWeight: "700",
    color: BrandColors.gray[900],
  },
  ratingBannerSubtitle: {
    ...Typography.small,
    color: BrandColors.gray[600],
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.status.success + "15",
  },
  locationPillText: {
    ...Typography.small,
    color: BrandColors.status.success,
    fontWeight: "600",
    flex: 1,
  },
  locationPillMuted: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.gray[100],
  },
  locationPillMutedText: {
    ...Typography.small,
    color: BrandColors.gray[600],
    flex: 1,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.label,
    color: BrandColors.gray[700],
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  charCounter: {
    ...Typography.small,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginBottom: Spacing.sm,
  },
  issueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  issueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary.gradientStart + "12",
    borderWidth: 1,
    borderColor: BrandColors.primary.gradientStart + "33",
  },
  issueChipActive: {
    backgroundColor: BrandColors.primary.gradientStart,
    borderColor: BrandColors.primary.gradientStart,
  },
  issueChipText: {
    ...Typography.small,
    fontWeight: "600",
    color: BrandColors.primary.gradientStart,
  },
  issueChipTextActive: {
    color: "#FFFFFF",
  },
  severityRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    backgroundColor: BrandColors.gray[100],
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
  },
  severityText: {
    ...Typography.small,
    fontWeight: "700",
    color: BrandColors.gray[700],
  },
  textArea: {
    ...Typography.body,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    minHeight: 120,
    borderWidth: 1,
    borderColor: BrandColors.gray[200],
    backgroundColor: "#FFFFFF",
    color: BrandColors.gray[900],
  },
  hint: {
    ...Typography.small,
    color: BrandColors.status.warning,
    marginTop: Spacing.xs,
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
  footerNote: {
    ...Typography.small,
    color: BrandColors.gray[600],
    textAlign: "center",
    marginTop: Spacing.md,
  },
});

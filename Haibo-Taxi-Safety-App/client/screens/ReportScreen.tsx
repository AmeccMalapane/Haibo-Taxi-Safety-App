import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Audio } from "expo-av";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { MediaCaptureBar } from "@/components/MediaCaptureBar";
import { MediaPreviewGrid } from "@/components/MediaPreviewGrid";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ISSUE_TYPES, SEVERITY_LEVELS, MOCK_ROUTES } from "@/lib/mockData";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { saveReport, generateId, generateReportId } from "@/lib/storage";
import { Report, MediaEvidence, ReportLocation } from "@/lib/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [issueType, setIssueType] = useState<string>("");
  const [severity, setSeverity] = useState<string>("medium");
  const [vehicleReg, setVehicleReg] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [evidence, setEvidence] = useState<MediaEvidence[]>([]);
  const [currentLocation, setCurrentLocation] = useState<ReportLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [audioRecording, setAudioRecording] = useState<Audio.Recording | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const isFormValid = issueType.length > 0 && description.trim().length > 10;

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        await getCurrentLocation();
      }
    } catch (error) {
      console.log("Location permission error:", error);
    }
  };

  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
        timestamp: new Date().toISOString(),
        speed: location.coords.speed ?? undefined,
      });
    } catch (error) {
      console.log("Error getting location:", error);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleCapturePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to capture photos as evidence."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
        exif: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newEvidence: MediaEvidence = {
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
        };
        setEvidence((prev) => [...prev, newEvidence]);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.log("Error capturing photo:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    }
  };

  const handleRecordVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to record video evidence."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 60,
        quality: ImagePicker.UIImagePickerControllerQualityType.Medium,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newEvidence: MediaEvidence = {
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
        };
        setEvidence((prev) => [...prev, newEvidence]);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.log("Error recording video:", error);
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
          const newEvidence: MediaEvidence = {
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
          };
          setEvidence((prev) => [...prev, newEvidence]);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      } catch (error) {
        console.log("Error stopping recording:", error);
        Alert.alert("Error", "Failed to save audio recording.");
      }
      return;
    }

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Microphone access is needed to record audio evidence."
        );
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
    } catch (error) {
      console.log("Error starting recording:", error);
      Alert.alert("Error", "Failed to start audio recording. Please try again.");
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Media library access is needed to select evidence."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newEvidence: MediaEvidence[] = result.assets.map((asset) => ({
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
        setEvidence((prev) => [...prev, ...newEvidence]);
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.log("Error picking from gallery:", error);
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
        routeId: selectedRoute || undefined,
        description,
        evidence,
        location: currentLocation ?? undefined,
        createdAt: new Date().toISOString(),
        status: "pending",
      };

      // Save locally as backup
      await saveReport(report);

      // Submit to API if available
      if (getApiUrl()) {
        try {
          await apiRequest("/api/complaints", {
            method: "POST",
            body: JSON.stringify({
              category: issueType,
              severity,
              description,
              taxiPlateNumber: vehicleReg || undefined,
              routeName: selectedRoute || undefined,
              incidentLocation: currentLocation ? `${currentLocation.latitude},${currentLocation.longitude}` : undefined,
              incidentLatitude: currentLocation?.latitude,
              incidentLongitude: currentLocation?.longitude,
              incidentDate: new Date().toISOString(),
            }),
          });
        } catch (apiErr) {
          console.log("API complaint submission failed, saved locally:", apiErr);
        }
      }
      
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert(
        "Report Submitted",
        "Thank you for reporting this issue. We will investigate it immediately.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.log("Error submitting report:", error);
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="h2">Report an Issue</ThemedText>
          <ThemedText style={{ color: theme.textSecondary, marginTop: 4 }}>
            Your report helps keep the community safe.
          </ThemedText>
        </View>

        {/* Rating Quick Access */}
        <Pressable 
          style={[styles.ratingBanner, { backgroundColor: BrandColors.secondary.orange + "15", borderColor: BrandColors.secondary.orange + "30" }]}
          onPress={() => navigation.navigate("Rating")}
        >
          <View style={styles.ratingBannerIcon}>
            <Feather name="star" size={20} color={BrandColors.secondary.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.ratingBannerTitle}>Is this a driver rating?</ThemedText>
            <ThemedText style={styles.ratingBannerSubtitle}>Rate service & safety instead of reporting</ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={BrandColors.secondary.orange} />
        </Pressable>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Issue Type</ThemedText>
          <View style={styles.chipContainer}>
            {ISSUE_TYPES.map((type) => (
              <Pressable
                key={type.value}
                onPress={() => setIssueType(type.value)}
                style={[
                  styles.chip,
                  { backgroundColor: theme.backgroundSecondary },
                  issueType === type.value && { backgroundColor: BrandColors.primary.red },
                ]}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    issueType === type.value && { color: "#FFFFFF" },
                  ]}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Severity</ThemedText>
          <View style={styles.severityContainer}>
            {SEVERITY_LEVELS.map((level) => (
              <Pressable
                key={level.value}
                onPress={() => setSeverity(level.value)}
                style={[
                  styles.severityButton,
                  { backgroundColor: theme.backgroundSecondary },
                  severity === level.value && { backgroundColor: level.color },
                ]}
              >
                <ThemedText
                  style={[
                    styles.severityText,
                    severity === level.value && { color: "#FFFFFF" },
                  ]}
                >
                  {level.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Description</ThemedText>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Tell us what happened..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Evidence (Optional)</ThemedText>
          <MediaPreviewGrid 
            evidence={evidence} 
            onRemove={handleRemoveEvidence} 
          />
          <MediaCaptureBar
            onCapturePhoto={handleCapturePhoto}
            onRecordVideo={handleRecordVideo}
            onRecordAudio={handleRecordAudio}
            onPickFromGallery={handlePickFromGallery}
            isRecordingAudio={isRecordingAudio}
            audioDuration={recordingDuration}
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>Vehicle Details (Optional)</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Vehicle Registration (e.g. GP 123 456)"
            placeholderTextColor={theme.textSecondary}
            value={vehicleReg}
            onChangeText={setVehicleReg}
            autoCapitalize="characters"
          />
        </View>

        <Button
          title={isSubmitting ? "Submitting..." : "Submit Report"}
          onPress={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          style={styles.submitButton}
        />
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  ratingBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  ratingBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: BrandColors.secondary.orange,
  },
  ratingBannerSubtitle: {
    fontSize: 12,
    color: BrandColors.gray[600],
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  severityContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  severityButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  severityText: {
    fontSize: 14,
    fontWeight: "700",
  },
  textArea: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
});

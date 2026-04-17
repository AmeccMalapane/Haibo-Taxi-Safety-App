import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/hooks/useTheme";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { uploadFromUri } from "@/lib/uploads";

interface TripRatingPayload {
  plateNumber: string;
  driverRating: number;
  rankRating: number;
  driverName?: string;
  location?: string;
  review?: string;
  mediaUrls?: string[];
}

interface TripRatingResponse {
  submitted: boolean;
  linkedToDriver: boolean;
}

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  label: string;
}

function StarRating({ rating, onRatingChange, label }: StarRatingProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.ratingSection}>
      <ThemedText style={styles.ratingLabel}>{label}</ThemedText>
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onRatingChange(star)}>
            <Feather
              name={star <= rating ? "star" : "star"}
              size={32}
              color={star <= rating ? BrandColors.secondary.orange : theme.border}
              style={star <= rating ? styles.starActive : null}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function RatingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [driverRating, setDriverRating] = useState(0);
  const [rankRating, setRankRating] = useState(0);
  const [plateNumber, setPlateNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [location, setLocation] = useState("");
  // Local URI from expo-image-picker. Only uploaded to the server when the
  // rider taps Submit — no point burning bandwidth on photos they'll
  // discard. On successful upload we swap `image` to the returned URL so
  // the preview keeps working without re-fetching.
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const submitMutation = useMutation<TripRatingResponse, Error, TripRatingPayload>({
    mutationFn: (payload) =>
      apiRequest("/api/ratings/trip", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      Alert.alert(
        "Thank You!",
        data.linkedToDriver
          ? "Your feedback has been submitted and linked to the driver's record."
          : "Your feedback has been submitted to the Taxi Association.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    },
    onError: (error) => {
      Alert.alert(
        "Submission failed",
        error.message || "We couldn't send your rating. Please try again.",
      );
    },
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (driverRating === 0 || rankRating === 0 || !plateNumber.trim()) {
      Alert.alert(
        "Incomplete",
        "Please rate the driver, rate the rank, and enter the taxi plate number.",
      );
      return;
    }

    let mediaUrls: string[] | undefined;
    // Upload the attached photo first (if any). A failed upload shouldn't
    // block the rating from reaching the Taxi Association — evidence is a
    // bonus, not a gate — so we warn and proceed text-only.
    if (image && !/^https?:\/\//.test(image)) {
      try {
        setUploading(true);
        const uploaded = await uploadFromUri(image, { folder: "ratings" });
        mediaUrls = [uploaded.url];
        setImage(uploaded.url);
      } catch (err: any) {
        Alert.alert(
          "Photo upload failed",
          "We'll submit your rating without the photo. You can add media later.",
        );
      } finally {
        setUploading(false);
      }
    } else if (image) {
      mediaUrls = [image];
    }

    submitMutation.mutate({
      plateNumber: plateNumber.trim(),
      driverRating,
      rankRating,
      driverName: driverName.trim() || undefined,
      location: location.trim() || undefined,
      mediaUrls,
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl }
        ]}
      >
        <ThemedText type="h2" style={styles.title}>Rate Your Trip</ThemedText>
        <ThemedText style={styles.subtitle}>Help improve safety for everyone</ThemedText>

        <View style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}>
          <StarRating 
            label="Rate Driver" 
            rating={driverRating} 
            onRatingChange={setDriverRating} 
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <StarRating 
            label="Rate Taxi Rank" 
            rating={rankRating} 
            onRatingChange={setRankRating} 
          />
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Taxi Information</ThemedText>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Number Plate</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g. GP 123 456"
              placeholderTextColor={theme.textSecondary}
              value={plateNumber}
              onChangeText={setPlateNumber}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Driver Name (Optional)</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Full Name"
              placeholderTextColor={theme.textSecondary}
              value={driverName}
              onChangeText={setDriverName}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Rank / Location</ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              placeholder="Where did you get the taxi?"
              placeholderTextColor={theme.textSecondary}
              value={location}
              onChangeText={setLocation}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Visual Proof</ThemedText>
          <View style={styles.imagePickerContainer}>
            {image ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: image }} style={styles.previewImage} />
                <Pressable style={styles.removeImage} onPress={() => setImage(null)}>
                  <Feather name="x" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.photoButtonsRow}>
                <Pressable 
                  style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary }]} 
                  onPress={takePhoto}
                >
                  <Feather name="camera" size={24} color={BrandColors.primary.red} />
                  <ThemedText style={styles.photoButtonText}>Take Photo</ThemedText>
                </Pressable>
                <Pressable 
                  style={[styles.photoButton, { backgroundColor: theme.backgroundSecondary }]} 
                  onPress={pickImage}
                >
                  <Feather name="image" size={24} color={BrandColors.primary.red} />
                  <ThemedText style={styles.photoButtonText}>Upload</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <Pressable
          style={[
            styles.submitButton,
            (submitMutation.isPending || uploading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitMutation.isPending || uploading}
        >
          {submitMutation.isPending || uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.submitButtonText}>
              {image ? "Submit Feedback + Photo" : "Submit Feedback"}
            </ThemedText>
          )}
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: BrandColors.gray[500],
    marginBottom: Spacing.xl,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  ratingSection: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  ratingLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  starsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  starActive: {
    textShadowColor: "rgba(255, 160, 0, 0.3)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  divider: {
    height: 1,
    width: "100%",
    marginVertical: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: BrandColors.primary.red,
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    borderWidth: 1,
  },
  imagePickerContainer: {
    marginTop: Spacing.xs,
  },
  photoButtonsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  photoButton: {
    flex: 1,
    height: 100,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: BrandColors.primary.red,
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  previewContainer: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImage: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    backgroundColor: BrandColors.primary.red,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    shadowColor: BrandColors.primary.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
});

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
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Spacing, BrandColors, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

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

const ROUTE_TYPES = [
  { id: "local", label: "Local", icon: "navigation" },
  { id: "regional", label: "Regional", icon: "map" },
  { id: "intercity", label: "Intercity", icon: "globe" },
];

const HAND_SIGNALS = [
  { id: "point_up", label: "Point Up", icon: "arrow-up" },
  { id: "point_down", label: "Point Down", icon: "arrow-down" },
  { id: "fist", label: "Fist", icon: "square" },
  { id: "flat_hand", label: "Flat Hand", icon: "minus" },
  { id: "two_fingers", label: "Two Fingers", icon: "chevrons-up" },
  { id: "circle", label: "Circle", icon: "circle" },
];

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export default function ContributeRouteScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
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
    const generateDeviceId = async () => {
      try {
        const AsyncStorage = await import("@react-native-async-storage/async-storage");
        let storedDeviceId = await AsyncStorage.default.getItem("deviceId");
        if (!storedDeviceId) {
          storedDeviceId = `device_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await AsyncStorage.default.setItem("deviceId", storedDeviceId);
        }
        setDeviceId(storedDeviceId);
      } catch {
        setDeviceId(`device_${Date.now()}`);
      }
    };
    generateDeviceId();
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/contributions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contributions"] });
      Alert.alert(
        "Route Submitted",
        "Thank you for contributing! Your route will be reviewed by the community before being added.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to submit contribution. Please try again.");
    },
  });

  const isFormValid =
    origin.trim() &&
    destination.trim() &&
    fare.trim() &&
    parseFloat(fare) > 0 &&
    selectedProvince &&
    selectedHandSignal;

  const handleUseLocation = async (type: "origin" | "destination") => {
    setLoadingLocation(type);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to use this feature. Please enable it in your device settings."
        );
        setLoadingLocation(null);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

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

      const locationData: LocationData = { latitude, longitude, address };

      if (type === "origin") {
        setOrigin(address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setOriginLocation(locationData);
      } else {
        setDestination(address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setDestinationLocation(locationData);
      }

      try {
        const Haptics = await import("expo-haptics");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (error) {
      Alert.alert("Error", "Failed to get your location. Please try again or enter manually.");
    } finally {
      setLoadingLocation(null);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      return;
    }

    try {
      const Haptics = await import("expo-haptics");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const contributionData = {
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
    };

    submitMutation.mutate(contributionData);
  };

  const triggerHaptic = async () => {
    try {
      const Haptics = await import("expo-haptics");
      Haptics.selectionAsync();
    } catch {}
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.infoCard}>
          <Feather name="info" size={18} color={BrandColors.primary.blue} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Your contribution helps fellow commuters. Submitted routes are reviewed and voted on by the community before being added.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Route Details</ThemedText>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                From Location *
              </ThemedText>
              <Pressable
                style={[styles.locationButton, { backgroundColor: `${BrandColors.primary.blue}15` }]}
                onPress={() => handleUseLocation("origin")}
                disabled={loadingLocation === "origin"}
              >
                {loadingLocation === "origin" ? (
                  <ActivityIndicator size="small" color={BrandColors.primary.blue} />
                ) : (
                  <>
                    <Feather name="map-pin" size={14} color={BrandColors.primary.blue} />
                    <ThemedText style={[styles.locationButtonText, { color: BrandColors.primary.blue }]}>
                      Use My Location
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              placeholder="e.g., Soweto (Baragwanath)"
              placeholderTextColor={theme.textSecondary}
              value={origin}
              onChangeText={(text) => {
                setOrigin(text);
                if (originLocation) setOriginLocation(null);
              }}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                To Location (Destination) *
              </ThemedText>
              <Pressable
                style={[styles.locationButton, { backgroundColor: `${BrandColors.primary.blue}15` }]}
                onPress={() => handleUseLocation("destination")}
                disabled={loadingLocation === "destination"}
              >
                {loadingLocation === "destination" ? (
                  <ActivityIndicator size="small" color={BrandColors.primary.blue} />
                ) : (
                  <>
                    <Feather name="map-pin" size={14} color={BrandColors.primary.blue} />
                    <ThemedText style={[styles.locationButtonText, { color: BrandColors.primary.blue }]}>
                      Use My Location
                    </ThemedText>
                  </>
                )}
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              placeholder="e.g., Johannesburg CBD (Noord)"
              placeholderTextColor={theme.textSecondary}
              value={destination}
              onChangeText={(text) => {
                setDestination(text);
                if (destinationLocation) setDestinationLocation(null);
              }}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              Station/Taxi Rank Name
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              placeholder="e.g., Baragwanath Taxi Rank"
              placeholderTextColor={theme.textSecondary}
              value={taxiRankName}
              onChangeText={setTaxiRankName}
            />
            <ThemedText style={[styles.helperText, { color: theme.textSecondary }]}>
              The main taxi rank where you catch this route
            </ThemedText>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                Fare (R) *
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundDefault, color: theme.text },
                ]}
                placeholder="25"
                placeholderTextColor={theme.textSecondary}
                value={fare}
                onChangeText={setFare}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: Spacing.md }]}>
              <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
                Est. Time
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundDefault, color: theme.text },
                ]}
                placeholder="45 min"
                placeholderTextColor={theme.textSecondary}
                value={estimatedTime}
                onChangeText={setEstimatedTime}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              Distance (km)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              placeholder="15"
              placeholderTextColor={theme.textSecondary}
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Route Type</ThemedText>
          <View style={styles.routeTypeContainer}>
            {ROUTE_TYPES.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.routeTypeCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: selectedRouteType === type.id ? BrandColors.primary.blue : "transparent",
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  triggerHaptic();
                  setSelectedRouteType(type.id);
                }}
              >
                <Feather
                  name={type.icon as any}
                  size={20}
                  color={selectedRouteType === type.id ? BrandColors.primary.blue : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.routeTypeLabel,
                    { color: selectedRouteType === type.id ? BrandColors.primary.blue : theme.text },
                  ]}
                >
                  {type.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Province/Region *</ThemedText>
          <View style={styles.chipContainer}>
            {PROVINCES.map((province) => (
              <Pressable
                key={province}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      selectedProvince === province
                        ? BrandColors.primary.blue
                        : theme.backgroundDefault,
                  },
                ]}
                onPress={() => {
                  triggerHaptic();
                  setSelectedProvince(province);
                }}
              >
                <ThemedText
                  style={[
                    styles.chipText,
                    { color: selectedProvince === province ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {province}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Hand Signal *</ThemedText>
          <View style={styles.signalGrid}>
            {HAND_SIGNALS.map((signal) => (
              <Pressable
                key={signal.id}
                style={[
                  styles.signalCard,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor:
                      selectedHandSignal === signal.id
                        ? BrandColors.secondary.purple
                        : "transparent",
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  triggerHaptic();
                  setSelectedHandSignal(signal.id);
                }}
              >
                <View
                  style={[
                    styles.signalIcon,
                    {
                      backgroundColor:
                        selectedHandSignal === signal.id
                          ? "rgba(123, 31, 162, 0.15)"
                          : "rgba(123, 31, 162, 0.08)",
                    },
                  ]}
                >
                  <Feather
                    name={signal.icon as any}
                    size={20}
                    color={BrandColors.secondary.purple}
                  />
                </View>
                <ThemedText style={styles.signalLabel}>{signal.label}</ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              Signal Description (optional)
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              placeholder="Describe how commuters use this signal"
              placeholderTextColor={theme.textSecondary}
              value={handSignalDescription}
              onChangeText={setHandSignalDescription}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Additional Information</ThemedText>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              Additional Notes
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              placeholder="Any additional information about this route..."
              placeholderTextColor={theme.textSecondary}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
            <ThemedText style={[styles.charCount, { color: theme.textSecondary }]}>
              {additionalNotes.length}/500
            </ThemedText>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
              Your Name (optional)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.backgroundDefault, color: theme.text },
              ]}
              placeholder="Display name for your contribution"
              placeholderTextColor={theme.textSecondary}
              value={contributorName}
              onChangeText={setContributorName}
            />
          </View>
        </View>

        <View style={[styles.processSection, { backgroundColor: `${BrandColors.gray[500]}10` }]}>
          <ThemedText style={[styles.processSectionTitle, { color: theme.textSecondary }]}>
            What happens next?
          </ThemedText>
          <View style={styles.processItem}>
            <Feather name="check-circle" size={14} color={BrandColors.primary.green} />
            <ThemedText style={[styles.processText, { color: theme.textSecondary }]}>
              Your submission will be reviewed by the community
            </ThemedText>
          </View>
          <View style={styles.processItem}>
            <Feather name="users" size={14} color={BrandColors.primary.blue} />
            <ThemedText style={[styles.processText, { color: theme.textSecondary }]}>
              Other users can vote to verify the information
            </ThemedText>
          </View>
          <View style={styles.processItem}>
            <Feather name="award" size={14} color={BrandColors.secondary.orange} />
            <ThemedText style={[styles.processText, { color: theme.textSecondary }]}>
              Approved routes appear in the official route list
            </ThemedText>
          </View>
          <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
            Note: Please ensure information is accurate. False submissions may be removed.
          </ThemedText>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.cancelButton, { backgroundColor: theme.backgroundDefault }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
          </Pressable>

          <Pressable
            style={[
              styles.submitButton,
              {
                backgroundColor: isFormValid
                  ? BrandColors.primary.green
                  : BrandColors.gray[400],
                opacity: submitMutation.isPending ? 0.7 : 1,
                flex: 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={!isFormValid || submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="send" size={18} color="#FFFFFF" />
                <ThemedText style={styles.submitButtonText}>Submit for Review</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(33, 150, 243, 0.08)",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  locationButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
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
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
  },
  routeTypeContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  routeTypeCard: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  routeTypeLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  signalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  signalCard: {
    width: "30%",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  signalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  signalLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  processSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  processSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  processItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  processText: {
    fontSize: 13,
    flex: 1,
  },
  disclaimer: {
    fontSize: 11,
    fontStyle: "italic",
    marginTop: Spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelButton: {
    height: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
